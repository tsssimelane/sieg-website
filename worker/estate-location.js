// geoBoundaries CGAZ ADM0 (CC BY 4.0), indexed from the existing world map.
let estateBoundaryIndex;
function estateJSON(path){return JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(EMBEDDED_FILES[path][1]),c=>c.charCodeAt(0))))}
function estateIndex(){
 if(estateBoundaryIndex)return estateBoundaryIndex;
 const countries=estateJSON('assets/countries-global.json').filter(c=>/^[A-Z]{3}$/.test(c.currency)&&c.currency!=='XXX');
 const lookup=new Map(countries.flatMap(c=>[[c.code,c],[c.iso3,c]]));
 lookup.set('XKX',{...lookup.get('XK'),iso3:'XKX'});
 const rings=estateJSON('talent/world-map.json').flatMap(([id,,,path])=>path.split('M').slice(1).map(s=>{
  const ring=s.slice(0,-1).split(' ').map(p=>p.split(',').map(Number)),xs=ring.map(p=>p[0]),ys=ring.map(p=>p[1]);
  return {id,ring,box:[Math.min(...xs),Math.min(...ys),Math.max(...xs),Math.max(...ys)]};
 }));
 return estateBoundaryIndex={lookup,rings};
}
function estateEdge(p,ring){
 let min=Infinity;
 for(let i=0,j=ring.length-1;i<ring.length;j=i++){
  const a=ring[j],b=ring[i],dx=b[0]-a[0],dy=b[1]-a[1],x=p[0]-a[0],y=p[1]-a[1],t=Math.max(0,Math.min(1,(x*dx+y*dy)/(dx*dx+dy*dy||1)));
  min=Math.min(min,(x-t*dx)**2+(y-t*dy)**2);
 }
 return Math.sqrt(min);
}
async function estateLocation(lat,lon){
 if(![lat,lon].every(Number.isFinite)||Math.abs(lat)>90||Math.abs(lon)>180)throw Error('Capture valid property coordinates.');
 const {lookup,rings}=estateIndex(),point=[360+2*lon,170-2*lat],near=.65,inside=new Set(),nearby=new Set();
 // Check both sides of the date line and use even–odd parity for holes.
 for(const x of [point[0],point[0]-720,point[0]+720]){
  const hits=new Map(),q=[x,point[1]];
  for(const {id,ring,box:[left,top,right,bottom]} of rings){
   if(x<left-near||x>right+near||q[1]<top-near||q[1]>bottom+near)continue;
   if(addressRing(q,ring))hits.set(id,!hits.get(id));
   if(estateEdge(q,ring)<=near)nearby.add(id);
  }
  for(const [id,hit] of hits)if(hit)inside.add(id);
 }
 const solid=inside.size===1&&!nearby.size?lookup.get([...inside][0]):null;
 let match=solid,source='geoBoundaries CGAZ ADM0';
 if(!solid){
  const candidates=[...new Map([...inside,...nearby].map(id=>lookup.get(id)).filter(Boolean).map(c=>[c.code,c])).values()];
  const results=await Promise.allSettled(candidates.map(async c=>(await addressBoundaries(c.iso3,'ADM0')).fc.features.some(f=>addressInside([lon,lat],f.geometry))?c:null));
  const matches=results.flatMap(r=>r.status==='fulfilled'&&r.value?[r.value]:[]);
  if(matches.length!==1||results.some(r=>r.status==='rejected'))throw Error(matches.length>1?'More than one country boundary matches this point. Capture again away from the border.':results.some(r=>r.status==='rejected')?'Country boundaries could not be verified. Try again shortly.':'No country boundary matched. Capture again at the property.');
  match=matches[0];source='geoBoundaries gbOpen ADM0';
 }
 return {countryCode:match.code,country:match.name,currency:match.code==='PS'?'ILS':match.currency,countrySource:source};
}

function estateGPS(point){
 return point?.method==='gps'&&[point.lat,point.lon,point.accuracy].every(Number.isFinite)&&
  Math.abs(point.lat)<=90&&Math.abs(point.lon)<=180&&point.accuracy>0&&point.accuracy<=10;
}
async function estateGPSLocation(point){
 if(!estateGPS(point))throw Error('Capture phone GPS with reported accuracy of 10 m or better.');
 const location=await estateLocation(point.lat,point.lon),country=estateIndex().lookup.get(location.countryCode);
 const {fc}=await addressBoundaries(country.code==='XK'?'XKX':country.iso3,'ADM2');
 const matches=fc.features.filter(f=>addressInside([point.lon,point.lat],f.geometry));
 const admin2=matches[0]?.properties?.shapeName?.trim();
 if(matches.length!==1||!admin2)throw Error(matches.length>1?'This point matches multiple district boundaries. Capture again away from the boundary.':'No geoBoundaries ADM2 district matched this location. Check the GPS point and try again.');
 return {...location,admin2,region:admin2,admin2Id:matches[0].properties.shapeID||null};
}

