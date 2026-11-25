const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),{DatabaseSync}=require('node:sqlite');
const db=new DatabaseSync(':memory:');db.exec(fs.readFileSync('drizzle/0000_siege_operations.sql','utf8').replaceAll('--> statement-breakpoint',''));
const DB={prepare(sql){let args=[];return {bind(...a){args=a;return this},async first(){return db.prepare(sql).get(...args)||null},async all(){return {results:db.prepare(sql).all(...args)}},async run(){const r=db.prepare(sql).run(...args);return {meta:{changes:Number(r.changes)}}}}}};
class Bucket{constructor(){this.items=new Map}async get(k){const t=this.items.get(k);return t===undefined?null:{text:async()=>t}}async put(k,v){this.items.set(k,String(v));return {etag:'e'}}async delete(k){this.items.delete(k)}}
const env={DB,BUCKET:new Bucket},ctx=vm.createContext({crypto,Date,console,Request,Response,URL,URLSearchParams,TextEncoder,Uint8Array,DataView,AbortSignal,atob,btoa});
vm.runInContext(['worker/hydrology-commerce.js','worker/usage.js','worker/reports.js'].map(p=>fs.readFileSync(p,'utf8')).join('\n')+'\nglobalThis.api=usageAPI;globalThis.permit=usagePermit;globalThis.job=usageJob;',ctx);
const admin={'oai-authenticated-user-id':'admin','oai-authenticated-user-email':'tss.simelane@gmail.com'},user={'oai-authenticated-user-id':'user','oai-authenticated-user-email':'user@example.com'};
async function call(path,b,who){const r=await ctx.api(new Request('https://siege.test/api/analysis/'+path,{method:'POST',headers:{...who,Origin:'https://siege.test','Content-Type':'application/json'},body:JSON.stringify(b)}),env);return {status:r.status,data:await r.json()}}
const geometry={type:'Polygon',coordinates:[[[31,-26],[32,-26],[32,-25],[31,-25],[31,-26]]]},body={expression:{result:'0',values:{'0':{functionInvocationValue:{functionName:'Image.constant',arguments:{value:{constantValue:1}}}}}}};
(async()=>{
 await call('admin-mode',{mode:'restricted'},admin);
 for(const task of ['catchment-delineation','wetland-mapping']){
  assert.equal((await call('admin-tool',{task,geometry,year:2026},user)).status,403);
  assert.equal((await call('orders',{task,service:'hydrology',geometry,year:2026},user)).status,403);
  assert.equal((await call('free-trial',{task,service:'hydrology',geometry,year:2026},user)).status,403);
  const result=await call('admin-tool',{task,geometry,year:2026},admin);assert.equal(result.status,200,JSON.stringify(result));assert(result.data.areaKm2>5);assert.equal(result.data.amount,0);assert.equal(result.data.state,'running');assert.equal(result.data.adminTool,true);
  const j=await ctx.job(env,result.data.id);assert(j&&j.adminTool,'Admin tool job is durably saved');
  const url='https://siege.test/api/earth-engine/v1/projects/test/maps?analysis='+j.id;
  assert.equal((await ctx.permit(new Request(url,{headers:admin}),env,body,'maps')).adminUnrestricted,true,'Tool bypasses payment and limits even in user-test mode');
  await assert.rejects(ctx.permit(new Request(url,{headers:user}),env,body,'maps'),/authorisation/);
  const impersonator={...user,'oai-authenticated-user-id':'admin'};await assert.rejects(ctx.permit(new Request(url,{headers:impersonator}),env,body,'maps'),/Toolbox/);
 }
 assert.equal((await call('admin-tool',{task:'farm-water-assessment',geometry,year:2026},admin)).status,400,'Tool endpoint cannot unlock other services');
 const catalog=JSON.stringify(JSON.parse(fs.readFileSync('assets/map-subitems.json','utf8')));assert(!catalog.includes('Catchment delineation'));assert(!catalog.includes('Wetland mapping'));
 console.log('Admin Toolbox: role enforcement, durable jobs, no payment/area cap, restricted-mode independence, public routes blocked, catalog removed.');
})().catch(e=>{console.error(e);process.exitCode=1});
