"""Build the latest Cloudflare UI for the existing owner-private Sites host.
Sites supplies authenticated identity upstream. This bundle must remain owner-private.
The standalone Cloudflare deployment continues to verify Access JWTs in edge.js.
"""
from pathlib import Path
import subprocess,sys,json,gzip,base64,mimetypes,shutil
root=Path(__file__).resolve().parent.parent
subprocess.run([sys.executable,str(root/'scripts/build_cloudflare.py')],cwd=root,check=True)
values=[];index={};paths={}
for p in (root/'cloudflare-dist/public').rglob('*'):
 if not p.is_file():continue
 name=p.relative_to(root/'cloudflare-dist/public').as_posix();raw=p.read_bytes()
 if name=='cloudflare-account.js':raw=raw.replace(b"link.textContent='Sign out';link.href='/logout'",b"link.textContent='Account';link.href='/'")
 packed=gzip.compress(raw,mtime=0);compressed=p.suffix!='.json' and len(packed)<len(raw)
 item=[mimetypes.guess_type(name)[0] or 'application/octet-stream',base64.b64encode(packed if compressed else raw).decode(),compressed]
 key=tuple(item)
 if key not in index:index[key]=len(values);values.append(item)
 paths[name]=index[key]
base=(root/'cloudflare-dist/app.js').read_text().split('\n',1)[1]
assert base.count('export default {async fetch(request,env)')==1
base=base.replace('export default {async fetch(request,env)','const privateApp={async fetch(request,env)',1)
base=base.replace("if(!file)return env.ASSETS.fetch(request);","if(!file)return new Response('Not found',{status:404});")
base=base.replace('export async function verifyAnalysisSetup','async function verifyAnalysisSetup')
edge=(root/'cloudflare/edge.js').read_text()
edge='\n'.join(line for line in edge.splitlines() if not line.startswith('import '))
edge=edge.replace('export const RELEASE','const RELEASE').replace('export function ','function ')
edge=edge.replace("if(path==='/mcp')return json({error:'This integration is not enabled on this host.'},503);",'')
prefix='const EMBEDDED_ASSETS='+json.dumps(values,separators=(',',':'))+';\nconst EMBEDDED_FILES=Object.fromEntries(Object.entries('+json.dumps(paths,separators=(',',':'))+').map(([path,index])=>[path,EMBEDDED_ASSETS[index]]));\n'
routes=json.loads((root/'cloudflare/service-routes.json').read_text())
adapter="\nconst serviceRoutes="+json.dumps(routes)+";\nconst identityRequest=async request=>request;\nconst anonymousRequest=request=>request;\n"
result=prefix+base+adapter+edge+'\nexport default {fetch:createHandler(privateApp,verifyAnalysisSetup,{identify:identityRequest})};\n'
out=root/'dist';shutil.rmtree(out);(out/'server').mkdir(parents=True);(out/'.openai').mkdir()
(out/'server/index.js').write_text(result)
shutil.copyfile(root/'.openai/hosting.json',out/'.openai/hosting.json')
shutil.copytree(root/'drizzle',out/'drizzle',dirs_exist_ok=True)
print('Owner-private preview built:',len(paths),'assets;',len(result.encode()),'Worker bytes')
