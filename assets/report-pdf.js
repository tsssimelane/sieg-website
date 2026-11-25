/* Convert the paginated report into an actual A4 PDF before download or delivery. */
(()=>{'use strict';const base=new URL('../',document.currentScript.src);let tools;
function script(path,ready){if(ready())return Promise.resolve();return new Promise((resolve,reject)=>{const s=document.createElement('script'),timer=setTimeout(()=>{s.remove();reject(Error('PDF tools took too long to load. Retry report preparation.'));},30000);s.src=new URL(path,base);s.onload=()=>{clearTimeout(timer);ready()?resolve():reject(Error('PDF tools could not start.'));};s.onerror=()=>{clearTimeout(timer);s.remove();reject(Error('PDF tools could not load. Reload and retry.'));};document.head.append(s)})}
function numberReportPDF(pdf,{pages}={}){const physical=pdf.getNumberOfPages(),numbered=[...new Set(pages||Array.from({length:physical},(_,i)=>i+1))].filter(p=>Number.isInteger(p)&&p>=1&&p<=physical).sort((a,b)=>a-b);numbered.forEach((page,index)=>{pdf.setPage(page);pdf.setFillColor('#ffffff');pdf.rect(151,282,43,10,'F');pdf.setFont('helvetica','normal');pdf.setFontSize(8);pdf.setTextColor('#176f73');pdf.text('Page '+(index+1)+' of '+numbered.length,192,289,{align:'right'});});}
function reportNumberingPlan(pages){
 const cover=page=>!!page.querySelector('.report-cover,.report-back,img.cover');
 let lastContents=-1;pages.forEach((page,index)=>{if(page.querySelector('.toc'))lastContents=index;});
 const first=lastContents>=0?lastContents+1:pages.findIndex(page=>!cover(page));
 return first<0?[]:pages.flatMap((page,index)=>index>=first&&!cover(page)&&!page.querySelector('.toc')?[index+1]:[]);
}
function updateReportContents(pages,numbered){
 const labels=new Map(numbered.map((physical,index)=>[physical,index+1])),targets=new Map();
 pages.forEach((page,index)=>{if(!labels.has(index+1))return;for(const node of page.querySelectorAll('[id],[data-id]'))for(const name of ['id','data-id']){const id=node.getAttribute(name);if(id&&!targets.has(id))targets.set(id,labels.get(index+1));}});
 for(const page of pages)for(const link of page.querySelectorAll('.toc a[href^="#"]')){
  let id=(link.getAttribute('href')||'').slice(1);try{id=decodeURIComponent(id);}catch{}
  const label=targets.get(id);if(label===undefined)continue;
  let span=link.querySelector('.toc-page-number');if(!span){span=link.ownerDocument.createElement('span');span.className='toc-page-number';link.append(span);}span.textContent=String(label);
 }
}
function headingNeedsPage({top,bottom,pageTop,pageBottom,lineHeight=20}){
 if(![top,bottom,pageTop,pageBottom].every(Number.isFinite)||top<=pageTop+2)return false;
 const pageHeight=pageBottom-pageTop;if(pageHeight<=0)return false;
 return top>=pageTop+pageHeight*.75||pageBottom-top<Math.max(72,bottom-top+Math.max(40,2*lineHeight)+12);
}
function headingOverflow(overflow,rendered,bounds){
 if(!rendered?.querySelectorAll||!Number.isFinite(bounds?.bottom))return;
 const doc=rendered.ownerDocument,win=doc.defaultView;
 for(const heading of [...rendered.querySelectorAll('.report-content h1,.report-content h2,.report-content h3,.report-content h4')]){
  const rect=heading.getBoundingClientRect();if(!rect.height||rect.top>=bounds.bottom)continue;
  const next=heading.nextElementSibling,style=win.getComputedStyle(next||heading),font=Number.parseFloat(style.fontSize)||12,line=Number.parseFloat(style.lineHeight)||font*1.6;
  if(!headingNeedsPage({top:rect.top,bottom:rect.bottom,pageTop:bounds.top,pageBottom:bounds.bottom,lineHeight:line}))continue;
  // Do not move content already inside the existing overflow range.
  if(overflow?.comparePoint&&overflow.comparePoint(heading,0)>=0)continue;
  const range=doc.createRange();range.setStartBefore(heading);range.setEnd(rendered,rendered.childNodes.length);return range;
 }
}
function compatibleReportCSS(css){return String(css).replace(/\.report-content\s+:(?:is|where)\(\s*h1\s*,\s*h2\s*,\s*h3\s*,\s*h4\s*\)/g,'.report-content h1,.report-content h2,.report-content h3,.report-content h4');}
function prepareDocument(doc){
 for(const style of doc.querySelectorAll('style'))style.textContent=compatibleReportCSS(style.textContent);
 // Disclosure widgets have collapsed layout heights but their text can be
 // painted by canvas exporters. Use ordinary flowing blocks for PDF layout.
 for(const details of [...doc.querySelectorAll('details')]){
  const section=doc.createElement('section');section.className=details.className+' report-expanded-note';
  for(const child of [...details.childNodes]){if(child.nodeType===1&&child.tagName==='SUMMARY'){const heading=doc.createElement('h3');heading.className='report-note-heading';heading.textContent=child.textContent;section.append(heading);}else section.append(child);}
  details.replaceWith(section);
 }
 const css=doc.createElement('style');css.textContent='.report-content h1,.report-content h2,.report-content h3,.report-content h4{break-inside:avoid!important;page-break-inside:avoid!important;break-after:avoid!important;page-break-after:avoid!important}.report-content p,.report-content li{orphans:3;widows:3}.toc a::after{content:none!important}.toc a{position:relative;padding-right:32px}.toc-page-number{position:absolute;right:0;top:0;font-weight:bold;color:#102a43}.report-content h2{break-before:auto!important;page-break-before:auto!important;margin-top:32pt!important;break-after:avoid;page-break-after:avoid}.report-content>section:not(.report-appendix),.report-content .analysis-section{break-before:auto!important;page-break-before:auto!important}.report-content>section:first-child>h2:first-child{margin-top:0!important}.report-expanded-note{display:block!important;position:static!important;height:auto!important;max-height:none!important;overflow:visible!important;margin:16px 0!important;padding:12px 16px!important;border:1px solid #d7e5df;border-radius:10px;break-inside:auto}.report-note-heading{display:block;margin:0 0 10px!important;line-height:1.4!important;break-after:avoid}.report-content pre,.report-appendix pre,.report-method pre,.report-expanded-note pre{display:block!important;position:static!important;height:auto!important;max-height:none!important;overflow:visible!important;white-space:pre-wrap!important;overflow-wrap:anywhere!important;word-break:break-word;font:9pt/1.6 Arial!important;break-inside:auto;margin:10px 0!important}.analysis-section{height:auto;overflow:visible}.analysis-section>h2{clear:both;margin-top:32pt!important;line-height:1.4!important;break-after:avoid}';doc.head.append(css);
}
async function deadline(work,ms,message){let timer;try{return await Promise.race([work,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error(message)),ms)})]);}finally{clearTimeout(timer)}}
async function convert(html,{onProgress=()=>{}}={}){onProgress('Loading PDF tools…');if(typeof html!=='string'||!/<html[\s>]/i.test(html))throw Error('A completed report is required before PDF export.');if(!tools)tools=Promise.all([script('education/vendor/jspdf.umd.min.js',()=>!!window.jspdf?.jsPDF),script('assets/vendor/html2canvas.min.js',()=>!!window.html2canvas)]).catch(e=>{tools=null;throw e});await tools;onProgress('Preparing the PDF document…');
 const frame=document.createElement('iframe');frame.setAttribute('aria-hidden','true');frame.tabIndex=-1;frame.style.cssText='position:fixed;left:-12000px;top:0;width:1000px;height:1200px;border:0;pointer-events:none';document.body.append(frame);
 try{
 await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Report document took too long to load.')),30000);frame.onload=()=>{clearTimeout(timer);resolve()};frame.srcdoc=html;});
 const frameDoc=frame.contentDocument,win=frame.contentWindow;
 frameDoc.querySelectorAll('script,.print-report,button').forEach(el=>el.remove());
 prepareDocument(frameDoc);
 await deadline(frameDoc.fonts?.ready||Promise.resolve(),15000,'Report fonts did not finish loading. Retry the PDF.');
 await Promise.all([...frameDoc.images].map(image=>image.complete?Promise.resolve():new Promise(resolve=>{image.onload=image.onerror=resolve;setTimeout(resolve,20000)})));
 const layout=frameDoc.createElement('style');layout.textContent='.report-sheet{width:auto!important;max-width:none!important;margin:0!important;padding:0!important;border-radius:0!important}.report-cover,.report-back{page:cover;width:210mm!important;height:283mm!important;max-height:283mm!important;margin:0!important;border-radius:0!important;break-after:page}.report-back{break-before:page;break-after:auto}button{display:none!important}.pagedjs_page{margin:0!important;box-shadow:none!important}.pagedjs_pages{padding:0!important}';frameDoc.head.append(layout);
 onProgress('Laying out PDF pages…');win.PagedConfig={auto:false};
 await new Promise((resolve,reject)=>{const tag=frameDoc.createElement('script'),timer=setTimeout(()=>reject(Error('PDF layout tools took too long to load.')),30000);tag.src=new URL('assets/vendor/paged.polyfill.min.js',base).href;tag.onload=()=>{clearTimeout(timer);resolve()};tag.onerror=()=>{clearTimeout(timer);reject(Error('PDF layout tools could not load.'))};frameDoc.head.append(tag)});
 if(win.Paged?.Handler&&win.Paged?.registerHandlers){win.Paged.registerHandlers(class ReportHeadingGuard extends win.Paged.Handler{onOverflow(overflow,rendered,bounds){return headingOverflow(overflow,rendered,bounds);}});}
 await deadline(win.PagedPolyfill.preview(),120000,'PDF pagination timed out. Retry this report.');
 const doc=frame.contentDocument,pages=[...doc.querySelectorAll('.pagedjs_page')];if(!pages.length)throw Error('No report pages were produced.');await deadline(doc.fonts?.ready||Promise.resolve(),15000,'PDF fonts did not finish loading. Retry the report.');
 const numbered=reportNumberingPlan(pages);updateReportContents(pages,numbered);
 const pdf=new window.jspdf.jsPDF({unit:'mm',format:'a4',compress:true});for(let i=0;i<pages.length;i++){onProgress('Creating PDF page '+(i+1)+' of '+pages.length+'…');await new Promise(resolve=>setTimeout(resolve,0));if(i)pdf.addPage();const page=pages[i],cover=page.querySelector('.report-cover svg image,.report-back svg image');if(cover){const data=cover.getAttribute('href')||cover.getAttribute('xlink:href');if(!data?.startsWith('data:image/'))throw Error('Report cover image did not load.');pdf.addImage(data,'PNG',0,0,210,297);}else{const canvas=await deadline(window.html2canvas(page,{scale:2,backgroundColor:'#fff',useCORS:true,logging:false,windowWidth:1000,scrollX:0,scrollY:0}),45000,'PDF page '+(i+1)+' could not render. Retry the report without paying again.');pdf.addImage(canvas.toDataURL('image/jpeg',.94),'JPEG',0,0,210,297);canvas.width=canvas.height=1;}}
 numberReportPDF(pdf,{pages:numbered});
 pdf.setProperties({title:doc.title||'SIEG Report',author:'SIEG',creator:'SIEG PDF report exporter'});onProgress('PDF ready. Preparing your download…');return pdf.output('blob');
 }finally{frame.remove()}}
window.SiegReportPDF={compatibleReportCSS,headingNeedsPage,headingOverflow,convert,prepareDocument,numberPages:numberReportPDF,numberingPlan:reportNumberingPlan,updateContents:updateReportContents};})();
