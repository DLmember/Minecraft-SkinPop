import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdir, readFile } from 'node:fs/promises';

await mkdir('artifacts',{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1440,height:1100}});
const errors=[];
page.on('pageerror',error=>errors.push(error.message));
try {
  await page.goto(process.env.TEST_URL || 'http://127.0.0.1:5173');
  await page.waitForFunction(()=>!document.querySelector('#generate').disabled);
  await page.locator('#pause').click();
  await page.locator('#reset-view').click();
  await page.screenshot({path:'artifacts/desktop.png',fullPage:true});
  assert.equal(await page.locator('#stage-error').isVisible(),false);
  if(process.env.SCREENSHOT_ONLY) process.exitCode=0;
  else {
    await page.locator('#resolution').selectOption('256');
    await page.locator('#fps').selectOption('10');
    await page.locator('#duration').selectOption('2');
    for (const motion of ['spin','head','walk','slash','eat','sneak','squash','sit','death','revive','explode']) {
      await page.locator(`[data-motion="${motion}"]`).click();
    await page.locator('#duration').selectOption('2');
      await page.screenshot({path:`artifacts/${motion}-preview.png`});
      await page.locator('#generate').click();
      await page.locator('#download').waitFor({state:'visible',timeout:60000});
      const downloadPromise=page.waitForEvent('download');
      await page.locator('#download').click();
      const download=await downloadPromise;
      await download.saveAs(`artifacts/${motion}.gif`);
      const bytes=await readFile(`artifacts/${motion}.gif`);
      assert.equal(bytes.subarray(0,6).toString(),'GIF89a');
      assert.equal(bytes.readUInt16LE(6),256);assert.equal(bytes.readUInt16LE(8),256);
      // Parse GIF blocks to verify every exported frame and looping metadata.
      let offset=13+((bytes[10]&128)?3*2**((bytes[10]&7)+1):0),frames=0,totalDelay=0;
      while(offset<bytes.length) {
        const marker=bytes[offset++]; if(marker===0x3b)break;
        if(marker===0x21) { const label=bytes[offset++];if(label===0xf9)totalDelay+=bytes.readUInt16LE(offset+2); }
        else if(marker===0x2c) { frames++;const packed=bytes[offset+8];offset+=9;if(packed&128)offset+=3*2**((packed&7)+1);offset++; }
        else throw new Error(`Invalid GIF block: ${marker}`);
        while(bytes[offset]!==0)offset+=1+bytes[offset];offset++;
      }
      assert.equal(frames,20);assert.equal(totalDelay,200);assert(bytes.includes(Buffer.from('NETSCAPE2.0')));
      console.log(`${motion}: ${frames} frames, ${totalDelay*10} ms, ${bytes.length} bytes`);
      await page.locator('#live-tab').click();
    }
    await page.locator('#model').selectOption('slim');
    assert.match(await page.locator('#model-badge').innerText(),/ALEX/);
    await page.locator('label[for="outer-layer"]').click();
    assert.match(await page.locator('#model-badge').innerText(),/仅内层/);
    await page.locator('#generate').click();
    await page.locator('#cancel-export').click();
    await page.waitForFunction(()=>!document.querySelector('#generate').disabled);
    await page.locator('#username').fill('bad name');
    await page.locator('#lookup').click();
    assert.match(await page.locator('#account-status').innerText(),/请输入/);
    await page.setViewportSize({width:390,height:844});
    await page.reload();
    await page.waitForFunction(()=>!document.querySelector('#generate').disabled);
    await page.locator('#pause').click();
    await page.locator('#reset-view').click();
    await page.evaluate(()=>scrollTo(0,0));
    await page.screenshot({path:'artifacts/mobile.png',fullPage:true});
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    assert.deepEqual(errors,[]);
    console.log('Passed: eleven GIF downloads, frame timing, model/layer controls, cancel, input validation, mobile layout, no JS errors.');
  }
} finally { await browser.close(); }
