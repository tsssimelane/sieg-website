// Analytical purchases are scoped to one owner, complete area, service and analysis year.
const PREPAID_SERVICES=['hydrology','fields','eco','irrigation'];
const FIELDS_TASKS={'soil-properties':'Soil texture',suitability:'Land suitability',weather:'Weather and climate',monitoring:'Crop monitoring',recommendations:'Suitable crops',yield:'Yield estimation',warning:'Early warning'};
const ECO_TASKS={'land-classification':'Land classification',biodiversity:'Biodiversity','land-degradation':'Land degradation','air-quality':'Air quality','urban-growth':'Urban growth','active-fires':'Active fires'};
function prepaid(service){return PREPAID_SERVICES.includes(service)}
function commerceTask(service,task){return service==='irrigation'?'irrigation-design':service==='fields'?(FIELDS_TASKS[task]?task:'soil-properties'):service==='eco'?(ECO_TASKS[task]?task:'land-classification'):hydroTask(task)}
function commerceProduct(j){return j.service==='irrigation'&&j.task==='irrigation-design'?{service:'irrigation',title:'Irrigation design and BOQ'}:j.service==='fields'&&FIELDS_TASKS[j.task]?{service:'fields',title:FIELDS_TASKS[j.task]}:j.service==='eco'&&ECO_TASKS[j.task]?{service:'eco',title:ECO_TASKS[j.task]}:j.service==='hydrology'?HYDRO_TASKS[j.task]:null}
function commerceCheck(j){usageHydroCheck(j);if(j.service!=='hydrology'&&j.areaKm2>usageLimit(j)+1e-6)throw Error('This complete area exceeds the '+usageLimit(j)+' km² limit. Staff review is required before payment.');}
const HYDRO_TASKS={
 'farm-water-assessment':{service:'hydrology',title:'Water Conditions & Balance'},
 'flood-risk-screening':{service:'hydrology',title:'Runoff & Flood Screening'},
 'catchment-assessment':{service:'hydrology',title:'Catchment assessment'},
 'flood-watch':{service:'hydrology',title:'Advanced Tools'},
 'wetland-mapping':{service:'wetlands',title:'Wetland mapping shapefiles'},
 'catchment-delineation':{service:'catchment',title:'Catchment delineation shapefiles'}
};
function hydroTask(value){return HYDRO_TASKS[value]?value:'farm-water-assessment'}
async function hydroPurchase(env,j){
 if(!j||!prepaid(j.service)||!j.paymentOrder)return null;
 const o=await reportRead(env,reportKey(j.paymentOrder));
 return o&&o.owner===j.owner&&o.analysisPurchaseId===j.id&&o.state==='paid'&&o.method==='card'&&o.paymentTransactionId&&o.amount===j.amount&&o.currency===j.currency&&!o.refundedAt?o:null;
}
async function hydroRequirePaid(env,j){const o=await hydroPurchase(env,j);if(!o)throw Error('Payment must be verified before analysis. Boundary preview is free.');return o;}
async function hydroGrant(env,o){
 if(!o.analysisPurchaseId||o.state!=='paid'||!o.paymentTransactionId)return;
 const j=await usageJob(env,o.analysisPurchaseId);if(!j||j.owner!==o.owner||j.paymentOrder!==o.id||j.amount!==o.amount||j.currency!==o.currency)return;
 j.deliveryContact=o.contact;j.paymentVerified=true;j.state=j.state==='running'?'running':'authorised';await usageSave(env,j);
}
function hydroContact(c){
 if(!c||typeof c!=='object')throw Error('Contact details are required.');
 for(const k of ['name','email','phone','dial'])if(typeof c[k]!=='string'||!c[k].trim()||c[k].length>200||/[\r\n]/.test(c[k]))throw Error('Invalid '+k+'.');
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.email)||!/^\+[0-9]{1,4}$/.test(c.dial)||!/^\d[0-9 ()-]{4,19}$/.test(c.phone)||!['on',true].includes(c.consent))throw Error('Provide valid contact details and consent.');
 return {name:c.name.trim(),email:c.email.trim(),phone:c.phone.trim(),dial:c.dial,country:String(c.country||'').slice(0,100)};
}
async function hydroCheckout(request,env,b){
 const j=await usageJob(env,b.analysisPurchaseId),owner=reportOwner(request);
 if(!j||j.owner!==owner||!prepaid(j.service))return reportJSON({error:'Analysis quote not found.'},404);
 commerceCheck(j);if(j.state==='queued')return reportJSON({error:'Staff must review this complete area before payment.'},409);
 const product=commerceProduct(j);if(!product)throw Error('Select a current analysis quote.');
 if(b.service!==product.service||b.expectedAmount!==j.amount||j.amount!==reportFee(env,product.service)||j.currency!==(env.PAYGATE_CURRENCY||'USD'))return reportJSON({error:'The price changed. Request a new quote before paying.'},409);
 if((j.service==='hydrology'||['fields','eco'].includes(j.service)&&j.reportItems)&&(b.confirmReportItems!==true||JSON.stringify(b.reportItems)!==JSON.stringify(j.reportItems||[j.task])))throw Error('Confirm the selected report items before payment.');
 const contact=hydroContact(b.contact);
 if(await hydroPurchase(env,j))return reportJSON({alreadyPaid:true,analysisId:j.id,message:'Payment is already verified. Resume this analysis; do not pay again.'});
 if(!reportCardReady(env))return reportJSON({error:'Online payment is not configured. No analysis has started and no payment was taken. Contact support@sieg.ltd.'},503);
 const id='SIEG-'+j.id.slice(9);let o=await reportRead(env,reportKey(id));
 if(o&&['cancelled','payment_failed'].includes(o.state))return reportJSON({error:'A previous payment attempt exists. Check its status or contact support before paying again.',...reportPublic(o)},409);
 if(!o){o={id,owner,service:product.service,kind:['catchment','wetlands'].includes(product.service)?'download':'report',method:'card',contact,amount:j.amount,currency:j.currency,state:'awaiting_payment',analysisService:j.service,analysisPurchaseId:j.id,task:j.task,year:j.year,filesReady:false,createdAt:new Date().toISOString()};await env.BUCKET.put(reportKey(id),JSON.stringify(o),{onlyIf:{etagDoesNotMatch:'*'}});o=await reportRead(env,reportKey(id));}
 j.paymentOrder=id;await usageSave(env,j);
 if(o.owner!==owner||o.analysisPurchaseId!==j.id)throw Error('Payment ownership mismatch.');
 if(o.state==='paid'){await hydroGrant(env,o);return reportJSON({...reportPublic(o),alreadyPaid:true});}
 if(!o.paymentRequestId){
  const lock='hydrology/checkouts/'+id,held=await env.BUCKET.put(lock,String(Date.now()),{onlyIf:{etagDoesNotMatch:'*'}});
  if(!held)return reportJSON({error:'Checkout is being prepared or its outcome needs checking. Check payment status before retrying.',...reportPublic(o)},409);
  // Keep an uncertain initiation locked: never create a second charge after a timeout.
  const f={PAYGATE_ID:env.PAYGATE_ID,REFERENCE:id,AMOUNT:String(o.amount),CURRENCY:o.currency,RETURN_URL:new URL(request.url).origin+'/report-payment.html?order='+id,TRANSACTION_DATE:new Date().toISOString().replace('T',' ').slice(0,19),LOCALE:'en-za',COUNTRY:'SWZ',EMAIL:o.contact.email,PAY_METHOD:'CC',PAY_METHOD_DETAIL:'Visa',NOTIFY_URL:new URL(request.url).origin+'/api/reports/paygate/notify'};
  const d=await reportGateway(env,'initiate',f);if(d.PAYGATE_ID!==env.PAYGATE_ID||d.REFERENCE!==id||!d.PAY_REQUEST_ID)throw Error('Checkout could not be verified. Contact support before retrying.');o.paymentRequestId=d.PAY_REQUEST_ID;o.paymentChecksum=d.CHECKSUM;await reportSave(env,o);
 }
 return reportJSON({...reportPublic(o),checkout:{url:'https://secure.paygate.co.za/payweb3/process.trans',fields:{PAY_REQUEST_ID:o.paymentRequestId,CHECKSUM:o.paymentChecksum}}});
}
async function hydroFulfil(request,env,b){
 const j=await usageJob(env,b.analysisId);if(!j||j.owner!==reportOwner(request)||!prepaid(j.service))return reportJSON({error:'Paid analysis not found.'},404);
 const o=await hydroRequirePaid(env,j),product=commerceProduct(j);if(j.service==='eco'&&!j.extraServiceDecided&&!o.filesReady)throw Error('Confirm your extra service, or continue without one, before finalizing the report.');
 if(b.service!==product.service)throw Error('These files do not match the purchased service.');
 if(j.state!=='running')throw Error('Run the paid analysis before requesting its results.');
 const previous=o.filesReady?await reportRead(env,'reports/files/'+o.id+'.json'):null,upgradePDF=b.files?.some(f=>f.type==='application/pdf')&&previous?.files?.some(f=>f.type==='text/html'||f.type==='application/pdf'&&(f.reportTemplateVersion!==b.files.find(item=>item.type==='application/pdf')?.reportTemplateVersion||f.reportMetadata?.version!==b.files.find(item=>item.type==='application/pdf')?.reportMetadata?.version||JSON.stringify(f.reportMetadata?.indicatorSelections)!==JSON.stringify(b.files.find(item=>item.type==='application/pdf')?.reportMetadata?.indicatorSelections)));
 if(o.clientEmailSent&&!upgradePDF)return reportJSON({...reportPublic(o),message:'Your files have already been emailed. No additional payment is required.'});
 reportValidate({...b,kind:o.kind,method:'card',requestId:o.id.slice(5),contact:{...o.contact,consent:true}});
 if(!o.filesReady||upgradePDF){if(upgradePDF&&previous)await env.BUCKET.put('reports/legacy-html/'+o.id+'.json',JSON.stringify(previous));await env.BUCKET.put('reports/files/'+o.id+'.json',JSON.stringify({files:b.files}));o.filesReady=true;await reportSave(env,o);}
 if(upgradePDF&&o.clientEmailSent&&!previous.files.some(f=>f.type==='text/html'))return reportJSON({...reportPublic(o),message:'Updated PDF report saved and available to download. No additional payment is required.'});
 if(upgradePDF){o.clientEmailSent=false;await reportSave(env,o);}
 await reportPaidDelivery(env,o);return reportJSON({...reportPublic(o),message:o.clientEmailSent?'Results emailed to the address supplied at checkout. No additional payment was taken.':'Results saved. Email delivery is pending; retry with this reference.'});
}
async function hydroRecovery(request,env,b){
 const j=await usageJob(env,b.id);if(!j||j.owner!==reportOwner(request)||!prepaid(j.service))return reportJSON({error:'Paid analysis not found.'},404);
 const o=await hydroRequirePaid(env,j);if(!['retry','refund-review'].includes(b.action))throw Error('Choose retry or refund review.');
 if(b.action==='retry'){return reportJSON({analysis:usagePublic(j),message:'Your payment remains valid. Resume this analysis without another payment.'});}
 o.recovery={action:'refund-review',state:'requested',reason:String(b.reason||'Processing could not be completed.').slice(0,500),requestedAt:new Date().toISOString()};await reportSave(env,o);
 return reportJSON({message:'Refund review requested. SIEG will review the payment and processing failure. A refund has not yet been issued.',reference:o.id});
}
async function hydroQuotePrice(request,env){try{const j=await usageJob(env,new URL(request.url).searchParams.get('id'));if(!j||j.owner!==reportOwner(request)||!prepaid(j.service))return reportJSON({error:'Quote not found.'},404);const d=await loginPlanPricing(request,env,{quote:{price:j.amount/100}});if(!d.prices)return reportJSON({error:'Local pricing is temporarily unavailable.'},503);return reportJSON({displayPrice:new Intl.NumberFormat('en',{style:'currency',currency:d.profile.currency,currencyDisplay:'code'}).format(d.prices.quote),profile:d.profile});}catch{return reportJSON({error:'Local pricing is temporarily unavailable.'},503)}}

