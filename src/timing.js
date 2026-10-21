export const DURATIONS = [.5,1,1.5,1.6,2,3,4];
export const DEFAULT_DURATIONS = Object.freeze({spin:1.5,head:1.5,walk:2,slash:1,eat:1.6,sneak:2,squash:1,sit:1,death:2,revive:2,explode:2});
export const DURATION_STORAGE_KEY = 'skinpop.motion-durations.v1';
export const SNEAK_REPEATS = 10;

export function loadDurations(){
  const durations={...DEFAULT_DURATIONS};
  try {
    const saved=JSON.parse(localStorage.getItem(DURATION_STORAGE_KEY));
    for(const id of Object.keys(durations))if(DURATIONS.includes(saved?.[id]))durations[id]=saved[id];
  } catch { /* Local files can have unavailable storage or invalid saved data. */ }
  return durations;
}

export function saveDurations(durations){
  try { localStorage.setItem(DURATION_STORAGE_KEY,JSON.stringify(durations));return true; }
  catch { return false; }
}

export function motionTiming(motion,fps,duration){
  const seconds=duration;
  // Store each held sneak pose once; delays preserve the rapid two-pose motion
  // without sub-20 ms GIF delays that browsers may stretch at the 0.5 s setting.
  const frames=motion==='sneak'?SNEAK_REPEATS*2:Math.max(2,Math.round(fps*seconds));
  // GIF stores centiseconds: distribute rounding across frames to preserve 0.5 s
  // at 25 FPS (13 frames), instead of rounding every frame up to 40 ms.
  const ticks=Math.round(seconds*100);
  const delays=Array.from({length:frames},(_,i)=>(Math.round((i+1)*ticks/frames)-Math.round(i*ticks/frames))*10);
  return {duration:seconds,frames,delays};
}
