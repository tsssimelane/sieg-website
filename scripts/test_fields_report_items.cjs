const fs=require('fs'),vm=require('vm'),assert=require('assert/strict'),{webcrypto}=require('crypto');
const rows=new Map();const DB={prepare(sql){let args;return {bind(...a){args=a;return this},async first(){if(sql.includes('analysis_admin_mode'))return null;return rows.get(args[0])||null},async run(){if(sql.startsWith('INSERT OR IGNORE')){if(!rows.has(args[0]))rows.set(args[0],{body_json:args.at(-1)})}else if(sql.startsWith('UPDATE siege_records SET state=')){rows.set(args[2],{body_json:args[1]})}return {success:true}}}}};
const c=vm.createContext({Response,URL,Date,JSON,Number,Error,crypto:webcrypto,TextEncoder,reportAdmin:()=>false,reportOwner:()=> 'owner-1',reportSHA:async s=>require('crypto').createHash('sha256').update(s).digest('hex')});
vm.runInContext(fs.readFileSync('worker/hydrology-commerce.js','utf8')+'\n'+fs.readFileSync('worker/usage.js','utf8'),c);
const g={type:'Polygon',coordinates:[[[31,-26],[31.01,-26],[31.01,-25.99],[31,-25.99],[31,-26]]]};const env={DB,BUCKET:{}};
async function post(path,body){return c.usageAPI(new Request('https://sieg.test/api/analysis/'+path,{method:'POST',headers:{Origin:'https://sieg.test','Content-Type':'application/json'},body:JSON.stringify(body)}),env)}
(async()=>{
 assert.deepEqual(Array.from(c.fieldsReportItems(['monitoring','soil'],'monitoring')),['soil','recommendations','monitoring']);assert.throws(()=>c.fieldsReportItems(['fake'],'soil-properties'));
 assert.deepEqual(Array.from(c.ecoReportItems(['air-quality','land-classification'],'air-quality')),['land-classification','air-quality']);assert.throws(()=>c.ecoReportItems([],'biodiversity'));assert.throws(()=>c.ecoReportItems(['soil'],'biodiversity'));
 c.reportFee=()=>2100;
 const quoteBody={service:'eco',geometry:g,task:'biodiversity',year:new Date().getUTCFullYear(),reportItems:['biodiversity','air-quality'],requestId:webcrypto.randomUUID()};
 let qr=await post('orders',quoteBody),q=await qr.json();assert.equal(qr.status,200);assert.deepEqual(q.reportItems,['biodiversity','air-quality']);
 const qr2=await post('orders',{...quoteBody,reportItems:['biodiversity']});assert.notEqual((await qr2.json()).id,q.id,'Changing checked report services creates a separate quote');
 await assert.rejects(c.hydroCheckout(new Request('https://sieg.test/api/reports/orders'),env,{analysisPurchaseId:q.id,service:'eco',expectedAmount:2100,reportItems:['biodiversity'],confirmReportItems:true}),/Confirm the selected report items/);
 await assert.rejects(c.hydroCheckout(new Request('https://sieg.test/api/reports/orders'),env,{analysisPurchaseId:q.id,service:'eco',expectedAmount:2100,reportItems:q.reportItems,confirmReportItems:false}),/Confirm the selected report items/);
 let r=await post('free-suitability',{geometry:g}),a=await r.json();assert.equal(r.status,200);assert.equal(a.freeSuitability,true);assert.equal(a.paymentVerified,false);
 r=await post('start',{id:a.id});let active=await r.json();assert.equal(active.state,'running');assert.equal(active.expires,a.expires,'free lease must not be erased by start');
 r=await post('free-suitability',{geometry:g});assert.equal((await r.json()).id,a.id,'retry reuses one trial');
 const other=structuredClone(g);other.coordinates[0].forEach(p=>p[0]+=.1);r=await post('free-suitability',{geometry:other});assert.equal(r.status,400,'second area cannot claim another free trial');
 assert.throws(()=>c.usageFreeSuitabilityExpression({expression:{values:{x:{functionInvocationValue:{functionName:'Image.load',arguments:{id:{constantValue:'COPERNICUS/S2_SR_HARMONIZED'}}}}}}},'maps'),/limited/);
 assert.doesNotThrow(()=>c.usageFreeSuitabilityExpression({expression:{values:{x:{functionInvocationValue:{functionName:'Image.load',arguments:{id:{constantValue:'projects/soilgrids-isric/phh2o_mean'}}}}}}},'maps'));
 assert.throws(()=>c.usageFreeSuitabilityExpression({},'tables'),/exports/);
 let saved=JSON.parse(rows.get(a.id).body_json);saved.expires=Date.now()-1;rows.set(a.id,{body_json:JSON.stringify(saved)});r=await post('start',{id:a.id});assert.equal(r.status,400,'expired trial cannot restart');
 const report=fs.readFileSync('agri/assets/report.js','utf8');assert(report.includes("if(true)await capture('Crop recommendations'"));assert(report.includes("if(true)await capture('Vegetable recommendations'"));assert(report.indexOf('sections.push(...recommendations)')>report.indexOf("title:'Yield estimation"));
 console.log('PASS: canonical report bundles, atomic owner trial, same-area retry, changed-area rejection, trial expiry, source/export restrictions and mandatory final crop + vegetable recommendations.');
})().catch(e=>{console.error(e);process.exitCode=1});
