// Loopback-only integration server with the real public schema and RPC.
import http from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomUUID,randomBytes} from 'node:crypto';
import {publicFixture} from './public-server-fixture.mjs';
import {friendsGateFixture} from './friends-gate-fixture.mjs';
const root=path.resolve(fileURLToPath(new URL('../',import.meta.url))),port=Number(process.env.WAKPPU_ADMIN_TEST_PORT||4198);
const admin='10000100-0000-0000-0000-000000000101',player='20000200-0000-0000-0000-000000000102';
const fixtures={public:await publicFixture(),friends:await friendsGateFixture()},queues={};
for(const [id,{db}]of Object.entries(fixtures)){
 await db.query("insert into auth.users(id,email,email_confirmed_at) values($1,'admin@fixture.test',now()),($2,'player@fixture.test',now())",[admin,player]);
 await db.query("update players set role='admin',nickname='테스트관리자' where user_id=$1",[admin]);
 await db.query("update players set nickname='관리대상' where user_id=$1",[player]);
 await db.query("update game_states set gold=$1,progress_imported_at=now() where user_id=$2",[id==='public'?'100':'200',player]);
}
const tokens=new Map(),user=id=>({id,aud:'authenticated',role:'authenticated',email:id===admin?'admin@fixture.test':'player@fixture.test',email_confirmed_at:new Date().toISOString(),created_at:new Date().toISOString(),app_metadata:{provider:'email'},user_metadata:{},is_anonymous:false});
http.createServer(async(req,res)=>{
 const send=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json','Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'*','Access-Control-Allow-Methods':'POST,GET,OPTIONS','Cache-Control':'no-store'});res.end(data===undefined?'':JSON.stringify(data));};
 if(req.method==='OPTIONS')return send(204);
 const url=new URL(req.url,'http://127.0.0.1'),match=url.pathname.match(/^\/(public|friends)\/(.*)$/);
 try{
 if(match){
  const [,realm,route]=match,f=fixtures[realm];let body={};
  if(req.method==='POST'){let bytes='';for await(const part of req)bytes+=part;if(bytes.length>100000)throw Error('oversize');body=JSON.parse(bytes||'{}');}
  const token=req.headers.authorization?.replace(/^Bearer /,''),session=tokens.get(token);
  if(route==='auth/v1/token'){
   const uid=body.email==='admin@fixture.test'?admin:body.email==='player@fixture.test'?player:null;
   if(!uid||body.password!=='fixture-only-password')return send(400,{error:'invalid_credentials',error_description:'로그인 실패'});
   const exp=Math.floor(Date.now()/1000)+3600,payload={sub:uid,role:'authenticated',aud:'authenticated',email:user(uid).email,is_anonymous:false,exp,iat:exp-3600,session_id:randomUUID()};
   const access_token=Buffer.from('{"alg":"HS256","typ":"JWT"}').toString('base64url')+'.'+Buffer.from(JSON.stringify(payload)).toString('base64url')+'.'+randomBytes(32).toString('base64url');
   tokens.set(access_token,{realm,uid});return send(200,{access_token,refresh_token:randomBytes(24).toString('hex'),expires_in:3600,token_type:'bearer',user:user(uid)});
  }
  if(route==='auth/v1/user')return session?.realm===realm?send(200,user(session.uid)):send(401,{message:'invalid session'});
  if(route==='auth/v1/logout'){tokens.delete(token);return send(204);}
  if(route==='rest/v1/rpc/wakppu_friend_access')return send(200,await f.access(body.b,{'x-wakppu-access':req.headers['x-wakppu-access']||''}));
  if(route==='rest/v1/rpc/wakppu_api'){
   const uid=session?.realm===realm?session.uid:null,task=(queues[realm]||Promise.resolve()).then(()=>f.rpc(uid,body.b,false,{'x-wakppu-access':req.headers['x-wakppu-access']||''}));queues[realm]=task.catch(()=>{});
   try{return send(200,await task);}catch(e){return send(/^PT\d{3}$/.test(e.code)?Number(e.code.slice(2)):400,{message:e.message,code:e.code,hint:e.hint});}
  }
  if(route==='fixture/revoke'){await f.db.query("update players set role='player' where user_id=$1",[admin]);return send(200,{ok:true});}
  if(route==='fixture/restore'){await f.db.query("update players set role='admin' where user_id=$1",[admin]);return send(200,{ok:true});}
  if(route==='fixture/expire'){await f.db.exec("update wakppu_friend_gate_sessions set expires_at=now()-interval '1 second'");return send(200,{ok:true});}
  return send(404,{error:'not found'});
 }
 let name=decodeURIComponent(url.pathname);if(name.endsWith('/'))name+='index.html';
 const file=path.resolve(root,'.'+name);if(!file.startsWith(root+path.sep))return send(403,{error:'forbidden'});
 let data=await readFile(file);
 if(name==='/wakppuball/js/server-config.js')data=Buffer.from(data.toString()+"\nWAKPPU_SERVER.url='http://localhost:"+port+"/friends';WAKPPU_SERVER.anonKey='fixture-browser-key';");
 if(name==='/wakppuball-admin/config.js')data=Buffer.from(data.toString()+"\nWAKPPU_SERVER.url='http://'+(WAKPPU_SERVER.id==='friends'?'localhost':'127.0.0.1')+':"+port+"/'+WAKPPU_SERVER.id;WAKPPU_SERVER.anonKey='fixture-browser-key';");
 const type={'.html':'text/html','.js':'application/javascript','.css':'text/css','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml'}[path.extname(file)]||'application/octet-stream';
 res.writeHead(200,{'Content-Type':type,'Cache-Control':'no-store'});res.end(data);
 }catch(e){send(e.code==='ENOENT'?404:400,{message:e.message});}
}).listen(port,'127.0.0.1',()=>console.log('Admin fixture: http://127.0.0.1:'+port+'/wakppuball-admin/'));
