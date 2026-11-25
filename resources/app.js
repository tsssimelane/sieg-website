(() => {
'use strict';
const $=id=>document.getElementById(id), geo=navigator.geolocation, radians=Math.PI/180, R=6371008.8, limit=10000;
document.querySelectorAll('.resource-hero a[href="#sieg-toolbox"], .resource-hero a[href="#admin-panel"], .resource-hero a[href="#measure"], .resource-hero a[href="#mapping"]').forEach(link=>{
 link.addEventListener('click',()=>{const section=$(link.hash.slice(1));if(section&&!section.hidden){if(section.tagName==='DETAILS')section.open=true;const container=section.closest('details.resource-container');if(container)container.open=true;}});
});
$('sieg-toolbox')?.addEventListener('toggle',()=>{if($('sieg-toolbox').open)requestAnimationFrame(()=>window.dispatchEvent(new Event('resize')));});
const text=(id,value)=>{$(id).textContent=value};
const meters=n=>n>=1000?(n/1000).toFixed(2)+' km':n.toFixed(1)+' m';
const distance=(a,b)=>2*R*Math.asin(Math.min(1,Math.sqrt(Math.sin((b.y-a.y)*radians/2)**2+Math.cos(a.y*radians)*Math.cos(b.y*radians)*Math.sin((b.x-a.x)*radians/2)**2)));
const dlon=(a,b)=>((b-a+540)%360)-180;
function measure(points,polygon){let d=0,s=0;for(let i=1;i<points.length;i++)d+=distance(points[i-1],points[i]);if(polygon&&points.length>=3){d+=distance(points.at(-1),points[0]);points.forEach((a,i)=>{const b=points[(i+1)%points.length];s+=dlon(a.x,b.x)*radians*(Math.sin(a.y*radians)+Math.sin(b.y*radians));});}return [d,Math.abs(s)*R**2/2]}
const gpsError=e=>e.code===1?'Location permission denied. Enable it in your browser settings.':e.code===2?'GPS position unavailable. Move outside and try again.':'Waiting for a GPS fix…';
function gpsFix(p){return {x:p.coords.longitude,y:p.coords.latitude,accuracy:p.coords.accuracy,stamp:p.timestamp,time:new Date(p.timestamp).toISOString()}}
const fresh=(p,age=4500)=>p&&Number.isFinite(p.stamp)&&Date.now()-p.stamp<=age&&p.stamp<=Date.now()+1000&&Number.isFinite(p.accuracy)&&p.accuracy>=0&&p.accuracy<=15&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&Math.abs(p.x)<=180&&Math.abs(p.y)<=90;
const accuracyLabel=p=>Number.isFinite(p?.accuracy)&&p.accuracy>0?'±'+p.accuracy.toFixed(1)+' m':'unavailable';
const options={enableHighAccuracy:true,maximumAge:0,timeout:15000};
let measureAreaMeter,fieldAreaMeter,measureAreaShown=false,fieldAreaShown=false,fieldAreaPoints=[];let measurement=[],measureWatch=null,measureTick=null,lastMeasure=null,measurePaused=false,measureRun=0,digitalDrawing=false;
const isDigital=()=>$('measureSource').value==='digital';
function displayMeasure(){if($('measureMode').value==='polygon'&&(digitalDrawing||measureWatch!==null||measurement.length>=3)){if(!measureAreaShown){measureAreaMeter?.start();measureAreaShown=true;}measureAreaMeter?.update();}else{measureAreaMeter?.reset();measureAreaShown=false;}$('measureUndo').disabled=!digitalDrawing||!measurement.length;paintMeasure();const polygon=$('measureMode').value==='polygon',[d,a]=measure(measurement,polygon);text('measureResult',measurement.length<2?'Waiting for two positions…':polygon?(measurement.length<3?'Capture at least three positions for an enclosed area.':'Perimeter '+meters(d)+' · Area '+a.toFixed(1)+' m² ('+(a/10000).toFixed(3)+' ha)'):'Distance '+meters(d));}
function stopMeasureGPS(){measureRun++;if(measureWatch!==null)geo.clearWatch(measureWatch);clearInterval(measureTick);measureWatch=measureTick=null;lastMeasure=null;}
function stopMeasure(){digitalDrawing=false;measureMap.map?.getContainer().style.removeProperty('cursor');stopMeasureGPS();measurePaused=false;$('measurePause').disabled=true;text('measurePause','Pause GPS');text('measureAccuracy',isDigital()?'Digital measurement · based on selected map points':'GPS accuracy: not tracking');$('measureMode').disabled=false;$('measureStop').disabled=true;$('measureStart').disabled=isDigital()?!measureMap.map:!measureMap.located;$('measureUndo').disabled=true;$('measureZoom').disabled=false;}
$('measureStart').onclick=()=>{if(isDigital()){
 if(!measureMap.map)return text('measureStatus','The map is unavailable. Reload and try again.');
 stopMeasure();measurement=[];digitalDrawing=true;$('measureStart').disabled=$('measureMode').disabled=true;$('measureStop').disabled=false;$('measureZoom').disabled=true;measureMap.map.getContainer().style.cursor='crosshair';displayMeasure();text('measureAccuracy','Digital measurement · based on selected map points');text('measureStatus','Click or tap points on the map, then select Finish.');return;
}if(!geo)return text('measureStatus','Location is unavailable in this browser.');if(!measureMap.located)return;if(session)return text('measureStatus','Finish field mapping before starting a measurement.');measurement=[];lastMeasure=null;measurePaused=false;$('measurePause').disabled=false;text('measurePause','Pause GPS');text('measureAccuracy','GPS accuracy: searching…');$('measureStart').disabled=$('measureMode').disabled=true;$('measureStop').disabled=false;$('measureZoom').disabled=true;text('measureStatus','Waiting for GPS accuracy of 15 m or better…');displayMeasure();
 startMeasureGPS();
};
function startMeasureGPS(){
 const run=++measureRun;measureWatch=geo.watchPosition(p=>{if(run!==measureRun||measurePaused)return;lastMeasure=gpsFix(p);text('measureAccuracy','Current GPS accuracy: '+accuracyLabel(lastMeasure));if(!fresh(lastMeasure))text('measureStatus','Waiting for a better GPS fix (reported '+Math.round(lastMeasure.accuracy)+' m).');},e=>{if(run!==measureRun)return;text('measureAccuracy','GPS accuracy: unavailable');if(e.code===1)stopMeasure();text('measureStatus',gpsError(e))},options);
 measureTick=setInterval(()=>{if(run!==measureRun||measurePaused)return;const p=lastMeasure;if(!fresh(p)){text('measureAccuracy',p?'Last GPS accuracy: '+accuracyLabel(p)+' · stale':'GPS accuracy: searching…');text('measureStatus','Waiting for a fresh GPS fix with accuracy of 15 m or better.');return;}if(p.stamp<= (measurement.at(-1)?.stamp??0))return;if(!measurement.length||distance(measurement.at(-1),p)>=Math.max(1.5,p.accuracy/2)){measurement.push(p);displayMeasure()}text('measureStatus',measurement.length+' positions · GPS ±'+p.accuracy.toFixed(1)+' m');if(measurement.length>=limit){if(isDigital()&&$('measureMode').value==='polygon'&&measure(measurement,true)[1]<.1)return text('measureStatus','These points do not enclose an area. Undo a point and add another corner.');stopMeasure();text('measureStatus','Measurement finished at the position limit.')}},3000);
}
$('measurePause').onclick=()=>{if(measurePaused){measurePaused=false;text('measurePause','Pause GPS');text('measureAccuracy','GPS accuracy: searching…');text('measureStatus','GPS resumed. Waiting for a fresh fix…');startMeasureGPS();}else if(measureWatch!==null){measurePaused=true;stopMeasureGPS();text('measurePause','Resume GPS');text('measureAccuracy','GPS accuracy: paused');text('measureStatus','GPS paused · '+measurement.length+' positions retained.');}};
$('measureMode').onchange=()=>{if(measurement.length)displayMeasure()};
$('measureStop').onclick=()=>{if(isDigital()&&measurement.length<($('measureMode').value==='polygon'?3:2))return text('measureStatus','Add at least '+($('measureMode').value==='polygon'?3:2)+' distinct points before finishing.');if(isDigital()&&$('measureMode').value==='polygon'&&measure(measurement,true)[1]<.1)return text('measureStatus','These points do not enclose an area. Undo a point and add another corner.');stopMeasure();if($('measureMode').value==='polygon')measureAreaMeter?.complete();text('measureStatus','Measurement finished · '+measurement.length+' positions.')};$('measureReset').onclick=()=>{stopMeasure();measurement=[];paintMeasure();text('measureStatus',isDigital()?'Choose a measurement and select Start measuring.':measureMap.located?'Ready to measure.':'Select Zoom to location to get started.');text('measureResult','No measurement yet.');};
const fieldSurvey=window.SiegFieldSurvey.mount();
let countries=[],world=[],saved=[],session=null;
async function lookupData(){const read=async url=>{const r=await fetch(url);if(!r.ok)throw Error('Country data unavailable');return r.json()};try{countries=await read('/assets/countries-global.json');for(const c of countries)$('fieldCountry').add(new Option(c.name,c.iso3));world=(await read('/talent/world-map.json')).map(([code,,,path])=>[code,path.split('M').filter(Boolean).map(s=>s.slice(0,-1).split(' ').map(v=>v.split(',').map(Number)))]);}catch{}}
lookupData();
function inRing(x,y,ring){let inside=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const [a,b]=ring[i],[c,d]=ring[j];if((b>y)!==(d>y)&&x<(c-a)*(y-b)/(d-b)+a)inside=!inside}return inside}
function matchFC(p,fc){return fc.features.find(f=>(f.geometry.type==='Polygon'?[f.geometry.coordinates]:f.geometry.coordinates).some(([ring,...holes])=>inRing(p.x,p.y,ring)&&!holes.some(h=>inRing(p.x,p.y,h))))?.properties?.shapeName||''}
async function boundary(p,iso){
 const guess=iso?countries.find(c=>c.iso3===iso):countries.find(c=>c.code===world.find(([,rings])=>rings.reduce((hit,r)=>hit!==inRing(360+2*p.x,170-2*p.y,r),false))?.[0]);
 if(!guess)return {country:'',adm1:'',adm2:'',note:'Country not detected. Choose it from the dropdown and try again.'};
 const results=await Promise.allSettled(['ADM1','ADM2'].map(async level=>matchFC(p,(await window.SiegBoundaries.load(guess.iso3,level)).fc)));
 const [adm1,adm2]=results.map(r=>r.value||'');return {country:guess.name,adm1,adm2,note:[guess.name,'Admin 1: '+(adm1||'unavailable'),'Admin 2: '+(adm2||'unavailable')].join(' · ')};
}
function createMap(key,onLocated){
 const state={located:false};
 const zoom=$(key+'Zoom'),street=$(key+'Street'),satellite=$(key+'Satellite');
 if(window.L){
  state.map=L.map(key+'Map',{scrollWheelZoom:false}).fitWorld({padding:[12,12],animate:false});
  const tiles=[
   L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap contributors'}),
   L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',{maxZoom:19,attribution:'© Esri imagery contributors'})
  ];
  tiles[0].addTo(state.map);let active=0;
  const basemap=i=>{if(i===active)return;state.map.removeLayer(tiles[active]);tiles[i].addTo(state.map);active=i;street.setAttribute('aria-pressed',String(i===0));satellite.setAttribute('aria-pressed',String(i===1));};
  street.onclick=()=>basemap(0);satellite.onclick=()=>basemap(1);
  L.control.scale({imperial:false}).addTo(state.map);
  state.shapes=L.featureGroup().addTo(state.map);
  window.SiegAutoMapFit?.register(state.map,()=>state.shapes.getBounds());
  window.SiegWorldMap.mount(state.map);
  const fit=document.createElement('button');fit.type='button';fit.setAttribute('aria-label','Fit map to canvas');fit.title='Fit map to canvas';fit.innerHTML='<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 4H4v5m11-5h5v5M4 15v5h5m11-5v5h-5"/><circle cx="12" cy="12" r="2"/></svg>';
  fit.onclick=()=>window.SiegFitMap.area(state.map,state.shapes.getBounds());
  window.SiegAddressMapControls.mount({map:state.map,street,satellite,fit,status:$(key+'Status')});
 }else{street.disabled=satellite.disabled=true;text(key+'Map','Map preview unavailable. You can still use phone GPS.');}
 zoom.onclick=()=>{
  if(!geo)return text(key+'Status','Location is unavailable in this browser.');
  zoom.disabled=true;text(key+'Accuracy','GPS accuracy: searching…');text(key+'Status','Finding your location…');
  geo.getCurrentPosition(position=>{
   const p=gpsFix(position);text(key+'Accuracy','Current GPS accuracy: '+accuracyLabel(p));
   if(state.map){
    const center=[p.y,p.x];
    state.marker?.remove();
    state.marker=L.circleMarker(center,{radius:7,color:'#fff',weight:2,fillColor:'#1d8588',fillOpacity:1}).addTo(state.map);
    state.map.setView(center,p.accuracy<=100?17:p.accuracy<=1000?14:11);
   }
   state.located=true;zoom.disabled=false;onLocated();
  },error=>{zoom.disabled=false;text(key+'Accuracy','GPS accuracy: unavailable');text(key+'Status',error.code===3?'Location lookup timed out. Move outdoors and try again.':gpsError(error));},options);
 };
 return state;
}
const measureMap=createMap('measure',()=>{$('measureStart').disabled=false;text('measureStatus','Location found. Choose a measurement and select Start measuring.');});
$('measureSource').onchange=()=>{stopMeasure();measurement=[];paintMeasure();const digital=isDigital();$('measureUndo').hidden=!digital;$('measurePause').hidden=digital;$('measureGPSMethod').setAttribute('aria-pressed',String(!digital));$('measureDigitalMethod').setAttribute('aria-pressed',String(digital));text('measureAccuracy',digital?'Digital measurement · based on selected map points':'GPS accuracy: not tracking');text('measureStatus',digital?'Choose a measurement and select Start measuring.':measureMap.located?'Ready to measure.':'Select Zoom to location to get started.');text('measureResult','No measurement yet.');};
for(const [id,value] of [['measureGPSMethod','gps'],['measureDigitalMethod','digital']])$(id).onclick=()=>{if($('measureSource').value===value)return;$('measureSource').value=value;$('measureSource').onchange();};
$('measureUndo').onclick=()=>{if(!digitalDrawing)return;measurement.pop();displayMeasure();text('measureStatus',measurement.length+' points · click or tap to add another.');};
measureMap.map?.on('click',e=>{if(!digitalDrawing)return;const p={x:e.latlng.lng,y:e.latlng.lat};if(measurement.some(v=>distance(v,p)<.01))return text('measureStatus','Choose a different point, or select Finish to close the area.');if(measurement.length>=limit)return text('measureStatus','Point limit reached. Select Finish.');measurement.push(p);displayMeasure();text('measureStatus',measurement.length+' points · click or tap to add another, or select Finish.');});
measureAreaMeter=window.SiegPolygonTools.create(measureMap.map,()=>measurement.map(p=>({lat:p.y,lng:p.x})),()=>{},()=>{},{cursor:()=>digitalDrawing});
const fieldMap=createMap('field',()=>{controls();text('fieldStatus','Location found. Enter a name, choose a geometry, then select Start mapping.');});
fieldAreaMeter=window.SiegPolygonTools.create(fieldMap.map,()=>fieldAreaPoints,()=>{},()=>{},{cursor:false});
function drawTrace(layer,points,polygon){
 if(!points.length)return;
 const p=points.map(v=>[v.y,v.x]),style={color:'#168588',fillOpacity:.2};
 (p.length===1?L.circleMarker(p[0],{...style,radius:6}):polygon&&p.length>=3?L.polygon(p,style):L.polyline(p,style)).addTo(layer);
}
function paintMeasure(){const layer=measureMap.shapes;if(!layer)return;layer.clearLayers();drawTrace(layer,measurement,$('measureMode').value==='polygon');}
function paint(){if(session?.type==='polygon'){fieldAreaPoints=session.points.map(p=>({lat:p.y,lng:p.x}));if(!fieldAreaShown){fieldAreaMeter.start();fieldAreaShown=true;}fieldAreaMeter.update();}const layer=fieldMap.shapes;if(!layer)return;layer.clearLayers();for(const f of [...saved,...(session?[session]:[])])drawTrace(layer,f.points,f.type==='polygon');}
function controls(){text('fieldLiveSummary',session?(session.paused?'GPS paused':'Capturing '+session.type):'GPS idle');$('fieldVertex').hidden=$('fieldFinish').hidden=false;text('fieldStart','Start mapping');text('fieldCancel','Cancel capture');const busy=!!session;fieldSurvey.lock(busy);window.SiegCaptureFields?.lock(busy);$('fieldStart').disabled=busy||!fieldMap.located;$('fieldZoom').disabled=busy;$('fieldName').disabled=$('fieldType').disabled=$('fieldCountry').disabled=busy;$('fieldCancel').disabled=!busy;$('fieldPause').hidden=!busy||session.type==='point';$('fieldPause').disabled=!busy||session.type==='point'||session.saving||session.needsCountry;text('fieldPause',session?.paused?'Resume GPS':'Pause GPS');$('fieldVertex').disabled=!busy||session.paused||session.type==='line'||session.saving||session.needsCountry;$('fieldFinish').disabled=!busy||session.saving||(!session.needsCountry&&(session.type==='point'||session.points.length<(session.type==='line'?2:3)));text('fieldVertex',$('fieldType').value==='polygon'?'Add corner':'Capture point');}
function stopFieldGPS(s){s.gpsRun=null;if(s.watch!=null)geo.clearWatch(s.watch);clearInterval(s.timer);s.watch=s.timer=s.last=null;}
function endField(){if(!session)return;stopFieldGPS(session);text('fieldAccuracy','GPS accuracy: not tracking');session=null;controls();}
function renderList(){const ul=$('fieldList');ul.replaceChildren();for(const f of saved){const li=document.createElement('li'),remove=document.createElement('button');li.textContent=(f.field?.name?f.field.name+' / ':'')+f.name+' · '+f.type+' · '+f.points.length+' GPS fixes · '+(f.survey?.schema.length||0)+' answers · '+(f.photos?.length||0)+' photos · '+f.admin.note;remove.type='button';remove.textContent='Remove';remove.setAttribute('aria-label','Remove '+f.name);remove.onclick=()=>{saved=saved.filter(item=>item.id!==f.id);renderList();paint()};li.append(remove);ul.append(li)}$('fieldDownload').disabled=$('fieldEmail').disabled=!saved.length;}
async function saveField(){const s=session;if(!s||s.saving)return;const min={point:1,line:2,polygon:3}[s.type];if(new Set(s.points.map(p=>p.x+','+p.y)).size<min)return text('fieldStatus','Capture '+min+' distinct positions first.');
 if(s.type==='polygon'&&measure(s.points,true)[1]<0.1)return text('fieldStatus','These corners do not enclose an area. Capture a different corner.');
 if(s.points.some((p,i)=>i&&Math.abs(p.x-s.points[i-1].x)>180)||s.type==='polygon'&&Math.abs(s.points[0].x-s.points.at(-1).x)>180)return text('fieldStatus','Split features at the international date line before saving.');
 s.saving=true;stopFieldGPS(s);controls();text('fieldStatus','Matching the first GPS fix to geoBoundaries…');
 const admin=await (s.lookup||boundary(s.points[0],s.iso));if(session!==s)return;
 if(!admin.country&&!s.iso){s.needsCountry=true;s.saving=false;controls();$('fieldCountry').disabled=false;text('fieldStatus','Choose the country and select Save feature.');return;}
 if(s.type==='polygon')fieldAreaMeter.complete();saved.push({id:crypto.randomUUID(),field:s.field,type:s.type,name:s.name,points:s.points,admin,survey:s.survey,photos:s.survey.photos});endField();fieldSurvey.saved(s.survey);text('fieldAccuracy','Captured GPS accuracy: '+accuracyLabel(s.points.at(-1)));renderList();paint();text('fieldStatus','Saved '+s.name+'.');text('fieldBoundaries',admin.note);
}
function addFix(){const s=session;if(!s||s.saving||s.paused)return;const p=s.last;if(!fresh(p)){text('fieldStatus','Waiting for a fresh GPS fix with accuracy of 15 m or better.');return;}
 if(p.stamp<=(s.points.at(-1)?.stamp??0)){text('fieldStatus','Waiting for a new GPS reading.');return;}
 s.points.push(p);if(s.points.length===1){s.lookup=boundary(p,s.iso);s.lookup.then(a=>{if(session===s&&s.lookup)text('fieldBoundaries',a.note)});}
 text('fieldStatus',s.points.length+' positions · GPS ±'+p.accuracy.toFixed(1)+' m');paint();controls();
 if(s.type==='point'||s.points.length>=limit)saveField();
}
$('fieldStart').onclick=()=>{if(!geo)return text('fieldStatus','Location is unavailable in this browser.');if(!fieldMap.located)return;if(measureWatch!==null)return text('fieldStatus','Finish your measurement before starting field mapping.');const name=$('fieldName').value.trim();if(!name){$('fieldName').focus();return text('fieldStatus','Enter a feature name first.');}
 let survey;try{survey=fieldSurvey.snapshot()}catch(error){return text('fieldStatus',error.message)}
 fieldAreaMeter.reset();fieldAreaShown=false;const s=session={field:window.SiegCaptureFields.current(),survey,name,type:$('fieldType').value,iso:$('fieldCountry').value,points:[],paused:false,saving:false,needsCountry:false};controls();text('fieldStatus','Waiting for a GPS fix with accuracy of 15 m or better…');text('fieldBoundaries','Admin areas are matched using the first captured point.');
 startFieldGPS(s);
};
function startFieldGPS(s){
 text('fieldAccuracy','GPS accuracy: searching…');const run=s.gpsRun={};
 const current=()=>session===s&&s.gpsRun===run&&!s.paused&&!s.saving;
 s.watch=geo.watchPosition(p=>{if(!current())return;s.last=gpsFix(p);text('fieldAccuracy','Current GPS accuracy: '+accuracyLabel(s.last));if(!fresh(s.last))text('fieldStatus','GPS reports ±'+s.last.accuracy.toFixed(1)+' m. Wait for 15 m or better.');else if(s.type!=='line')text('fieldStatus','GPS ±'+s.last.accuracy.toFixed(1)+' m · Ready to capture.');},e=>{if(!current())return;text('fieldAccuracy','GPS accuracy: unavailable');if(e.code===1){endField();paint()}text('fieldStatus',gpsError(e))},options);
 s.timer=setInterval(()=>{if(!current())return;if(s.last&&!fresh(s.last))text('fieldAccuracy','Last GPS accuracy: '+accuracyLabel(s.last)+' · stale');if(s.type==='line')addFix()},3000);
}
$('fieldPause').onclick=()=>{
 const s=session;if(!s||s.type==='point'||s.saving||s.needsCountry)return;
 s.paused=!s.paused;
 if(s.paused){stopFieldGPS(s);text('fieldAccuracy','GPS accuracy: paused');text('fieldStatus','GPS paused · '+s.points.length+' positions retained.');}
 else{text('fieldAccuracy','GPS accuracy: searching…');text('fieldStatus','GPS resumed. Waiting for a fresh fix…');startFieldGPS(s);}
 controls();
};
$('fieldCountry').onchange=()=>{if(session){session.iso=$('fieldCountry').value;session.lookup=boundary(session.points[0],session.iso)}};
$('fieldType').onchange=controls;$('fieldVertex').onclick=addFix;$('fieldFinish').onclick=saveField;$('fieldCancel').onclick=()=>{fieldAreaMeter.reset();fieldAreaShown=false;endField();paint();text('fieldStatus','Capture discarded.');};
async function mappingPackage(){
 const features=saved.slice(),files=[],manifest=[];
 for(const f of features){const photoPaths=[];for(const [i,photo] of (f.photos||[]).entries()){const ext=photo.type==='image/png'?'png':photo.type==='image/webp'?'webp':photo.type==='image/heic'?'heic':photo.type==='image/heif'?'heif':photo.type==='image/gif'?'gif':photo.type==='image/jpeg'?'jpg':'image';const path='photos/'+f.id+'/'+String(i+1).padStart(2,'0')+'.'+ext;files.push([path,new Uint8Array(await photo.arrayBuffer())]);photoPaths.push({path,originalName:photo.name,mimeType:photo.type});}manifest.push({featureId:f.id,geometryField:f.field,name:f.name,schema:f.survey?.schema||[],answers:f.survey?.answers||{},photos:photoPaths});}
 const enc=new TextEncoder();files.push(['questionnaire.json',enc.encode(JSON.stringify(manifest,null,2))]);
 const geojson={type:'FeatureCollection',features:features.map(f=>({type:'Feature',id:f.id,geometry:{type:f.type==='point'?'Point':f.type==='line'?'LineString':'Polygon',coordinates:f.type==='point'?[f.points[0].x,f.points[0].y]:f.type==='line'?f.points.map(p=>[p.x,p.y]):[[...f.points.map(p=>[p.x,p.y]),[f.points[0].x,f.points[0].y]]]},properties:{feature_id:f.id,geometry_field_id:f.field?.id||'',geometry_field:f.field?.name||'',name:f.name,...f.admin,answers:f.survey?.answers||{},photos:manifest.find(m=>m.featureId===f.id).photos.map(p=>p.path)}}))};
 files.push(['DATA-LICENCES.txt',enc.encode("Administrative boundaries: geoBoundaries gbOpen / CGAZ, William & Mary geoLab and contributors (Runfola et al., 2020). Source: https://www.geoboundaries.org/ | Licence: CC BY 4.0, https://creativecommons.org/licenses/by/4.0/ . Used for administrative context and location lookup; boundaries may be filtered, clipped or simplified. Original source metadata is retained where available.")]);geojson.attribution="Administrative boundaries: geoBoundaries gbOpen / CGAZ, William & Mary geoLab and contributors (Runfola et al., 2020). Source: https://www.geoboundaries.org/ | Licence: CC BY 4.0, https://creativecommons.org/licenses/by/4.0/ . Used for administrative context and location lookup; boundaries may be filtered, clipped or simplified. Original source metadata is retained where available.";files.push(['features.geojson',enc.encode(JSON.stringify(geojson))]);files.push(['README.txt',enc.encode('SIEG Field Mapping: WGS 84 shapefiles, features.geojson, questionnaire.json and linked photos. Join by FEATURE_ID / featureId. Custom shapefile columns Q001 etc. are mapped in questionnaire-fields.json. DBF text is limited to 250 bytes; questionnaire.json preserves full answers and field labels. Photos and answers remain on the device until you choose to share this package.\n')]);return window.SiegShapefile(features,files);
}
async function packageAction(action){if(!saved.length)return;const buttons=[$('fieldDownload'),$('fieldEmail')];buttons.forEach(b=>b.disabled=true);try{await action(await mappingPackage())}catch(error){text('fieldStatus','Download unavailable: '+error.message)}finally{buttons.forEach(b=>b.disabled=!saved.length)}}
function downloadPackage(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000)}
$('fieldDownload').onclick=()=>packageAction(blob=>downloadPackage(blob,'sieg-field-mapping-'+new Date().toISOString().slice(0,10)+'.zip'));
$('fieldEmail').onclick=()=>packageAction(async blob=>{
 const name='sieg-field-mapping-'+new Date().toISOString().slice(0,10)+'.zip',file=new File([blob],name,{type:'application/zip'});
 const share={title:'SIEG Capture',text:'Mapped features, questionnaire answers and photos are attached.',files:[file]};
 if(navigator.canShare?.({files:[file]})&&navigator.share){try{await navigator.share(share);return}catch(e){if(e.name==='AbortError')return}}
 downloadPackage(blob,name);text('fieldStatus','Attach '+name+' from Downloads before sending your email.');location.href='mailto:?subject='+encodeURIComponent(share.title)+'&body='+encodeURIComponent('Please attach '+name+' from your Downloads folder.');
});
window.addEventListener('pagehide',()=>{stopMeasure();endField();});
window.addEventListener('beforeunload',e=>{if(saved.length||session?.points?.length){e.preventDefault();e.returnValue=''}});
window.SiegCaptureFields.mount(fieldSurvey);
controls();
})();
