const assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),{webcrypto,createHash}=require('node:crypto');
class Bucket{
 constructor(){this.items=new Map()}
 async get(k){if(!this.items.has(k))return null;const text=this.items.get(k);return {text:async()=>text}}
 async put(k,v,o={}){if(o.onlyIf?.etagDoesNotMatch==='*'&&this.items.has(k))return null;this.items.set(k,String(v));return {etag:'test'}}
 async delete(k){this.items.delete(k)}
 async list(o){return {objects:[...this.items.keys()].filter(k=>k.startsWith(o.prefix)).map(key=>({key})),truncated:false}}
}
const sent=[],gatewayCalls=[];let paymentStatus='1',wrongAmount=false,mailFail=false;
const ctx=vm.createContext({console,Request,Response,URL,URLSearchParams,TextEncoder,Uint8Array,DataView,ArrayBuffer,AbortSignal,crypto:webcrypto,btoa,atob,setTimeout,clearTimeout});
ctx.fetch=async(url,opts)=>{
 if(url==='https://api.resend.com/emails'){if(mailFail)return new Response('{}',{status:503});const key=opts.headers['Idempotency-Key'];if(!sent.some(v=>v.key===key))sent.push({key,...JSON.parse(opts.body)});return Response.json({id:'mail'})}
 gatewayCalls.push(url);const fields=Object.fromEntries(new URLSearchParams(opts.body));assert.equal(fields.CHECKSUM,sign(fields));let data;
 if(url.endsWith('/initiate.trans'))data={PAYGATE_ID:'merchant',PAY_REQUEST_ID:'payment-'+fields.REFERENCE,REFERENCE:fields.REFERENCE};
 else data={PAYGATE_ID:'merchant',PAY_REQUEST_ID:fields.PAY_REQUEST_ID,REFERENCE:fields.REFERENCE,TRANSACTION_STATUS:paymentStatus,RESULT_CODE:'990017',AUTH_CODE:'test',CURRENCY:'USD',AMOUNT:wrongAmount?'1':String(JSON.parse(env.BUCKET.items.get('reports/orders/'+fields.REFERENCE+'.json')).amount),RESULT_DESC:'test',TRANSACTION_ID:'txn-1',PAY_METHOD:'CC',PAY_METHOD_DETAIL:'Visa'};
 return new Response(new URLSearchParams({...data,CHECKSUM:sign(data)}));
};
vm.runInContext(fs.readFileSync('worker/hydrology-commerce.js','utf8')+'\n'+fs.readFileSync('worker/reports.js','utf8'),ctx);const api=vm.runInContext('reportsAPI',ctx),md5=vm.runInContext('reportMD5',ctx);
function sign(d){return createHash('md5').update(Object.entries(d).filter(([k])=>k!=='CHECKSUM').map(([,v])=>v).join('')+'secret').digest('hex')}
const env={BUCKET:new Bucket(),REPORT_PRICE_ESTATE:1800,REPORT_PRICE_ADDRESS:2700},user={'oai-authenticated-user-id':'owner','oai-authenticated-user-email':'tss.simelane@gmail.com'};
function req(path,body,headers=user){return new Request('https://siege.test/api/reports/'+path,{method:body?'POST':'GET',headers:{...headers,...(body?{Origin:'https://siege.test','Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined})}
const payload=(service='estate',method='collection',requestId=webcrypto.randomUUID())=>({requestId,service,method,expectedAmount:{estate:1800,address:2700}[service],contact:{name:'Sample Client',email:'client@example.com',dial:'+268',phone:'76000000',consent:'on'},files:[{filename:'SIEG_Report.html',type:'text/html',encoding:'utf8',content:'<!doctype html><html><body>Analysed AOI only.</body></html>'}]});
async function call(path,body,headers){const r=await api(req(path,body,headers),env);return {status:r.status,data:await r.json()}}
(async()=>{
 for(const s of ['', 'abc', 'PayGate 你好', 'x'.repeat(400)])assert.equal(md5(s),createHash('md5').update(s).digest('hex'));
 let r=await call('config');assert.equal(r.data.prices.address,2700);assert.equal(r.data.cardEnabled,false);assert.equal(r.data.currency,'USD');assert.equal(r.data.prices.catchment,1499);assert.equal(r.data.prices.wetlands,2499);
 assert.equal((await call('orders',payload(),{})).status,401);
 const bad=payload();bad.expectedAmount=1;assert.equal((await call('orders',bad)).status,409);
 const p=payload();r=await call('orders',p);assert.equal(r.status,200);assert.equal(r.data.state,'awaiting_print');assert.equal(r.data.officeEmailSent,false);assert.match(r.data.message,/not been confirmed/);const collectionId=r.data.id;
 r=await call('orders',p);assert.equal(r.data.id,collectionId);assert.equal((await env.BUCKET.list({prefix:'reports/orders/'})).objects.length,1);
 assert.equal((await call('orders',payload('address','card'))).status,503);
 env.RESEND_API_KEY='test';env.REPORT_FROM_EMAIL='reports@example.com';env.PAYGATE_ID='merchant';env.PAYGATE_KEY='secret';env.REPORT_CHECKOUT_ENABLED='true';
 r=await call('status',{id:collectionId});assert.equal(r.data.officeEmailSent,true);assert.equal(sent.length,1);assert.deepEqual(sent[0].to,['support@sieg.ltd']);assert.match(sent[0].text,/Cash due: USD 18.00/);assert(!JSON.stringify(sent).includes('281264'));
 await call('status',{id:collectionId});assert.equal(sent.length,1);
 assert.equal((await call('admin',null,{'oai-authenticated-user-id':'other','oai-authenticated-user-email':'other@example.com'})).status,403);
 await call('admin',{id:collectionId,action:'ready'});assert.equal(sent.length,2);assert(!sent[1].attachments.length);await call('admin',{id:collectionId,action:'collected'});
 for(const key of [...env.BUCKET.items.keys()])if(key.startsWith('reports/limits/'))env.BUCKET.items.delete(key);
 const card=payload('address','card');r=await call('orders',card);assert.equal(r.status,200);assert.equal(r.data.checkout.url,'https://secure.paygate.co.za/payweb3/process.trans');const id=r.data.id;assert(!JSON.stringify(r.data).includes('secret'));assert.equal(sent.length,2);
 assert.equal((await call('status',{id},{'oai-authenticated-user-id':'other'})).status,404);
 wrongAmount=true;r=await call('status',{id});assert.equal(r.status,400);assert.equal(sent.length,2);wrongAmount=false;
 paymentStatus='2';r=await call('status',{id});assert.equal(r.data.state,'payment_failed');assert.equal(sent.length,2);
 paymentStatus='1';mailFail=true;r=await call('status',{id});assert.equal(r.status,400);assert.equal(sent.length,2);const stored=await env.BUCKET.get('reports/orders/'+id+'.json');assert.equal(JSON.parse(await stored.text()).state,'paid');
 mailFail=false;r=await call('status',{id});assert.equal(r.data.state,'paid');assert.equal(r.data.clientEmailSent,true);assert.equal(sent.length,3);assert.deepEqual(sent[2].to,['client@example.com']);assert.equal(sent[2].attachments.length,1);assert.equal(await env.BUCKET.get('reports/files/'+id+'.json'),null);
 await call('status',{id});assert.equal(sent.length,3);
 r=await call('paygate/notify',{REFERENCE:id,CHECKSUM:'fake'});assert.equal(r.status,403);assert.equal(sent.length,3);
 const order=JSON.parse(await (await env.BUCKET.get('reports/orders/'+id+'.json')).text()),notify={PAYGATE_ID:'merchant',PAY_REQUEST_ID:order.paymentRequestId,REFERENCE:id};notify.CHECKSUM=sign(notify);const nr=await api(new Request('https://siege.test/api/reports/paygate/notify',{method:'POST',body:new URLSearchParams(notify)}),env);assert.equal(nr.status,200);assert.equal(await nr.text(),'OK');assert.equal(sent.length,3);
 // Prevent obsolete direct-download and bank-transfer controls from returning.
 for(const [folder,button]of [['agri','requestReport'],['enviro','requestEnvironmentalReport'],['hydrology','requestHydrologyReport']]){const js=fs.readFileSync(folder+'/assets/report.js','utf8'),html=fs.readFileSync(folder+'/index.html','utf8');assert(js.includes('SiegeDelivery.open')||js.includes('SiegeDelivery.deliverPaid'));assert(js.includes(button));assert(!js.includes('281264'));assert(html.includes('report-delivery.js'))}
 assert(fs.readFileSync('geocoding/access.js','utf8').includes("api('purchase'"));assert(fs.readFileSync('hydrology/assets/adapter.js','utf8').includes('requestHydrologyReport'));assert(fs.readFileSync('assets/report-delivery.js','utf8').includes('not per hectare'));const css=fs.readFileSync('assets/report-delivery.css','utf8');assert(css.includes('grid-template-columns:18px minmax(0,1fr)'));assert(css.includes('input[type=checkbox]'));assert(css.includes('max-width:18px'));assert(css.includes('.rd-phone input[type=tel]'));
 // Irrigate adopts the same delivery flow, including older free-analysis records.
 ctx.usageJob=async(_env,id)=>id==='irrigation-analysis'?{id,owner:'owner',service:'irrigation',state:'running',policyVersion:3,amount:0}:null;
 for(const key of [...env.BUCKET.items.keys()])if(key.startsWith('reports/limits/'))env.BUCKET.items.delete(key);
 const irrigation={...payload(),service:'irrigation',analysisId:'irrigation-analysis',expectedAmount:2100};
 r=await call('orders',irrigation);assert.equal(r.status,200);assert.equal(r.data.amount,2100);assert.equal(r.data.state,'awaiting_print');assert.deepEqual(sent.at(-1).to,['support@sieg.ltd']);assert.match(sent.at(-1).text,/Irrigate/);
 assert.equal((await call('orders',{...irrigation,analysisId:'unknown'})).status,403);
 // Catchment ZIP uses the existing paid delivery flow without opening raw remote-sensing exports.
 for(const key of [...env.BUCKET.items.keys()])if(key.startsWith('reports/limits/'))env.BUCKET.items.delete(key);
 const catchment={...payload(),service:'catchment',kind:'download',expectedAmount:1499,files:[{filename:'SIEG_Catchment_Delineation.zip',type:'application/zip',encoding:'base64',content:'UEsDBA=='}]};
 assert.equal((await call('orders',{...catchment,kind:'report'})).status,404);
 assert.equal((await call('orders',catchment)).status,404);
 for(const key of [...env.BUCKET.items.keys()])if(key.startsWith('reports/limits/'))env.BUCKET.items.delete(key);
 assert.equal((await call('orders',{...catchment,method:'card'})).status,404,'Preparing files before a paid analysis is rejected');
 console.log('PASS: prices, authentication, quoted fee, cash queue, retries, staff collection, MD5 vectors, secure checkout, signed payment verification, mismatched amount, declined payment, email failure recovery, no duplicate delivery, file deletion and all export entry points.');
})().catch(e=>{console.error(e);process.exitCode=1});
