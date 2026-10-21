import './style.css';
import { SkinViewer } from 'skinview3d';
import { makeDemoSkin } from './demo.js';
import { lookupAccount, loadSkinImage } from './api.js';
import { motions, createSword, applyPose, configureCamera, motionIllustration } from './motions.js';
import { exportGif } from './export.js';
import { zipSync } from 'fflate';
import { prepareEffects } from './effects.js';
import { motionTiming, loadDurations, saveDurations } from './timing.js';

const $ = selector => document.querySelector(selector);
const icons = {
  sparkle:'<path d="m12 2 2.6 7.4L22 12l-7.4 2.6L12 22l-2.6-7.4L2 12l7.4-2.6L12 2Z"/>',
  help:'<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 0 1 5 0c0 2-2.5 2-2.5 4m0 3h.01"/>',
  user:'<circle cx="12" cy="8" r="3.5"/><path d="M5 21v-2a7 7 0 0 1 14 0v2"/>',
  search:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
  upload:'<path d="M12 16V3m-4 4 4-4 4 4M4 15v5h16v-5"/>',
  layers:'<path d="m12 3 10 5-10 5L2 8Zm-10 9 10 5 10-5M2 16l10 5 10-5"/>',
  shield:'<path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6Z"/><path d="m8 12 3 3 5-6"/>',
  arrow:'<path d="M4 12h16m-6-6 6 6-6 6"/>',
  pause:'<path d="M8 5v14M16 5v14" stroke-width="3"/>',
  play:'<path d="m8 4 12 8-12 8Z"/>',
  reset:'<path d="M3 11a9 9 0 1 1 2 7M3 4v7h7"/>',
  mouse:'<rect x="6" y="2" width="12" height="20" rx="6"/><path d="M12 6v4"/>',
  loop:'<path d="m17 3 4 4-4 4M3 11V7h18M7 21l-4-4 4-4m14 0v4H3"/>',
  download:'<path d="M12 3v13m-5-5 5 5 5-5M4 17v4h16v-4"/>',
};
function icon(name) { return `<svg viewBox="0 0 24 24" aria-hidden="true">${icons[name] || ''}</svg>`; }
document.querySelectorAll('[data-icon]').forEach(el=>el.innerHTML=icon(el.dataset.icon));

const state = { skin:makeDemoSkin(), detectedModel:'default', name:'示例玩家', motion:'spin', background:'#e8f4ff', phase:0, paused:matchMedia('(prefers-reduced-motion: reduce)').matches, busy:false, querying:false, resultUrl:null, resultVersion:-1, version:0, resultMeta:null, batchController:null };
const durations=loadDurations();
$('#duration').value=String(durations[state.motion]);
function setStageBackground(color) { $('#stage').style.setProperty('--stage',color); $('#stage').classList.toggle('transparent-stage',color==='transparent'); }
let viewer, sword, lastTime=performance.now(), toastTimer, loadSequence=0;

function toast(message) { $('#toast').textContent=message; $('#toast').hidden=false; clearTimeout(toastTimer); toastTimer=setTimeout(()=>$('#toast').hidden=true,4500); }
function accountStatus(message,error=false) { $('#account-status').classList.toggle('error',error); $('#account-status span:last-child').textContent=message; }
function invalidate() { state.version++; if(!$('#gif-result').hidden) showLive(); }
function effectiveModel() { return $('#model').value==='auto' ? state.detectedModel : $('#model').value; }
function updateModelBadge() { $('#model-badge').textContent=`${viewer?.playerObject.skin.modelType==='slim'?'ALEX':'STEVE'} · ${$('#outer-layer').checked?'双层皮肤':'仅内层'}`; }
function updateGenerate() { $('#generate').disabled=$('#download-all').disabled=!viewer || state.querying || state.busy; }
function updateTimingControls(){
  const fast=state.motion==='sneak';
  $('#fps').disabled=state.busy||fast;
  $('#duration').disabled=state.busy;
  $('#timing-note').hidden=!fast;
}
function updatePause() { $('#pause').innerHTML=icon(state.paused?'play':'pause'); $('#pause').setAttribute('aria-label',state.paused?'播放动画':'暂停动画'); $('#pause').title=state.paused?'播放动画':'暂停动画'; }

