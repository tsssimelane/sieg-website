// Same capture rules on the display and at the instant the capture button is pressed.
(function(root){'use strict';const MAX_ACCURACY=10,MAX_AGE=10000;
function eligible(p,now=Date.now()){return !!p&&Number.isFinite(p.latitude)&&Math.abs(p.latitude)<=90&&Number.isFinite(p.longitude)&&Math.abs(p.longitude)<=180&&Number.isFinite(p.accuracy)&&p.accuracy>0&&p.accuracy<=MAX_ACCURACY&&Number.isFinite(p.timestamp)&&now-p.timestamp>=-1000&&now-p.timestamp<=MAX_AGE}
const api={MAX_ACCURACY,MAX_AGE,eligible};if(typeof module!=='undefined')module.exports=api;else root.SiegEntranceGPS=api;
})(typeof globalThis!=='undefined'?globalThis:this);
