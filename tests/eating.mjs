import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {writeFile,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try {
  const page=await browser.newPage();
  await page.goto('http://127.0.0.1:5173');
  await page.waitForFunction(()=>!document.querySelector('#generate').disabled);
  assert.equal(await page.locator('#motion-caption').count(),0);
  await page.locator('[data-motion="eat"]').click();
  assert.equal(await page.locator('#duration').inputValue(),'1.6');
  const data=await page.evaluate(async()=>{
    const {SkinViewer}=await import('/node_modules/.vite/deps/skinview3d.js');
    const {makeDemoSkin}=await import('/src/demo.js');
    const {motions,createSword,configureCamera,applyPose}=await import('/src/motions.js');
    const {APPLE_CONSUME_TICKS,APPLE_CONSUME_SECONDS}=await import('/src/eating.js');
    const pixels=(await import('/src/assets/apple.json')).default;
    const viewer=new SkinViewer({width:256,height:256,pixelRatio:1,skin:makeDemoSkin(),model:'default',fov:40,renderPaused:true,preserveDrawingBuffer:true,background:'#e8f4ff'});
    const sword=createSword();viewer.playerObject.skin.rightArm.add(sword);
    configureCamera(viewer,motions.find(m=>m.id==='eat'));
    const sheet=document.createElement('canvas');sheet.width=256*7;sheet.height=280*2;const ctx=sheet.getContext('2d');
    const checks=[];
    for(const [row,model] of ['default','slim'].entries()){
      viewer.playerObject.skin.modelType=model;
      for(const [column,t] of [0,.125,.28125,.34375,.5625,.8125,31/32].entries()){
        applyPose(viewer,sword,'eat',t);viewer.render();
        ctx.drawImage(viewer.canvas,column*256,row*280);ctx.fillStyle='#456';ctx.font='14px sans-serif';ctx.fillText(`${model} ${(t*1.6).toFixed(2)} s`,column*256+8,row*280+272);
      }
      const apple=viewer.scene.getObjectByName('minecraft-apple'),crumbs=viewer.scene.getObjectByName('apple-crumbs');
      checks.push(!apple.visible&&crumbs.visible);
      checks.push(apple.children.length===pixels.length&&apple.children.every((mesh,i)=>'#'+mesh.material.color.getHexString()===pixels[i][2]));
      applyPose(viewer,sword,'eat',.125);checks.push(apple.visible&&!crumbs.visible&&!sword.visible);
      applyPose(viewer,sword,'eat',.5);checks.push(crumbs.visible&&crumbs.children.filter(p=>p.visible).length===5);
      applyPose(viewer,sword,'spin',.5);checks.push(!apple.visible&&!crumbs.visible&&!sword.visible);
      applyPose(viewer,sword,'slash',.5);checks.push(!apple.visible&&!crumbs.visible&&sword.visible);
    }
    const image=new Image();image.src='/src/assets/apple.png';await image.decode();
    const canvas=document.createElement('canvas');canvas.width=canvas.height=16;const c=canvas.getContext('2d');c.drawImage(image,0,0);
    const rgba=c.getImageData(0,0,16,16).data;
    checks.push(pixels.every(([x,y,hex])=>hex==='#'+[...rgba.slice((y*16+x)*4,(y*16+x)*4+3)].map(n=>n.toString(16).padStart(2,'0')).join('')));
    viewer.dispose();
    return {checks,ticks:APPLE_CONSUME_TICKS,seconds:APPLE_CONSUME_SECONDS,sheet:sheet.toDataURL()};
  });
  assert(data.checks.every(Boolean));assert.equal(data.ticks,32);assert.equal(data.seconds,1.6);
  await writeFile('artifacts/eating-contact-sheet.png',Buffer.from(data.sheet.split(',')[1],'base64'));
  const provenance=JSON.parse(await readFile('src/assets/apple-provenance.json','utf8'));
  assert.equal(createHash('sha256').update(await readFile('src/assets/apple.png')).digest('hex'),provenance.sha256);
  console.log('PASS: original apple texels/hash, 32 ticks / 1.6 s, both arm models, fragments, item visibility reset, no preview caption.');
} finally {await browser.close();}
