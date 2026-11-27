/* Retain each selected indicator's completed output instead of exporting only the last map. */
(()=>{'use strict';const snapshots=new Map();
const context=()=>JSON.stringify([window.SiegeUsage.active?.geometry,Number(window.year)]);
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
window.SiegHydroRunIndicator=async(group,item)=>{
 if(!window.aoi||!window.siegeHydrology?.canAnalyse())throw Error('Define your area first.');
 const geometry=window.aoi,year=Number(window.year),scope=context();
 const manual=['river-flow','reservoir','river-scenario','dam-scenario','ground','export','wetlands'].includes(item.hydroAction);
 if(manual){
  let summary='',html='';const flood=window.hydroFloodSummary,validation=window.hydroValidationSummary;
  if(['river-scenario','dam-scenario'].includes(item.hydroAction)&&flood?.geometry===geometry&&flood.year===year&&flood.type===(item.hydroAction==='river-scenario'?'river':'dam'))summary=flood.summary;
  if(item.hydroAction==='ground'&&validation?.geometry===geometry&&validation.year===year)summary=validation.summary;
  if(['river-flow','reservoir'].includes(item.hydroAction)&&window.hydraulicResults){
   await window.SiegReportKitReady();const data=await window.SiegeReportKit.evaluate(window.hydraulicResults),rows=(data.features||[]).map(f=>f.properties||{}).filter(r=>item.hydroAction==='river-flow'?r.method==='Manning_SI':r.method!=='Manning_SI');
   if(rows.length){const esc=window.SiegeReportKit.escape;html='<table><tbody>'+rows.flatMap(r=>Object.entries(r).map(([k,v])=>'<tr><th>'+esc(k.replaceAll('_',' '))+'</th><td>'+esc(v)+'</td></tr>')).join('')+'</tbody></table>';}
  }
  if(summary||html){await window.SiegReportKitReady();const geo=await window.SiegeReportKit.evaluate(geometry);snapshots.set(group+'::'+item.hydroAction,{scope,group,value:item.hydroAction,label:item.label,html:html||'<pre>'+window.SiegeReportKit.escape(summary)+'</pre>',image:'',geometry:geo,year});return;}
  window.SiegHydroSelectModule(group);await window.HydroConditions.action(item.hydroAction);
  throw Error('This tool is selected. Complete its measurements or tool inputs before requesting its results.');
 }
 window.SiegHydroSelectModule(group);
 window.activeProduct=null;window.hydroConditionsReport=null;window.results?.clear();
 await window.HydroConditions.action(item.hydroAction);

 const start=Date.now();await pause(250);
 while(document.querySelector('.gee-computation-status')?.dataset.state==='busy'||/Calculating area summary/.test(window.results?.el?.textContent||'')){
  if(scope!==context()||geometry!==window.aoi)throw Error('Area or year changed. Select this indicator again.');
  if(Date.now()-start>180000)throw Error('This indicator is still processing. Retry without paying again.');await pause(150);
 }
 if(scope!==context())throw Error('Area or year changed.');
 await window.SiegReportKitReady();await window.SiegeReportKit.waitForCharts(window.results?.el);
 const condition=window.hydroConditionsReport,product=window.activeProduct;
 const html=condition?.geometry===geometry?condition.html:window.SiegeReportKit.captureResults(window.results?.el);
 if(!html||(!product&&!condition&&item.hydroAction!=='basins'))throw Error('No completed output was returned. Review this indicator and retry.');
 let image='';const geo=await window.SiegeReportKit.evaluate(geometry);
 if(product?.image)image=await window.SiegeReportKit.map(product.image,{min:product.min,max:product.max,palette:product.palette},geometry,{geometry:geo,fitArea:true,title:item.label,legendSpec:{title:product.title,palette:product.palette,min:product.min,max:product.max,items:product.legendItems||[]},source:product.description||'See indicator source notes'});
 else if(item.hydroAction==='delineation')image=await window.SiegeReportKit.capture({geometry:geo,fitArea:true,title:item.label,source:'MERIT-Basins v0.7 / v01 · precomputed river reaches'});
 else if(item.hydroAction==='basins')image=await window.SiegeReportKit.capture({geometry:geo,fitArea:true,title:item.label,source:'Selected catchment boundary'});
 snapshots.set(group+'::'+item.hydroAction,{scope,group,value:item.hydroAction,label:item.label,html,image,geometry:geo,year});
};
window.SiegHydroSelectedResults=()=>{
 const selected=window.SiegIndicatorSelection?.items()||[];
 return selected.map(c=>snapshots.get(c.group+'::'+c.value)).filter(s=>s&&s.scope===context());
};
})();
