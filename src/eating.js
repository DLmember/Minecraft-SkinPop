import { Group, BoxGeometry, Mesh, MeshStandardMaterial, Vector3 } from 'three';
import applePixels from './assets/apple.json';

const instances=new WeakMap();
export const APPLE_CONSUME_TICKS=32;
export const APPLE_CONSUME_SECONDS=1.6;

function getEating(viewer){
  if(instances.has(viewer))return instances.get(viewer);
  const skin=viewer.playerObject.skin,materials=new Map();
  const geometry=new BoxGeometry(1,1,1);
  const texel=([x,y,color],originX,originY,scale)=>{
    if(!materials.has(color))materials.set(color,new MeshStandardMaterial({color,roughness:1,metalness:0}));
    const mesh=new Mesh(geometry,materials.get(color));
    mesh.position.set((x-originX)*scale,(originY-y)*scale,0);mesh.scale.setScalar(scale);
    return mesh;
  };
  // Unchanged item pixels, one-texel thickness, vanilla generated-item scale.
  const apple=new Group();apple.name='minecraft-apple';
  applePixels.forEach(pixel=>apple.add(texel(pixel,7.5,7.5,.55)));
  skin.rightArm.add(apple);
  const crumbs=new Group();crumbs.name='apple-crumbs';skin.add(crumbs);
  for(let i=0;i<16;i++){
    const patch=new Group(),x=4+(i%3)*3,y=5+(Math.floor(i/3)%3)*3;
    applePixels.filter(p=>p[0]>=x&&p[0]<x+3&&p[1]>=y&&p[1]<y+3)
      .forEach(pixel=>patch.add(texel(pixel,x+1,y+1,.18)));
    crumbs.add(patch);
  }
  const result={apple,crumbs,offset:new Vector3()};instances.set(viewer,result);return result;
}

export function resetEating(viewer){
  const fx=instances.get(viewer);
  if(fx){fx.apple.visible=false;fx.crumbs.visible=false;}
}

export function applyEating(viewer,phase){
  const skin=viewer.playerObject.skin,{apple,crumbs,offset}=getEating(viewer);
  const tick=Math.max(0,Math.min(1,phase))*APPLE_CONSUME_TICKS;
  // Vanilla food use lasts 32 ticks, with chewing/particle events every 4 ticks.
  const lift=Math.min(1,tick/4),ease=lift*lift*(3-2*lift);
  const chew=tick>=8?Math.abs(Math.cos((APPLE_CONSUME_TICKS-tick)*Math.PI/4)):0;
  skin.rightArm.rotation.set(-.3-1.12*ease+chew*.045,0,.40*ease);
  skin.leftArm.rotation.z=-.04;
  skin.head.rotation.x=.06*ease+chew*.025;
  apple.visible=tick<31;
  apple.position.set(skin.modelType==='slim'?-.5:-1,-8.5,1);
  // Keep the flat item upright while its hand follows the eating pose.
  apple.quaternion.copy(skin.rightArm.quaternion).invert();
  // Put the item in front of the palm so the arm does not cover its texture.
  apple.position.add(offset.set(0,4.1,-.2).applyQuaternion(apple.quaternion));
  apple.rotateY(-.2);apple.rotateZ(-.12);
  crumbs.visible=tick>=8;
  const lastBite=tick>=31?31:Math.floor(tick/4)*4;
  const age=(tick-lastBite)/20;
  crumbs.children.forEach((particle,i)=>{
    particle.visible=crumbs.visible&&i<(lastBite===31?16:5)&&age<.3;
    const theta=i*2.39996+lastBite*.7;
    particle.position.set(-.2+Math.cos(theta)*age*9,2.0+age*(4+i%3)-22*age*age,7.9+age*(4+i%4));
    particle.rotation.set(age*4+i,theta,age*6);
  });
}
