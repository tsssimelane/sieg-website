const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict'),{webcrypto}=require('node:crypto');
(async()=>{
 const items=new Map(),bucket={get:async k=>items.has(k)?{body:items.get(k)}:null,put:async(k,v)=>{items.set(k,v);return {}},delete:async k=>items.delete(k)};
 let unrestricted=true;const ctx={usageIsUnrestricted:async()=>unrestricted,crypto:webcrypto,TextEncoder,Response,Request,URL,Date,console};vm.createContext(ctx);
 vm.runInContext(fs.readFileSync('worker/index.js','utf8').split('export default')[0],ctx);vm.runInContext(fs.readFileSync('worker/reports.js','utf8'),ctx);
 const env={BUCKET:bucket},password='test-only-long-master';
 const req=(email,password,origin='https://sieg.test')=>new Request('https://sieg.test/api/reports/admin-download',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json','oai-authenticated-user-id':'admin-test','oai-authenticated-user-email':email},body:JSON.stringify({password})});
 let r=await ctx.reportsAPI(req('client@example.com',password),env);assert.equal(r.status,403);
 r=await ctx.reportsAPI(req('tss.simelane@gmail.com',password,'https://other.test'),env);assert.equal(r.status,403);
 r=await ctx.reportsAPI(req('tss.simelane@gmail.com',password),env);assert.equal(r.status,409);assert(!items.has('geocoding/admin/password.json'));
 unrestricted=false;r=await ctx.reportsAPI(req('tss.simelane@gmail.com',password),env);assert.equal(r.status,403);unrestricted=true;
 const hash=await ctx.passwordHash(password,'test-salt');items.set('geocoding/admin/password.json',JSON.stringify({salt:'test-salt',hash}));
 r=await ctx.reportsAPI(req('tss.simelane@gmail.com','incorrect-password'),env);assert.equal(r.status,403);
 r=await ctx.reportsAPI(req('tss.simelane@gmail.com',password),env);assert.equal(r.status,200);assert.equal((await r.json()).verified,true);
 assert(![...items.keys()].some(k=>k.startsWith('reports/orders/')),'Admin verification must not create paid orders');
 for(let i=0;i<5;i++)await ctx.reportsAPI(req('tss.simelane@gmail.com','incorrect-password'),env);
 r=await ctx.reportsAPI(req('tss.simelane@gmail.com',password),env);assert.equal(r.status,429);
 for(const name of ['assets/report-delivery.js','property/report-delivery.js']){const s=fs.readFileSync(name,'utf8');assert(s.indexOf("await api('admin-download'")<s.indexOf('const prepared=await current.build(contact,current.selectedReports)'));assert(s.includes("if(f.encoding==='base64')"));assert(!s.includes('name="rdMasterPassword"'));}
 console.log('PASS: admin identity, same-origin enforcement, configured-password requirement, wrong/correct password, rate limiting, no order creation, verification before file generation, binary downloads and password exclusion from contact data.');
})().catch(e=>{console.error(e);process.exitCode=1});
