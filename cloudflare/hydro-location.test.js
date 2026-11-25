import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
const asset=code=>'projects/ee-gee023/assets/cat_pfaf_'+code+'_MERIT_Hydro_v07_Basins_v01',routing='WWF/HydroSHEDS/v1/Basins/hybas_1',configured=Object.fromEntries([1,2,3,4,5,6,7,8,9].map(c=>[c,asset(c)]));
const polygon={type:'Polygon',coordinates:[[[30,-28],[33,-28],[33,-25],[30,-25],[30,-28]]]},feature=(id,contains=true,geometry=polygon)=>({type:'Feature',properties:{COMID:id,unitarea:4},geometry,contains});
function fixture(options={}){
 const nodes=new Map(),node=id=>{if(!nodes.has(id))nodes.set(id,{value:'',style:{},textContent:'',disabled:false});return nodes.get(id)};
 let mounted,point,radius,assets=[],selections=[],overviews=[],evaluations=0;const filters=[];
 function collection(id,features=options.features||[feature(1)],filtered=false){return {id,features,filter(){return this},filterBounds(area){filters.push({id,point:!!area.point,filtered});return collection(id,area.point?features.filter(f=>f.contains):features,true)},merge(other){assert(filtered&&other.filtered,'Filter local subsets before merging');return collection('local-seam',[...features,...other.features],true)},filtered,aggregate_array(){return {distinct(){return {evaluate(cb){evaluations++;cb(options.regions||[1])}}}}},size(){return features.length},sort(){return collection(id,[...features].sort((a,b)=>a.properties.COMID-b.properties.COMID),filtered)},limit(n){return collection(id,features.slice(0,n),filtered)},select(){return this},geometry(){return {evaluate(cb){cb(polygon)}}},evaluate(cb){evaluations++;cb({type:'FeatureCollection',features})}};}
 const geometry=raw=>({...raw,evaluate(cb){cb(raw)}});geometry.Rectangle=()=>({world:true});geometry.Point=coords=>{point=coords;return {point:true,buffer:metres=>{radius=metres;return {buffer:true}}}};
 const window={SiegCurrentLocation:{mount(options){mounted=options}},SiegReportMap:{getContainer:()=>({style:{cursor:''}})},SiegeUsage:{attachGeometry:(geom,raw)=>Object.assign(geom,{siegLocalGeometry:raw})},hydroMapBridge:{clear(){},zoom(){},country(){},overview(data){overviews.push(data);return !!data}},SiegAreaSection:{reset(){this.complete=false},ready(){this.complete=true},complete:false},analysisCaption:{setValue(){}},regionSelect:{el:{},items:()=>({reset(){}}),setValue(){}},yearSelect:{el:{}},modulePanel:{clear(){}},results:{clear(){}},legend:{clear(){}},async selectRegion(value){selections.push(value);window.selectedBasin=value;window.aoi=window.regionFeatures[value]}};
 const ee={FeatureCollection:id=>{if(typeof id==='object')return id;assets.push(id);return collection(id)},Feature:x=>x,Filter:{eq:()=>({})},Algorithms:{If:(condition,a,b)=>condition?a:b},Geometry:geometry};
 const responder=options.responder||(async()=>({ok:true,json:async()=>({assets:configured,routingAsset:routing})}));
 vm.runInNewContext(fs.readFileSync('hydrology/assets/locator.js','utf8'),{window,ee,fetch:responder,document:{getElementById:node},console,setTimeout,clearTimeout});
 return {window,node,get mounted(){return mounted},get evaluations(){return evaluations},get point(){return point},get radius(){return radius},assets,selections,overviews,filters};
}
const tick=()=>new Promise(r=>setImmediate(r));
test('location routes to one continental table, filters locally, returns one full catchment in two value requests',async()=>{
 const f=fixture();await f.mounted.onLocated({lat:-26.5,lon:31.4},null);assert.equal(f.evaluations,0);f.window.siegeHydrology.engineLoaded();await tick();assert.equal(f.evaluations,2);assert.deepEqual(Array.from(f.point),[31.4,-26.5]);assert.equal(f.radius,30);assert.deepEqual(f.assets,[routing,asset(1)]);assert.deepEqual(f.selections,['MERIT-Basins: 1']);assert.equal(f.window.siegeHydrology.canAnalyse(),true);assert.deepEqual(JSON.parse(JSON.stringify(f.window.aoi.siegLocalGeometry)),polygon);
});
test('region 4 uses only its configured Asia asset',async()=>{
 const f=fixture({regions:[4]});f.window.siegeHydrology.engineLoaded();await f.mounted.onLocated({lat:24,lon:121},null);assert.deepEqual(f.assets,[routing,asset(4)]);assert.equal(f.evaluations,2);
});
test('region 3 uses only its supplied continental asset',async()=>{
 const f=fixture({regions:[3]});f.window.siegeHydrology.engineLoaded();await f.mounted.onLocated({lat:60,lon:100},null);assert.deepEqual(f.assets,[routing,asset(3)]);assert.equal(f.evaluations,2);assert.equal(f.selections.length,1);
});
test('containing catchment wins over a lower-COMID nearby candidate',async()=>{
 const f=fixture({features:[feature(1,false),feature(2,true)]});f.window.siegeHydrology.engineLoaded();await f.mounted.onLocated({lat:-26.5,lon:31.4},null);assert.deepEqual(f.selections,['MERIT-Basins: 2']);
});
test('30 m fallback selects a stable lowest COMID without clipping geometry',async()=>{
 const f=fixture({features:[feature(9,false),feature(2,false)]});f.window.siegeHydrology.engineLoaded();await f.mounted.onLocated({lat:-26.5,lon:31.4},null);assert.deepEqual(f.selections,['MERIT-Basins: 2']);assert.deepEqual(JSON.parse(JSON.stringify(f.window.aoi.siegLocalGeometry)),polygon);
});
test('regional seams merge only filtered subsets, never complete continental tables',async()=>{
 const f=fixture({regions:[1,2]});f.window.siegeHydrology.engineLoaded();await f.mounted.onLocated({lat:35,lon:0},null);assert.deepEqual(f.assets,[routing,asset(1),asset(2)]);assert.equal(f.evaluations,2);
});
test('repeat point inside cached full polygon performs no extra EE lookup',async()=>{
 const f=fixture();f.window.siegeHydrology.engineLoaded();await f.mounted.onLocated({lat:-26.5,lon:31.4},null);await f.mounted.onLocated({lat:-26.51,lon:31.41},null);assert.equal(f.evaluations,2);assert.equal(f.selections.length,2);
});
test('cached point-in-polygon respects holes and multipart geometry',async()=>{
 const shape={type:'MultiPolygon',coordinates:[[[[30,-28],[33,-28],[33,-25],[30,-25],[30,-28]],[[31,-27],[32,-27],[32,-26],[31,-26],[31,-27]]],[[[40,-28],[41,-28],[41,-27],[40,-27],[40,-28]]]]};
 const f=fixture({features:[feature(1,true,shape)]});f.window.siegeHydrology.engineLoaded();await f.mounted.onLocated({lat:-27.5,lon:30.5},null);await f.mounted.onLocated({lat:-27.5,lon:40.5},null);assert.equal(f.evaluations,2,'Multipart interior reuses geometry');await f.mounted.onLocated({lat:-26.5,lon:31.5},null);assert.equal(f.evaluations,4,'Hole does not reuse cached catchment');
});
test('L9 overview remains map-only and preserves local analysis area',async()=>{
 const f=fixture();f.window.siegeHydrology.engineLoaded();await f.mounted.onLocated({lat:-26.5,lon:31.4},null);const aoi=f.window.aoi;await f.node('hydroOverview').onclick();assert.ok(f.assets.includes('WWF/HydroSHEDS/v1/Basins/hybas_9'));assert.equal(f.window.aoi,aoi);await f.node('hydroOverview').onclick();assert.equal(f.window.aoi,aoi);assert.equal(f.overviews.at(-1),null);
});
test('missing setup requests another location without silently substituting L9',async()=>{
 const f=fixture({responder:async()=>({ok:true,json:async()=>({assets:{}})})});f.window.siegeHydrology.engineLoaded();await f.mounted.onLocated({lat:0,lon:0},null);assert.equal(f.evaluations,0);assert.match(f.node('hydroBasinStatus').textContent,/Try another location/);assert(!f.assets.includes('WWF/HydroSHEDS/v1/Basins/hybas_9'));assert.equal(f.window.siegeHydrology.canAnalyse(),false);
});
test('late configuration cannot overwrite uploaded boundary',async()=>{
 let release;const f=fixture({responder:()=>new Promise(r=>{release=r})});f.window.siegeHydrology.engineLoaded();const pending=f.mounted.onLocated({lat:10,lon:20},null);f.window.SiegAreaSection.complete=true;release({ok:true,json:async()=>({assets:configured,routingAsset:routing})});await pending;assert.equal(f.evaluations,0);assert.equal(f.selections.length,0);
});
test('empty local results remain unavailable, not an arbitrary distant catchment',async()=>{
 const f=fixture({features:[]});f.window.siegeHydrology.engineLoaded();await f.mounted.onLocated({lat:0,lon:0},null);assert.equal(f.window.siegeHydrology.canAnalyse(),false);assert.match(f.node('hydroBasinStatus').textContent,/No local catchment/);
});
test('navigation permits all configured tables and the regional index, accepts supplied region 3 and rejects unrelated assets',()=>{
 const context={};vm.createContext(context);vm.runInContext(fs.readFileSync('worker/usage.js','utf8'),context);
 const body=id=>({functionInvocationValue:{functionName:'Collection.loadTable',arguments:{tableId:{constantValue:id}}}});
 for(const id of Object.values(configured))assert.equal(context.usageNavigation(body(id),{}),true);
 assert.equal(context.usageNavigation(body(routing),{}),true);assert.equal(context.usageNavigation(body(asset(3)),{}),true);assert.equal(context.usageNavigation(body(asset(1)+'/other'),{}),false);
 assert.equal(context.usageNavigation(body(asset(4)),{GEE_MERIT_BASINS_ASSETS:JSON.stringify({4:asset(4)})}),true);
 assert.equal(context.usageNavigation(body(asset(1)),{GEE_MERIT_BASINS_ASSETS:'invalid'}),false);
 const conditional={functionInvocationValue:{functionName:'If',arguments:{condition:{constantValue:1},trueCase:body(asset(1)),falseCase:body(asset(2))}}};assert.equal(context.usageNavigation(conditional,{}),true);
});
for(const [area,expected]of [[15,false],[5,true]])test('automatic '+area+' km² catchment retains its full outline and cap enforcement',async()=>{
 const code=fs.readFileSync('hydrology/assets/dashboard.js','utf8'),start=code.indexOf('async function selectRegion('),end=code.indexOf('// 8. LOAD',start),selected={siegLocalGeometry:{area}},value='MERIT-Basins: 123';let outlines=0,authorisations=0;
 const window={hydroMapBridge:{area:async()=>outlines++},SiegeUsage:{adminMode:()=> 'restricted',ensure:async()=>{authorisations++;return true}},SiegAOIUpload:{area:g=>g.area,limitKm2:()=>5},SiegAreaSection:{ready(){}}};
 const context={window,countryName:'Country',country:{},regionFeatures:{[value]:selected},basinLabels:{[value]:123},areaRequest:0,selectedBasin:null,reservoirAreaSelected:false,analysisCaption:{setValue(){}},drawing:{layers:()=>({reset(){}})},map:{centerObject(){}},rebuild(){}};vm.createContext(context);vm.runInContext(code.slice(start,end),context);await context.selectRegion(value);assert.equal(outlines,1);assert.equal(authorisations,expected?1:0);assert.equal(context.selectedBasin,expected?value:null);
});
test('source route returns the exact nine supplied assets and validates overrides',async()=>{
 const context={URL,Response,response:data=>Response.json(data)};vm.createContext(context);vm.runInContext(fs.readFileSync('worker/usage.js','utf8'),context);vm.runInContext(fs.readFileSync('worker/index.js','utf8').replace('export default','globalThis.app='),context);
 const source=await(await context.app.fetch(new Request('https://sieg.test/api/hydrology/basin-source'),{})).json();assert.deepEqual(source.assets,configured);assert.equal(source.routingAsset,routing);assert.equal(source.radiusMetres,30);
 assert.equal(Object.keys(context.hydroBasinAssets({GEE_MERIT_BASINS_ASSETS:'invalid'})).length,0);assert.equal(context.hydroBasinAsset({GEE_MERIT_BASINS_ASSET:'https://invalid.test/table'}),null);
});
