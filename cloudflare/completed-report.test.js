import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
function fieldsFixture(){
 const geometry={siegLocalGeometry:{type:'Polygon',coordinates:[[[0,0],[1,0],[1,1],[0,0]]]}};
 const image={select:()=>image,clip:()=>image,divide:()=>image,rename:()=>image,addBands:()=>image,
  reduceRegion:()=>({evaluate:callback=>callback({groups:[{texture:7,sum:28}]})})};
 const maps=[];
 const window={SiegeUsage:{active:{id:'job',geometryHash:'area',year:2026}},
  siegeAgri:{getGeometry:()=>geometry},SiegeDelivery:{progress(){}},
  Map:{addLayer:()=>({})},siegeFieldsReportLayer:async(_layer,options)=>{maps.push(options);return 'data:image/png;base64,test'}};
 const ee={Image:Object.assign(()=>image,{pixelArea:()=>image}),Reducer:{sum:()=>({group(){}})}};
 const source=fs.readFileSync('agri/assets/report.js','utf8').split('const prepared=')[0];
 const c={window,ee,setTimeout,clearTimeout};
 vm.runInNewContext(source+'window.processSelected=processSelected;})();',c);
 return {window,maps};
}
test('Fields report resolves the soil-properties alias and includes the sampled area and map',async()=>{
 const {window,maps}=fieldsFixture();
 const html=await window.processSelected({name:'Test'},['soil-properties']);
 assert.match(html,/data-service="soil"/);
 assert.match(html,/<td>Loam<\/td><td>28.0 ha<\/td>/);
 assert.equal(maps.length,1);
});
test('completed report cache reuses preparation and isolates new analysis identities',async()=>{const c={pdfFiles:async files=>files,window:{SiegeUsage:{active:{id:'one',geometryHash:'area',year:2026,task:'soil'}}}};vm.createContext(c);const source=fs.readFileSync('assets/report-delivery.js','utf8'),start=source.indexOf('function reportCacheKey('),end=source.indexOf('const computation=',start);vm.runInContext('const reportCache=new Map();'+source.slice(start,end),c);let calls=0;const options={service:'fields',build:async()=>{calls++;return ['pdf']}};await Promise.all([c.reportFilesCached(options,{},['soil']),c.reportFilesCached(options,{},['soil'])]);assert.equal(calls,1);c.window.SiegeUsage.active.id='two';await c.reportFilesCached(options,{},['soil']);assert.equal(calls,2)});
test('Fields report rejects changes to the active analysis during map capture',async()=>{
 const {window}=fieldsFixture();
 window.siegeFieldsReportLayer=async()=>{window.SiegeUsage.active.id='other';return 'data:image/png;base64,test'};
 await assert.rejects(window.processSelected({},['soil']),/selected area or year changed/);
});
