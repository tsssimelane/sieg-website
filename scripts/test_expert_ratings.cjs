const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),{webcrypto}=require('node:crypto'),{DatabaseSync}=require('node:sqlite');
const sqlite=new DatabaseSync(':memory:');sqlite.exec(fs.readFileSync('drizzle/0000_siege_operations.sql','utf8'));
const DB={prepare(sql){const stmt=sqlite.prepare(sql);let args=[];return {bind(...v){args=v;return this},async first(){return stmt.get(...args)||null},async all(){return {results:stmt.all(...args)}},async run(){return stmt.run(...args)}}}};
class Bucket{constructor(){this.items=new Map()}async put(k,v,o={}){if(o.onlyIf&&this.items.has(k))return null;this.items.set(k,{value:v,metadata:o.customMetadata||{}});return {etag:'x'}}async get(k){const o=this.items.get(k);return o?{body:o.value,text:async()=>typeof o.value==='string'?o.value:new TextDecoder().decode(o.value),customMetadata:o.metadata}:null}async head(k){const o=this.items.get(k);return o?{customMetadata:o.metadata}:null}async delete(k){this.items.delete(k)}}
const env={DB,BUCKET:new Bucket()},ctx=vm.createContext({Request,Response,URL,URLSearchParams,TextEncoder,TextDecoder,Uint8Array,DataView,ArrayBuffer,AbortSignal,crypto:webcrypto,btoa,atob,console,estateJSON:()=>JSON.parse(fs.readFileSync("assets/expert-trades.json","utf8"))});vm.runInContext(fs.readFileSync('worker/reports.js','utf8')+'\n'+fs.readFileSync('worker/expert-availability.js','utf8')+'\n'+fs.readFileSync('worker/operations.js','utf8'),ctx);const api=vm.runInContext('operationsAPI',ctx);
const alice={'oai-authenticated-user-id':'alice','oai-authenticated-user-email':'alice@example.com'},bob={'oai-authenticated-user-id':'bob','oai-authenticated-user-email':'bob@example.com'},admin={'oai-authenticated-user-id':'owner','oai-authenticated-user-email':'tss.simelane@gmail.com'};
async function call(path,body,headers=alice){const r=await api(new Request('https://siege.test'+path,{method:body?'POST':'GET',headers:{...headers,...(body?{Origin:'https://siege.test','Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined}),env);return {status:r.status,data:await r.json()}}
function unlock(){for(const key of env.BUCKET.items.keys())if(key.startsWith('operations/rate/'))env.BUCKET.items.delete(key)}
const jpeg='data:image/jpeg;base64,'+btoa(String.fromCharCode(255,216,255,224,0,0));
const property={title:'Test land',city:'Manzini',region:'Manzini',description:'User supplied test listing',type:'Land',lat:-26.5,lon:31.4,area:1000,price:200000,photos:[jpeg],boundary:[[-26.5,31.4],[-26.501,31.4],[-26.501,31.401]],entryRole:'Admin',state:'approved'};
(async()=>{
 const expert=await call('/api/experts/applications',{name:'Test Expert',email:'expert@example.com',trade:'Surveyors',location:'Manzini',experience:5,skills:'Surveying',availability:'Available now',availabilityReminders:false,consent:true},bob);assert.equal(expert.status,201);const expertId=expert.data.id;
 await call('/api/operations/admin?kind=experts',{id:expertId,action:'approved'},admin);
 let profile=(await call('/api/experts/profiles',null,{})).data.profiles[0];assert.equal(profile.rating,null);assert.equal(profile.reviewCount,0);
 const review={expertId,name:'Client',email:'private@example.com',service:'SIEG Experts',rating:5,quote:'Accurate work and clear communication.',consent:true};
 assert.equal((await call('/api/operations/testimonials',review,{})).status,401);
 assert.equal((await call('/api/operations/testimonials',review,bob)).status,400);
 const first=await call('/api/operations/testimonials',review,alice);assert.equal(first.status,201);
 assert.equal((await call('/api/operations/testimonials',review,alice)).status,400);
 assert.equal((await call('/api/experts/profiles',null,{})).data.profiles[0].reviewCount,0);
 await call('/api/operations/admin?kind=testimonials',{id:first.data.id,action:'approved'},admin);
 const second=await call('/api/operations/testimonials',{...review,rating:4},{'oai-authenticated-user-id':'second-client'});assert.equal(second.status,201);
 await call('/api/operations/admin?kind=testimonials',{id:second.data.id,action:'approved'},admin);
 profile=(await call('/api/experts/profiles',null,{})).data.profiles[0];assert.equal(profile.rating,4.5);assert.equal(profile.reviewCount,2);assert(!JSON.stringify(profile).includes('private@example.com'));
 await call('/api/operations/admin?kind=testimonials',{id:first.data.id,action:'rejected'},admin);profile=(await call('/api/experts/profiles',null,{})).data.profiles[0];assert.equal(profile.rating,4);assert.equal(profile.reviewCount,1);
 console.log('PASS: unrated state, real averages, approved-only counts, pending moderation, self-review/duplicate rejection, authentication, privacy and unpublish recalculation.');
})().catch(e=>{console.error(e);process.exit(1)});
