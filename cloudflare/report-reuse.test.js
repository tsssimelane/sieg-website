import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=p=>fs.readFileSync(p,'utf8');
test('report delivery requires completed explicit analysis and never falls back to preparing it',()=>{
 const code=read('assets/report-delivery.js');
 assert.match(code,/SiegExplicitAnalysis&&!window.SiegExplicitAnalysis.ready\(\)/);
 assert.match(code,/options.prepareReport\|\|\(!window.SiegExplicitAnalysis&&window.SiegeUsage\?\.prepareReport\)/);
 assert.match(code,/SiegExplicitAnalysis\.restored\(\)/);
});
test('Fields reports render snapshots, never execute indicator or Earth Engine functions',()=>{
 const code=read('agri/assets/report.js'),body=code.slice(code.indexOf('async function processSelected'),code.indexOf('const prepared='));
 assert.match(body,/SiegFieldsSelectedResults/);
 assert.doesNotMatch(body,/await (soilSection|suitabilitySection|dashboardSections|recommendationSection)\(/);
 assert.match(read('agri/assets/multi-selection.js'),/snapshots.set/);
});
test('Eco and Hydrology report builders do not process selected indicators',()=>{
 const eco=read('enviro/assets/report.js'),hydro=read('hydrology/assets/report.js');
 assert.doesNotMatch(eco,/SiegIndicatorSelection\.process\(/);
 assert.doesNotMatch(hydro.slice(0,hydro.indexOf('function requireSelectedResults')),/SiegIndicatorSelection\.process\(/);
});
test('completed analysis cannot restart via report authorization',()=>{
 assert.match(read('assets/map-workspace.js'),/allowed\(\)&&!root.SiegExplicitAnalysis.ready\(\)/);
 assert.match(read('irrigation/app.js'),/allowed\(\)&&!window.SiegExplicitAnalysis.ready\(\)/);
});
