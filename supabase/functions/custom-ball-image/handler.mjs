import {normalizePng} from './image.mjs';
const bucket='wakppu-custom',version='20261021-custom1';
export function createHandler({PNG,clients}){
 let health;
 return async req=>{
  const headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info','Access-Control-Allow-Methods':'POST, OPTIONS','Content-Type':'application/json','Cache-Control':'no-store'};
  const reply=(body,status=200)=>new Response(JSON.stringify(body),{headers,status});
  if(req.method==='OPTIONS')return reply({ok:true});if(req.method!=='POST')return reply({error:'POST required'},405);
  let service,uploaded=false,committed=false,path;
  try{
   if(Number(req.headers.get('content-length')||0)>1700000)throw Object.assign(new Error('이미지가 너무 큽니다.'),{status:413});
   const reader=req.body?.getReader(),parts=[];let size=0;
   if(!reader)throw Error('body');while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>1700000){await reader.cancel();throw Object.assign(new Error('이미지가 너무 큽니다.'),{status:413});}parts.push(value);}
   const body=JSON.parse(await new Blob(parts).text());const connection=clients(req.headers.get('authorization')||'');service=connection.service;
   if(body.action==='health'){
    health||=(async()=>{const bytes=PNG.sync.write(new PNG({width:512,height:512}),{colorType:6,bitDepth:8});await normalizePng(new Uint8Array(bytes),PNG);return true;})();
    const {data,error}=await service.storage.getBucket(bucket);if(error||data.public!==false)throw Error('private bucket unavailable');
    return reply({ok:await health,version,private_storage:true});
   }
   const user=connection.user;const auth=await user.auth.getUser();if(auth.error||!auth.data?.user)throw Object.assign(new Error('로그인이 필요합니다.'),{status:401});const uid=auth.data.user.id;
   const rpc=async(action,extra={})=>{const {data,error}=await user.rpc('wakppu_api',{b:{action,...extra}});if(error)throw error;return data;};
   let state=await rpc('custom_status');
   if(body.action==='save'){
    if(state.plan==='none')throw Object.assign(new Error('커스텀 이용권이 필요합니다.'),{status:403});
    const b={mode:body.mode,target:body.target,effect:body.effect,sound:body.sound,revision:body.revision,request_id:body.request_id};
    if(!/^[0-9a-f]{8}-[0-9a-f-]{27}$/.test(b.request_id||''))throw Object.assign(new Error('저장 요청을 확인해주세요.'),{status:400});
    if(!['save','restore'].includes(b.mode)||!(b.target==='@all'&&state.plan==='all'||state.balls.includes(b.target)&&(state.plan==='all'||state.target===b.target)))throw Object.assign(new Error('이용권과 적용 대상 볼을 확인해주세요.'),{status:403});
    if(b.mode==='save'&&(!state.presets.includes(b.effect)||!state.presets.includes(b.sound)))throw Object.assign(new Error('보유한 연출과 사운드만 선택할 수 있습니다.'),{status:403});
    await rpc('custom_prepare',b);
    if(body.image!==undefined){
     if(b.mode!=='save'||typeof body.image!=='string'||!/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(body.image))throw Object.assign(new Error('PNG 이미지 형식을 확인해주세요.'),{status:400});
     const bytes=Uint8Array.from(atob(body.image.slice(22)),c=>c.charCodeAt(0)),png=await normalizePng(bytes,PNG);
     path=uid+'/'+b.request_id+'.png';const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',png)),v=>v.toString(16).padStart(2,'0')).join('');
     Object.assign(b,{new_image:true,path,sha256:hash,bytes:png.length});
     const {error}=await service.storage.from(bucket).upload(path,png,{contentType:'image/png',cacheControl:'900',upsert:false});
     if(error&&Number(error.statusCode)!==409&&error.error!=='Duplicate')throw error;uploaded=!error;
    }else if(b.mode==='save')b.asset_id=body.asset_id;
    const {data,error}=await service.rpc('wakppu_custom_commit',{u:uid,b});if(error)throw error;state=data;committed=true;
   }else if(body.action!=='status')throw Object.assign(new Error('지원하지 않는 요청입니다.'),{status:400});
   const paths=await rpc('custom_image_paths'),urls={};
   if(paths.length){const signed=await service.storage.from(bucket).createSignedUrls(paths.map(p=>p.path),900);if(signed.error)throw signed.error;for(let i=0;i<paths.length;i++){if(!signed.data[i]?.signedUrl)throw Error('image URL');urls[paths[i].id]=signed.data[i].signedUrl;}}
   // A durable private queue also covers account deletion and failed previous removals.
   try{const q=await service.rpc('wakppu_custom_gc_batch',{});if(!q.error&&q.data?.length){const removed=await service.storage.from(bucket).remove(q.data);if(!removed.error)await service.rpc('wakppu_custom_gc_batch',{paths:q.data});}}catch{/* Retry on the next authenticated request. */}
   return reply({state,urls,version});
  }catch(e){
   if(uploaded&&!committed&&path)try{await service.storage.from(bucket).remove([path]);}catch{}
   const status=/^PT\d{3}$/.test(e.code||'')?Number(e.code.slice(2)):e.status||400;
   return reply({error:e.code&&!/^PT/.test(e.code)?'설정을 저장하지 못했습니다. 다시 시도해주세요.':e.message||'요청을 처리하지 못했습니다.',code:e.code},status);
  }
 };
}
