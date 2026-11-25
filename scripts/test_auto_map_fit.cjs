const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const listeners={},timers=new Map(),observers=[];let id=0,viewportFits=0,fits=0,invalidations=0,unloads={},dialog=false,width=800,height=600;
const canvas={isConnected:true,style:{},getBoundingClientRect:()=>({width,height})},bounds={isValid:()=>true};
const document={documentElement:{},visibilityState:'visible',querySelector:()=>dialog?{}:null,querySelectorAll:()=>[],addEventListener(name,callback){(listeners[name]||=[]).push(callback)}};
const root={document,setTimeout(fn){timers.set(++id,fn);return id},clearTimeout(id){timers.delete(id)},requestAnimationFrame:fn=>fn(),getComputedStyle:()=>({visibility:'visible'}),addEventListener(name,callback){(listeners[name]||=[]).push(callback)},MutationObserver:class{constructor(fn){this.fn=fn;observers.push(this)}observe(){}},ResizeObserver:class{constructor(fn){this.fn=fn;observers.push(this)}observe(){}disconnect(){}},IntersectionObserver:class{constructor(fn){this.fn=fn;observers.push(this)}observe(){}disconnect(){}},SiegFitMap:{inProgress:()=>false,area(){fits++},viewport(){viewportFits++}}};
vm.runInNewContext(fs.readFileSync('assets/auto-map-fit.js','utf8'),{window:root});
function map(){const events={};return {getContainer:()=>canvas,getBounds:()=>bounds,invalidateSize(){invalidations++},on(name,fn){for(const n of name.split(' '))events[n]=fn},whenReady:fn=>fn(),events};}
function flush(){const callbacks=[...timers.values()];timers.clear();callbacks.forEach(fn=>fn())}
const one=map();root.SiegAutoMapFit.register(one,()=>bounds);flush();assert.equal(invalidations,1);assert.equal(fits,0,'Initial registration preserves the current view');
for(let n=0;n<20;n++)root.SiegAutoMapFit.refresh();assert.equal(timers.size,1,'Burst updates debounce per map');flush();assert.equal(fits,1);assert.equal(invalidations,1,'Same-sized canvases are not invalidated again');
const before=fits;one.events.dragstart();root.SiegAutoMapFit.refresh();flush();assert.equal(fits,before,'No automatic fit while dragging');one.events.dragend();
canvas.style.cursor='crosshair';root.SiegAutoMapFit.refresh();flush();assert.equal(fits,before,'Do not interrupt polygon/outlet placement');canvas.style.cursor='';
dialog=true;root.SiegAutoMapFit.refresh();flush();assert.equal(fits,before,'Do not change framing behind an open modal');dialog=false;
listeners.close[0]({target:{matches:()=>true}});flush();assert.equal(fits,before,'Closing a modal preserves the selected view');
listeners.click[0]({target:{closest:()=>({closest:()=>true})}});flush();assert.equal(fits,before,'Zoom/navigation action preserves requested view');
width=0;root.SiegAutoMapFit.refresh();flush();assert.equal(fits,before,'Hidden canvases are skipped');width=800;
// Simulate the UI/Leaflet feedback loop after AOI closure. No DOM update
// may trigger another fit or reload imagery at the same canvas dimensions.
const stableFits=fits,stableInvalidations=invalidations;
for(let i=0;i<50;i++){for(const f of listeners['sieg-area-state'])f({});observers[0].fn([{type:'attributes',target:{matches:()=>true,closest:()=>null}}]);flush();}
assert.equal(fits,stableFits);assert.equal(invalidations,stableInvalidations);assert.equal(timers.size,0);
width=900;root.SiegAutoMapFit.refresh(false);flush();assert.equal(invalidations,stableInvalidations+1);assert.equal(fits,stableFits);
const two=map();root.SiegAutoMapFit.register(two);flush();const beforeTwo=fits,beforeViewport=viewportFits;root.SiegAutoMapFit.refresh();flush();assert.equal(fits,beforeTwo+1,'AOI map refits selected area');assert.equal(viewportFits,beforeViewport+1,'Map without AOI actually refits its remembered viewport');
root.SiegAutoMapFit.register(two,()=>null,()=>true);const drawingViewport=viewportFits;root.SiegAutoMapFit.refresh();flush();assert.equal(viewportFits,drawingViewport,'Local drawing state blocks fallback refit');
one.events.unload();two.events.unload();root.SiegAutoMapFit.refresh();assert.equal(timers.size,0,'Removed maps release observers and scheduled work');
for(const file of ['app.py','agri/index.html','hydrology/index.html','enviro/index.html','property/index.html'])assert(fs.readFileSync(file,'utf8').includes('auto-map-fit.js'),file+' includes shared canvas refresh');
console.log('Automatic canvas refresh passed: registration, debounce, modal closure, selected area, view preservation, drawing/dragging, hidden maps and cleanup.');
