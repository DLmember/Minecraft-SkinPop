import { Vector3, Box3 } from 'three';
import { applyPose } from './motions.js';

// Fit the entire cycle once. A fixed camera preserves jumps and height changes.
export function fitExportCamera(viewer, sword, motion, frames) {
  const inverse = viewer.camera.quaternion.clone().invert();
  const points = [];
  const bounds = new Box3();
  const samples = motion === 'sneak' ? 2 : Math.max(96, frames);
  for (let frame = 0; frame < samples; frame++) {
    applyPose(viewer, sword, motion, frame / samples);
    viewer.scene.updateMatrixWorld(true);
    viewer.scene.traverseVisible(object => {
      if (!object.isMesh) return;
      const geometry = object.geometry;
      if (!geometry.boundingBox) geometry.computeBoundingBox();
      const { min, max } = geometry.boundingBox;
      for (const x of [min.x, max.x]) for (const y of [min.y, max.y]) for (const z of [min.z, max.z]) {
        const point = new Vector3(x,y,z).applyMatrix4(object.matrixWorld).applyQuaternion(inverse);
        bounds.expandByPoint(point); points.push(point);
      }
    });
  }
  const center = bounds.getCenter(new Vector3());
  const tangent = Math.tan(viewer.camera.fov * Math.PI / 360);
  const usable = .97;
  let distance = -Infinity;
  for (const p of points) distance = Math.max(distance, p.z + Math.abs(p.y-center.y)/(tangent*usable), p.z + Math.abs(p.x-center.x)/(tangent*viewer.camera.aspect*usable));
  viewer.camera.position.set(center.x,center.y,distance).applyQuaternion(viewer.camera.quaternion);
  viewer.camera.updateMatrixWorld(true);
}

// Sparse transparent outer layers have larger geometry than their visible pixels.
// Refine the common crop using actual alpha across every exported pose.
export async function refineExportFraming(viewer,sword,motion,frames,size,signal) {
  const probe=128;
  viewer.setSize(probe,probe);
  const canvas=document.createElement('canvas');canvas.width=canvas.height=probe;
  const ctx=canvas.getContext('2d',{willReadFrequently:true});
  let minX=probe,minY=probe,maxX=-1,maxY=-1;
  for(let frame=0;frame<frames;frame++){
    if(signal.aborted)throw new DOMException('生成已取消','AbortError');
    applyPose(viewer,sword,motion,frame/frames);viewer.render();
    ctx.clearRect(0,0,probe,probe);ctx.drawImage(viewer.canvas,0,0);
    const data=ctx.getImageData(0,0,probe,probe).data;
    for(let y=0;y<probe;y++)for(let x=0;x<probe;x++)if(data[(y*probe+x)*4+3]>32){minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);}
    if(frame%4===0)await new Promise(resolve=>setTimeout(resolve,0));
  }
  if(maxX>=minX){
    const side=Math.max(maxX-minX+1,maxY-minY+1)/.97+2;
    viewer.camera.setViewOffset(probe,probe,(minX+maxX+1-side)/2,(minY+maxY+1-side)/2,side,side);
  }
  viewer.setSize(size,size);
}
