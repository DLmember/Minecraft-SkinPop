import { Group, BoxGeometry, Mesh, MeshStandardMaterial } from 'three';
import swordPixels from './assets/diamond_sword.json';
import { resetEffects, applyDeath, applyExplosion } from './effects.js';
import { applyWaist } from './waist.js';
import { SNEAK_REPEATS } from './timing.js';
import { resetEating, applyEating } from './eating.js';

export const motions = [
  { id: 'spin', title: '全身旋转', subtitle: '平视 · 360°', caption: '全身水平旋转', camera: [0, 0, 63], target: [0, 0, 0] },
  { id: 'head', title: '头部旋转', subtitle: '俯视 · 360°', caption: '斜上方俯视头部', camera: [14, 26, 23], target: [0, 12, 0] },
  { id: 'walk', title: '行走', subtitle: '侧视 · 循环', caption: '斜侧方行走', camera: [36, 0, 58], target: [0, 0, 0] },
  { id: 'slash', title: '钻石剑跳劈', subtitle: '侧视 · 跳跃攻击', caption: '持钻石剑跳跃攻击', camera: [40, 3, 66], target: [0, 3, 0] },
  { id: 'waist', title: '扭腰', subtitle: '潜行 · 左右摆动', camera: [28, 0, 62], target: [0, 0, 0] },
  { id: 'eat', title: '吃苹果', subtitle: '侧视 · 原版苹果', camera: [-36, 0, 58], target: [0, 0, 0] },
  { id: 'sneak', title: '快速潜行', subtitle: '站 / 蹲直接切换', caption: '每个循环完成 10 次站蹲，可调整循环时长', camera: [36, 0, 58], target: [0, 0, 0] },
  { id: 'squash', title: '旋转压缩', subtitle: '高度 100%–40%', caption: '平视旋转，余弦曲线压缩高度', camera: [0, 0, 63], target: [0, 0, 0] },
  { id: 'sit', title: '坐姿点头', subtitle: '侧视 · 线性点头', caption: '坐姿，每个循环匀速点头两次', camera: [36, -4, 58], target: [0, -4, 0] },
  { id: 'death', title: '死亡', subtitle: '倒地 · 消失 · 烟雾', caption: '受伤变红、侧倒、消失并出现原版烟雾', camera: [38, -3, 62], target: [0, -3, 0] },
  { id: 'revive', title: '复活', subtitle: '死亡倒放', caption: '倒放死亡动作：烟雾收拢、人物出现并起身', camera: [38, -3, 62], target: [0, -3, 0] },
  { id: 'explode', title: '爆炸', subtitle: '膨胀 · 闪烁 · 爆炸', caption: '原地膨胀后爆炸', camera: [0, 0, 72], target: [0, 0, 0] },
];

export function createSword() {
  const sword = new Group();
  // Vanilla Java 1.21.4 texture, extruded one texel like item/generated.
  const materials = new Map();
  const geometry = new BoxGeometry(.85,.85,.85);
  const blade = new Group();
  swordPixels.forEach(([x,y,color])=>{
    if(!materials.has(color)) materials.set(color,new MeshStandardMaterial({color,roughness:1,metalness:0}));
    const pixel = new Mesh(geometry,materials.get(color));
    pixel.position.set((x-3)*.85,(15-y-3)*.85,0); blade.add(pixel);
  });
  blade.rotation.z = Math.PI/4;
  sword.add(blade);
  sword.position.set(-1,-9,1);
  sword.rotation.x = Math.PI / 2;
  // Twist around the aligned blade axis so its edge follows the arm's swing.
  sword.rotation.y = Math.PI / 2;
  return sword;
}

export function configureCamera(viewer, motion) {
  viewer.camera.position.set(...motion.camera);
  viewer.controls.target.set(...motion.target);
  viewer.camera.lookAt(...motion.target);
  viewer.controls.update();
}

const TAU = Math.PI * 2;
const smooth = t => { t = Math.max(0, Math.min(1, t)); return t*t*(3-2*t); };

