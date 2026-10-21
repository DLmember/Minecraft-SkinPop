class AccountNotFound extends Error {}

async function request(url, signal) {
  const response=await fetch(url,{signal,credentials:'omit'});
  if(response.status===404||response.status===204)throw new AccountNotFound('没有找到这个正版账号，请检查游戏名。');
  if(!response.ok)throw new Error('皮肤服务暂不可用（'+response.status+'）');
  return response;
}
const json=async(url,signal)=>(await request(url,signal)).json();
function skinAccount(name,uuid,source,skin){
  if(!skin?.url)throw new Error('没有可用的皮肤信息');
  return {name,uuid,source,model:skin.metadata?.model==='slim'?'slim':'default',url:skin.url.replace(/^http:/,'https:')};
}
const providers=[
  {delay:0,async run(name,signal){
    const response=await request('https://needcoolershoes.com/api/skin/'+encodeURIComponent(name),signal);
    const uuid=response.headers.get('x-needcoolershoes-uuid'),model=response.headers.get('x-needcoolershoes-model');
    if(!/^[a-f0-9]{32}$/i.test((uuid||'').replaceAll('-',''))||!['classic','slim'].includes(model))throw new Error('皮肤服务缺少账号或模型信息');
    const image=await loadSkinImage(await response.blob(),signal);
    return {name,uuid,source:'NeedCoolerShoes',model:model==='slim'?'slim':'default',image};
  }},
  {delay:250,async run(name,signal){
    const account=await json('https://api.mojang.com/users/profiles/minecraft/'+encodeURIComponent(name),signal);
    const profile=await json('https://sessionserver.mojang.com/session/minecraft/profile/'+account.id,signal);
    const property=profile.properties?.find(p=>p.name==='textures');
    if(!property)throw new Error('没有可用的皮肤信息');
    return skinAccount(account.name,account.id,'Mojang',JSON.parse(atob(property.value)).textures?.SKIN);
  }},
  {delay:600,async run(name,signal){
    const account=await json('https://api.ashcon.app/mojang/v2/user/'+encodeURIComponent(name),signal);
    const skin=account.textures?.skin;
    if(!skin)throw new Error('没有可用的皮肤信息');
    return {name:account.username,uuid:account.uuid,source:'Ashcon 兼容查询',model:account.textures.slim?'slim':'default',url:skin.data?'data:image/png;base64,'+skin.data:skin.url?.replace(/^http:/,'https:')};
  }},
  {delay:1000,async run(name,signal){
    const account=await json('https://api.minetools.eu/uuid/'+encodeURIComponent(name),signal);
    if(account.status==='ERR'&&!account.id)throw new AccountNotFound('没有找到这个正版账号，请检查游戏名。');
    if(!account.id)throw new Error('兼容查询暂不可用');
    const profile=await json('https://api.minetools.eu/profile/'+account.id,signal);
    return skinAccount(account.name,account.id,'Minetools 兼容查询',profile.decoded?.textures?.SKIN);
  }},
];

function delay(ms,signal){
  return new Promise((resolve,reject)=>{
    const abort=()=>{clearTimeout(timer);reject(signal.reason);};
    const timer=setTimeout(()=>{signal.removeEventListener('abort',abort);resolve();},ms);
    if(signal.aborted)abort();else signal.addEventListener('abort',abort,{once:true});
  });
}

export async function lookupAccount(name){
  if(!/^[a-zA-Z0-9_]{1,16}$/.test(name))throw new Error('游戏名应为 1–16 位英文字母、数字或下划线。');
  const controller=new AbortController();
  // One deadline covers lookup, body download and image decode for every provider.
  const timer=setTimeout(()=>controller.abort(new DOMException('查询超时','TimeoutError')),10000);
  const signal=controller.signal;
  try {
    return await Promise.any(providers.map(async provider=>{
      await delay(provider.delay,signal);
      const account=await provider.run(name,signal);
      if(!account.image)account.image=await loadSkinImage(account.url,signal);
      signal.throwIfAborted();
      return account;
    }));
  }catch(error){
    if(error.errors?.every(e=>e instanceof AccountNotFound))throw new AccountNotFound('没有找到这个正版账号，请检查游戏名。');
    throw new Error('暂时无法加载皮肤，请稍后重试，或上传本地 PNG 皮肤。');
  }finally{clearTimeout(timer);controller.abort();}
}

export async function loadSkinImage(source, signal) {
  let blob;
  if (source instanceof Blob) {
    if (source.size > 8 * 1024 * 1024) throw new Error('皮肤文件不能超过 8 MB。');
    const bytes = new Uint8Array(await source.slice(0, 8).arrayBuffer());
    if (bytes.join(',') !== '137,80,78,71,13,10,26,10') throw new Error('请选择真正的 PNG 格式皮肤。');
    blob = source;
  } else {
    const response = await fetch(source, { signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(8000)]) : AbortSignal.timeout(8000), credentials: 'omit' });
    if (!response.ok) throw new Error('皮肤图片下载失败，请重试或上传本地皮肤。');
    blob = await response.blob();
  }
  const url = URL.createObjectURL(blob);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const { naturalWidth: width, naturalHeight: height } = image;
    if (width < 64 || width > 1024 || (width & (width - 1)) !== 0 || (height !== width && height !== width / 2)) {
      throw new Error('皮肤尺寸应为 64×64、64×32 或 2 的整数次幂高清版本（最大宽度 1024）。');
    }
    return image;
  } catch (error) {
    if (error.name === 'EncodingError') throw new Error('无法读取图片，请选择有效的 PNG 皮肤。');
    throw error;
  } finally { URL.revokeObjectURL(url); }
}
