const $=id=>document.getElementById(id); let E,connected=false,active=0,indicator='Land cover',overlay,boundaryLayer,drawLayer,drawPoints=[],drawing=false,request=0,lastResult,selectedRegion;let hasAnalysisPolygon=false,adminRegion=null,analysisMode=null,geometryRevision=0;let countryISO='GLOBAL',countryName='Your area',countryRequest=0,placeMarker;
const modules=[{id:0,name:'Land classification',items:['Land cover','Cover change'],about:'Confidence-screened Dynamic World land cover and comparisons.'},{id:1,name:'Biodiversity',items:['Biodiversity Intactness Index (BII)','Ecosystem condition','Habitat extent and loss','Habitat fragmentation','Canopy height'],about:'Modelled biodiversity, habitat change and vegetation structure.'},{id:6,name:'Land degradation',items:['Land productivity','Land-cover degradation','Persistent bare ground','Erosion susceptibility','Soil organic carbon','Restoration & recovery'],about:'Screen productivity change, surface exposure and potential recovery.'},{id:2,name:'Air quality',items:['Carbon monoxide','Nitrogen dioxide (NO₂)','Absorbing aerosol index'],about:'Atmospheric columns and indices; not ground-level AQI.'},{id:4,name:'Urban growth',items:['Built-up cover','Built-up expansion','Built-up probability','30-day activity'],about:'Screen settlement change with consistent land-cover classifications.'},{id:5,name:'Active fires',items:['Recent thermal detections','Peak fire radiative power','Latest detection age','30-day activity'],about:'Recent VIIRS detections; not confirmed fire incidents or perimeters.'}];
const map=L.map('map',{zoomControl:true}).fitWorld({padding:[12,12],animate:false});window.SiegReportMap=map;window.SiegReportFitPolicy='canvas';window.SiegWorldMap?.mount(map);window.SiegFitMap?.mount(map,()=>!drawing?(drawLayer&&map.hasLayer(drawLayer)?drawLayer.getBounds():boundaryLayer&&map.hasLayer(boundaryLayer)?boundaryLayer.getBounds():null):null,()=>drawing);L.control.scale({imperial:false}).addTo(map);
let satellite=false;let base=L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'© OpenStreetMap contributors',maxZoom:19,className:'sieg-basemap-tiles'}).addTo(map);
function setBasemap(value){if(satellite!==value){satellite=value;map.removeLayer(base);base=L.tileLayer(satellite?'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}':'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:satellite?'Tiles © Esri and imagery providers':'© OpenStreetMap contributors',maxZoom:19,className:'sieg-basemap-tiles'}).addTo(map);const activeBase=base;let errors=0;base.on('tileerror',()=>{if(base===activeBase&&++errors===3)status('Basemap tiles could not load. Check your internet connection or switch the basemap.')})}$('streetView').setAttribute('aria-pressed',String(!satellite));$('satelliteView').setAttribute('aria-pressed',String(satellite))}$('streetView').onclick=()=>setBasemap(false);$('satelliteView').onclick=()=>setBasemap(true);

for(let y=2019;y<=new Date().getUTCFullYear();y++){for(const id of ['year','baseline'])$(id).add(new Option(y,y));}$('year').value=new Date().getUTCFullYear();$('baseline').value='2019';$('copyrightYear').textContent=new Date().getFullYear();

const escapeText=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function status(t){$('status').textContent=t}function number(v,n=1){return typeof v==='number'&&Number.isFinite(v)?v.toLocaleString('en-US',{maximumFractionDigits:n}):'No data'}
let chartJobs=[],indicatorTimer,paidRestoring=false;
function queueIndicator(){clearTimeout(indicatorTimer);if(window.SiegExplicitAnalysis)return;if(paidRestoring)return;if(selectedRegion&&!window.SiegeUsage.matches(selectedRegion)){window.SiegeUsage.ensure(selectedRegion,{preview:true}).catch(e=>status(e.message));return;}if(!connected)return;if(!selectedRegion||!analysisMode){status('Select an Admin 2 area or draw a polygon, then choose an indicator.');return}indicatorTimer=setTimeout(()=>{if(!drawing&&selectedRegion&&analysisMode)$('analyse').onclick();},300);}
const completedEvaluations=new Map();function rememberEvaluation(){if(!lastResult||!analysisMode||drawing)return;const p=lastResult.p;completedEvaluations.set(JSON.stringify([p.module,p.indicator,p.year,p.baseline,p.season,p.scale]),{result:lastResult,geometry:p.region,legendText:$('legend').innerText,descriptions:[...$('notes').children].map(el=>el.textContent).join('\n'),chartText:$('charts').innerText,chartHTML:window.SiegeReportKit?.captureResults?.($('charts'))||$('charts').innerHTML,country:countryName})}
function reset(){const results=$('ecoAnalysisResults');if(results){results.hidden=true;results.style.display='none';}window.SiegMapWorkspace?.clearAnalysisLayers();clearTimeout(indicatorTimer);rememberEvaluation();request++;chartJobs=[];$('analyse').disabled=false;if(E){E.state.token=request;E.state.current=null;}if(overlay){map.removeLayer(overlay);overlay=null}$('legend').hidden=true;$('metrics').replaceChildren();$('charts').replaceChildren();$('notes').replaceChildren();lastResult=null;$('resultTitle').textContent='Ready for a new analysis';$('resultSource').textContent='Settings changed. Analyse the selected area to update results.';status(connected?'Ready to analyse.':'SIEG analysis service is not ready.')}
function changeModule(id){active=id;const m=modules.find(m=>m.id===id);indicator=m.items[0];$('indicator').replaceChildren(...m.items.map(x=>new Option(x,x)));$('about').textContent=m.about;document.querySelectorAll('#modules button').forEach(b=>{b.classList.toggle('active',Number(b.dataset.id)===id);b.setAttribute('aria-pressed',String(Number(b.dataset.id)===id))});sync();reset();queueIndicator()}
$('modules').innerHTML=modules.map((m,i)=>`<button data-id="${m.id}" class="${i===0?'active':''}"><span>0${i+1}</span>${m.name}</button>`).join('');document.querySelectorAll('#modules button').forEach(b=>b.onclick=()=>changeModule(Number(b.dataset.id)));
window.SiegEcoCards?.mount(modules);
function sync(){indicator=$('indicator').value;const recent=active===5||(active===4&&indicator==='30-day activity'),soil=active===6&&indicator==='Soil organic carbon',canopy=active===1&&indicator==='Canopy height';$('soilOptions').hidden=!soil;$('fireOptions').hidden=active!==5;$('recoveryOptions').hidden=!(active===6&&indicator==='Restoration & recovery');$('year').disabled=$('baseline').disabled=recent||soil||canopy;$('season').disabled=recent||soil||canopy||(active===1&&['Biodiversity Intactness Index (BII)','Ecosystem condition'].includes(indicator));}
changeModule(0);$('indicator').onchange=()=>{sync();reset();queueIndicator()};['year','baseline','season','scale','soil','fireDays','fireConfidence','recovery'].forEach(id=>$(id).onchange=()=>{reset();if(selectedRegion)window.SiegeUsage.ensure(selectedRegion,{preview:true}).catch(e=>status(e.message));});
// These adapters expose the original script’s option getters to its calculation functions.
window.soilDepth={getValue:()=>$('soil').value};window.fireDays={getValue:()=>$('fireDays').value};window.fireConfidence={getValue:()=>$('fireConfidence').value};window.recoveryAsset=null;
function providerResult(start){return new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Processing timed out. Try a smaller area or coarser scale.')),120000);try{start((v,e)=>{clearTimeout(timer);e?reject(Error(String(e))):resolve(v)})}catch(e){clearTimeout(timer);reject(e)}})}
function evaluate(x){return providerResult(done=>x.evaluate(done))}
function temporaryStatisticsError(error){return /(?:HTTP(?: code)?[: ]*|code["'\s:]*)(?:429|500|502|503|504)\b|temporar(?:ily|y) (?:unavailable|unreachable)|service unavailable/i.test(String(error?.message||error));}
async function evaluateStatistics(stats,token){
 const analysisId=window.SiegeUsage?.active?.id;
 for(let attempt=0;attempt<2;attempt++){
  if(token!==request||analysisId!==window.SiegeUsage?.active?.id)throw Error('The selected analysis changed.');
  try{return await evaluate(ee.Dictionary(stats));}catch(error){
   if(attempt||!temporaryStatisticsError(error))throw error;
   status('The statistics service is temporarily busy. Retrying statistics; available map and charts are retained…');
   await new Promise(resolve=>setTimeout(resolve,1500));
  }
 }
}

const chartDate=new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'});
function fireChartSummary(card,rows){
 const valid=rows.filter(row=>Number.isFinite(row.value)),total=valid.reduce((sum,row)=>sum+row.value,0);
 const dates=rows.map(row=>row.date).filter(Number.isFinite).sort((a,b)=>a-b);
 const add=(text,className)=>{const p=document.createElement('p');p.className=className;p.textContent=text;card.append(p);};
 if(dates.length)add(chartDate.format(dates[0])+' to '+chartDate.format(dates.at(-1))+' · Daily bucket start (UTC)','eco-fire-chart-period');
 if(valid.length===rows.length&&total===0){
  add('0 qualifying detections across '+valid.length+' daily buckets','eco-fire-chart-total');
  add('Cloud cover and satellite overpass timing can affect detections.','eco-fire-chart-period');
  return true;
 }
 add(number(total,0)+' detection cell-days across '+valid.length+' daily buckets with values','eco-fire-chart-total');
 add('Daily values count occupied detection cells.','eco-fire-chart-period');
 return false;
}
function drawChart(features,x,ys,options,token){return evaluate(features).then(data=>{if(token!==request)return;const rows=(data.features||[]).map(f=>f.properties);if(!rows.some(r=>ys.some(y=>Number.isFinite(r[y])))){const p=document.createElement('p');p.textContent=(options.title||'Chart')+': no valid observations in the selected area.';$('charts').append(p);return}const card=document.createElement('div');card.className=options.siegDailyFire?'chart eco-fire-chart':'chart';const h=document.createElement('h4');h.textContent=options.title||'Indicator observations';card.append(h);if(options.siegDailyFire&&fireChartSummary(card,rows)){$('charts').append(card);return}const max=Math.max(...rows.flatMap(r=>ys.map(y=>Math.abs(r[y]||0))),1e-9);rows.forEach(row=>ys.forEach(y=>{const value=row[y],line=document.createElement('div');line.className='bar-row';const label=document.createElement('span');label.textContent=x==='date'&&Number.isFinite(Number(row[x]))?(options.siegDailyFire?chartDate.format(Number(row[x])):new Date(Number(row[x])).toISOString().slice(0,7)):String(row[x]??'');const bar=document.createElement('i');bar.style.width=Number.isFinite(value)?`${Math.abs(value)/max*100}%`:'0';bar.style.background=value<0?'#b65353':'#087f8c';const val=document.createElement('span');val.textContent=number(value,3);line.append(label,bar,val);card.append(line)}));$('charts').append(card)}).catch(e=>{if(token===request){const p=document.createElement('p');p.textContent='Chart unavailable: '+e.message;$('charts').append(p)}})}
window.note=text=>({text});window.addFeatureChart=(...args)=>{const work=drawChart(...args);chartJobs.push(work);return work};window.resultBody={add(obj){if(obj?.text){const p=document.createElement('p');p.textContent=obj.text;$('notes').append(p)}if(obj&&obj.features)window.addFeatureChart(obj.features,obj.x,obj.ys,obj.options||{},request)}};window.ui={Chart:{feature:{byFeature(features,x,ys){return{features,x,ys,setChartType(){return this},setOptions(o){this.options=o;return this}}}}}};
async function initialize(){await window.SiegeAnalysis.initialize();E=window.createEngine(countryISO,countryName);connected=true;selectedRegion=null;if(window.pendingEcoPolygon){selectedRegion=window.SiegeUsage.attachGeometry(ee.Geometry(window.pendingEcoPolygon),window.pendingEcoPolygon);hasAnalysisPolygon=true;analysisMode='polygon';window.pendingEcoPolygon=null;}status('Connected. Select an indicator and analyse your area.');const geometry=await evaluate(E.country);if(boundaryLayer)map.removeLayer(boundaryLayer);boundaryLayer=L.geoJSON(geometry,{style:{color:'#707070',weight:2,fillOpacity:0}}).addTo(map);if(hasAnalysisPolygon&&drawLayer)window.SiegFitMap.area(map,drawLayer.getBounds());else if(window.ecoNavigationPoint)map.setView([window.ecoNavigationPoint.lat,window.ecoNavigationPoint.lon],16);else if(countryISO==='AFR'||countryRequest===0)map.fitWorld({padding:[12,12],animate:false});else map.fitBounds(boundaryLayer.getBounds());$('mapTitle').textContent=countryName+' / National overview';$('areaName').textContent=countryName==='Africa'?'Africa overview selected':'National overview selected';window.loadEnvAdmin2?.();}
$('area').onchange=async()=>{if(!connected)return;reset();selectedRegion=$('area').value==='country'?E.country:E.admin.filter(ee.Filter.eq('system:index',$('area').value)).geometry(10).intersection(E.country,10);E.state.areaName=$('area').selectedOptions[0].textContent;$('areaName').textContent=E.state.areaName;$('mapTitle').textContent=E.state.areaName;const g=await evaluate(selectedRegion);if(drawLayer)map.removeLayer(drawLayer);drawLayer=L.geoJSON(g,{style:{color:'#087f8c',weight:2,fillOpacity:0}}).addTo(map);window.SiegFitMap.area(map,drawLayer.getBounds())};
const polygonCloser=window.SiegPolygonTools.create(map,()=>drawPoints,finishDraw,status,{service:'eco'});
$('draw').onclick=()=>{window.SiegAreaSection?.reset();polygonCloser.reset();reset();geometryRevision++;completedEvaluations.clear();analysisMode=null;hasAnalysisPolygon=false;selectedRegion=null;drawing=true;drawPoints=[];polygonCloser.start();if(drawLayer){map.removeLayer(drawLayer);drawLayer=null}map.doubleClickZoom.disable();$('draw').textContent='Restart polygon';status('Add at least three corners, then click the first point to close.');};
function finishDraw(){if(drawPoints.length<3){status('Draw at least three vertices, then finish the polygon.');return}if(!window.SiegPolygonTools.validate(drawPoints,status,'eco'))return;polygonCloser.complete();window.SiegFitMap.area(map,drawLayer?.getBounds());if(!connected){window.pendingEcoPolygon={type:'Polygon',coordinates:[[...drawPoints.map(p=>[p.lng,p.lat]),[drawPoints[0].lng,drawPoints[0].lat]]]};drawing=false;map.doubleClickZoom.enable();$('draw').textContent='Draw polygon';window.SiegAreaSection?.ready('Drawn boundary ready');status('Polygon saved. Analysis will be available when the service connects.');return}const ring=drawPoints.map(p=>[p.lng,p.lat]);ring.push(ring[0]);selectedRegion=ee.Geometry.Polygon([ring]).intersection(adminRegion||E.country,10);hasAnalysisPolygon=true;analysisMode='polygon';drawing=false;map.doubleClickZoom.enable();$('draw').textContent='Draw polygon';geometryRevision++;completedEvaluations.clear();E.state.areaName='Drawn area';$('areaName').textContent=adminRegion?'Custom polygon · within selected Admin 2':'Custom polygon · within '+countryName;$('mapTitle').textContent=countryName+' / Drawn area';window.SiegAreaSection?.ready('Drawn boundary ready');status('Polygon finished. Choose an indicator and analyse your selected area.');}
map.on('click',async e=>{if(drawing){if(polygonCloser.handle(e.latlng))return;drawPoints.push(e.latlng);if(drawLayer)map.removeLayer(drawLayer);drawLayer=L.polygon(drawPoints,{color:'#087f8c',weight:2,fillOpacity:0}).addTo(map);return}if(!E?.state.current)return;const token=request,d=E.state.current;try{const v=await evaluate(d.image.clip(selectedRegion).reduceRegion({reducer:ee.Reducer.first(),geometry:ee.Geometry.Point([e.latlng.lng,e.latlng.lat]),scale:d.scale,crs:E.CONFIG.crs,maxPixels:10000}));if(token!==request)return;L.popup().setLatLng(e.latlng).setContent(`${escapeText(d.title)}<br><b>${escapeText(number(v.value,4))}</b> ${escapeText(d.units)}`).openOn(map)}catch(err){status('Point inspection unavailable: '+err.message)}});map.on('mousemove',e=>$('coords').textContent=`${e.latlng.lat.toFixed(3)}° · ${e.latlng.lng.toFixed(3)}°`);
$('home').onclick=()=>{window.SiegAreaSection?.reset();adminRegion=null;reset();geometryRevision++;completedEvaluations.clear();analysisMode=null;hasAnalysisPolygon=false;if(drawLayer)map.removeLayer(drawLayer);drawing=false;polygonCloser.reset();drawPoints=[];map.doubleClickZoom.enable();$('draw').textContent='Draw polygon';$('area').value='country';selectedRegion=null;if(E)E.state.areaName=countryName;$('areaName').textContent=countryName==='Africa'?'Africa overview selected':'National overview selected';$('mapTitle').textContent=countryName+' / National overview';map.fitWorld({padding:[12,12],animate:false})};$('clear').onclick=()=>{reset();completedEvaluations.clear()};
function legend(d){const el=$('legend');el.style.width=d.categories?'':'320px';el.replaceChildren();const title=document.createElement('b');title.textContent=d.title;el.append(title);if(d.categories)d.categories.forEach(c=>{const row=document.createElement('div');row.className='legend-row';const sw=document.createElement('span');sw.className='swatch';sw.style.background='#'+c.color.replace('#','');const label=document.createElement('span');label.textContent=c.name;row.append(sw,label);el.append(row)});else{el.replaceChildren(window.SiegLegend.create({title:d.title,units:d.units,palette:d.vis.palette,min:d.vis.min,max:d.vis.max}))}el.hidden=false}
$('analyse').onclick=async()=>{
 if(window.SiegExplicitAnalysis&&!window.SiegExplicitAnalysis.allowed()){status('Choose indicators, then click Start analysis.');return;}
  if(drawing||!selectedRegion||!analysisMode){status('Select an Admin 2 area, or finish drawing a polygon before analysing.');$('draw').focus();return}
  if(!connected){status('The analysis service is still loading. Please try again shortly.');return}
  reset();const token=request;
  E.refreshClock();E.state.token=token;E.setRegion(selectedRegion);E.state.module=active;E.state.table=ee.FeatureCollection([]);
  const p={year:Number($('year').value),baseline:Number($('baseline').value),season:$('season').value,region:selectedRegion,areaName:E.state.areaName||countryName,scale:Number($('scale').value),indicator,module:active};
  E.state.analysisYear=p.year;
  const recent=active===5||(active===4&&indicator==='30-day activity'),staticOnly=active===6&&indicator==='Soil organic carbon',canopy=active===1&&indicator==='Canopy height';
  if(!recent&&!staticOnly&&!canopy&&p.baseline>=p.year){status('Choose a baseline earlier than the analysis year.');return}
  if(active===6&&['Land productivity','Restoration & recovery'].includes(indicator)&&p.year-p.baseline<3){status('NDVI trends need at least four years including endpoints.');return}
  $('analyse').disabled=true;status('Computing '+indicator+'…');
  try{
    if(!await window.SiegeUsage.ensure(p.region)||token!==request)return;
    window.SiegeUsage.setType?.(active===5&&p.indicator==='30-day activity'?'Fire activity':p.indicator);
    let d;
    const recoveryID=active===6&&indicator==='Restoration & recovery'?$('recovery').value.trim():'';
    if(recoveryID){
      if(!/^projects\/[^/]+\/assets\/.+/.test(recoveryID))throw Error('Enter a valid recovery asset ID, or leave it empty to calculate recovery.');
      const img=ee.Image(recoveryID),meta=await evaluate(img.toDictionary(['recovery_key']));
      if(token!==request)return;
      if(meta.recovery_key!==E.recoveryKey(p))throw Error('Recovery asset settings do not match this area, period and season.');
      window.recoveryAsset={image:img,key:meta.recovery_key};d=E.savedRecovery(p);
    }else {
      const settings=['year','baseline','season','scale','soil','fireDays','fireConfidence','recovery'].map(id=>[id,$(id)?.value]);
      const build=()=>E.builders[p.module](p);
      d=window.SiegAnalysisReuse?await window.SiegAnalysisReuse.run(['eco-builder-v6-landcover-mode',countryISO,p.module,p.indicator,p.region.serialize(),settings,p.year===new Date().getUTCFullYear()?new Date().toISOString().slice(0,10):'historical'],build,{ttl:300000}):build();
    }
    if(token!==request)return;
    p.periodEnd=p.year===new Date().getUTCFullYear()?new Date().toISOString().slice(0,10):p.year+'-12-31';
    d.notes.unshift('Coarse-grid indicators provide regional context: for small boundaries, the centroid source cell is used when an area mean is unavailable. Area coverage uses a finer integration grid for small polygons; this does not increase the source data resolution. Missing observations are not filled.');
    d.notes.unshift('Requested period: '+p.year+'-01-01 to '+p.periodEnd+(p.year===new Date().getUTCFullYear()?' (year to date). Provider publication lag applies; missing data are not filled. Comparisons and trends use matched calendar windows; partial-year values are not annual totals.':'')+' Fixed/reference datasets retain their published dates.');
    d.params=p;E.state.current=d;
    const results=$('ecoAnalysisResults');if(results){results.hidden=false;results.style.removeProperty('display');}$('resultTitle').textContent=d.title;$('resultSource').textContent=d.source;
    d.notes.forEach(n=>{const el=document.createElement('p');el.textContent=n;$('notes').append(el)});
    // A map permission, tile or rendering failure must not suppress statistics/charts.
    const mapTask=(async()=>{
      const mapInfo=await providerResult(done=>d.image.clip(p.region).getMap(d.vis,done));
      if(token!==request)return;
      const tiles=mapInfo.urlFormat||mapInfo.tile_fetcher?.url_format||location.origin+'/api/earth-engine/v1/'+(mapInfo.mapid||mapInfo.name)+'/tiles/{z}/{x}/{y}';
      overlay=L.tileLayer(tiles,{opacity:.88,attribution:'Google Earth Engine · '+d.source}).addTo(map);overlay.once('load',()=>{if(token===request){document.dispatchEvent(new CustomEvent("sieg-guide-progress",{detail:{key:"result"}}));}});
      const liveOverlay=overlay;window.SiegHoverInspector?.register({map,image:d.image.clip(p.region),vis:d.vis,name:d.title,layer:()=>liveOverlay,visible:()=>map.hasLayer(liveOverlay),drawing:()=>drawing,legend:{title:d.title,units:d.units,palette:d.vis.palette,min:d.vis.min,max:d.vis.max,items:(d.categories||[]).map((c,i)=>({label:c.name,value:c.value??(Number(d.vis.min)+i),color:c.color}))}});window.SiegMapWorkspace?.registerLayer({name:d.title||'Selected analysis',setVisible:value=>value?liveOverlay.addTo(map):liveOverlay.remove()});
      overlay.on('tileerror',()=>{if(token===request)status('Map tiles could not load. Available statistics and charts are shown below.');});
      legend(d);
    })();
    const statsTask=(async()=>{
      d.stats.area_ha=p.region.area(100).divide(10000);
      d.stats.valid_indicator_ha=E.sumArea(d.supportMask||d.image.mask(),p.region,Math.max(p.scale,d.scale));
      d.stats.valid_pct=ee.Number(d.stats.valid_indicator_ha).divide(d.stats.area_ha).multiply(100);
      if(d.collection){d.stats.source_count=d.collection.size();d.stats.latest_source_time=d.collection.aggregate_max('system:time_start')}
      const values=await evaluateStatistics(d.stats,token);if(token!==request)return;
      lastResult={p,d,values};
      const cards=[{key:'area_ha',title:'Selected area',unit:'ha'},...d.cards,...(d.hideCoverage?[]:[{key:'valid_pct',title:d.coverageTitle||'Indicator coverage',unit:'%',decimals:1}])];
      cards.forEach(c=>{const div=document.createElement('div');div.className='metric';div.innerHTML=`<span>${escapeText(c.title)}</span><strong>${escapeText(number(values[c.key],c.decimals??0))}<small>${escapeText(c.unit)}</small></strong>`;$('metrics').append(div)});
      return values;
    })();
    // Charts manage their own errors and may complete independently of the map.
    try{if(d.charts)d.charts(token)}catch(e){const note=document.createElement('p');note.textContent='Chart unavailable: '+e.message;$('charts').append(note)}
    const outputs=await Promise.allSettled([mapTask,statsTask,...chartJobs]);if(token!==request)return;
    const failures=outputs.map((r,i)=>r.status==='rejected'?(i===0?'Map':'Statistics')+': '+window.SiegeAnalysis.message(r.reason):null).filter(Boolean);
    if(failures.length)status(failures.join(' · ')+'. Other available outputs remain visible.');
    else{status(d.resultMessage?d.resultMessage(outputs[1].value||{}):outputs[1].value?.valid_indicator_ha>0?(window.SiegeUsage.active?.freeClassification?'Free Land classification preview complete. Request a report to continue.':'Analysis complete.'):(d.emptyMessage||'No usable observations for this indicator in the selected area and period. Try another period or indicator; missing data have not been filled.'));rememberEvaluation();if(typeof window.SiegEcoScheduleReport!=='function')throw Error('Report startup tools did not load. Reload Eco and retry Request report.');void window.SiegEcoScheduleReport().catch(error=>status('Report preparation: '+error.message));}
  }catch(e){if(token===request)status('Analysis unavailable: '+window.SiegeAnalysis.message(e))}
  finally{if(token===request)$('analyse').disabled=false}
};

initialize().catch(e=>status(e.message));
window.siegeEnviro={isReady:()=>connected,setPlace:(lat,lon,label)=>{map.setView([lat,lon],13);if(placeMarker)placeMarker.remove();placeMarker=L.circleMarker([lat,lon],{radius:7,color:'#fff',weight:2,fillColor:'#218b8c',fillOpacity:1}).addTo(map).bindPopup(document.createTextNode(label)).openPopup()},zoomLocation:(lat,lon,extent)=>{if(Array.isArray(extent)&&extent.length===4)map.fitBounds([[extent[1],extent[0]],[extent[3],extent[2]]]);else map.setView([lat,lon],5)},setCountry:async(name,iso,options={})=>{window.SiegAreaSection?.reset();countryISO=iso||'AFR';countryName=name;adminRegion=null;const ticket=++countryRequest;reset();geometryRevision++;completedEvaluations.clear();analysisMode=null;hasAnalysisPolygon=false;drawing=false;polygonCloser.reset();drawPoints=[];$('draw').textContent='Draw polygon';map.doubleClickZoom.enable();if(drawLayer){drawLayer.remove();drawLayer=null}selectedRegion=null;$('mapTitle').textContent=name+' / National overview';$('areaName').textContent='Country selected: '+name;if(!connected)return;try{E=window.createEngine(countryISO,countryName);selectedRegion=null;const g=await evaluate(E.country);if(ticket!==countryRequest)return;if(boundaryLayer)boundaryLayer.remove();boundaryLayer=L.geoJSON(g,{style:{color:'#707070',weight:2,fillOpacity:0}}).addTo(map);if(options.zoom!==false)map.fitBounds(boundaryLayer.getBounds())}catch(e){if(ticket===countryRequest)status('Country boundary unavailable: '+e.message)}}};


window.siegeEnvironmentalEvaluation=()=>!drawing&&analysisMode&&lastResult?{result:lastResult,geometry:lastResult.p.region,legendText:$('legend').innerText,descriptions:[...$('notes').children].map(el=>el.textContent).join('\n'),chartText:$('charts').innerText,chartHTML:window.SiegeReportKit?.captureResults?.($('charts'))||$('charts').innerHTML,country:countryName}:null;

window.selectEnvAdmin2=async(id,label)=>{if(!connected||!E?.admin)return;reset();geometryRevision++;completedEvaluations.clear();const revision=geometryRevision,ticket=countryRequest;analysisMode=null;hasAnalysisPolygon=false;adminRegion=null;selectedRegion=null;drawing=false;polygonCloser.reset();drawPoints=[];$('draw').textContent='Draw polygon';map.doubleClickZoom.enable();if(drawLayer){drawLayer.remove();drawLayer=null}const region=E.admin.filter(ee.Filter.eq('system:index',id)).geometry(10);const g=await evaluate(region);if(ticket!==countryRequest||revision!==geometryRevision)return;adminRegion=region;selectedRegion=region;analysisMode='admin2';E.state.areaName=countryName+' / '+label;$('areaName').textContent=label+' · Admin 2 analysis area';$('mapTitle').textContent=countryName+' / '+label;drawLayer=L.geoJSON(g,{style:{color:'#218b8c',weight:2,fillOpacity:0}}).addTo(map);window.SiegFitMap.area(map,drawLayer.getBounds());status('Analyse the selected Admin 2, or draw a polygon for a specific area within it.');window.SiegLocator?.collapse(label);window.SiegAreaSection?.ready(label+' · Admin 2 boundary');};
window.envAdminContext=()=>({connected,engine:E,iso:countryISO,name:countryName});

window.siegeEnvironmentalEvaluations=()=>{if(drawing||!analysisMode)return [];rememberEvaluation();return [...completedEvaluations.values()]};

window.SiegeUsage.getGeometry=()=>selectedRegion;

window.SiegeUsage.restoreGeometry=g=>{selectedRegion=window.SiegeUsage.attachGeometry(ee.Geometry(g),g);analysisMode='polygon';hasAnalysisPolygon=true;drawing=false;drawLayer?.remove();drawLayer=L.geoJSON(g,{style:{color:'#218b8c',fillOpacity:0,weight:3}}).addTo(map);window.SiegFitMap.area(map,drawLayer.getBounds());if(E)E.state.areaName='Selected AOI';$('areaName').textContent='Selected AOI · boundary locked for this request';window.SiegAreaSection?.ready('Saved boundary ready');};

window.addEventListener('unhandledrejection',event=>{event.preventDefault();status('Action could not complete: '+String(event.reason?.message||event.reason||'Please try again.'));});

window.SiegAOIUpload?.mount({after:$('ecoBoundaryUploadMount'),service:'eco',label:'Upload AOI boundary',apply:async (g,name)=>{const areaName=name==='Map canvas AOI'?name:'Uploaded boundary';polygonCloser.reset();reset();geometryRevision++;completedEvaluations.clear();adminRegion=null;analysisMode='polygon';hasAnalysisPolygon=true;drawing=false;drawPoints=[];map.doubleClickZoom.enable();$('draw').textContent='Draw polygon';drawLayer?.remove();drawLayer=L.geoJSON(g,{style:{color:'#218b8c',fillOpacity:0,weight:3}}).addTo(map);window.SiegFitMap.area(map,drawLayer.getBounds());if(connected){selectedRegion=window.SiegeUsage.attachGeometry(ee.Geometry(g),g);E.state.areaName=areaName;}else{selectedRegion=null;window.pendingEcoPolygon=g;}$('areaName').textContent=areaName+' · exact analysis area';$('mapTitle').textContent=areaName;status(areaName+' ready. Choose an indicator to analyse.');}});



// Tuck optional settings away when returning to indicator analysis; retain input values.
$('modules').addEventListener('click',event=>{if(event.target.closest('button'))$('ecoAnalysisSetup').open=false;});
$('analyse').addEventListener('click',()=>{$('ecoAnalysisSetup').open=false;});

// Render each saved evaluation on the same dashboard canvas; restore the visitor's layer afterwards.
function ecoBoundaryKey(geometry){
 const g=geometry?.type==='Feature'?geometry.geometry:geometry;
 return g&&['Polygon','MultiPolygon'].includes(g.type)?JSON.stringify([g.type,g.coordinates]):null;
}
async function ecoReportGeometry(snapshot){
 const selected=selectedRegion,revision=geometryRevision;
 if(drawing||!selected||!snapshot?.geometry)throw Error('The analysis area changed. Select the report analyses again.');
 const local=geometry=>geometry.siegLocalGeometry||(typeof geometry.type==='string'?geometry:null);
 const raw=local(snapshot.geometry)||await evaluate(snapshot.geometry);
 if(snapshot.geometry!==selected){const current=local(selected)||await evaluate(selected);if(!ecoBoundaryKey(raw)||ecoBoundaryKey(raw)!==ecoBoundaryKey(current))throw Error('The analysis area changed. Select the report analyses again.');}
 if(drawing||selectedRegion!==selected||geometryRevision!==revision)throw Error('The analysis area changed. Select the report analyses again.');
 return raw;
}
window.siegeEcoReportMap=async (snapshot,basemapSession)=>{
 const reportGeometry=await ecoReportGeometry(snapshot);
 const visibleRecords=(window.SiegMapWorkspace?.availableLayers?.()||[]).filter(r=>r.shown),previous=overlay,previousVisible=previous&&map.hasLayer(previous),oldLegend=$('legend').innerHTML,oldHidden=$('legend').hidden;
 let reportLayer;
 try{
  const d=snapshot.result.d,info=await providerResult(done=>d.image.clip(snapshot.geometry).getMap(d.vis,done));
  const tiles=info.urlFormat||info.tile_fetcher?.url_format||location.origin+'/api/earth-engine/v1/'+(info.mapid||info.name)+'/tiles/{z}/{x}/{y}';
  visibleRecords.forEach(r=>r.setVisible(false));if(previous)map.removeLayer(previous);
  reportLayer=L.tileLayer(tiles,{opacity:.88,attribution:'Google Earth Engine · '+d.source}).addTo(map);legend(d);
  return await window.SiegeReportKit.capture({geometry:reportGeometry,basemapSession,requiredLayer:reportLayer,printAnalysis:true,fitArea:true,title:d.title,source:d.source,legend:d.categories?(snapshot.legendText||$('legend').innerText):'',legendSpec:d.categories?{title:d.title,items:d.categories.map(c=>({color:c.color,label:c.name}))}:{title:d.title,units:d.units,palette:d.vis.palette||[],min:d.vis.min,max:d.vis.max}});
 }finally{
  if(reportLayer)map.removeLayer(reportLayer);
  visibleRecords.forEach(r=>r.setVisible(r.shown));if(previousVisible&&!map.hasLayer(previous))previous.addTo(map);
  $('legend').innerHTML=oldLegend;$('legend').hidden=oldHidden;
 }
};

window.SiegeUsage.getScope=()=>({task:({0:'land-classification',1:'biodiversity',6:'land-degradation',2:'air-quality',4:'urban-growth',5:'active-fires'})[active],year:Number($('year').value),countryCode:countryISO,countryName});
window.SiegEcoRunIndicator=async(id,value)=>{const before=paidRestoring;paidRestoring=true;clearTimeout(indicatorTimer);try{changeModule(Number(id));$('indicator').value=value;sync();reset();await $('analyse').onclick();if(!lastResult||lastResult.p.indicator!==value||lastResult.p.module!==Number(id))throw Error('The selected indicator did not complete. Retry this indicator.');}finally{paidRestoring=before;}};
const ecoPaidRuns=new Map();window.SiegeUsage.resumePaid=async j=>{if(!window.SiegeUsage.active?.paymentVerified&&!window.SiegeUsage.active?.adminUnrestricted)throw Error('Payment must be verified before processing.');const runKey=JSON.stringify([j.id,window.SiegIndicatorSelection?.items()]);if(ecoPaidRuns.has(runKey))return ecoPaidRuns.get(runKey);const work=(async()=>{if(!window.SiegIndicatorSelection?.configured())window.SiegEcoSelection?.restore(j.reportItems||[j.task]);if(j.displayContext?.countryCode){countryISO=j.displayContext.countryCode;countryName=j.displayContext.countryName||countryName;E=window.createEngine(countryISO,countryName);}window.SiegEcoBatchRunning=true;paidRestoring=true;try{$('year').value=String(j.year);window.SiegeUsage.restoreGeometry(j.geometry);if(!window.SiegIndicatorSelection?.configured()&&j.indicatorSelections?.length)window.SiegIndicatorSelection?.restore(j.indicatorSelections);if(window.SiegIndicatorSelection?.items().length){await window.SiegIndicatorSelection.process();}else{const types={'land-classification':0,biodiversity:1,'land-degradation':6,'air-quality':2,'urban-growth':4,'active-fires':5};for(const task of j.reportItems||[j.task]){const id=types[task];if(id===undefined)continue;changeModule(id);await $('analyse').onclick();if(!lastResult?.values)throw Error('The selected service did not finish. Your paid access is retained.');}}}finally{paidRestoring=false;window.SiegEcoBatchRunning=false;}return window.SiegPreparingReport?true:window.SiegEcoDeliverPaid?.(true);})();ecoPaidRuns.set(runKey,work);try{return await work}catch(error){ecoPaidRuns.delete(runKey);throw error}};

window.addEventListener('siege-admin-mode-changed',()=>{reset();completedEvaluations.clear();});

window.SiegEcoPreviewClassification=async()=>{if(!selectedRegion)throw Error('Define your analysis area first.');paidRestoring=true;try{changeModule(0);if(!await window.SiegeUsage.ensure(selectedRegion,{freeClassification:true}))return;}finally{paidRestoring=false;}await $('analyse').onclick();};
