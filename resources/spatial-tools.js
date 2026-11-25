import {smoothLines,fitControlPoints} from './spatial-core.js';

const $=id=>document.getElementById(id);
const message=(id,text)=>{const p=$(id);p.hidden=!text;p.textContent=text;};
function download(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);}
let smoothed;
function clearSmooth(){smoothed=null;$('lineSmoothDownload').disabled=true;message('lineSmoothStatus','');}
$('lineSmoothFile').onchange=$('lineSmoothPasses').onchange=clearSmooth;
$('lineSmoothForm').onsubmit=async e=>{
 e.preventDefault();clearSmooth();
 const file=$('lineSmoothFile').files[0],passes=+$('lineSmoothPasses').value,button=e.submitter;
 if(!file)return;
 if(file.size>10*1024*1024)return message('lineSmoothStatus','Choose a GeoJSON or shapefile ZIP up to 10 MB.');
 button.disabled=$('lineSmoothFile').disabled=$('lineSmoothPasses').disabled=true;
 try{
  let input;
  if(/\.zip$/i.test(file.name)){
   const {readReferenceShapefile}=await import('./reference-shapefile.js');
   input=await readReferenceShapefile(await file.arrayBuffer());
  }else input=JSON.parse(await file.text());
  const {data,lines,vertices}=smoothLines(input,passes);smoothed=data;$('lineSmoothDownload').disabled=false;message('lineSmoothStatus',lines+' lines smoothed from '+vertices+' input vertices.');}
 catch(error){message('lineSmoothStatus',error.message);}
 finally{button.disabled=$('lineSmoothFile').disabled=$('lineSmoothPasses').disabled=false;}
};
$('lineSmoothDownload').onclick=()=>{if(smoothed)download(new Blob([JSON.stringify(smoothed)],{type:'application/geo+json'}),'sieg-smoothed-lines.geojson');};

