import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try {
 const page=await browser.newPage();await page.goto('http://127.0.0.1:5173');
 const png=Buffer.from(await page.evaluate(async()=>{const {makeDemoSkin}=await import('/src/demo.js');return makeDemoSkin().toDataURL().split(',')[1];}),'base64');
 let mode='direct';
 await page.route('https://**/*',async route=>{
  const u=route.request().url();
  if(u.includes('needcoolershoes.com')){
   if(mode==='direct')return route.fulfill({contentType:'image/png',headers:{'access-control-expose-headers':'x-needcoolershoes-uuid,x-needcoolershoes-model','x-needcoolershoes-uuid':'069a79f444e94726a5befca90e38aaf5','x-needcoolershoes-model':'slim'},body:png});
   return route.fulfill({status:404,body:''});
  }
  if(u.includes('api.mojang.com'))return route.fulfill({json:{id:'test',name:'Test'}});
  if(u.includes('sessionserver'))return route.fulfill({json:{properties:[{name:'textures',value:Buffer.from(JSON.stringify({textures:{SKIN:{url:'https://textures.minecraft.net/broken',metadata:{model:'slim'}}}})).toString('base64')}]}});
  if(u.includes('textures.minecraft.net'))return route.fulfill({contentType:'image/png',body:Buffer.from('bad PNG')});
  if(u.includes('ashcon'))return route.fulfill({json:{username:'Test',uuid:'test',textures:{slim:false,skin:{data:png.toString('base64')}}}});
  return route.abort();
 });
 const query=()=>page.evaluate(async()=>{const {lookupAccount}=await import('/src/api.js');const start=performance.now();const a=await lookupAccount('Test');return {source:a.source,model:a.model,width:a.image.naturalWidth,ms:performance.now()-start};});
 const direct=await query();assert.equal(direct.source,'NeedCoolerShoes');assert.equal(direct.model,'slim');assert.equal(direct.width,64);
 mode='fallback';const fallback=await query();assert.equal(fallback.source,'Ashcon 兼容查询');assert.equal(fallback.model,'default');assert.equal(fallback.width,64);assert(fallback.ms<4000);
 console.log('PASS: direct PNG and slim metadata; one-provider 404 and corrupt official PNG still fall back; no long serial timeout.');
 await page.unrouteAll();
 const live=await page.evaluate(async()=>{const {lookupAccount}=await import('/src/api.js');const start=performance.now();const a=await lookupAccount('Notch');return {source:a.source,model:a.model,width:a.image.naturalWidth,ms:Math.round(performance.now()-start)};});
 console.log('Live query:',live);
} finally{await browser.close();}
