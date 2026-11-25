"""Build the published application with native Cloudflare static assets."""
from pathlib import Path
import subprocess,sys,json,shutil,base64,re
root=Path(__file__).resolve().parent.parent
service_routes=json.loads((root/'cloudflare/service-routes.json').read_text())
def rename_service_links(text):
 for slug,filename in service_routes.items():
  # Replace page URL tokens, never script directories, API names or analysis identifiers.
  text=re.sub(r'(?:https://www\.sieg\.ltd)?(?:(?:\.\./)+|\./|/)?'+re.escape(filename)+r'(?=[?\#\"\'<>\s]|$)', '/'+slug,text)
 text=re.sub(r'(?:https://www\.sieg\.ltd)?(?:(?:\.\./)+|\./|/)?environmental-monitoring\.html(?=[?\#\"\'<>\s]|$)','/eco',text)
 return text
if (root/'dist').exists():shutil.rmtree(root/'dist')
subprocess.run([sys.executable,str(root/'scripts/build_worker.py')],cwd=root,check=True)
s=(root/'dist/server/index.js').read_text()
lines=s.splitlines(keepends=True)
assets=json.loads(lines[0].removeprefix('const EMBEDDED_ASSETS=').strip().removesuffix(';'))
paths=json.loads(lines[1].split('Object.entries(',1)[1].split(').map(',1)[0])
out=root/'cloudflare-dist'
if out.exists():shutil.rmtree(out)
(out/'public').mkdir(parents=True)
embedded={}
import gzip
for name,idx in paths.items():
 item=assets[idx];raw=base64.b64decode(item[1]);raw=gzip.decompress(raw) if item[2] else raw
 if name.endswith(('.html','.js')):raw=rename_service_links(raw.decode('utf-8')).encode('utf-8')
 if name.endswith('.html'):
  text=raw.decode('utf-8').replace('/signin-with-chatgpt?', '/login?').replace('Sign in with ChatGPT','Sign in to SIEG').replace('Continue with ChatGPT','Continue to SIEG')
  if 'leaflet' in text:
   text=text.replace('</head>','<link rel="stylesheet" href="/assets/map-controls.css?v=20261114"></head>',1)
  slug=next((slug for slug,filename in service_routes.items() if name==filename),None)
  if slug:
   text=text.replace('</head>','<link rel="canonical" href="https://www.sieg.ltd/'+slug+'"></head>',1)
  if '<header' in text:
   text=text.replace('</head>','<link rel="stylesheet" href="/cloudflare-account.css"></head>',1).replace('</body>','<script src="/cloudflare-account.js" defer></script></body>',1)
  raw=text.encode('utf-8')
 if name=='property/upgrade.js':raw=raw.replace(b'/signin-with-chatgpt?',b'/login?').replace(b'Sign in with ChatGPT',b'Sign in to SIEG').replace(b'Continue with ChatGPT',b'Continue to SIEG')
 p=out/'public'/name;p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(raw)
 # Existing synchronous server lookups require JSON embedded in the Worker.
 if name.endswith('.json'):embedded[name]=item
s='const EMBEDDED_FILES='+json.dumps(embedded,separators=(',',':'))+';\n'+''.join(lines[2:])
s=s.replace("if(!file)return new Response('Not found',{status:404});","if(!file)return env.ASSETS.fetch(request);")
s=rename_service_links(s)
s+='\n'+(root/'cloudflare/analysis-check-source.js').read_text()
(out/'app.js').write_text(s)
for source,target in [('public-account.js','cloudflare-account.js'),('public-account.css','cloudflare-account.css'),('launch-admin.html','launch-admin.html')]:
 shutil.copyfile(root/'cloudflare'/source,out/'public'/target)
(out/'public/sitemap.xml').write_text('<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+''.join('<url><loc>https://www.sieg.ltd/'+slug+'</loc></url>' for slug in ['',*service_routes])+'</urlset>')
print('Cloudflare build:',len(paths),'assets; Worker bytes:',len(s.encode()))
