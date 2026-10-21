import { mkdir,writeFile,readFile,rm } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';

const base='https://raw.githubusercontent.com/InventivetalentDev/minecraft-assets/1.21.4/assets/minecraft';
const run=promisify(execFile);
async function download(relative,path){
  const mirrors=['https://assets.mcasset.cloud/1.21.4/assets/minecraft','https://cdn.jsdelivr.net/gh/InventivetalentDev/minecraft-assets@1.21.4/assets/minecraft'];
  let lastError;
  for(const root of mirrors){
    try {await run('curl.exe',['-f','-sS','-L','--connect-timeout','8','--max-time','20','-o',path,`${root}/${relative}`]);return await readFile(path);}catch(error){lastError=error;}
  }
  throw lastError;
}
await mkdir('src/assets/particles',{recursive:true});
const names=[...Array.from({length:8},(_,i)=>`generic_${i}`),...Array.from({length:16},(_,i)=>`explosion_${i}`)];
const manifest={version:'Minecraft Java Edition 1.21.4',source:base,files:{}};
for(let start=0;start<names.length;start+=4){
  const results=await Promise.allSettled(names.slice(start,start+4).map(async name=>{
    const url=`${base}/textures/particle/${name}.png`;
    const bytes=await download(`textures/particle/${name}.png`,`src/assets/particles/${name}.png`);
    if(bytes.subarray(0,8).toString('hex')!=='89504e470d0a1a0a')throw new Error(`Invalid PNG: ${name}`);
    await writeFile(`src/assets/particles/${name}.png`,bytes);
    manifest.files[`${name}.png`]={url,sha256:createHash('sha256').update(bytes).digest('hex')};
  }));
  for(const result of results)if(result.status==='rejected')throw result.reason;
}
for(const name of ['smoke','poof','explosion']){
  const bytes=await download(`particles/${name}.json`,`src/assets/particles/${name}.json`);
  JSON.parse(bytes.toString('utf8'));
}
await writeFile('src/assets/particles/provenance.json',JSON.stringify(manifest,null,2)+'\n');
console.log(`Downloaded and verified ${names.length} original particle textures and 3 animation definitions.`);
// Discard temporary placeholder art once all original resources are verified.
for(const name of names)await rm(`src/assets/particles/${name}.svg`,{force:true});
