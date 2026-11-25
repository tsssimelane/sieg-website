// Appended to the server bundle; private credentials never leave this module.
export async function verifyAnalysisSetup(env){
 let config;try{config=geeConfig(env)}catch{return {authorization:'invalid',asset:'not_checked',message:'Replace the malformed Earth Engine service-account JSON secret.'}}
 if(!config)return {authorization:'missing',asset:'not_checked',message:'Add the Earth Engine project and service-account JSON secret in Worker runtime settings.'};
 try{
  const token=await geeAccessToken(config);
  const upstream=await fetch('https://earthengine.googleapis.com/v1/projects/ee-gee023/assets/Eswatini_Villages',{headers:{Authorization:'Bearer '+token,'X-Goog-User-Project':config.project},signal:AbortSignal.timeout(15000)});
  if(upstream.ok)return {authorization:'verified',asset:'verified',message:'Google accepted the credential and the village asset is readable. Run a small-area analysis separately.'};
  const messages={401:'Google rejected the credential. Check whether its key is still active.',403:'Check Earth Engine registration, API permissions and Reader access to the village asset.',404:'The village asset is missing or not visible to this service account.',429:'Earth Engine is busy or quota-limited. Retry later.'};
  return {authorization:'token_issued',asset:'unavailable',providerStatus:upstream.status,message:messages[upstream.status]||'Earth Engine could not complete the asset check. Retry later.'};
 }catch{return {authorization:'unavailable',asset:'not_checked',message:'Google authorization or connectivity failed. Check the active service-account key and retry.'}}
}
