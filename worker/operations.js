// Hosted records use D1 and Sites identity; photo bytes use protected R2 storage.
let opsExpertTrades;
function opsTrade(body,required){
 if(!required&&(body.trade==null||body.trade===''))return {trade:''};
 if(body.trade==='Other trade')return {trade:body.trade,customTrade:opsText(body.customTrade,'trade or specialty name',100)};
 opsExpertTrades??=new Set(estateJSON('assets/expert-trades.json').flatMap(group=>group.trades));
 if(!opsExpertTrades.has(body.trade))throw Error('Choose a listed trade or select Other trade.');
 return {trade:body.trade};
}
const opsUser=r=>r.headers.get('oai-authenticated-user-id');
const opsAdmin=r=>!!opsUser(r)&&r.headers.get('oai-authenticated-user-email')?.toLowerCase()==='tss.simelane@gmail.com';
const opsJSON=(v,status=200)=>new Response(JSON.stringify(v),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
async function opsRead(env,key){const match=key.match(/^operations\/(property|experts|briefs|enquiries|estate_requests|testimonials)\/([a-f0-9-]+)\.json$/);if(!match)return null;const row=await env.DB.prepare('SELECT body_json FROM siege_records WHERE kind = ? AND id = ?').bind(match[1],match[2]).first();return row?JSON.parse(row.body_json):null}
async function opsStore(env,kind,record){await env.DB.prepare('INSERT INTO siege_records (id, kind, owner, state, created_at, body_json) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET state = excluded.state, body_json = excluded.body_json').bind(record.id,kind,record.owner,record.state,record.createdAt,JSON.stringify(record)).run()}
async function opsRemove(env,kind,id){await env.DB.prepare('DELETE FROM siege_records WHERE kind = ? AND id = ?').bind(kind,id).run()}
const opsKey=(kind,id)=>'operations/'+kind+'/'+id+'.json';
const opsId=id=>/^[a-f0-9-]{36}$/.test(id||'');
function opsText(v,label,max=200,optional=false){if(typeof v!=='string'||(!optional&&!v.trim())||v.length>max||/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(v))throw Error('Enter a valid '+label+'.');return v.trim()}
function opsEmail(v){v=opsText(v,'email');if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v))throw Error('Enter a valid contact email.');return v}
async function opsBody(request){if(Number(request.headers.get('Content-Length'))>9*1024*1024)throw Error('Submission exceeds 9 MB.');const text=await request.text();if(new TextEncoder().encode(text).length>9*1024*1024)throw Error('Submission exceeds 9 MB.');return JSON.parse(text)}
async function opsRate(request,env){const owner=await reportSHA(opsUser(request)),slot='operations/rate/'+owner+'/'+Math.floor(Date.now()/5000);if(!await env.BUCKET.put(slot,'1',{onlyIf:{etagDoesNotMatch:'*'}}))throw Error('Please wait a few seconds before submitting again.')}
async function opsPhoto(env,data,kind,id,owner,created){
 if(typeof data!=='string'||!/^data:image\/jpeg;base64,[A-Za-z0-9+/]+=*$/.test(data)||data.length>1600000)throw Error('Use a JPEG photo smaller than 1.2 MB after resizing.');
 const bytes=Uint8Array.from(atob(data.split(',')[1]),c=>c.charCodeAt(0));if(bytes[0]!==255||bytes[1]!==216||bytes[2]!==255)throw Error('Photo must contain a valid JPEG.');
 const mediaId=crypto.randomUUID(),key='operations/media/'+mediaId;await env.BUCKET.put(key,bytes,{httpMetadata:{contentType:'image/jpeg'},customMetadata:{kind,id,owner}});created.push(key);return '/api/operations/media/'+mediaId;
}
function opsPublic(kind,record){
 const d=record.data;
 if(kind==='testimonials')return {id:record.id,name:d.name,service:(d.service||'').replace(/^SIEGE /,'SIEG ').replace(/^SIEG Address$/,'SIEG Address'),rating:d.rating,quote:d.quote,photo:d.photo||null,...(d.expertId?{expertId:d.expertId,expertName:d.expertName}:{})};
 if(kind==='property')return {countryCode:'SZ',country:'Eswatini',currency:'SZL',transaction:'sale',...d,id:record.id,state:record.state,date:record.createdAt.slice(0,10),tenure:'User supplied - ownership not verified'};
 return {id:record.id,name:d.name,initial:d.name.split(/\s+/).map(s=>s[0]).slice(0,2).join('').toUpperCase(),role:d.customTrade||d.trade,trade:d.trade,location:d.location,experience:d.experience,skills:d.skills,availability:d.availability,availabilityConfirmedAt:d.availabilityConfirmedAt,photo:d.photo,illustrative:false,reviewed:true};
}
const ESTATE_CATEGORY_CODES={Residential:'RS',Land:'LD',Commercial:'CM',Agricultural:'AG'};
function estateReferencePrefix(data){
 const code=data.countryCode||'SZ';let countryCode;
 if(code==='SZ'||code==='SWZ')countryCode='SZL';
 else{const country=estateJSON('assets/countries-global.json').find(c=>c.code===code||c.iso3===code);countryCode=country?.iso3;}
 const category=ESTATE_CATEGORY_CODES[data.type];if(!/^[A-Z]{3}$/.test(countryCode||'')||!category)throw Error('A valid country and property category are required for the property reference.');
 return countryCode+'-'+category;
}
async function estateReserveReference(env,data){
 const prefix=estateReferencePrefix(data),id='PROPERTY-COUNTER:'+prefix;
 const row=await env.DB.prepare("INSERT INTO siege_records(id,kind,owner,state,created_at,body_json) VALUES(?,'property_counter','system','active',?,json_object('count',1)) ON CONFLICT(id) DO UPDATE SET body_json=json_set(siege_records.body_json,'$.count',json_extract(siege_records.body_json,'$.count')+1) RETURNING json_extract(body_json,'$.count') AS count").bind(id,new Date().toISOString()).first();
 if(!Number.isSafeInteger(row?.count)||row.count<1)throw Error('The property reference could not be reserved. Please retry.');return prefix+'-'+String(row.count).padStart(3,'0');
}
async function estateEnsureReference(env,record){
 if(record.data.reference)return record;
 const reference=await estateReserveReference(env,record.data);
 const row=await env.DB.prepare("UPDATE siege_records SET body_json=json_set(body_json,'$.data.reference',?) WHERE kind='property' AND id=? AND json_extract(body_json,'$.data.reference') IS NULL RETURNING body_json").bind(reference,record.id).first();
 if(row)return JSON.parse(row.body_json);
 const saved=await env.DB.prepare("SELECT body_json FROM siege_records WHERE kind='property' AND id=?").bind(record.id).first();if(!saved)throw Error('Property listing no longer exists.');return JSON.parse(saved.body_json);
}
const OPS_ENQUIRY_QUEUES={
 'SIEG Transit Bundle Access':['transit-bundles','Transit bundle access'],
 'SIEG Transit Account Recovery':['transit-recovery','Transit account recovery'],
 'SIEG Transit Report':['transit-reports','Transit report requests'],
 'SIEG Hydrology · Monthly Water Summary':['water-summary-requests','Monthly Water Summary']
};
async function opsAdminInbox(env){
 const queues={
  property:['property-approvals','Property listings'],
  entrance_address:['address-approvals','Address reviews'],
  experts:['experts-approvals','Expert applications'],
  estate_requests:['estate-service-requests','Estate service requests'],
  briefs:['experts-matching-requests','Expert matching requests'],
  testimonials:['testimonial-approvals','Testimonials and expert reviews'],
  learn_flags:['learn-moderation','Study group reports'],
  learn_pilot:['learn-access-approvals','Learn access requests'],
  weekly_crop:['weekly-plan-approvals','Weekly crop plans']
 };
 const {results}=await env.DB.prepare(`SELECT kind,
   CASE WHEN kind='enquiries' THEN json_extract(body_json,'$.data.product') END product,
   count(*) count FROM siege_records
   WHERE (kind IN ('property','experts','testimonials','learn_flags') AND state='pending_review')
      OR (kind IN ('enquiries','briefs','estate_requests') AND state='new')
      OR (kind IN ('learn_pilot','weekly_crop') AND state='requested')
      OR (kind='entrance_address' AND json_extract(body_json,'$.adminReview.status') IS NULL)
   GROUP BY kind,product`).all();
 const items=new Map();
 for(const row of results){
  const [id,label]=row.kind==='enquiries'
   ? (Object.hasOwn(OPS_ENQUIRY_QUEUES,row.product)?OPS_ENQUIRY_QUEUES[row.product]:['general-enquiries','General enquiries'])
   : queues[row.kind];
  items.set(id,{id,label,count:(items.get(id)?.count||0)+Number(row.count)});
 }
 return opsJSON({items:[...items.values()].sort((a,b)=>a.label.localeCompare(b.label))});
}
async function opsList(env,kind,request,admin=false,publicOnly=false){
 const cursor=new URL(request.url).searchParams.get('cursor')||'ffffffff-ffff-ffff-ffff-ffffffffffff';if(!opsId(cursor))throw Error('Invalid page cursor.');
 let query='SELECT body_json FROM siege_records WHERE kind = ? AND id < ?',args=[kind,cursor];
 if(admin&&kind==='enquiries'){
  const params=new URL(request.url).searchParams,product=params.get('product');
  if(product){query+=" AND json_extract(body_json,'$.data.product') = ?";args.push(product);}
  else if(params.get('productGroup')==='general'){
   query+=" AND coalesce(json_extract(body_json,'$.data.product'),'') NOT IN (SELECT value FROM json_each(?))";
   args.push(JSON.stringify(Object.keys(OPS_ENQUIRY_QUEUES)));
  }
 }
 if(!admin){if(publicOnly){query+=' AND state = ?';args.push('approved')}else{query+=' AND (owner = ? OR state = ?)';args.push(opsUser(request),'approved')}}
 if(kind==='experts'&&publicOnly){
  const params=new URL(request.url).searchParams,value=(key,max)=>String(params.get(key)||'').trim().slice(0,max);
  const field=key=>"json_extract(body_json,'$.data."+key+"')";
  const role="COALESCE("+field('customTrade')+","+field('trade')+",'')";
  const trade=value('trade',100),q=value('q',200),sector=value('sector',100);
  if(trade){query+=" AND (instr(lower("+role+"),lower(?))>0 OR instr(lower("+field('trade')+"),lower(?))>0)";args.push(trade,trade)}
  if(q){query+=" AND instr(lower(COALESCE("+field('name')+",'') || ' ' || "+role+" || ' ' || COALESCE("+field('location')+",'') || ' ' || COALESCE("+field('skills')+",'')),lower(?))>0";args.push(q)}
  for(const key of ['location','availability']){const filter=value(key,100);if(filter){query+=' AND '+field(key)+' = ?';args.push(filter)}}
  if(sector){
   const groups=estateJSON('assets/expert-trades.json'),trades=sector==='Other trade'?groups.flatMap(g=>g.trades):groups.find(g=>g.label===sector)?.trades;
   if(!trades)return {rows:[],cursor:null};
   // Bind the sector as one JSON parameter, including the catch-all sector.
   query+=' AND '+field('trade')+(sector==='Other trade'?' NOT':'')+' IN (SELECT value FROM json_each(?))';args.push(JSON.stringify(trades));
  }
 }
 query+=' ORDER BY id DESC LIMIT 51';const result=await env.DB.prepare(query).bind(...args).all(),records=result.results.map(row=>JSON.parse(row.body_json)),page=records.slice(0,50);if(kind==='property')for(let i=0;i<page.length;i++)page[i]=await estateEnsureReference(env,page[i]);return {rows:page.map(record=>admin?record:opsPublic(kind,record)),cursor:records.length>50?page[page.length-1].id:null};
}
async function estateAccount(env,owner){if(!owner||!env.DB)return null;const row=await env.DB.prepare("SELECT body_json FROM siege_records WHERE kind = ? AND owner = ? LIMIT 1").bind('estate_accounts',owner).first();return row?JSON.parse(row.body_json):null}
// Address reviews annotate the private register without changing capture or publication.
const opsAddressId=id=>/^address-[a-f0-9-]{36}$/.test(id||'');
async function opsAddressReview(request,env,url){
 if(!opsAdmin(request))return opsJSON({error:'Administrator access required.'},403);
 if(request.method==='GET'){
  const cursor=url.searchParams.get('cursor');if(cursor&&!opsAddressId(cursor))return opsJSON({error:'Invalid cursor.'},400);
  const args=cursor?[cursor]:[];
  const {results}=await env.DB.prepare("SELECT id,created_at,body_json FROM siege_records WHERE kind='entrance_address'"+(cursor?' AND id<?':'')+' ORDER BY id DESC LIMIT 51').bind(...args).all();
  const page=results.slice(0,50);
  return opsJSON({records:page.map(r=>{
   const d=JSON.parse(r.body_json);
   return {id:r.id,createdAt:r.created_at,state:d.adminReview?.status||'pending_review',data:{title:d.siegId||d.entranceId||'Provisional address',entrance:d.entranceId,addressType:d.addressType,placeName:d.placeName,village:d.village,region:d.region,district:d.district,country:d.country,latitude:d.latitude,longitude:d.longitude,accuracy:d.accuracy}};
  }),cursor:results.length>50?page.at(-1).id:null});
 }
 if(request.method==='POST'){
  if(request.headers.get('Origin')!==url.origin)return opsJSON({error:'Origin not allowed.'},403);
  const {id,action}=await opsBody(request);
  if(!opsAddressId(id)||!['approved','rejected'].includes(action))return opsJSON({error:'Choose a valid address and review decision.'},400);
  const result=await env.DB.prepare("UPDATE siege_records SET body_json=json_set(body_json,'$.adminReview',json_object('status',?,'reviewedAt',?)) WHERE id=? AND kind='entrance_address' RETURNING id").bind(action,new Date().toISOString(),id).first();
  return result?opsJSON({id,state:action}):opsJSON({error:'Address not found.'},404);
 }
 return opsJSON({error:'Method not allowed.'},405);
}
// Reversible directory moderation; never grants a trial, subscription or paid access.
async function opsDirectoryReview(request,env,url,kind){
 if(!opsAdmin(request))return opsJSON({error:'Administrator access required.'},403);
 const business=kind==='business',stored=business?'business_profile':'international_graduate';
 if(request.method==='GET'){
  const cursor=url.searchParams.get('cursor');if(cursor&&!(business?/^business-[a-f0-9-]{36}$/:/^GRADUATE-[a-f0-9]{64}$/).test(cursor))return opsJSON({error:'Invalid cursor.'},400);
  const {results}=await env.DB.prepare('SELECT id,state,created_at,body_json FROM siege_records WHERE kind=?'+(cursor?' AND id<?':'')+' ORDER BY id DESC LIMIT 51').bind(stored,...(cursor?[cursor]:[])).all();const page=results.slice(0,50);
  return opsJSON({records:page.map(row=>{const data=JSON.parse(row.body_json);return {id:row.id,createdAt:row.created_at,state:(business?data.adminHidden:row.state!=='active')?'rejected':'approved',data:business?{name:data.name,category:data.category,trade:data.trade,email:data.email,phone:data.phone,addressId:data.addressId,publishConsent:data.publishConsent,visibility:'Restoring eligibility still requires consent and a valid trial or paid subscription.'}:{...data.data},contactEmail:business?null:data.contactEmail};}),cursor:results.length>50?page.at(-1).id:null});
 }
 if(request.method!=='POST')return opsJSON({error:'Method not allowed.'},405);
 if(request.headers.get('Origin')!==url.origin)return opsJSON({error:'Origin not allowed.'},403);
 const b=await opsBody(request);if(!(business?/^business-[a-f0-9-]{36}$/:/^GRADUATE-[a-f0-9]{64}$/).test(b.id||'')||!['approved','rejected'].includes(b.action))return opsJSON({error:'Choose a valid record and decision.'},400);
 const hidden=b.action==='rejected',time=new Date().toISOString();
 const result=business?await env.DB.prepare("UPDATE siege_records SET body_json=json_set(body_json,'$.adminHidden',json(?),'$.reviewedAt',?) WHERE id=? AND kind=? RETURNING id").bind(hidden?'true':'false',time,b.id,stored).first():await env.DB.prepare("UPDATE siege_records SET state=?,body_json=json_set(body_json,'$.state',?,'$.reviewedAt',?) WHERE id=? AND kind=? RETURNING id").bind(hidden?'suspended':'active',hidden?'suspended':'active',time,b.id,stored).first();
 return result?opsJSON({id:b.id,state:b.action}):opsJSON({error:'Record not found.'},404);
}
async function opsBusinessSubscriptions(request,env,url){
 if(!opsAdmin(request))return opsJSON({error:'Administrator access required.'},403);
 if(request.method!=='GET')return opsJSON({error:'Billing follows verified payment records. This overview is read-only.'},405);
 const status=url.searchParams.get('status')||'all',cursor=url.searchParams.get('cursor')||'';
 if(!['all','active','ending','trial','pending','expired','ended','unpaid'].includes(status)||cursor&&!/^business-[a-f0-9-]{36}$/.test(cursor))return opsJSON({error:'Choose a valid status or page.'},400);
 const now=Date.now(),billingStatus="CASE WHEN json_extract(b.body_json,'$.paymentVerified')=1 AND json_extract(b.body_json,'$.active')=1 AND json_extract(b.body_json,'$.live')=1 AND json_type(b.body_json,'$.paidUntil') IN ('integer','real') AND json_extract(b.body_json,'$.paidUntil')>? THEN CASE WHEN json_extract(b.body_json,'$.cancelAtPeriodEnd')=1 THEN 'ending' ELSE 'active' END WHEN json_type(b.body_json,'$.trialUntil') IN ('integer','real') AND json_extract(b.body_json,'$.trialUntil')>? THEN 'trial' WHEN json_extract(b.body_json,'$.status') IN ('canceled','cancelled','stopped','incomplete_expired') THEN 'ended' WHEN (json_extract(b.body_json,'$.paidUntil')>0 AND json_extract(b.body_json,'$.paidUntil')<=?) OR (json_extract(b.body_json,'$.trialUntil')>0 AND json_extract(b.body_json,'$.trialUntil')<=?) THEN 'expired' WHEN json_extract(b.body_json,'$.status') IN ('pending','past_due','incomplete','awaiting_payment','awaiting_checkout') THEN 'pending' ELSE 'unpaid' END";
 const result=await env.DB.prepare("SELECT * FROM (SELECT p.id,p.created_at,p.body_json profile,b.body_json billing,"+billingStatus+" billing_status FROM siege_records p LEFT JOIN siege_records b ON b.id=p.id||':subscription' AND b.kind='business_subscription' AND b.owner=p.owner WHERE p.kind='business_profile') WHERE (?='all' OR billing_status=?) AND (?='' OR id<?) ORDER BY id DESC LIMIT 26").bind(now,now,now,now,status,status,cursor,cursor).all();
 const page=result.results.slice(0,25),ids=page.map(r=>r.id),published=ids.length?(await env.DB.prepare('SELECT p.id'+BUSINESS_PUBLIC_JOIN+' AND p.id IN ('+ids.map(()=>'?').join(',')+')').bind(now,now,...ids).all()).results:[],visible=new Set(published.map(r=>r.id));
 const date=value=>typeof value==='number'&&value>0&&Number.isFinite(value)&&value<=8640000000000000?new Date(value).toISOString():null;
 return opsJSON({records:page.map(row=>{const p=JSON.parse(row.profile),b=row.billing?JSON.parse(row.billing):null;return {id:row.id,name:p.name||row.id,email:p.email||'',category:p.category||'',createdAt:row.created_at,status:row.billing_status,paymentVerified:b?.paymentVerified===true,paidActive:['active','ending'].includes(row.billing_status),visible:visible.has(row.id),adminHidden:p.adminHidden===true,publishConsent:p.publishConsent===true,trialUntil:date(b?.trialUntil),paidUntil:date(b?.paidUntil),syncedAt:date(b?.syncedAt),renewal:b?.stripeSubscriptionId?(b.cancelAtPeriodEnd?'Stops at period end':row.billing_status==='ended'?'Ended':'Automatic renewal configured'):'Not started'};}),cursor:result.results.length>25?page.at(-1).id:null,billingAvailable:businessBillingReady(env),note:'Saved billing status is updated by verified payment reconciliation and webhooks. Refresh reloads those saved records; it does not charge a card, extend a trial or grant publication. A paid subscription can be hidden by moderation, consent or address validity.'});
}
async function operationsAPI(request,env){
 const url=new URL(request.url),path=url.pathname;
 try{
 if(path==='/api/property/status'&&request.method==='GET'){let available=false;if(env.DB&&env.BUCKET){await env.DB.prepare('SELECT id FROM siege_records LIMIT 1').first();available=true}const profile=available?await estateAccount(env,opsUser(request)):null;return opsJSON({available,authenticated:!!opsUser(request),isAdmin:opsAdmin(request),registered:!!profile,profile:profile?.data||null,email:opsUser(request)?request.headers.get('oai-authenticated-user-email'):null,identity:'Sites sign-in'})}
 if(path==='/api/operations/readiness'&&request.method==='GET'){
  if(!opsAdmin(request))return opsJSON({error:'Administrator access required.'},403);
  const resources=[];if(env.BUCKET)for(const kind of ['homesteads','villages','parcels']){const o=await env.BUCKET.head('geocoding/'+kind+'.json');resources.push({kind,present:!!o,count:o?.customMetadata?.count||0})}
  return opsJSON({storage:!!(env.BUCKET&&env.DB),earthEngine:!!(env.GEE_PROJECT_ID&&env.GEE_SERVICE_ACCOUNT_JSON),email:reportMailReady(env),visa:reportCardReady(env),resources,propertyAPI:!!(env.BUCKET&&env.DB),expertAPI:!!(env.BUCKET&&env.DB),note:'Configuration checks only; confirm live delivery and scientific results separately.'});
 }
 if(path==='/api/property/location'&&request.method==='POST'){
  if(request.headers.get('Origin')!==url.origin)return opsJSON({error:'Origin not allowed.'},403);
  const point=await opsBody(request);
  return opsJSON(await estateGPSLocation(point));
 }
 if(!env.BUCKET||!env.DB)return opsJSON({error:'Website storage is unavailable.'},503);
 if(path.startsWith('/api/property/media/')&&request.method==='GET'){
  const [,id,photo]=path.match(/^\/api\/property\/media\/([a-f0-9-]{36})\/([a-f0-9-]{36})$/)||[];
  if(!id)return opsJSON({error:'Not found.'},404);
  const record=await opsRead(env,opsKey('property',id));
  if(!record?.data.photos?.includes(path)||(record.state!=='approved'&&record.owner!==opsUser(request)&&!opsAdmin(request)))return opsJSON({error:'Not found.'},404);
  const key='operations/property-photos/'+await reportSHA(record.owner)+'/'+id+'/'+photo,object=await env.BUCKET.get(key);
  if(!object)return opsJSON({error:'Not found.'},404);
  return new Response(object.body,{headers:{'Content-Type':'image/jpeg','X-Content-Type-Options':'nosniff','Cache-Control':'private, max-age=0, must-revalidate'}});
 }
 if(path.startsWith('/api/operations/media/')&&request.method==='GET'){
  const id=path.split('/').pop();if(!opsId(id))return opsJSON({error:'Not found.'},404);const object=await env.BUCKET.get('operations/media/'+id);if(!object)return opsJSON({error:'Not found.'},404);
  const meta=object.customMetadata,record=await opsRead(env,opsKey(meta.kind,meta.id));if(!record||(record.state!=='approved'&&record.owner!==opsUser(request)&&!opsAdmin(request)))return opsJSON({error:'Not found.'},404);
  return new Response(object.body,{headers:{'Content-Type':'image/jpeg','X-Content-Type-Options':'nosniff','Cache-Control':'private, max-age=0, must-revalidate'}});
 }
 if(path==='/api/experts/samples'){
  const settingId='00000000-0000-4000-8000-000000000004';
  const row=await env.DB.prepare("SELECT body_json FROM siege_records WHERE kind='expert_sample_settings' AND id=?").bind(settingId).first();
  const hidden=row?JSON.parse(row.body_json).data.hidden:[];
  if(request.method==='GET')return opsJSON({hidden,admin:opsAdmin(request)});
  if(request.method!=='POST'||!opsAdmin(request))return opsJSON({error:'Administrator access required.'},403);
  if(request.headers.get('Origin')!==url.origin)return opsJSON({error:'Origin not allowed.'},403);
  const b=await opsBody(request),allowed=['TAL-surveyors','TAL-bricklayers','TAL-electricians','TAL-environmental-engineering'];
  if(!allowed.includes(b.id))return opsJSON({error:'Unknown sample.'},400);
  await env.DB.prepare("INSERT INTO siege_records(id,kind,owner,state,created_at,body_json) VALUES(?,'expert_sample_settings',?,'active',?,json_object('data',json_object('hidden',json(?)))) ON CONFLICT(id) DO UPDATE SET body_json=json_set(body_json,'$.data.hidden',json(CASE WHEN EXISTS(SELECT 1 FROM json_each(body_json,'$.data.hidden') WHERE value=?) THEN json_extract(body_json,'$.data.hidden') ELSE json_insert(json_extract(body_json,'$.data.hidden'),'$[#]',?) END))").bind(settingId,opsUser(request),new Date().toISOString(),JSON.stringify([b.id]),b.id,b.id).run();
  const current=await env.DB.prepare("SELECT body_json FROM siege_records WHERE id=? AND kind='expert_sample_settings'").bind(settingId).first();
  return opsJSON({hidden:JSON.parse(current.body_json).data.hidden});
 }
 if((path==='/api/property/public'||path==='/api/experts/profiles')&&request.method==='GET'){
  const kind=path.includes('/property/')?'property':'experts',list=await opsList(env,kind,request,false,true);if(kind==='experts'){const ids=list.rows.map(p=>p.id);let stats=[];if(ids.length)stats=(await env.DB.prepare("SELECT json_extract(body_json, '$.data.expertId') AS expert_id, AVG(CAST(json_extract(body_json, '$.data.rating') AS REAL)) AS average, COUNT(*) AS count FROM siege_records WHERE kind = 'testimonials' AND state = 'approved' AND json_extract(body_json, '$.data.expertId') IN ("+ids.map(()=>'?').join(',')+") GROUP BY json_extract(body_json, '$.data.expertId')").bind(...ids).all()).results;list.rows=list.rows.map(p=>{const r=stats.find(r=>r.expert_id===p.id);return {...p,rating:r?Math.round(r.average*10)/10:null,reviewCount:r?Number(r.count):0}})}const hasProfiles=kind==='experts'?(list.rows.length>0||Boolean(await env.DB.prepare("SELECT 1 FROM siege_records WHERE kind='experts' AND state='approved' LIMIT 1").first())):undefined;return opsJSON({[kind==='property'?'properties':'profiles']:list.rows,cursor:list.cursor,hasProfiles});
 }
 if(path==='/api/operations/testimonials'&&request.method==='GET'){const list=await opsList(env,'testimonials',request,false,true);return opsJSON({testimonials:list.rows,cursor:list.cursor})}
 if(!opsUser(request))return opsJSON({error:'Sign in to save a submission.'},401);
 if(request.method==='POST'&&request.headers.get('Origin')!==url.origin)return opsJSON({error:'Origin not allowed.'},403);
 if(path==='/api/operations/testimonials'&&request.method==='POST'){
  const b=await opsBody(request);if(typeof b.service==='string')b.service=b.service.replace(/^SIEGE /,'SIEG ').replace(/^SIEG Address$/,'SIEG Address');if(b.consent!==true)throw Error('Consent to publish your testimonial is required.');
  const services=['SIEG Fields','SIEG Irrigate','SIEG Hydrology','SIEG Eco','SIEG Estate','SIEG Address','SIEG Learn','SIEG Experts','SIEG Business'];
  if(!services.includes(b.service))throw Error('Choose a SIEG service.');if(!Number.isInteger(b.rating)||b.rating<1||b.rating>5)throw Error('Choose a rating from 1 to 5.');
  const data={name:opsText(b.name,'name',100),email:opsEmail(b.email),service:b.service,rating:b.rating,quote:opsText(b.quote,'testimonial',1200),consent:true,photo:null},id=crypto.randomUUID(),created=[];
  if(b.expertId!==undefined){if(b.service!=='SIEG Experts'||!opsId(b.expertId))throw Error('Choose a published expert to review.');const expert=await opsRead(env,opsKey('experts',b.expertId));if(!expert||expert.state!=='approved')throw Error('This expert is not available for reviews.');if(expert.owner===opsUser(request))throw Error('You cannot review your own profile.');const duplicate=await env.DB.prepare("SELECT id FROM siege_records WHERE kind = 'testimonials' AND owner = ? AND state IN ('pending_review','approved') AND json_extract(body_json, '$.data.expertId') = ? LIMIT 1").bind(opsUser(request),b.expertId).first();if(duplicate)throw Error('You already have a review submitted for this expert.');data.expertId=b.expertId;data.expertName=expert.data.name;}
  await opsRate(request,env);
  try{if(b.photo)data.photo=await opsPhoto(env,b.photo,'testimonials',id,opsUser(request),created);await opsStore(env,'testimonials',{id,owner:opsUser(request),createdAt:new Date().toISOString(),state:'pending_review',data})}catch(e){for(const key of created)await env.BUCKET.delete(key);throw e}
  return opsJSON({id,message:'Thank you. Your testimonial has been submitted for review.'},201);
 }
 if(path==='/api/property/register'&&request.method==='POST'){
  const b=await opsBody(request);if(b.role==='Admin')return opsJSON({error:'Admin accounts are assigned by SIEG.'},403);
  if(b.consent!==true)throw Error('Accept the account and listing terms.');
  const name=opsText(b.name,'full name',100),phone=opsText(b.phone,'cellphone number',30);if(!/^\+[0-9 ()-]{6,25}$/.test(phone))throw Error('Include the country code in your cellphone number.');
  const hash=await reportSHA(opsUser(request)),id=hash.slice(0,8)+'-'+hash.slice(8,12)+'-'+hash.slice(12,16)+'-'+hash.slice(16,20)+'-'+hash.slice(20,32),existing=await estateAccount(env,opsUser(request));
  if(existing)return opsJSON({error:'Your account is already registered. Choose Client login.'},409);
  const record={id,owner:opsUser(request),state:'active',createdAt:new Date().toISOString(),data:{name,phone,email:request.headers.get('oai-authenticated-user-email')||'',consent:true}};
  await opsStore(env,'estate_accounts',record);return opsJSON({registered:true,profile:record.data},201);
 }
 if(path==='/api/property/login'&&request.method==='POST'){
  const body=await opsBody(request);if(!['Client','Admin'].includes(body.role))throw Error('Choose Client or Admin access.');if(body.role==='Admin'&&!opsAdmin(request))return opsJSON({error:'Administrator access required.'},403);
  if(body.role==='Admin'){if(typeof body.password!=='string')return opsJSON({error:'Enter your admin password.'},403);const check=await passwordAccess(new Request(request.url,{method:'POST',headers:request.headers,body:JSON.stringify({password:body.password,confirmation:body.confirmation})}),env);if(!check.ok)return check}
  const profile=await estateAccount(env,opsUser(request));if(body.role==='Client'&&!profile)return opsJSON({error:'Register your client account first.',registrationRequired:true},409);
  return opsJSON({role:body.role,authenticated:true,profile:profile?.data||null});
 }
 if(path==='/api/property/photo-upload'&&request.method==='POST'){
  const b=await opsBody(request);
  if(!opsId(b.batch)||typeof b.photo!=='string'||!/^data:image\/jpeg;base64,[A-Za-z0-9+/]+=*$/.test(b.photo)||b.photo.length>1600000)throw Error('The image could not be prepared. Try another photo.');
  if(await opsRead(env,opsKey('property',b.batch)))throw Error('This listing has already been submitted.');
  const bytes=Uint8Array.from(atob(b.photo.split(',')[1]),c=>c.charCodeAt(0));
  if(bytes[0]!==255||bytes[1]!==216||bytes[2]!==255)throw Error('Photo must contain a valid JPEG.');
  const id=crypto.randomUUID(),prefix='operations/property-photos/'+await reportSHA(opsUser(request))+'/'+b.batch+'/';
  await env.BUCKET.put(prefix+id,bytes,{httpMetadata:{contentType:'image/jpeg'}});
  return opsJSON({id},201);
 }
 if(path==='/api/property/photo-discard'&&request.method==='POST'){
  const {batch}=await opsBody(request);
  if(!opsId(batch)||await opsRead(env,opsKey('property',batch)))return opsJSON({error:'This upload cannot be discarded.'},400);
  const prefix='operations/property-photos/'+await reportSHA(opsUser(request))+'/'+batch+'/';
  let cursor;
  do{const list=await env.BUCKET.list({prefix,cursor});if(list.objects.length)await env.BUCKET.delete(list.objects.map(o=>o.key));cursor=list.truncated?list.cursor:undefined}while(cursor);
  return opsJSON({discarded:true});
 }
 if(path==='/api/property/report-areas'&&request.method==='GET'){
  const country=addressCountry(url.searchParams.get('country'));
  if(!country)throw Error('Choose a valid country.');
  return opsJSON({areas:await estateReportAreas(country)});
 }
 if(path==='/api/property/service-requests'&&request.method==='POST'){
  const b=await opsBody(request),offers={'location-report':['Property location report',450],'land-screening':['Land and farm screening report',1500],'assisted-listing':['Assisted listing',1000]};
  const offer=Object.hasOwn(offers,b.offer)?offers[b.offer]:null;
  if(!offer||b.consent!==true)throw Error('Choose a service and consent to SIEG follow-up.');
  const id=crypto.randomUUID(),data={title:offer[0],indicativePriceSZL:offer[1],name:opsText(b.name,'name',100),email:opsEmail(b.email),phone:opsText(b.phone||'','phone',40,true),location:opsText(b.location||'','property location',240,b.offer!=='assisted-listing'),listing:opsText(b.listing||'','listing reference',120,true),notes:opsText(b.notes||'','notes',1500,true)};
  if(b.offer!=='assisted-listing'){
   const country=addressCountry(b.countryCode),category=b.category;
   if(!country||!['Residential','Commercial','Land','Agricultural'].includes(category))throw Error('Choose a valid country and property category.');
   const area=b.admin2Id==='manual'?null:(await estateReportAreas(country)).find(x=>x.id===b.admin2Id);
   if(!area&&b.admin2Id!=='manual')throw Error('Choose an administrative area for the selected country.');
   if(!['sale','rental'].includes(b.transaction))throw Error('Choose Sale or Rental.');
   Object.assign(data,{transaction:b.transaction,offer:b.offer,country:country.name,countryCode:country.code,admin2:area?.name||opsText(b.admin2Manual,'administrative area',120),admin2Id:area?.id||null,admin2Source:area?'geoBoundaries ADM2':'Entered by requester',category});
   data.indicativePriceSZL=null;
  }else{
   if(b.countryCode!=='SZ'||b.eswatiniConfirmed!==true)throw Error('Assisted listing is available only for properties in Eswatini.');
   if(data.listing){
    const listing=opsId(data.listing)?await opsRead(env,opsKey('property',data.listing)):null;
    if(!listing||(listing.state!=='approved'&&listing.owner!==opsUser(request))||(listing.data.countryCode||'SZ')!=='SZ')throw Error('Select an eligible listing in Eswatini.');
   }
   Object.assign(data,{countryCode:'SZ',country:'Eswatini',eswatiniConfirmed:true});
  }
  await opsRate(request,env);
  await opsStore(env,'estate_requests',{id,owner:opsUser(request),createdAt:new Date().toISOString(),state:b.offer==='assisted-listing'?'new':'awaiting_checkout',data});
  return opsJSON({id,message:b.offer==='assisted-listing'?'Request received. SIEG will confirm the scope and send a manual invoice. No payment has been taken.':'Report request saved. Continue to payment.'},201);
 }
 if(path==='/api/property/listings'&&request.method==='GET'){const list=await opsList(env,'property',request);return opsJSON({listings:list.rows,cursor:list.cursor})}
 if(path==='/api/property/listings'&&request.method==='POST'){
  const body=await opsBody(request),p=body.property||{},id=body.batch;
  if(!opsId(id)||await opsRead(env,opsKey('property',id)))throw Error('This listing submission is invalid or has already been received.');
  const data={};for(const k of ['title','description'])data[k]=opsText(p[k],k,k==='description'?3000:100);
  if(!['Residential','Commercial','Land','Agricultural'].includes(p.type))throw Error('Choose a valid property type.');data.type=p.type;
  if(p.transaction!==undefined&&!['sale','rental'].includes(p.transaction))throw Error('Choose Sale or Rental.');data.transaction=p.transaction||'sale';
  for(const k of ['lat','lon','price','area'])if(typeof p[k]!=='number'||!Number.isFinite(p[k]))throw Error('Provide valid coordinates, value and land area.');
  if(Math.abs(p.lat)>90||Math.abs(p.lon)>180||p.price<0||p.price>1e12||p.area<=0||p.area>1e12)throw Error('Coordinates, property value or area are outside the accepted range.');
  Object.assign(data,{lat:p.lat,lon:p.lon,price:p.price,area:p.area,beds:!['Land','Agricultural'].includes(p.type)&&Number.isInteger(p.beds)&&p.beds>=0&&p.beds<=100?p.beds:null});
  if(p.boundary!==null&&p.boundary!==undefined){if(!Array.isArray(p.boundary)||p.boundary.length<3||p.boundary.length>1000||p.boundary.some(v=>!Array.isArray(v)||v.length!==2||!v.every(Number.isFinite)||Math.abs(v[0])>90||Math.abs(v[1])>180))throw Error('Use at least three valid boundary points.');const ring=p.boundary.map(v=>[v[1],v[0]]);ring.push(ring[0]);if(usageGeometry({type:'Polygon',coordinates:[ring]}).areaKm2>1+1e-6)throw Error('The maximum boundary area is 100 ha (1 km²).');data.boundary=p.boundary}else data.boundary=null;
  if(p.type==='Land'&&!data.boundary)throw Error('Land listings require a boundary with at least three GPS points.');
  const points=p.gpsPoints,fix=Array.isArray(points)?points[0]:null;
  if(!Array.isArray(points)||points.length!==(data.boundary?.length??1)||!points.every(estateGPS))throw Error('All points must be captured by phone GPS with reported accuracy of 10 m or better.');
  if(p.lat!==fix.lat||p.lon!==fix.lon||data.boundary?.some(([lat,lon],i)=>lat!==points[i].lat||lon!==points[i].lon))throw Error('The location and boundary must match the GPS points.');
  const location=await estateGPSLocation(fix);
  if(p.countryCode!==location.countryCode||p.currency!==location.currency||p.admin2!==location.admin2)throw Error('The detected location changed. Check it again before confirming the price.');
  Object.assign(data,location,{city:location.locality||location.admin2,locationMethod:'gps',gpsAccuracy:fix.accuracy});
  const photos=p.photoIds||[];
  if(!Array.isArray(photos)||photos.some(x=>!opsId(x))||new Set(photos).size!==photos.length)throw Error('The uploaded photo references are invalid.');
  if(photos.length){
   const prefix='operations/property-photos/'+await reportSHA(opsUser(request))+'/'+id+'/',uploaded=new Set();
   let cursor;
   do{const list=await env.BUCKET.list({prefix,cursor});for(const object of list.objects)uploaded.add(object.key.slice(prefix.length));cursor=list.truncated?list.cursor:undefined}while(cursor);
   if(photos.some(photo=>!uploaded.has(photo)))throw Error('Some photos are missing. Select them again before submitting.');
  }
  data.photos=photos.map(photo=>'/api/property/media/'+id+'/'+photo);
  data.reference=await estateReserveReference(env,data);
  const record={id,owner:opsUser(request),contactEmail:request.headers.get('oai-authenticated-user-email')||'',state:'pending_review',createdAt:new Date().toISOString(),data};
  await env.DB.prepare('INSERT INTO siege_records (id,kind,owner,state,created_at,body_json) VALUES (?,?,?,?,?,?)').bind(id,'property',record.owner,record.state,record.createdAt,JSON.stringify(record)).run();
  return opsJSON({property:opsPublic('property',record),message:'Saved to your account, awaiting SIEG review.'},201);
 }
 if(path==='/api/experts/availability')return await expertAvailabilityAPI(request,env);
 if(path==='/api/experts/applications'&&request.method==='POST'){
  const b=await opsBody(request);if(b.consent!==true)throw Error('Consent to storing and reviewing the profile is required.');
  const data={name:opsText(b.name,'name',100),email:opsEmail(b.email),...opsTrade(b,true),location:opsText(b.location,'location',100),experience:Number(b.experience),skills:opsText(b.skills,'skills',3000).split(/[,;\n]/).map(s=>s.trim()).filter(Boolean).slice(0,12),...expertAvailabilityData(request,b),photo:''};
  if(!Number.isInteger(data.experience)||data.experience<0||data.experience>80)throw Error('Enter years of experience between 0 and 80.');const id=crypto.randomUUID(),created=[];await opsRate(request,env);try{if(b.photo)data.photo=await opsPhoto(env,b.photo,'experts',id,opsUser(request),created);await opsStore(env,'experts',{id,owner:opsUser(request),createdAt:new Date().toISOString(),state:'pending_review',data});return opsJSON({id,message:'Application saved for SIEG review. It is not listed publicly until approved.'},201)}catch(e){for(const key of created)await env.BUCKET.delete(key);throw e}
 }
 if(path==='/api/experts/briefs'&&request.method==='POST'){
  const b=await opsBody(request);if(b.consent!==true)throw Error('Consent to storing your project brief is required.');
  const options={shortlist:['Specialist shortlist',149],quotes:['Managed quote comparison',449],business:['Business sourcing waitlist',null]},service=b.service||'';
  if(service&&!Object.hasOwn(options,service))throw Error('Choose a valid SIEG Experts service.');
  const data={name:opsText(b.name,'name',100),email:opsEmail(b.email),location:opsText(b.location||'','project location',200,service==='business'),start:opsText(b.start||'','start date',30,true),budget:opsText(b.budget||'','budget',100,true),requirements:opsText(b.requirements,'project requirements',3000),shortlist:Array.isArray(b.shortlist)?b.shortlist.filter(opsId).slice(0,30):[]};
  if(service){
   if(!['Hhohho','Lubombo','Manzini','Shiselweni'].includes(b.region))throw Error('Choose a region in Eswatini.');
   Object.assign(data,{country:'Eswatini',region:b.region});
   const [title,feeSZL]=options[service];
   Object.assign(data,{title,service,feeSZL,currency:'SZL'});
  }
  Object.assign(data,opsTrade(b,Boolean(service&&service!=='business')));
  const id=crypto.randomUUID();await opsRate(request,env);await opsStore(env,'briefs',{id,owner:opsUser(request),createdAt:new Date().toISOString(),state:'new',data});
  return opsJSON({id,message:service==='business'?'Interest registered. No subscription has started and no payment was taken.':service?'Request saved. SIEG will contact you to confirm the scope and timing. No payment was taken.':'Project brief saved for SIEG follow-up. This is not a confirmed booking.'},201);
 }
 if(path==='/api/operations/enquiries'&&request.method==='POST'){
  const b=await opsBody(request);if(b.consent!==true)throw Error('Consent to storing your enquiry is required.');const data={name:opsText(b.name,'name',100),email:opsEmail(b.email),product:opsText(b.product,'service',100),message:opsText(b.message,'message',3000)},id=crypto.randomUUID();await opsRate(request,env);await opsStore(env,'enquiries',{id,owner:opsUser(request),createdAt:new Date().toISOString(),state:'new',data});return opsJSON({id,message:'Enquiry saved for SIEG follow-up.'},201);
 }
 if(path==='/api/operations/admin'){
  if(!opsAdmin(request))return opsJSON({error:'Administrator access required.'},403);
  const kind=url.searchParams.get('kind');
  if(kind==='inbox'&&request.method==='GET')return await opsAdminInbox(env);
  if(kind==='business_subscriptions')return await opsBusinessSubscriptions(request,env,url);
  if(kind==='address')return await opsAddressReview(request,env,url);if(['business','graduates'].includes(kind))return await opsDirectoryReview(request,env,url,kind);
  if(!['property','experts','briefs','enquiries','estate_requests','testimonials'].includes(kind))throw Error('Unknown review queue.');
  if(request.method==='GET'){const list=await opsList(env,kind,request,true);return opsJSON({records:list.rows,cursor:list.cursor})}
  if(request.method==='POST'){
   const b=await opsBody(request);if(!opsId(b.id))throw Error('Invalid record.');const record=await opsRead(env,opsKey(kind,b.id));const product=kind==='enquiries'?url.searchParams.get('product'):null;if(!record||(product&&record.data?.product!==product))return opsJSON({error:'Record not found.'},404);
   const actions=['briefs','enquiries','estate_requests'].includes(kind)?['contacted','closed','delete',...(kind==='enquiries'&&record.data?.product==='SIEG Transit Bundle Access'?['approved','revoked']:[])]:['approved','rejected','delete'];if(!actions.includes(b.action))throw Error('Choose a valid review action.');
   if(b.action==='delete'){for(const photo of [...(record.data.photos||[]),record.data.photo].filter(Boolean))await env.BUCKET.delete(photo.startsWith('/api/property/media/')?'operations/property-photos/'+await reportSHA(record.owner)+'/'+record.id+'/'+photo.split('/').pop():'operations/media/'+photo.split('/').pop());await opsRemove(env,kind,record.id);return opsJSON({deleted:true})}
   if(kind==='enquiries'&&record.data?.product==='SIEG Transit Bundle Access'&&['approved','revoked'].includes(b.action))record.data.bundleAccessActive=b.action==='approved';record.state=b.action;record.reviewedAt=new Date().toISOString();await opsStore(env,kind,record);return opsJSON({id:record.id,state:record.state});
  }
 }
 return opsJSON({error:'Not found.'},404);
 }catch(error){return opsJSON({error:error.message||'Submission could not be saved.'},400)}
}
