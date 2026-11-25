import {createRemoteJWKSet,jwtVerify} from 'jose';
const keysets=new Map();
export function anonymousRequest(request){
 const headers=new Headers(request.headers);
 for(const key of [...headers.keys()])if(key.toLowerCase().startsWith('oai-'))headers.delete(key);
 return new Request(request,{headers});
}
export async function identityRequest(request,env,verify=jwtVerify){
 const clean=anonymousRequest(request),headers=new Headers(clean.headers);
 const token=request.headers.get('cf-access-jwt-assertion')||request.headers.get('Cookie')?.match(/(?:^|;\s*)CF_Authorization=([^;]+)/)?.[1];
 if(token){
  const issuer=env.CF_ACCESS_TEAM_DOMAIN,audience=env.CF_ACCESS_AUD;
  if(!/^https:\/\/[a-z0-9-]+\.cloudflareaccess\.com$/.test(issuer||'')||!/^[a-f0-9]{64}$/i.test(audience||''))throw Error('Access configuration invalid');
  let jwks=keysets.get(issuer);if(!jwks){jwks=createRemoteJWKSet(new URL(issuer+'/cdn-cgi/access/certs'));keysets.set(issuer,jwks)}
  const {payload}=await verify(token,jwks,{issuer,audience,algorithms:['RS256'],requiredClaims:['sub','email','exp','iat']});
  if(typeof payload.sub!=='string'||!payload.sub||typeof payload.email!=='string'||!payload.email.includes('@'))throw Error('User identity required');
  headers.set('oai-authenticated-user-id','cf:'+payload.sub);
  headers.set('oai-authenticated-user-email',payload.email.toLowerCase());
 }
 return new Request(clean,{headers});
}
