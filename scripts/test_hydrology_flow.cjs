const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
const nodes={},$=id=>nodes[id]??=({value:'',hidden:false,disabled:false,textContent:'',addEventListener(){}});
let ready=false;const buttons=[{disabled:false},{disabled:false}],c={document:{getElementById:$,querySelectorAll:()=>buttons},window:{siegeHydrology:{canAnalyse:()=>ready},aoi:{}},setTimeout};
$('floodTask').value='river';$('floodMode').value='manual';
vm.createContext(c);vm.runInContext(fs.readFileSync('hydrology/assets/guided-flow.js','utf8'),c);
assert(buttons.every(b=>b.disabled));assert($('floodWatchTools').hidden);
ready=true;c.window.HydroUX.sync('Flood Watch');assert(buttons.every(b=>!b.disabled));assert(!$('riverWatchInputs').hidden);assert($('damWatchInputs').hidden);assert($('floodGaugeInputs').hidden);assert(!$('floodManualInputs').hidden);
$('floodTask').value='dam';$('floodMode').value='records';c.window.HydroUX.sync();assert($('riverWatchInputs').hidden);assert(!$('damWatchInputs').hidden);assert(!$('floodGaugeInputs').hidden);assert($('damManualInputs').hidden);assert($('floodManualInputs').hidden);
c.window.hydroFloodSummary={geometry:c.window.aoi};c.window.HydroUX.sync();assert(!$('downloadFloodResults').disabled);
ready=false;c.window.hydroFloodSummary=null;c.window.HydroUX.sync();assert(buttons.every(b=>b.disabled));assert($('floodWatchTools').inert);assert($('downloadFloodResults').disabled);
const source=fs.readFileSync('hydrology/assets/dashboard.js','utf8');assert(!source.includes('Download displayed raster'));assert(!source.includes('Download monthly water balance'));assert(!source.includes('CSV downloads are prepared in your browser.'));
console.log('PASS: prerequisite gating, independent river/dam and manual/CSV forms, result download state and requested block removal.');

const html=fs.readFileSync('hydrology/index.html','utf8');assert(!html.includes('<ol class="hydro-flow"'));assert(!html.includes('id="hydroNextStep"'));