function fieldsReportItems(items,task){const keys=['soil','suitability','weather','recommendations','monitoring','yield'];const fallback=task==='soil-properties'?'soil':task;const chosen=items===undefined?[fallback]:items;if(!Array.isArray(chosen)||!chosen.length||chosen.some(x=>!keys.includes(x)))throw Error('Select valid report items.');return keys.filter(k=>k==='recommendations'||chosen.includes(k));}

function ecoReportItems(items,task){const keys=Object.keys(ECO_TASKS),chosen=items===undefined?[task]:items;if(!Array.isArray(chosen)||!chosen.length||chosen.some(x=>!keys.includes(x)))throw Error('Select at least one valid Eco report item.');return keys.filter(k=>chosen.includes(k));}

function hydroSingleReportItem(items,task){const keys=['farm-water-assessment','flood-risk-screening','catchment-assessment','flood-watch'];const chosen=items===undefined?[task]:items;if(!Array.isArray(chosen)||!chosen.length||chosen.some(x=>!keys.includes(x))||!chosen.includes(task))throw Error('Choose valid Hydrology services for the report.');return keys.filter(k=>chosen.includes(k));}
function analysisIndicatorChoices(items){if(items===undefined)return [];if(!Array.isArray(items)||items.length>80)throw Error('Invalid indicator selections.');return items.map(item=>{if(!item||['group','value','label'].some(k=>typeof item[k]!=='string'||item[k].length>140))throw Error('Invalid indicator selection.');return {group:item.group,value:item.value,label:item.label};});}
