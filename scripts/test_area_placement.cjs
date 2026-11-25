const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');const ctx={window:{}};vm.runInNewContext(fs.readFileSync('assets/polygon-tools.js','utf8'),ctx);const place=ctx.window.SiegPolygonTools.freePosition;
const overlap=(p,w,h,b)=>Math.max(0,Math.min(p.x+w,b.x+b.width)-Math.max(p.x,b.x))*Math.max(0,Math.min(p.y+h,b.y+b.height)-Math.max(p.y,b.y));
for(const [W,H,w,h,want,blocks,pointer] of [
[900,650,250,40,{x:638,y:76},[{x:500,y:70,width:390,height:350}]],
[900,650,250,40,{x:40,y:40},[{x:0,y:0,width:290,height:650},{x:500,y:0,width:400,height:450}],{x:26,y:26}],
[360,600,260,62,{x:300,y:570},[{x:200,y:0,width:160,height:400}],{x:290,y:560}],
[900,650,250,40,{x:638,y:76},[{x:0,y:0,width:900,height:120},{x:0,y:180,width:900,height:470}]]
]){const p=place(W,H,w,h,want,blocks,pointer);assert(p.x>=8&&p.y>=8&&p.x+w<=W-8&&p.y+h<=H-8);assert.equal(blocks.reduce((n,b)=>n+overlap(p,w,h,b),0),0)}
const a=place(800,600,200,40,{x:330,y:230},[],{x:316,y:216});assert.equal(a.x,330);assert.equal(a.y,230);
console.log('Area placement passed: open layers, drawer, mobile edges, narrow free strip and pointer proximity.');
