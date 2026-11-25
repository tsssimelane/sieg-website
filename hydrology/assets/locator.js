(()=>{'use strict';const $=id=>document.getElementById(id),overviewButton=$('hydroOverview'),overviewStatus=$('hydroOverviewStatus'),placeStatus=$('hydroPlaceStatus'),basinStatus=$('hydroBasinStatus');let current={code:'GLOBAL',name:'Your location',iso3:'GLOBAL'},countryFC=null,place=null,engine=false,analysable=false,ticket=0,boundaryTicket=0,overviewTicket=0,overviewShown=false;const boundaries=Object.create(null);
function basinReset(){analysable=false;window.HydroUX?.sync();}
function clearAnalysis(){window.SiegAreaSection?.reset();analysable=false;const host=$('sidebarHost');if(host)host.inert=true;window.hydroMapBridge.clear();if(engine){window.generation++;window.dataGeneration++;window.areaRequest++;window.basinRequest++;window.hydraulicRequest++;window.selectedBasin=null;window.hydroCatchmentLimit=null;window.activeProduct=null;window.monthlyFC=null;window.opticalMonthlyFC=null;window.hydraulicResults=null;window.basinSearchArea=null;window.basinLocationPoint=null;window.basinsLoaded=false;window.basinLoadError=null;window.basinLabels={};window.regionFeatures={};window.reservoirAreaSelected=false;window.regionSelect.items().reset([]);window.modulePanel.clear();window.results.clear();window.legend.clear();window.analysisCaption.setValue('Use current location to find your catchment.');window.yearSelect.el.disabled=true;}window.HydroUX?.sync();}
function invalidateLocation(){ticket++;overviewTicket++;overviewShown=false;overviewButton.textContent='View catchment overview';window.hydroMapBridge.overview?.(null);place=null;basinReset();clearAnalysis();basinStatus.textContent='Use your current location to prepare your catchment.';}
async function loadCountry(zoom=true){const version=++boundaryTicket,selected=current;countryFC=null;if(selected.code==='GLOBAL')return;try{let fc=boundaries[selected.code];if(!fc){fc=(await window.SiegBoundaries.load(selected.iso3,'ADM0')).fc;boundaries[selected.code]=fc;}if(version!==boundaryTicket)return;countryFC=fc;
// This downloaded outline is for navigation only. Basin lookup uses EE assets.
if(!place&&zoom){window.hydroMapBridge.country(fc);placeStatus.textContent='Use current location to locate your catchment.';}
}catch(e){if(version!==boundaryTicket)return;if(!place)placeStatus.textContent='Country outline unavailable. You can still upload your catchment.';}}

function applyCountry(){if(!engine)return;window.country=current.code==='GLOBAL'?ee.Geometry.Rectangle([-180,-85,180,85],null,false):ee.FeatureCollection('WM/geoLab/geoBoundaries/600/ADM0').filter(ee.Filter.eq('shapeGroup',current.iso3)).geometry();window.boundary=ee.FeatureCollection([ee.Feature(window.country)]);window.countryName=current.name;window.aoi=window.country;window.analysisCaption.setValue(current.name+' • Locating your catchment');}
// Resolved geometries remain in memory only; repeat points inside them need no EE lookup.
const catchmentCache=[];
function evaluate(value){return new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Catchment lookup timed out. Retry or upload your boundary.')),45000);value.evaluate((data,error)=>{clearTimeout(timer);error?reject(Error(String(error))):resolve(data)});});}
function inRing(point,ring){let inside=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const a=ring[i],b=ring[j];if((a[1]>point.lat)!==(b[1]>point.lat)&&point.lon<(b[0]-a[0])*(point.lat-a[1])/(b[1]-a[1])+a[0])inside=!inside;}return inside;}
function contains(geometry,point){const polygons=geometry?.type==='Polygon'?[geometry.coordinates]:geometry?.type==='MultiPolygon'?geometry.coordinates:[];return polygons.some(rings=>inRing(point,rings[0])&&!rings.slice(1).some(ring=>inRing(point,ring)));}
async function installCatchment(feature,collection){
 const id=feature?.properties?.COMID,geometry=feature?.geometry;
 if(id==null||!['Polygon','MultiPolygon'].includes(geometry?.type))throw Error('The selected catchment has no valid COMID or polygon. Upload a boundary to continue.');
 const key='MERIT-Basins: '+id,local=window.SiegeUsage.attachGeometry(ee.Geometry(geometry),geometry);
 window.publicBasins=collection;window.basinData=collection;window.basinField='COMID';window.basinLabels={[key]:id};window.regionFeatures={[key]:local};window.basinOptions=[key];window.basinsLoaded=true;window.basinLoadError=null;
 window.regionSelect.items().reset([key]);window.regionSelect.setValue(null,false);
 await window.siegeHydrology.basinsChanged([key],[key]);
}
async function loadBasins(){
 if(!place)return;
 if(!engine){basinReset();basinStatus.textContent='Location found. Waiting for the shared SIEG analysis service.';return;}
 const version=++ticket,point={...place},valid=()=>version===ticket&&!window.SiegAreaSection?.complete;
 applyCountry();window.selectedBasin=null;window.reservoirAreaSelected=false;window.basinLevel='9';window.basinSourceName='MERIT-Basins';
 window.basinLocationPoint=ee.Geometry.Point([point.lon,point.lat]);window.basinSearchArea=window.basinLocationPoint.buffer(30);
 window.siegeHydrology.basinsLoading();
 try{
  const response=await fetch('/api/hydrology/basin-source',{credentials:'same-origin'});
  if(!response.ok)throw Error('Automatic catchment lookup is unavailable. You can still upload a boundary.');
  const config=await response.json();if(!valid())return;
  const assets=config.assets||{},fingerprint=JSON.stringify(assets);
  if(!Object.keys(assets).length||!config.routingAsset)throw Error('Automatic catchment lookup is temporarily unavailable. Upload a boundary to continue.');
  const cached=catchmentCache.find(entry=>entry.fingerprint===fingerprint&&contains(entry.feature.geometry,point));
  if(cached){await installCatchment(cached.feature,cached.collection);return;}
  // Route through the small level-1 regional index before opening any continental MERIT table.
  const regions=await evaluate(ee.FeatureCollection(config.routingAsset).filterBounds(window.basinSearchArea).aggregate_array('PFAF_ID').distinct());if(!valid())return;
  const codes=[...new Set((regions||[]).map(value=>String(value).slice(0,1)))],available=codes.filter(code=>assets[code]);
  if(!available.length){window.siegeHydrology.basinsFailed(codes.length?'No configured MERIT catchment file covers this region. Upload your boundary to continue.':'No regional catchment coverage was found at this location. Upload your boundary to continue.');return;}
  // Filter each relevant file first. Near a regional seam only the tiny local subsets are merged.
  const subsets=available.map(code=>ee.FeatureCollection(assets[code]).filterBounds(window.basinSearchArea));
  const nearby=subsets.slice(1).reduce((collection,next)=>collection.merge(next),subsets[0]);
  const containing=nearby.filterBounds(window.basinLocationPoint);
  const selected=ee.FeatureCollection(ee.Algorithms.If(containing.size(),containing,nearby)).sort('COMID').limit(1).select(['COMID','unitarea']);
  const result=await evaluate(selected);if(!valid())return;
  const feature=result?.features?.[0];if(!feature){await window.siegeHydrology.basinsChanged([]);return;}
  catchmentCache.push({fingerprint,feature,collection:selected});if(catchmentCache.length>8)catchmentCache.shift();
  await installCatchment(feature,selected);
 }catch(error){if(version===ticket)window.siegeHydrology.basinsFailed(error.message);}
}

window.siegeHydrology={get countryName(){return current.name},fitLocation:()=>{if(place)window.hydroMapBridge.zoom(place.lat,place.lon,place.extent);else if(countryFC)window.hydroMapBridge.country(countryFC);},hasCountry:()=>engine||!!countryFC,canAnalyse:()=>engine&&(analysable||!!window.reservoirAreaSelected),analysisChanged:()=>{analysable=true;window.HydroUX?.sync();},engineLoaded:()=>{engine=true;window.basinLevel='9';window.regionSelect.el.hidden=true;window.yearSelect.el.disabled=true;if($('sidebarHost'))$('sidebarHost').inert=true;applyCountry();if(place)loadBasins();else basinStatus.textContent='';},basinsLoading:()=>{basinReset();basinStatus.textContent='Finding your local catchment…';},basinsChanged:async(labels,preferred=[])=>{
 if(!place||window.SiegAreaSection?.complete)return;
 const version=ticket,value=preferred.find(label=>labels.includes(label))||labels[0];
 if(!value){basinStatus.textContent='No local catchment was found. Upload your boundary to continue.';return;}
 basinStatus.textContent='Preparing your catchment…';
 try{
  await window.selectRegion(value);
  if(version!==ticket)return;
  if(window.hydroCatchmentLimit){basinReset();basinStatus.textContent='The complete catchment is '+(window.hydroCatchmentLimit.areaKm2*100).toLocaleString('en-US',{maximumFractionDigits:0})+' ha. It is shown for context. Upload an area up to '+window.SiegAOIUpload.limitLabel('hydrology')+' for analysis.';return;}
  if(window.selectedBasin!==value){basinStatus.textContent='Catchment found. Check the area limit message or upload a smaller boundary.';return;}
  analysable=true;if($('sidebarHost'))$('sidebarHost').inert=false;window.yearSelect.el.disabled=false;
  window.analysisCaption.setValue('Local catchment · complete boundary');
  window.SiegAreaSection?.ready('Local catchment ready');
  basinStatus.textContent='Catchment ready. Choose a service to continue.';window.HydroUX?.sync();
 }catch(error){if(version===ticket){basinReset();basinStatus.textContent='Your catchment could not be prepared. Retry your location or upload a boundary.';}}
},basinsFailed:message=>{basinReset();basinStatus.textContent=message||'Automatic catchment lookup is temporarily unavailable. Upload a boundary to continue; the overview is still available.';}};
overviewButton.onclick=async()=>{
 const version=++overviewTicket;
 if(overviewShown){window.hydroMapBridge.overview?.(null);overviewShown=false;overviewButton.textContent='View catchment overview';overviewStatus.textContent='';return;}
 if(!place){overviewStatus.textContent='Use current location first to view the surrounding catchment.';return;}
 if(!engine){overviewStatus.textContent='The map service is preparing. Please retry shortly.';return;}
 overviewButton.disabled=true;overviewStatus.textContent='Loading catchment overview…';
 try{
  const area=ee.Geometry.Point([place.lon,place.lat]).buffer(30);
  const geometry=ee.FeatureCollection('WWF/HydroSHEDS/v1/Basins/hybas_9').filterBounds(area).geometry();
  const data=await new Promise((resolve,reject)=>geometry.evaluate((value,error)=>error?reject(Error(String(error))):resolve(value)));
  if(version!==overviewTicket)return;
  if(!window.hydroMapBridge.overview?.(data)){overviewStatus.textContent='No overview boundary was found at this location.';return;}
  overviewShown=true;overviewButton.textContent='Back to local view';overviewStatus.textContent='HydroBASINS L9 overview · your analysis area is unchanged.';
 }catch(error){if(version===overviewTicket)overviewStatus.textContent='Overview unavailable. You can continue with your local area.';}
 finally{if(version===overviewTicket)overviewButton.disabled=false;}
};

window.SiegCurrentLocation?.mount({foundMessage:"Finding your catchment automatically…",contextErrorMessage:"Map zoomed to your location. Retry catchment detection or upload a boundary.",map:window.SiegReportMap,button:$('hydroCurrentLocation'),status:placeStatus,onLocated:async(point,country)=>{invalidateLocation();current=country||{code:'GLOBAL',name:'Current location',iso3:'GLOBAL'};place={lat:point.lat,lon:point.lon,name:'Current location'};$('mapTitle').textContent=current.name+' / Your local catchment';overviewButton.disabled=false;overviewStatus.textContent='';loadCountry(false);placeStatus.textContent='Location found. Your catchment is being prepared automatically.';await loadBasins();}});
})();
