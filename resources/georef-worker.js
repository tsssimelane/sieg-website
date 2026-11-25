import {readReferenceShapefile} from './reference-shapefile.js';

self.onmessage=async ({data:file})=>{
 try{
  const layer=await readReferenceShapefile(await file.arrayBuffer());
  let count=0;
  function coordinates(p){
   if(!Array.isArray(p)||!p.length)throw Error('The shapefile has invalid coordinates.');
   if(typeof p[0]==='number'){
    if(!Number.isFinite(p[0])||!Number.isFinite(p[1])||Math.abs(p[0])>180||Math.abs(p[1])>85.05)throw Error('Could not place the shapefile on the map. Check its .prj file and coordinates.');
    if(++count>200000)throw Error('Use a smaller reference layer (up to 200,000 vertices).');
    return p.slice(0,2);
   }
   return p.map(coordinates);
  }
  const types=['Point','MultiPoint','LineString','MultiLineString','Polygon','MultiPolygon'];
  const features=layer.features.filter(f=>f.geometry).map(f=>{
   if(!types.includes(f.geometry.type))throw Error('Use a point, line, or polygon shapefile.');
   return {type:'Feature',properties:{},geometry:{type:f.geometry.type,coordinates:coordinates(f.geometry.coordinates)}};
  });
  if(!features.length)throw Error('The shapefile contains no usable geometry.');
  self.postMessage({layer:{type:'FeatureCollection',features}});
 }catch(error){self.postMessage({error:error.message});}
};
