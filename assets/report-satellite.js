/* Recent true-colour report context. Never substitute undated or older imagery. */
(function(root){'use strict';
const cache=new Map(),DAY=86400000,RGB=['B4','B3','B2'];
function period(now=Date.now()){
 const end=new Date(Math.floor(Number(now)/3600000)*3600000),start=new Date(end.getTime()-30*DAY);
 return {start:start.toISOString(),end:end.toISOString(),label:start.toISOString().replace('.000Z',' UTC')+' to '+end.toISOString().replace('.000Z',' UTC')};
}
function maskScene(image){const scl=image.select('SCL');let valid=scl.neq(0);for(const code of [1,3,8,9,10,11])valid=valid.and(scl.neq(code));return image.select(RGB).updateMask(valid);}
function evaluate(value){return new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Recent satellite lookup timed out.')),90000);value.evaluate((v,e)=>{clearTimeout(timer);e?reject(Error(String(e))):resolve(v);});});}
function mapInfo(image){return new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Recent satellite map timed out.')),90000);image.getMap({bands:RGB,min:0,max:3000,gamma:1.15},(v,e)=>{clearTimeout(timer);e?reject(Error(String(e))):resolve(v)});});}
function backgroundExtent(geometry){const bounds=root.SiegReportMap?.getBounds?.();if(!bounds)return geometry;const west=bounds.getWest(),east=bounds.getEast(),south=Math.max(-85,bounds.getSouth()),north=Math.min(85,bounds.getNorth());if(![west,east,south,north].every(Number.isFinite)||east<=west||east-west>180)return geometry;return {type:'Polygon',coordinates:[[[west,south],[east,south],[east,north],[west,north],[west,south]]]};}
async function load(geometry){
 const context=backgroundExtent(geometry),p=period(),key=JSON.stringify([geometry,context,p.start,p.end,root.SiegeUsage?.active?.id,root.SiegeUsage?.adminMode?.()]);
 if(cache.has(key))return cache.get(key);
 const work=(async()=>{
  await root.SiegeAnalysis?.initialize();if(!root.ee)throw Error('Satellite analysis service unavailable.');
  const ee=root.ee,g=ee.Geometry(geometry),backdrop=ee.Geometry(context),scenes=ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED').filterBounds(backdrop).filterDate(p.start,p.end);
  const empty=ee.Image.constant([0,0,0]).rename(RGB).updateMask(ee.Image(0));
  const composite=scenes.map(maskScene).merge(ee.ImageCollection.fromImages([empty])).median().clip(backdrop);
  const backgroundCoverage=composite.select('B4').mask().unmask(0).reduceRegion({reducer:ee.Reducer.mean(),geometry:backdrop,scale:60,maxPixels:1e7,bestEffort:true,tileScale:4});
  const coverage=composite.select('B4').mask().unmask(0).reduceRegion({reducer:ee.Reducer.mean(),geometry:g,scale:60,maxPixels:1e7,bestEffort:true,tileScale:4});
  const meta=await evaluate(ee.Dictionary({scenes:scenes.size(),coverage:coverage.get('B4'),backgroundCoverage:backgroundCoverage.get('B4')}));
  const fraction=Number(meta.coverage)||0,count=Number(meta.scenes)||0;
  const source='Copernicus Sentinel-2 SR Harmonized · cloud/shadow/snow-masked median RGB · '+p.label+' · '+count+' intersecting scene granules · approximate clear coverage '+(100*fraction).toFixed(1)+'%';
  if(!count||fraction<=0)return {...p,available:false,source:source+' · No clear coverage detected at the report sampling scale in this window; older imagery has not been substituted.'};
  const info=await mapInfo(composite),url=info.urlFormat||info.tile_fetcher?.url_format||(info.mapid?'/api/earth-engine/v1/'+info.mapid+'/tiles/{z}/{x}/{y}':null);
  if(!url)throw Error('Recent satellite tile URL is unavailable.');
  return {...p,available:true,coverage:fraction,backgroundCoverage:Number.isFinite(Number(meta.backgroundCoverage))?Number(meta.backgroundCoverage):fraction,url,source:source+' · Imagery covers the report viewport; the outlined AOI defines the analysis. Gaps remain where no usable observation was available. Native RGB resolution: 10 m; display and coverage statistics may be coarser.'};
 })();cache.set(key,work);try{return await work}catch(e){cache.delete(key);throw e}
}
function baseLayer(layer){const url=String(layer?._url||'');return /(?:arcgisonline\.com|openstreetmap\.org)/i.test(url)||String(layer?.options?.className||'').includes('sieg-basemap-tiles');}
function streetsScale(map){const b=map.getBounds(),lat=(b.getNorth()+b.getSouth())/2,m=(b.getEast()-b.getWest())*Math.PI/180*6378137*Math.cos(lat*Math.PI/180)*.22,p=10**Math.floor(Math.log10(m)),f=m/p;return(f>=5?5:f>=2?2:1)*p;}
function resolutionEnlargement(map){const b=map.getBounds(),lat=(b.getNorth()+b.getSouth())/2,width=(b.getEast()-b.getWest())*Math.PI/180*6378137*Math.cos(lat*Math.PI/180);return 10/(width/1320);}
function streets(reason){return {available:true,type:'streets',url:'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',source:'Streets background · © OpenStreetMap contributors · '+reason+' Satellite context was not substituted with older imagery.'};}
async function selectBasemap(map,geometry){
 let info;
 if(streetsScale(map)<50)info=streets('Map scale below 50 m.');
 else {
  try{info=await load(geometry);}catch{info=streets('Recent satellite context could not be loaded.');}
  if(!info.available)info=streets('No clear recent satellite context was available in the latest 30 days.');
  else if(info.type!=='streets'&&(info.coverage<.9||info.backgroundCoverage<.85))info=streets('Recent satellite clear coverage is insufficient for this report view.');
 }
 return info;
}
async function withBasemap(options,capture){
 const map=root.SiegReportMap,session=options.basemapSession;
 // Choose once at the fitted report extent, then reuse the same imagery for every indicator.
 const info=await (session?(session.selection??=selectBasemap(map,options.geometry)):selectBasemap(map,options.geometry));
 const removed=[];map.eachLayer(layer=>{if(baseLayer(layer))removed.push(layer)});removed.forEach(layer=>map.removeLayer(layer));let temporary;const opacity=[];
 try{
  if(info.available){temporary=root.L.tileLayer(info.url,{maxZoom:24,maxNativeZoom:19,zIndex:1,attribution:info.source,className:'sieg-recent-report-satellite'}).addTo(map);temporary.bringToBack?.();}
  map.eachLayer(layer=>{if(!options.basemapOnly&&layer!==temporary&&/earth-engine|earthengine/i.test(String(layer._url||''))&&typeof layer.setOpacity==='function'){const previous=layer.options?.opacity??1;opacity.push([layer,previous]);layer.setOpacity(Math.min(previous,.82));}});
  const result=await capture({...options,satelliteLayer:temporary,requiredLayer:options.basemapOnly?temporary:options.requiredLayer});
  return {...result,attribution:info.source+(opacity.length?' · Analysis displayed as a semi-transparent overlay; values and legend classes are unchanged.':''),satellite:info};
 }finally{opacity.forEach(([layer,previous])=>layer.setOpacity(previous));temporary?.remove();removed.forEach(layer=>layer.addTo(map));}
}
async function context(geometry){
 const kit=root.SiegReportKitReady?await root.SiegReportKitReady():root.SiegeReportKit;if(!kit?.captureMapImage)throw Error('Report tools did not load. Reload this service and retry.');
 const result=await kit.captureMapImage({geometry,fitArea:true,basemapOnly:true});
 const image=result.image?root.SiegeReportKit.dataURI(root.SiegeReportKit.svgMap({geometry,viewport:result.viewport,image:result.image,backgroundType:result.satellite?.type,printAnalysis:true,title:result.satellite?.type==='streets'?'Streets context':'Recent satellite context · latest 30 days',source:result.attribution})):'';
 return {image,source:result.attribution,type:result.satellite?.type};
}
root.SiegReportSatellite={resolutionEnlargement,streetsScale,backgroundExtent,period,maskScene,load,withBasemap,context};
})(typeof window!=='undefined'?window:globalThis);
