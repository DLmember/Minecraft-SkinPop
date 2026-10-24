import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try {
 const page=await browser.newPage();
 await page.goto(process.env.TEST_URL||'http://127.0.0.1:5173');
 const result=await page.evaluate(async()=>{
  const {SkinViewer}=await import('/node_modules/.vite/deps/skinview3d.js');
  const {Vector3}=await import('/node_modules/.vite/deps/three.js');
  const {makeDemoSkin}=await import('/src/demo.js');
  const {applyPose,createSword,motions,configureCamera}=await import('/src/motions.js');
  const {fitExportCamera}=await import('/src/framing.js');
  const v=new SkinViewer({width:220,height:240,renderPaused:true,preserveDrawingBuffer:true,enableControls:false,skin:makeDemoSkin(),model:'default',background:'#e8f4ff'});
  const sword=createSword();v.playerObject.skin.rightArm.add(sword);
  const s=v.playerObject.skin,keys=['head','body','leftArm','rightArm','leftLeg','rightLeg'];
  let count=0,maxError=0;const failures=[];
  const check=(ok,label)=>{count++;if(!ok&&failures.length<15)failures.push(label);};
  // Independent scalar point transform oracle from render.rs BoxPart chains.
  // Checks actual mesh vertices (both layers), not the new implementation's helpers.
  const rx=([x,y,z],a)=>[x,y*Math.cos(a)-z*Math.sin(a),y*Math.sin(a)+z*Math.cos(a)];
  const rz=([x,y,z],a)=>[x*Math.cos(a)-y*Math.sin(a),x*Math.sin(a)+y*Math.cos(a),z];
  const add=(p,q)=>p.map((x,i)=>x+q[i]);
  const origin=-24-(9.9-12*Math.cos(.1));
  function expected(key,p,t,width){
   const roll=-Math.sin(t)*.15,bob=Math.cos(2*t)*.15,slide=-Math.sin(t)*.45;
   const side=key.startsWith('left')?1:-1;
   if(key==='body')p=add(rz(add(p,[0,-6,0]),roll),[0,12,0]);
   else if(key==='head')p=add(rx(rz(rx(add(p,[0,4,0]),Math.cos(2*t-.5)*.015),-Math.sin(t-.5)*.075),-.25),[0,12,0]);
   else if(key.endsWith('Arm'))p=add(rz(rx(rz(add(p,[0,-4,0]),side*.105),-.035),-Math.sin(t-.25)*.15),[side*(4+width/2)+slide,10+side*slide,0]);
   else p=add(rz(rx(add(p,[0,-6,0]),-.24),Math.sin(t)*.15),[side*2-Math.sin(t)*1.8,0,0]);
   return add(rx(p,.34),[0,origin+9.9+(key.endsWith('Leg')?0:bob),-1.1]);
  }
  const snapshot=()=>keys.flatMap(k=>[s[k].position.toArray(),s[k].quaternion.toArray(),s[k].scale.toArray()].flat());
  const sheet=document.createElement('canvas');sheet.width=1100;sheet.height=1060;
  const ctx=sheet.getContext('2d');ctx.fillStyle='#f4f8ff';ctx.fillRect(0,0,sheet.width,sheet.height);
  for(const [mi,model] of ['default','slim'].entries()){
   s.modelType=model;const width=model==='slim'?3:4;
   for(let step=0;step<=64;step++){
    const phase=step/64,t=phase*Math.PI*2;applyPose(v,sword,'waist',phase);v.scene.updateMatrixWorld(true);
    const inverse=s.matrixWorld.clone().invert();
    for(const key of keys){
     const part=s[key];check(part.parent===s,model+' native hierarchy '+key);
     for(const mesh of [part.innerLayer,part.outerLayer]){
      const pos=mesh.geometry.attributes.position;
      for(let i=0;i<pos.count;i++){
       const raw=new Vector3().fromBufferAttribute(pos,i);
       const actual=raw.clone().applyMatrix4(mesh.matrixWorld).applyMatrix4(inverse);
       const target=expected(key,raw.multiply(mesh.scale).toArray(),t,width);
       const error=actual.distanceTo(new Vector3(...target));maxError=Math.max(maxError,error);
       check(error<1e-8,model+' '+key+' vertex '+step+' error '+error);
      }
     }
    }
    for(const key of ['leftArm','rightArm']){
     const mesh=s[key].innerLayer,up=new Vector3(0,.5,0).applyMatrix4(mesh.matrixWorld),down=new Vector3(0,-.5,0).applyMatrix4(mesh.matrixWorld);
     check(up.y>down.y,model+' upright sleeves '+key);
    }
   }
   applyPose(v,sword,'waist',0);const start=snapshot();applyPose(v,sword,'waist',1);
   check(snapshot().every((x,i)=>Math.abs(x-start[i])<1e-8),'closed loop '+model);
   // Regression: both legs must move through opposite extrema. Checking actual
   // mesh transforms catches accidentally pinning the feet or deleting a channel.
   for(const key of ['leftLeg','rightLeg']){
    const sample=phase=>{
     applyPose(v,sword,'waist',phase);v.scene.updateMatrixWorld(true);
     const mesh=s[key].innerLayer;
     return {center:mesh.getWorldPosition(new Vector3()),up:new Vector3(0,1,0).transformDirection(mesh.matrixWorld)};
    };
    const a=sample(.25),b=sample(.75);
    check(a.center.distanceTo(b.center)>1.8,'animated leg translation '+model+' '+key);
    check(a.up.distanceTo(b.up)>.29,'animated leg roll '+model+' '+key);
   }
   for(const motion of motions){
    applyPose(v,sword,motion.id,.2);const direct=snapshot();
    applyPose(v,sword,'waist',.3);applyPose(v,sword,motion.id,.2);
    check(snapshot().every((x,i)=>Math.abs(x-direct[i])<1e-8),'motion transition '+motion.id);
   }
   s.setOuterLayerVisible(false);check(keys.every(k=>!s[k].outerLayer.visible),'outer off');s.setOuterLayerVisible(true);
   check(keys.every(k=>s[k].outerLayer.visible),'outer on');
   for(let view=0;view<2;view++){
    configureCamera(v,{camera:view?[65,0,0]:[28,0,62],target:[0,0,0]});fitExportCamera(v,sword,'waist',64);
    for(let col=0;col<5;col++){
     applyPose(v,sword,'waist',col/5);v.render();const x=col*220,y=(mi*2+view)*265;
     ctx.drawImage(v.canvas,x,y);ctx.fillStyle='#284260';ctx.font='13px sans-serif';ctx.fillText(model+' / '+(view?'side':'front')+' / '+(col/5),x+10,y+255);
    }
   }
  }
  v.dispose();return {count,maxError,failures,sheet:sheet.toDataURL()};
 });
 await mkdir('artifacts',{recursive:true});await writeFile('artifacts/waist-rebuilt-contact-sheet.png',Buffer.from(result.sheet.split(',')[1],'base64'));
 assert.deepEqual(result.failures,[]);console.log(`PASS: ${result.count} checks; mesh vertex max error ${result.maxError}; both arm models, both layers, native hierarchy, cycle seam and all action transitions.`);
}finally{await browser.close();}
