const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('agri/assets/original-dashboard.js','utf8');
const adapter=fs.readFileSync('agri/assets/adapter.js','utf8');
function element(){return {style:{},children:[],append(...items){this.children.push(...items)},replaceChildren(){this.children=[]}}}
const context={document:{createElement:element},widget:()=>({el:element()}),Promise};
vm.createContext(context);
vm.runInContext(adapter.split('\n').find(line=>line.startsWith('function chart(')),context);
const features=Array.from({length:12},(_,i)=>({properties:{month:i+1,rain_mm:i+10,temp_c:i+15,wind_ms:i+1,solar_mj:i+5,days:30,historical_samples:10}}));
const table={features,evaluate(){throw Error('Already evaluated rows must not trigger a provider request')}};
const tick=()=>new Promise(r=>setImmediate(r));
(async()=>{
 const charts=['rain_mm','temp_c','wind_ms','solar_mj'].map(key=>context.chart(table,'month',[key]).setOptions({title:key}));
 await tick();
 charts.forEach((chart,i)=>{assert.equal(chart.el.children.length,13);assert.equal(chart.el.children[0].textContent,['rain_mm','temp_c','wind_ms','solar_mj'][i]);assert.notEqual(chart.el.children[1].children[2].textContent,'No data')});
 const failed=context.chart({evaluate:cb=>cb(null,'Provider unavailable')},'month',['rain_mm']);await tick();assert.match(failed.el.textContent,/Provider unavailable/);
 assert.match(source,/var chartRows = value.rows;/);
 let requests=0,fail=false;
 const loader={Promise,Date,setTimeout,isFinite,getWeatherWindow(){requests++;return {metadata:{evaluate(cb){setImmediate(()=>cb(fail?null:{sourceMonths:120,distinctSourceMonths:120},fail?'Network error':null))}},rows:{evaluate(cb){setImmediate(()=>cb({features}))}}}}};
 vm.createContext(loader);vm.runInContext(source.slice(source.indexOf('var climateCache ='),source.indexOf('function showCropSelection')),loader);
 const geom={serialize:()=> 'area1'};
 const load=g=>new Promise((resolve,reject)=>loader.loadWeatherData(g,(v,e)=>e?reject(Error(e)):resolve(v)));
 const result=await Promise.all([load(geom),load(geom),load(geom)]);assert.equal(requests,1);assert.equal(result[0],result[1]);assert.equal((await load(geom)).rows.features.length,12);assert.equal(requests,1);
 fail=true;await assert.rejects(load({serialize:()=> 'area2'}),/Network error/);fail=false;const before=requests;await load({serialize:()=> 'area2'});assert.equal(requests,before+1);
 console.log('PASS: all four climate charts render 12 months without provider re-evaluation; overlapping loads share one request; cache and failure recovery work.');
})().catch(e=>{console.error(e);process.exitCode=1});
