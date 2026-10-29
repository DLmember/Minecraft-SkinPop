import assert from 'node:assert/strict';
import {motionTiming,FRAME_RATES,DURATIONS} from '../src/timing.js';

// Chromium DeferredImageDecoder::FrameDurationAtIndex (also notes Firefox):
// durations <= 10 ms are treated as 100 ms. File duration alone is insufficient.
// https://github.com/chromium/chromium/blob/main/third_party/blink/renderer/platform/graphics/deferred_image_decoder.cc
const playbackMs=delays=>delays.reduce((sum,delay)=>sum+(delay<=10?100:delay),0);
const previous=Array.from({length:60},(_,i)=>(Math.round((i+1)*100/60)-Math.round(i*100/60))*10);
assert.equal(playbackMs(previous),2800); // Original 1-second export reproduced.

let count=0;
for(const fps of FRAME_RATES)for(const seconds of [...DURATIONS,120/180,120/123.4,.01]){
  const timing=motionTiming('spin',fps,seconds);
  assert(timing.frames>=2);
  assert.equal(timing.frames,timing.delays.length);
  assert(timing.delays.every(ms=>ms>=20&&ms%10===0));
  assert.equal(playbackMs(timing.delays),Math.max(4,Math.round(seconds*100))*10);
  assert.equal(timing.duration*1000,playbackMs(timing.delays));
  count++;
}
for(const seconds of DURATIONS){
  const timing=motionTiming('sneak',60,seconds);
  assert.equal(timing.frames,20);
  assert.equal(playbackMs(timing.delays),Math.round(seconds*100)*10);
}
assert.deepEqual(motionTiming('spin',60,1).delays,Array(50).fill(20));
console.log(`PASS: reproduced 2.8s playback bug; ${count} timings avoid browser clamps; 60 option gives uniform 50 FPS, sneak timing preserved.`);
