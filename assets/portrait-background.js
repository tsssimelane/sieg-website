(()=>{'use strict';
 const runtime='https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.5.2';
 let pending;
 function segmenter(){
  if(!pending)pending=(async()=>{
   const {pipeline,env,RawImage}=await import(runtime);
   env.allowLocalModels=false;
   env.backends.onnx.wasm.numThreads=1;
   const run=await pipeline('background-removal','Xenova/modnet',{device:'wasm',dtype:'q8'});
   return {run,RawImage};
  })().catch(error=>{pending=null;throw Error('The photo tool couldn’t load. Try again or continue without a picture.',{cause:error});});
  return pending;
 }
 function canvas(width,height){
  const c=document.createElement('canvas');c.width=width;c.height=height;return c;
 }
 function whiteBackground(source,portrait){
  if(!portrait||portrait.channels!==4||portrait.width!==source.width||portrait.height!==source.height)throw Error('The photo could not be separated from its background. Try a clearer portrait.');
  const ctx=source.getContext('2d'),pixels=ctx.createImageData(source.width,source.height);
  let personPixels=0;
  for(let i=0;i<pixels.data.length;i+=4){
   const alpha=portrait.data[i+3]/255;
   if(alpha>=.6)personPixels++;
   for(let channel=0;channel<3;channel++)pixels.data[i+channel]=Math.round(portrait.data[i+channel]*alpha+255*(1-alpha));
   pixels.data[i+3]=255;
  }
  if(personPixels<source.width*source.height*.01)throw Error('No clear portrait was found. Choose a photo with a person in the foreground.');
  ctx.putImageData(pixels,0,0);
  return source.toDataURL('image/jpeg',.82);
 }
 async function prepare(file,maxSize=600){
  if(!file?.size)return null;
  if(file.size>5*1024*1024)throw Error('Choose a photo no larger than 5 MB.');
  if(!['image/jpeg','image/png','image/webp'].includes(file.type))throw Error('Choose a JPEG, PNG or WebP photo.');
  const bitmap=await createImageBitmap(file).catch(()=>{throw Error('The picture could not be opened. Choose another photo.');});
  let source;
  try{
   const scale=Math.min(1,maxSize/Math.max(bitmap.width,bitmap.height));
   source=canvas(Math.max(1,Math.round(bitmap.width*scale)),Math.max(1,Math.round(bitmap.height*scale)));
   source.getContext('2d').drawImage(bitmap,0,0,source.width,source.height);
  }finally{bitmap.close();}
  const {run,RawImage}=await segmenter();
  const {data}=source.getContext('2d').getImageData(0,0,source.width,source.height);
  const input=new RawImage(data,source.width,source.height,4).rgb();
  const [portrait]=await run(input);
  return whiteBackground(source,portrait);
 }
 window.SiegPortrait={prepare};
})();
