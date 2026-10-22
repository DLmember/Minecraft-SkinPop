import { Group, PlaneGeometry, Mesh, MeshBasicMaterial, TextureLoader, NearestFilter, SRGBColorSpace, Color } from 'three';

const sources=import.meta.glob('./assets/particles/*.png',{eager:true,query:'?url',import:'default'});
const instances=new WeakMap();
let texturePromise;

function loadTextures(){
  if(!texturePromise){
    const loader=new TextureLoader();
    const names=[...Array.from({length:8},(_,i)=>`generic_${i}`),...Array.from({length:16},(_,i)=>`explosion_${i}`)];
    texturePromise=Promise.all(names.map(async name=>{
      const url=sources[`./assets/particles/${name}.png`];
      if(!url)throw new Error(`缺少原版粒子资源：${name}`);
      const texture=await loader.loadAsync(url);
      texture.magFilter=texture.minFilter=NearestFilter;
      texture.generateMipmaps=false;texture.colorSpace=SRGBColorSpace;
      return [name,texture];
    })).then(entries=>Object.fromEntries(entries));
  }
  return texturePromise;
}

function getEffects(viewer){
  if(instances.has(viewer))return instances.get(viewer);
  const group=new Group();group.name='minecraft-particles';group.visible=false;viewer.scene.add(group);
  const fx={group,particles:[],tint:{value:0},color:{value:new Color(1,0,0)},textures:null};
  const geometry=new PlaneGeometry(1,1);
  for(let i=0;i<12;i++){
    const material=new MeshBasicMaterial({transparent:true,alphaTest:.05,depthWrite:false,toneMapped:false});
    const particle=new Mesh(geometry,material);particle.visible=false;group.add(particle);fx.particles.push(particle);
  }
  const materials=new Set();
  viewer.playerObject.skin.traverse(object=>{if(object.isMesh)[].concat(object.material).forEach(m=>materials.add(m));});
  materials.forEach(material=>{
    material.onBeforeCompile=shader=>{
      shader.uniforms.skinPopTint=fx.tint;shader.uniforms.skinPopColor=fx.color;
      shader.fragmentShader='uniform float skinPopTint;\nuniform vec3 skinPopColor;\n'+shader.fragmentShader;
      shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\ndiffuseColor.rgb = mix(diffuseColor.rgb, skinPopColor, skinPopTint);');
    };
    material.customProgramCacheKey=()=> 'skinpop-damage-overlay-v1';material.needsUpdate=true;
  });
  fx.ready=loadTextures().then(textures=>{fx.textures=textures;});
  // Preview may start before the local images finish decoding; exports await ready.
  fx.ready.catch(error=>{fx.error=error;});
  instances.set(viewer,fx);return fx;
}

export async function prepareEffects(viewer,motion){
  if(motion==='death'||motion==='revive'||motion==='explode')await getEffects(viewer).ready;
}

export function resetEffects(viewer){
  viewer.playerObject.visible=true;
  const fx=instances.get(viewer);
  if(!fx)return;
  fx.tint.value=0;fx.group.visible=false;fx.particles.forEach(p=>p.visible=false);
}

function showParticle(viewer,fx,index,name,position,size,brightness=1){
  if(!fx.textures)return;
  fx.group.visible=true;
  const particle=fx.particles[index];particle.visible=true;
  particle.position.set(...position);particle.scale.set(size,size,1);
  particle.quaternion.copy(viewer.camera.quaternion);
  particle.material.map=fx.textures[name];particle.material.color.setRGB(brightness,brightness,brightness);
  particle.material.needsUpdate=!particle.userData.hasMap;particle.userData.hasMap=true;
}

export function applyDeath(viewer,phase){
  const fx=getEffects(viewer),player=viewer.playerObject;
  const fall=Math.min(1,Math.max(0,(phase-.08)/.4));
  // Vanilla death tilt uses a clamped square root, rotating toward the ground.
  const angle=-Math.sqrt(fall)*Math.PI/2;
  player.rotation.z=angle;
  // Rotate around a low pivot while keeping the body above the floor.
  player.position.set(-16*Math.sin(angle),-12+12*Math.cos(angle),0);
  fx.color.value.setRGB(1,0,0);fx.tint.value=phase>=.04?.45:0;
  if(phase>=.56)player.visible=false;
  if(phase<.56||phase>=.96)return;
  const age=(phase-.56)/.4;
  // The vanilla poof/smoke sequence is generic_7 -> generic_0.
  for(let i=0;i<7;i++){
    const life=age-i*.025;
    if(life<0||life>=1)continue;
    const frame=7-Math.min(7,Math.floor(life*8));
    const x=12+Math.sin(i*2.4)*2+Math.sin(life*3+i)*1.5;
    const y=-11+life*18+i*.6;
    showParticle(viewer,fx,i,`generic_${frame}`,[x,y,Math.cos(i*1.8)*2],4.5+life*3,.85);
  }
}

export function applyExplosion(viewer,phase){
  const fx=getEffects(viewer),player=viewer.playerObject;
  if(phase<.6){
    const charge=phase/.6;
    const swell=1+.85*.25*charge*charge;
    player.scale.setScalar(swell);
    // PlayerObject origin is the standing model's geometric centre.
    player.position.set(0,0,0);
    player.rotation.z=Math.sin(charge*81)*.025*charge;
    fx.color.value.setRGB(1,1,1);
    fx.tint.value=Math.floor(charge*10)%2===1?.85:0;
    return;
  }
  player.visible=false;
  if(phase>=.96)return;
  for(let i=0;i<7;i++){
    const age=(phase-.6-i*.012)/.29;
    if(age<0||age>=1)continue;
    const frame=Math.min(15,Math.floor(age*16));
    const theta=i*2.39996;
    const radius=i===0?0:4+age*5;
    showParticle(viewer,fx,i,`explosion_${frame}`,[Math.cos(theta)*radius,Math.sin(theta)*radius,i*.15],i===0?29:15+i%3*2,1-i*.035);
  }
}
