(function(root){'use strict';const CREDIT='support@sieg.ltd',R=6378137,escape=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
// Export completed dashboard visuals without rerunning the analysis or its charts.
async function waitForCharts(element){
 const jobs=[element,...(element?.querySelectorAll?.('*')||[])].map(node=>node?.siegChartReady).filter(Boolean);if(!jobs.length)return;
 let timer;try{await Promise.race([Promise.all(jobs),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('A dashboard chart is still loading. Wait for it to finish, then retry the report.')),30000)})]);}finally{clearTimeout(timer)}
}
// Omit unavailable rows and entirely empty visuals, while preserving measured zeros.
function pruneNoData(doc){
 const missing=value=>/^(?:no (?:data|valid (?:data|observations?))|not available|unavailable|n\/?a|null|undefined|nan|[-–—]*)[.!]?$/i.test(String(value??'').trim());
 for(const table of [...doc.querySelectorAll('table')]){
  const header=table.querySelector('thead tr, tr'),firstHeader=header?.firstElementChild?.textContent||'',labelColumn=/month|year|date|period|measure|indicator|parameter|metric|category|class|name|variable|service|crop|property|item|site|location/i.test(firstHeader);let kept=0;
  for(const row of [...table.querySelectorAll('tr')]){if(row.closest('table')!==table||row.closest('thead,tfoot'))continue;const cells=[...row.children].filter(cell=>/^(TD|TH)$/.test(cell.tagName));if(!cells.some(cell=>cell.tagName==='TD'))continue;
   const first=String(cells[0]?.textContent||'').trim(),isLabel=labelColumn||cells[0]?.tagName==='TH'||(!missing(first)&&!Number.isFinite(Number(first))&&cells.length>1);const values=isLabel?cells.slice(1):cells;
   if(values.length&&values.every(cell=>missing(cell.textContent)))row.remove();else if(values.length)kept++;
  }
  if(!kept)table.remove();
 }
 for(const chart of [...doc.querySelectorAll('.chart')]){const rows=[...chart.querySelectorAll('.chart-row,.bar-row')];if(!rows.length)continue;for(const row of rows)if(missing(row.lastElementChild?.textContent))row.remove();if(!chart.querySelector('.chart-row,.bar-row,svg,canvas,img'))chart.remove();}
 return doc;
}
function cleanNoDataHTML(html){if(typeof DOMParser==='undefined')return String(html);const doc=new DOMParser().parseFromString(String(html),'text/html');pruneNoData(doc);return '<!doctype html>\n'+doc.documentElement.outerHTML;}
function captureResults(element){
 if(!element)return '';const copy=element.cloneNode(true),sources=[element,...element.querySelectorAll('*')],targets=[copy,...copy.querySelectorAll('*')];
 for(let i=0;i<sources.length;i++){
  const from=sources[i],to=targets[i];if(!to)continue;
  if(from.tagName?.toLowerCase()==='canvas'){
   const image=copy.ownerDocument.createElement('img');try{image.src=from.toDataURL('image/png');}catch{throw Error('A dashboard chart could not be exported. Refresh the chart and retry the report.');}image.alt=from.getAttribute('aria-label')||'Dashboard chart';image.className='report-chart-image';to.replaceWith(image);continue;
  }
  if(from.matches?.('.chart,.hydro-chart,svg,svg *,.chart-row,.chart-row *, .bar-row,.bar-row *')&&root.getComputedStyle){const style=root.getComputedStyle(from);for(const key of ['color','background-color','font-family','font-size','font-weight','fill','stroke','stroke-width']){const value=style.getPropertyValue(key);if(value)to.style.setProperty(key,value);}}
 }
 copy.querySelectorAll('script,style,iframe,object,embed,form,button,input,select,textarea,.indicator-actions,.sieg-report-request,.leaflet-control,svg foreignObject').forEach(node=>node.remove());
 for(const node of [copy,...copy.querySelectorAll('*')]){for(const attribute of [...node.attributes])if(/^on/i.test(attribute.name)||['id','tabindex','contenteditable'].includes(attribute.name)||/^(?:javascript|vbscript):/i.test(attribute.value.trim()))node.removeAttribute(attribute.name);if(node.tagName==='DETAILS')node.setAttribute('open','');}
 pruneNoData(copy);return '<div class="report-dashboard-results">'+copy.innerHTML+'</div>';
}
function requireAOI(g){if(!g||!['Polygon','MultiPolygon'].includes(g.type)||!g.coordinates?.length)throw Error('A completed analysis polygon or analysed boundary is required.');return g}
function polygons(g){return requireAOI(g).type==='Polygon'?[g.coordinates]:g.coordinates}
function project(p){return[R*p[0]*Math.PI/180,R*Math.log(Math.tan(Math.PI/4+Math.max(-85,Math.min(85,p[1]))*Math.PI/360))]}
function extent(g){const pts=polygons(g).flat(2).map(project);let box=[Math.min(...pts.map(p=>p[0])),Math.min(...pts.map(p=>p[1])),Math.max(...pts.map(p=>p[0])),Math.max(...pts.map(p=>p[1]))];let w=box[2]-box[0],h=box[3]-box[1];if(w<=0||h<=0)throw Error('Analysis geometry has no map extent.');const cx=(box[0]+box[2])/2,cy=(box[1]+box[3])/2;w*=1.08;h*=1.08;if(h/w<.45)h=w*.45;if(h/w>1.2)w=h/1.2;return[cx-w/2,cy-h/2,cx+w/2,cy+h/2]}
function ringContains(p,r){let inside=false;for(let i=0,j=r.length-1;i<r.length;j=i++){const a=r[i],b=r[j];const cross=(p[0]-a[0])*(b[1]-a[1])-(p[1]-a[1])*(b[0]-a[0]);if(Math.abs(cross)<1e-10&&p[0]>=Math.min(a[0],b[0])&&p[0]<=Math.max(a[0],b[0])&&p[1]>=Math.min(a[1],b[1])&&p[1]<=Math.max(a[1],b[1]))return true;if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])inside=!inside}return inside}
function within(p,g){return polygons(g).some(poly=>ringContains(p,poly[0])&&!poly.slice(1).some(h=>ringContains(p,h)))}
function circle(lon,lat,radius=5000){const ring=[],d=radius/6371008.8,p=lat*Math.PI/180,l=lon*Math.PI/180;for(let i=0;i<=120;i++){const b=i*2*Math.PI/120,y=Math.asin(Math.sin(p)*Math.cos(d)+Math.cos(p)*Math.sin(d)*Math.cos(b)),x=l+Math.atan2(Math.sin(b)*Math.sin(d)*Math.cos(p),Math.cos(d)-Math.sin(p)*Math.sin(y));ring.push([x*180/Math.PI,y*180/Math.PI])}return{type:'Polygon',coordinates:[ring]}}
function nice(v){const power=10**Math.floor(Math.log10(v)),f=v/power;return(f>=5?5:f>=2?2:1)*power}
const legendColor=c=>/^#?[a-f\d]{6}$/i.test(c||'')?'#'+c.replace('#',''):'#0b2338';
// Read custom dashboard legend rows when an analysis does not supply structured metadata.
function legendFromPanel(panel,title){
 if(!panel?.querySelectorAll)return null;
 const items=[];
 for(const row of panel.querySelectorAll('.legend-row,.ee-horizontal')){
  const swatch=row.querySelector('.swatch')||row.firstElementChild;
  const label=(row.innerText||row.textContent||'').trim().replace(/\s+/g,' ');
  const value=swatch?.style?.backgroundColor||'';
  const rgb=value.match(/^rgb\(\s*(\d+),\s*(\d+),\s*(\d+)\s*\)$/);
  const color=rgb?'#'+rgb.slice(1).map(v=>Number(v).toString(16).padStart(2,'0')).join(''):value;
  if(label&&/^#?[a-f\d]{6}$/i.test(color))items.push({color,label});
 }
 if(!items.length)return null;
 const heading=(panel.firstElementChild?.textContent||title).trim();
 return {title:heading,items};
}
function reportLegend({title,palette,min,max,legendItems,legendSpec},top){
 const spec=legendSpec||{},items=spec.items||legendItems,colors=(spec.palette||palette).filter(c=>/^#?[a-f\d]{6}$/i.test(c)).map(legendColor);
 const lo=spec.min??min,hi=spec.max??max,label=spec.title||title;
 if(!items.length&&colors.length&&Number.isFinite(lo)&&Number.isFinite(hi)&&hi>lo){
  if(root.SiegLegend?.svg){
   const full=root.SiegLegend.svg({title:label,units:spec.units,palette:colors,min:lo,max:hi}),view=(full.match(/viewBox="([^"]+)"/)||[])[1]||'0 0 320 210',h=Number(view.split(' ')[3])*1.75,inner=full.replace(/^<svg[^>]*>/,'').replace(/<\/svg>$/,'');
   return {svg:'<svg data-legend="linear" x="40" y="'+top+'" width="560" height="'+h+'" viewBox="'+view+'">'+inner+'</svg>',height:h+5};
  }
  const x=42,w=540,y=top+45;
  return {svg:'<g data-legend="linear" font-family="Arial" font-size="20" fill="#0b2338"><text x="'+x+'" y="'+(top+24)+'" font-weight="700">'+escape(label)+'</text>'+colors.map((c,i)=>'<rect x="'+(x+i*w/colors.length)+'" y="'+y+'" width="'+(w/colors.length+.1)+'" height="22" fill="'+c+'"/>').join('')+'<text x="'+x+'" y="'+(y+48)+'">'+escape(String(lo))+'</text><text x="'+(x+w)+'" y="'+(y+48)+'" text-anchor="end">'+escape(String(hi))+'</text></g>',height:110};
 }
 const rows=items.length?items:[{color:'#0b2338',label:'Analysed boundary'}];
 return {svg:'<g data-legend="bulleted" font-family="Arial" fill="#0b2338"><text x="40" y="'+(top+24)+'" font-size="22" font-weight="700">'+escape(spec.title||'Map legend')+'</text>'+rows.map((item,i)=>{
  const columns=spec.columns===2, x=columns?40+(i%2)*650:40,y=top+42+(columns?Math.floor(i/2):i)*33;
  const swatch=item.symbol?'<g transform="translate('+x+' '+(y-2)+')">'+item.symbol+'</g>':'<rect x="'+x+'" y="'+y+'" width="22" height="22" fill="'+legendColor(item.color)+'" stroke="#829697" stroke-width="1"/>';
  return swatch+'<text x="'+(x+43)+'" y="'+(y+18)+'" font-size="20">'+escape(item.label)+'</text>';
 }).join('')+'</g>',height:48+33*Math.ceil(rows.length/(spec.columns===2?2:1))};
}
function northArrowTransform(geometry,xy){const points=polygons(geometry).flatMap(poly=>poly.flatMap(r=>r.map(xy)));const xs=points.map(p=>p[0]),ys=points.map(p=>p[1]);const overlaps=Math.max(...xs)>=1248&&Math.min(...xs)<=1342&&Math.max(...ys)>=108&&Math.min(...ys)<=242;return overlaps?'translate(1260 12) scale(.6)':'translate(1260 120)';}
function svgMap({backgroundType,geometry,image='',title='Analysed area',source='See analysis source notes',legend='',palette=[],min,max,points=[],viewport,legendItems=[],legendSpec,drawOverlay,layoutStyle,printAnalysis,notes='' }){requireAOI(geometry);const box=viewport?[...project(viewport.slice(0,2)),...project(viewport.slice(2))]:extent(geometry),w=1320,h=Math.round(w*(box[3]-box[1])/(box[2]-box[0])),top=90,x0=40;const xy=p=>{const [x,y]=project(p);return[x0+(x-box[0])/(box[2]-box[0])*w,top+(box[3]-y)/(box[3]-box[1])*h]};const path=polygons(geometry).map(poly=>poly.map(r=>r.map((p,i)=>(i?'L':'M')+xy(p).map(v=>v.toFixed(2)).join(' ')).join(' ')+'Z').join(' ')).join(' ');const midY=(box[1]+box[3])/2,lat=(2*Math.atan(Math.exp(midY/R))-Math.PI/2),groundWidth=(box[2]-box[0])*Math.cos(lat),distance=nice(groundWidth*.22),barW=distance/groundWidth*w,unit=distance>=1000?'km':'m',value=distance>=1000?distance/1000:distance;const lines=String(notes||(legendSpec&&!printAnalysis?'':legend)||'').split(/\n/).map(s=>s.trim()).filter(s=>s&&s.toLowerCase()!==legendSpec?.title?.toLowerCase()&&!legendSpec?.items?.some(item=>item.label===s)).flatMap(s=>s.match(/.{1,95}(?:\s|$)|.{1,95}/g)||[]).slice(0,35),footerY=top+h+34,sourceLines=((String(source)+' | Administrative context: geoBoundaries, William & Mary geoLab and contributors. https://www.geoboundaries.org/ | CC BY 4.0: https://creativecommons.org/licenses/by/4.0/').match(/.{1,110}(?:\s|$)|.{1,110}/g)||['Not supplied']).slice(0,12),key=reportLegend({title,palette,min,max,legendItems,legendSpec},footerY+32),sy=footerY+55+key.height+lines.length*24,height=sy+145+sourceLines.length*24;let svg='<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="1400" height="'+height+'" viewBox="0 0 1400 '+height+'"><defs><clipPath id="frame"><rect x="40" y="90" width="1320" height="'+h+'" rx="22"/></clipPath><clipPath id="aoi"><path d="'+path+'" clip-rule="evenodd"/></clipPath></defs><rect width="1400" height="'+height+'" rx="26" fill="white"/><text x="40" y="48" font-family="Arial" font-size="25" font-weight="700" fill="#0b2338">'+escape(String(title).slice(0,90))+'</text><g clip-path="url(#frame)"><rect x="40" y="90" width="1320" height="'+h+'" fill="#f4f5ef"/>';
if(image)svg+='<image x="40" y="90" width="1320" height="'+h+'" preserveAspectRatio="none" '+(viewport?'':'clip-path="url(#aoi)" ')+'xlink:href="'+escape(image)+'"/>';else svg+='<path d="'+path+'" fill="#e3efea" fill-rule="evenodd"/>';
if(layoutStyle)svg+='<path d="'+path+'" fill="none" stroke="#0b2338" stroke-width="9"/><path d="'+path+'" fill="none" stroke="#5ac3c4" stroke-width="4"/>';
if(drawOverlay)svg+=(layoutStyle?'<g>':'<g clip-path="url(#aoi)">')+drawOverlay(xy)+'</g>';
if(layoutStyle||printAnalysis)svg+='<g transform="translate(64 '+(top+h-54)+')"><rect x="-7" y="-6" width="'+(barW+14)+'" height="42" rx="5" fill="white" fill-opacity=".94"/><text x="0" y="15" font-family="Arial" font-size="20" fill="#0b2338">'+value+' '+unit+'</text><path d="M0 21v8h'+barW+'v-8" fill="none" stroke="#0b2338" stroke-width="3"/></g>';
for(const p of points){if(!within(p.coordinates,geometry))continue;const [x,y]=xy(p.coordinates);svg+='<circle cx="'+x+'" cy="'+y+'" r="7" fill="'+escape(/^#[a-f\d]{6}$/i.test(p.color||'')?p.color:'#218b8c')+'" stroke="white" stroke-width="2"/>'}svg+=(viewport||layoutStyle?'':'<path d="'+path+'" fill="none" stroke="#0b2338" stroke-width="3"/>')+'</g><rect x="40" y="90" width="1320" height="'+h+'" rx="22" fill="none" stroke="#b8cbc5" stroke-width="2"/><g data-north-arrow="true" transform="'+northArrowTransform(geometry,xy)+'"><rect width="70" height="110" rx="12" fill="white" fill-opacity=".95"/><text x="35" y="28" text-anchor="middle" font-family="Arial" font-size="22" fill="#0b2338">N</text><path d="M35 40L18 87L35 77L52 87Z" fill="#0b2338"/><path d="M35 40V77L52 87Z" fill="#218b8c"/></g><text x="40" y="'+footerY+'" font-family="Arial" font-size="20" font-weight="700" fill="#0b2338">'+(backgroundType==='streets'?'Streets background · analysis is restricted to the selected area':layoutStyle?(image?'Latest 30-day satellite composite · outlined field shows the designed area':'Layout schematic · background imagery unavailable'):viewport?'Latest 30-day satellite composite · analysis is restricted to the selected area':'Outlined polygon = analysed area · outside area masked')+'</text>';
svg+=key.svg;
let y=footerY+35+key.height;for(const line of lines){svg+='<text x="40" y="'+y+'" font-family="Arial" font-size="18" fill="#4e6470">'+escape(line.trim())+'</text>';y+=24}
svg+='<rect x="40" y="'+sy+'" width="1320" height="'+(120+sourceLines.length*24)+'" rx="16" fill="#f3f7f6"/><rect x="40" y="'+sy+'" width="5" height="'+(120+sourceLines.length*24)+'" rx="2" fill="#218b8c"/><text x="64" y="'+(sy+34)+'" font-family="Arial" font-size="16" font-weight="bold" fill="#0b2338">MAP DETAILS</text><text x="64" y="'+(sy+62)+'" font-family="Arial" font-size="16" fill="#4e6470">WGS 84 / Web Mercator · EPSG:3857 · North up</text><text x="64" y="'+(sy+88)+'" font-family="Arial" font-size="16" fill="#4e6470">Prepared by SIEG · '+CREDIT+'</text>';sourceLines.forEach((line,i)=>{svg+='<text x="64" y="'+(sy+120+i*24)+'" font-family="Arial" font-size="15" fill="#4e6470">'+(i===0?'Data sources: ':'')+escape(line.trim())+'</text>'});svg+='</svg>';return svg}
const dataURI=s=>'data:image/svg+xml;base64,'+btoa(unescape(encodeURIComponent(s)));
function evaluate(obj){return Promise.race([new Promise((resolve,reject)=>obj.evaluate((v,e)=>e?reject(Error(String(e))):resolve(v))),new Promise((_,reject)=>setTimeout(()=>reject(Error('Analysis lookup timed out')),60000))])}
async function blobData(blob){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(blob)})}
const reportKitURL=typeof document!=='undefined'&&document.currentScript?document.currentScript.src:null;
async function captureMapImage(options={}){
 if(root.SiegReportKitReady)await root.SiegReportKitReady();
 const draw=()=>{if(!root.SiegReportSatellite)throw Error('The latest 30-day satellite background tools did not load. Reload and retry the report.');root.SiegLegendPlacement?.refresh();return root.SiegReportSatellite.withBasemap(options,captureCurrentMapImage)};
 if(!options.geometry)return draw();
 requireAOI(options.geometry);
 if(!root.SiegReportMap||!root.SiegFitMap)throw Error('The report map could not fit the analysed area. Refresh the workspace and try again.');
 return root.SiegFitMap.withArea(root.SiegReportMap,options.geometry,draw,{canvas:true});
}
function mapView(map){const center=map.getCenter(),size=map.getSize();return {center:{lat:center.lat,lng:center.lng},zoom:map.getZoom(),width:size.x,height:size.y};}
function sameMapView(map,expected){const actual=mapView(map);if(Math.abs(actual.zoom-expected.zoom)>1e-7||Math.abs(actual.width-expected.width)>1||Math.abs(actual.height-expected.height)>1)return false;const a=map.project(actual.center,expected.zoom),b=map.project(expected.center,expected.zoom);return Math.abs(a.x-b.x)<=1&&Math.abs(a.y-b.y)<=1;}
async function captureCurrentMapImage(options){
 requireAOI(options.geometry);const map=root.SiegReportMap;if(!map)throw Error('Dashboard map is unavailable. Refresh and analyse the area again.');
 const host=map.getContainer(),key=mapView(map),start=Date.now();
 while(true){let loading=false;map.eachLayer(l=>{if(l.isLoading?.())loading=true});if(!loading)break;if(Date.now()-start>25000)throw Error('Map tiles are still loading. Wait for the dashboard map to finish, then request the report again.');await new Promise(r=>setTimeout(r,150));}
 if(options.satelliteLayer){const container=options.satelliteLayer.getContainer?.();const tiles=container?[...container.querySelectorAll('img')]:[];if(!tiles.some(im=>im.complete&&im.naturalWidth))throw Error('The map background tiles are not ready. Wait for tiles to load and retry the report.');}
 const rect=host.getBoundingClientRect(),visible=el=>{const r=el.getBoundingClientRect();return r.width>0&&r.height>0&&r.right>rect.left&&r.left<rect.right&&r.bottom>rect.top&&r.top<rect.bottom};
 if(!rect.width||!rect.height)throw Error('Open the map before exporting it.');
 const fragments=[];
 const backdrop=options.satelliteLayer?.getContainer?.();
 const opacityOf=el=>{let opacity=1;for(let n=el;n&&n!==host;n=n.parentElement){const css=getComputedStyle(n);if(css.visibility==='hidden'||css.display==='none')return 0;opacity*=Number(css.opacity||1);}return opacity;};
 const rank=el=>{const pane=el.closest('.leaflet-pane');const z=Number(pane&&getComputedStyle(pane).zIndex);return z||({overlay:400,shadow:500,marker:600,tooltip:650,popup:700}[pane?.className?.match(/leaflet-(\w+)-pane/)?.[1]]||200);};
 function place(el,{bitmap,marker,analysis=false}){
  const r=el.getBoundingClientRect(),opacity=analysis?0.72:backdrop?.contains(el)?1:opacityOf(el);
  if(opacity>0)fragments.push({bitmap,marker,analysis,z:rank(el),left:r.left-rect.left,top:r.top-rect.top,width:r.width,height:r.height,opacity});
 }
 const required=options.requiredLayer?.getContainer?.();
 const images=[...host.querySelectorAll(options.basemapOnly?'.leaflet-tile-pane img':'.leaflet-tile-pane img,.leaflet-overlay-pane>img,.leaflet-shadow-pane>img,.leaflet-marker-pane img')].filter(el=>visible(el)&&(backdrop?.contains(el)||opacityOf(el)>0)&&(!options.basemapOnly||!required||required.contains(el)));
 if(options.requiredLayer){if(!required||!images.some(img=>required.contains(img)&&img.complete&&img.naturalWidth))throw Error('The selected analysis layer is not visible in the report map. Reload the layer and try again.');}
 const loadImage=async src=>{const im=new Image();im.src=src;await im.decode();return im;};
 const sources=new Map();
 for(const img of images){
  if(!img.complete||!img.naturalWidth)throw Error('A visible map tile or marker did not load. Reload the map before requesting the report.');
  const url=img.currentSrc||img.src;
  if(!sources.has(url))sources.set(url,(async()=>{
   if(url.startsWith('data:'))return loadImage(url);
   const res=await fetch(url,{signal:AbortSignal.timeout(20000)});if(!res.ok)throw Error('A displayed map image could not be embedded in the report.');
   return loadImage(await blobData(await res.blob()));
  })());
  place(img,{bitmap:sources.get(url),analysis:!!(options.printAnalysis&&required?.contains(img))});
 }
 if(!options.basemapOnly){
 for(const canvas of host.querySelectorAll('.leaflet-tile-pane canvas,.leaflet-overlay-pane>canvas'))if(visible(canvas)&&canvas.width&&canvas.height)place(canvas,{bitmap:canvas});
 for(const svg of host.querySelectorAll('.leaflet-overlay-pane>svg')){
  if(!visible(svg)||!opacityOf(svg))continue;
  const copy=svg.cloneNode(true),originals=[svg,...svg.querySelectorAll('*')],copies=[copy,...copy.querySelectorAll('*')];
  originals.forEach((el,i)=>{const style=getComputedStyle(el);for(const k of ['fill','fill-opacity','stroke','stroke-width','stroke-opacity','stroke-linecap','stroke-linejoin','stroke-dasharray','font-family','font-size','opacity','visibility','display']){const value=style.getPropertyValue(k);if(value)copies[i].style.setProperty(k,value);}});
  const r=svg.getBoundingClientRect();copy.setAttribute('xmlns','http://www.w3.org/2000/svg');copy.setAttribute('width',r.width);copy.setAttribute('height',r.height);copy.style.transform='none';copy.style.position='static';copy.style.opacity='1';
  place(svg,{bitmap:loadImage(dataURI(new XMLSerializer().serializeToString(copy)))});
 }
 for(const el of host.querySelectorAll('.leaflet-marker-pane>*:not(img),.leaflet-tooltip-pane>*,.leaflet-popup-pane>*')){
  if(!visible(el)||el.querySelector('img'))continue;
  const text=(el.querySelector('.leaflet-popup-content')?.innerText||el.innerText||'').replace(/\s+/g,' ').trim().slice(0,150);
  if(text)place(el,{marker:{text,pin:!!el.closest('.leaflet-marker-pane')}});
 }
 }
 if(!fragments.some(f=>f.bitmap))throw Error('No visible map layers were available for the report. Reload the map and try again.');
 const bitmaps=await Promise.all(fragments.map(f=>f.bitmap));
 const canvas=document.createElement('canvas'),scale=Math.min(2,4096/Math.max(rect.width,rect.height));canvas.width=Math.ceil(rect.width*scale);canvas.height=Math.ceil(rect.height*scale);
 const ctx=canvas.getContext('2d');if(!ctx)throw Error('Could not prepare the report map canvas.');
 ctx.scale(scale,scale);ctx.fillStyle='#f4f5ef';ctx.fillRect(0,0,rect.width,rect.height);
 let analysisStarted=false;
 for(const {f,i} of fragments.map((f,i)=>({f,i})).sort((a,b)=>a.f.z-b.f.z||Number(a.f.analysis)-Number(b.f.analysis))){
  if(f.analysis&&!analysisStarted){analysisStarted=true;ctx.globalAlpha=.12;ctx.fillStyle='#fff';ctx.fillRect(0,0,rect.width,rect.height);}
  ctx.imageSmoothingEnabled=!f.analysis;
  ctx.globalAlpha=f.opacity;
  if(bitmaps[i])ctx.drawImage(bitmaps[i],f.left,f.top,f.width,f.height);
  else{
   const x=f.left+f.width/2,y=f.top+f.height/2,{text,pin}=f.marker;
   ctx.font='bold 12px Arial';ctx.textAlign='center';ctx.textBaseline='middle';
   if(pin){ctx.beginPath();ctx.arc(x,y,Math.max(7,Math.min(f.width,f.height)/2),0,2*Math.PI);ctx.fillStyle='#218b8c';ctx.fill();ctx.strokeStyle='#ffffff';ctx.lineWidth=1.5;ctx.stroke();ctx.fillStyle='#ffffff';}
   else{const w=Math.min(rect.width,ctx.measureText(text).width+12);ctx.fillStyle='#ffffff';ctx.fillRect(x-w/2,y-10,w,20);ctx.fillStyle='#0b2338';}
   ctx.fillText(text,x,y,Math.min(rect.width,pin?Math.max(12,f.width):rect.width-12));
  }
 }
 const bounds=map.getBounds(),viewport=[bounds.getWest(),bounds.getSouth(),bounds.getEast(),bounds.getNorth()],attribution=options.basemapOnly&&options.requiredLayer?options.requiredLayer.getAttribution?.():[...host.querySelectorAll('.leaflet-control-attribution')].map(el=>el.textContent).join(' ');
 if(!sameMapView(map,key))throw Error('The map view changed during report capture. Keep it still and try again.');
 return {viewport,image:canvas.toDataURL('image/jpeg',options.printAnalysis?.98:.93),attribution};
}
async function capture(options={}){const {viewport,image,attribution,satellite}=await captureMapImage(options);return dataURI(svgMap({...options,viewport,image,backgroundType:satellite?.type,source:(options.source||'Dashboard analysis')+' · '+attribution}));}
async function map(image,vis,geom,options={}){const geometry=options.geometry||await evaluate(geom);return capture({...options,geometry,palette:vis.palette||[],min:vis.min,max:vis.max})}
let coverAsset;async function folderAsset(){if(!coverAsset){const sides=await Promise.all(['front','back'].map(async side=>{const r=await fetch(new URL('company-folder-'+side+'-infographic.png'+(side==='front'?'?v=sieg-cover-teal-ribbon-20261116':'?v=sieg-last-page'),reportKitURL||location.href));if(!r.ok)throw Error('Company '+side+' cover artwork unavailable');return blobData(await r.blob())}));coverAsset={front:sides[0],back:sides[1]}}return coverAsset}
let paginationAsset;async function paginatorAsset(){if(!paginationAsset){const r=await fetch(new URL('vendor/paged.polyfill.min.js',reportKitURL||location.href));if(!r.ok)throw Error('Report pagination library could not load.');paginationAsset=await blobData(await r.blob())}return paginationAsset}
function reportGuidance(title=''){
 const name=String(title).toLowerCase();
 if(/irrigat/.test(name))return {meaning:'The layout shows a proposed irrigation design for the supplied boundary and inputs. Lines and equipment positions indicate the planned network; they do not confirm installed infrastructure. Read the water-demand, pump and cost tables alongside the map.',limits:'Performance depends on the stated crop, water supply, elevations and equipment assumptions. Confirm available flow, pressure and field levels before installation.',steps:['Confirm your water source and measured field conditions.','Review pump duty, pipe sizes and irrigation schedule with the design tables.','Obtain a site check and current supplier quotations before installation.']};
 if(/hydrolog|catchment|wetland/.test(name))return {meaning:'Read the colours with the legend, units and analysis dates. Wetness and runoff layers describe different processes: wet ground can favour runoff, while drainage and terrain influence where water travels or accumulates.',limits:'Gridded rainfall, moisture and runoff are regional or modelled evidence unless explicitly labelled as measurements. They do not by themselves establish flood depth, groundwater recharge or an available abstraction volume.',steps:['Review the dates, coverage and contributing catchment used by each result.','Compare the findings with local rainfall, river or groundwater records where available.','Use site investigation and a hydrologist’s review before designing water infrastructure.']};
 if(/eco|environment/.test(name))return {meaning:'The map shows the spatial pattern of the named environmental indicator for the stated period. Compare areas using the legend and check whether an apparent difference could reflect missing observations or different source dates.',limits:'Screening indicators have different meanings and resolutions. Modelled biodiversity is not a species census, atmospheric columns are not ground-level air-quality measurements, and detected thermal signals require verification.',steps:['Inspect the locations showing important changes or unusual values.','Compare with earlier periods and suitable local observations.','Use field evidence and specialist review before planning interventions or making compliance decisions.']};
 if(/estate|property/.test(name))return {meaning:'The map places the property and available location information in context. Boundaries and listing information should be read with their source and date.',limits:'Mapped outlines and asking prices are not a cadastral survey or an independent valuation.',steps:['Compare the properties and location factors relevant to your needs.','Arrange a viewing and verify ownership, boundaries and service access.','Use professional survey or valuation advice where required.']};
 if(/address/.test(name))return {meaning:'The map identifies the recorded place or entrance and its surrounding access routes. Use the stated coordinates and entrance reference together.',limits:'A mapped location depends on the supplied records and capture accuracy. Confirm the entrance on site before relying on it for deliveries or access.',steps:['Check the place name and entrance position.','Confirm the access route in person where practical.','Share the current address reference with the people who need the location.']};
 if(/transit/.test(name))return {meaning:'The map relates routes, stops and reported vehicle positions. Arrival estimates depend on the freshness of position updates and current travel conditions.',limits:'An estimated arrival is not a guaranteed waiting time. Review update times before making a connection.',steps:['Confirm your route and boarding stop.','Check the latest vehicle update and arrival estimate.','Allow extra time when position updates are stale or unavailable.']};
 return {meaning:'Read the map together with its legend, units, dates and results table. Colours indicate the named classes or values; they do not automatically imply a good or bad outcome.',limits:'The boundary identifies where the analysis applies. Source resolution and missing observations determine how much local detail the result supports.',steps:['Review the included results and their source notes.','Check important findings with local records or observations.','Use the findings to plan a specific next action and seek specialist advice where needed.']};
}
function geometryReference(geometry){
 const polys=polygons(geometry),rings=polys.flat(),points=polys.flat(2),projected=points.map(project),xs=projected.map(p=>p[0]),ys=projected.map(p=>p[1]),minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys),scale=Math.min(140/Math.max(1,maxX-minX),100/Math.max(1,maxY-minY));
 const path=polys.map(poly=>poly.map(ring=>ring.map((point,index)=>{const p=project(point);return(index?'L':'M')+(90+(p[0]-(minX+maxX)/2)*scale).toFixed(1)+' '+(65-(p[1]-(minY+maxY)/2)*scale).toFixed(1)}).join(' ')+'Z').join(' ')).join(' ');
 let sqm=0;for(const poly of polys)poly.forEach((ring,index)=>{let sum=0;for(let i=0;i<ring.length;i++){const a=ring[i],b=ring[(i+1)%ring.length];sum+=(b[0]-a[0])*Math.PI/180*(2+Math.sin(a[1]*Math.PI/180)+Math.sin(b[1]*Math.PI/180));}sqm+=(index? -1:1)*Math.abs(sum*6371008.8**2/2);});
 const vertices=rings.reduce((sum,ring)=>sum+ring.length-(JSON.stringify(ring[0])===JSON.stringify(ring.at(-1))?1:0),0),raw=JSON.stringify(geometry);let hash=2166136261;for(let i=0;i<raw.length;i++)hash=Math.imul(hash^raw.charCodeAt(i),16777619);const reference='AOI-'+(hash>>>0).toString(16).toUpperCase().padStart(8,'0');
 return '<section class="geometry-reference"><h2>Area reference</h2><div class="geometry-overview"><svg viewBox="0 0 180 130" role="img" aria-label="Outline of the analysed boundary"><rect x="1" y="1" width="178" height="128" rx="12" fill="#f0f7f4"/><path d="'+path+'" fill="#218b8c22" fill-rule="evenodd" stroke="#218b8c" stroke-width="2"/></svg><div><strong>'+reference+'</strong><p>'+Math.max(0,sqm/10000).toFixed(1)+' ha · '+vertices+' boundary vertices · WGS 84</p><p>This is the boundary used for the analysis. Keep this reference when discussing the results.</p></div></div><details><summary>View boundary coordinates · optional technical reference</summary><p>GeoJSON longitude/latitude coordinates, EPSG:4326.</p><pre>'+escape(raw)+'</pre><a href="data:application/geo+json;charset=utf-8,'+encodeURIComponent(raw)+'" download="'+reference+'.geojson">Save boundary as GeoJSON</a></details></section>';
}
function reportPaginationCSS(){return '.report-content h1,.report-content h2,.report-content h3,.report-content h4{break-inside:avoid;page-break-inside:avoid;break-after:avoid;page-break-after:avoid}.report-content p,.report-content li{orphans:3;widows:3}.report-content h2{break-before:auto!important;page-break-before:auto!important;margin-top:32pt!important;break-after:avoid;page-break-after:avoid}.report-content>section:not(.report-appendix),.report-content .analysis-section{break-before:auto!important;page-break-before:auto!important}.report-content>section:first-child>h2:first-child{margin-top:0!important}@page{counter-increment:sieg-body-page;size:A4;margin:18mm 16mm 20mm;@bottom-left{content:"SIEG · beyond the vision";font:8pt Arial;color:#61727c}@bottom-right{content:"Page " counter(sieg-body-page);font:8pt Arial;color:#176f73}}@page cover{counter-increment:sieg-body-page 0;size:A4;margin:0 0 14mm;@bottom-left{content:none}@bottom-right{content:none}}@page contents{counter-increment:sieg-body-page 0;@bottom-right{content:none}}body{counter-reset:sieg-body-page 0}.toc{page:contents;break-after:page}@media print{.report-cover,.report-back{height:283mm!important;max-height:283mm!important;aspect-ratio:auto!important}.report-cover svg,.report-back svg{width:100%;height:100%}}';}
function reportPageCSS(){return '.report-sheet,.report-cover,.report-back{box-sizing:border-box;width:min(900px,calc(100% - 32px));max-width:900px;margin:24px auto;background:white;border-radius:16px}.report-sheet{padding:clamp(18px,4vw,48px)}.report-cover,.report-back{height:auto;aspect-ratio:1061/1500;overflow:hidden}.toc a::after{content:none}.print-report{position:sticky;top:12px;display:block;margin:12px 16px 12px auto}@media(max-width:600px){body{font-size:12pt}.report-sheet,.report-cover,.report-back{width:calc(100% - 16px);margin:12px auto}table{font-size:10pt}}@media print{.report-sheet{width:auto;max-width:none;margin:0;padding:0;border-radius:0}.report-cover,.report-back{width:210mm;max-width:none;height:297mm;margin:0;border-radius:0}.print-report{display:none}}'+reportPaginationCSS();}
function alignReportPages(html){const style='<style data-sieg-page-alignment>'+reportPageCSS()+'</style>';return cleanNoDataHTML(html).replace(/<style data-sieg-page-alignment>[\s\S]*?<\/style>/gi,'').replace(/<\/head>/i,style+'</head>');}
function equalMapFrames(svgs){
 const heights=svgs.map(svg=>svg.includes('<clipPath id="frame">')?Number(svg.match(/<svg[^>]*\bheight="([\d.]+)"/)?.[1]):0);
 const height=Math.max(0,...heights);
 return svgs.map((svg,i)=>!heights[i]?svg:svg.replace(/(<svg[^>]*\bheight=")[\d.]+("[^>]*\bviewBox="0 0 1400 )[\d.]+("[^>]*>)/,'$1'+height+'$2'+height+'$3'));
}
function uniformReportMapFrames(doc){
 const images=[...doc.querySelectorAll('img')].filter(img=>img.getAttribute('src')?.startsWith('data:image/svg+xml;base64,'));
 const decoded=images.map(img=>new TextDecoder().decode(Uint8Array.from(atob(img.getAttribute('src').split(',')[1]),c=>c.charCodeAt(0))));
 equalMapFrames(decoded).forEach((svg,i)=>images[i].setAttribute('src',dataURI(svg)));
}
async function wrap(html,{title,geometry}={}){
 requireAOI(geometry);const doc=new DOMParser().parseFromString(html,'text/html');pruneNoData(doc);doc.querySelectorAll('script,button,style,iframe,object,embed,base,form').forEach(e=>e.remove());doc.querySelectorAll('*').forEach(el=>{for(const attr of [...el.attributes])if(/^on/i.test(attr.name)||/^(?:javascript|vbscript):/i.test(attr.value.trim()))el.removeAttribute(attr.name);});
 const compactBoundary=/hydrology/i.test(title||doc.title);
 let geometryAppendix;
 function boundaryCard(){
  const reference=doc.createElement('div');reference.innerHTML=geometryReference(geometry);
  const card=reference.firstElementChild,details=card.querySelector('details');
  if(!geometryAppendix){
   geometryAppendix=doc.createElement('section');
   geometryAppendix.className=compactBoundary?'report-boundary-summary':'report-appendix';
   geometryAppendix.innerHTML='<h2>Appendix · Boundary coordinates</h2><div id="boundary-reference-appendix"></div>';
   if(compactBoundary){
    let west=Infinity,south=Infinity,east=-Infinity,north=-Infinity;
    for(const [lon,lat] of polygons(geometry).flat(2)){
     west=Math.min(west,lon);south=Math.min(south,lat);east=Math.max(east,lon);north=Math.max(north,lat);
    }
    const bounds=[['West',west],['East',east],['South',south],['North',north]];
    geometryAppendix.insertAdjacentHTML('beforeend','<p>Boundary extent in decimal degrees · WGS 84 (EPSG:4326)</p>'+
     '<table aria-label="Boundary extent"><thead><tr>'+bounds.map(([label])=>'<th scope="col">'+label+'</th>').join('')+
     '</tr></thead><tbody><tr>'+bounds.map(([,value])=>'<td>'+value.toFixed(6)+'</td>').join('')+'</tr></tbody></table>');
    const download=details.querySelector('a');
    download.className='boundary-geojson-download';
    geometryAppendix.append(download);
   }else{
    geometryAppendix.insertAdjacentHTML('beforeend','<p>Optional technical reference for the boundary used in this report. Coordinates are GeoJSON longitude/latitude in WGS 84.</p>');
    geometryAppendix.append(details);
   }
  }
  if(card.contains(details))details.remove();
  const link=doc.createElement('a');link.href='#boundary-reference-appendix';link.textContent='View coordinate reference in the appendix';card.append(link);
  return card;
 }
 for(const heading of [...doc.querySelectorAll('h2')]){
  if(!/^(selected geometry|analysed geometry)$/i.test(heading.textContent.trim()))continue;
  const value=heading.nextElementSibling;if(value?.tagName!=='PRE')continue;
  value.remove();heading.replaceWith(boundaryCard());
 }
 if(!geometryAppendix)doc.body.append(boundaryCard());

 if(root.SiegReportSatellite){let recent;try{recent=await root.SiegReportSatellite.context(geometry)}catch{recent={image:'',source:'Recent satellite context could not be loaded. Completed analysis results are retained below.'}}const section=doc.createElement('section');section.innerHTML='<h2>'+(recent.type==='streets'?'Streets context':'Satellite context · latest 30 days')+'</h2><p>'+escape(recent.source)+'</p>'+(recent.image?'<img src="'+recent.image+'" alt="Map background context">':'<p>No usable recent satellite image is available for this area. Older imagery has not been substituted.</p>')+'<p>This recent image is visual context; indicator results retain their stated analysis dates and sources.</p>';doc.body.prepend(section);}
 const credits=doc.createElement('section');credits.innerHTML="<h2>Administrative boundary credits</h2><p class=\"sieg-data-credit\">Administrative boundaries: <a href=\"https://www.geoboundaries.org/\">geoBoundaries gbOpen / CGAZ</a> \u00b7 William &amp; Mary geoLab and contributors (Runfola et al., 2020) \u00b7 <a href=\"https://creativecommons.org/licenses/by/4.0/\">CC BY 4.0</a>. Filtered/simplified for location context where applicable.</p><p>Source: https://www.geoboundaries.org/ \u00b7 Licence: https://creativecommons.org/licenses/by/4.0/</p>";doc.body.append(credits);
 if(/hydrology/i.test(title||doc.title)){const hydroCredits=doc.createElement('section');hydroCredits.innerHTML="<h2>Catchment sources and licences</h2><p>Automatic catchment detection: <a href=\"https://www.hydrosheds.org/products/hydrobasins\">HydroSHEDS / HydroBASINS</a> \u2014 Lehner &amp; Grill (2013); <a href=\"https://www.hydrosheds.org/products/hydrobasins\">HydroSHEDS licence agreement</a>. MERIT_Hydro_v07_Basins_v01 \u2014 based on <a href=\"https://global-hydrodynamics.github.io/MERIT_Hydro/\">MERIT Hydro, Yamazaki et al. (2019)</a>; <a href=\"https://opendatacommons.org/licenses/odbl/1-0/\">ODbL 1.0 commercial-use option</a> (share-alike applies to derived data). Uploaded continental basin derivative provenance and additional terms require confirmation. Sources are credited separately; automatic selection does not create a surveyed boundary.</p><p>Configured basin assets: projects/ee-gee023/assets/cat_pfaf_{1,2,4,5,6,7,8,9}_MERIT_Hydro_v07_Basins_v01 (eight separate tables). HydroBASINS level 1 routes the local lookup; region 3 is not configured. Source: https://global-hydrodynamics.github.io/MERIT_Hydro/ \u00b7 Licence: https://opendatacommons.org/licenses/odbl/1-0/ \u00b7 HydroBASINS source and licence: https://www.hydrosheds.org/products/hydrobasins</p>";doc.body.append(hydroCredits);}
 uniformReportMapFrames(doc);
 const images=[...doc.body.querySelectorAll('img')];images.forEach((img,i)=>{
  img.setAttribute('data-report-image',String(i+1));img.removeAttribute('loading');if(img.parentElement?.tagName==='FIGURE'){img.parentElement.classList.add('report-image');return;}
  const figure=doc.createElement('figure');figure.className='report-image';img.replaceWith(figure);figure.append(img);
 });
 const guidance=reportGuidance(title||doc.title);
 for(const figure of doc.querySelectorAll('figure.report-image')){
  const parent=figure.parentElement;if(parent?.querySelector('.report-interpretation')||/satellite context/i.test(parent?.querySelector('h2')?.textContent||''))continue;
  const note=doc.createElement('aside');note.className='report-interpretation';note.innerHTML='<h3>How to read this map</h3><p>'+escape(guidance.meaning)+'</p><p>'+escape(guidance.limits)+'</p>';figure.after(note);
 }
 if(![...doc.querySelectorAll('h2')].some(heading=>/conclusion|next steps/i.test(heading.textContent))){const conclusion=doc.createElement('section');conclusion.className='report-conclusion';conclusion.innerHTML='<h2>Conclusions and your next steps</h2><p>The included findings provide evidence for the selected area and stated periods. Use the results together with their coverage, assumptions and local conditions.</p><ol>'+guidance.steps.map(step=>'<li>'+escape(step)+'</li>').join('')+'</ol>';doc.body.append(conclusion);}
 if(geometryAppendix)doc.body.append(geometryAppendix);
 const headings=[...doc.body.querySelectorAll('h2')];headings.forEach((e,i)=>e.id='report-section-'+(i+1));
 const contents=headings.map((e,i)=>'<li><a href="#'+e.id+'"><span class="toc-index">'+String(i+1).padStart(2,'0')+'</span><span>'+escape(e.textContent)+'</span></a></li>').join('');
 const art=await folderAsset(),pageCover=kind=>'<section class="report-'+kind+'"><svg viewBox="0 0 1061 1500" role="img" aria-label="SIEG report '+kind+' cover"><image href="'+art[kind==='cover'?'front':'back']+'" width="1061" height="1500"/></svg></section>';
 const css=`
 @page{size:A4;margin:18mm 16mm 20mm;@bottom-left{content:"SIEG · beyond the vision";font:8pt Arial;color:#61727c}@bottom-right{content:"Page " counter(page) " / " counter(pages);font:8pt Arial;color:#102a43}}
 @page cover{margin:0;@bottom-left{content:none}@bottom-right{content:none}}
 *{box-sizing:border-box}body{font:10pt/1.6 Arial,sans-serif;color:#102a43;margin:0;background:#e8eded}
 .report-cover,.report-back{page:cover;width:210mm;height:297mm;overflow:hidden;background:white;break-after:page}
 .report-back{break-before:page;break-after:auto}.report-cover svg,.report-back svg{display:block;width:100%;height:100%}
 .report-appendix{break-before:page}.report-appendix details{border:1px solid #d7e5df;border-radius:12px;padding:14px}.report-appendix summary{cursor:pointer;font-weight:600;color:#176f73}.report-appendix pre{font-size:8pt;overflow-wrap:anywhere;white-space:pre-wrap;max-height:240px;overflow:auto} .geometry-overview{display:flex;align-items:center;gap:20px;padding:16px;background:#f7faf8;border:1px solid #d7e5df;border-radius:14px}.geometry-overview svg{width:140px;flex:none}.geometry-overview p{margin:6px 0}.geometry-reference details,.report-method{margin-top:12px;border:1px solid #d7e5df;border-radius:10px;padding:12px}.geometry-reference summary,.report-method summary{cursor:pointer;font-weight:600;color:#176f73}.geometry-reference pre{font-size:8pt;max-height:160px;overflow:auto}.report-interpretation{padding:16px 20px;border-left:3px solid #218b8c;background:#f2f8f5;border-radius:0 12px 12px 0;margin:18px 0}.report-interpretation p{margin:8px 0}.report-conclusion{padding:18px;background:#f2f8f5;border-radius:14px}.report-coverage ul{padding:14px 30px;border:1px solid #d7e5df;border-radius:12px}.report-image figcaption,figcaption{font-size:9pt;color:#607982;margin-top:6px} .report-title{border-left:4px solid #009aaa;background:#f3f7f6;padding:16px 20px;margin:0 0 24px}.report-title h1{font-size:24pt;line-height:1.2;margin:10px 0;color:#05283f}.report-title p{font-size:8pt;color:#61727c;letter-spacing:1.2px;margin:0}
 h1,h2,h3{color:#176f73;line-height:1.3}h1{font-size:20pt}h2{font-size:15pt;padding-top:14px;border-top:2px solid #218b8c;break-after:avoid}h3{font-size:11pt;break-after:avoid}
 p,li{orphans:3;widows:3}pre{white-space:pre-wrap;overflow-wrap:anywhere;font:9pt/1.6 Arial;margin:12px 0}
 .report-image{break-inside:avoid;page-break-inside:avoid;margin:14px 0}.report-image img{margin:0;max-height:220mm}
 img{display:block;width:100%;height:auto;max-height:215mm;object-fit:contain;border-radius:14px;margin:14px 0;break-inside:avoid}
 .report-content table{width:100%;margin:10px 0 14px;border-collapse:collapse;table-layout:fixed;overflow-wrap:anywhere;font:9pt/1.35 Arial,sans-serif;font-variant-numeric:tabular-nums;print-color-adjust:exact;-webkit-print-color-adjust:exact}
 .report-content thead{display:table-header-group}
 .report-content tr{break-inside:avoid;page-break-inside:avoid}
 .report-content th,.report-content td{padding:5px 7px;text-align:left;vertical-align:top;border-bottom:1px solid #d8e3e1;background-color:#fff;color:#102a43}
 .report-content thead td,.report-content th,.report-content tbody tr>:first-child:not([colspan]){background-color:#eff4f3;color:#315961;font-weight:700}
 .report-boundary-summary{break-inside:avoid}.report-boundary-summary p{margin:6px 0;color:#506a75;font-size:9pt}.report-content .report-boundary-summary td{background:#fff;color:#102a43;font-weight:400}.boundary-geojson-download{font-size:9pt}@media print{.boundary-geojson-download{display:none}}
 .report-content caption{text-align:left;color:#315961;font-weight:700;margin-bottom:5px}
 a{color:#176f73;text-decoration:none}.toc{break-after:page}.toc ol{list-style:none;padding:0}.toc li{padding:9px 0;border-bottom:1px solid #dce6e2;break-inside:avoid}.toc a{display:block;padding-right:32px;position:relative}.toc-index{color:#218b8c;font-weight:bold;margin-right:12px}.toc a::after{content:target-counter(attr(href),sieg-body-page);position:absolute;right:0;top:0;font-weight:bold;color:#102a43}
 .toc-note,.report-credit{font-size:8pt;color:#61727c;line-height:1.5}.report-credit{border-top:1px solid #d5dfd9;padding-top:12px}.notice{padding:14px;background:#f1ede5;border-radius:10px}.error{color:#8c3024}
 .ir-method-summary{padding:10px 14px;border-left:3px solid #218b8c;background:#f1f7f5;border-radius:0 10px 10px 0;margin:10px 0}.ir-method-summary p{margin:4px 0}.ir-assumptions th,.ir-assumptions td{width:25%}.ir-source-table th{width:25%}.ir-reference-note{font-size:8pt;line-height:1.45;color:#607982;margin:8px 0}
 .report-dashboard-results{overflow-wrap:anywhere}.report-dashboard-results svg,.report-chart-image{display:block;max-width:100%;height:auto}.report-dashboard-results .chart{width:100%;box-sizing:border-box;overflow:visible}.report-dashboard-results p{margin:8px 0}.report-dashboard-results table{width:100%}
 .eco-fire-chart-total{padding:8px 10px;background:#eff4f3;color:#176f73;border-radius:6px;font-weight:700}.eco-fire-chart-period{color:#506a75;font-size:9pt}.eco-fire-chart .bar-row{grid-template-columns:105px minmax(0,1fr) 65px}
 .chart{margin:14px 0;padding:12px;border:1px solid #d5dfd9;border-radius:10px;break-inside:avoid}.chart-row,.bar-row{display:grid;grid-template-columns:85px minmax(0,1fr) 65px;align-items:center;gap:8px;margin:5px 0;font-size:9pt}.chart-row>span:nth-child(2){background:#edf5f3;height:12px}.chart-row i,.bar-row i{display:block;height:12px;background:#218b8c}.chart h4{margin:0 0 10px}
 .print-report{position:fixed;right:20px;top:16px;z-index:99999;padding:12px 20px;background:#218b8c;color:white;border:0;border-radius:8px;cursor:pointer}.pagedjs_pages{padding:56px 0 24px}.pagedjs_page{margin:0 auto 24px;background:white;box-shadow:0 3px 18px #102a4320}
 @media print{body{background:white}.print-report{display:none}.pagedjs_pages{padding:0}.pagedjs_page{margin:0;box-shadow:none}}
 `;
 const screenCSS=reportPageCSS();
 return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="sieg-analysed-boundary" content="'+escape(JSON.stringify(geometry||null))+'"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+escape(title||doc.title)+'</title><style>'+css+screenCSS+'</style></head><body><button id="printReport" class="print-report" onclick="window.print()">Print / Save</button>'+pageCover('cover')+'<main class="report-sheet"><nav class="toc"><div class="report-title"><p>ANALYSED AREA REPORT</p><h1>'+escape(title||doc.title)+'</h1><p>'+escape(new Date().toISOString().slice(0,10))+'</p></div><h2>Contents</h2><ol>'+contents+'</ol><p class="toc-note">Use the links above to navigate this report. Results apply to the analysed area; imagery outside the boundary is context only.</p></nav><article class="report-content">'+doc.body.innerHTML+'</article><p class="report-credit">SIEG · beyond the vision · '+CREDIT+' · Geometry: WGS84 / EPSG:4326 · Map: EPSG:3857</p></main>'+pageCover('back')+'</body></html>';

}

root.SiegeReportKit={mapView,sameMapView,equalMapFrames,reportPaginationCSS,pruneNoData,cleanNoDataHTML,captureResults,waitForCharts,reportPageCSS,alignReportPages,reportGuidance,geometryReference,escape,requireAOI,within,circle,extent,svgMap,dataURI,evaluate,map,capture,captureMapImage,legendFromPanel,wrap};if(typeof module!=='undefined')module.exports=root.SiegeReportKit;
})(typeof window!=='undefined'?window:globalThis);
