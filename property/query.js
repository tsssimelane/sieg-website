function parsePropertyQuery(text,records,countries=[],selectedCountry=''){
 const q=text.toLowerCase().replace(/,/g,'').replace(/square\s+met(?:er|re)s?/g,'m²').replace(/sqm|sq\.?\s*m\b/g,'m²');
 const namedCountry=[...countries].sort((a,b)=>b.name.length-a.name.length).find(c=>new RegExp('(?:^|[^a-z])'+c.name.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'(?:$|[^a-z])').test(q));
 const scoped=namedCountry?.code||selectedCountry;
 const local=scoped?records.filter(p=>(p.countryCode||'SZ')===scoped):records;
 const city=local.map(p=>p.city).filter(Boolean).sort((a,b)=>b.length-a.length).find(c=>q.includes(c.toLowerCase()));
 const region=!city&&local.map(p=>p.region).filter(Boolean).sort((a,b)=>b.length-a.length).find(r=>q.includes(r.toLowerCase()));
 const matches=new Set(local.filter(p=>city?p.city===city:region?p.region===region:false).map(p=>p.countryCode||'SZ'));
 const country=scoped||(matches.size===1?[...matches][0]:''),currency=countries.find(c=>c.code===country)?.currency||(country==='SZ'?'SZL':null);
 const explicit=[...new Set([...q.matchAll(/\b[a-z]{3}\b/g)].map(m=>m[0].toUpperCase()).filter(code=>countries.some(c=>c.currency===code)))];
 const token='(?:'+[...new Set(['e','r','szl','zar',...explicit.map(x=>x.toLowerCase())])].join('|')+')?';
 const types=[];if(/\b(houses?|homes?|residential|bedrooms?)\b/.test(q))types.push('Residential');if(/\b(land|plots?|parcels?)\b/.test(q))types.push('Land');if(/\b(farms?|agricultur\w*|smallholdings?)\b/.test(q))types.push('Agricultural');if(/\b(commercial|offices?|shops?)\b/.test(q))types.push('Commercial');
 const amount=(n,u)=>Number(n)*(u==='million'||u==='m'?1e6:u==='k'||u==='thousand'?1e3:1);
 const number='([0-9]+(?:\\.[0-9]+)?)\\s*(million|thousand|k|m(?![²2a-z]))?';
 const priceText=q.replace(/(?:under|below|up to|over|above|at least|larger than|smaller than|maximum|max|minimum|min)\s*[0-9]+(?:\.[0-9]+)?\s*(?:m²|m2|hectares?|ha\b)/g,'');
 const priceMax=new RegExp('(?:under|below|up to|maximum|max|budget(?: of)?)\\s*'+token+'\\s*'+number+'(?!\\s*(?:m²|m2|hectares?|ha\\b))').exec(priceText);
 const priceMin=new RegExp('(?:over|above|at least|minimum|min|from)\\s*'+token+'\\s*'+number).exec(priceText);
 const range=new RegExp('between\\s*'+token+'\\s*'+number+'\\s*and\\s*'+token+'\\s*'+number).exec(priceText);
 const areaMin=/(?:over|above|at least|larger than|minimum|min)\s*([0-9]+(?:\.[0-9]+)?)\s*(m²|m2|hectares?|ha\b)/.exec(q);
 const areaMax=/(?:under|below|up to|smaller than|maximum|max)\s*([0-9]+(?:\.[0-9]+)?)\s*(m²|m2|hectares?|ha\b)/.exec(q);
 const beds=/(\d+)\s*(?:\+\s*)?(?:bedrooms?|beds?)/.exec(q);
 const result={query:city||'',region:region||'',country,currency,types:types.length?types:['Residential','Commercial','Land','Agricultural'],minPrice:priceMin?amount(priceMin[1],priceMin[2]):'',maxPrice:priceMax?amount(priceMax[1],priceMax[2]):'',minArea:areaMin?Number(areaMin[1])*(areaMin[2].startsWith('h')?1e4:1):'',maxArea:areaMax?Number(areaMax[1])*(areaMax[2].startsWith('h')?1e4:1):'',beds:beds?Math.min(Number(beds[1]),4):0,sort:/cheapest|lowest price/.test(q)?'low':/largest|biggest/.test(q)?'area':'date'};
 if(range){result.minPrice=amount(range[1],range[2]);result.maxPrice=amount(range[3],range[4])}
 const priceSearch=priceMax||priceMin||range||result.sort==='low';
 if(priceSearch&&!currency)result.priceIssue='Select a country or name it in your search to compare prices in one local currency.';
 else if(priceSearch&&(explicit.some(code=>code!==currency)||/\b(?:e|r)\s*(?=\d)/.test(q)&&((/\be\s*(?=\d)/.test(q)&&currency!=='SZL')||(/\br\s*(?=\d)/.test(q)&&currency!=='ZAR'))))result.priceIssue='Use '+currency+' for prices in the selected country.';
 else if(!priceSearch&&/\b(?:budget|price|between|under|below|maximum)\b.*(?:[$€£¥]|\b[a-z]{3}\s+\d)/.test(q)&&!/m²|\bha\b/.test(q))result.priceIssue='Enter a price using the selected country’s currency code, without a currency symbol.';
 result.transaction=/\b(rent|rental|rentals|lease|monthly)\b/.test(q)?'rental':/\b(sale|buy|purchase)\b/.test(q)||priceSearch?'sale':'';
 result.recognized=!!(result.transaction||namedCountry||city||region||types.length||priceMax||priceMin||range||areaMin||areaMax||beds||/cheapest|largest|biggest/.test(q));
 result.unsupported=[];if(/\b(pool|garage|sea|near|schools?|hospital|title|owner|furnished)\b/.test(q))result.unsupported.push('Amenities, proximity and ownership filters are not available in this search.');if(beds&&+beds[1]>4)result.unsupported.push('Bedroom filter supports 4 or more, rather than an exact count above 4.');return result;
}
