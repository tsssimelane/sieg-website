import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';
import routes from './service-routes.json' with {type:'json'};
import app from '../cloudflare-dist/app.js';import {createHandler} from './edge.js';import {anonymousRequest} from './auth.js';
const root='cloudflare-dist/public';let assetPath;
const env={ASSETS:{fetch:async request=>{assetPath=new URL(request.url).pathname;try{return new Response(await fs.readFile(root+assetPath))}catch{return new Response('Not found',{status:404})}}}};
const handle=createHandler(app,()=>({}),{identify:async request=>anonymousRequest(request)});
for(const [slug,file]of Object.entries(routes)){
 test(slug+' serves its service page and declares the canonical URL',async()=>{const response=await handle(new Request('https://sieg.test/'+slug+'?year=2025'),env);assert.equal(response.status,200);assert.equal(assetPath,'/'+file);const html=await response.text();assert.ok(html.includes('rel="canonical" href="https://www.sieg.ltd/'+slug+'"'));assert.ok(html.includes('<header'));});
 test(slug+' old URLs and trailing slash redirect once with query intact',async()=>{for(const old of [file,file.replace(/\.html$/,''),slug+'/']){if(old===slug)continue;const response=await handle(new Request('https://sieg.test/'+old+'?year=2025&item=crops'),env);assert.equal(response.status,308,old);assert.equal(response.headers.get('Location'),'https://sieg.test/'+slug+'?year=2025&item=crops');const next=await handle(new Request(response.headers.get('Location')),env);assert.equal(next.status,200)}});
}
test('homepage navigation contains all renamed services and no old page links',async()=>{const html=await fs.readFile(root+'/index.html','utf8');for(const [slug,file]of Object.entries(routes)){assert.ok(html.includes('href="/'+slug+'"'),slug);assert.ok(!html.includes('href="'+file+'"'),file)}});
test('report payment return and API paths are not renamed or redirected',async()=>{const payment=await handle(new Request('https://sieg.test/report-payment.html'),env);assert.equal(payment.status,200);const health=await handle(new Request('https://sieg.test/api/health'),env);assert.equal(health.status,200);assert.equal(health.headers.get('Location'),null)});
