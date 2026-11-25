import {webcrypto} from 'node:crypto';import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
const ctx={Request,Response,URL,atob,btoa,TextEncoder,TextDecoder,Uint8Array,Blob,console};vm.createContext(ctx);vm.runInContext(fs.readFileSync('worker/reports.js','utf8'),ctx);
const file={filename:'Report.html',type:'text/html',encoding:'utf8',content:'<!doctype html><html><head><meta charset="utf-8"></head><body><h1>Report ✓</h1><button onclick="window.print()">Print / Save</button></body></html>'};
test('HTML reports are accepted for storage/email, including print control and UTF-8',()=>{assert.equal(ctx.reportDocumentValid(file),true);assert.equal(ctx.reportDocumentValid({...file,encoding:'base64',content:Buffer.from(file.content).toString('base64')}),true);});
test('report validation rejects active HTML and invalid documents',()=>{for(const content of ['invalid','<html><script>alert(1)</script></html>','<html><iframe src="/admin"></iframe></html>','<html><img src="x" onerror="alert(1)"></html>','<html><a href="javascript:alert(1)">X</a></html>'])assert.equal(ctx.reportDocumentValid({...file,content}),false,content);});
test('previous PDF files remain readable',()=>{assert.equal(ctx.reportDocumentValid({filename:'Old.pdf',type:'application/pdf',encoding:'base64',content:btoa('%PDF-1.4\n%%EOF')}),true);});
test('client report conversion retains PDF bytes, service metadata and the reserved reference',async()=>{
 const src=fs.readFileSync('assets/report-delivery.js','utf8');
 const start=src.indexOf('async function file('),end=src.indexOf('\nform.onsubmit=',start);
 const calls=[];
 class DOMParser {
  parseFromString(html){
   let label='';
   return {querySelector:()=>null,createElement:()=>({style:{}}),body:{prepend(node){label=node.textContent}},
     documentElement:{get outerHTML(){return html.replace('</html>',label+'</html>')}}};
  }
 }
 const c={Blob,Uint8Array,btoa,TextEncoder,crypto:webcrypto,DOMParser,window:{},current:{service:'fields'},
  api:async(action,payload)=>{calls.push([action,payload]);return {reference:'SIEG-TEST'}},
  pdfReport:async html=>{assert.match(html,/Report reference: SIEG-TEST/);return new Blob(['%PDF-1.4\n%%EOF'],{type:'application/pdf'})}};
 vm.runInNewContext(src.slice(start,end),c);
 const marked=await c.file('<html><main data-report-version="fields-structured-7" data-service="soil"></main></html>','Fields.html');
 assert.equal(marked.type,'application/pdf');
 assert.equal(marked.encoding,'base64');
 assert.match(Buffer.from(marked.content,'base64').toString(),/^%PDF-/);
 assert.equal(marked.filename,'Fields.pdf');
 assert.equal(marked.reportMetadata.version,'fields-structured-7');
 assert.ok(marked.reportMetadata.services.includes('soil'));
 assert.equal(calls[0][0],'references/reserve');
 assert.equal(calls[0][1].service,'fields');
 assert.equal(calls[1][0],'references/complete');
 assert.equal(marked.reportReference,'SIEG-TEST');
});
test('HTML report wrapper has no pagination/conversion runtime dependency',()=>{const src=fs.readFileSync('assets/report-kit.js','utf8'),wrap=src.slice(src.indexOf('async function wrap('),src.indexOf('\n}',src.indexOf('async function wrap(')));assert(!wrap.includes('await paginatorAsset('));assert(!wrap.includes('window.PagedConfig'));assert(wrap.includes('onclick="window.print()"'));assert(wrap.includes('report-content'));});
test('Estate generates a standalone HTML document and retains navigation QR',async()=>{const c={...ctx,EMBEDDED_FILES:{},estateReportNavigation:p=>'<section>Directions for '+p.id+'</section>',estateReportCoordinates:()=>null};vm.createContext(c);vm.runInContext(fs.readFileSync('worker/report-pdf.js','utf8'),c);const env={ASSETS:{fetch:async()=>new Response(new Uint8Array([137,80,78,71]))}};const html=await c.estateHTML(env,{id:'SIEG-test',estateScope:{country:'Eswatini',admin2:'Manzini'}},[{id:'one',title:'Home',city:'City',currency:'USD',price:10,area:5,date:'2026-11-20'}]);assert(html.startsWith('<!doctype html>'));assert(html.includes('Directions for one'));assert(html.includes('data:image/png;base64,'));assert.equal(ctx.reportDocumentValid({...file,content:html}),true);});
