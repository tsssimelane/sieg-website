/* Retrieve only precomputed MERIT river reaches intersecting the selected catchment.
   Cache completed clipped networks; never retain in-flight Earth Engine work across sessions. */
(function(root){'use strict';
const assets=Object.fromEntries(Array.from({length:9},(_,i)=>[String(i+1),'projects/ee-gee023/assets/riv_pfaf_'+(i+1)+'_MERIT_Hydro_v07_Basins_v01']));
const routing='WWF/HydroSHEDS/v1/Basins/hybas_1',cache=new Map(),maximum=10000;
function geometryOf(fc){if(fc?.type==='Feature')return fc.geometry;if(fc?.type==='FeatureCollection'){const coordinates=fc.features.flatMap(f=>f.geometry?.type==='Polygon'?[f.geometry.coordinates]:f.geometry?.type==='MultiPolygon'?f.geometry.coordinates:[]);return coordinates.length===1?{type:'Polygon',coordinates:coordinates[0]}:{type:'MultiPolygon',coordinates};}return fc;}
function lines(g){if(g?.type==='LineString')return g.coordinates?.length>1?[g.coordinates]:[];if(g?.type==='MultiLineString')return g.coordinates.filter(r=>r.length>1);if(g?.type==='GeometryCollection')return g.geometries.flatMap(lines);return [];}
function classify(features,stream,river){const rivers=[],streams=[];for(const f of features){const segments=lines(f.geometry);if(!segments.length)continue;const v=f.properties?.uparea,up=v==null?null:Number(v),group=Number.isFinite(up)?up>=river?'river':up>=stream?'stream':null:'river';if(!group)continue;const item={type:'Feature',properties:{...f.properties,class:group},geometry:segments.length===1?{type:'LineString',coordinates:segments[0]}:{type:'MultiLineString',coordinates:segments}};(group==='stream'?streams:rivers).push(item);}return {rivers:{type:'FeatureCollection',features:rivers},streams:{type:'FeatureCollection',features:streams}};}
async function load(boundary,{ee,evaluate,streamKm2=1,riverKm2=10,allReaches=false}){
 const g=geometryOf(boundary);if(!['Polygon','MultiPolygon'].includes(g?.type))throw Error('A complete catchment boundary is required.');
 if(!(streamKm2>0&&riverKm2>streamKm2))throw Error('River threshold must exceed the positive stream threshold.');
 const key=JSON.stringify(g);let data=cache.get(key);
 if(!data){
  const geom=ee.Geometry(g),regions=await evaluate(ee.FeatureCollection(routing).filterBounds(geom).aggregate_array('PFAF_ID').distinct());const codes=[...new Set((regions||[]).map(x=>String(x).slice(0,1)))].filter(c=>assets[c]);
  if(!codes.length)throw Error('No MERIT river region intersects the catchment.');
  const collections=codes.map(code=>ee.FeatureCollection(assets[code]).filterBounds(geom));
  const local=collections.slice(1).reduce((a,b)=>a.merge(b),collections[0]);
  // Limit the filtered set before clipping; never run a raster or global merge.
  const clipped=local.limit(maximum+1).map(f=>ee.Feature(f).setGeometry(ee.Feature(f).geometry().intersection(geom,ee.ErrorMargin(1))));
  const fc=await evaluate(clipped);if(!Array.isArray(fc?.features))throw Error('MERIT river data did not return features.');if(fc.features.length>maximum)throw Error('Catchment contains too many reaches for the interactive export. Select a smaller catchment.');
  data={features:fc.features,assets:codes.map(c=>assets[c])};cache.set(key,data);if(cache.size>8)cache.delete(cache.keys().next().value);
 }
 if(allReaches){return {reaches:{type:"FeatureCollection",features:data.features.flatMap(f=>{const segments=lines(f.geometry);return segments.length?[{type:"Feature",properties:f.properties,geometry:segments.length===1?{type:"LineString",coordinates:segments[0]}:{type:"MultiLineString",coordinates:segments}}]:[];})},assets:data.assets};}
 return {...classify(data.features,streamKm2,riverKm2),assets:data.assets};
}
root.SiegMeritRivers={assets,geometryOf,classify,load};if(typeof module!=='undefined')module.exports=root.SiegMeritRivers;
})(typeof window==='undefined'?globalThis:window);
