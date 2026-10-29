export const DURATIONS = [.5,.6,1,1.5,1.6,2,3,4];
export const DEFAULT_DURATIONS = Object.freeze({spin:1.5,head:1.5,walk:2,slash:1,eat:1.6,waist:.6,sneak:2,squash:1,sit:1,death:2,revive:2,explode:2});
export const DURATION_STORAGE_KEY = 'skinpop.motion-durations.v1';
export const FRAME_RATES = Object.freeze([10,20,25,30,60]);
export const DEFAULT_FPS = 30;
export const FPS_STORAGE_KEY = 'skinpop.fps.v1';

export function loadFrameRate(){
  try {
    const value=JSON.parse(localStorage.getItem(FPS_STORAGE_KEY));
    if(FRAME_RATES.includes(value))return value;
  } catch { /* Missing, invalid or unavailable storage uses the default. */ }
  return DEFAULT_FPS;
}

export function saveFrameRate(fps){
  if(!FRAME_RATES.includes(fps))return false;
  try { localStorage.setItem(FPS_STORAGE_KEY,JSON.stringify(fps));return true; }
  catch { return false; }
}
export const SNEAK_REPEATS = 10;
export const usesBpm = id => id==='waist'||id==='squash';

export function loadDurations(){
  const durations={...DEFAULT_DURATIONS};
  try {
    const saved=JSON.parse(localStorage.getItem(DURATION_STORAGE_KEY));
    for(const id of Object.keys(durations)){
      const value=saved?.[id];
      if(usesBpm(id)?Number.isFinite(value)&&value>0:DURATIONS.includes(value))durations[id]=value;
    }
  } catch { /* Local files can have unavailable storage or invalid saved data. */ }
  return durations;
}

export function saveDurations(durations){
  try { localStorage.setItem(DURATION_STORAGE_KEY,JSON.stringify(durations));return true; }
  catch { return false; }
}

export function motionTiming(motion,fps,duration){
  // GIF uses whole centiseconds. Chromium/Firefox expand <=10 ms frames to
  // 100 ms, so the old 60 FPS 20/10/20 pattern played unevenly and too slowly.
  // Cap encoded density to 50 FPS and preserve the requested cycle duration
  // (rounded to GIF precision). Two poses require at least 40 ms at extreme BPM.
  const ticks=Math.max(4,Math.round(duration*100));
  const seconds=ticks/100;
  // Store each held sneak pose once; delays preserve the rapid two-pose motion
  // without sub-20 ms GIF delays that browsers may stretch at the 0.5 s setting.
  const frames=motion==='sneak'?SNEAK_REPEATS*2:Math.max(2,Math.min(Math.floor(ticks/2),Math.round(Math.min(fps,50)*seconds)));
  // GIF stores centiseconds: distribute rounding across frames to preserve 0.5 s
  // at 25 FPS (13 frames), instead of rounding every frame up to 40 ms.
  const delays=Array.from({length:frames},(_,i)=>(Math.round((i+1)*ticks/frames)-Math.round(i*ticks/frames))*10);
  return {duration:seconds,frames,delays};
}
