const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),{webcrypto}=require('node:crypto'),{DatabaseSync}=require('node:sqlite');
const sqlite=new DatabaseSync(':memory:');sqlite.exec(fs.readFileSync('drizzle/0000_siege_operations.sql','utf8'));
const DB={prepare(sql){const stmt=sqlite.prepare(sql);let args=[];return {bind(...v){args=v;return this},async first(){return stmt.get(...args)||null},async all(){return {results:stmt.all(...args)}},async run(){return stmt.run(...args)}}}};
class Bucket{constructor(){this.items=new Map()}async put(k,v,o={}){if(o.onlyIf&&this.items.has(k))return null;this.items.set(k,{value:v,metadata:o.customMetadata||{}});return {etag:'x'}}async get(k){const o=this.items.get(k);return o?{body:o.value,text:async()=>typeof o.value==='string'?o.value:new TextDecoder().decode(o.value),customMetadata:o.metadata}:null}async head(k){const o=this.items.get(k);return o?{customMetadata:o.metadata}:null}async delete(k){this.items.delete(k)}}
const env={DB,BUCKET:new Bucket()},ctx=vm.createContext({Request,Response,URL,URLSearchParams,TextEncoder,TextDecoder,Uint8Array,DataView,ArrayBuffer,AbortSignal,crypto:webcrypto,btoa,atob,console});vm.runInContext(fs.readFileSync('worker/reports.js','utf8')+'\n'+fs.readFileSync('worker/operations.js','utf8'),ctx);const api=vm.runInContext('operationsAPI',ctx);
const alice={'oai-authenticated-user-id':'alice','oai-authenticated-user-email':'alice@example.com'},bob={'oai-authenticated-user-id':'bob','oai-authenticated-user-email':'bob@example.com'},admin={'oai-authenticated-user-id':'owner','oai-authenticated-user-email':'tss.simelane@gmail.com'};
async function call(path,body,headers=alice){const r=await api(new Request('https://siege.test'+path,{method:body?'POST':'GET',headers:{...headers,...(body?{Origin:'https://siege.test','Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined}),env);return {status:r.status,data:await r.json()}}
function unlock(){for(const key of env.BUCKET.items.keys())if(key.startsWith('operations/rate/'))env.BUCKET.items.delete(key)}
const jpeg='data:image/jpeg;base64,'+btoa(String.fromCharCode(255,216,255,224,0,0));
const property={title:'Test land',city:'Manzini',region:'Manzini',description:'User supplied test listing',type:'Land',lat:-26.5,lon:31.4,area:1000,price:200000,photos:[jpeg],boundary:[[-26.5,31.4],[-26.501,31.4],[-26.501,31.401]],entryRole:'Admin',state:'approved'};
(async()=>{
 const input={name:'Sample Client',email:'private@example.com',service:'SIEGE Eco',rating:5,quote:'A helpful assessment.',consent:true,photo:jpeg,state:'approved'};
 assert.equal((await call('/api/operations/testimonials',input,{})).status,401);
 assert.equal((await call('/api/operations/testimonials',{...input,consent:false})).status,400);
 assert.equal((await call('/api/operations/testimonials',{...input,rating:6})).status,400);
 const submitted=await call('/api/operations/testimonials',input);assert.equal(submitted.status,201);const id=submitted.data.id;
 assert.equal((await call('/api/operations/testimonials',null,{})).data.testimonials.length,0);
 assert.equal((await call('/api/operations/admin?kind=testimonials',null,bob)).status,403);
 let queue=await call('/api/operations/admin?kind=testimonials',null,admin);assert.equal(queue.data.records[0].state,'pending_review');const photoURL=queue.data.records[0].data.photo;
 assert.equal((await api(new Request('https://siege.test'+photoURL),env)).status,404);
 assert.equal((await call('/api/operations/admin?kind=testimonials',{id,action:'approved'},bob)).status,403);
 await call('/api/operations/admin?kind=testimonials',{id,action:'approved'},admin);
 const published=await call('/api/operations/testimonials',null,{});assert.equal(published.data.testimonials.length,1);assert.equal(published.data.testimonials[0].service,'SIEG Eco');assert(!JSON.stringify(published.data).includes('private@example.com'));assert(!('owner' in published.data.testimonials[0]));
 assert.equal((await api(new Request('https://siege.test'+photoURL),env)).status,200);
 await call('/api/operations/admin?kind=testimonials',{id,action:'rejected'},admin);assert.equal((await call('/api/operations/testimonials',null,{})).data.testimonials.length,0);
 await call('/api/operations/admin?kind=testimonials',{id,action:'delete'},admin);assert.equal((await api(new Request('https://siege.test'+photoURL),env)).status,404);
 console.log('PASS: testimonial consent, validation, authentication, pending privacy, admin approval, public email redaction, protected photo, unpublish and deletion.');
})().catch(e=>{console.error(e);process.exit(1)});
