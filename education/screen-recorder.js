(()=>{'use strict';
const $=id=>document.getElementById(id),dialog=$('studyRecordDialog'),dock=$('studyRecordDock');
let recorder=null,display=null,mic=null,audio=null,mixed=null,writer=null,fileHandle=null,chunks=[],blob=null,blobURL=null,queue=Promise.resolve(),started=0,timer=null,busy=false,finishing=false,diskError=false,recordError=false;
const supported=!!(navigator.mediaDevices?.getUserMedia&&window.MediaRecorder);
const modeField=$('studyRecordMode');let mode='screen',composite=null,frameTimer=null,previewVideos=[];
let type='',extension='webm';
function format(){const onlyAudio=mode==='audio';type=(onlyAudio?['audio/webm;codecs=opus','audio/webm','audio/mp4']:['video/webm;codecs=vp8,opus','video/webm','video/mp4']).find(t=>MediaRecorder.isTypeSupported(t))||'';extension=type.includes('mp4')?(onlyAudio?'m4a':'mp4'):'webm';}
function configure(){mode='screen';modeField.value='screen';if(supported)format();$('studyRecordMic').checked=true;$('studyRecordAudio').checked=true;$('studyRecordMic').closest('label').hidden=true;$('studyRecordAudio').closest('label').hidden=true;$('studyRecordModeHelp').textContent='Capture your screen, camera and audio together. If the camera is unavailable, capture screen and audio. Select Share audio in the screen picker to include the call.';fileHandle=null;$('studyRecordClearLocation').hidden=true;$('studyRecordLocationNote').textContent='The recording stays on your device. Save it after stopping.';}
async function compositeVideo(screen,camera){
 const canvas=document.createElement('canvas');if(!canvas.captureStream)return null;
 const videos=[screen,camera].map(stream=>{const v=document.createElement('video');v.srcObject=stream;v.autoplay=true;v.muted=true;v.playsInline=true;return v});previewVideos=videos;await Promise.all(videos.map(v=>v.play()));
 const settings=screen.getVideoTracks()[0].getSettings();canvas.width=Math.min(1920,settings.width||1280);canvas.height=Math.round(canvas.width*(settings.height||720)/(settings.width||1280));const ctx=canvas.getContext('2d');if(!ctx)throw Error('Camera overlay unavailable.');
 const draw=()=>{try{ctx.drawImage(videos[0],0,0,canvas.width,canvas.height);if(camera.getVideoTracks()[0]?.readyState==='live'){const w=Math.round(canvas.width*.23),h=Math.round(w*9/16),gap=16;ctx.save();ctx.fillStyle='#fff';ctx.fillRect(canvas.width-w-gap-3,canvas.height-h-gap-3,w+6,h+6);ctx.drawImage(videos[1],canvas.width-w-gap,canvas.height-h-gap,w,h);ctx.restore();}}catch{}};draw();frameTimer=setInterval(draw,40);return canvas.captureStream(25);
}
modeField.addEventListener('change',configure);configure();
const filename=()=>`SIEG-study-recording-${new Date().toISOString().replace(/[:.]/g,'-')}.${extension}`;
const note=text=>$('studyRecordSetupStatus').textContent=text;
const state=text=>$('studyRecordState').textContent=text;
const active=()=>!!recorder&&recorder.state!=='inactive';
function elapsed(){const seconds=Math.floor((Date.now()-started)/1000);$('studyRecordTimer').textContent=[Math.floor(seconds/3600),Math.floor(seconds/60)%60,seconds%60].filter((v,i)=>i||seconds>=3600).map(v=>String(v).padStart(2,'0')).join(':');}
function release(){
 clearInterval(frameTimer);frameTimer=null;for(const video of previewVideos){video.pause?.();video.srcObject=null;}previewVideos=[];for(const stream of [display,mic,mixed,composite])stream?.getTracks().forEach(track=>track.stop());display=mic=mixed=composite=null;
 if(audio){audio.close().catch(()=>{});audio=null;}clearInterval(timer);timer=null;
}
function stop(){if(active()){state('Saving recording…');$('studyRecordStop').disabled=true;recorder.stop();}}
async function finish(){
 if(finishing)return;finishing=true;release();await queue;
 let saved=false;if(writer){try{await writer.close();saved=!diskError;}catch{diskError=true;}writer=null;}
 if(!fileHandle&&chunks.length){blob=new Blob(chunks,{type:recorder.mimeType||type||'video/webm'});chunks=[];}
 recorder=null;busy=false;dock.dataset.active='false';$('studyRecordStop').hidden=true;$('studyRecordSave').hidden=!blob;$('studyRecordDismiss').hidden=false;$('studyRecordScreen').disabled=false;
 state(diskError?'Recording stopped because the local file could not be written. Check free space; the file may be incomplete.':saved?(recordError?'Recording ended with an error; a partial file was saved.':'Recording saved to '+fileHandle.name+'.'):blob?(recordError?'Recording ended with an error. Save the available recording.':'Recording ready. Save it to your local drive.'):'No recording data was captured.');
 // A download link remains available if the browser blocks the automatic download.
 if(blob&&!recordError)download();finishing=false;
}
function download(){
 if(!blob)return;if(blobURL)URL.revokeObjectURL(blobURL);blobURL=URL.createObjectURL(blob);const a=document.createElement('a');a.href=blobURL;a.download=filename();document.body.append(a);a.click();a.remove();state('Recording ready. If the download did not start, select Save recording.');
}
$('studyRecordScreen').onclick=()=>{
 if(!supported){dock.hidden=false;state('Recording is unavailable in this browser. Try desktop Chrome or Edge.');$('studyRecordStop').hidden=true;$('studyRecordDismiss').hidden=false;return;}
 if(blob&&!confirm('Start a new recording? Save your previous recording first.'))return;
 blob=null;chunks=[];if(blobURL){URL.revokeObjectURL(blobURL);blobURL=null;}fileHandle=null;$('studyRecordClearLocation').hidden=true;$('studyRecordLocationNote').textContent='The recording stays on your device. You can save it after stopping.';$('studyRecordConsent').checked=false;note('');dialog.showModal();
};
$('studyRecordLocation').hidden=!window.showSaveFilePicker;
$('studyRecordLocation').onclick=async()=>{try{fileHandle=await window.showSaveFilePicker({suggestedName:filename(),types:[{description:mode==='audio'?'Audio recording':'Video recording',accept:{[type.split(';')[0]||(mode==='audio'?'audio/webm':'video/webm')]:['.'+extension]}}]});$('studyRecordLocationNote').textContent='Save to: '+fileHandle.name+'. Data will be written as you record.';$('studyRecordClearLocation').hidden=false;}catch(error){if(error.name!=='AbortError')note('Could not choose a save location. Use the download option instead.');}};
$('studyRecordClearLocation').onclick=()=>{fileHandle=null;$('studyRecordClearLocation').hidden=true;$('studyRecordLocationNote').textContent='You can download the recording after stopping.';};
$('studyRecordCancel').onclick=()=>dialog.close();
$('studyRecordStart').onclick=async()=>{
 if(busy||active())return;if(!$('studyRecordConsent').checked){note('Confirm permission from everyone being recorded.');return;}
 busy=true;diskError=recordError=false;$('studyRecordStart').disabled=true;$('studyRecordCancel').disabled=true;note('Allow your selected recording sources in the browser prompt…');
 try{
  mode=modeField.value||'screen';format();const includeAudio=mode==='screen'&&$('studyRecordAudio').checked,includeMic=mode==='audio'||$('studyRecordMic').checked;
  // Native media capture continues independently of animation frames and page visibility.
  if(mode==='screen'){
   if(!navigator.mediaDevices.getDisplayMedia)throw Error('Screen capture is unavailable in this browser. Try desktop Chrome or Edge.');
   display=await navigator.mediaDevices.getDisplayMedia({video:{displaySurface:'monitor',frameRate:{ideal:25,max:30}},audio:includeAudio,systemAudio:includeAudio?'include':'exclude',selfBrowserSurface:'include',surfaceSwitching:'include'});
   try{mic=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true},video:{facingMode:{ideal:'user'},width:{ideal:640},height:{ideal:360}}});}catch{try{mic=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true},video:false});}catch{mic=null;}}
   if(mic?.getVideoTracks().length){try{composite=await compositeVideo(display,mic)}catch{clearInterval(frameTimer);frameTimer=null;composite=null;}}
  }else if(mode==='camera')display=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'user'},width:{ideal:1280},height:{ideal:720}},audio:includeMic?{echoCancellation:true,noiseSuppression:true}:false});
  else mic=await navigator.mediaDevices.getUserMedia({video:false,audio:{echoCancellation:true,noiseSuppression:true}});
  const audioTracks=[...((includeAudio||mode==='camera')?display.getAudioTracks():[]),...(mic?.getAudioTracks()||[])];
  let outputAudio=[];
  if(audioTracks.length){const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)throw Error('Audio recording is unavailable in this browser.');audio=new Audio();await audio.resume();const destination=audio.createMediaStreamDestination();for(const track of audioTracks){const source=audio.createMediaStreamSource(new MediaStream([track])),gain=audio.createGain();gain.gain.value=audioTracks.length>1?.7:1;source.connect(gain);gain.connect(destination);}outputAudio=destination.stream.getAudioTracks();}
  if((includeMic||includeAudio)&&!outputAudio.length)throw Error('No audio was shared. Enable microphone access or select Share audio in the screen picker.');
  if(mode!=='audio'&&!display.getVideoTracks().some(t=>t.readyState==='live'))throw Error('Screen sharing ended before recording started.');
  mixed=new MediaStream([...(composite?.getVideoTracks()||display?.getVideoTracks()||[]),...outputAudio]);
  if(fileHandle)writer=await fileHandle.createWritable();
  chunks=[];queue=Promise.resolve();finishing=false;
  recorder=new MediaRecorder(mixed,{...(type?{mimeType:type}:{}),videoBitsPerSecond:2500000,audioBitsPerSecond:128000});
  recorder.ondataavailable=event=>{if(!event.data.size)return;if(writer){queue=queue.then(()=>writer.write(event.data)).catch(()=>{diskError=true;stop();});}else chunks.push(event.data);};
  recorder.onstop=finish;recorder.onerror=()=>{recordError=true;stop();};
  for(const track of (display?.getVideoTracks()||mic?.getAudioTracks()||[])){track.addEventListener('ended',stop);track.addEventListener('mute',()=>{if(active())state('Recording continues; the shared screen is temporarily unavailable. Restore the captured window or share your entire screen.');});track.addEventListener('unmute',()=>{if(active())state(mode==='audio'?'Recording audio.':'Recording '+(mode==='camera'?'camera video':'screen')+(audioTracks.length?' and audio':'')+'.');});}
  recorder.start(1000);started=Date.now();elapsed();timer=setInterval(elapsed,1000);dialog.close();dock.hidden=false;dock.dataset.active='true';$('studyRecordStop').hidden=false;$('studyRecordStop').disabled=false;$('studyRecordSave').hidden=true;$('studyRecordDismiss').hidden=true;$('studyRecordScreen').disabled=true;
  state((composite?'Recording camera + screen + audio.':mode==='screen'?'Recording screen + audio (camera overlay unavailable).':mode==='audio'?'Recording audio.':'Recording '+(mode==='camera'?'camera video':'screen')+(audioTracks.length?' and audio':'')+'.')+(includeAudio&&!display.getAudioTracks().length?' Shared audio unavailable; microphone only.':''));
 }catch(error){release();if(writer){await writer.abort().catch(()=>{});writer=null;}recorder=null;busy=false;note(error.name==='NotAllowedError'?'Screen, camera or microphone permission was denied. Allow access and try again.':error.name==='AbortError'?'Recording cancelled.':error.message||'Recording could not start.');}
 finally{$('studyRecordStart').disabled=false;$('studyRecordCancel').disabled=false;}
};
$('studyRecordStop').onclick=stop;$('studyRecordSave').onclick=download;$('studyRecordDismiss').onclick=()=>{dock.hidden=true;};
window.addEventListener('beforeunload',event=>{if(busy||active()||finishing){event.preventDefault();event.returnValue='Stop and save your recording before leaving.';}});
window.addEventListener('pagehide',()=>{if(active())stop();});
})();
