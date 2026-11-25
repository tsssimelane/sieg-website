/* Run checked Fields indicators in sequence without discarding earlier overlays. */
(()=>{'use strict';const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const snapshots=new Map(),key=(group,item)=>group+'::'+(item.value||item.label);
window.SiegFieldsSelectedResults=()=>{const revision=window.SiegExplicitAnalysis?.revision();return (window.SiegIndicatorSelection?.items()||[]).map(choice=>snapshots.get(key(choice.group,choice))).filter(row=>row&&row.revision===revision);};
window.SiegFieldsRunIndicator=async(group,item)=>{
 const revision=window.SiegExplicitAnalysis?.revision();
 const geometry=window.siegeAgri?.getGeometry();if(!geometry||!window.siegeAgri?.isReady())throw Error('Define your area and wait for the analysis connection.');
 if(group==='yield'){document.querySelector('#agriModules [data-key=yield]')?.click();await document.getElementById('yieldRun')?.onclick?.();if(!window.SiegYield?.report?.())throw Error('Complete the harvest records and yield inputs, then click Start analysis.');snapshots.set(key(group,item),{key:group,title:item.label,revision,html:'<pre>'+String(window.SiegYield.report()).replace(/&/g,'&amp;').replace(/</g,'&lt;')+'</pre>',maps:[]});return;}
 if(group==='suitability')window.SiegFieldsLastSuitability=null;
 const before=new Set(window.Map.layers().length()?Array.from({length:window.Map.layers().length()},(_,i)=>window.Map.layers().get(i)):[]);
 const proto=ee.ComputedObject.prototype,original=proto.evaluate;let pending=0,last=Date.now();const errors=[];
 proto.evaluate=function(callback){pending++;last=Date.now();try{return original.call(this,(value,error)=>{try{if(error)errors.push(String(error));callback?.(value,error)}finally{pending--;last=Date.now()}})}catch(error){pending--;throw error}};
 const keep=window.SiegKeepSelectedLayers;window.SiegKeepSelectedLayers=true;
 try{
  const tab=document.querySelector('#agriModules [data-key="'+group+'"]');if(tab)tab.click();else window.showTab(group);
  if(group==='recommendations'){await window.SiegCropScreen.show(item.value==='Vegetables'?'Vegetable':item.value==='Fruit trees'?'Fruit tree':'Crop');}
  else if(item.value){const select=[...document.querySelectorAll('#sidebarHost select')].find(s=>[...s.options].some(o=>o.value===item.value));if(!select)throw Error('Indicator controls are still loading. Retry this selection.');select.value=item.value;await select.onchange?.();}
  else if(!item.auto&&!item.layerName){const button=[...document.querySelectorAll('#sidebarHost .indicator-actions button')].find(b=>b.textContent.trim()===(item.actionLabel||item.label));if(!button)throw Error('Indicator controls are still loading. Retry this selection.');await button.onclick?.();}
  const start=Date.now();while(pending||Date.now()-last<600){if(window.siegeAgri.getGeometry()!==geometry)throw Error('The area changed. Select the indicators again.');if(Date.now()-start>180000)throw Error('Analysis is still processing. Retry without paying again.');await pause(100);}
  const layers=window.Map.layers();for(let i=0;i<layers.length();i++){const layer=layers.get(i);if(!before.has(layer)&&layer.ready){const result=await layer.ready;if(result?.error)errors.push(result.error);}}
  if(errors.length)throw Error(errors[0]);
  await window.SiegReportKitReady();
  const kit=window.SiegeReportKit,geo=await kit.evaluate(geometry);
  const panels=[window.contentPanel?.el,window.mapInfoPanel?.el,window.weatherMapPanel?.el].filter(Boolean);
  for(const panel of panels)await kit.waitForCharts(panel);
  const html=panels.map(panel=>kit.captureResults(panel)).join('');
  const maps=[];
  for(let i=0;i<layers.length();i++){const layer=layers.get(i);if(before.has(layer)||!layer.tile)continue;
   maps.push({name:layer.name,data:await window.siegeFieldsReportLayer(layer,{geometry:geo,title:layer.name,legendSpec:window.legendPanel?.el?.siegReportLegend,source:'SIEG Fields · '+layer.name})});
  }
  if(window.SiegExplicitAnalysis?.revision()!==revision||window.siegeAgri.getGeometry()!==geometry)throw Error('The selected analysis changed.');
  if(!html&&!maps.length)throw Error('No completed results are available for '+item.label);
  const suitability=group==='suitability'&&item.label==='Land suitability'?window.SiegFieldsLastSuitability:null;
  if(group==='suitability'&&item.label==='Land suitability'&&!suitability)throw Error('Land suitability did not complete.');
  snapshots.set(key(group,item),{key:group,title:item.label,revision,html:suitability&&window.SiegFieldsReport?.suitabilitySummary?window.SiegFieldsReport.suitabilitySummary(suitability.stats,suitability.warnings):html,maps,geometry:geo,source:suitability?window.SiegLandSuitability.report(geometry,{includeStatistics:false}):undefined});
 }finally{proto.evaluate=original;window.SiegKeepSelectedLayers=keep;}
};
})();
