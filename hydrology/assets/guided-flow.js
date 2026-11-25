(()=>{'use strict';const $=id=>document.getElementById(id);let task='Water Availability';
function show(id,value){const node=$(id);if(node)node.hidden=!value;}
function sync(name){if(name)task=name;const ready=!!window.siegeHydrology?.canAnalyse();document.querySelectorAll('#hydroModules button, #hydroModules input[type=checkbox], #hydroAssessments button').forEach(b=>b.disabled=false);
 show('hydroFarmTools',['Water Availability','Water Balance','Drought'].includes(task));
 const flood=task==='Flood Watch',river=$('floodTask').value==='river',manual=$('floodMode').value==='manual';
 show('floodWatchTools',flood);$('floodWatchTools').inert=!ready;show('riverWatchInputs',river);show('damWatchInputs',!river);show('floodGaugeInputs',!manual);show('floodManualInputs',manual);show('riverManualInputs',manual);show('damManualInputs',manual);
 $('downloadFloodResults').disabled=!window.hydroFloodSummary||window.hydroFloodSummary.geometry!==window.aoi;
}
window.HydroUX={sync};
for(const id of ['floodTask','floodMode'])$(id).addEventListener('change',()=>sync());
sync();
})();