// Preview and export share a deterministic pose function: phase 0 and 1 join seamlessly.
export function applyPose(viewer, sword, id, phase) {
  resetEffects(viewer);
  resetEating(viewer);
  const player = viewer.playerObject;
  const skin = player.skin;
  skin.resetJoints();
  skin.body.position.x = 0;
  skin.head.position.x = 0;
  skin.head.position.z = 0;
  player.rotation.set(0,0,0);
  player.position.set(0,0,0);
  player.scale.set(1,1,1);
  for (const part of [skin.body,skin.leftArm,skin.rightArm,skin.leftLeg,skin.rightLeg]) part.visible = id !== 'head';
  sword.visible = id === 'slash';
  sword.position.x = skin.modelType === 'slim' ? -.5 : -1;
  const angle = phase * TAU;
  if(id==='waist'){applyWaist(skin,phase);return;}
  if(id==='eat'){applyEating(viewer,phase);return;}
  if(id==='death'){applyDeath(viewer,phase);return;}
  if(id==='revive'){applyDeath(viewer,1-phase);return;}
  if(id==='explode'){applyExplosion(viewer,phase);return;}
  if(id==='sit'){
    skin.leftLeg.rotation.set(-Math.PI/2,0,.12);
    skin.rightLeg.rotation.set(-Math.PI/2,0,-.12);
    player.position.y=-10;
    skin.leftArm.rotation.x=skin.rightArm.rotation.x=-.2;
    // Triangle wave: constant angular velocity between the two nod endpoints.
    const nodPhase=((phase*2)%1+1)%1;
    const triangle=nodPhase<.5?nodPhase*2:2-nodPhase*2;
    skin.head.rotation.x=-.12+triangle*.55;
    return;
  }
  if (id === 'spin' || id === 'head') { player.rotation.y = angle; return; }
  if (id === 'squash') {
    player.rotation.y = angle;
    player.scale.y = .7 + .3*Math.cos(angle);
    player.position.y = -16*(1-player.scale.y);
    return;
  }
  if (id === 'walk') {
    const stride = Math.sin(angle * 2);
    skin.rightArm.rotation.x = stride * .65;
    skin.leftArm.rotation.x = -stride * .65;
    skin.leftLeg.rotation.x = stride * .75;
    skin.rightLeg.rotation.x = -stride * .75;
    skin.leftArm.rotation.z = .04; skin.rightArm.rotation.z = -.04;
    player.position.y = Math.sin(angle * 4) * .35;
  }
  if (id === 'sneak') {
    const crouch = Math.floor((((phase%1)+1)%1)*SNEAK_REPEATS*2+1e-8)%2;
    const tilt = .48 * crouch;
    const down = 2.4 * crouch;
    skin.body.rotation.x = tilt;
    skin.body.position.y -= down;
    skin.body.position.z = 1.5 * crouch;
    skin.head.position.y -= down + .7*crouch;
    skin.head.position.z = 4.3*crouch;
    for (const arm of [skin.leftArm,skin.rightArm]) { arm.position.y -= down; arm.position.z = 3.3*crouch; arm.rotation.x = -.18*crouch; }
    for (const leg of [skin.leftLeg,skin.rightLeg]) { leg.rotation.x = -.18*crouch; leg.position.z = -.8*crouch; }
  }
  if (id === 'slash') {
    const jump = phase > .18 && phase < .76 ? Math.sin((phase-.18)/.58*Math.PI) : 0;
    player.position.y = jump * 7;
    const windup = smooth(phase/.3);
    const strike = smooth((phase-.43)/.17);
    const recover = smooth((phase-.75)/.25);
    skin.rightArm.rotation.x = (-2.7*windup + 3.3*strike)*(1-recover);
    skin.rightArm.rotation.z = -.12 * Math.sin(phase*Math.PI);
    skin.leftArm.rotation.x = -.65*jump;
    skin.leftArm.rotation.z = .2*jump;
    skin.rightLeg.rotation.x = .5*jump;
    skin.leftLeg.rotation.x = -.65*jump;
    skin.body.rotation.x = .12*Math.sin(phase*TAU);
    skin.head.rotation.x = .1*jump;
  }
}

