/* Evidence-based preliminary screening, not a declaration of installation compliance. */
(function(root){'use strict';
const source='https://www.nrcs.usda.gov/sites/default/files/2022-10/Sprinkler_System_442_NHCP_CPS_2021.pdf';
const fao='https://www.fao.org/4/s8684e/s8684e06.htm';
const positive=v=>Number.isFinite(v)&&v>0;
function loss(length,flow,diameter,c=140){return length>0&&flow>0?10.67*length*Math.pow(flow/3600,1.852)/(Math.pow(c,1.852)*Math.pow(diameter/1000,4.87)):0;}
function lateralLoss(length,spacing,outlet,diameter,c=140){const n=Math.max(1,Math.ceil(length/spacing));if(n>50000)throw Error('Split the lateral into smaller hydraulic design zones.');let friction=0;for(let k=1;k<=n;k++)friction+=loss(length/n,k*outlet/1000,diameter,c);return friction;}
function assess(r,p){const checks=[],add=(name,state,detail)=>checks.push({name,state,detail});
 add('Daily supply and runtime',r.schedule.feasible?'pass':'fail',r.runtime.toFixed(2)+' h required; '+p.hours+' h available.');
 add('Verified source capacity',r.design.sourceUpgrade?'verify':'pass','Entered '+p.supply+' m³/h; design peak '+r.flow.toFixed(2)+' m³/h. '+(r.design.sourceUpgrade?'Confirm the larger source capacity and pump duty before installation.':'Confirm sustained flow at operating pressure.'));
 add('Mainline velocity',r.v<=2+1e-9?'pass':'fail',r.v.toFixed(2)+' m/s; SIEG planning ceiling 2 m/s, not a universal pipe standard.');
 const h={headerLoss:0,lateralLoss:0,elevationRange:0,complete:false};
 for(const key of ['intakeRate','wettedDiameter','designWind','lateralDiameter','lateralElevationRange','pipeRating','uniformityCU'])if(p[key]!==undefined&&p[key]!==null&&(!Number.isFinite(p[key])||p[key]<0||(['intakeRate','wettedDiameter','lateralDiameter','pipeRating'].includes(key)&&p[key]===0)||(key==='uniformityCU'&&p[key]>100)))add('Input validation','fail','Invalid '+key+'. Enter a valid measurement or leave it blank.');
 if(r.system==='sprinkler'){
  const intake=positive(p.intakeRate)?p.intakeRate:({sand:25,loam:12,clay:5}[p.soil]||5),rate=r.design.revisedOutlet/(p.rows*p.spacing);
  add('Application rate and soil intake',rate>=intake?'fail':positive(p.intakeRate)?'pass':'verify',rate.toFixed(2)+' mm/h applied; '+intake+' mm/h '+(positive(p.intakeRate)?'entered basic infiltration rate.':'soil-texture screening assumption; measure infiltration and assess runoff on slopes.'));
  const wind=Number.isFinite(p.designWind)?p.designWind/0.44704:p.wind==='high'?11:10,psi=p.pressure/0.7030696,wet=p.wettedDiameter;
  if(!positive(wet)||psi<2)add('Sprinkler overlap','verify','Enter manufacturer wetted diameter at the selected operating pressure; verify rectangular-pattern uniformity.');
  else{let fits,detail;if(psi>75){const factor=wind<=4?.65:wind<=10?.50:.30;fits=Math.hypot(p.rows,p.spacing)<=wet*factor+1e-9;detail='Diagonal '+Math.hypot(p.rows,p.spacing).toFixed(1)+' m; limit '+(wet*factor).toFixed(1)+' m.';}
   else{const rowFactor=wind<=1?.65:wind<=5?.60:wind<=10?.50:.45;fits=p.rows<=wet*rowFactor+1e-9&&p.spacing<=wet*.50+1e-9;detail='Lateral spacing limit '+(wet*rowFactor).toFixed(1)+' m; along-lateral limit '+(wet*.50).toFixed(1)+' m.';}
   add('Sprinkler overlap',fits?'pass':'fail',detail+' NRCS 442 Table 1a, rectangular stationary layout. '+(Number.isFinite(p.designWind)?'Entered wind '+p.designWind+' m/s.':'Assumed wind band; confirm wind at nozzle height.'));
   if(!Number.isFinite(p.designWind))add('Measured design wind','verify','Enter wind speed to replace the conservative categorical wind assumption.');
  }
  const length=Math.max(0,...r.g.lines.map(line=>{const a=line[0],b=line[1],cos=Math.cos((a[1]+b[1])*Math.PI/360);return Math.hypot((b[0]-a[0])*111320*cos,(b[1]-a[1])*111320);}));
  if(positive(p.lateralDiameter)&&Number.isFinite(p.lateralElevationRange)&&p.lateralElevationRange>=0&&p.pressure>0){
   h.lateralLoss=lateralLoss(length,p.spacing,r.design.revisedOutlet,p.lateralDiameter);h.elevationRange=p.lateralElevationRange;h.complete=true;
   const percent=100*(h.lateralLoss+h.elevationRange)/p.pressure;
   add('Lateral pressure variation',percent<=20+1e-9?'pass':'fail',percent.toFixed(1)+'% conservative allowance; limit 20% for the unregulated lateral. Longest sampled lateral '+length.toFixed(1)+' m; distributed-outlet friction '+h.lateralLoss.toFixed(2)+' m plus elevation range '+h.elevationRange.toFixed(2)+' m. Check every lateral with a surveyed pressure profile.');
  }else add('Lateral pressure variation','verify','Enter lateral internal diameter and surveyed maximum elevation range. Pressure variation must be checked before installation; no regulator performance is assumed.');
  add('Sprinkler operating pressure','verify','Confirm nozzle discharge and wetted diameter at '+p.pressure+' m outlet head using manufacturer performance data.');
  add('Distribution uniformity',Number.isFinite(p.uniformityCU)?p.uniformityCU>=85?'pass':'fail':'verify',Number.isFinite(p.uniformityCU)?'Entered CU '+p.uniformityCU+'%; SIEG conservative project target ≥85%. Verify the test record and field edges.':'Confirm a catch-can CU of at least 85% as the SIEG project target. No uniformity result has been simulated or invented.');
 }
 if(r.network&&r.system!=='surface')h.headerLoss=loss(r.network.headerLength,r.flow,r.design.mainDiameter);
 const head=r.head+h.headerLoss+h.lateralLoss+h.elevationRange;
 add('Pipe pressure class',positive(p.pipeRating)?p.pipeRating>=head*0.0980665?'verify':'fail':'verify',positive(p.pipeRating)?'Entered '+p.pipeRating+' bar; estimated pump discharge '+(head*.0980665).toFixed(2)+' bar. Check surge, temperature derating and all fittings.':'Specify pipe/fitting working pressure and assess surge and temperature derating.');
 add('Installation and commissioning','verify','Verify suction/NPSH, pump curve, protection/backflow, surveyed profiles, permits and commissioning with the installer under local requirements.');
 if(r.g.rows>r.g.lines.length)add('Unsampled laterals','verify','The map samples 1,500 segments; hydraulic checks require the complete network.');
 return {checks,hydraulics:h,head,failed:checks.some(c=>c.state==='fail'),status:checks.some(c=>c.state==='fail')?'Revise design':'Preliminary — verification required',sources:[{label:'FAO sprinkler irrigation guidance',url:fao},{label:'USDA NRCS CPS 442 (2021), reference design criteria',url:source}]};
}
function apply(r,p){const assessment=assess(r,p);r.standards=assessment;r.head=assessment.head;r.power=1000*9.81*(r.flow/3600)*r.head/(p.pumpEfficiency/100)/1000;return assessment;}
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function html(a){return '<section class="ir-design-checks"><h2>Design criteria and verification</h2><p><strong>'+esc(a.status)+'</strong> · Reference-based screening; not a certificate of global or local regulatory compliance.</p><table><thead><tr><th>Check</th><th>Result</th><th>Evidence / action</th></tr></thead><tbody>'+a.checks.map(c=>'<tr><th>'+esc(c.name)+'</th><td>'+({pass:'Screen passed',fail:'Revise',verify:'Verify on site'})[c.state]+'</td><td>'+esc(c.detail)+'</td></tr>').join('')+'</tbody></table><p>'+a.sources.map(s=>'<a href="'+s.url+'">'+esc(s.label)+'</a>').join(' · ')+'</p><p>Hydraulic model: Hazen–Williams C=140 assumption; header loss conservatively uses peak flow throughout. Lateral losses sum equal outlet segments. Pump allowance includes entered outlet head, static lift, main and header friction, 2 m fitting allowance, and lateral friction/elevation when supplied. Unverified network details remain outstanding.</p></section>';}
root.SiegIrrigationDesignChecks={assess,apply,html,loss,lateralLoss};
})(typeof window==='undefined'?globalThis:window);
