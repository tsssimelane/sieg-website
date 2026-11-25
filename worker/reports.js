// Report fulfilment. No bank details or card credentials are sent to the browser.
const REPORT_PRICES={catchment:1499,wetlands:2499,fields:2100,eco:1800,hydrology:2700,estate:900,address:1200};
const REPORT_NAMES={wetlands:'SIEG Wetland Mapping',catchment:'SIEG Catchment Delineation',irrigation:'SIEG Irrigate',fields:'SIEG Fields',eco:'SIEG Eco',hydrology:'SIEG Hydrology',estate:'SIEG Estate',address:'SIEG Address'};
const REPORT_MAX_BYTES=20*1024*1024;
const reportJSON=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
const reportOwner=r=>r.headers.get('oai-authenticated-user-id');
const reportAdmin=r=>!!reportOwner(r)&&r.headers.get('oai-authenticated-user-email')?.toLowerCase()==='tss.simelane@gmail.com';
const reportKey=id=>'reports/orders/'+id+'.json';
async function reportRead(env,key){const o=await env.BUCKET.get(key);return o?JSON.parse(await o.text()):null}
async function reportSave(env,order){await env.BUCKET.put(reportKey(order.id),JSON.stringify(order))}
function reportFee(env,service){if(service==='irrigation'&&env.REPORT_PRICE_IRRIGATION===undefined)return reportFee(env,'fields');const value=Number(env['REPORT_PRICE_'+service.toUpperCase()]??REPORT_PRICES[service]);if(!Number.isSafeInteger(value)||value<100||value>100000000)throw Error('Report price is unavailable.');return value}
const reportMailReady=env=>!!(env.RESEND_API_KEY&&env.REPORT_FROM_EMAIL);
const reportCardReady=env=>reportMailReady(env)&&env.REPORT_CHECKOUT_ENABLED==='true'&&!!env.PAYGATE_ID&&!!env.PAYGATE_KEY;
async function reportSHA(value){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))),v=>v.toString(16).padStart(2,'0')).join('')}
function reportEqual(a,b){if(typeof a!=='string'||typeof b!=='string'||a.length!==b.length)return false;let d=0;for(let i=0;i<a.length;i++)d|=a.charCodeAt(i)^b.charCodeAt(i);return d===0}
// PayWeb3 requires MD5 for its protocol checksum (not for passwords/tokens).
function reportMD5(text){
 const bytes=new TextEncoder().encode(text),n=Math.ceil((bytes.length+9)/64)*64,b=new Uint8Array(n);b.set(bytes);b[bytes.length]=128;
 const view=new DataView(b.buffer);view.setUint32(n-8,(bytes.length*8)>>>0,true);view.setUint32(n-4,Math.floor(bytes.length/536870912),true);
 const shift=[7,12,17,22,5,9,14,20,4,11,16,23,6,10,15,21],k=Array.from({length:64},(_,i)=>(Math.abs(Math.sin(i+1))*4294967296)>>>0);
 let h=[0x67452301,0xefcdab89,0x98badcfe,0x10325476];
 for(let off=0;off<n;off+=64){let[a,bv,cv,d]=h;for(let i=0;i<64;i++){let f,g;if(i<16){f=(bv&cv)|(~bv&d);g=i}else if(i<32){f=(d&bv)|(~d&cv);g=(5*i+1)%16}else if(i<48){f=bv^cv^d;g=(3*i+5)%16}else{f=cv^(bv|~d);g=7*i%16}const t=(a+f+k[i]+view.getUint32(off+4*g,true))|0,s=shift[Math.floor(i/16)*4+i%4];a=d;d=cv;cv=bv;bv=(bv+((t<<s)|(t>>>(32-s))))|0}h=h.map((v,i)=>(v+[a,bv,cv,d][i])|0)}
 return h.map(v=>[0,8,16,24].map(s=>((v>>>s)&255).toString(16).padStart(2,'0')).join('')).join('');
}
function reportChecksum(fields,key){return reportMD5(Object.entries(fields).filter(([k])=>k!=='CHECKSUM').map(([,v])=>v).join('')+key)}
async function reportGateway(env,endpoint,fields){
 const body={...fields,CHECKSUM:reportChecksum(fields,env.PAYGATE_KEY)};
 const r=await fetch('https://secure.paygate.co.za/payweb3/'+endpoint+'.trans',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams(body),signal:AbortSignal.timeout(20000)});
 if(!r.ok)throw Error('Payment provider unavailable. Please try again later.');
 const params=new URLSearchParams(await r.text()),data=Object.fromEntries(params);
 if([...params.keys()].length!==Object.keys(data).length||!reportEqual((data.CHECKSUM||'').toLowerCase(),reportChecksum(data,env.PAYGATE_KEY)))throw Error('Payment provider response could not be verified.');return data;
}
function reportBase64(text){const bytes=new TextEncoder().encode(text);let result='';for(let i=0;i<bytes.length;i+=8192)result+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(result)}
async function reportEmail(env,order,kind,to,subject,text,files=[]){
 if(!reportMailReady(env))return false;
 if(files.some(file=>file.type==='text/html'))throw Error('Open the completed report in SIEG to prepare its PDF, then retry delivery. No additional payment is required.');
 const r=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+env.RESEND_API_KEY,'Content-Type':'application/json','Idempotency-Key':'siege-report/'+order.id+'/'+kind+(files.some(file=>file.type==='application/pdf')?'/pdf-v1':'')},body:JSON.stringify({from:env.REPORT_FROM_EMAIL,to:[to],reply_to:'support@sieg.ltd',subject,text,attachments:files.map(f=>({filename:f.filename,content:f.encoding==='base64'?f.content:reportBase64(f.content)}))}),signal:AbortSignal.timeout(25000)});
 if(!r.ok)throw Error('Email delivery is pending. Your request has been saved; please retry with the same reference.');return true;
}
function reportDocumentValid(file){
 if(file?.type==='application/pdf')return /\.pdf$/i.test(file.filename||'')&&file.encoding==='base64'&&String(file.content||'').startsWith('JVBERi0');
 if(file?.type!=='text/html'||!/\.html?$/i.test(file.filename||'')||!['utf8','base64'].includes(file.encoding))return false;
 let html;try{html=file.encoding==='base64'?new TextDecoder().decode(Uint8Array.from(atob(file.content),c=>c.charCodeAt(0))):file.content}catch{return false}
 if(typeof html!=='string'||!/^\s*(?:<!doctype html|<html)/i.test(html))return false;
 const passive=html.replace(/ onclick="window\.print\(\)"/g,'');
 return !/<\s*(?:script|iframe|object|embed|base|form)\b|\bon[a-z]+\s*=|(?:javascript|vbscript)\s*:|<meta[^>]+http-equiv/i.test(passive);
}
async function reportFiles(env,order){const p=await reportRead(env,'reports/files/'+order.id+'.json');if(!p)throw Error('Report files are unavailable. Contact support@sieg.ltd with your reference.');if(order.kind!=='download'&&p.files.some(f=>!reportDocumentValid(f)))throw Error('This report must be regenerated in the current HTML format.');return p.files}
async function reportCollect(env,order){
 if(order.officeEmailSent)return;
 if(order.estateScope)await estateGenerateReport(env,order);
 const sent=await reportEmail(env,order,'collection-office','support@sieg.ltd',(order.kind==='download'?'DIGITAL FILES FOR COLLECTION | ':'PRINT FOR COLLECTION | ')+order.id,
  REPORT_NAMES[order.service]+'\nReference: '+order.id+'\nClient: '+order.contact.name+'\nEmail: '+order.contact.email+'\nCellphone: '+order.contact.dial+' '+order.contact.phone+'\nCash due: '+order.currency+' '+(order.amount/100).toFixed(2)+(order.kind==='download'?'\n\nPrepare the attached digital ZIP for collection at SIEG, Mzimnene complex, Manzini. Collect cash before releasing files to the client. Do not print the ZIP.':'\n\nPrint the attached report for collection at SIEG, Mzimnene complex, Manzini. Mark ready only after printing; collect cash on collection. Browser-generated analysis: review limitations before printing.'),await reportFiles(env,order));
 if(sent){order.officeEmailSent=true;await reportSave(env,order)}
}
async function reportReadyDelivery(env,order){
 if(order.state!=='ready_for_collection'||order.readyEmailSent)return;
 const sent=await reportEmail(env,order,'collection-ready',order.contact.email,'Ready for collection | '+order.id,'Hello '+order.contact.name+',\nYour '+REPORT_NAMES[order.service]+(order.kind==='download'?' digital files are ready for collection at SIEG, Mzimnene complex, Manzini.\nPay cash before collecting files: ':' report is ready for collection at SIEG, Mzimnene complex, Manzini.\nPay cash on collection: ')+order.currency+' '+(order.amount/100).toFixed(2)+'\nReference: '+order.id+'\nsupport@sieg.ltd');
 if(sent){order.readyEmailSent=true;await reportSave(env,order)}
}
async function reportPaidDelivery(env,order){
 if(order.analysisPurchaseId){await hydroGrant(env,order);if(!order.filesReady)return;}
 if(order.kind==='address_business'){await addressBusinessReceipt(env,order);return;}
 if(order.kind==='address_capture'){await addressGrantPaid(env,order);return;}
 if(order.state==='paid'&&typeof usageGrantForReport==='function')await usageGrantForReport(env,order);
 if(order.state!=='paid'||order.clientEmailSent)return;
 if(order.estateScope)await estateGenerateReport(env,order);
 const sent=await reportEmail(env,order,'paid-client',order.contact.email,REPORT_NAMES[order.service]+(order.kind==='download'?' | Your files | ':' | Your report | ')+order.id,
  'Hello '+order.contact.name+',\n\nYour payment has been verified. Your '+REPORT_NAMES[order.service]+(order.kind==='download'?' download is attached.\nReference: ':' report is attached.\nReference: ')+order.id+'\nAmount: '+order.currency+' '+(order.amount/100).toFixed(2)+'\n\nPlease read the source notes and limitations.\nSIEG | Beyond the Vision\nsupport@sieg.ltd',await reportFiles(env,order));
 if(sent){order.clientEmailSent=true;order.deliveredAt=new Date().toISOString();await reportSave(env,order);/* Completed reports remain available to their authenticated owner. */}
}
async function reportVerifyPayment(env,order){
 if(order.method!=='card'||!order.paymentRequestId)return;
 const data=await reportGateway(env,'query',{PAYGATE_ID:env.PAYGATE_ID,PAY_REQUEST_ID:order.paymentRequestId,REFERENCE:order.id});
 if(data.PAYGATE_ID!==env.PAYGATE_ID||data.PAY_REQUEST_ID!==order.paymentRequestId||data.REFERENCE!==order.id||data.CURRENCY!==order.currency||String(data.AMOUNT)!==String(order.amount))throw Error('Payment does not match this report order.');
 if(data.TRANSACTION_STATUS==='1'){order.state='paid';order.paymentTransactionId=data.TRANSACTION_ID;await reportSave(env,order);if(typeof usageGrantForReport==='function')await usageGrantForReport(env,order);await reportPaidDelivery(env,order)}
 else if(order.state!=='paid'&&['2','3','4'].includes(data.TRANSACTION_STATUS)){order.state=data.TRANSACTION_STATUS==='3'?'cancelled':'payment_failed';await reportSave(env,order)}
}
function reportPublic(order){return {id:order.id,...(order.kind==='address_business'?{kind:order.kind,entryId:order.entryId,baseAmount:order.baseAmount,baseCurrency:order.baseCurrency,...(addressBusinessReference(order)?{businessPrintReference:addressBusinessReference(order)}:{})}:{}),...(order.analysisPurchaseId?{analysisPurchaseId:order.analysisPurchaseId,analysisService:order.analysisService||'hydrology',task:order.task,year:order.year,filesReady:!!order.filesReady,recovery:order.recovery}:{}),service:order.service,method:order.method,state:order.state,amount:order.amount,currency:order.currency,...(order.kind==='address_capture'?{kind:order.kind,quantity:order.quantity,creditsActivated:!!order.creditsActivated}:{}),...(order.estateScope?{estateReport:true}:{}),officeEmailSent:!!order.officeEmailSent,clientEmailSent:!!order.clientEmailSent}}
function reportValidate(body){
 if(!REPORT_NAMES[body.service]||!['collection','card'].includes(body.method))throw Error('Choose a report and delivery option.');
 const contact=body.contact;if(!contact||typeof contact!=='object')throw Error('Contact details are required.');
 for(const k of ['name','email','phone','dial'])if(typeof contact[k]!=='string'||!contact[k].trim()||contact[k].length>200||/[\r\n]/.test(contact[k]))throw Error('Invalid '+k+'.');
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email)||!/^\+[0-9]{1,4}$/.test(contact.dial)||!/^[0-9 ()-]{5,20}$/.test(contact.phone)||!['on',true].includes(contact.consent))throw Error('Provide valid contact details and consent.');
 if(!/^[a-zA-Z0-9-]{16,80}$/.test(body.requestId||''))throw Error('Invalid request reference.');
 if(['catchment','wetlands'].includes(body.service)&&(body.kind!=='download'||!Array.isArray(body.files)||body.files.length!==1||body.files.some(f=>!(body.service==='catchment'?/^SIEG_Catchment_Delineation\.zip$/i:/^SIEG_Wetland_Mapping\.zip$/i).test(f.filename||'')||f.encoding!=='base64')))throw Error('Mapping downloads require one ZIP package.');
 if(!body.estateRequestId&&(!Array.isArray(body.files)||!body.files.length||body.files.length>5))throw Error('The analysed report or download is required.');
 if(body.kind!=='download'&&(body.files||[]).some(f=>f.type!=='application/pdf'||!reportDocumentValid(f)))throw Error('Reports must be valid PDF files.');
 let total=0;for(const f of body.files||[]){if(!/^[A-Za-z0-9_.-]{1,100}\.(html?|pdf|csv|geojson|tif|zip)$/i.test(f.filename||'')||typeof f.content!=='string'||!['utf8','base64'].includes(f.encoding))throw Error('Invalid report file.');if(f.encoding==='base64'&&!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(f.content))throw Error('Invalid file encoding.');total+=f.encoding==='base64'?f.content.length*3/4:new TextEncoder().encode(f.content).length}if((!body.estateRequestId&&total<1)||total>REPORT_MAX_BYTES)throw Error('Report package must be smaller than 20 MB.');
 return {name:contact.name.trim(),email:contact.email.trim(),phone:contact.phone.trim(),dial:contact.dial,country:String(contact.country||'').slice(0,100),selectedAnalyses:String(contact.selectedAnalyses||'').replace(/[\r\n]/g,' ').slice(0,1000)};
}
async function reportsAPI(request,env){
 const url=new URL(request.url),path=url.pathname;
 try{
 if(path.startsWith('/api/reports/references'))return await reportReferencesAPI(request,env);
 if(path==='/api/reports/completed'&&request.method==='GET'){const owner=reportOwner(request);if(!owner)return reportJSON({error:'Sign in first.'},401);const job=await usageJob(env,url.searchParams.get('analysis'));if(!job||job.owner!==owner||!job.paymentOrder)return reportJSON({error:'No completed report available.'},404);const order=await hydroRequirePaid(env,job);if(!order.filesReady)return reportJSON({error:'Report preparation has not finished.'},404);return reportJSON({files:await reportFiles(env,order),id:order.id});}
 if(path==='/api/reports/config'&&request.method==='GET')return reportJSON({prices:Object.fromEntries(Object.keys(REPORT_NAMES).map(s=>[s,reportFee(env,s)])),currency:env.PAYGATE_CURRENCY||'USD',profile:typeof loginPriceProfile==='function'?loginPriceProfile(request):null,collectionEnabled:!!env.BUCKET,emailEnabled:reportMailReady(env),cardEnabled:reportCardReady(env)});
 if(!env.BUCKET)return reportJSON({error:'Report storage is unavailable.'},503);
 // Gateway callback is independently verified; public hosting or an authenticated relay is required.
 if(path==='/api/reports/paygate/notify'&&request.method==='POST'){
  if(!reportCardReady(env)&&!(typeof addressCheckoutReady==='function'&&addressCheckoutReady(env)))return reportJSON({error:'Payment is not configured.'},503);
  const raw=await request.text();if(raw.length>12000)return reportJSON({error:'Invalid notification.'},400);
  const p=new URLSearchParams(raw),data=Object.fromEntries(p);if([...p.keys()].length!==Object.keys(data).length||!reportEqual((data.CHECKSUM||'').toLowerCase(),reportChecksum(data,env.PAYGATE_KEY)))return reportJSON({error:'Invalid notification.'},403);
  if(!/^SIEG(?:E)?-[a-f0-9-]{36}$/.test(data.REFERENCE||''))return reportJSON({error:'Unknown reference.'},404);
  const order=await reportRead(env,reportKey(data.REFERENCE));if(!order||order.paymentRequestId!==data.PAY_REQUEST_ID)return reportJSON({error:'Unknown payment.'},404);
  await reportVerifyPayment(env,order);return new Response('OK',{headers:{'Content-Type':'text/plain'}});
 }
 if(!reportOwner(request))return reportJSON({error:'Sign in to request a report.'},401);
 if(request.method==='POST'&&request.headers.get('Origin')!==url.origin)return reportJSON({error:'Origin not allowed.'},403);
 if(['/api/reports/hydrology-recovery','/api/reports/analysis-recovery'].includes(path)&&request.method==='POST')return await hydroRecovery(request,env,await request.json());
 if(path==='/api/reports/orders'&&request.method==='POST'){
  if(Number(request.headers.get('Content-Length'))>29*1024*1024)return reportJSON({error:'Report package is too large.'},413);
  const text=await request.text();if(new TextEncoder().encode(text).length>29*1024*1024)return reportJSON({error:'Report package is too large.'},413);
  const body=JSON.parse(text),owner=reportOwner(request);
  if(['catchment','wetlands'].includes(body.service))return reportJSON({error:'This tool is now available only in the admin SIEG Toolbox, without payment.'},403);
  if(body.analysisPurchaseId)return await hydroCheckout(request,env,body);
  if(['fields','eco','hydrology','catchment','wetlands'].includes(body.service))return await hydroFulfil(request,env,body);
  let estateScope=null;
  if(body.estateRequestId){
   if(body.service!=='estate'||!['card','collection'].includes(body.method)||!opsId(body.estateRequestId))return reportJSON({error:'Choose an Estate report and payment option.'},400);
   const record=await opsRead(env,opsKey('estate_requests',body.estateRequestId));
   if(!record||record.owner!==owner||!['location-report','land-screening'].includes(record.data.offer))return reportJSON({error:'Estate report request not found.'},404);
   estateScope=record.data;body.files=[];
   body.contact={...body.contact,name:estateScope.name,email:estateScope.email};
   body.requestId=body.estateRequestId;
  }
  if(['catchment','wetlands'].includes(body.service)&&body.method!=='card')return reportJSON({error:'Shapefiles are emailed after verified online payment. Choose pay online.'},400);
  const contact=reportValidate(body),id='SIEG-'+await reportSHA(owner+':'+body.requestId).then(h=>h.slice(0,8)+'-'+h.slice(8,12)+'-'+h.slice(12,16)+'-'+h.slice(16,20)+'-'+h.slice(20,32));
  let analysis=null;if(['fields','eco','hydrology','irrigation'].includes(body.service)){analysis=await usageJob(env,body.analysisId);if(!analysis||analysis.owner!==owner||analysis.service!==body.service||analysis.state!=='running'||(![2,3].includes(analysis.policyVersion)&&analysis.method!==body.method))return reportJSON({error:'Use the authorised analysis request to receive this report.'},403);}let order=await reportRead(env,reportKey(id));
  if(!order){
   if(estateScope&&!await estateReportRows(env,estateScope,true))return reportJSON({error:'No approved listings match this request. No payment was started. Try a different area, category or listing type.'},422);
   if(body.expectedAmount!==reportFee(env,body.service))return reportJSON({error:'The report price has changed. Close this window and request a new quote.'},409);
   if(body.method==='card'&&!(analysis?.paymentVerified)&&!reportCardReady(env))return reportJSON({error:'Visa payment is not available yet. Choose collection or contact support@sieg.ltd.'},503);
   // Atomic per-user time slots bound submission volume; request IDs make retries stable.
   const slot='reports/limits/'+await reportSHA(owner)+'/'+Math.floor(Date.now()/3600000)+'/'+Math.floor(Date.now()/5000);
   if(!await env.BUCKET.put(slot,'1',{onlyIf:{etagDoesNotMatch:'*'}}))return reportJSON({error:'Please wait a few seconds before submitting another request.'},429);
   order={id,owner,service:body.service,kind:body.kind==='download'?'download':'report',method:body.method,contact,amount:reportFee(env,body.service),currency:env.PAYGATE_CURRENCY||'USD',state:body.method==='collection'?'awaiting_print':'awaiting_payment',createdAt:new Date().toISOString()};
   if(analysis){order.analysisId=analysis.id;order.amount=body.service==='irrigation'?reportFee(env,'irrigation'):analysis.amount;order.reportGeneratedAt=new Date().toISOString();if(analysis.paymentVerified)order.state='paid';}if(estateScope)order.estateScope=estateScope;else await env.BUCKET.put('reports/files/'+id+'.json',JSON.stringify({files:body.files}));await reportSave(env,order);
  }
  if(order.owner!==owner||order.method!==body.method||order.service!==body.service)return reportJSON({error:'Start a new request for a different delivery option.'},409);
  if(order.method==='collection'){await reportCollect(env,order);return reportJSON({...reportPublic(order),message:order.kind==='download'?(order.officeEmailSent?'Digital files sent to SIEG. Pay cash before collecting the files. SIEG will confirm availability.':'Digital collection request saved. Email is pending configuration; contact support@sieg.ltd with your reference. Files have not been released.'):(order.officeEmailSent?'Report sent to SIEG for printing. Pay cash when collecting. SIEG will confirm when it is ready.':'Request saved in the SIEG print queue. Email delivery is pending configuration; contact support@sieg.ltd with your reference. Printing has not been confirmed.')})}
  if(order.state==='paid'){await reportPaidDelivery(env,order);return reportJSON(reportPublic(order))}
  if(order.paymentRequestId&&order.state==='awaiting_payment'&&order.paymentChecksum)return reportJSON({...reportPublic(order),checkout:{url:'https://secure.paygate.co.za/payweb3/process.trans',fields:{PAY_REQUEST_ID:order.paymentRequestId,CHECKSUM:order.paymentChecksum}}});
  if(order.paymentRequestId)return reportJSON({error:'A checkout already exists. Return to that payment window or check your report reference before starting another payment.',...reportPublic(order)},409);
  const fields={PAYGATE_ID:env.PAYGATE_ID,REFERENCE:order.id,AMOUNT:String(order.amount),CURRENCY:order.currency,RETURN_URL:url.origin+'/report-payment.html?order='+order.id,TRANSACTION_DATE:new Date().toISOString().replace('T',' ').slice(0,19),LOCALE:'en-za',COUNTRY:'SWZ',EMAIL:contact.email,PAY_METHOD:'CC',PAY_METHOD_DETAIL:'Visa',NOTIFY_URL:url.origin+'/api/reports/paygate/notify'};
  const result=await reportGateway(env,'initiate',fields);if(result.PAYGATE_ID!==env.PAYGATE_ID||result.REFERENCE!==order.id||!result.PAY_REQUEST_ID)throw Error('Checkout could not be created. No payment has been confirmed.');order.paymentRequestId=result.PAY_REQUEST_ID;order.paymentChecksum=result.CHECKSUM;await reportSave(env,order);
  return reportJSON({...reportPublic(order),checkout:{url:'https://secure.paygate.co.za/payweb3/process.trans',fields:{PAY_REQUEST_ID:result.PAY_REQUEST_ID,CHECKSUM:result.CHECKSUM}}});
 }
 if(path==='/api/reports/estate-download'&&request.method==='GET'){
  const id=url.searchParams.get('order');
  if(!/^SIEG-[a-f0-9-]{36}$/.test(id||''))return reportJSON({error:'Invalid reference.'},400);
  const order=await reportRead(env,reportKey(id));
  if(!order?.estateScope||order.owner!==reportOwner(request)||order.state!=='paid')return reportJSON({error:'Paid Estate report not found.'},404);
  await estateGenerateReport(env,order);
  const [file]=await reportFiles(env,order);
  return new Response(file.encoding==='base64'?Uint8Array.from(atob(file.content),c=>c.charCodeAt(0)):file.content,{headers:{'Content-Type':'application/pdf','Content-Disposition':'attachment; filename="SIEG_Estate_Report.pdf"','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
 }
 if(path==='/api/reports/status'&&request.method==='POST'){
  const body=await request.json();if(!/^SIEG(?:E)?-[a-f0-9-]{36}$/.test(body.id||''))return reportJSON({error:'Invalid reference.'},400);
  const order=await reportRead(env,reportKey(body.id));if(!order||order.owner!==reportOwner(request))return reportJSON({error:'Report order not found.'},404);
  if(order.method==='card'){try{if(order.state==='paid')await reportPaidDelivery(env,order);else await reportVerifyPayment(env,order)}catch(e){if(!order.estateScope||order.state!=='paid')throw e}}else{await reportCollect(env,order);if(typeof usageGrantForReport==='function')await usageGrantForReport(env,order)}return reportJSON(reportPublic(order));
 }
 if(path==='/api/reports/admin-download'&&request.method==='POST'){
  if(!reportAdmin(request))return reportJSON({error:'Sign in with the SIEG admin account.'},403);
  if(!await usageIsUnrestricted(request,env))return reportJSON({error:'User-restricted mode is active. Switch to Admin—no restrictions for admin exports.'},403);
  if(request.headers.get('Origin')!==url.origin)return reportJSON({error:'Origin not allowed.'},403);
  if(!await readRecord(env,'geocoding/admin/password.json'))return reportJSON({error:'Set your admin password in Resources first.'},409);
  return passwordAccess(request,env);
 }
 if(path.startsWith('/api/reports/admin')){
  if(!reportAdmin(request))return reportJSON({error:'SIEG staff access required.'},403);
  if(request.method==='GET'){
   if(url.searchParams.has('id')){const order=await reportRead(env,reportKey(url.searchParams.get('id')));if(!order)return reportJSON({error:'Not found.'},404);return reportJSON({order,files:['address_capture','address_business'].includes(order.kind)||order.analysisPurchaseId&&!order.filesReady||order.clientEmailSent||order.estateScope&&order.method==='card'&&order.state!=='paid'?[]:(order.estateScope?(await reportRead(env,'reports/files/'+order.id+'.json'))?.files||[]:await reportFiles(env,order))})}
   const list=await env.BUCKET.list({prefix:'reports/orders/',limit:100,cursor:url.searchParams.get('cursor')||undefined}),orders=[];for(const o of list.objects)orders.push(await reportRead(env,o.key));return reportJSON({orders:orders.sort((a,b)=>b.createdAt.localeCompare(a.createdAt)),cursor:list.truncated?list.cursor:null});
  }
  if(request.method==='POST'){
   const {id,action}=await request.json();if(!/^SIEG(?:E)?-[a-f0-9-]{36}$/.test(id||''))return reportJSON({error:'Invalid reference.'},400);const order=await reportRead(env,reportKey(id));if(!order)return reportJSON({error:'Not found.'},404);
   if(action==='delete'&&(order.analysisPurchaseId||order.kind==='address_business'))return reportJSON({error:'Keep this paid analysis receipt so the customer can reopen results and retry without paying again.'},409);
   if(action==='delete'&&(order.state==='collected_cash_paid'||order.state==='paid'&&order.clientEmailSent)){await env.BUCKET.delete('reports/files/'+id+'.json');await env.BUCKET.delete(reportKey(id));return reportJSON({deleted:true})}
   if(action==='retry'){if(order.method==='collection'){await reportCollect(env,order);await reportReadyDelivery(env,order)}else await reportVerifyPayment(env,order)}
   else if(action==='ready'&&order.method==='collection'&&order.state==='awaiting_print'){order.state='ready_for_collection';await reportSave(env,order);await reportReadyDelivery(env,order)}
   else if(action==='collected'&&order.state==='ready_for_collection'){order.state='collected_cash_paid';await reportSave(env,order);if(typeof usageGrantForReport==='function')await usageGrantForReport(env,order)}else return reportJSON({error:'Action not available for this order.'},400);
   return reportJSON(reportPublic(order));
  }
 }
 return reportJSON({error:'Not found.'},404);
 }catch(error){return reportJSON({error:error.message||'Report request failed. No payment has been confirmed.'},400)}
}

// Reference records retain only metadata and GeoJSON; PDF bytes are never archived here.
async function reportDigest(value){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))),b=>b.toString(16).padStart(2,'0')).join('')}
function reportBoundary(value){
 if(value==null)return null;
 if(JSON.stringify(value).length>2000000)throw Error('Boundary is too large.');
 const geometry=value.type==='Feature'?value.geometry:value;
 if(!['Polygon','MultiPolygon','FeatureCollection'].includes(geometry?.type))throw Error('A polygon boundary is required.');
 if(geometry.type==='FeatureCollection'){if(!Array.isArray(geometry.features)||geometry.features.length>1000)throw Error('Invalid boundary.');geometry.features.forEach(f=>reportBoundary(f));return geometry;}
 const rings=geometry.type==='Polygon'?geometry.coordinates:geometry.coordinates?.flat();
 if(!Array.isArray(rings)||!rings.length||rings.some(r=>!Array.isArray(r)||r.length<4||r.some(p=>!Array.isArray(p)||!Number.isFinite(p[0])||!Number.isFinite(p[1])||Math.abs(p[0])>180||Math.abs(p[1])>90)))throw Error('Invalid boundary coordinates.');
 return geometry;
}
async function reportReferenceReserve(env,data){
 const signature=await reportDigest(JSON.stringify([data.owner,data.service,data.analysisId||'',data.signature,data.geometry||null,data.scope||null]));
 const reference='SIEG-RPT-'+signature.slice(0,32).toUpperCase();
 const key='reports/references/'+reference+'.json';let record=await reportRead(env,key);
 if(!record){record={...data,reference,createdAt:new Date().toISOString(),state:'reserved'};await env.BUCKET.put(key,JSON.stringify(record),{onlyIf:{etagDoesNotMatch:'*'}});record=await reportRead(env,key);}
 if(record.signature!==data.signature||record.owner!==data.owner)throw Error('Report reference conflict. Retry report preparation.');return record;
}
async function reportReferenceComplete(env,record){
 record={...record,state:'ready',completedAt:record.completedAt||new Date().toISOString()};
 await env.BUCKET.put('reports/references/'+record.reference+'.json',JSON.stringify(record));return record;
}
async function reportReferencesAPI(request,env){
 if(!env.BUCKET)return reportJSON({error:'Report archive is unavailable.'},503);
 const owner=reportOwner(request),url=new URL(request.url);if(!owner)return reportJSON({error:'Sign in first.'},401);
 if(request.method==='POST'&&request.headers.get('Origin')!==url.origin)return reportJSON({error:'Origin not allowed.'},403);
 if(request.method==='GET'){
  const reference=(url.searchParams.get('reference')||'').trim().toUpperCase();
  if(!/^SIEG-RPT-[A-F0-9]{32}$/.test(reference))return reportJSON({error:'Enter a valid report reference.'},400);
  const record=await reportRead(env,'reports/references/'+reference+'.json');
  if(!record||record.owner!==owner&&!reportAdmin(request))return reportJSON({error:'Report reference not found.'},404);

  const {signature,owner:recordOwner,...visible}=record;return reportJSON(visible);
 }
 if(request.method!=='POST')return reportJSON({error:'Method not allowed.'},405);
 if(Number(request.headers.get('Content-Length'))>56*1024*1024)return reportJSON({error:'Report too large.'},413);
 const raw=await request.text();if(raw.length>56*1024*1024)return reportJSON({error:'Report too large.'},413);const b=JSON.parse(raw);
 if(url.pathname.endsWith('/reserve')){
  let service=b.service,geometry=reportBoundary(b.geometry),year=b.year;
  if(!REPORT_NAMES[service])return reportJSON({error:'Unknown report service.'},400);
  if(!/^[a-f0-9]{64}$/.test(b.signature||''))return reportJSON({error:'Invalid report signature.'},400);
  if(b.analysisId){const job=await usageJob(env,b.analysisId);if(!job||job.owner!==owner)return reportJSON({error:'Analysis not found.'},404);
   if(job.adminBypass){if(!reportAdmin(request))return reportJSON({error:'Admin report access required.'},403);}else if(['fields','eco','hydrology','irrigation'].includes(job.service))await hydroRequirePaid(env,job);
   service=job.service;geometry=reportBoundary(job.geometry);year=job.year;
  }
  const record=await reportReferenceReserve(env,{owner,service,geometry,year,analysisId:b.analysisId||null,signature:b.signature});

  return reportJSON({reference:record.reference});
 }
 if(url.pathname.endsWith('/complete')){
  if(!/^SIEG-RPT-[A-F0-9]{32}$/.test(b.reference||''))return reportJSON({error:'Invalid report reference.'},400);
  const record=await reportRead(env,'reports/references/'+b.reference+'.json');if(!record||record.owner!==owner)return reportJSON({error:'Report reference not found.'},404);
  await reportReferenceComplete(env,record);return reportJSON({reference:record.reference});
 }
 return reportJSON({error:'Report action not found.'},404);
}
