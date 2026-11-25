// Shared, vector-rendered numeric legends for Fields, Eco and Hydrology.
(()=>{'use strict';let sequence=0;const escape=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function ticks(min,max){const raw=(max-min)/7,power=10**Math.floor(Math.log10(raw));const step=([1,2,2.5,5,10].find(n=>n*power>=raw-raw*1e-10)||10)*power;const values=[min];for(let i=Math.ceil((min+step*1e-8)/step);i*step<max-step*1e-8;i++)values.push(Number((i*step).toPrecision(12)));values.push(max);return values.filter((v,i,a)=>i===0||i===a.length-1||(v-min)/(max-min)>.07&&(max-v)/(max-min)>.07)}
function format(value,min,max){if(Math.abs(value)<(max-min)*1e-10)return '0';const v=Number(value.toPrecision(7));return Math.abs(v)>=100000||Math.abs(v)<.001?v.toExponential(1).replace('e+','e').replace('.0e','e'):String(v)}
function meaningOf(title,units){
  if(/ecosystem condition/i.test(title))return 'Condition relative to reference (%)';
  if(/biodiversity|intactness|\bBII\b/i.test(title))return 'Modelled biodiversity intactness (0–1)';
  if(/canopy.*height/i.test(title))return 'Canopy height ('+(units||'m')+')';
  if(/soil organic carbon|SOC concentration/i.test(title))return 'Carbon concentration ('+(units||'g/kg')+')';
  if(/bulk density/i.test(title))return 'Soil density ('+(units||'g/cm³')+')';
  if(/soil moisture|root.zone moisture|surface moisture/i.test(title))return 'Volumetric water content ('+(units||'m³/m³')+')';
  if(/NDVI/i.test(title))return 'Vegetation index (unitless)';
  if(/salinity.*proxy/i.test(title))return 'Salinity spectral index (unitless)';
  if(/slope/i.test(title))return 'Slope ('+(units||'degrees')+')';
  const unit=units||(title.match(/\(([^()]*)\)\s*$/)||[])[1];
  return unit?'Indicator value ('+unit+')':'';
}
function descriptors(title,min,max){
  // These describe the ends of the display range, not validated quality classes.
  const rules=[
    [/ecosystem condition/i,['Poor condition','Good condition']],
    [/biodiversity|intactness|\bBII\b/i,['Strongly depleted','Largely intact']],
    [/fragmentation/i,['Connected habitat','Fragmented habitat']],
    [/land productivity|productivity trend/i,['Declining greenness','Increasing greenness']],
    [/persistent bare|bare.ground/i,['Little bare ground','Persistently bare']],
    [/canopy.*height/i,['Shorter canopy','Taller canopy']],
    [/slope/i,['Flatter terrain','Steeper terrain']],
    [/soil organic carbon|SOC concentration/i,['Carbon-poor soil','Carbon-rich soil']],
    [/bulk density/i,['Looser soil','Denser soil']],
    [/soil moisture/i,['Drier soil','Wetter soil']],
    [/NDVI|vegetation index/i,['Bare / sparse cover','Dense green cover']],
    [/salinity/i,['Weak salinity signal','Strong salinity signal']],
    [/irrigatability|well.*suitability|suitable.*well|recharge.*favourability/i,['Poor suitability','Good suitability']],
    [/erosion|erodibility/i,['Less erosion-prone','More erosion-prone']],
    [/balance/i,min<0&&max>0?['Water deficit','Water surplus']:['Less water surplus','More water surplus']],
    [/rainfall.*(?:anomaly|departure)|(?:anomaly|departure).*rainfall/i,min<0&&max>0?['Drier than normal','Wetter than normal']:['Less rainfall','More rainfall']],
    [/anomaly|departure/i,['Below reference','Above reference']],
    [/temperature/i,['Cooler','Warmer']],
    [/rainfall|precipitation/i,['Drier conditions','Wetter conditions']],
    [/evapotranspiration|evaporation/i,['Less water loss','More water loss']],
    [/runoff/i,['Little runoff','More runoff']],
    [/flood/i,['Low flood potential','High flood potential']],
    [/storm/i,['Low storm potential','High storm potential']],
    [/stress|pest|disease/i,['Weak stress signal','Strong stress signal']],
    [/heatwave|drought.*risk/i,['Low warning potential','High warning potential']],
    [/wind/i,['Calmer winds','Stronger winds']],
    [/built.up.*probability/i,['Unlikely built-up','Likely built-up']],
    [/built.up/i,['Not built-up','Built-up']],
    [/activity/i,[min===0?'No detected activity':'Little activity','More activity']],
    [/cropland/i,['Not mapped as crops','Mapped as cropland']],
    [/clay content/i,['Clay-poor soil','Clay-rich soil']],
    [/water.*seasonality/i,['Briefly wet','Wet year-round']],
    [/water.*occurrence/i,['Rarely wet','Frequently wet']],
    [/water.*(?:mask|extent)/i,['Water not detected','Water detected']],
    [/infiltration restoration/i,['Not flagged','Candidate area']],
    [/radiative power/i,['Weaker fire energy','Stronger fire energy']],
    [/detection age/i,['Recent detection','Older detection']],
    [/turbidity|NDTI/i,['Weak optical signal','Strong optical signal']],
    [/monoxide/i,['Less CO aloft','More CO aloft']],
    [/nitrogen|NO₂/i,['Less NO₂ aloft','More NO₂ aloft']],
    [/aerosol/i,['Weak absorbing signal','Strong absorbing signal']],
    [/probability|likelihood/i,['Unlikely','Likely']],
    [/occurrence|frequency/i,['Rare','Frequent']]
  ];
  return (rules.find(rule=>rule[0].test(title))||[null,['Minimum shown','Maximum shown']])[1];
}

function legendData({min,max,palette,title='',units='',meaning='',minLabel='',maxLabel=''}){
 min=Number(min);max=Number(max);if(!Number.isFinite(min)||!Number.isFinite(max)||max<=min)throw Error('Legend requires an increasing numeric range');
 const colors=(palette||[]).filter(c=>/^#?[a-f\d]{6}$/i.test(c)).map(c=>'#'+c.replace('#',''));if(!colors.length)throw Error('Legend requires a valid palette');
 const ends=descriptors(title,min,max),unit=units||((title.match(/\(([^()]*)\)\s*$/)||[])[1])||(/ecosystem condition/i.test(title)&&max===100?'%':'');
 return {min,max,colors,title,caption:meaning||meaningOf(title,units),low:minLabel||ends[0],high:maxLabel||ends[1],left:format(min,min,max),right:format(max,min,max)+(unit?' '+unit:'')};
}
function lines(value,n=43){const words=String(value).split(/\s+/),out=[];let line='';for(const word of words){if(line&&line.length+word.length+1>n){out.push(line);line=word}else line+=(line?' ':'')+word}if(line)out.push(line);return out}
function svg(options){if(options.items?.length){let y=26;const rows=options.items.map(item=>{const color=/^#?[a-f0-9]{6}$/i.test(item.color||'')?'#'+item.color.replace('#',''):'#ffffff';const row='<rect x="8" y="'+y+'" width="20" height="16" fill="'+color+'" stroke="#708080"/><text x="38" y="'+(y+13)+'" font-size="14" fill="#263f50">'+escape(item.label)+'</text>';y+=28;return row;}).join('');return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 '+(y+8)+'" role="img" aria-label="'+escape(options.title||'Map legend')+'"><text x="8" y="18" font-size="14" font-weight="700" fill="#263f50">'+escape(options.title||'Map legend')+'</text>'+rows+'</svg>';}const d=legendData(options),id='sieg-legend-'+(++sequence),w=320,pad=8,bw=w-pad*2;let y=20;
 const text=(value,x,at,bold=false,anchor='start')=>'<text x="'+x+'" y="'+at+'" text-anchor="'+anchor+'" font-family="Arial,sans-serif" font-size="14" font-weight="'+(bold?'700':'400')+'" fill="'+(bold?'#263f50':'#60757f')+'">'+escape(value)+'</text>';
 let body='<title>'+escape(d.title+'; '+d.left+': '+d.low+'; '+d.right+': '+d.high+'; '+d.caption)+'</title>';
 for(const line of lines(d.title,38)){body+=text(line,pad,y,true);y+=18}y+=2;
 body+=d.colors.map((c,i)=>'<rect data-color-stop="'+i+'" x="'+(pad+i*bw/d.colors.length)+'" y="'+y+'" width="'+(bw/d.colors.length+.05)+'" height="18" fill="'+c+'"/>').join('');y+=36;
 body+=text(d.left,pad,y)+text(d.right,w-pad,y,false,'end');y+=20;
 const low=lines(d.low,21),high=lines(d.high,21);for(let i=0;i<Math.max(low.length,high.length);i++){if(low[i])body+=text(low[i],pad,y);if(high[i])body+=text(high[i],w-pad,y,false,'end');y+=18}y+=2;
 for(const line of lines(d.caption)){body+=text(line,pad,y);y+=18}y+=5;
 return '<svg xmlns="http://www.w3.org/2000/svg" id="'+id+'" viewBox="0 0 320 '+(y+2)+'" role="img" aria-label="'+escape(d.title+' colour scale')+'" style="display:block;width:100%;height:auto">'+body+'</svg>';
}
function create(options){if(options.items?.length){const el=document.createElement('section');el.className='sieg-categorical-legend';el.setAttribute('aria-label',options.title||'Map legend');const heading=document.createElement('strong');heading.textContent=options.title||'Map legend';el.append(heading);for(const item of options.items){const row=document.createElement('div');row.style.cssText='display:flex;align-items:center;gap:10px;margin-top:8px';const swatch=document.createElement('span');swatch.setAttribute('aria-hidden','true');swatch.style.cssText='display:inline-block;flex:0 0 20px;height:16px;border:1px solid #70808055';const color=String(item.color||'');if(/^#?[a-f0-9]{6}$/i.test(color))swatch.style.background='#'+color.replace('#','');const label=document.createElement('span');label.textContent=item.label||'Unlabelled class';row.append(swatch,label);el.append(row);}if(options.meaning){const note=document.createElement('p');note.textContent=options.meaning;el.append(note);}return el;}const d=legendData(options),el=document.createElement('div');el.className='sieg-continuous-legend';el.style.cssText='width:100%;min-width:0;margin:4px 0 0;font:400 14px/1.5 Arial,Helvetica,sans-serif;color:#60757f;';
 const pair=(a,b)=>'<div style="display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:12px;font:inherit"><span style="font:inherit;overflow-wrap:anywhere">'+escape(a)+'</span><span style="font:inherit;text-align:right;overflow-wrap:anywhere">'+escape(b)+'</span></div>';
 el.innerHTML='<strong style="display:block;margin-bottom:7px;font:700 14px/1.5 Arial,Helvetica,sans-serif;color:#263f50">'+escape(d.title)+'</strong><div aria-hidden="true" style="display:flex;height:18px;width:100%;margin:0 0 3px">'+d.colors.map(c=>'<span style="flex:1;min-width:0;background:'+c+'"></span>').join('')+'</div>'+pair(d.left,d.right)+'<div role="list" aria-label="Legend scale values" style="display:flex;justify-content:space-between;gap:4px;font-size:12px;flex-wrap:wrap">'+ticks(d.min,d.max).map(value=>'<span role="listitem">'+escape(format(value,d.min,d.max))+'</span>').join('')+'</div><div style="margin-top:6px">'+pair(d.low,d.high)+'</div>'+(d.caption?'<p style="margin:6px 0 0;font:inherit;overflow-wrap:anywhere">'+escape(d.caption)+'</p>':'');return el;
}
window.SiegLegend={svg,create,ticks};
})();
