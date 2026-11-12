export function publicMediaUrl(value){
 if(typeof value!=='string'||value.length>2000)throw Error('图片地址无效');let u;try{u=new URL(value)}catch{throw Error('图片地址无效')}
 const host=u.hostname.toLowerCase().replace(/\.+$/,'');if(u.protocol!=='https:'||u.username||u.password||!host.includes('.')||/^[\d.]+$/.test(host)||host.includes(':')||/\.(local|internal|localhost|localdomain)$/.test(host))throw Error('图片须使用无凭据的公开HTTPS地址');u.hostname=host;return u.href;
}
export function normalizeActivityImages(images=[]){
 if(!Array.isArray(images)||images.length>4)throw Error('每项安排最多4张图片');const seen=new Set();return images.map(image=>{
  if(!image||typeof image!=='object'||Object.keys(image).some(k=>!['url','alt','kind','sourceUrl','checkedAt','caption'].includes(k)))throw Error('图片字段无效');
  const url=publicMediaUrl(image.url);if(seen.has(url))throw Error('同一安排图片重复');seen.add(url);if(typeof image.alt!=='string'||!image.alt.trim()||image.alt.length>150||image.caption!=null&&(typeof image.caption!=='string'||image.caption.length>400))throw Error('请填写图片说明');if(image.kind!=null&&!['reference','generated'].includes(image.kind))throw Error('图片类型无效');if(image.checkedAt!=null&&(typeof image.checkedAt!=='string'||!Number.isFinite(Date.parse(image.checkedAt))))throw Error('图片核对时间无效');
  return {url,alt:image.alt.trim(),kind:image.kind??'reference',...(image.sourceUrl?{sourceUrl:publicMediaUrl(image.sourceUrl)}:{}),...(image.checkedAt?{checkedAt:image.checkedAt}:{}),...(image.caption?{caption:image.caption}:{})};
 });
}
/** Legacy links are displayed read-only; explicit [] lets a user suppress them. */
export function activityImages(activity){
 if(Array.isArray(activity?.images)){try{return normalizeActivityImages(activity.images)}catch{return []}}
 const notes=String(activity?.notes??''),urls=[...notes.matchAll(/https:\/\/[^\s；;，。<>"'\[\]()]+?\.(?:jpe?g|png|webp|gif|avif)(?:\?[^\s；;，。<>"'\[\]()]*)?/gi)].map(m=>m[0]);
 return [...new Set(urls)].slice(0,4).flatMap(url=>{try{return normalizeActivityImages([{url,alt:String(activity.title??'菜品或安排').slice(0,130)+'参考图',kind:'reference'}])}catch{return []}});
}
