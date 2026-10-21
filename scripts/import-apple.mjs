import { chromium } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const bytes=await readFile('src/assets/apple.png');
const browser=await chromium.launch({channel:'chrome',headless:true});
try {
  const page=await browser.newPage();
  const pixels=await page.evaluate(async url=>{
    const image=new Image();image.src=url;await image.decode();
    if(image.width!==16||image.height!==16)throw new Error('Expected vanilla 16x16 apple');
    const canvas=document.createElement('canvas');canvas.width=canvas.height=16;
    const ctx=canvas.getContext('2d');ctx.drawImage(image,0,0);
    const data=ctx.getImageData(0,0,16,16).data,pixels=[];
    for(let y=0;y<16;y++)for(let x=0;x<16;x++){
      const i=(y*16+x)*4;
      if(data[i+3])pixels.push([x,y,'#'+[...data.slice(i,i+3)].map(n=>n.toString(16).padStart(2,'0')).join('')]);
    }
    return pixels;
  },`data:image/png;base64,${bytes.toString('base64')}`);
  await writeFile('src/assets/apple.json',JSON.stringify(pixels)+'\n');
  await writeFile('src/assets/apple-provenance.json',JSON.stringify({
    version:'Minecraft Java Edition 1.21.4',
    url:'https://raw.githubusercontent.com/InventivetalentDev/minecraft-assets/1.21.4/assets/minecraft/textures/item/apple.png',
    retrievedFrom:'https://cdn.jsdelivr.net/gh/InventivetalentDev/minecraft-assets@1.21.4/assets/minecraft/textures/item/apple.png',
    sha256:createHash('sha256').update(bytes).digest('hex'),opaqueTexels:pixels.length,
    consumeSeconds:1.6,consumeTicks:32,ticksPerSecond:20,
  },null,2)+'\n');
  console.log(`Imported ${pixels.length} original apple texels.`);
} finally {await browser.close();}
