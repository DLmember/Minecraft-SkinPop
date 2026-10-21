import {chromium} from '@playwright/test';
import {parseGIF,decompressFrames} from 'gifuct-js';
import {unzipSync} from 'fflate';
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';

const browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const context=await browser.newContext({viewport:{width:1440,height:1200},acceptDownloads:true,offline:true});
const page=await context.newPage();const errors=[],requests=[];
page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url()))requests.push(r.url());});
page.on('console',m=>{if(m.type()==='error'||m.text().includes('GL_INVALID')||m.text().includes('bad image data'))errors.push(m.text());});
const decode=bytes=>decompressFrames(parseGIF(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)),true);
const ids=['spin','head','walk','slash','eat','sneak','squash','sit','death','revive','explode'];
const defaults={spin:1.5,head:1.5,walk:2,slash:1,eat:1.6,sneak:2,squash:1,sit:1,death:2,revive:2,explode:2};
const selected={spin:1.5,head:.5,walk:1,slash:.5,eat:1.6,sneak:1.5,squash:.5,sit:1,death:.5,revive:.5,explode:2};
const save=async download=>{const name=download.suggestedFilename();await download.saveAs(`artifacts/${name}`);return readFile(`artifacts/${name}`);};
const captureDownload=async(button)=>{const promise=page.waitForEvent('download',{timeout:180000});await button.click();return save(await promise);};
const pixels=[];
await mkdir('artifacts',{recursive:true});
try{
  await page.goto(pathToFileURL(resolve('SkinPop.html')).href);
  await page.waitForFunction(()=>!document.querySelector('#generate').disabled);
  assert.equal(await page.locator('.motion-card').count(),11);
  assert.equal(await page.locator('#motion-caption').count(),0);
  for(const id of ids){
    await page.locator(`[data-motion="${id}"]`).click();
    assert.equal(await page.locator('#duration').inputValue(),String(defaults[id]),`${id}: default`);
    assert.equal(await page.locator('#duration').isDisabled(),false);
  }
  for(const id of ids){
    await page.locator(`[data-motion="${id}"]`).click();
    await page.locator('#duration').selectOption(String(selected[id]));
  }
  await page.reload();await page.waitForFunction(()=>!document.querySelector('#generate').disabled);
  for(const id of ids){
    await page.locator(`[data-motion="${id}"]`).click();
    assert.equal(await page.locator('#duration').inputValue(),String(selected[id]),`${id}: persisted`);
  }
  const reopened=await context.newPage();await reopened.goto(page.url());
  await reopened.waitForFunction(()=>!document.querySelector('#generate').disabled);
  for(const id of ids){
    await reopened.locator(`[data-motion="${id}"]`).click();
    assert.equal(await reopened.locator('#duration').inputValue(),String(selected[id]),`${id}: reopened`);
  }
  await reopened.close();
  await page.locator('[data-motion="spin"]').click();
  await page.locator('#pause').click();await page.locator('#reset-view').click();
  await page.screenshot({path:'artifacts/offline-desktop.png',fullPage:true});
  // The same local file and PNG decoder must work without HTTP access.
  const skin=await page.evaluate(async()=>{
    const canvas=document.createElement('canvas');canvas.width=canvas.height=64;
    const c=canvas.getContext('2d');c.fillStyle='#b1cee6';c.fillRect(0,0,64,64);return canvas.toDataURL();
  });
  await page.locator('#skin-file').setInputFiles({name:'offline.png',mimeType:'image/png',buffer:Buffer.from(skin.split(',')[1],'base64')});
  await page.waitForFunction(()=>document.querySelector('#player-name').textContent==='offline');
  // Reload the example for visual tests, with all networking still disabled.
  await page.reload();await page.waitForFunction(()=>!document.querySelector('#generate').disabled);
  await page.locator('#resolution').selectOption('256');await page.locator('#fps').selectOption('25');
  await page.locator('[data-color="transparent"]').click();
  await page.locator('[data-motion="sit"]').click();
  const selection=await page.locator('.motion-card.active').getAttribute('data-motion');
  const zipData=await captureDownload(page.locator('#download-all'));
  const files=unzipSync(zipData);assert.equal(Object.keys(files).length,11);
  const deathFrames=decode(files[Object.keys(files).find(n=>n.endsWith('-death.gif'))]);
  const reviveFrames=decode(files[Object.keys(files).find(n=>n.endsWith('-revive.gif'))]);
  assert.equal(reviveFrames.length,deathFrames.length);
  reviveFrames.forEach((frame,i)=>{
    const original=deathFrames[deathFrames.length-1-i];
    assert.deepEqual(frame.patch,original.patch,`revive frame ${i}: exact death reversal`);
    assert.equal(frame.delay,original.delay,`revive frame ${i}: reversed delay`);
  });
  assert.equal(await page.locator('.motion-card.active').getAttribute('data-motion'),selection);
  assert.equal(await page.locator('#duration').inputValue(),String(selected.sit));
  assert.equal(await page.locator('#download-all').isDisabled(),false);
  for(const [index,id] of ids.entries()){
    const name=Object.keys(files).find(n=>n.endsWith(`-${id}.gif`));assert(name,`Missing ${id}`);
    const frames=decode(files[name]);
    assert.equal(frames.length,id==='sneak'?20:Math.round(25*selected[id]),`${id}: frame count`);
    assert.equal(frames.reduce((n,f)=>n+f.delay,0),selected[id]*1000,`${id}: duration`);
    let any=false;let union=[256,256,-1,-1];let empty=0;
    for(const frame of frames){
      assert.equal(frame.dims.width,256);assert.equal(frame.dims.height,256);assert.equal(frame.disposalType,2);assert.equal(frame.transparentIndex,0);
      let count=0;
      for(let y=0;y<256;y++)for(let x=0;x<256;x++)if(frame.patch[(y*256+x)*4+3]){
        assert(x>0&&x<255&&y>0&&y<255,`${id}: clipped frame`);any=true;count++;union=[Math.min(union[0],x),Math.min(union[1],y),Math.max(union[2],x),Math.max(union[3],y)];
      }
      if(!count)empty++;
    }
    assert(any,`${id} has no visible pixels`);
    if(!['death','revive','explode'].includes(id))assert.equal(empty,0,`${id}: unexpected blank frame`);
    assert(Math.max(union[2]-union[0],union[3]-union[1])>=230,`${id}: too much empty margin`);
    if(id==='sneak'){
      assert(frames.every(f=>f.delay===70||f.delay===80));
      frames.forEach((f,i)=>assert.deepEqual(f.patch,frames[i%2].patch));
      assert.notDeepEqual(frames[0].patch,frames[1].patch);
    }
    const picks=id==='death'?[0,2,5,8,11]:id==='explode'?[0,4,7,9,11]:[0,2,5,8,11];
    pixels.push(...picks.map(k=>({id,phase:k/13,pixels:Buffer.from(frames[Math.min(frames.length-1,k)].patch).toString('base64')})));
    await writeFile(`artifacts/offline-${id}.gif`,files[name]);
    console.log(`${id}: ${frames.length} frames, ${frames.reduce((n,f)=>n+f.delay,0)} ms, transparent, no clipping`);
  }
  // Cancel must not initiate a new download or corrupt the selected motion.
  let unexpectedDownloads=0;const onDownload=()=>unexpectedDownloads++;page.on('download',onDownload);
  await page.locator('#download-all').click();await page.locator('#cancel-export').click();
  await page.waitForFunction(()=>!document.querySelector('#download-all').disabled);
  await page.waitForTimeout(150);page.off('download',onDownload);assert.equal(unexpectedDownloads,0);
  assert.equal(await page.locator('.motion-card.active').getAttribute('data-motion'),selection);
  console.log('Batch cancel and state restoration passed.');
  await page.locator('[data-motion="sneak"]').click();assert.equal(await page.locator('#duration').isDisabled(),false);
  await page.locator('#duration').selectOption('0.5');
  await page.locator('#generate').click();await page.locator('#download').waitFor({state:'visible',timeout:60000});
  const fast=decode(await captureDownload(page.locator('#download')));assert.equal(fast.reduce((sum,f)=>sum+f.delay,0),500);
  assert.equal(fast.length,20);assert(fast.every(f=>f.delay>=20));
  fast.forEach((f,i)=>assert.deepEqual(f.patch,fast[i%2].patch));assert.notDeepEqual(fast[0].patch,fast[1].patch);
  console.log('Single rapid sneak passed.');
  await page.locator('[data-motion="revive"]').click();
  await page.locator('#generate').click();await page.locator('#download').waitFor({state:'visible',timeout:60000});
  const revived=decode(await captureDownload(page.locator('#download')));
  assert.equal(revived.length,reviveFrames.length);
  revived.forEach((frame,i)=>assert.deepEqual(frame.patch,reviveFrames[i].patch));
  console.log('Revival: exact reversed death pixels/delays in ZIP and matching single GIF.');
  await page.locator('[data-motion="eat"]').click();await page.locator('#fps').selectOption('20');
  assert.equal(await page.locator('#duration').inputValue(),'1.6');
  await page.locator('#generate').click();await page.locator('#download').waitFor({state:'visible',timeout:60000});
  const eating=decode(await captureDownload(page.locator('#download')));
  assert.equal(eating.length,32);assert.equal(eating.reduce((n,f)=>n+f.delay,0),1600);
  assert.notDeepEqual(eating[0].patch,eating[12].patch);
  console.log('Apple: 32 frames at 20 FPS, original 1.6-second duration, single GIF and ZIP.');
  // Transparent result to opaque result must not leave stale effects or tint.
  await page.locator('#live-tab').click();await page.locator('[data-motion="explode"]').click();await page.waitForTimeout(300);
  await page.locator('[data-motion="spin"]').click();await page.locator('[data-color="#e8f4ff"]').click();
  await page.locator('#generate').click();await page.locator('#download').waitFor({state:'visible',timeout:60000});
  const opaque=decode(await captureDownload(page.locator('#download')));assert.equal(opaque[0].transparentIndex,undefined);
  console.log('Opaque export after effect switch passed.');
  const png=await page.evaluate(samples=>{
    const sheet=document.createElement('canvas');sheet.width=5*256;sheet.height=11*280;const c=sheet.getContext('2d');
    c.fillStyle='#e8eef5';c.fillRect(0,0,sheet.width,sheet.height);
    const frame=document.createElement('canvas');frame.width=frame.height=256;const fc=frame.getContext('2d');
    samples.forEach((s,i)=>{const x=i%5*256,y=Math.floor(i/5)*280;fc.putImageData(new ImageData(Uint8ClampedArray.from(atob(s.pixels),c=>c.charCodeAt(0)),256,256),0,0);c.drawImage(frame,x,y);c.fillStyle='#345';c.font='13px sans-serif';c.fillText(`${s.id} ${(s.phase*100).toFixed(0)}%`,x+10,y+274);});return sheet.toDataURL();
  },pixels);
  await writeFile('artifacts/offline-eleven-motions.png',Buffer.from(png.split(',')[1],'base64'));
  await page.setViewportSize({width:390,height:844});await page.reload();await page.waitForFunction(()=>!document.querySelector('#generate').disabled);
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:'artifacts/offline-mobile.png',fullPage:true});
  assert.deepEqual(requests,[],'The local file should make no network requests before account lookup');assert.deepEqual(errors,[]);
  console.log('PASS: offline file://, per-motion defaults and persistence, PNG upload, ZIP with 11 independently timed GIFs, adjustable rapid sneak, cancellation, restored controls, mobile.');
} finally{await browser.close();}
