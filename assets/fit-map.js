(function(root){'use strict';
 const world=[[-85,-180],[85,180]];
 const activeFits=new WeakSet(),captureFits=new WeakSet(),captureQueues=new WeakMap(),reportViews=new WeakMap(),canvasReportViews=new WeakMap(),fittedViews=new WeakMap();
 const boundsKey=b=>JSON.stringify([b.getWest(),b.getSouth(),b.getEast(),b.getNorth()]);
 function rememberFit(map,bounds){if(bounds?.isValid()) {const view={key:boundsKey(bounds),center:map.getCenter(),zoom:map.getZoom()};fittedViews.set(map,view);reportViews.delete(map);}}

 function duringFit(map,action){
  const alreadyFitting=activeFits.has(map);
  activeFits.add(map);
  try{return action();}finally{if(!alreadyFitting)activeFits.delete(map);}
 }
 function dataBounds(map){
  if(!root.L?.latLngBounds||!map.eachLayer)return null;
  const bounds=root.L.latLngBounds([]);
  map.eachLayer(layer=>{if(layer.options?.siegContextLayer||/graticule|context-layer/.test(layer.options?.className||''))return;try{const box=layer.getBounds?.();if(box?.isValid?.())bounds.extend(box);else if(layer.getLatLng)bounds.extend(layer.getLatLng());}catch{/* Ignore incomplete drawing layers. */}});
  return bounds.isValid()?bounds:null;
 }
 function fit(map,bounds,options={}){
  if(captureFits.has(map))return;
  if(!bounds?.isValid?.()&&!options.world)bounds=dataBounds(map);
  try{return duringFit(map,()=>{
   map.stop();
   map.invalidateSize({pan:false});
   const area=bounds?.isValid();
   if(!area&&root.SiegWorldMap){root.SiegWorldMap.fit(map);return}
   if(!area){map.fitBounds(world,{padding:[24,24],maxZoom:2,animate:false});return;}
   // Maximise the centred view against each obstacle independently. Reserving
   // a whole horizontal/vertical strip for a corner legend wastes map space.
   map.options.zoomSnap=.1;
   const canvas=map.getContainer(),rect=canvas.getBoundingClientRect();
   const width=rect.width,height=rect.height;if(!width||!height)return;const cx=width/2,cy=height/2;
   const scope=canvas.closest('.sieg-map-first,.transit-map-stage,.measure-map-stage,.capture-map-stage')||canvas.parentElement;
   let zoom=map.getBoundsZoom(bounds,false,L.point(48,48));
   const base=map.project(bounds.getNorthWest(),0),end=map.project(bounds.getSouthEast(),0);
   const bw=Math.abs(end.x-base.x),bh=Math.abs(end.y-base.y);
   const limit=(space,span)=>space>0&&span>0?map.getScaleZoom(space/span,0):-Infinity;
   for(const obstacle of scope.querySelectorAll('.sieg-floating-panel,.sieg-tour,.transit-drawer,.transit-control-panel,.transit-account-panel,.geo-panel,.measure-map-drawer,.capture-map-panel,.sieg-adaptive-legend,.map-panel.bottom-left,#legend,#irMapLegend,.leaflet-control')){
    const style=getComputedStyle(obstacle),box=obstacle.getBoundingClientRect();
    if(obstacle.hidden||style.display==='none'||style.visibility==='hidden'||obstacle.getAttribute('aria-hidden')==='true'||obstacle.closest('.is-panel-hidden')||!box.width||!box.height)continue;
    const l=Math.max(0,box.left-rect.left),r=Math.min(width,box.right-rect.left),t=Math.max(0,box.top-rect.top),b=Math.min(height,box.bottom-rect.top);
    if(r<=l||b<=t)continue;
    const gap=28;
    const horizontal=Math.max(cx-r-gap,l-cx-gap),vertical=Math.max(cy-b-gap,t-cy-gap);
    const safeZoom=Math.max(limit(horizontal*2,bw),limit(vertical*2,bh));
    // A panel covering the centre has no centred solution; preserve the area
    // rather than collapsing to a world view until the panel is dismissed.
    if(Number.isFinite(safeZoom))zoom=Math.min(zoom,safeZoom);
   }
   zoom=Math.min(19,map.getMaxZoom?.()??19,Math.floor((zoom+1e-8)*10)/10);
   zoom=Math.max(map.getMinZoom(),zoom);
   const nw=map.project(bounds.getNorthWest(),zoom),se=map.project(bounds.getSouthEast(),zoom);
   map.setView(map.unproject(nw.add(se).divideBy(2),zoom),zoom,{animate:false});
  });}finally{rememberFit(map,bounds);root.SiegAutoMapFit?.remember(map);}
 }
 async function withArea(map,geometry,action,options={}){
  const previous=captureQueues.get(map)||Promise.resolve();
  let release;const turn=new Promise(resolve=>{release=resolve});captureQueues.set(map,turn);
  await previous.catch(()=>{});
  try{return await captureArea(map,geometry,action,options);}finally{release();if(captureQueues.get(map)===turn)captureQueues.delete(map);}
 }
 async function captureArea(map,geometry,action,options={}){
  const bounds=L.geoJSON(geometry).getBounds();
  if(!bounds.isValid())throw Error('The analysed area could not be framed for the report.');
  const center=map.getCenter(),zoom=map.getZoom(),alreadyFitting=activeFits.has(map);
  activeFits.add(map);
  const handlers=['dragging','scrollWheelZoom','doubleClickZoom','touchZoom','boxZoom','keyboard'].map(key=>map[key]).filter(handler=>handler?.enabled?.());
  handlers.forEach(handler=>handler.disable());
  const canvas=map.getContainer?.(),pointer=canvas?.style?.pointerEvents;
  const oldMaxZoom=map.options.maxZoom,hadMaxZoom=Object.prototype.hasOwnProperty.call(map.options,'maxZoom'),reportMaxZoom=Math.max(24,map.getMaxZoom?.()??19),tileSettings=[];
  if(canvas?.style)canvas.style.pointerEvents='none';
  try{
   const key=boundsKey(bounds),size=map.getSize(),dimensions=JSON.stringify([size.x,size.y]);
   if(options.canvas!==false){
    // Fit small AOIs without changing the source tiles' native sampling level.
    map.options.maxZoom=reportMaxZoom;
    map.eachLayer?.(layer=>{if(!layer._url||!layer.options)return;const opts=layer.options;tileSettings.push({opts,max:opts.maxZoom,native:opts.maxNativeZoom,ownMax:Object.prototype.hasOwnProperty.call(opts,'maxZoom'),ownNative:Object.prototype.hasOwnProperty.call(opts,'maxNativeZoom')});opts.maxNativeZoom=opts.maxNativeZoom??opts.maxZoom??19;opts.maxZoom=reportMaxZoom;});
    let view=canvasReportViews.get(map);
    if(!view||view.key!==key||view.dimensions!==dimensions){
     map.stop();map.invalidateSize({pan:false});
     const snap=map.options.zoomSnap;map.options.zoomSnap=.1;
     let fitted;try{fitted=map.getBoundsZoom(bounds,false,L.point(48+size.x*120/1320,48));}finally{map.options.zoomSnap=snap;}
     const zoom=Math.max(map.getMinZoom(),Math.min(reportMaxZoom,Math.floor((fitted+1e-8)*10)/10));
     const nw=map.project(bounds.getNorthWest(),zoom),se=map.project(bounds.getSouthEast(),zoom);
     view={key,dimensions,center:map.unproject(nw.add(se).divideBy(2).add(L.point(size.x*60/1320,0)),zoom),zoom};canvasReportViews.set(map,view);
    }
    const snap=map.options.zoomSnap;map.options.zoomSnap=.1;
    try{duringFit(map,()=>map.setView(view.center,view.zoom,{animate:false}));captureFits.add(map);return await action();}finally{captureFits.delete(map);map.options.zoomSnap=snap;}
   }
   let view=reportViews.get(map);
   if(!view||view.key!==key||view.dimensions!==dimensions){
    view=fittedViews.get(map);
    if(!view||view.key!==key){fit(map,bounds);view=fittedViews.get(map);}
    view={...view,key,dimensions};reportViews.set(map,view);
   }
   duringFit(map,()=>map.setView(view.center,view.zoom,{animate:false}));
   captureFits.add(map);return await action();
  }
  finally{captureFits.delete(map);for(const setting of tileSettings){if(setting.ownMax)setting.opts.maxZoom=setting.max;else delete setting.opts.maxZoom;if(setting.ownNative)setting.opts.maxNativeZoom=setting.native;else delete setting.opts.maxNativeZoom;}if(hadMaxZoom)map.options.maxZoom=oldMaxZoom;else delete map.options.maxZoom;try{duringFit(map,()=>map.setView(center,zoom,{animate:false}));}finally{if(!alreadyFitting)activeFits.delete(map);handlers.forEach(handler=>handler.enable());if(canvas?.style)canvas.style.pointerEvents=pointer||'';}}
 }
 function mount(map,getBounds,isDrawing){
  root.SiegAutoMapFit?.register(map,getBounds,isDrawing);
  const control=L.control({position:'topleft'});
  control.onAdd=()=>{
   const box=L.DomUtil.create('div','leaflet-bar sieg-fit-map-control');
   const button=document.createElement('button');
   button.type='button';
   button.setAttribute('aria-label','Fit map to canvas');
   button.title='Fit map to canvas';
   button.innerHTML='<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M9 4H4v5m11-5h5v5M4 15v5h5m11-5v5h-5"/><circle cx="12" cy="12" r="2"/></svg>';
   button.style.cssText='display:grid;place-items:center;box-sizing:border-box;background:#fff;color:#0b2338;border:0;border-radius:4px;padding:0;width:30px;height:30px;min-height:0!important;cursor:pointer';
   box.append(button);
   L.DomEvent.disableClickPropagation(box);
   L.DomEvent.disableScrollPropagation(box);
   button.addEventListener('click',()=>fit(map,getBounds()));
   return box;
  };
  control.addTo(map);
  const container=control.getContainer();
  container.parentElement.prepend(container);
 }
 function viewport(map,bounds){if(captureFits.has(map))return;return duringFit(map,()=>{map.stop();map.invalidateSize({pan:true,animate:false});map.fitBounds(bounds,{padding:[0,0],animate:false});});}
 root.SiegFitMap={dataBounds,viewport,mount,area:fit,withArea,world:map=>fit(map,null,{world:true}),africa:map=>fit(map,null,{world:true}),inProgress:map=>activeFits.has(map)};
})(window);
