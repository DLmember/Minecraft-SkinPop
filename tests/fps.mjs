import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {readFile,mkdir} from 'node:fs/promises';
import {parseGIF,decompressFrames} from 'gifuct-js';

const url=process.env.TEST_URL||pathToFileURL(resolve('SkinPop.html')).href;
const key='skinpop.fps.v1';
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
  const page=await browser.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  const ready=()=>page.waitForFunction(()=>!document.querySelector('#generate').disabled);
  await page.goto(url);await ready();
  assert.equal(await page.locator('#fps').inputValue(),'30');
  assert.deepEqual(await page.locator('#fps option').evaluateAll(items=>items.map(x=>x.value)),['10','20','25','30','60']);
  for(const fps of ['10','20','25','30','60']){
    await page.locator('#fps').selectOption(fps);
    assert.equal(await page.evaluate(k=>localStorage.getItem(k),key),fps);
    await page.reload();await ready();assert.equal(await page.locator('#fps').inputValue(),fps);
  }
  await page.locator('[data-motion="waist"]').click();assert.equal(await page.locator('#fps').inputValue(),'60');
  await page.locator('[data-motion="sneak"]').click();assert(await page.locator('#fps').isDisabled());
  await page.locator('[data-motion="spin"]').click();assert.equal(await page.locator('#fps').inputValue(),'60');
  await page.locator('#resolution').selectOption('256');await page.locator('#duration').selectOption('1');
  await mkdir('artifacts',{recursive:true});
  for(const fps of [30,60]){
    await page.locator('#fps').selectOption(String(fps));
    assert((await page.locator('#generate').innerText()).includes('生成 GIF'));
    await page.locator('#generate').click();
    await page.waitForFunction(()=>document.querySelector('#generate').textContent.includes('下载 GIF'),{},{timeout:90000});
    const pending=page.waitForEvent('download');await page.locator('#generate').click();
    const path=`artifacts/fps-${fps}.gif`;await(await pending).saveAs(path);
    const bytes=await readFile(path),gif=parseGIF(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength));
    const frames=decompressFrames(gif,true);
    assert.equal(gif.lsd.width,256);assert.equal(frames.length,Math.min(fps,50));
    assert.equal(frames.reduce((s,f)=>s+f.delay,0),1000);
    assert(frames.every(f=>f.delay>=20));
    if(fps===60)assert(frames.every(f=>f.delay===20),'60 FPS compatibility mode must have uniform 20 ms frames');
  }
  for(const invalid of ['broken','0','999','null','"60"']){
    await page.evaluate(({key,invalid})=>localStorage.setItem(key,invalid),{key,invalid});
    await page.reload();await ready();assert.equal(await page.locator('#fps').inputValue(),'30');
  }
  // A denied Storage API must not prevent the renderer or selector from working.
  const denied=await browser.newPage();
  await denied.addInitScript(()=>{
    Storage.prototype.getItem=()=>{throw new DOMException('Denied','SecurityError');};
    Storage.prototype.setItem=()=>{throw new DOMException('Denied','SecurityError');};
  });
  await denied.goto(url);await denied.waitForFunction(()=>!document.querySelector('#generate').disabled);
  assert.equal(await denied.locator('#fps').inputValue(),'30');
  await denied.locator('#fps').selectOption('60');assert.equal(await denied.locator('#fps').inputValue(),'60');
  assert(await denied.locator('#toast').isVisible());await denied.close();
  assert.deepEqual(errors,[]);
  console.log('PASS: default/persistence; 30/60 options encode 30/50 frames in 1 second without browser-clamped short delays; invalid/denied storage handled.');
}finally{await browser.close();}
