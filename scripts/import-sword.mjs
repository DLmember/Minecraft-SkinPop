import { chromium } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
const browser=await chromium.launch({channel:'chrome',headless:true});
try {
  const page=await browser.newPage();
  await page.goto('http://127.0.0.1:5173/src/assets/diamond_sword.png');
  const pixels=await page.evaluate(async()=>{
    const image=document.images[0];await image.decode();
    if(image.naturalWidth!==16 || image.naturalHeight!==16)throw new Error('Expected vanilla 16×16 sword');
    const canvas=document.createElement('canvas');canvas.width=canvas.height=16;
    const ctx=canvas.getContext('2d');ctx.drawImage(image,0,0);
    const data=ctx.getImageData(0,0,16,16).data,pixels=[];
    for(let y=0;y<16;y++)for(let x=0;x<16;x++){const i=(y*16+x)*4;if(data[i+3])pixels.push([x,y,'#'+[...data.slice(i,i+3)].map(n=>n.toString(16).padStart(2,'0')).join('')]);}
    return pixels;
  });
  await writeFile('src/assets/diamond_sword.json',JSON.stringify(pixels)+'\n');
  console.log(`Imported ${pixels.length} opaque vanilla texture pixels.`);
} finally {await browser.close();}