export function motionIllustration(id) {
  const person = `<g shape-rendering="crispEdges"><path fill="#6d91bf" d="M24 8h16v15H24z"/><path fill="#b3d0ef" d="M24 11h13v11H24z"/><path fill="#577ba8" d="M27 15h2v2h-2zm7 0h2v2h-2z"/><path fill="#8bb9e8" d="M24 24h15v16H24z"/><path fill="#6d91bf" d="M24 40h6v13h-6zm9 0h6v13h-6z"/><path fill="#a5c8ed" d="M18 24h5v16h-5zm22 0h5v16h-5z"/></g>`;
  const drawings = {
    sit: `<g transform="translate(0 3)">${person}</g><path d="M24 43h20v6H24z" fill="#6d91bf"/><path d="m49 13 3-3 3 3m-3-3v12m-3-3 3 3 3-3" stroke="#9ab9de" stroke-width="2"/>`,
    waist: person + '<path d="M9 34h10m-4-4 4 4-4 4m32-4h10m-4-4 4 4-4 4" fill="none" stroke="#8eafd5" stroke-width="2"/>',
    eat: person + '<path d="M40 23h5v-3h5v3h5v4h2v9h-3v3H43v-3h-3z" fill="#d75959"/><path d="M47 18h3v5h-3z" fill="#7f674b"/><path d="M49 17h6v3h-6z" fill="#8ab98c"/><path d="M43 26h3v6h-3z" fill="#f4aaa2"/>',
    death: `<g transform="translate(43 10) rotate(72) scale(.72)">${person}</g><path d="M43 36h7v-7h8v-7h-7v7h-8z" fill="#c5cfdf"/>`,
    revive: person + '<path d="M12 39V15m-6 6 6-6 6 6" fill="none" stroke="#8eafd5" stroke-width="3" stroke-linejoin="round"/><path d="M44 49h8v-7h6" fill="none" stroke="#c5cfdf" stroke-width="4"/>',
    explode: '<path d="m32 6 5 14 15-7-7 15 16 5-16 5 7 15-15-7-5 14-5-14-15 7 7-15L3 33l16-5-7-15 15 7Z" fill="#c4d6ee"/><path d="m32 18 5 11 12 4-12 5-5 11-5-11-11-5 11-4Z" fill="#8aafdF"/>',
    squash: `<g transform="translate(0 22) scale(1 .6)">${person}</g><path d="M9 15v32m-3-29 3-3 3 3m-6 26 3 3 3-3" stroke="#9ab9de" stroke-width="2"/>`,
    spin: person + '<path d="M13 40c-15 11 45 18 45 2m-5-2 5 2-3 5" fill="none" stroke="#a8c4e8" stroke-width="2"/>',
    head: '<g transform="translate(5 2)"><path d="m12 17 19-10 19 10-19 10z" fill="#c5dcf4"/><path d="m12 17 19 10v24L12 41z" fill="#a2c3e9"/><path d="m31 27 19-10v24L31 51z" fill="#769dcf"/><path d="M18 29v5m8-1v5" stroke="#547ca9" stroke-width="3"/></g><path d="M9 39c-8 13 42 19 49 7m-4-1 4 1-1 4" fill="none" stroke="#a8c4e8" stroke-width="2"/>',
    walk: `<g transform="rotate(-6 32 30)">${person}</g><path d="m10 28 5-1m-8 7h7m36 8 5 2" stroke="#b4cce9" stroke-width="2"/>`,
    slash: `<g transform="translate(-3 1) rotate(-12 32 30)">${person}</g><path d="m43 28 12-19 4 3-12 19-4 1-3-3z" fill="#79c8cc"/><path d="m43 25 6 4m-8 1-3 5" stroke="#6098a5" stroke-width="3"/><path d="m52 3 2-3m8 10h3" stroke="#b6cde9" stroke-width="2"/>`,
    sneak: `<g transform="translate(0 9) scale(1 .8)">${person}</g><path d="m12 18 0 9m-3-3 3 4 3-4m34-6v9m-3-3 3 4 3-4" stroke="#adc8e9" stroke-width="2"/><rect x="20" y="49" width="25" height="10" rx="3" fill="#e6eef9"/><text x="32.5" y="56.5" text-anchor="middle" fill="#8da8cc" font-family="sans-serif" font-size="6">SHIFT</text>`,
  };
  return `<svg viewBox="0 0 66 62" aria-hidden="true">${drawings[id]}</svg>`;
}