const img=$('georefImage'),fileInput=$('georefFile'),shapeInput=$('georefShape'),button=$('georefDownload');
let imageUrl,points=[],fit=null,pending=null,busy=false,imageReady=false,reference,map,shapes,mapMarkers,reader;
const prompt=text=>{$('georefPrompt').textContent=text;};
const fitReference=()=>{if(shapes?.getBounds().isValid())window.SiegFitMap?window.SiegFitMap.area(map,shapes.getBounds()):map.fitBounds(shapes.getBounds(),{padding:[24,24],maxZoom:19});};
$('georefFitMap').onclick=fitReference;
function redrawReference(){
 $('georefEditor').hidden=!(imageReady&&reference);
 if(!imageReady||!reference){message('georefStatus',imageReady?'Add the projected shapefile ZIP.':reference?'Add the PNG or JPEG image.':'Add both files to get started.');return;}
 if(!window.L){$('georefEditor').hidden=true;message('georefStatus','The shapefile map could not load. Reload Resources and try again.');return;}
 if(!map){
  map=L.map('georefMap',{maxZoom:22,preferCanvas:true}).setView([0,0],2);
  shapes=L.geoJSON(null,{style:{color:'#1d8588',weight:2,fillOpacity:.1},pointToLayer:(_,p)=>L.circleMarker(p,{radius:5,color:'#1d8588'})}).addTo(map);
  mapMarkers=L.layerGroup().addTo(map);
  map.on('click',({latlng})=>{
   if(busy)return;
   if(!pending)return prompt('Select a point on the image first.');
   if(points.length>=30)return prompt('Use up to 30 control points.');
   if(points.some(p=>p.x===pending.x&&p.y===pending.y))return prompt('That image pixel already has a control point. Choose a different pixel.');
   if(points.some(p=>Math.abs(p.lon-latlng.lng)>180))return prompt('Images spanning the international date line are not supported.');
   points.push({...pending,lon:latlng.lng,lat:latlng.lat});pending=null;updateFit();
   prompt('Pair added. Select the next point on the image.');
  });
 }
 shapes.clearLayers().addData(reference);map.invalidateSize();fitReference();updateFit();
 prompt('Select a point on the image, then click its match on the shapefile map.');
}
function clearPairs(){points=[];pending=null;fit=null;button.disabled=true;mapMarkers?.clearLayers();}
shapeInput.onchange=()=>{
 reader?.terminate();reader=null;reference=null;clearPairs();$('georefEditor').hidden=true;
 const file=shapeInput.files[0];
 if(!file)return redrawReference();
 if(!/\.zip$/i.test(file.name)||file.size>25*1024*1024)return message('georefStatus','Choose a shapefile ZIP up to 25 MB.');
 message('georefStatus','Reading and projecting the reference shapefile…');
 try{
  const worker=reader=new Worker(new URL('./georef-worker.js',import.meta.url),{type:'module'});
  const finish=(error,layer)=>{if(reader!==worker)return;worker.terminate();reader=null;if(error)message('georefStatus',error);else{reference=layer;redrawReference();}};
  const timer=setTimeout(()=>finish('Shapefile processing timed out. Try a smaller layer.'),45000);
  worker.onmessage=({data})=>{clearTimeout(timer);finish(data.error,data.layer);};
  worker.onerror=()=>{clearTimeout(timer);finish('Could not load the reference shapefile.');};
  worker.postMessage(file);
 }catch(e){message('georefStatus',e.message);}
};
function markers(){
 const layer=$('georefMarkers');layer.replaceChildren();
 for(const [i,p] of [...points,...(pending?[pending]:[])].entries()){
  const marker=document.createElement('span');marker.className='georef-marker'+(i===points.length?' pending':'');
  marker.style.left=((p.x+.5)/img.naturalWidth*100)+'%';marker.style.top=((p.y+.5)/img.naturalHeight*100)+'%';marker.textContent=i===points.length?'+':String(i+1);layer.append(marker);
 }
}
function updateFit(){
 markers();mapMarkers?.clearLayers();
 if(mapMarkers)points.forEach((p,i)=>L.circleMarker([p.lat,p.lon],{radius:6,color:'#0b2338',fillColor:'#f5be58',fillOpacity:1,interactive:false}).bindTooltip(String(i+1),{permanent:true,direction:'top',interactive:false}).addTo(mapMarkers));
 const list=$('georefPoints');list.replaceChildren();
 for(const p of points){const li=document.createElement('li');li.textContent='Pixel '+p.x+', '+p.y+' → '+p.lon+', '+p.lat;list.append(li);}
 $('georefUndo').disabled=!points.length;fit=null;
 try{if(points.length>=3){fit=fitControlPoints(points);message('georefStatus','Affine fit ready. Control point RMS error: '+fit.rms.toFixed(2)+' m. '+(points.length===3?'Add a fourth point to check the fit.':'Review the fit before using the image.'));}
 else message('georefStatus',points.length+' of 3 minimum control points added.');}
 catch(e){message('georefStatus',e.message);}
 button.disabled=!fit||busy;
}
fileInput.onchange=()=>{
 if(imageUrl)URL.revokeObjectURL(imageUrl);img.removeAttribute('src');$('georefEditor').hidden=true;imageReady=false;clearPairs();
 const file=fileInput.files[0];if(!file)return redrawReference();
 if(!/\.(png|jpe?g)$/i.test(file.name)||file.size>25*1024*1024)return message('georefStatus','Choose a PNG or JPEG up to 25 MB.');
 const url=imageUrl=URL.createObjectURL(file);
 img.onload=()=>{if(img.src!==url)return;if(img.naturalWidth*img.naturalHeight>25000000)return message('georefStatus','Use an image with up to 25 million pixels.');imageReady=true;redrawReference();};
 img.onerror=()=>message('georefStatus','This image could not be opened.');
 img.src=url;
};
img.onclick=e=>{
 if(busy)return;
 const r=img.getBoundingClientRect();pending={x:Math.min(img.naturalWidth-1,Math.max(0,Math.floor((e.clientX-r.left)/r.width*img.naturalWidth))),y:Math.min(img.naturalHeight-1,Math.max(0,Math.floor((e.clientY-r.top)/r.height*img.naturalHeight)))};
 markers();prompt('Now click the matching location on the shapefile map.');
};
$('georefUndo').onclick=()=>{if(!busy){pending=null;points.pop();updateFit();prompt('Select the next point on the image.');}};
button.onclick=async()=>{
 if(!fit||busy)return;
 const {world,rms}=fit,control=points.slice();busy=button.disabled=fileInput.disabled=shapeInput.disabled=true;
 try{
  const canvas=document.createElement('canvas');canvas.width=img.naturalWidth;canvas.height=img.naturalHeight;
  canvas.getContext('2d').drawImage(img,0,0);
  const png=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
  if(!png)throw Error('Could not encode the image. Try a smaller file.');
  const enc=new TextEncoder(),csv='pixel_x,pixel_y,longitude,latitude\n'+control.map(p=>[p.x,p.y,p.lon,p.lat].join(',')).join('\n')+'\n';
  const wkt='GEOGCS["WGS 84",DATUM["WGS_1984",SPHEROID["WGS 84",6378137,298.257223563]],PRIMEM["Greenwich",0],UNIT["degree",0.0174532925199433],AUTHORITY["EPSG","4326"]]';
  const help='Extract all files to the same folder and open map.png in your GIS. The map.pgw file places the image; keep the filenames paired. If your GIS asks for a coordinate system, assign WGS 84 (EPSG:4326). Control-point RMS error: '+rms.toFixed(2)+' m. Pixel coordinates start at the center of the top-left pixel (0,0).\n';
  download(window.SiegZip([['map.png',new Uint8Array(await png.arrayBuffer())],['map.pgw',enc.encode(world.join('\n')+'\n')],['map.prj',enc.encode(wkt)],['control-points.csv',enc.encode(csv)],['README.txt',enc.encode(help)]]),'sieg-georeferenced-map.zip');
 }catch(e){message('georefStatus',e.message);}
 finally{busy=fileInput.disabled=shapeInput.disabled=false;button.disabled=!fit;}
};
