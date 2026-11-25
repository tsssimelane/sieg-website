const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const root={};vm.runInNewContext(fs.readFileSync('assets/report-kit.js','utf8'),{window:root});
const geometry={type:'Polygon',coordinates:[[[.9,.9],[.99,.9],[.99,.99],[.9,.99],[.9,.9]]]};
const svg=root.SiegeReportKit.svgMap({geometry,viewport:[0,0,1,1]});
assert.match(svg,/data-north-arrow="true" transform="translate\(1260 12\) scale\(.6\)"/,'Boundary near top right moves arrow outside the map');
const safe={type:'Polygon',coordinates:[[[.1,.1],[.3,.1],[.3,.3],[.1,.1]]]};
assert.match(root.SiegeReportKit.svgMap({geometry:safe,viewport:[0,0,1,1]}),/data-north-arrow="true" transform="translate\(1260 120\)"/);
console.log('PASS: north arrow detects boundary overlap and moves into clear title space; normal placement retained when clear');
