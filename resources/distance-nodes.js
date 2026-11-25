const R=6371008.8,rad=Math.PI/180;
const vector=([x,y])=>[Math.cos(y*rad)*Math.cos(x*rad),Math.cos(y*rad)*Math.sin(x*rad),Math.sin(y*rad)];
export function distanceNodes(input,interval,unit,includeEnd=true){
 const step=interval*({m:1,km:1000}[unit]);
 if(!Number.isFinite(step)||step<=0)throw Error('Enter a positive spacing.');
 const features=[];let lines=0,vertices=0;
 function addLine(coords,props,index,part){
  if(!Array.isArray(coords)||coords.length<2||coords.some(p=>!Array.isArray(p)||!Number.isFinite(p[0])||!Number.isFinite(p[1])||Math.abs(p[0])>180||Math.abs(p[1])>90))throw Error('Use valid WGS 84 line coordinates.');
  if((vertices+=coords.length)>100000)throw Error('Use up to 100,000 line vertices.');
  const segments=[];let total=0,counter=0;
  for(let i=1;i<coords.length;i++){
   const a=vector(coords[i-1]),b=vector(coords[i]),dot=a.reduce((s,v,k)=>s+v*b[k],0);
   const angle=2*Math.asin(Math.min(1,Math.hypot(...a.map((v,k)=>v-b[k]))/2));
   if(angle<1e-12)continue;
   if(dot<-.9999999999)throw Error('A segment spans nearly opposite points on Earth. Split it before processing.');
   segments.push({a,b,angle,start:total});total+=R*angle;
  }
  if(!segments.length)return;
  if(total/step>50000||features.length+Math.floor(total/step)+1>50000)throw Error('More than 50,000 nodes. Increase spacing or split the file.');
  lines++;
  const emit=(p,d)=>{if(features.length>=50000)throw Error('More than 50,000 nodes. Increase spacing or split the file.');features.push({type:'Feature',properties:{...props,line_index:index,part_index:part,node_index:++counter,distance_m:d,distance:d/(unit==='km'?1000:1),unit},geometry:{type:'Point',coordinates:p.slice(0,2)}});};
  emit(coords[0],0);
  let s=0,k=1;const eps=1e-6;
  for(;k*step<=total+eps;k++){
   const d=Math.min(k*step,total);
   if(total-d<=eps){emit(coords.at(-1),total);return;}
   while(s+1<segments.length&&d>=segments[s+1].start)s++;
   const {a,b,angle,start}=segments[s],t=(d-start)/(R*angle);
   const v=a.map((x,i)=>Math.sin((1-t)*angle)*x+Math.sin(t*angle)*b[i]);
   emit([Math.atan2(v[1],v[0])/rad,Math.atan2(v[2],Math.hypot(v[0],v[1]))/rad],d);
  }
  if(includeEnd)emit(coords.at(-1),total);
 }
 const inputs=input?.type==='FeatureCollection'?input.features:input?.type==='Feature'?[input]:[{geometry:input}];
 if(!Array.isArray(inputs))throw Error('Invalid line collection.');
 inputs.forEach((f,i)=>{
  const g=f?.geometry;
  if(g?.type==='LineString')addLine(g.coordinates,f.properties,i+1,1);
  else if(g?.type==='MultiLineString'&&Array.isArray(g.coordinates))g.coordinates.forEach((p,j)=>addLine(p,f.properties,i+1,j+1));
  else throw Error('Upload a line layer containing LineString or MultiLineString features.');
 });
 if(!lines)throw Error('No nonzero-length lines found.');
 return {lines,data:{type:'FeatureCollection',features}};
}
