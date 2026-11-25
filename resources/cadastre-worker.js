import {polygonize} from './cadastre-core.js?v=7000';

function checkZip(buffer){
 const v=new DataView(buffer),decoder=new TextDecoder();let end=-1;
 for(let i=v.byteLength-22;i>=Math.max(0,v.byteLength-65557);i--)if(v.getUint32(i,true)===0x06054b50&&i+22+v.getUint16(i+20,true)===v.byteLength){end=i;break;}
 if(end<0)throw Error('The shapefile ZIP could not be read.');
 const count=v.getUint16(end+10,true),limit=30*1024*1024,names=new Map();
 let p=v.getUint32(end+16,true),total=0;
 if(count>100||p>end)throw Error('Use a ZIP containing one shapefile.');
 for(let i=0;i<count;i++){
  if(p+46>end||v.getUint32(p,true)!==0x02014b50)throw Error('Invalid shapefile ZIP directory.');
  const length=v.getUint16(p+28,true),size=v.getUint32(p+24,true);
  if(p+46+length>end||(total+=size)>limit)throw Error('Expanded ZIP must be 30 MB or smaller.');
  const name=decoder.decode(new Uint8Array(buffer,p+46,length)).toLowerCase();
  names.set(name,size);p+=46+length+v.getUint16(p+30,true)+v.getUint16(p+32,true);
 }
 const shapes=[...names.keys()].filter(n=>n.endsWith('.shp')&&!n.startsWith('__macosx/'));
 if(shapes.length!==1||!names.get(shapes[0].slice(0,-4)+'.prj'))throw Error('Include one .shp and its matching .prj file.');
}
self.onmessage=async({data:{file,tolerance}})=>{
 try{
  let input;
  if(/\.zip$/i.test(file.name)){
   const buffer=await file.arrayBuffer();checkZip(buffer);
   // The bundled UMD reader exposes shp on the worker global via globalThis.
   const library=await import('../assets/vendor/shp-6.1.0.js');
   const read=globalThis.shp||library.default;
   if(typeof read!=='function')throw Error('Shapefile reader unavailable. Use GeoJSON.');
   input=await read(buffer);
   if(Array.isArray(input))throw Error('Upload one line layer at a time.');
  }else{
   input=JSON.parse(await file.text());
   const crs=input?.crs?.properties?.name;
   if(crs&&!/(4326|CRS:?84)$/i.test(crs))throw Error('Export GeoJSON in WGS 84 (EPSG:4326) first.');
  }
  self.postMessage(polygonize(input,tolerance));
 }catch(e){self.postMessage({error:e.message||'Could not build polygons.'});}
};
