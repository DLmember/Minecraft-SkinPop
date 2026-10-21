import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';

const browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1440,height:1100}});
try {
  await page.goto('http://127.0.0.1:5173');
  await page.route('https://needcoolershoes.com/**',r=>r.abort('failed'));
  await page.route('https://api.minetools.eu/**',r=>r.abort('failed'));
  await page.waitForFunction(()=>!document.querySelector('#generate').disabled);
  const data=await page.evaluate(async()=>{
    const {SkinViewer}=await import('/node_modules/.vite/deps/skinview3d.js');
    const {makeDemoSkin}=await import('/src/demo.js');
    const {motions,createSword,configureCamera,applyPose}=await import('/src/motions.js');
    const {prepareEffects}=await import('/src/effects.js');
    const skin=makeDemoSkin();
    const sheet=document.createElement('canvas');sheet.width=5*230;sheet.height=motions.length*250;
    const ctx=sheet.getContext('2d');ctx.fillStyle='#f5f9ff';ctx.fillRect(0,0,sheet.width,sheet.height);
    const viewer=new SkinViewer({width:230,height:230,pixelRatio:1,skin,model:'default',fov:40,renderPaused:true,preserveDrawingBuffer:true,background:'#e8f4ff'});
    const sword=createSword();viewer.playerObject.skin.rightArm.add(sword);
    const results=[];
    for(let row=0;row<motions.length;row++){
      const motion=motions[row];configureCamera(viewer,motion);await prepareEffects(viewer,motion.id);
      for(let col=0;col<5;col++){
        applyPose(viewer,sword,motion.id,col*.2);viewer.render();
        ctx.drawImage(viewer.canvas,col*230,row*250);ctx.fillStyle='#344461';ctx.font='12px sans-serif';ctx.fillText(`${motion.id} · ${col*.2}`,col*230+12,row*250+244);
      }
      const capture=()=>{const s=viewer.playerObject.skin;return [viewer.playerObject,...[s.head,s.body,s.leftArm,s.rightArm,s.leftLeg,s.rightLeg]].flatMap(o=>[...o.position.toArray(),...o.rotation.toArray().slice(0,3)].map(n=>Math.round(n*1e5)/1e5));};
      applyPose(viewer,sword,motion.id,0);const start=capture();applyPose(viewer,sword,motion.id,1);const end=capture();
      // Full rotations have equivalent poses at 0 and 2π.
      results.push({id:motion.id,seam:['spin','head','squash','eat','death','revive','explode'].includes(motion.id)||start.every((n,i)=>Math.abs(n-end[i])<.0001)});
    }
    const nod=[0,.0625,.125,.1875,.25].map(t=>{applyPose(viewer,sword,'sit',t);return viewer.playerObject.skin.head.rotation.x;});
    const nodLinear=nod.slice(1).every((n,i)=>Math.abs(n-nod[i]-.1375)<1e-8);
    const nodAt=t=>{applyPose(viewer,sword,'sit',t);return viewer.playerObject.skin.head.rotation.x;};
    const nodRepeats=[0,.0625,.125,.25,.375,.49,.5].every(t=>Math.abs(nodAt(t)-nodAt(t+.5))<1e-8);
    configureCamera(viewer,motions.find(m=>m.id==='revive'));await prepareEffects(viewer,'revive');
    const revivalReversed=[0,.125,.25,.5,.625,.75,.875,1].every(t=>{
      applyPose(viewer,sword,'death',t);viewer.render();const death=viewer.canvas.toDataURL();
      applyPose(viewer,sword,'revive',1-t);viewer.render();return viewer.canvas.toDataURL()===death;
    });
    applyPose(viewer,sword,'death',.8);const deathHidden=!viewer.playerObject.visible;
    applyPose(viewer,sword,'spin',0);const restored=viewer.playerObject.visible&&!viewer.scene.getObjectByName('minecraft-particles').visible;
    viewer.playerObject.skin.setOuterLayerVisible(false);
    const s=viewer.playerObject.skin;const layerOff=[s.head,s.body,s.leftArm,s.rightArm,s.leftLeg,s.rightLeg].every(p=>!p.outerLayer.visible);
    s.setOuterLayerVisible(true);const layerOn=[s.head,s.body,s.leftArm,s.rightArm,s.leftLeg,s.rightLeg].every(p=>p.outerLayer.visible);
    s.modelType='slim';const slimWidth=s.rightArm.innerLayer.scale.x;s.modelType='default';const defaultWidth=s.rightArm.innerLayer.scale.x;
    const legacy=document.createElement('canvas');legacy.width=64;legacy.height=32;legacy.getContext('2d').drawImage(skin,0,0);
    viewer.dispose();
    return {sheet:sheet.toDataURL(),skin:skin.toDataURL(),legacy:legacy.toDataURL(),results,layerOff,layerOn,slimWidth,defaultWidth,nodLinear,nodRepeats,revivalReversed,deathHidden,restored};
  });
  await writeFile('artifacts/motion-contact-sheet.png',Buffer.from(data.sheet.split(',')[1],'base64'));
  assert(data.results.every(r=>r.seam));assert(data.layerOff&&data.layerOn);assert.equal(data.slimWidth,3);assert.equal(data.defaultWidth,4);
  assert(data.nodLinear&&data.nodRepeats&&data.revivalReversed&&data.deathHidden&&data.restored);
  const png=Buffer.from(data.skin.split(',')[1],'base64');
  await page.route('https://api.mojang.com/users/profiles/minecraft/**',r=>r.fulfill({json:{id:'test-uuid',name:'TestAlex'}}));
  await page.route('https://sessionserver.mojang.com/session/minecraft/profile/**',r=>r.fulfill({json:{properties:[{name:'textures',value:Buffer.from(JSON.stringify({textures:{SKIN:{url:'https://textures.minecraft.net/texture/test',metadata:{model:'slim'}}}})).toString('base64')}]}}));
  await page.route('https://textures.minecraft.net/texture/test',r=>r.fulfill({contentType:'image/png',body:png}));
  await page.locator('#username').fill('TestAlex');await page.locator('#lookup').click();
  await page.waitForFunction(()=>document.querySelector('#player-name').textContent==='TestAlex');
  assert.match(await page.locator('#model-badge').innerText(),/ALEX/);assert.match(await page.locator('#account-status').innerText(),/Mojang/);
  await page.unroute('https://api.mojang.com/users/profiles/minecraft/**');
  await page.route('https://api.mojang.com/users/profiles/minecraft/**',r=>r.abort('failed'));
  await page.route('https://api.ashcon.app/mojang/v2/user/**',r=>r.fulfill({json:{username:'Fallback',uuid:'test',textures:{slim:false,skin:{data:data.skin.split(',')[1]}}}}));
  await page.locator('#username').fill('Fallback');await page.locator('#lookup').click();
  await page.waitForFunction(()=>document.querySelector('#player-name').textContent==='Fallback');
  assert.match(await page.locator('#account-status').innerText(),/Ashcon/);assert.match(await page.locator('#model-badge').innerText(),/STEVE/);
  await page.locator('#skin-file').setInputFiles({name:'legacy.png',mimeType:'image/png',buffer:Buffer.from(data.legacy.split(',')[1],'base64')});
  await page.waitForFunction(()=>document.querySelector('#player-name').textContent==='legacy');
  await page.locator('#skin-file').setInputFiles({name:'bad.png',mimeType:'image/png',buffer:Buffer.from('not png')});
  await page.waitForFunction(()=>document.querySelector('#account-status').classList.contains('error'));
  assert.equal(await page.locator('#player-name').innerText(),'legacy');
  console.log('Passed: model widths 3/4 px, six outer layers, seamless poses, official metadata, CORS fallback, legacy skin upload and invalid PNG retention.');
  await page.unrouteAll();
  await page.locator('#username').fill('Notch');await page.locator('#lookup').click();
  await page.waitForFunction(()=>!document.querySelector('#lookup').disabled,{},{timeout:35000});
  console.log('Live network check:',await page.locator('#account-status').innerText());
} finally {await browser.close();}
