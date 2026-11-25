const fs=require('fs'),vm=require('vm'),assert=require('assert/strict'),crypto=require('crypto').webcrypto;
const DB=require('./address_test_db.cjs')(),env={DB},countries=JSON.parse(fs.readFileSync('assets/countries-global.json','utf8'));
const c=vm.createContext({crypto,Date,JSON,Number,Error,estateJSON:()=>countries,Request,Response,URL});vm.runInContext(fs.readFileSync('worker/operations.js','utf8'),c);
(async()=>{
 const sz={countryCode:'SZ',type:'Residential'};
 assert.equal(await c.estateReserveReference(env,sz),'SZL-RS-001');
 assert.equal(await c.estateReserveReference(env,sz),'SZL-RS-002');
 assert.equal(await c.estateReserveReference(env,{...sz,type:'Land'}),'SZL-LD-001');
 assert.equal(await c.estateReserveReference(env,{...sz,type:'Commercial'}),'SZL-CM-001');
 assert.equal(await c.estateReserveReference(env,{...sz,type:'Agricultural'}),'SZL-AG-001');
 assert.equal(await c.estateReserveReference(env,{...sz,countryCode:'TW'}),'TWN-RS-001');
 const concurrent=await Promise.all(Array.from({length:12},()=>c.estateReserveReference(env,sz)));assert.equal(new Set(concurrent).size,12);
 const id=crypto.randomUUID(),record={id,owner:'owner',state:'approved',createdAt:new Date().toISOString(),data:{...sz,title:'Legacy listing',photos:['/unchanged-photo']}};
 await c.opsStore(env,'property',record);const copies=await Promise.all([c.estateEnsureReference(env,record),c.estateEnsureReference(env,record)]);assert.equal(copies[0].data.reference,copies[1].data.reference,'racing legacy reads settle on one persistent reference');assert.equal(copies[0].id,id);assert.equal(copies[0].data.photos[0],'/unchanged-photo');assert.equal((await c.estateEnsureReference(env,copies[0])).data.reference,copies[0].data.reference);
 await DB.prepare("UPDATE siege_records SET body_json=json_object('count',999) WHERE id=?").bind('PROPERTY-COUNTER:SZL-RS').run();assert.equal(await c.estateReserveReference(env,sz),'SZL-RS-1000','counter never wraps');
 const page=fs.readFileSync('property/index.html','utf8');assert(page.includes('esc(estateReference(p))'));assert(page.includes('data-report="${esc(p.id)}"'),'internal action identities stay unchanged');assert(page.includes('p.reference,p.region'));
 console.log('PASS: country/category references, separate sequences, concurrent uniqueness, stable legacy backfill, internal/photo IDs preserved, 999 overflow and reference search.');
})().catch(e=>{console.error(e);process.exitCode=1});