async function renderExport(options){
  const blob=await exportGif({...options,signal:options.signal||new AbortController().signal,onProgress:options.onProgress||(()=>{})});
  return new Uint8Array(await blob.arrayBuffer());
}

$('#motion-count').textContent=`共 ${motions.length} 种动作`;
$('#motion-grid').innerHTML=motions.map(m=>`<button class="motion-card ${m.id==='spin'?'active':''}" data-motion="${m.id}" aria-pressed="${m.id==='spin'}"><span class="motion-check">✓</span>${motionIllustration(m.id)}<strong>${m.title}</strong><small>${m.subtitle}</small></button>`).join('');

try {
  const stage=$('#stage');
  viewer=new SkinViewer({ canvas:$('#skin-canvas'), width:stage.clientWidth, height:stage.clientHeight, pixelRatio:Math.min(devicePixelRatio,2), skin:state.skin, model:'default', fov:40, renderPaused:true, preserveDrawingBuffer:true });
  viewer.controls.enablePan=false;
  viewer.controls.enableDamping=false;
  viewer.controls.minDistance=18;
  viewer.controls.maxDistance=115;
  sword=createSword(); viewer.playerObject.skin.rightArm.add(sword);
  configureCamera(viewer,motions[0]);
  viewer.controls.addEventListener('change',()=>{ if(!state.busy) invalidate(); });
  new ResizeObserver(()=>{
    if(!viewer.canvas.hidden&&stage.clientWidth>0&&stage.clientHeight>0)viewer.setSize(stage.clientWidth,stage.clientHeight);
  }).observe(stage);
  function tick(now) {
    const dt=Math.min((now-lastTime)/1000,.1); lastTime=now;
    if(!state.paused && !state.busy && !document.hidden) state.phase=(state.phase+dt/durations[state.motion])%1;
    if(!document.hidden && !$('#skin-canvas').hidden) { applyPose(viewer,sword,state.motion,state.phase); viewer.render(); }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
} catch(error) {
  $('#stage-error').hidden=false;
  $('#stage-error').textContent='3D 预览未能启动。请使用支持 WebGL 的新版 Chrome、Edge 或 Firefox，并开启浏览器硬件加速。';
  console.error('Skin renderer failed:',error);
}
updateGenerate(); updatePause();

function selectMotion(id) {
  if(state.busy || !viewer) return;
  state.motion=id; state.phase=0;
  $('#duration').value=String(durations[id]);
  const motion=motions.find(m=>m.id===id);
  document.querySelectorAll('.motion-card').forEach(el=>{ el.classList.toggle('active',el.dataset.motion===id); el.setAttribute('aria-pressed',String(el.dataset.motion===id)); });
  $('#ground-shadow').hidden=['head','death','revive','explode'].includes(id);
  configureCamera(viewer,motion); updateTimingControls(); invalidate();
  prepareEffects(viewer,id).catch(error=>toast(error.message));
}
$('#motion-grid').addEventListener('click',event=>{const button=event.target.closest('[data-motion]'); if(button)selectMotion(button.dataset.motion);});
$('#pause').addEventListener('click',()=>{state.paused=!state.paused;updatePause();});
$('#reset-view').addEventListener('click',()=>{ if(viewer){configureCamera(viewer,motions.find(m=>m.id===state.motion));state.phase=0;invalidate();} });

function showLive() {
  $('#live-tab').classList.add('active'); $('#live-tab').setAttribute('aria-selected','true');
  $('#gif-tab').classList.remove('active'); $('#gif-tab').setAttribute('aria-selected','false');
  $('#skin-canvas').hidden=false; $('#gif-result').hidden=true;
  if(viewer&&$('#stage').clientWidth>0)viewer.setSize($('#stage').clientWidth,$('#stage').clientHeight);
  $('.stage-decoration').hidden=false; $('.floor-grid').hidden=false;
  $('#ground-shadow').hidden=['head','death','revive','explode'].includes(state.motion);
  $('.playback-controls').hidden=false; $('#download').hidden=true; $('.loop-badge').hidden=false;
  $('#preview-status').textContent='LIVE PREVIEW'; $('#preview-hint').textContent='拖动旋转视角 · 滚轮缩放';
  $('#player-name').textContent=state.name;
  setStageBackground(state.background);
  updateModelBadge();
}
function showResult() {
  if(!state.resultUrl) return;
  $('#live-tab').classList.remove('active'); $('#live-tab').setAttribute('aria-selected','false');
  $('#gif-tab').classList.add('active'); $('#gif-tab').setAttribute('aria-selected','true');
  $('#skin-canvas').hidden=true; $('#gif-result').hidden=false;
  $('.stage-decoration').hidden=true; $('.floor-grid').hidden=true; $('#ground-shadow').hidden=true;
  $('.playback-controls').hidden=true; $('#download').hidden=false; $('.loop-badge').hidden=true;
  $('#preview-status').textContent='GIF READY';
  const meta=state.resultMeta;
  $('#preview-hint').textContent=`${meta.size} × ${meta.size} · ${meta.frames} 帧 · ${meta.duration} 秒 · ${meta.bytes}`;
  $('#player-name').textContent=meta.name;
  $('#model-badge').textContent=meta.modelBadge;
  setStageBackground(meta.background);
  $('.new-dot').hidden=true;
}
$('#live-tab').addEventListener('click',showLive); $('#gif-tab').addEventListener('click',showResult);

$('#account-form').addEventListener('submit',async event=>{
  event.preventDefault(); if(state.busy || state.querying || !viewer)return;
  const name=$('#username').value.trim();
  if(!/^[A-Za-z0-9_]{1,16}$/.test(name)){accountStatus('请输入 1–16 位字母、数字或下划线组成的游戏名。',true);$('#username').focus();return;}
  const sequence=++loadSequence;
  state.querying=true; $('#lookup').disabled=true; $('#lookup span:nth-child(2)').textContent='正在获取皮肤…'; updateGenerate();
  accountStatus('正在连接 Mojang，必要时将尝试兼容查询…');
  try {
    const account=await lookupAccount(name);
    const image=await loadSkinImage(account.url);
    if(sequence!==loadSequence)return;
    viewer.loadSkin(image,{model:account.model});
    state.skin=image; state.detectedModel=account.model; state.name=account.name;
    $('#model').value='auto'; viewer.playerObject.skin.setOuterLayerVisible($('#outer-layer').checked);
    $('#player-name').textContent=account.name; updateModelBadge(); invalidate();
    accountStatus(`已加载 ${account.name} · ${account.source}`); toast('皮肤已加载。');
  } catch(error) { if(sequence===loadSequence)accountStatus(error.message,true); }
  finally { if(sequence===loadSequence){state.querying=false;$('#lookup').disabled=false;$('#lookup span:nth-child(2)').textContent='获取皮肤';updateGenerate();} }
});

$('#skin-file').addEventListener('change',async event=>{
  const file=event.target.files[0]; if(!file || state.busy || !viewer)return;
  const sequence=++loadSequence;
  state.querying=true; updateGenerate();
  try {
    const image=await loadSkinImage(file);
    if(sequence!==loadSequence)return;
    viewer.loadSkin(image,{model:'auto-detect'});
    state.skin=image; state.detectedModel=viewer.playerObject.skin.modelType;
    state.name=file.name.replace(/\.png$/i,'').slice(0,30) || '我的皮肤'; $('#model').value='auto';
    viewer.playerObject.skin.setOuterLayerVisible($('#outer-layer').checked);
    $('#player-name').textContent=state.name; updateModelBadge(); invalidate();
    accountStatus('本地皮肤已加载 · 可以手动调整手臂模型'); toast('本地皮肤已加载。');
  } catch(error) {if(sequence===loadSequence)accountStatus(error.message,true);}
  finally {event.target.value=''; if(sequence===loadSequence){state.querying=false;$('#lookup').disabled=false;$('#lookup span:nth-child(2)').textContent='获取皮肤';updateGenerate();}}
});
$('#model').addEventListener('change',()=>{if(!viewer)return;viewer.playerObject.skin.modelType=effectiveModel();updateModelBadge();invalidate();});
$('#outer-layer').addEventListener('change',()=>{if(!viewer)return;viewer.playerObject.skin.setOuterLayerVisible($('#outer-layer').checked);updateModelBadge();invalidate();});
document.querySelectorAll('.swatch').forEach(button=>button.addEventListener('click',()=>{
  if(state.busy)return;
  state.background=button.dataset.color;
  setStageBackground(state.background); $('#background-name').textContent=button.dataset.name;
  document.querySelectorAll('.swatch').forEach(el=>{el.classList.toggle('active',el===button);el.setAttribute('aria-pressed',String(el===button));});
  invalidate();
}));
for(const id of ['resolution','fps'])$('#'+id).addEventListener('change',invalidate);
$('#duration').addEventListener('change',()=>{
  durations[state.motion]=Number($('#duration').value);
  if(!saveDurations(durations))toast('当前浏览器无法保存设置；本次打开期间仍会记住各动作时长。');
  state.phase=0;invalidate();
});

let exportController;
$('#generate').addEventListener('click',async()=>{
  if(!viewer || state.busy || state.querying)return;
  state.busy=true; document.body.classList.add('busy');showLive();
  // Disable actual controls as well as pointer input, including keyboard navigation.
  const controls=[...document.querySelectorAll('.settings input,.settings select,.settings button,.motion-card,#reset-view,#pause,#download-all')];
  controls.forEach(el=>el.disabled=true);
  viewer.controls.enabled=false;
  $('#cancel-export').hidden=false;$('#cancel-export').disabled=false;
  $('#export-progress').hidden=false;
  $('#generate span:nth-child(2)').textContent='正在生成…';
  $('#progress').value=0;$('#progress-label').textContent='准备中…';
  exportController=new AbortController();
  const size=Number($('#resolution').value),fps=Number($('#fps').value),duration=Number($('#duration').value);
  const version=state.version;
  try {
    const blob=await exportGif({skin:state.skin,model:effectiveModel(),outer:$('#outer-layer').checked,motion:state.motion,background:state.background,size,fps,duration,camera:viewer.camera,signal:exportController.signal,onProgress:(value,label)=>{$('#progress').value=value;$('#progress-label').textContent=`${label} · ${value}%`;}});
    if(state.resultUrl)URL.revokeObjectURL(state.resultUrl);
    state.resultUrl=URL.createObjectURL(blob);state.resultVersion=version;
    const timing=motionTiming(state.motion,fps,duration);
    state.resultMeta={size,fps,frames:timing.frames,duration:timing.duration,bytes:blob.size>1048576?`${(blob.size/1048576).toFixed(1)} MB`:`${Math.round(blob.size/1024)} KB`,background:state.background,name:state.name,modelBadge:$('#model-badge').textContent};
    $('#gif-result').src=state.resultUrl;$('#download').href=state.resultUrl;
    $('#download').download=`SkinPop-${state.name.replace(/[^a-zA-Z0-9_\u4e00-\u9fa5-]/g,'_')}-${state.motion}.gif`;
    $('#gif-tab').disabled=false;showResult();toast('GIF 已生成，可以下载。');
  } catch(error) {if(error.name==='AbortError')toast('已取消生成。');else{toast(error.message || '生成失败，请降低尺寸后重试。');console.error(error);}}
  finally {
    state.busy=false; document.body.classList.remove('busy'); controls.forEach(el=>el.disabled=false);
    viewer.controls.enabled=true;updateTimingControls();$('#cancel-export').hidden=true;$('#export-progress').hidden=true;
    $('#generate span:nth-child(2)').textContent='生成 GIF';updateGenerate();
  }
});
$('#cancel-export').addEventListener('click',()=>{exportController?.abort();state.batchController?.abort();});

let zipUrl;
$('#download-all').addEventListener('click',async()=>{
  if(!viewer||state.busy||state.querying)return;
  state.busy=true;document.body.classList.add('busy');
  const controls=[...document.querySelectorAll('.settings input,.settings select,.settings button,.motion-card,#reset-view,#pause,#download-all')];controls.forEach(el=>el.disabled=true);viewer.controls.enabled=false;
  $('#cancel-export').hidden=false;$('#cancel-export').disabled=false;$('#export-progress').hidden=false;$('#progress').value=0;$('#progress-label').textContent='准备批量生成…';
  state.batchController=new AbortController();const files={};const wanted=motions;
  const signal=state.batchController.signal;
  const checkAbort=()=>{if(signal.aborted)throw new DOMException('生成已取消','AbortError');};
  const settings={skin:state.skin,model:effectiveModel(),outer:$('#outer-layer').checked,background:state.background,size:Number($('#resolution').value),fps:Number($('#fps').value)};
  const batchDurations={...durations};
  const prefix=`SkinPop-${state.name.replace(/[^a-zA-Z0-9_\u4e00-\u9fa5-]/g,'_')}`;
  $('#zip-download').hidden=true;
  try {
    for(let i=0;i<wanted.length;i++){
      checkAbort();
      const motion=wanted[i],camera=viewer.camera.clone();
      camera.position.set(...motion.camera);camera.lookAt(...motion.target);
      const bytes=await renderExport({...settings,motion:motion.id,duration:batchDurations[motion.id],camera,signal,onProgress:(value,label)=>{$('#progress').value=Math.round((i*100+value)/wanted.length);$('#progress-label').textContent=`${i+1}/${wanted.length} · ${motion.title} · ${label}`;}});
      checkAbort();files[`${String(i+1).padStart(2,'0')}-${motion.title}-${motion.id}.gif`]=bytes;
    }
    checkAbort();
    // GIF is already compressed; storing entries keeps packaging responsive.
    const zip=zipSync(files,{level:0});
    if(zipUrl)URL.revokeObjectURL(zipUrl);
    zipUrl=URL.createObjectURL(new Blob([zip],{type:'application/zip'}));
    const link=$('#zip-download');link.href=zipUrl;link.download=`${prefix}-all.zip`;link.hidden=false;link.click();
    $('#progress').value=100;$('#progress-label').textContent=`已打包 ${wanted.length} 个 GIF`;toast('ZIP 已生成，可以下载。');
  } catch(error){if(error.name==='AbortError')toast('已取消批量生成。');else{toast(error.message||'批量生成失败。');console.error(error);}}
  finally{state.busy=false;document.body.classList.remove('busy');controls.forEach(el=>el.disabled=false);viewer.controls.enabled=true;$('#cancel-export').hidden=true;$('#export-progress').hidden=true;state.batchController=null;updateGenerate();updateTimingControls();}
});
$('#help-open').addEventListener('click',()=>$('#help-dialog').showModal());
$('#help-close').addEventListener('click',()=>$('#help-dialog').close());
$('#help-dialog').addEventListener('click',event=>{if(event.target===$('#help-dialog')){const rect=event.target.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)event.target.close();}});
document.addEventListener('visibilitychange',()=>{lastTime=performance.now();});
window.addEventListener('pagehide',()=>{exportController?.abort();state.batchController?.abort();if(state.resultUrl)URL.revokeObjectURL(state.resultUrl);if(zipUrl)URL.revokeObjectURL(zipUrl);});
