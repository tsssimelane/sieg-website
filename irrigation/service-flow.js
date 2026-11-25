/* One selected-service pipeline, shared by selection, payment resume and retry. */
(function(root){'use strict';
function create({ready,prepare,generate,notice,onSelection=()=>{},manual=false}){
 let selected=false,pending=null,revision=0;
 async function process(){
  if(!selected)return;
  if(pending)return pending;
  if(!ready()){notice('Service selected. Define your field and confirm the design inputs to continue.');return;}
  const ticket=revision;
  pending=Promise.resolve().then(async()=>{
   notice('Processing irrigation design and BOQ…');
   if(!await prepare())return;
   if(!selected||ticket!==revision)return;
   notice(manual?'Design complete. Request report when ready.':'Preparing your irrigation PDF report…');
   return generate();
  }).catch(error=>{notice(error.message+' Your paid access is retained; do not pay again.');throw error;}).finally(()=>{pending=null;});
  return pending;
 }
 return {select(value){const next=!!value;if(next!==selected){selected=next;revision++;onSelection(selected);}return selected&&!manual?process():Promise.resolve();},process,get selected(){return selected;}};
}
root.SiegIrrigationServiceFlow={create};
if(typeof module!=='undefined')module.exports={create};
})(typeof window==='undefined'?globalThis:window);