async function estateReportAreas(country){
 const {fc}=await addressBoundaries(country.code==='XK'?'XKX':country.iso3,'ADM2');
 const areas=new Map();
 for(const {properties:p} of fc.features){
  if(typeof p?.shapeID==='string'&&p.shapeID&&typeof p.shapeName==='string'&&p.shapeName.trim())areas.set(p.shapeID,p.shapeName.trim());
 }
 return [...areas].map(([id,name])=>({id,name})).sort((a,b)=>a.name.localeCompare(b.name));
}

// Only published listings are used. Older listings are sales and use their original region.
async function estateReportRows(env,scope,countOnly=false){
 const district=scope.admin2Id?
  "(json_extract(body_json,'$.data.admin2Id') = ? OR (json_extract(body_json,'$.data.admin2Id') IS NULL AND lower(coalesce(json_extract(body_json,'$.data.admin2'),json_extract(body_json,'$.data.region'))) = lower(?)))":
  "lower(coalesce(json_extract(body_json,'$.data.admin2'),json_extract(body_json,'$.data.region'))) = lower(?)";
 const params=[scope.countryCode,scope.category,scope.transaction,...(scope.admin2Id?[scope.admin2Id]:[]),scope.admin2];
 const where=" FROM siege_records WHERE kind='property' AND state='approved' AND coalesce(json_extract(body_json,'$.data.countryCode'),'SZ')=? AND json_extract(body_json,'$.data.type')=? AND coalesce(json_extract(body_json,'$.data.transaction'),'sale')=? AND "+district;
 if(scope.listing){params.push(scope.listing);}
 const filter=scope.listing?' AND id=?':'';
 if(countOnly)return Number((await env.DB.prepare('SELECT COUNT(*) AS n'+where+filter).bind(...params).first())?.n||0);
 const {results}=await env.DB.prepare('SELECT body_json'+where+filter+' ORDER BY created_at DESC,id DESC LIMIT 101').bind(...params).all();
 return Promise.all(results.map(async r=>opsPublic('property',await estateEnsureReference(env,JSON.parse(r.body_json)))));
}
function estateReportCoordinates(p){if(!Number.isFinite(p.lat)||!Number.isFinite(p.lon)||Math.abs(p.lat)>90||Math.abs(p.lon)>180)return null;return {lat:p.lat.toFixed(6),lon:p.lon.toFixed(6)};}
function estateReportDirections(p){const point=estateReportCoordinates(p);return point?'https://www.google.com/maps/dir/?api=1&destination='+encodeURIComponent(point.lat+','+point.lon):null;}
function estateReportNavigation(p,index){
 const point=estateReportCoordinates(p),link=estateReportDirections(p),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 if(!point)return '<section class="property-navigation"><h3>'+esc(p.title)+'</h3><p>'+esc(p.reference||p.id)+'</p><p>Coordinates unavailable for this listing.</p></section>';
 const qr=estateQRCode(0,'M');qr.addData(link);qr.make();const svg=qr.createSvgTag({cellSize:3,margin:12,scalable:true,title:{text:'Navigation QR for '+(p.reference||p.title),id:'estate-qr-'+index}});
 return '<section class="property-navigation"><div><h3>'+esc(p.title)+'</h3><p class="property-reference">'+esc(p.reference||p.id)+'</p><p><strong>Latitude:</strong> '+point.lat+'<br><strong>Longitude:</strong> '+point.lon+'</p><p class="coordinate-system">WGS84 · EPSG:4326</p><a href="'+esc(link)+'" target="_blank" rel="noopener noreferrer">Navigate to this property ↗</a></div><figure>'+svg+'<figcaption>Scan for directions</figcaption></figure></section>';
}
async function estateGenerateReport(env,order){
 const key='reports/files/'+order.id+'.json',existing=await reportRead(env,key);if(existing?.files?.[0]?.reportReference&&existing.files[0].reportTemplateVersion==='20261122-canvas-reports')return;
 const rows=await estateReportRows(env,order.estateScope);
 const record=await reportReferenceReserve(env,{owner:order.owner,service:'estate',analysisId:null,geometry:null,scope:order.estateScope,signature:await reportDigest(JSON.stringify([order.id,rows,'20261122-canvas-reports']))});
 order.reportReference=record.reference;
 const files=[{filename:'SIEG_Estate_Report.pdf',type:'application/pdf',encoding:'base64',content:await estatePDF(env,order,rows),reportReference:record.reference,reportTemplateVersion:'20261122-canvas-reports'}];
 await reportReferenceComplete(env,record,files);
 await env.BUCKET.put(key,JSON.stringify({files}));await reportSave(env,order);
}
