import { SkinViewer } from 'skinview3d';
import { GIFEncoder, quantize, applyPalette } from 'gifenc';
import { createSword, applyPose } from './motions.js';
import { fitExportCamera, refineExportFraming } from './framing.js';
import { prepareEffects } from './effects.js';
import { motionTiming } from './timing.js';

export async function exportGif({ skin, model, outer, motion, background, size, fps, duration, camera, signal, onProgress }) {
  let viewer;
  const abortError=()=>new DOMException('生成已取消','AbortError');
  const checkAbort=()=>{if(signal.aborted)throw abortError();};
  try {
    checkAbort();
    const transparent=background==='transparent';
    viewer=new SkinViewer({width:size,height:size,pixelRatio:1,renderPaused:true,preserveDrawingBuffer:true,enableControls:false,fov:40,skin,model});
    viewer.playerObject.skin.setOuterLayerVisible(outer);viewer.camera.quaternion.copy(camera.quaternion);
    const sword=createSword();viewer.playerObject.skin.rightArm.add(sword);
    await prepareEffects(viewer,motion);
    checkAbort();
    const {frames,delays}=motionTiming(motion,fps,duration);
    // Use exactly the same sampled poses and crop as death, in reverse order.
    const sourceMotion=motion==='revive'?'death':motion;
    onProgress(0,'正在调整构图');fitExportCamera(viewer,sword,sourceMotion,frames);await refineExportFraming(viewer,sword,sourceMotion,frames,size,signal);
    const canvas=document.createElement('canvas');canvas.width=canvas.height=size;const ctx=canvas.getContext('2d',{willReadFrequently:true});
    const encoder=GIFEncoder();
    for(let frame=0;frame<frames;frame++){
      const sourceFrame=motion==='revive'?frames-1-frame:frame;
      checkAbort();applyPose(viewer,sword,sourceMotion,sourceFrame/frames);viewer.render();ctx.clearRect(0,0,size,size);if(!transparent){ctx.fillStyle=background;ctx.fillRect(0,0,size,size);}ctx.drawImage(viewer.canvas,0,0);
      const rgba=ctx.getImageData(0,0,size,size).data;let palette,indexed;
      if(transparent){const opaque=new Uint8Array(rgba.length);let count=0;for(let i=0;i<rgba.length;i+=4)if(rgba[i+3]>=128){opaque[count++]=rgba[i];opaque[count++]=rgba[i+1];opaque[count++]=rgba[i+2];opaque[count++]=255;}const colors=count?quantize(opaque.subarray(0,count),255):[[0,0,0]];indexed=applyPalette(rgba,colors);for(let i=0;i<indexed.length;i++)indexed[i]=rgba[i*4+3]<128?0:indexed[i]+1;palette=[[0,0,0],...colors];}else{palette=quantize(rgba,256);indexed=applyPalette(rgba,palette);}
      encoder.writeFrame(indexed,size,size,{palette,delay:delays[sourceFrame],repeat:0,transparent,transparentIndex:0,dispose:2});onProgress(Math.round((frame+1)/frames*98),'正在生成 GIF');
      await new Promise(resolve=>setTimeout(resolve,0));
    }
    checkAbort();encoder.finish();onProgress(100,'生成完成');return new Blob([encoder.bytes()],{type:'image/gif'});
  } finally {
    if(viewer){const geometries=new Set(),materials=new Set();viewer.scene.traverse(o=>{if(o.isMesh){geometries.add(o.geometry);[].concat(o.material).forEach(m=>materials.add(m));}});geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());viewer.composer.dispose();viewer.dispose();viewer.renderer.forceContextLoss();}
  }
}
