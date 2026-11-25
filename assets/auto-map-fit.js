/* Refresh every Leaflet canvas after UI/layout changes, without re-running analyses. */
(function(root){'use strict';
 const records=new Map();let leafletHooked=false;
 const layout='dialog,details,.sieg-map-first,.sieg-floating-panel,.sieg-panel-drawer,.sieg-map-upload-card,.sieg-layers-menu,.sieg-tour,.transit-drawer,.transit-control-panel,.transit-account-panel,.geo-panel,.map-panel,.toolbox-window,.resource-card,.measure-map-drawer,.capture-map-panel';
 function streetAtCloseScale(map){
  if(map.options?.siegAutoBasemap!==true||map.options?.siegManualBasemap||root.SiegFitMap?.inProgress(map))return;
  const size=map.getSize();if(!size.x||!size.y)return;
  const y=size.y/2,metres=map.distance(map.containerPointToLatLng([size.x/2-50,y]),map.containerPointToLatLng([size.x/2+50,y]));if(!Number.isFinite(metres))return;
  let satellite=false;map.eachLayer(layer=>{if(/World_Imagery/i.test(String(layer._url||'')))satellite=true;});
  const close=metres<40;if(!close&&metres<=65)return;if(close&&!satellite||!close&&(!map.siegAutoStreets||satellite))return;
  const doc=map.getContainer().ownerDocument||root.document,scope=map.getContainer().closest('.sieg-map-first,.transit-map-stage,.measure-map-stage,.capture-map-stage')||doc;
  const match=close?/^streets?$/i:/^satellite$/i,selectors=close?'#irStreet,#streetView,#street,#geoStreet,[id$=Street]':'#irSatellite,#satelliteView,#satellite,#geoSatellite,[id$=Satellite]';
  const radio=[...scope.querySelectorAll('input[type=radio]')].find(input=>match.test(input.value));
  const button=scope.querySelector(selectors)||[...scope.querySelectorAll('button')].find(button=>match.test(button.textContent.trim())||match.test(button.getAttribute('aria-label')||''))||doc.querySelector(selectors);
  if(radio&&!radio.checked){map.siegAutoStreets=close;radio.click();}else if(button){map.siegAutoStreets=close;button.click();}
 }
 function visible(canvas){const box=canvas.getBoundingClientRect();return canvas.isConnected!==false&&box.width>0&&box.height>0&&root.getComputedStyle(canvas).visibility!=='hidden';}
 function refresh(record,reframe){
  const {map}=record;if(!records.has(map))return;const canvas=map.getContainer();if(!visible(canvas)||record.interacting||canvas.style.cursor==='crosshair'||root.drawing===true||root.trialDrawing===true||record.isDrawing?.()||root.SiegFitMap?.inProgress(map))return;
  const box=canvas.getBoundingClientRect(),dimensions=box.width+'x'+box.height;if(!reframe&&record.dimensions===dimensions)return;
  record.applying=true;
  try{
   const view=record.viewBounds||map.getBounds();
   if(record.dimensions!==dimensions){record.dimensions=dimensions;map.invalidateSize({pan:false,animate:false,debounceMoveend:true});}
   if(reframe&&!map.options?.siegPreserveView&&!root.document.querySelector('dialog[open]')){
    const bounds=record.getBounds?record.getBounds():root.SiegFitMap?.dataBounds?.(map);
    if(bounds?.isValid?.()){
     if(root.SiegFitMap)root.SiegFitMap.area(map,bounds);
     else{map.stop();map.options.zoomSnap=.25;map.fitBounds(bounds,{padding:[16,16],maxZoom:19,animate:false});}
    }else if(view?.isValid?.()){
     if(root.SiegFitMap?.viewport)root.SiegFitMap.viewport(map,view);
     else{map.stop();map.fitBounds(view,{padding:[0,0],animate:false});}
    }
   }
  }finally{record.applying=false;}
 }
 function schedule(record,reframe=true){
  record.reframe=record.reframe||reframe;root.clearTimeout(record.timer);
  record.timer=root.setTimeout(()=>{record.timer=null;const fit=record.reframe;record.reframe=false;root.requestAnimationFrame(()=>refresh(record,fit));},160);
 }
 function register(map,getBounds,isDrawing){
  if(!map?.getContainer)return;
  const previous=records.get(map);if(previous){if(getBounds)previous.getBounds=getBounds;if(isDrawing)previous.isDrawing=isDrawing;return;}
  const record={map,getBounds,isDrawing,applying:false,interacting:false,reframe:false};records.set(map,record);
  const canvas=map.getContainer();root.SiegLegendPlacement?.mount(map);
  let basemapTimer;const checkBasemap=()=>{root.clearTimeout(basemapTimer);basemapTimer=root.setTimeout(()=>streetAtCloseScale(map),0);};if(map.options?.siegAutoBasemap===true)map.on('zoomend moveend',checkBasemap);
  if(root.ResizeObserver){let width=-1,height=-1;record.resize=new root.ResizeObserver(()=>{const box=canvas.getBoundingClientRect();if(width===box.width&&height===box.height)return;width=box.width;height=box.height;schedule(record,false);});record.resize.observe(canvas);}
  if(root.IntersectionObserver){record.visibility=new root.IntersectionObserver(entries=>{if(entries.some(entry=>entry.isIntersecting))schedule(record,false);},{threshold:0.01});record.visibility.observe(canvas);}
  map.on('dragstart',()=>{if(!record.applying&&!root.SiegFitMap?.inProgress(map))record.interacting=true;});
  map.on('moveend',()=>{if(!record.applying&&!root.SiegFitMap?.inProgress(map))record.viewBounds=map.getBounds();});
  map.on('dragend zoomend',()=>{record.interacting=false;});
  map.on('unload',()=>{root.clearTimeout(record.timer);root.clearTimeout(basemapTimer);record.resize?.disconnect();record.visibility?.disconnect();records.delete(map);});
  map.whenReady(()=>{record.viewBounds=map.getBounds();schedule(record,false);});
 }
 function all(reframe=true){for(const record of records.values())schedule(record,reframe);for(const frame of root.document?.querySelectorAll('iframe')||[]){try{frame.contentWindow?.SiegAutoMapFit?.refresh(reframe)}catch{/* Cross-origin frames manage their own canvases. */}}}
 function install(){
  if(!leafletHooked&&root.L?.Map?.addInitHook){leafletHooked=true;root.L.Map.addInitHook(function(){register(this);});}
  if(root.SiegReportMap)register(root.SiegReportMap);
  for(const map of root.SiegWorkspaceMaps||[])register(map);
 }
 root.SiegAutoMapFit={streetAtCloseScale,register,remember(map){const record=records.get(map);if(record&&!record.applying)record.viewBounds=map.getBounds();},refresh:all,inProgress:map=>!!records.get(map)?.applying};
 if(!root.document)return;
 root.document.addEventListener('load',event=>{if(event.target.tagName==='SCRIPT')install();},true);install();
 root.document.addEventListener('DOMContentLoaded',install,{once:true});
 root.addEventListener('focus',()=>all(false));root.document.addEventListener('visibilitychange',()=>{if(root.document.visibilityState==='visible')all(false);});
 root.addEventListener('resize',()=>all(false));root.addEventListener('orientationchange',()=>all(false));
 for(const event of ['close','cancel','toggle','transitionend'])root.document.addEventListener(event,e=>{if(e.target.matches?.(layout))all(false);},true);
 root.document.addEventListener('click',e=>{
  const control=e.target.closest?.('button,a,summary,input,select');if(!control)return;
  // Map zoom/navigation stays under the user's control. Still refresh its pixel size.
  all(false);
 },true);
 for(const event of ['change','submit','sieg-area-state','sieg-guide-progress','sieg-service-selected','sieg-map-controls-ready','siege-paid-delivery'])root.document.addEventListener(event,()=>all(false),true);
 new root.MutationObserver(changes=>{
  if(changes.some(change=>!change.target.closest?.('.leaflet-pane,.leaflet-tile-pane,.sieg-adaptive-legend')&&(change.target.matches?.(layout)||(change.type==='childList'&&change.target.closest?.('#sidebarHost,#results,#metrics,#charts,.map-panel')))))all(false);
 }).observe(root.document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['hidden','open','class','style','aria-expanded','aria-hidden']});
})(typeof window==='undefined'?globalThis:window);
