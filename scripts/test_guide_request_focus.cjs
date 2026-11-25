const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('assets/service-guide.js','utf8'),reveal=source.slice(source.indexOf('function reveal(){'),source.indexOf('\nfunction init()'));
for(const kind of ['fields','hydrology','irrigate','eco','address','estate','transit']){
 const calls=[],classes=new Set();let opened=false;
 const workspace={querySelector:()=>({click(){opened=true;calls.push('open')}})},drawer={classList:{contains:()=>true}},details={tagName:'DETAILS',open:false,parentElement:null};
 const request={parentElement:details,closest(selector){return selector==='.is-panel-hidden'&&kind!=='transit'?workspace:selector==='#transitDrawer'&&kind==='transit'?drawer:null},focus(options){assert.equal(options.preventScroll,true);calls.push('focus')},scrollIntoView(){assert.equal(opened,true);calls.push('scroll')},classList:{contains:c=>classes.has(c),add(c){classes.add(c)},remove(c){classes.delete(c)}}};
 const ctx=vm.createContext({document:{querySelectorAll:()=>[]},current:3,steps:[{},{},{},{key:'review',target:'.old-target'}],host:{closest:()=>({querySelector:()=>request})},q:selector=>selector==='#transitDrawerToggle'?{click(){opened=true;calls.push('open')}}:null,setTimeout:()=>{}});
 vm.runInContext(reveal+';reveal();',ctx);assert.deepEqual(calls,['open','focus','scroll'],kind);assert(details.open);assert(classes.has('sieg-guide-target'));
}
for(const file of ['assets/map-workspace.js','geocoding/map-controls.js','property/map-controls.js']){
 const text=fs.readFileSync(file,'utf8');assert(!text.includes('autoHide'),file+' has no automatic Layers close');assert(!/setTimeout\([^\n]*layers\.open\s*=\s*false/.test(text));
}
console.log('Guide request focus: seven services open drawer before focus/scroll and highlight action; all Layers controllers have no auto-hide timers.');
