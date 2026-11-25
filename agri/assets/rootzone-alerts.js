/* Transparent screening rules; these are not crop-specific or calibrated drought forecasts. */
(function(root){'use strict';
function classify(d,now){const finite=x=>typeof x==='number'&&Number.isFinite(x),result=(level,message)=>({level,message});
 if(!d||!['current','previous','percentile','latest','recentCount','priorCount'].every(k=>finite(d[k]))||d.current<0||d.current>.9||d.previous<0||d.previous>.9||d.percentile<0||d.percentile>100||d.recentCount<28||d.priorCount<28)return result('INSUFFICIENT DATA','A reliable alert needs valid root-zone moisture and at least 28 samples in each seven-day window.');
 if(now-d.latest>7*86400000||d.latest>now+86400000)return result('DATA STALE','Root-zone data are older than seven days or have an invalid date. No current alert issued.');
 const change=d.current-d.previous,dry=d.percentile<=20,drying=change<=-.01+1e-9;
 if(!finite(d.rain)||d.rain<0||!finite(d.forecastHours)||d.forecastHours<48||!finite(d.creation)||now-d.creation>2*86400000||d.creation>now+86400000)return result('MONITORING ONLY','Root-zone conditions are available; a fresh forecast covering at least 48 hours is needed for a development alert.');
 const limited=d.rain<2*d.forecastHours/24;
 if(dry&&drying&&limited)return result('HIGH','An unusually dry root zone is continuing to dry, with limited forecast rain. Check crops and irrigation availability.');
 if(dry)return result('ELEVATED','Root-zone moisture is at or below the 20th percentile. Check field conditions; rainfall does not guarantee recovery.');
 if(drying&&limited)return result('WATCH','Root-zone moisture is falling and forecast rain is limited. Monitor the field for emerging water stress.');
 return result('LOW','The screening thresholds for drought development are not currently met. Continue monitoring.');
}
const api={classify};root.SiegRootZoneAlerts=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
