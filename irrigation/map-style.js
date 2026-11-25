(function(root){'use strict';
const icons={pump:'<path d="M3 13L15 3L27 13V27H3Z" fill="#0b2338" stroke="white" stroke-width="2"/><circle cx="15" cy="19" r="5" fill="#218b8c"/>',tank:'<ellipse cx="15" cy="7" rx="11" ry="4" fill="#d6eff0" stroke="#146f83" stroke-width="2"/><path d="M4 7V24Q15 31 26 24V7" fill="#b4dfe5" stroke="#146f83" stroke-width="2"/>',valve:'<path d="M4 7L26 23V7L4 23Z" fill="#e8a444" stroke="#0b2338" stroke-width="2"/><path d="M15 3V12M9 3H21" stroke="#0b2338" stroke-width="2"/>',filter:'<rect x="7" y="4" width="16" height="23" rx="5" fill="#eee8dc" stroke="#0b2338" stroke-width="2"/><path d="M10 11H20M10 16H20M10 21H20" stroke="#218b8c" stroke-width="2"/>',flush:'<circle cx="15" cy="15" r="10" fill="#fff" stroke="#0b2338" stroke-width="2"/><path d="M9 15H21M15 9V21" stroke="#218b8c" stroke-width="3"/>'};
const zones=['#218b8c','#577db8','#b68c36','#8a67a6'];
const pipes={main:'#0b2338',header:'#ca8833',suction:'#52b7ce'};
function lateral(r,i){return r.system==='surface'?'#a48754':zones[Math.floor(i*r.zones/r.g.lines.length)%zones.length]}
function sprinklers(r){if(r.system!=='sprinkler')return [];const points=[],step=Math.max(1,Math.ceil(r.g.lines.length/30));r.g.lines.forEach((line,i)=>{if(i%step)return;for(let n=1;n<=3;n++){const t=n/4;points.push([line[0][0]+(line[1][0]-line[0][0])*t,line[0][1]+(line[1][1]-line[0][1])*t]);}});return points;}
root.SiegIrrigationMapStyle={icons,zones,pipes,lateral,sprinklers};
})(typeof window==='undefined'?globalThis:window);
