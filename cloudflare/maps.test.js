import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
function point(x,y){return {x,y,add:p=>point(x+p.x,y+p.y),divideBy:n=>point(x/n,y/n)}}
function setup(){
 const calls=[],center={lat:10,lng:20};
 const bounds={isValid:()=>true,getWest:()=>0,getSouth:()=>0,getEast:()=>1,getNorth:()=>1,
  getNorthWest:()=>({lat:1,lng:0}),getSouthEast:()=>({lat:0,lng:1})};
 const canvas={style:{},parentElement:{querySelectorAll:()=>[]},closest:()=>null,
  getBoundingClientRect:()=>({width:640,height:320})};
 const context={window:{},L:{point,geoJSON:()=>({getBounds:()=>bounds})}};
 vm.runInNewContext(fs.readFileSync('assets/fit-map.js','utf8'),context);
 const map={options:{maxZoom:19},stop(){calls.push({stopped:true})},invalidateSize(){},
  fitBounds(bounds,options){calls.push({bounds,options})},getCenter:()=>center,getZoom:()=>12,
  getContainer:()=>canvas,getSize:()=>point(640,320),getMinZoom:()=>0,getMaxZoom:()=>19,
  getBoundsZoom(_bounds,_inside,padding){calls.push({padding});return 22},
  project:({lat,lng})=>point(lng,lat),unproject:({x,y})=>({lat:y,lng:x}),
  setView(center,zoom,options){calls.push({center,zoom,options})}};
 return {helper:context.window.SiegFitMap,map,calls,bounds};
}
test('global fit covers the world and retains the legacy helper alias',()=>{const {helper,map,calls}=setup();helper.world(map);assert.deepEqual(JSON.parse(JSON.stringify(calls.filter(c=>c.bounds)[0].bounds)),[[-85,-180],[85,180]]);helper.africa(map);assert.deepEqual(JSON.parse(JSON.stringify(calls.filter(c=>c.bounds)[1].bounds)),[[-85,-180],[85,180]])});
test('report capture frames the AOI and restores the prior view',async()=>{
 const {helper,map,calls}=setup();
 await helper.withArea(map,{},async()=>{
  assert.equal(calls.at(-1).zoom,22);
  assert.equal(map.options.maxZoom,24);
  assert.equal(map.getContainer().style.pointerEvents,'none');
 });
 assert.equal(calls.at(-1).zoom,12);
 assert.equal(calls.at(-1).center.lat,10);
 assert.equal(map.options.maxZoom,19);
 assert.equal(map.getContainer().style.pointerEvents,'');
});
test('all six interactive map services start globally, while selected-location zoom remains',()=>{for(const file of ['agri/assets/adapter.js','hydrology/assets/adapter.js','enviro/assets/app.js','irrigation/app.js','geocoding/app.js']){const text=fs.readFileSync(file,'utf8');assert.match(text,/L\.map\([^;]+\.fitWorld\(/,file);assert.ok(text.includes('map.setView(')||text.includes('map.fitBounds('),file)}const estate=fs.readFileSync('property/index.html','utf8');assert.ok(estate.includes('worldBounds=[[-85,-180],[85,180]]'));assert.ok(estate.includes('.fitBounds(worldBounds,worldFitOptions)'))});

test('area fit stops previous movement and uses canvas padding',()=>{
 const {helper,map,calls,bounds}=setup();
 helper.area(map,bounds);
 assert.equal(calls[0].stopped,true);
 assert.equal(calls.find(c=>c.padding).padding.y,48);
 assert.equal(calls.at(-1).options.animate,false);
 assert.equal(calls.at(-1).zoom,19);
});
