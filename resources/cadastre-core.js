// Polygonize a small boundary network in a local metre grid, without server uploads.
export function polygonize(input,tolerance=0){
 if(!Number.isFinite(tolerance)||tolerance<0||tolerance>100)throw Error('Enter a snap tolerance between 0 and 100 metres.');
 const lines=[];let segmentCount=0;
 function read(g){
  if(g?.type==='FeatureCollection'){if(!Array.isArray(g.features))throw Error('Invalid FeatureCollection.');g.features.forEach(read);}
  else if(g?.type==='Feature')read(g.geometry);
  else if(g?.type==='MultiLineString'){if(!Array.isArray(g.coordinates))throw Error('Invalid MultiLineString.');g.coordinates.forEach(coordinates=>read({type:'LineString',coordinates}));}
  else if(g?.type==='LineString'){
   const l=g.coordinates;if(!Array.isArray(l)||l.length<2||l.some(p=>!Array.isArray(p)||!Number.isFinite(p[0])||!Number.isFinite(p[1])||Math.abs(p[0])>180||Math.abs(p[1])>=89))throw Error('Use valid WGS 84 line coordinates away from the poles.');
   segmentCount+=l.length-1;if(segmentCount>7000)throw Error('Limit each run to 7,000 line segments. Process larger datasets in smaller sections.');lines.push(l);
  }else throw Error('Use a line layer containing LineString or MultiLineString features.');
 }
 read(input);if(!lines.length)throw Error('The file contains no lines.');
 const origin=lines[0][0],scaleY=111195,scaleX=scaleY*Math.cos(origin[1]*Math.PI/180);
 const eps=1e-5,grid=1e4,xy=p=>[(p[0]-origin[0])*scaleX,(p[1]-origin[1])*scaleY],ll=p=>[origin[0]+p[0]/scaleX,origin[1]+p[1]/scaleY];
 if(lines.some(l=>l.some(p=>Math.abs(p[0]-origin[0])>10||Math.abs(p[1]-origin[1])>5)))throw Error('Use one local cadastral area at a time. Split data spanning large areas or crossing the date line.');
 const vertices=[],byKey=new Map(),edges=[];
 const report={inputSegments:segmentCount,snapped:0,splitEdges:0,duplicates:0,collapsed:0,unusedEdges:0,polygons:0};
 function key(p){return p.map(n=>Math.round(n*grid)).join(',');}
 function vertex(p){const k=key(p);if(!byKey.has(k)){byKey.set(k,vertices.length);vertices.push({p,end:false});}return byKey.get(k);}
 for(const l of lines){const ids=l.map(p=>vertex(xy(p)));vertices[ids[0]].end=vertices[ids.at(-1)].end=true;for(let i=1;i<ids.length;i++)edges.push([ids[i-1],ids[i]]);}
 const delta=(a,b)=>[a[0]-b[0],a[1]-b[1]],dot=(a,b)=>a[0]*b[0]+a[1]*b[1],cross=(a,b)=>a[0]*b[1]-a[1]*b[0];
 const at=(a,d,t)=>[a[0]+d[0]*t,a[1]+d[1]*t],d2=(a,b)=>{const d=delta(a,b);return dot(d,d);};
 if(tolerance>0){
  // Use one stable representative per cluster; avoid chaining beyond the tolerance.
  const anchors=[],mapped=[];
  vertices.forEach((v,i)=>{
   let best=i,min=tolerance**2;
   for(const j of anchors){const other=vertices[j];if(!v.end&&!other.end)continue;const d=d2(v.p,other.p);if(d<=min){min=d;best=j;}}
   mapped[i]=best;if(best===i)anchors.push(i);else{vertices[best].end||=v.end;report.snapped++;}
  });
  for(const e of edges){e[0]=mapped[e[0]];e[1]=mapped[e[1]];}
  // Snap open ends to the interior of another segment (undershoots).
  const degree=new Map();for(const [a,b] of edges)if(a!==b){degree.set(a,(degree.get(a)||0)+1);degree.set(b,(degree.get(b)||0)+1);}
  const targets=new Map();
  for(const [i,deg] of degree){if(deg!==1)continue;const p=vertices[i].p;let min=tolerance**2,best;
   for(const [j,k] of edges){if(i===j||i===k||j===k)continue;const q=vertices[j].p,d=delta(vertices[k].p,q),len=dot(d,d);if(!len)continue;const t=dot(delta(p,q),d)/len;if(t<=0||t>=1)continue;const point=at(q,d,t),dist=d2(p,point);if(dist<=min){min=dist;best=point;}}
   if(best&&min>eps**2)targets.set(i,best);
  }
  for(const [i,p] of targets){vertices[i].p=p;report.snapped++;}
 }
 const segments=[];
 for(const [i,j] of edges){const a=vertices[i].p,b=vertices[j].p,d=delta(b,a),len=dot(d,d);if(len<eps**2){report.collapsed++;continue;}segments.push({a,b,d,len,cuts:new Set([0,1])});}
 let cuts=0;
 function cut(s,t){if(t>eps/Math.sqrt(s.len)&&t<1-eps/Math.sqrt(s.len)){s.cuts.add(t);if(++cuts>40000)throw Error('Too many intersections. Split the dataset into smaller sections.');}}
 // Compare only segments with overlapping bounding boxes.
 const ordered=segments.map(s=>({s,minX:Math.min(s.a[0],s.b[0]),maxX:Math.max(s.a[0],s.b[0]),minY:Math.min(s.a[1],s.b[1]),maxY:Math.max(s.a[1],s.b[1])})).sort((a,b)=>a.minX-b.minX);
 for(let i=0;i<ordered.length;i++)for(let j=i+1;j<ordered.length;j++){
  const a=ordered[i],b=ordered[j];
  if(b.minX>a.maxX+eps)break;
  if(a.maxY+eps<b.minY||b.maxY+eps<a.minY)continue;
  const s=a.s,q=b.s;
  const offset=delta(q.a,s.a),den=cross(s.d,q.d);
  if(Math.abs(den)>1e-12*Math.sqrt(s.len*q.len)){
   const t=cross(offset,q.d)/den,u=cross(offset,s.d)/den,e=eps/Math.sqrt(s.len),f=eps/Math.sqrt(q.len);
   if(t>=-e&&t<=1+e&&u>=-f&&u<=1+f){cut(s,t);cut(q,u);}
  }else if(Math.abs(cross(offset,s.d))<=eps*Math.sqrt(s.len)){
   for(const p of [q.a,q.b])cut(s,dot(delta(p,s.a),s.d)/s.len);
   for(const p of [s.a,s.b])cut(q,dot(delta(p,q.a),q.d)/q.len);
  }
 }
 const points=[],nodes=new Map(),adj=[],links=[],unique=new Set();
 function node(p){const k=key(p);if(!nodes.has(k)){nodes.set(k,points.length);points.push(k.split(',').map(n=>Number(n)/grid));adj.push([]);}return nodes.get(k);}
 for(const s of segments){const ts=[...s.cuts].sort((a,b)=>a-b);let from=node(s.a);
  for(const t of ts.slice(1)){const to=node(at(s.a,s.d,t));if(from===to)continue;const k=Math.min(from,to)+':'+Math.max(from,to);if(unique.has(k))report.duplicates++;else{unique.add(k);adj[from].push(links.length);links.push({from,to});adj[to].push(links.length);links.push({from:to,to:from});}from=to;}
  if(ts.length>2)report.splitEdges++;
 }
 // Bridges are edges that do not bound a face (including dangling branches).
 const entered=[],low=[],bridges=new Set();let clock=0;
 for(let i=0;i<points.length;i++){
  if(entered[i])continue;entered[i]=low[i]=++clock;const stack=[{v:i,parent:-1,next:0}];
  while(stack.length){const f=stack.at(-1);if(f.next===adj[f.v].length){stack.pop();if(f.parent>=0){const p=links[f.parent].from;low[p]=Math.min(low[p],low[f.v]);if(low[f.v]>entered[p])bridges.add(f.parent>>1);}continue;}
   const id=adj[f.v][f.next++];if(f.parent>=0&&id===(f.parent^1))continue;const v=links[id].to;
   if(entered[v])low[f.v]=Math.min(low[f.v],entered[v]);else{entered[v]=low[v]=++clock;stack.push({v,parent:id,next:0});}
  }
 }
 report.unusedEdges=bridges.size;
 const angle=id=>{const {from,to}=links[id],d=delta(points[to],points[from]);return Math.atan2(d[1],d[0]);};
 const slots=[];adj.forEach((a,i)=>{adj[i]=a.filter(id=>!bridges.has(id>>1)).sort((a,b)=>angle(a)-angle(b));adj[i].forEach((id,j)=>slots[id]=j);});
 const visited=new Set(),faces=[],outside=[];
 function ringsOf(walk){const path=[],seen=new Map(),rings=[];for(const id of [...walk,walk[0]]){if(seen.has(id)){const start=seen.get(id),part=path.slice(start);if(part.length>=3){const ring=part.map(i=>points[i]),o=ring[0];let area=0;for(let j=1;j<ring.length-1;j++)area+=cross(delta(ring[j],o),delta(ring[j+1],o))/2;if(Math.abs(area)>eps**2){ring.push(o);rings.push({ring,area,holes:[]});}}for(const v of path.splice(start+1))seen.delete(v);}
 else{seen.set(id,path.length);path.push(id);}}return rings;}
 function inside(p,ring){let hit=false;for(let i=1;i<ring.length;i++){const a=ring[i-1],b=ring[i];if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])hit=!hit;}return hit;}
 for(let i=0;i<links.length;i++){
  if(visited.has(i)||bridges.has(i>>1))continue;let h=i;const walk=[];
  while(!visited.has(h)){visited.add(h);const {from,to}=links[h],a=adj[to];walk.push(from);h=a[(slots[h^1]+a.length-1)%a.length];}
  if(h!==i||walk.length<3)continue;const rings=ringsOf(walk),positive=rings.filter(r=>r.area>0).sort((a,b)=>a.area-b.area);
  faces.push(...positive);
  for(const hole of rings.filter(r=>r.area<0)){
   const parent=positive.find(f=>f.area+hole.area>eps**2&&hole.ring.some(p=>inside(p,f.ring)));
   if(parent)parent.holes.push(hole.ring);else outside.push(hole);
  }
 }
 faces.sort((a,b)=>a.area-b.area);
 for(const hole of outside){
  const parent=faces.find(f=>f.area+hole.area>eps**2&&hole.ring.slice(0,-1).every(p=>inside(p,f.ring))&&!f.holes.some(r=>hole.ring.every(p=>inside(p,r))));
  if(parent)parent.holes.push(hole.ring);
 }
 const polygons={type:'FeatureCollection',features:faces.map((f,i)=>({type:'Feature',properties:{parcel_id:i+1},geometry:{type:'Polygon',coordinates:[f.ring,...f.holes].map(r=>r.map(ll))}}))};
 const issues={type:'FeatureCollection',features:[...bridges].map(i=>{const {from,to}=links[i*2];return {type:'Feature',properties:{issue:'Unused open or connecting edge'},geometry:{type:'LineString',coordinates:[ll(points[from]),ll(points[to])]}};})};
 report.polygons=polygons.features.length;
 return {polygons,issues,report};
}
