const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('hydrology/assets/dashboard.js','utf8');
function extract(name){const start=source.indexOf('function '+name+'('),end=source.indexOf('\n}',start)+2;assert(start>=0&&end>start);return source.slice(start,end)}
let fields=[],buttons=[],selects=[];
const widget=value=>({getValue:()=>value,setValue:v=>value=v,onChange(){},setOptions(){return this},setChartType(){return this}});
const ctx={aoi:{},C:{},year:2025,generation:0,hydraulicRequest:0,hydraulicResults:null,activeTab:'Water Availability',reservoirAreaSelected:false,CONFIG:{},modulePanel:{add(){},clear(){}},results:{add(){},clear(){}},legend:{clear(){}},map:{layers:()=>({reset(){}}),addLayer(){}},addAdminBoundary(){},heading:x=>x,note:x=>x,label:x=>x,hydroStatus:{setValue(){}},addBalanceMode(){},Export:{},ee:{Feature:(g,p)=>p,FeatureCollection:a=>({features:a,style(){return this}})},ui:{Select:o=>{const w=widget(o.value);selects.push(w);return w},Textbox:o=>{const w=widget(o.value);fields.push(w);return w},Chart:{feature:{byFeature:()=>widget()}}},button:(label,fn)=>{buttons.push({label,fn});return {}},Math,Number,String,Error,isFinite};
vm.createContext(ctx);vm.runInContext(['hydroMonthCount','hydraulicField','readNumber','exportHydraulics','resetHydraulicView','estimateManningFlow','estimateBathymetricVolume','renderRiverFlow','renderDamVolume'].map(extract).join('\n'),ctx);
ctx.renderRiverFlow(); // bottom, depth, area, radius, side slope, slope, n
[12,1.2,'','',0,.001,.035].forEach((v,i)=>fields[i].setValue(String(v)));
buttons.find(b=>b.label==='Estimate river discharge').fn();
assert(Math.abs(ctx.hydraulicResults.features[0].discharge_m3_s-13.0105)<.01);
fields[1].setValue('');fields[2].setValue('14.4');fields[3].setValue('1');buttons[0].fn();
assert(Math.abs(ctx.hydraulicResults.features[0].discharge_m3_s-14.4*Math.sqrt(.001)/.035)<1e-8);
fields=[];buttons=[];selects=[];ctx.renderDamVolume();
// mode, target, month; mean depth, area ha, mean bed, water level
fields[0].setValue('5');fields[1].setValue('2');buttons[0].fn();
assert.equal(ctx.hydraulicResults.features[0].volume_m3,100000);
selects[0].setValue('MSL water level − mean bed elevation');fields[2].setValue('100');fields[3].setValue('108');buttons[0].fn();
assert.equal(ctx.hydraulicResults.features[0].volume_m3,160000);
fields[3].setValue('99');buttons[0].fn();assert.equal(ctx.hydraulicResults,null);
console.log('PASS: clicked river depth and surveyed-area alternatives; dam depth and MSL/bed methods; reject negative depth.');
