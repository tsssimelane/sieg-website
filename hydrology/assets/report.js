(()=>{'use strict';const $=id=>document.getElementById(id),escape=value=>String(value??'').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));const options={kind:'report',service:'hydrology',items:()=>[{id:'conditions',label:'Water conditions and balance findings',disabled:!window.hydroConditionsReport||window.hydroConditionsReport.geometry!==window.aoi||window.hydroConditionsReport.year!==window.year},{id:'analysis',label:window.activeProduct?.title||'Current indicator analysis',disabled:!window.activeProduct},{id:'map',label:'Visible analysis map',disabled:!window.aoi},{id:'flood',label:'Flood Watch scenario',disabled:!window.hydroFloodSummary||window.hydroFloodSummary.geometry!==window.aoi},{id:'validation',label:'Ground-record comparison',disabled:!window.hydroValidationSummary||window.hydroValidationSummary.geometry!==window.aoi||window.hydroValidationSummary.year!==Number(window.year)}],build:async (contact,selected)=>{if(!window.SiegReportKitReady)throw Error('Report tools did not load. Reload this service and retry.');await window.SiegReportKitReady();if(window.SiegIndicatorSelection?.items().length){
 await window.SiegIndicatorSelection.process();
 const chosen=window.SiegIndicatorSelection.items(),rows=window.SiegHydroSelectedResults();
 requireSelectedResults(chosen,rows);
 const geometry=rows[0].geometry,esc=escape;
 let body='<h1>SIEG Hydrology — Analysis Report</h1><p>'+esc(contact.name)+' · '+esc(contact.email)+'</p>';
 for(const row of rows)body+='<section><h2>'+esc(row.label)+'</h2><p>'+esc(row.group)+' · '+row.year+'</p>'+(row.image?'<img src="'+row.image+'" alt="'+esc(row.label)+' map">':'')+row.html+'</section>';
 body+='<h2>Selected geometry</h2><pre>'+esc(JSON.stringify(geometry,null,2))+'</pre>';
 const html=await window.SiegeReportKit.wrap('<!doctype html><html><head><title>SIEG Hydrology Report</title></head><body>'+body+'</body></html>',{title:'SIEG Hydrology — Analysis Report',geometry});
 return [await window.SiegeDelivery.file(html,'SIEG_Hydrology_Report.html')];
 }if(!await window.SiegeUsage.matchesAsync(window.aoi))throw Error('Select and authorize the Hydrology services before preparing the report.');if(selected.includes('analysis')&&!window.activeProduct)throw Error('Run the selected indicator before requesting its report.');if(selected.includes('flood')&&(!window.hydroFloodSummary||window.hydroFloodSummary.geometry!==window.aoi))throw Error('Run Flood Watch for this analysis area again.');if(selected.includes('validation')&&(!window.hydroValidationSummary||window.hydroValidationSummary.geometry!==window.aoi||window.hydroValidationSummary.year!==Number(window.year)))throw Error('Complete ground validation for this area and year first.');if(selected.includes('conditions')&&(!window.hydroConditionsReport||window.hydroConditionsReport.geometry!==window.aoi||window.hydroConditionsReport.year!==window.year))throw Error('Run conditions for the selected area and year first.');await window.SiegeReportKit.waitForCharts(window.results?.el);let summary='';if(!window.siegeHydrology?.canAnalyse()||!window.aoi)throw Error('Complete an analysis for a selected basin or polygon before requesting a report.');const flood=window.hydroFloodSummary,floodText=flood&&flood.geometry===window.aoi?flood.summary:'No current flood scenario supplied.';const validation=window.hydroValidationSummary,validationText=validation&&validation.geometry===window.aoi&&validation.year===Number(window.year)?validation.summary:'No matching ground validation supplied.';const analysedGeometry=window.aoi,analysedProduct=window.activeProduct,analysedText=(window.results?.el?[...window.results.el.children].map(el=>el.innerText||el.textContent).join('\n'):''),analysedLegend=window.legend?.el?.innerText||'',analysedHTML=window.SiegeReportKit.captureResults(window.results?.el);const country=window.siegeHydrology?.countryName||'',basin=$('hydroBasin')?.value||'Not selected',module=window.activeTab||'Not selected',year=window.year||'Not selected';let geometry=null,results='No completed analysis was supplied with this request.';if(window.siegeHydrology?.canAnalyse()&&window.aoi){results=analysedText||'No visible analysis results.';try{geometry=await Promise.race([new Promise((resolve,reject)=>analysedGeometry.evaluate((value,error)=>error?reject(Error(error)):resolve(value))),new Promise((_,reject)=>setTimeout(()=>reject(Error('Geometry lookup timed out')),15000))])}catch{throw Error('The analysed geometry could not be retrieved. Please rerun the analysis.')}}
window.SiegeReportKit.requireAOI(geometry);let mapHTML='';if(!selected.includes('map')){}else if(analysedProduct?.image){try{const image=await window.SiegeReportKit.map(analysedProduct.image,{min:analysedProduct.min,max:analysedProduct.max,palette:analysedProduct.palette},analysedGeometry,{geometry,fitArea:true,title:analysedProduct.title||module,legendSpec:{title:analysedProduct.title||module,palette:analysedProduct.palette||[],min:analysedProduct.min,max:analysedProduct.max,items:analysedProduct.legendItems||(['water','built','crops','restoration'].includes(analysedProduct.key)?[{label:analysedProduct.title,color:analysedProduct.palette[0]}]:[])},source:analysedProduct.description||'Earth Engine · see hydrological source notes'});mapHTML='<h2>Analysis map</h2><img src="'+image+'" alt="Hydrological map clipped to the analysed area">'}catch(error){throw Error('The selected report map could not be generated: '+error.message)}}else{mapHTML='<h2>Analysed area map</h2><img src="'+await window.SiegeReportKit.capture({geometry,fitArea:true,title:'Analysed hydrological area',source:'Selected HydroBASINS boundary or user polygon',legend:analysedLegend||'Visible basin boundary and dashboard layers.'})+'" alt="Analysed area">'}const details={name:contact.name,email:contact.email,cellphone:contact.dial+' '+contact.phone,location:contact.location,country,basin,module,year,notes:contact.notes,prepared_at:new Date().toISOString()};summary='<!doctype html><html lang="en"><head><meta charset="utf-8"><title>SIEG Hydrology Analysis Report</title><style>body{font:14px Arial;color:#0b2338;line-height:1.7;max-width:850px;margin:40px auto;padding:25px}h1,h2{color:#218b8c}pre{white-space:pre-wrap;overflow-wrap:anywhere}</style></head><body><h1>SIEG Hydrology — Analysis Report</h1><h2>Request details</h2><pre>'+escape(JSON.stringify(details,null,2))+'</pre><h2>Available analysis summary</h2>'+(analysedHTML||'<p>'+escape(results)+'</p>')+'<h2>Water conditions and balance</h2>'+(window.hydroConditionsReport?.html||'<p>'+escape(window.hydroConditionsReport?.text||'No conditions analysis selected.')+'</p>')+'<h2>Flood Watch scenario</h2><pre>'+escape(floodText)+'</pre><h2>Ground-record comparison</h2><pre>'+escape(validationText)+'</pre><h2>Interpretation and limitations</h2><p>'+escape(analysedProduct?.description||'See the source notes for the selected indicator.')+'</p><p>Values can be missing where observations are unavailable. The analysis year controls climate and optical layers; static reference layers retain their source dates.</p>'+mapHTML+'<h2>Selected geometry</h2><pre>'+escape(JSON.stringify(geometry,null,2))+'</pre><p>This report contains the selected completed analyses for the stated area. It is a decision-support assessment, not a certified engineering evaluation. Dataset coverage and screening limitations apply.</p></body></html>';
summary=window.SiegeDelivery.filterSections(summary,selected,{'Water conditions and balance':'conditions','Available analysis summary':'analysis','Flood Watch scenario':'flood','Ground-record comparison':'validation','Interpretation and limitations':'analysis','Analysis map':'map','Analysed area map':'map'});summary=await window.SiegeReportKit.wrap(summary,{title:'SIEG Hydrology — Analysis Report',geometry});return [await window.SiegeDelivery.file(summary,'SIEG_Hydrology_Report.html')]}};
function requireSelectedResults(chosen,rows){
 const missing=chosen.filter(choice=>!rows.some(row=>row.group===choice.group&&row.value===choice.value));
 if(missing.length)throw Error('These Hydrology layers still need results or tool inputs: '+missing.map(choice=>choice.label||choice.value).join(', ')+'. Complete them and retry without paying again.');
}
window.SiegHydroScheduleReport=()=>{
 const active=window.SiegeUsage?.active;
 if(active?.service!=='hydrology'||(!active.paymentVerified&&!active.adminUnrestricted))return;
 return window.SiegeDelivery.loadReport(options,{automatic:true});
};
// Finish the selected Hydrology action before reading its report sections.
window.SiegHydroPrepareReport=async job=>{
 if(!window.SiegIndicatorSelection?.configured()&&job.indicatorSelections?.length)window.SiegIndicatorSelection?.restore(job.indicatorSelections);
 if(window.SiegIndicatorSelection?.items().length){await window.SiegIndicatorSelection.process();requireSelectedResults(window.SiegIndicatorSelection.items(),window.SiegHydroSelectedResults());return;}
 if(window.SiegeUsage.active?.id!==job.id)throw Error('The selected Hydrology analysis changed.');
 const same=window.hydroConditionsReport?.geometry===window.aoi&&window.hydroConditionsReport?.year===window.year;
 if(same||window.activeProduct||window.hydroFloodSummary?.geometry===window.aoi)return;
 if(!window.aoi||!window.siegeHydrology?.canAnalyse())throw Error('Define the catchment before processing its report.');
 const action=job.task==='flood-risk-screening'?'runoff':job.task==='farm-water-assessment'?'wetness':null;
 if(action){await window.HydroConditions.action(action);if(!window.hydroConditionsReport)throw Error('The selected Hydrology analysis did not complete. Review its data status, then retry without paying again.');return;}
 if(job.task==='catchment-assessment'){
  const key=Object.keys(window.products||{}).find(key=>/recharge|restoration|slope/i.test(key));
  if(!key)throw Error('Catchment inputs are still preparing. Retry the report when the area is ready.');
  window.showProduct(key);
  const start=Date.now();await new Promise(resolve=>setTimeout(resolve,300));
  while(document.querySelector('.gee-computation-status')?.dataset.state==='busy'){if(Date.now()-start>180000)throw Error('Catchment analysis is still processing. Retry without paying again.');await new Promise(resolve=>setTimeout(resolve,150));}
  return;
 }
 throw Error('Complete the selected scenario inputs or upload ground records before preparing this report. Your authorised access is retained.');
};
const delivered=new Set();window.HydroDeliverReport=async()=>{if(window.SiegHydroBatchRunning||window.SiegPreparingReport||window.SiegIndicatorSelection?.items().length)return;const a=window.SiegeUsage?.active;if((!a?.paymentVerified&&!a?.adminUnrestricted)||a?.adminUnrestricted||['wetland-mapping','catchment-delineation'].includes(a.task)||delivered.has(a.id))return;const selected=window.activeProduct?['analysis','map']:window.hydroFloodSummary?['flood','map']:[];if(!selected.length)return;try{const d=await window.SiegeDelivery.deliverPaid({...options,selectedReports:selected});if(d?.clientEmailSent)delivered.add(a.id);}catch(e){const n=document.getElementById('usageStatus');if(n){n.hidden=false;n.textContent='Your analysis is paid. Email preparation failed: '+e.message+' Retry the report button without paying again, or request refund review.';}}};
const requestButton=$('requestHydrologyReport');
const requestStatus=document.createElement('p');
requestStatus.id='hydroReportRequestStatus';
requestStatus.hidden=true;
requestStatus.setAttribute('role','status');
requestStatus.style.cssText='margin:8px 0;color:#176f73;font:14px/1.4 Arial,sans-serif;overflow-wrap:anywhere';
requestButton.after(requestStatus);
requestButton.setAttribute('aria-describedby',requestStatus.id);
window.SiegeDelivery?.register?.(options);
requestButton.onclick=async()=>{
 requestStatus.hidden=false;
 requestStatus.textContent='Checking report access…';
 requestButton.disabled=true;
 try{
  if(!window.SiegeDelivery?.loadReport)throw Error('Report tools could not load. Refresh Hydrology and retry.');
  await window.SiegeDelivery.loadReport(options);
 }catch(error){requestStatus.textContent=error.message;}finally{requestButton.disabled=false;}
};
})();
