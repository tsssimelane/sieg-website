const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),{DatabaseSync}=require('node:sqlite');
const db=new DatabaseSync(':memory:');db.exec(fs.readFileSync('drizzle/0000_siege_operations.sql','utf8').replaceAll('--> statement-breakpoint',''));
const DB={prepare(sql){let args=[];return {bind(...a){args=a;return this},async first(){return db.prepare(sql).get(...args)||null},async all(){return {results:db.prepare(sql).all(...args)}},async run(){const r=db.prepare(sql).run(...args);return {meta:{changes:Number(r.changes)}}}}}};
class Bucket{constructor(){this.items=new Map}async get(k){const t=this.items.get(k);return t===undefined?null:{text:async()=>t,body:t}}async put(k,v,o={}){if(o.onlyIf?.etagDoesNotMatch==='*'&&this.items.has(k))return null;this.items.set(k,String(v));return {etag:'etag'}}async delete(k){this.items.delete(k)}}
const env={DB,BUCKET:new Bucket};let now=Date.now();class TestDate extends Date{static now(){return now}}
const ctx=vm.createContext({crypto,Date:TestDate,console,Request,Response,URL,URLSearchParams,TextEncoder,Uint8Array,DataView,AbortSignal,atob,btoa});vm.runInContext(fs.readFileSync('worker/hydrology-commerce.js','utf8')+'\n'+fs.readFileSync('worker/usage.js','utf8')+'\n'+fs.readFileSync('worker/reports.js','utf8')+'\nglobalThis.api=usageAPI;globalThis.permit=usagePermit;globalThis.job=usageJob;',ctx);
const owner={'oai-authenticated-user-id':'u1','oai-authenticated-user-email':'user@example.com'},admin={'oai-authenticated-user-id':'admin','oai-authenticated-user-email':'tss.simelane@gmail.com'};
let currentOwner=owner;
async function call(path,b,who=currentOwner){const r=await ctx.api(new Request('https://siege.test/api/analysis/'+path,{method:b?'POST':'GET',headers:{...who,Origin:'https://siege.test','Content-Type':'application/json'},body:b?JSON.stringify(b):undefined}),env);return {status:r.status,data:await r.json()}}
const polygon=(size=.01)=>({type:'Polygon',coordinates:[[[31,-26],[31+size,-26],[31+size,-26+size],[31,-26+size],[31,-26]]]});
const order=(service='fields',size=.01)=>({service,...(['hydrology','fields','eco'].includes(service)?{year:2026}:{}),geometry:polygon(size),requestId:crypto.randomUUID(),method:'collection',contact:{name:'Client',email:'client@example.com',phone:'+26876000000',consent:true}});
(async()=>{
 const tasks={fields:'soil-properties',irrigation:'irrigation-design',hydrology:'farm-water-assessment',eco:'land-classification'};
 const small=polygon(.0015),large=polygon(.003);
 const mapBody=n=>({expression:{result:'0',values:{'0':{functionInvocationValue:{functionName:'Image.constant',arguments:{value:{constantValue:n}}}}}}});
 for(const service of Object.keys(tasks)){
  currentOwner={...owner,'oai-authenticated-user-id':'pilot-'+service};
  assert.equal((await call('free-trial',{service,geometry:large,year:2026})).status,400,'Oversized '+service+' trial rejected');
  const first=await call('free-trial',{service,geometry:small,year:2026,task:tasks[service]});assert.equal(first.status,200,JSON.stringify(first.data));assert.equal(first.data.freeTrial,true);assert(first.data.areaKm2<=.05);
  const id=first.data.id;assert.equal((await call('start',{id})).status,200);
  assert.equal((await call('free-trial',{service,geometry:polygon(.0006),year:2026})).status,400,'Cannot replace the claimed boundary');
  assert.equal((await call('free-trial',{service,geometry:small,year:2026})).data.id,id,'Same boundary resumes allowance');
  const req=new Request('https://siege.test/api/earth-engine/v1/projects/test/maps?analysis='+id,{headers:currentOwner});
  const attempts=await Promise.allSettled([1,2,3,4].map(n=>ctx.permit(req,env,mapBody(n),'maps')));assert.equal(attempts.filter(v=>v.status==='fulfilled').length,3,'Concurrent fourth map rejected');
  assert.equal((await ctx.job(env,id)).freeMapHashes.length,3);
  await call('start',{id});assert.equal((await ctx.job(env,id)).freeMapHashes.length,3,'Restart cannot reset map quota');
  const admitted=attempts.findIndex(v=>v.status==='fulfilled')+1;assert((await ctx.permit(req,env,mapBody(admitted),'maps')).cached,'Identical map retry does not consume another slot');
  await assert.rejects(ctx.permit(req,env,mapBody(5),'maps'),/three free maps/);
  await assert.rejects(ctx.permit(req,env,mapBody(1),'tables'),/map viewing only/);
  await assert.rejects(ctx.permit(new Request(req.url,{headers:{'oai-authenticated-user-id':'other'}}),env,mapBody(1),'maps'),/authorisation/);
 }
 const racingOwner={...owner,'oai-authenticated-user-id':'pilot-race'};const race=await Promise.all(['fields','eco'].map(service=>call('free-trial',{service,geometry:small,year:2026},racingOwner)));assert.equal(race.filter(r=>r.status===200).length,1,'Concurrent product claims allow one winner');
 currentOwner={...owner,'oai-authenticated-user-id':'pilot-fields'};
 assert.equal((await call('free-trial',{service:'eco',geometry:small,year:2026})).status,400,'One chosen product per account');
 const old=await call('free-suitability',{geometry:small});assert.equal(old.data.freeTrial,true);assert.equal(old.data.id,(await call('free-trial',{service:'fields',geometry:small,year:2026})).data.id,'Legacy button shares allowance');
 const limits=(await call('config')).data;assert.equal(limits.limits.hydrology,5);assert.equal(limits.limits.fields,.5);assert.equal(limits.freeTrial.maps,3);assert.equal(limits.freeTrial.oneServicePerAccount,true);
 for(const service of ['fields','eco','irrigation']){assert.equal((await call('orders',{...order(service,.007),year:2026})).status,400,'Over 50 ha rejected: '+service);assert.equal((await call('orders',{...order(service,.006),year:2026})).status,200,'Below 50 ha permitted: '+service);}
 assert.equal((await call('orders',{...order('hydrology',.02),year:2026})).status,200,'Below 500 ha permitted');assert.equal((await call('orders',{...order('hydrology',.022),year:2026})).status,400,'Over 500 ha rejected');
 const paid=await call('orders',{...order('fields',.001),task:'soil-properties'});assert.equal(paid.data.state,'awaiting_payment');assert.equal((await call('start',{id:paid.data.id})).status,400,'Paid access still requires verified payment');
 console.log('Pilot checks passed: 4 services, 5 ha cap, owner binding, one AOI, concurrent 3-map cap, retry, no reset, legacy sharing, paid gate.');
})().catch(e=>{console.error(e);process.exitCode=1});
