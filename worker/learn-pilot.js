const LEARN_OFFERS={
 studio:{title:'Teacher studio',price:11.99},
 pack:{title:'Subject revision pack',price:5.97},
 school:{title:'School pack',price:99.99}
};
const LEARN_PILOT='learn_pilot';
const learnOrderId=(owner,offer)=>reportSHA('sieg-learn:'+offer+':'+owner).then(x=>'LEARN-'+x);
async function learnOrder(env,owner,offer){
 const row=await env.DB.prepare('SELECT body_json FROM siege_records WHERE kind=? AND id=?').bind(LEARN_PILOT,await learnOrderId(owner,offer)).first();
 return row?JSON.parse(row.body_json):null;
}
// Country comes from Cloudflare's request geolocation, never a browser pricing override.
function loginPriceProfile(request){
 const code=String(request.cf?.country||request.headers.get('CF-IPCountry')||'').toUpperCase();
 const c=/^[A-Z]{2}$/.test(code)?addressCountry(code):null;
 if(c&&/^[A-Z]{3}$/.test(c.currency)&&c.currency!=='XXX')return {code:c.code,name:c.name,currency:c.currency,source:'location'};
 return {code:null,name:'Base pricing',currency:'USD',source:'fallback'};
}
async function loginPlanPricing(request,env,offers,baseCurrency='USD'){
 const profile=loginPriceProfile(request),basePrices=Object.fromEntries(Object.entries(offers).map(([key,value])=>[key,value.price]));
 try{
  const rate=(await learnRate(env,profile.currency))/(await learnRate(env,baseCurrency)),digits=new Intl.NumberFormat('en',{style:'currency',currency:profile.currency}).resolvedOptions().maximumFractionDigits,unit=10**digits;
  return {profile,baseCurrency,basePrices,conversionRate:rate,prices:Object.fromEntries(Object.entries(offers).map(([k,v])=>[k,Math.max(1,Math.round(v.price*rate*unit))/unit]))};
 }catch{return {profile,baseCurrency,basePrices,prices:null};}
}
let learnRatePending;
async function learnRate(env,currency){
 if(currency==='USD')return 1;
 const key='education/price-rates-usd.json',old=await reportRead(env,key);
 if(old?.until>Date.now()&&Number.isFinite(old.rates?.[currency])&&old.rates[currency]>0)return old.rates[currency];
 if(!learnRatePending)learnRatePending=(async()=>{
  const r=await fetch('https://open.er-api.com/v6/latest/USD',{signal:AbortSignal.timeout(5000)});
  if(!r.ok)throw Error('Exchange rate unavailable.');
  const d=await r.json();
  if(d.result!=='success'||d.base_code!=='USD'||!d.rates||d.time_last_update_unix*1000<Date.now()-3*86400000)throw Error('Exchange rate unavailable.');
  const rates={rates:d.rates,until:Math.max(Date.now()+3600000,d.time_next_update_unix*1000||0)};
  await env.BUCKET.put(key,JSON.stringify(rates));
  return rates;
 })().finally(()=>{learnRatePending=null});
 const data=await learnRatePending,rate=data.rates[currency];
 if(!Number.isFinite(rate)||rate<=0)throw Error('Exchange rate unavailable for this currency.');
 return rate;
}
function learnOrderView(r){return {id:r.id,state:r.state,offer:r.data.offer,until:r.data.until,subject:r.data.subject,grade:r.data.grade,custom:r.data.custom,price:r.data.price??LEARN_OFFERS[r.data.offer].price,currency:r.data.currency||'SZL'};}
async function learnPilotAPI(request,env){
 const u=new URL(request.url),owner=opsUser(request),admin=u.pathname.endsWith('/admin'),download=u.pathname.endsWith('/pack');
 if(!owner)return opsJSON({error:'Sign in to SIEG first.'},401);
 if(admin&&!opsAdmin(request))return opsJSON({error:'Administrator access required.'},403);
 if(!env.DB)return opsJSON({error:'Pilot storage is unavailable.'},503);
 try{
  if(request.method==='GET'){
   if(download){
    const id=u.searchParams.get('id');
    if(id&&!/^LEARN-[a-f0-9]{64}$/.test(id))return opsJSON({error:'Invalid pack reference.'},400);
    const row=id?await env.DB.prepare("SELECT body_json FROM siege_records WHERE kind=? AND id=? AND owner=?").bind(LEARN_PILOT,id,owner).first():null;
    const r=id?(row&&JSON.parse(row.body_json)):await learnOrder(env,owner,'pack');
    if(r?.state!=='active'||r.data.offer!=='pack')return opsJSON({error:'This pack has not been unlocked for your account.'},403);
    const attachment=r.data.custom?await env.BUCKET?.get('education/revision/'+r.data.packKey+'.pdf'):null;
    if(r.data.custom&&!attachment)return opsJSON({error:'The revision pack is temporarily unavailable.'},503);
    return new Response(attachment?attachment.body:LEARN_ENGLISH_PACK,{headers:{'Content-Type':attachment?'application/pdf':'text/html; charset=utf-8','Content-Disposition':'attachment; filename="'+(attachment?'SIEG-Revision-Pack.pdf':'SIEG-Form-2-English-Revision.html')+'"','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
   }
   if(admin){const {results}=await env.DB.prepare('SELECT body_json FROM siege_records WHERE kind=? ORDER BY created_at DESC LIMIT 100').bind(LEARN_PILOT).all();return opsJSON({orders:results.map(({body_json})=>{const r=JSON.parse(body_json);return {...learnOrderView(r),email:r.data.email,school:r.data.school,paymentReference:r.data.paymentReference}})});}
   const {profile,prices,baseCurrency,basePrices}=await loginPlanPricing(request,env,LEARN_OFFERS);
   const {results}=await env.DB.prepare('SELECT body_json FROM siege_records WHERE kind=? AND owner=? ORDER BY created_at DESC LIMIT 100').bind(LEARN_PILOT,owner).all();
   return opsJSON({orders:results.map(x=>learnOrderView(JSON.parse(x.body_json))),profile,prices,baseCurrency,basePrices});
  }
  if(request.method!=='POST'||download||request.headers.get('Origin')!==u.origin)return opsJSON({error:'Request not allowed.'},403);
  const b=await opsBody(request);
  if(admin){
   if(!/^LEARN-[a-f0-9]{64}$/.test(b.id)||b.confirmPayment!==true)throw Error('Confirm payment before activating access.');
   const paymentReference=opsText(b.paymentReference,'payment reference',100);
   const row=await env.DB.prepare('SELECT body_json FROM siege_records WHERE kind=? AND id=?').bind(LEARN_PILOT,b.id).first();
   const r=row&&JSON.parse(row.body_json);
   if(!r||r.data.offer==='school')throw Error('School pack requires separate onboarding.');
   if(r.state==='active'&&(r.data.offer==='pack'||Date.parse(r.data.until)>Date.now()))throw Error('This offer already has active access.');
   if(r.data.paymentReference===paymentReference)throw Error('This payment reference was already used for this request.');
   let packKey;
   if(r.data.custom){
    if(!env.BUCKET||typeof b.pdf!=='string'||b.pdf.length>5600000||!/^JVBERi0[A-Za-z0-9+/=]+$/.test(b.pdf))throw Error('Upload the matching revision pack as a PDF (up to 4 MB).');
    const bytes=Uint8Array.from(atob(b.pdf),c=>c.charCodeAt(0));
    if(bytes.length>4*1024*1024)throw Error('Upload a PDF of 4 MB or less.');
    packKey=crypto.randomUUID();
    await env.BUCKET.put('education/revision/'+packKey+'.pdf',bytes);
    r.data.packKey=packKey;
   }
   const start=new Date(),until=new Date(start),date=until.getUTCDate();
   until.setUTCDate(1);until.setUTCMonth(until.getUTCMonth()+2,0);until.setUTCDate(Math.min(date,until.getUTCDate()));
   r.state='active';r.data.paymentReference=paymentReference;r.data.activatedAt=start.toISOString();r.data.until=r.data.offer==='studio'?until.toISOString():null;
   const updated=await env.DB.prepare("UPDATE siege_records SET state='active',body_json=? WHERE kind=? AND id=? AND body_json=?").bind(JSON.stringify(r),LEARN_PILOT,r.id,row.body_json).run();
   if(!updated.meta?.changes){if(packKey)await env.BUCKET.delete('education/revision/'+packKey+'.pdf');throw Error('This request changed. Refresh and try again.');}
   return opsJSON(learnOrderView(r));
  }
  if(!Object.hasOwn(LEARN_OFFERS,b.offer)||b.teacher!==true)throw Error('Choose an offer and confirm you are a teacher or school representative.');
  const subject=b.offer==='pack'?opsText(b.subject,'subject',100):'';
  const grade=b.offer==='pack'?opsText(b.grade,'grade or form',80):'';
  const custom=b.offer==='pack'&&!(subject.toLowerCase()==='english'&&grade.toLowerCase()==='form 2');
  const key=custom?'pack:'+JSON.stringify([subject.toLowerCase(),grade.toLowerCase()]):b.offer;
  const previous=await learnOrder(env,owner,key);
  if(previous)return opsJSON(learnOrderView(previous));
  const {profile,prices,baseCurrency,basePrices}=await loginPlanPricing(request,env,LEARN_OFFERS);
  if(!prices)throw Error('Local pricing is temporarily unavailable. Try again later.');
  const email=opsEmail(request.headers.get('oai-authenticated-user-email')||'');
  const school=b.offer==='school'?opsText(b.school,'school name',120):'';
  const id=await learnOrderId(owner,key),createdAt=new Date().toISOString();
  const record={id,owner,state:'requested',createdAt,data:{offer:b.offer,email,school,subject,grade,custom,country:profile.code,currency:profile.currency,price:prices[b.offer]}};
  await env.DB.prepare('INSERT INTO siege_records(id,kind,owner,state,created_at,body_json) VALUES(?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING').bind(id,LEARN_PILOT,owner,record.state,createdAt,JSON.stringify(record)).run();
  return opsJSON(learnOrderView(await learnOrder(env,owner,key)));
 }catch(e){return opsJSON({error:e.message||'Could not process this pilot request.'},400);}
}
