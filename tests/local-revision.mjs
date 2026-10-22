import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
 const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(pathToFileURL(resolve('SkinPop.html')).href);await page.waitForFunction(()=>!document.querySelector('#generate').disabled);
 assert.equal(await page.locator('.motion-card').count(),12);
 const order=await page.evaluate(()=>['.skin-settings','.motion-section','.preview-card','.export-settings'].map(s=>document.querySelector(s).getBoundingClientRect().top));
 assert(order.every((y,i)=>!i||y>order[i-1]));assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await page.screenshot({path:'artifacts/revision-mobile.png',fullPage:true});
 await page.locator('[data-motion="waist"]').click();await page.locator('#resolution').selectOption('256');await page.locator('#duration').selectOption('0.5');
 await page.locator('#generate').click();assert.equal(await page.locator('#generate').getAttribute('aria-busy'),'true');assert.equal(await page.locator('#export-progress').isVisible(),false);
 await page.waitForFunction(()=>document.querySelector('#generate').textContent.includes('下载 GIF'));
 const download=page.waitForEvent('download');await page.locator('#generate').click();await(await download).saveAs('artifacts/waist-review.gif');
 await page.locator('#duration').selectOption('1');assert.match(await page.locator('#generate').innerText(),/生成 GIF/);
 await page.locator('#generate').click();await page.locator('#cancel-export').click();await page.waitForFunction(()=>!document.querySelector('#generate').disabled);assert.match(await page.locator('#generate').innerText(),/生成 GIF/);
 await page.setViewportSize({width:1440,height:1100});assert.equal(await page.locator('.studio .preview-card').count(),1);assert.equal(await page.locator('.studio .motion-section').count(),1);
 await page.locator('[data-motion="eat"]').click();await page.waitForTimeout(500);await page.locator('#pause').click();await page.locator('#stage').screenshot({path:'artifacts/revision-eating.png'});
 assert.deepEqual(errors,[]);console.log('PASS: mobile order, 12 motions, button progress/download/reset/cancel, real waist GIF, desktop resize, no JS errors.');
}finally{await browser.close();}
