/* Transparent screening rules; no calibrated drought severity or flood probability. */
(function(root){'use strict';const finite=v=>typeof v==='number'&&Number.isFinite(v);
function wetness(p){return !finite(p)?'Insufficient data':p<20?'Dry':p>80?'Wet':'Typical'}
function drought({percentile,change,deficit30,deficit90,coverage=true,stale=false}){if(!coverage||stale||![percentile,change,deficit30,deficit90].every(finite))return 'Insufficient data';if(percentile<20&&deficit30<=-20&&deficit90<=-20)return 'Persistent deficit';if(change<=-.01&&deficit30<=-20)return 'Drying';return 'No signal'}
function runoff({wetness,rain,clay,slope,built,coverage=true,stale=false}){if(!coverage||stale||![wetness,rain,clay,slope,built].every(finite))return null;const score=.35*Math.max(0,Math.min(1,wetness))+.35*Math.min(1,Math.max(0,rain)/50)+.15*Math.min(1,Math.max(0,clay)/60)+.10*Math.min(1,Math.max(0,slope)/20)+.05*Math.max(0,Math.min(1,built));return {score,label:score>=.65?'High potential':score>=.35?'Moderate potential':'Low potential'}}
function storage(layers){if(!layers||layers.length!==3||!layers.every(finite))return null;return 1000*(layers[0]*.07+layers[1]*.21+layers[2]*.72)}
root.HydroConditionsCore={wetness,drought,runoff,storage};})(typeof window==='undefined'?globalThis:window);
