// Real image handler + PostgreSQL migration, with an in-memory private Storage adapter.
import {createRequire} from 'node:module';
import {createHandler} from '../supabase/functions/custom-ball-image/handler.mjs';
const require=createRequire(new URL('./test-results/custom-image-runtime/package.json',import.meta.url));
export const {PNG}=require('pngjs');
export function imageFixture(db,rpc){
 const files=new Map();
 const storage={getBucket:async()=>({data:{public:false}}),from:()=>({
  upload:async(path,bytes)=>{if(files.has(path))return {error:{statusCode:409}};files.set(path,new Uint8Array(bytes));return {data:{path}};},
  remove:async paths=>{paths.forEach(p=>files.delete(p));return {data:[]};},
  createSignedUrls:async paths=>({data:paths.map(path=>({path,signedUrl:files.has(path)?'data:image/png;base64,'+Buffer.from(files.get(path)).toString('base64'):null}))})
 })};
 const service={storage,rpc:async(name,args)=>{try{
  await db.exec("select set_config('test.uid','',false);select set_config('request.jwt.claims','{\"role\":\"service_role\"}',false)");
  const r=name==='wakppu_custom_commit'?await db.query('select wakppu_custom_commit($1,$2) data',[args.u,JSON.stringify(args.b)]):await db.query('select wakppu_custom_gc_batch($1::text[]) data',[args.paths??null]);return {data:r.rows[0].data};
 }catch(error){return {error};}}};
 function handler(user){return createHandler({PNG,clients:()=>({service,user:{auth:{getUser:async()=>user?{data:{user:{id:user}}}:{error:{message:'no user'}}},rpc:async(name,{b})=>{try{return {data:await rpc(user,b)};}catch(error){return {error};}}}})});}
 return {files,handle:(user,body)=>handler(user)(new Request('http://localhost/custom-image',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}))};
}
