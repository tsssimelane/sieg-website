import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
const context={};vm.createContext(context);vm.runInContext(fs.readFileSync('assets/aoi-upload.js','utf8'),context);const upload=context.SiegAOIUpload;
function square(area,offset=0){let lo=0,hi=.1;for(let i=0;i<60;i++){const side=(lo+hi)/2,g={type:'Polygon',coordinates:[[[offset,0],[offset+side,0],[offset+side,side],[offset,side],[offset,0]]]};if(upload.area(g)<area)lo=side;else hi=side;}const s=(lo+hi)/2;return {type:'Polygon',coordinates:[[[offset,0],[offset+s,0],[offset+s,s],[offset,s],[offset,0]]]};}
const paidLimits=[['fields',.5],['irrigation',.5],['eco',5],['hydrology',5]];
for(const [service,limit] of [...paidLimits,['estates',1]])test(service+' applies its '+(limit*100)+' ha limit',()=>{assert.ok(upload.validate(square(limit),service).areaKm2<=limit+.000001);assert.throws(()=>upload.validate(square(limit+.0001),service),/ha/);});
test('multipart upload cap uses combined area rather than individual polygon sizes',()=>{const a=square(3),b=square(3,.1);assert.throws(()=>upload.validate({type:'MultiPolygon',coordinates:[a.coordinates,b.coordinates]},'eco'),/500 ha/);});
test('shared drawing validation rejects an incomplete polygon',()=>{
 context.window=context;
 vm.runInContext(fs.readFileSync('assets/polygon-tools.js','utf8'),context);
 const messages=[];
 assert.equal(context.SiegPolygonTools.validate([[0,0],[0,.001]],message=>messages.push(message),'fields'),false);
 assert.equal(messages.length,1);
});
test('the three drawing completion handlers call the shared limit check',()=>{for(const file of ['agri/assets/adapter.js','enviro/assets/app.js','irrigation/app.js'])assert.match(fs.readFileSync(file,'utf8'),/SiegPolygonTools\.validate\(/,file);});
test('server rejects an oversized new request for every analysis service before creating an order',async()=>{const server={Response,URL,reportOwner:()=> 'test-owner',reportAdmin:()=>false,hydroSingleReportItem(){},commerceTask:()=> 'test'};vm.createContext(server);vm.runInContext(fs.readFileSync('worker/usage.js','utf8'),server);for(const [service,limit] of paidLimits){const request=new Request('https://sieg.test/api/analysis/orders',{method:'POST',headers:{Origin:'https://sieg.test','Content-Type':'application/json'},body:JSON.stringify({service,geometry:square(limit+.01)})});const r=await server.usageAPI(request,{DB:{},BUCKET:{}});assert.equal(r.status,400);assert.match((await r.json()).error,/maximum boundary area/);}});

test('valid oversized drawings can close while analysis area limits are enforced at submission',()=>{
 for(const [service,limit] of paidLimits){
  const ring=square(limit+.01).coordinates[0].slice(0,-1).map(([lon,lat])=>[lat,lon]);
  assert.equal(context.SiegPolygonTools.validate(ring,()=>{},service),true,service);
 }
});
test('free-session uploads remain limited to 5 ha for each service',()=>{context.SiegeUsage={freeTrialEnabled:()=>true,adminMode:()=> 'restricted'};try{for(const service of ['fields','irrigation','eco','hydrology']){assert.equal(upload.limitKm2(service),.05);assert.ok(upload.validate(square(.05),service));assert.throws(()=>upload.validate(square(.051),service),/5 ha/);}}finally{delete context.SiegeUsage;}});
