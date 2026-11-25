const $=id=>document.getElementById(id),form=$('rasterJoinForm'),status=$('rasterJoinStatus'),save=$('rasterJoinDownload');
let result=null;
form.addEventListener('input',()=>{result=null;save.disabled=true;status.hidden=true;});
form.onsubmit=async e=>{
 e.preventDefault();
 const raster=$('rasterJoinRaster').files[0],vector=$('rasterJoinVector').files[0];if(!raster||!vector)return;
 const band=$('rasterJoinBand').valueAsNumber,field=$('rasterJoinField').value.trim(),statistic=$('rasterJoinStatistic').value;
 const controls=[...form.elements].filter(el=>!el.disabled);controls.forEach(el=>el.disabled=true);
 result=null;save.disabled=true;status.hidden=false;status.textContent='Matching raster cells to vector features…';
 try{
  result=await new Promise((resolve,reject)=>{
   const worker=new Worker(new URL('./raster-join-worker.js',import.meta.url),{type:'module'});
   const finish=()=>{clearTimeout(timer);worker.terminate();};
   const timer=setTimeout(()=>{finish();reject(Error('The join timed out. Try a smaller raster or vector layer.'));},60000);
   worker.onmessage=({data})=>{finish();data.error?reject(Error(data.error)):resolve(data);};
   worker.onerror=()=>{finish();reject(Error('The raster tool could not start. Reload Resources and try again.'));};
   worker.postMessage({raster,vector,band,field,statistic});
  });
  const missing=result.total-result.matched;
  status.textContent=result.matched.toLocaleString()+' of '+result.total.toLocaleString()+' features matched.'+(missing?' '+missing.toLocaleString()+' had no valid raster value; their new field is empty.':'');
 }catch(err){status.textContent=err.message;}
 finally{controls.forEach(el=>el.disabled=false);save.disabled=!result;}
};
save.onclick=()=>{
 if(!result)return;
 const url=URL.createObjectURL(new Blob([JSON.stringify(result.data)],{type:'application/geo+json'})),a=document.createElement('a');
 a.href=url;a.download='sieg-raster-attribute-join.geojson';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
};
