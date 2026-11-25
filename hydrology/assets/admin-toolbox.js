/* Admin Toolbox shell. Permissions are independently enforced by the analysis API. */
(()=>{'use strict';
const task=new URL(location.href).searchParams.get('toolbox');
if(!['catchment-delineation','wetland-mapping'].includes(task))return;
document.documentElement.dataset.adminTool=task;
const tool=window.SiegAdminTool={task,allowed:false};
tool.ready=fetch('/api/analysis/config',{cache:'no-store'}).then(async response=>{const config=await response.json();tool.allowed=response.ok&&config.admin===true;return tool.allowed;}).catch(()=>false);
tool.download=async options=>{
 await tool.ready;if(!tool.allowed||!window.SiegeUsage?.active?.adminTool)throw Error('Administrator Toolbox access required.');
 const response=await fetch('/api/analysis/config',{cache:'no-store'}),config=await response.json();if(!response.ok||config.admin!==true)throw Error('Administrator access required.');
 const files=await options.build();for(const file of files){const content=file.encoding==='base64'?Uint8Array.from(atob(file.content),c=>c.charCodeAt(0)):file.content;const url=URL.createObjectURL(new Blob([content],{type:file.type})),link=document.createElement('a');link.href=url;link.download=file.filename;link.click();setTimeout(()=>URL.revokeObjectURL(url),30000);}
};
document.addEventListener('DOMContentLoaded',async()=>{
 if(!await tool.ready){document.body.replaceChildren();const message=document.createElement('p');message.textContent='Administrator access required. Open this tool from SIEG Toolbox after signing in as admin.';message.style.cssText='padding:32px;font:16px/1.6 Arial;color:#123546';document.body.append(message);document.documentElement.dataset.adminToolDenied='true';return;}
 document.documentElement.dataset.adminToolReady='true';
 const id=task==='catchment-delineation'?'catchmentDelineation':'wetlandMapping',panel=document.getElementById(id);panel.classList.add('admin-tool-selected');panel.hidden=false;panel.open=true;panel.inert=false;
 const label=task==='catchment-delineation'?'Catchment delineation':'Wetland mapping';document.title=label+' | SIEG Toolbox';
 document.querySelector('.workspace-head h2').textContent=label;document.querySelector('.workspace-head .eyebrow').textContent='SIEG TOOLBOX / ADMIN ONLY';
 document.querySelector('.workspace-head span').textContent='No payment, area cap or pilot allowance · direct downloads';
 document.querySelectorAll('#'+id+' .sieg-step-badge').forEach(n=>n.remove());
 // Keep the tool controls in the map drawer, ahead of shared analysis controls.
 const sidebar=document.querySelector('.hydro-sidebar');if(sidebar)sidebar.prepend(panel);
 window.dispatchEvent(new Event('sieg-trial-mode'));window.dispatchEvent(new Event('resize'));
});
})();
