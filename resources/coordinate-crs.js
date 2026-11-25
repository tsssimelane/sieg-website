export function definition(code){
 if(code==='4326'||code==='3857')return 'EPSG:'+code;
 if(/^32[67](0[1-9]|[1-5][0-9]|60)$/.test(code))return '+proj=utm +zone='+Number(code.slice(-2))+(code[2]==='7'?' +south':'')+' +datum=WGS84 +units=m +no_defs';
 throw Error('Use EPSG 4326, 3857, or a WGS 84 UTM code (32601–32660 or 32701–32760).');
}
export function coordinateTransform(project,from,to){
 const source=definition(from),target=definition(to),toWgs=project(source,'EPSG:4326'),toTarget=project('EPSG:4326',target);
 return (x,y)=>{
  if(!Number.isFinite(x)||!Number.isFinite(y))return null;
  if(from==='4326'&&(Math.abs(x)>180||Math.abs(y)>90))return null;
  try{
   const [lon,lat]=toWgs.forward([x,y]);
   if(!Number.isFinite(lon)||!Number.isFinite(lat)||Math.abs(lon)>180||Math.abs(lat)>90)return null;
   if(to==='3857'&&Math.abs(lat)>85.051129)return null;
   if(/^32[67]/.test(to)&&(lat< -80||lat>84||(to[2]==='7'?lat>0:lat<0)))return null;
   const p=toTarget.forward([lon,lat]);return p.every(Number.isFinite)?p:null;
  }catch{return null;}
 };
}
