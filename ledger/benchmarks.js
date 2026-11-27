(function(root){
const guide='https://agrinfosystems.gov.sz/assets/uploadsVegetable-Production-Guidelines.pdf',maize='https://www.farmchem.co.sz/seeds.html',assessment='https://www.agrinfosystems.gov.sz/assets/uploadsPre-Harvest_Crop%20Assessment%20-%20Final%20Report.Done.pdf';
const cropData={
 cabbage:{yield:[50,60]}, beetroot:{yield:[15,25],days:[60,90],winterDays:[90,120]}, butternut:{yield:[20,30]}, onion:{yield:[20,40],days:[90,120],basis:'after transplanting'}, pepper:{yield:[25,40],days:[70,80],basis:'green fruit after transplanting'}, spinach:{yield:[15,15],days:[28,35],basis:'first harvest after transplanting'}, potato:{yield:[15,20],winterIrrigatedYield:[24,27],days:[112,133],basis:'harvest after maturity and skin setting'},'sweet potato':{days:[90,180],basis:'approximate months converted to days'}, maize:{yield:[1.10,1.10],source:assessment,period:'2023/24 crop assessment',basis:'national observed average, not a variety or irrigated benchmark'}
};
const variants={SC637:[135,148],SC719:[148,155]};
const norm=v=>String(v||'').trim().toLowerCase(),mid=r=>(r[0]+r[1])/2;
function datePlus(date,days){if(!/^\d{4}-\d{2}-\d{2}$/.test(date||''))return '';const d=new Date(date+'T00:00:00Z');if(!Number.isFinite(+d))return '';d.setUTCDate(d.getUTCDate()+Math.round(days));return d.toISOString().slice(0,10)}
function estimates({country,crop,variety,system,planting}){
 if(country!=='SZ')return {};
 const key=norm(crop),data=cropData[key],v=String(variety||'').toUpperCase().replace(/[^A-Z0-9]/g,''),winter=planting&&[4,5,6,7,8].includes(Number(planting.slice(5,7)));let result={};
 if(data){
  let range=data.yield;if(key==='potato'&&system==='Irrigated'&&winter)range=data.winterIrrigatedYield;
  if(range&&!(key==='maize'&&system==='Irrigated'))result.yield={value:mid(range),range,source:data.source||guide,scope:'Eswatini · crop-level benchmark',period:data.period||'2022 production guidance',note:data.basis||'Published crop guidance; not variety-specific or guaranteed.'};
  let days=key==='beetroot'&&winter?data.winterDays:data.days;
  if(days&&planting)result.harvest={value:datePlus(planting,mid(days)),range:days,source:guide,scope:'Eswatini · crop-level guidance',period:'2022 production guidance',note:data.basis||'Days from planting; confirm variety and growing conditions.'};
 }
 if(key==='maize'&&variants[v]&&planting){const range=variants[v];result.harvest={value:datePlus(planting,mid(range)),range,source:maize,scope:'Eswatini seed catalogue · '+v,period:'Catalogue accessed 26 Nov 2026',note:'Physiological maturity; grain drying may delay harvest.'};}
 return result;
}
root.SiegLedgerBenchmarks={estimates,datePlus};if(typeof module!=='undefined')module.exports=root.SiegLedgerBenchmarks;
})(typeof window==='undefined'?globalThis:window);
