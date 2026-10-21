class AccountNotFound extends Error {}

async function getJSON(url, timeout = 6500) {
  const response = await fetch(url, { signal: AbortSignal.timeout(timeout), credentials: 'omit' });
  if (response.status === 404 || response.status === 204) throw new AccountNotFound('没有找到这个正版账号，请检查游戏名。');
  if (response.status === 429) throw new Error('查询太频繁了，请稍后再试。');
  if (!response.ok) throw new Error(`查询服务暂不可用（${response.status}）`);
  return response.json();
}

export async function lookupAccount(name) {
  if (!/^[a-zA-Z0-9_]{1,16}$/.test(name)) throw new Error('游戏名应为 1–16 位英文字母、数字或下划线。');
  let officialError;
  try {
    const account = await getJSON(`https://api.mojang.com/users/profiles/minecraft/${encodeURIComponent(name)}`);
    const profile = await getJSON(`https://sessionserver.mojang.com/session/minecraft/profile/${account.id}`);
    const property = profile.properties?.find(p => p.name === 'textures');
    if (!property) throw new Error('这个账号没有可用的皮肤信息。');
    const skin = JSON.parse(atob(property.value)).textures?.SKIN;
    if (!skin?.url) throw new Error('这个账号没有可用的皮肤信息。');
    return { name: account.name, uuid: account.id, source: 'Mojang', model: skin.metadata?.model === 'slim' ? 'slim' : 'default', url: skin.url.replace(/^http:/, 'https:') };
  } catch (error) {
    if (error instanceof AccountNotFound) throw error;
    officialError = error;
  }
  let compatibilityError;
  try {
    const account = await getJSON(`https://api.ashcon.app/mojang/v2/user/${encodeURIComponent(name)}`, 9000);
    if (!account.textures?.skin) throw new Error('这个账号没有可用的皮肤信息。');
    return { name: account.username, uuid: account.uuid, source: 'Ashcon 兼容查询', model: account.textures.slim ? 'slim' : 'default', url: account.textures.skin.data ? `data:image/png;base64,${account.textures.skin.data}` : account.textures.skin.url.replace(/^http:/, 'https:') };
  } catch (error) {
    if (error instanceof AccountNotFound) throw error;
    compatibilityError = error;
  }
  try {
    const account = await getJSON(`https://api.minetools.eu/uuid/${encodeURIComponent(name)}`);
    if (account.status === 'ERR' && !account.id) throw new AccountNotFound('没有找到这个正版账号，请检查游戏名。');
    if (!account.id) throw new Error('兼容查询暂不可用');
    const profile = await getJSON(`https://api.minetools.eu/profile/${account.id}`);
    const skin = profile.decoded?.textures?.SKIN;
    if (!skin?.url) throw new Error('没有可用的皮肤信息');
    return { name: account.name, uuid: account.id, source: 'Minetools 兼容查询', model: skin.metadata?.model === 'slim' ? 'slim' : 'default', url: skin.url.replace(/^http:/, 'https:') };
  } catch (error) {
    if (error instanceof AccountNotFound) throw error;
    if ([officialError,compatibilityError,error].some(e=>e?.message?.includes('频繁'))) throw new Error('查询服务繁忙，请稍后再试，或上传本地皮肤。');
    throw new Error('暂时无法连接皮肤服务，请稍后重试，或上传本地 PNG 皮肤。');
  }
}

export async function loadSkinImage(source) {
  let blob;
  if (source instanceof File) {
    if (source.size > 8 * 1024 * 1024) throw new Error('皮肤文件不能超过 8 MB。');
    const bytes = new Uint8Array(await source.slice(0, 8).arrayBuffer());
    if (bytes.join(',') !== '137,80,78,71,13,10,26,10') throw new Error('请选择真正的 PNG 格式皮肤。');
    blob = source;
  } else {
    const response = await fetch(source, { signal: AbortSignal.timeout(10000), credentials: 'omit' });
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
