const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const app=fs.readFileSync('enviro/assets/app.js','utf8');
const block=app.slice(app.indexOf('function ecoBoundaryKey('),app.indexOf('window.siegeEcoReportMap='));
const raw={type:'Polygon',coordinates:[[[31,-26],[31.01,-26],[31.01,-26.01],[31,-26]]]};
let reads=0;
const context={selectedRegion:{siegLocalGeometry:raw},geometryRevision:7,drawing:false,evaluate:async g=>{reads++;return g.value;},Error,JSON};vm.createContext(context);vm.runInContext(block,context);
(async()=>{
 const snapshot={geometry:{siegLocalGeometry:JSON.parse(JSON.stringify(raw))}};
 assert.equal(JSON.stringify(await context.ecoReportGeometry(snapshot)),JSON.stringify(raw),'Restored equivalent boundary keeps completed results printable');assert.equal(reads,0,'Locally known boundaries require no Earth Engine recomputation');
 const different={...raw,coordinates:[[[32,-26],[32.01,-26],[32.01,-26.01],[32,-26]]]};context.selectedRegion={siegLocalGeometry:different};await assert.rejects(context.ecoReportGeometry(snapshot),/area changed/);
 context.selectedRegion={type:()=> 'Polygon',value:raw};await context.ecoReportGeometry({geometry:{type:()=> 'Polygon',value:raw}});assert.equal(reads,2,'Computed boundaries are compared by evaluated geometry');
 context.drawing=true;await assert.rejects(context.ecoReportGeometry(snapshot),/area changed/);context.drawing=false;
 context.selectedRegion={value:raw};context.evaluate=async g=>{context.geometryRevision++;return g.value;};await assert.rejects(context.ecoReportGeometry({geometry:{value:raw}}),/area changed/,'Area changes during evaluation cancel export');
 console.log('PASS: restored AOI identity, local geometry reuse, computed AOI equivalence, different-boundary rejection, drawing and stale-export protection');
})().catch(e=>{console.error(e);process.exitCode=1});
