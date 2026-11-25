// Run with linkedom installed: node scripts/test_report_charts.cjs /path/to/node_modules/linkedom
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),{parseHTML}=require(process.argv[2]||'linkedom');
(async()=>{
const {window,document}=parseHTML('<html><head></head><body><section id="results"><h3>Monthly rainfall</h3><button>Refresh analysis</button><div class="indicator-actions"><button>Change view</button></div><div class="chart"><strong>Rainfall (mm)</strong><div class="chart-row"><span>Jan</span><span><i style="width:45%;background:#218b8c"></i></span><b>120.5</b></div><svg viewBox="0 0 520 280" role="img" aria-label="Moisture trend"><path d="M0 40 L80 20" fill="none" stroke="#218b8c"/><text x="10" y="260">Month</text></svg><canvas aria-label="Crop monitoring trend"></canvas></div><p onclick="unsafe()">Completed area results</p><a href="javascript:unsafe()">Unsafe link</a><script>unsafe()</script></section></body></html>');
window.getComputedStyle=node=>({getPropertyValue:key=>node.style.getPropertyValue(key)||''});const canvas=document.querySelector('canvas');canvas.toDataURL=()=> 'data:image/png;base64,iVBORw0KGgo=';
const c={window,document,URL,console,setTimeout,clearTimeout,TextEncoder};vm.createContext(c);vm.runInContext(fs.readFileSync('assets/report-kit.js','utf8'),c);const kit=window.SiegeReportKit,panel=document.getElementById('results'),html=kit.captureResults(panel);
for(const part of ['class="chart"','width:45%','Rainfall (mm)','120.5','viewBox="0 0 520 280"','M0 40 L80 20','Month','data:image/png;base64','Crop monitoring trend'])assert(html.includes(part),part);
for(const part of ['<button','<script','onclick=','javascript:','Refresh analysis','indicator-actions'])assert(!html.includes(part),part);
assert(panel.querySelector('button'),'Export does not mutate the live UI');
let finished=false;panel.querySelector('.chart').siegChartReady=new Promise(resolve=>setTimeout(()=>{finished=true;resolve()},15));await kit.waitForCharts(panel);assert(finished,'Waits for existing chart rendering rather than starting new work');
canvas.toDataURL=()=>{throw Error('tainted canvas')};assert.throws(()=>kit.captureResults(panel),/chart could not be exported/);
for(const path of ['agri/assets/report.js','hydrology/assets/report.js','enviro/assets/app.js'])assert(fs.readFileSync(path,'utf8').includes('captureResults'),path);
console.log('PASS: UI bars, SVG axes/plots, canvas charts and titles exported; controls/scripts removed; live UI retained; waits for existing charts; failed image export is explicit; Fields/Eco/Hydrology integration');
})().catch(error=>{console.error(error);process.exitCode=1});
