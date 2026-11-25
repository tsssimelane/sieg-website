const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const bounds={isValid:()=>true,getWest:()=>30,getSouth:()=>-27,getEast:()=>31,getNorth:()=>-26};
let center={lat:-26.5,lng:30.5},zoom=14;
const map={getCenter:()=>center,getZoom:()=>zoom,getSize:()=>({x:1000,y:600}),setView(c,z){center=c;zoom=z;}};
const c={window:null,L:{point:()=>({}),geoJSON:()=>({getBounds:()=>bounds})}};c.window=c;vm.runInNewContext(fs.readFileSync('assets/fit-map.js','utf8'),c);
// Seed a genuine fitted view through the actual fit path (world fit delegates).
c.SiegWorldMap={fit(){}};map.stop=()=>{};map.invalidateSize=()=>{};
const canvas={getBoundingClientRect:()=>({width:1000,height:600}),closest:()=>({querySelectorAll:()=>[]})};map.getContainer=()=>canvas;map.options={};map.getBoundsZoom=()=>14;const point=()=>({x:0,y:0,add:()=>point(),divideBy:()=>point()});map.project=(p,z)=>point();map.unproject=()=>center;map.getMinZoom=()=>0;bounds.getNorthWest=()=>({});bounds.getSouthEast=()=>({});
c.SiegFitMap.area(map,bounds);
(async()=>{const geometry={type:'Polygon',coordinates:[]},views=[];await c.SiegFitMap.withArea(map,geometry,async()=>views.push([center,zoom]));center={lat:0,lng:0};zoom=3;const prior=center;await c.SiegFitMap.withArea(map,geometry,async()=>views.push([center,zoom]));assert.deepEqual(views[0],views[1]);assert.equal(center,prior);assert.equal(zoom,3);await assert.rejects(c.SiegFitMap.withArea(map,geometry,async()=>{throw Error('failed')}),/failed/);assert.equal(zoom,3);console.log('PASS: all report maps reuse the fitted centre and zoom, restoring the live view after success or failure');})().catch(e=>{console.error(e);process.exitCode=1});
