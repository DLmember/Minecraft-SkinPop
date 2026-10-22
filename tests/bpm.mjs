import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {readFile} from 'node:fs/promises';
import {parseGIF,decompressFrames} from 'gifuct-js';
const browser=await chromium.launch({channel:'chrome',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
 const page=await browser.newPage();await page.goto(pathToFileURL(resolve('SkinPop.html')).href);
 await page.waitForFunction(()=>!document.querySelector('#generate').disabled);
 for(const [motion,bpm,ms] of [['waist',60,2000],['squash',180,670]]){
  await page.locator(`[data-motion="${motion}"]`).click();assert(await page.locator('#bpm').isVisible());assert(!(await page.locator('#duration').isVisible()));
  await page.locator('#bpm').fill(String(bpm));await page.locator('#bpm').press('Tab');
  await page.locator('#resolution').selectOption('256');await page.locator('#generate').click();
  await page.waitForFunction(()=>document.querySelector('#generate').textContent.includes('下载 GIF'));
  const event=page.waitForEvent('download');await page.locator('#generate').click();const d=await event;
  const frames=decompressFrames(parseGIF(await readFile(await d.path())));assert.equal(frames.reduce((s,f)=>s+f.delay,0),ms);
 }
 await page.reload();await page.waitForFunction(()=>!document.querySelector('#generate').disabled);
 for(const [motion,value] of [['waist','60'],['squash','180']]){await page.locator(`[data-motion="${motion}"]`).click();assert.equal(await page.locator('#bpm').inputValue(),value);}
 await page.locator('#bpm').fill('0');await page.locator('#bpm').press('Tab');assert.equal(await page.locator('#bpm').inputValue(),'180');
 for(const value of ['0.1','12.5','87.5','500.5']){
  await page.locator('#bpm').fill(value);await page.locator('#bpm').press('Tab');
  await page.reload();await page.waitForFunction(()=>!document.querySelector('#generate').disabled);
  await page.locator('[data-motion="squash"]').click();assert.equal(await page.locator('#bpm').inputValue(),value);
 }
 await page.locator('[data-motion="walk"]').click();assert(await page.locator('#duration').isVisible());assert.equal(await page.locator('#duration').inputValue(),'2');
 console.log('PASS: BPM visibility, independent persistence, invalid input, real GIF timing at 60/180 BPM, other motions unchanged.');
}finally{await browser.close();}
