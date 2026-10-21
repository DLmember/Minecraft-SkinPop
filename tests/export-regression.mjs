import { chromium } from '@playwright/test';
import { parseGIF, decompressFrames } from 'gifuct-js';
import assert from 'node:assert/strict';
import { mkdir,readFile,writeFile } from 'node:fs/promises';

await mkdir('artifacts',{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1440,height:1100}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
page.on('console',m=>{if(m.type()==='error')console.log('Browser error:',m.text());});
const motions=['spin','head','walk','slash','eat','sneak','squash','sit','death','revive','explode'];
const samples=[];
try {
  await page.goto(process.env.TEST_URL || 'http://127.0.0.1:5173');
  await page.waitForFunction(()=>!document.querySelector('#generate').disabled);
  await page.locator('#pause').click();await page.locator('#reset-view').click();
  await page.screenshot({path:'artifacts/updated-desktop.png',fullPage:true});
  await page.locator('[data-color="transparent"]').click();
  assert(await page.locator('#stage').evaluate(el=>el.classList.contains('transparent-stage')));
  await page.locator('#resolution').selectOption('256');
  await page.locator('#duration').selectOption('1');await page.locator('#fps').selectOption('20');
  for(const motion of motions){
    await page.locator(`[data-motion="${motion}"]`).click();
    await page.locator('#duration').selectOption('1');
    await page.locator('#generate').click();
    await page.locator('#download').waitFor({state:'visible',timeout:60000});
    const pending=page.waitForEvent('download');await page.locator('#download').click();
    const download=await pending;const path=`artifacts/${motion}-transparent.gif`;await download.saveAs(path);
    const data=await readFile(path), gif=parseGIF(data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength)),frames=decompressFrames(gif,true);
    assert.equal(gif.lsd.width,256);assert.equal(gif.lsd.height,256);
    assert.equal(frames.length,20);assert.equal(frames.reduce((sum,f)=>sum+f.delay,0),1000);
    const bounds=[];
    for(const frame of frames){
      assert.equal(frame.disposalType,2);assert.notEqual(frame.transparentIndex,undefined);
      let minX=256,minY=256,maxX=-1,maxY=-1;
      for(let y=0;y<256;y++)for(let x=0;x<256;x++)if(frame.patch[(y*256+x)*4+3]){minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);}
      if(maxX<minX&&['death','revive','explode'].includes(motion))continue;
      assert(maxX>minX&&maxY>minY,`${motion}: empty frame`);
      assert(minX>0&&minY>0&&maxX<255&&maxY<255,`${motion}: clipped frame`);
      bounds.push({minX,minY,maxX,maxY,height:maxY-minY+1});
    }
    const unionWidth=Math.max(...bounds.map(b=>b.maxX))-Math.min(...bounds.map(b=>b.minX))+1;
    const unionHeight=Math.max(...bounds.map(b=>b.maxY))-Math.min(...bounds.map(b=>b.minY))+1;
    assert(Math.max(unionWidth,unionHeight)>230,`${motion}: subject too small (${unionWidth}×${unionHeight})`);
    if(motion==='squash'){
      const heights=bounds.map(b=>b.height),ratio=Math.min(...heights)/Math.max(...heights);
      assert(ratio>.38&&ratio<.43,`Height range incorrect: ${ratio}`);
      // The feet stay on the world ground plane; perspective changes the projected
      // silhouette slightly as the near edge of each shoe rotates toward the camera.
      assert(Math.max(...bounds.map(b=>b.maxY))-Math.min(...bounds.map(b=>b.maxY))<=12,'Foot movement exceeds perspective allowance');
    }
    if(motion==='sneak')assert.notDeepEqual(frames[0].patch,frames[1].patch);
    console.log(`${motion}: ${frames.length} frames / 1 second, transparent, bounds ${unionWidth}×${unionHeight}, no clipping`);
    samples.push(...[0,.25,.5,.75].map(t=>({motion,t,pixels:Array.from(frames[Math.floor(t*frames.length)].patch)})));
    await page.locator('#live-tab').click();
  }
  await page.locator('[data-color="#e8f4ff"]').click();
  assert.equal(await page.locator('#stage').evaluate(el=>el.classList.contains('transparent-stage')),false);
  await page.locator('[data-motion="spin"]').click();await page.locator('#generate').click();
  await page.locator('#download').waitFor({state:'visible',timeout:60000});
  const solid=await page.evaluate(async()=>Array.from(new Uint8Array(await(await fetch(document.querySelector('#download').href)).arrayBuffer())));
  const solidFrames=decompressFrames(parseGIF(Uint8Array.from(solid).buffer),true);
  assert.equal(solidFrames[0].transparentIndex,undefined);assert.equal(solidFrames[0].patch[3],255);
  const png=await page.evaluate(samples=>{
    const canvas=document.createElement('canvas');canvas.width=4*256;canvas.height=11*280;
    const ctx=canvas.getContext('2d');ctx.fillStyle='#f1f6fc';ctx.fillRect(0,0,canvas.width,canvas.height);
    const frame=document.createElement('canvas');frame.width=frame.height=256;const fc=frame.getContext('2d');
    samples.forEach((s,i)=>{const x=i%4*256,y=Math.floor(i/4)*280;fc.putImageData(new ImageData(Uint8ClampedArray.from(s.pixels),256,256),0,0);ctx.drawImage(frame,x,y);ctx.fillStyle='#345';ctx.font='12px sans-serif';ctx.fillText(`${s.motion} · ${s.t}`,x+8,y+274);});
    return canvas.toDataURL();
  },samples);
  await writeFile('artifacts/updated-motion-exports.png',Buffer.from(png.split(',')[1],'base64'));
  await page.setViewportSize({width:390,height:844});await page.reload();await page.waitForFunction(()=>!document.querySelector('#generate').disabled);
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.screenshot({path:'artifacts/updated-mobile.png',fullPage:true});
  assert.deepEqual(errors,[]);
  console.log('Passed: transparent and opaque GIFs, eleven motions, timing, rapid sneak, 40% squash, cycle framing, mobile overflow.');
} finally {await browser.close();}
