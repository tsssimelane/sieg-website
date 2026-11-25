const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('assets/map-workspace.js','utf8'),block=source.slice(source.indexOf('  const multi='),source.indexOf('  async function runCheckedService'));
async function test(service){
 const groups=service==='fields'?['soil','suitability']:service==='eco'?['0','1']:['Water Availability','Catchment Health'];
 const rows=groups.map(group=>({source:{group,check:{checked:true}}}));
 const catalog=Object.fromEntries(groups.map(group=>[group,[{label:group+' A',value:service==='eco'?'A':undefined,hydroAction:service==='eco'?undefined:'product:a'},{label:group+' B',value:service==='eco'?'B':undefined,hydroAction:service==='eco'?undefined:'product:b'}]]));
 let count=0,concurrent=0,maxConcurrent=0,authorised=true,exports=0,failNext=false;
 const runner=async()=>{if(failNext){failNext=false;throw Error('Statistics failed');}concurrent++;maxConcurrent=Math.max(maxConcurrent,concurrent);await new Promise(r=>setTimeout(r,2));count++;concurrent--};
 const root={SiegEcoDeliverPaid:async()=>{exports++;},addEventListener(){},SiegeUsage:{active:{paymentVerified:true,id:'paid-scope',geometry:{type:'Polygon'},year:2026},getGeometry:()=>({type:'Polygon'}),ensure:async()=>authorised},SiegHydroSelectModule(){},SiegEcoRunIndicator:runner,SiegHydroRunIndicator:runner,SiegFieldsRunIndicator:runner};
 const c={service,root,rowModels:rows,subCatalog:{[service]:catalog},subKey:s=>s.group,document:{querySelectorAll:()=>[]},renderSubitems(){},syncServices(){},accessNote:{},setTimeout,clearTimeout,sessionStorage:{setItem(){}},console};vm.createContext(c);
 vm.runInContext(block+`;globalThis.testAPI={mark,processSelections,selections,states};`,c);
 for(const row of rows)for(const item of catalog[row.source.group])c.testAPI.mark(row.source,item,true);
 assert.equal(root.SiegIndicatorSelection.items().length,4,'Two checked indicators in each of two services');
 await c.testAPI.processSelections();await Promise.resolve();assert.equal(exports,service==='eco'?1:0,'Eco PDF starts after all checked indicators complete');assert.equal(count,4);assert.equal(maxConcurrent,1,'Analyses are serialized');
 await c.testAPI.processSelections();await Promise.resolve();assert.equal(exports,service==='eco'?1:0,'A report check does not start another automatic export');assert.equal(count,4,'Completed indicators are reused within the same scope');
 rows[0].source.check.checked=false;assert.equal(root.SiegIndicatorSelection.items().length,2,'Unchecking one service preserves the other service');
 rows[0].source.check.checked=true;assert.equal(root.SiegIndicatorSelection.items().length,4);
 c.testAPI.mark(rows[0].source,catalog[groups[0]][0],false);assert.equal(root.SiegIndicatorSelection.items().length,3,'Indicators can be unchecked independently');
 root.SiegeUsage.active={...root.SiegeUsage.active,year:2025};await c.testAPI.processSelections();assert.equal(count,7,'Changed analysis scope invalidates completion');
 authorised=false;root.SiegeUsage.active={...root.SiegeUsage.active,year:2024};await c.testAPI.processSelections();assert.equal(count,7,'Unpaid selections never run');assert.equal(root.SiegIndicatorSelection.items().length,3,'Awaiting payment does not erase checks');
 if(service==='eco'){const before=exports;authorised=true;failNext=true;root.SiegeUsage.active={...root.SiegeUsage.active,year:2023};await c.testAPI.processSelections();await Promise.resolve();assert.equal(exports,before,'Incomplete batches never start a misleading PDF export');await c.testAPI.processSelections();await Promise.resolve();assert.equal(exports,before+1,'Retrying the failed indicator starts one PDF after the batch completes');}
}
(async()=>{await test('fields');await test('eco');await test('hydrology');
 const server={};vm.createContext(server);const commerce=fs.readFileSync('worker/hydrology-commerce.js','utf8');vm.runInContext(commerce.slice(commerce.indexOf('function hydroSingleReportItem')),server);
 assert.equal(server.hydroSingleReportItem(['farm-water-assessment','catchment-assessment'],'farm-water-assessment').length,2);
 assert.throws(()=>server.hydroSingleReportItem(['wetland-mapping'],'farm-water-assessment'));
 assert.throws(()=>server.hydroSingleReportItem([],'farm-water-assessment'));
 assert.equal(server.analysisIndicatorChoices([{group:'0',value:'Land cover',label:'Land cover'}]).length,1);
 assert.throws(()=>server.analysisIndicatorChoices(Array(81).fill({})));
 console.log('PASS: multiple services and indicators, independent unchecking, sequential processing, completed-result reuse, scope changes, payment gating and server bundle validation');
})().catch(error=>{console.error(error);process.exitCode=1});
// Execute Irrigate's actual layer-row renderer before any calculated layers exist.
{
 const make=(tag,cls,text)=>({tag,cls,text,children:[],append(...v){this.children.push(...v)},replaceChildren(){this.children=[]},setAttribute(){}});
 const children=make('div'),layers=new Set(['Laterals and furrows','Supply and distribution pipes','Equipment and sprinklers']);
 const c={multi:false,service:'irrigation',irrigationSelected:true,irrigationLayers:layers,rowModels:[{source:{button:{disabled:true}},children}],subKey:()=> 'irrigation',subCatalog:JSON.parse(fs.readFileSync('assets/map-subitems.json')),node:make,subAction:()=>null,root:{SiegMapWorkspace:{availableLayers:()=>[]}},activeSource:()=>false};
 vm.createContext(c);const renderer=source.slice(source.indexOf('  function renderSubitems()'),source.indexOf('  function renderLayers()'));
 vm.runInContext(renderer,c);c.renderSubitems();assert.equal(children.hidden,false);
 for(const row of children.children.slice(1)){const check=row.children[0];assert.equal(check.disabled,false,'Irrigate layers can be checked before calculation');assert.equal(check.checked,true);check.checked=false;check.onchange();}
 assert.equal(layers.size,0,'Pending layout choices can be unchecked independently');
 console.log('PASS: Irrigate layout checkboxes are enabled before calculation and retain user choices');
}
