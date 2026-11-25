export function rasterGrid(directory,pixelIsPoint=false){
 const t=directory.ModelTransformation,s=directory.ModelPixelScale,g=directory.ModelTiepoint;
 let a,b,c,d,e,f;
 if(t?.length===16&&t[12]===0&&t[13]===0&&t[15]===1){[a,b,,c,d,e,,f]=t;}
 else if(!t&&s?.length>=2&&s[0]>0&&s[1]>0&&g?.length>=6){a=s[0];b=d=0;e=-s[1];c=g[3]-a*g[0];f=g[4]-e*g[1];}
 else throw Error('The GeoTIFF needs a supported affine grid (scale and tie point, or a transformation matrix).');
 const det=a*e-b*d;
 if(![a,b,c,d,e,f,det].every(Number.isFinite)||det===0)throw Error('Invalid raster grid.');
 const offset=pixelIsPoint ? .5 : 0;
 return (x,y)=>[offset+(e*(x-c)-b*(y-f))/det,offset+(-d*(x-c)+a*(y-f))/det];
}
const ringContains=([x,y],ring)=>{
 let hit=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){
  const [a,b]=ring[i],[c,d]=ring[j];if((b>y)!==(d>y)&&x<(c-a)*(y-b)/(d-b)+a)hit=!hit;
 }return hit;
};
export function joinRaster(input,{width,height,values,nodata,project,grid,field,statistic}){
 if(!/^[A-Za-z_][A-Za-z0-9_]{0,39}$/.test(field))throw Error('Enter an attribute name with up to 40 letters, numbers or underscores, starting with a letter or underscore.');
 if(!['mean','mode','min','max'].includes(statistic))throw Error('Choose a valid statistic.');
 const features=input?.type==='FeatureCollection'?input.features:input?.type==='Feature'?[input]:[{type:'Feature',properties:{},geometry:input}];
 if(!Array.isArray(features)||!features.length||features.length>20000)throw Error('Use a vector layer with 1–20,000 features.');
 let visits=0,vertices=0,matched=0;
 const sample=(x,y)=>{
  const i=Math.floor(x),j=Math.floor(y);
  if(i<0||i>=width||j<0||j>=height)return null;
  const n=values[j*width+i];return Number.isFinite(n)&&n!==nodata?n:null;
 };
 const xy=p=>{
  if(!Array.isArray(p)||!Number.isFinite(p[0])||!Number.isFinite(p[1])||Math.abs(p[0])>180||Math.abs(p[1])>90)throw Error('Use WGS 84 vector coordinates or upload a shapefile with its .prj.');
  if(++vertices>300000)throw Error('Use up to 300,000 vector vertices.');
  const q=grid(...project(p[0],p[1]));if(!q.every(Number.isFinite))throw Error('Could not transform vector coordinates to the raster grid. Check both coordinate systems.');
  return q;
 };
 function midpoint(line){
  const p=line.map(xy);if(!p.length)return null;
  const lengths=[];let total=0;
  for(let i=1;i<p.length;i++){const n=Math.hypot(p[i][0]-p[i-1][0],p[i][1]-p[i-1][1]);lengths.push(n);total+=n;}
  if(!total)return sample(...p[0]);
  let remain=total/2;
  for(let i=0;i<lengths.length;i++){const n=lengths[i];if(n&&remain<=n){const t=remain/n;return sample(p[i][0]*(1-t)+p[i+1][0]*t,p[i][1]*(1-t)+p[i+1][1]*t);}remain-=n;}
  return sample(...p.at(-1));
 }
 function aggregate(consume){
  let count=0,result=0,bestCount=0;const counts=statistic==='mode'?new Map():null;
  consume(v=>{
   if(v===null)return;
   if(statistic==='mean')result+=(v-result)/(count+1);
   else if(statistic==='min')result=count?Math.min(result,v):v;
   else if(statistic==='max')result=count?Math.max(result,v):v;
   else{const n=(counts.get(v)||0)+1;counts.set(v,n);if(counts.size>100000)throw Error('Too many unique values for mode. Use mean, minimum or maximum.');if(n>bestCount||(n===bestCount&&v<result)){result=v;bestCount=n;}}
   count++;
  });
  return count&&Number.isFinite(result)?result:null;
 }
 function polygonSamples(poly,emit){
  const rings=poly.map(r=>r.map(xy)),outer=rings[0];
  if(!outer?.length)return;
  const holes=rings.slice(1);
  let x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity;
  for(const [x,y] of outer){x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y);}
  const l=Math.max(0,Math.ceil(x0-.5)),r=Math.min(width-1,Math.floor(x1-.5)),t=Math.max(0,Math.ceil(y0-.5)),b=Math.min(height-1,Math.floor(y1-.5));
  if(l>r||t>b)return;
  if((visits+=(r-l+1)*(b-t+1)*rings.reduce((n,ring)=>n+ring.length,0))>60000000)throw Error('Polygon sampling exceeds the processing limit. Clip the raster or split the vector layer.');
  for(let y=t;y<=b;y++)for(let x=l;x<=r;x++){const p=[x+.5,y+.5];if(ringContains(p,outer)&&!holes.some(r=>ringContains(p,r)))emit(sample(...p));}
 }
 function value(g){
  const c=g?.coordinates;
  if(!g)return null;
  if(g.type==='Point')return sample(...xy(c));
  if(g.type==='LineString')return midpoint(c);
  if(g.type==='MultiPoint')return aggregate(emit=>c.forEach(p=>emit(sample(...xy(p)))));
  if(g.type==='MultiLineString')return aggregate(emit=>c.forEach(l=>emit(midpoint(l))));
  if(g.type==='Polygon')return aggregate(emit=>polygonSamples(c,emit));
  if(g.type==='MultiPolygon')return aggregate(emit=>c.forEach(p=>polygonSamples(p,emit)));
  throw Error('Use point, line or polygon features. Geometry collections are not supported.');
 }
 const output=features.map(f=>{
  const properties=f.properties||{};
  if(Object.hasOwn(properties,field))throw Error('An attribute named '+field+' already exists. Choose a new name.');
  const v=value(f.geometry);if(v!==null)matched++;
  return {...f,properties:{...properties,[field]:v}};
 });
 return {data:{type:'FeatureCollection',features:output},matched,total:output.length};
}
