import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
function fixture(){
 const geometry={type:'Polygon',coordinates:[[[0,0],[1,0],[1,1],[0,0]]]},geom={siegLocalGeometry:geometry};
 const choice={group:'soil',label:'Soil texture map'},snapshot={key:'soil',title:'Soil texture map',html:'<p>Clay: 28 percent</p>',maps:[{name:'Soil texture',data:'data:image/png;base64,test'}]};
 let snapshots=[snapshot],ready=true;
 const window={SiegeUsage:{active:{id:'job',geometryHash:'area',year:2026}},siegeAgri:{getGeometry:()=>geom},SiegExplicitAnalysis:{ready:()=>ready},SiegIndicatorSelection:{items:()=>[choice]},SiegFieldsSelectedResults:()=>snapshots,showTab:()=>{throw Error('Analysis rerun')}};
 const c={window,document:{},setTimeout,clearTimeout};
 vm.createContext(c);vm.runInContext(fs.readFileSync('agri/assets/report.js','utf8').split('const options=')[0].replace("(()=>{'use strict';",''),c);
 return {c,window,setSnapshots:v=>snapshots=v,setReady:v=>ready=v};
}
test('Fields report accepts soil-properties purchase alias and reuses completed statistics without rerunning EE',async()=>{const {c}=fixture();const html=await c.processSelected({name:'Test'},['soil-properties']);assert.match(html,/Clay: 28 percent/);assert.match(html,/data:image\/png;base64,test/);});
test('completed report cache reuses preparation and isolates new analysis identities',async()=>{const c={window:{SiegeUsage:{active:{id:'one',geometryHash:'area',year:2026,task:'soil'}}},pdfFiles:async v=>v};vm.createContext(c);const source=fs.readFileSync('assets/report-delivery.js','utf8'),start=source.indexOf('function reportCacheKey('),end=source.indexOf('const computation=',start);vm.runInContext('const reportCache=new Map();'+source.slice(start,end),c);let calls=0;const options={service:'fields',build:async()=>{calls++;return ['pdf']}};await Promise.all([c.reportFilesCached(options,{},['soil']),c.reportFilesCached(options,{},['soil'])]);assert.equal(calls,1);c.window.SiegeUsage.active.id='two';await c.reportFilesCached(options,{},['soil']);assert.equal(calls,2)});
test('Fields reports use stored results even when dashboard panels are absent, and reject stale or missing output',async()=>{const f=fixture();assert.match(await f.c.processSelected({},['soil']),/Clay: 28 percent/);f.setReady(false);await assert.rejects(f.c.processSelected({},['soil']),/Complete the selected indicators/);f.setReady(true);f.setSnapshots([]);await assert.rejects(f.c.processSelected({},['soil']),/Complete the selected indicators/);});
