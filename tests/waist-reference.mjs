import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
 const page=await browser.newPage();await page.goto('http://127.0.0.1:5173');
 const result=await page.evaluate(async()=>{
  const {SkinViewer}=await import('/node_modules/.vite/deps/skinview3d.js');
  const {makeDemoSkin}=await import('/src/demo.js');
  const {createSword,applyPose}=await import('/src/motions.js');
  const {Vector3}=await import('/node_modules/.vite/deps/three.js');
  const viewer=new SkinViewer({width:128,height:128,skin:makeDemoSkin(),renderPaused:true});
  const sword=createSword();viewer.playerObject.skin.rightArm.add(sword);
  const checks=[],close=(a,b)=>checks.push(Math.abs(a-b)<1e-9);
  for(const model of ['default','slim']){
   viewer.playerObject.skin.modelType=model;
   for(const phase of [0,.125,.25,.5,.75,1]){
    applyPose(viewer,sword,'spin',0);const s=viewer.playerObject.skin;
    const base={body:s.body.position.y,leftY:s.leftArm.position.y,rightY:s.rightArm.position.y,leftX:s.leftLeg.position.x};
    applyPose(viewer,sword,'waist',phase);
    const t=phase*Math.PI*2,I=.15,bodyY=-1.5-Math.cos(t*2)*I;
    close(s.body.rotation.z,-Math.sin(t)*I);
    close(s.head.rotation.x,Math.cos(t*2-.5)*I*.1);close(s.head.rotation.z,-Math.sin(t-.5)*I*.5);
    close(s.leftArm.position.y-s.rightArm.position.y,Math.sin(t)*I*6);
    close(s.rightArm.rotation.x,.4-Math.PI/36+.1);
    const hip=s.leftLeg.position.clone().add(s.rightLeg.position).multiplyScalar(.5);
    const bottom=new Vector3(0,-6,0).applyQuaternion(s.body.quaternion).add(s.body.position);
    close(bottom.x,hip.x);close(bottom.z,hip.z);close(bottom.y,hip.y-.85);
    // Check actual soles in model coordinates rather than only copied formulas.
    for(const [leg,x] of [[s.leftLeg,1.9],[s.rightLeg,-1.9]]){
     leg.updateMatrix();const sole=new Vector3(0,-12,0).applyMatrix4(leg.matrix);
     close(sole.x,x);close(sole.y,-24);close(sole.z,-.1);
    }
   }
  }
  for(const phase of [0,.15,.3,.45,.599999]){
   applyPose(viewer,sword,'explode',phase);const p=viewer.playerObject;
   close(p.position.length(),0);close(p.scale.x,p.scale.y);close(p.scale.x,p.scale.z);
   close(p.scale.x,1+.2125*(phase/.6)**2);
  }
  const sheet=document.createElement('canvas');sheet.width=960;sheet.height=320;
  const ctx=sheet.getContext('2d');viewer.setSize(160,160);
  viewer.camera.position.set(60,0,0);viewer.camera.lookAt(0,0,0);
  for(let i=0;i<6;i++){
   applyPose(viewer,sword,'waist',i/6);viewer.render();ctx.drawImage(viewer.canvas,i*160,0);
   viewer.playerObject.skin.leftArm.visible=false;viewer.playerObject.skin.rightArm.visible=false;
   viewer.render();ctx.drawImage(viewer.canvas,i*160,160);
  }
  viewer.dispose();return {checks,sheet:sheet.toDataURL()};
 });
 assert(result.checks.every(Boolean));await writeFile('artifacts/waist-side-contact-sheet.png',Buffer.from(result.sheet.split(',')[1],'base64'));
 console.log(`PASS: ${result.checks.length} checks: connected pelvis, reference phases, both arm models, fixed sole positions, centred explosion and 75% reduced growth.`);
}finally{await browser.close();}
