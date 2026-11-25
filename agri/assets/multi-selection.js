/* Run checked Fields indicators in sequence without discarding earlier overlays. */
(()=>{'use strict';const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
window.SiegFieldsRunIndicator=async(group,item)=>{
 const geometry=window.siegeAgri?.getGeometry();if(!geometry||!window.siegeAgri?.isReady())throw Error('Define your area and wait for the analysis connection.');
 const before=new Set(window.Map.layers().length()?Array.from({length:window.Map.layers().length()},(_,i)=>window.Map.layers().get(i)):[]);
 const proto=ee.ComputedObject.prototype,original=proto.evaluate;let pending=0,last=Date.now();const errors=[];
 proto.evaluate=function(callback){pending++;last=Date.now();try{return original.call(this,(value,error)=>{try{if(error)errors.push(String(error));callback?.(value,error)}finally{pending--;last=Date.now()}})}catch(error){pending--;throw error}};
 const keep=window.SiegKeepSelectedLayers;window.SiegKeepSelectedLayers=true;
 try{
  const tab=document.querySelector('#agriModules [data-key="'+group+'"]');if(tab)tab.click();else window.showTab(group);
  if(item.value){const select=[...document.querySelectorAll('#sidebarHost select')].find(s=>[...s.options].some(o=>o.value===item.value));if(!select)throw Error('Indicator controls are still loading. Retry this selection.');select.value=item.value;await select.onchange?.();}
  else if(!item.auto&&!item.layerName){const button=[...document.querySelectorAll('#sidebarHost .indicator-actions button')].find(b=>b.textContent.trim()===(item.actionLabel||item.label));if(!button)throw Error('Indicator controls are still loading. Retry this selection.');await button.onclick?.();}
  const start=Date.now();while(pending||Date.now()-last<600){if(window.siegeAgri.getGeometry()!==geometry)throw Error('The area changed. Select the indicators again.');if(Date.now()-start>180000)throw Error('Analysis is still processing. Retry without paying again.');await pause(100);}
  const layers=window.Map.layers();for(let i=0;i<layers.length();i++){const layer=layers.get(i);if(!before.has(layer)&&layer.ready){const result=await layer.ready;if(result?.error)errors.push(result.error);}}
  if(errors.length)throw Error(errors[0]);
 }finally{proto.evaluate=original;window.SiegKeepSelectedLayers=keep;}
};
})();
