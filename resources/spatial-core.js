export function smoothLines(input,passes){
 if(![1,2,3].includes(passes))throw Error('Choose one to three smoothing passes.');
 let lines=0,vertices=0;
 function line(p){
  if(!Array.isArray(p)||p.length<2||p.some(a=>!Array.isArray(a)||a.length<2||a.length>3||a.length!==p[0].length||!a.every(Number.isFinite)))throw Error('Each line needs at least two valid coordinates of matching dimensions.');
  vertices+=p.length;if(vertices>25000)throw Error('Use up to 25,000 input vertices per run.');
  if(p.some((a,i)=>i&&Math.abs(a[0]-p[i-1][0])>180))throw Error('Split lines at the international date line before smoothing.');
  const closed=p.length>=4&&p[0].every((v,i)=>v===p.at(-1)[i]);lines++;
  for(let pass=0;pass<passes;pass++){
   const next=closed?[]:[p[0]];
   for(let i=1;i<p.length;i++){
    const a=p[i-1],b=p[i];
    next.push(a.map((v,k)=>.75*v+.25*b[k]),a.map((v,k)=>.25*v+.75*b[k]));
   }
   next.push(closed?next[0]:p.at(-1));p=next;
  }return p;
 }
 function geometry(g){
  if(g?.type==='LineString')return {type:g.type,coordinates:line(g.coordinates)};
  if(g?.type==='MultiLineString'&&Array.isArray(g.coordinates))return {type:g.type,coordinates:g.coordinates.map(line)};
  throw Error('Choose a line layer containing only LineString or MultiLineString geometry.');
 }
 function feature(f){if(f?.type!=='Feature')throw Error('Invalid GeoJSON feature.');const {bbox,...data}=f;return {...data,geometry:geometry(f.geometry)};}
 const data=input?.type==='FeatureCollection'&&Array.isArray(input.features)?{type:input.type,features:input.features.map(feature)}:input?.type==='Feature'?feature(input):geometry(input);
 if(!lines)throw Error('No lines found.');
 return {data,lines,vertices};
}

// Least-squares affine fit using centered pixel and ground coordinates.
export function fitControlPoints(points){
 if(points.length<3)throw Error('Add at least three control points.');
 const mean=k=>points.reduce((s,p)=>s+p[k],0)/points.length;
 const px=mean('x'),py=mean('y'),lon=mean('lon'),lat=mean('lat');
 let xx=0,xy=0,yy=0,xl=0,yl=0,xt=0,yt=0;
 for(const p of points){
  const x=p.x-px,y=p.y-py,l=p.lon-lon,t=p.lat-lat;
  xx+=x*x;xy+=x*y;yy+=y*y;xl+=x*l;yl+=y*l;xt+=x*t;yt+=y*t;
 }
 const det=xx*yy-xy*xy;
 if(!(det>1e-10*(xx+yy)**2))throw Error('Spread the control points across the image so they do not lie on one line.');
 const A=(yy*xl-xy*yl)/det,B=(xx*yl-xy*xl)/det,D=(yy*xt-xy*yt)/det,E=(xx*yt-xy*xt)/det;
 if(!(Math.abs(A*E-B*D)>1e-10*Math.hypot(A,B)*Math.hypot(D,E)))throw Error('The ground coordinates do not define an area. Check the control points.');
 const C=lon-A*px-B*py,F=lat-D*px-E*py;
 const rms=Math.sqrt(points.reduce((sum,p)=>sum+((A*p.x+B*p.y+C-p.lon)*Math.cos(p.lat*Math.PI/180)*111195)**2+((D*p.x+E*p.y+F-p.lat)*111195)**2,0)/points.length);
 return {world:[A,D,B,E,C,F],rms};
}
