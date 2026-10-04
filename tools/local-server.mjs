import http from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomBytes} from 'node:crypto';
import {createStore,execute} from './admin-service.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../wakppuball');
const store=createStore(),sessions=new Map();
const password=randomBytes(9).toString('base64url');
const port=Number(process.env.WAKPPU_LOCAL_PORT||4173);
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.wav':'audio/wav','.mp3':'audio/mpeg'};
const server=http.createServer(async(req,res)=>{
  const send=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
  try {
    if(req.method==='POST'&&req.url.startsWith('/local/')) {
      if(req.headers.origin&&req.headers.origin!==`http://localhost:${port}`&&req.headers.origin!==`http://127.0.0.1:${port}`) return send(403,{error:'origin not allowed'});
      let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>20000)return send(413,{error:'request too large'});}const body=JSON.parse(raw);
      if(req.url==='/local/login') {
        const admin=body.email==='dodoonglee@gmail.com';if(admin&&body.password!==password)return send(401,{error:'로컬 테스트 비밀번호가 틀립니다.'});
        const token=randomBytes(24).toString('hex');const actor=store.players[admin?0:1];sessions.set(token,actor);return send(200,{token,user:{id:actor.id,email:admin?actor.email:null,is_anonymous:!admin}});
      }
      const actor=sessions.get(req.headers.authorization?.replace(/^Bearer /,''));
      return send(200,execute(store,actor,body));
    }
    const url=new URL(req.url,'http://localhost');let name=decodeURIComponent(url.pathname);
    if(name==='/'||name==='/wakppuball/')name='/index.html';name=name.replace(/^\/wakppuball\//,'/');
    const file=path.resolve(root,'.'+name);if(!file.startsWith(root+path.sep))return send(403,{error:'forbidden'});
    let data=await readFile(file);
    if(name==='/index.html') data=Buffer.from(data.toString().replace(/<script src="js\/account.js[^\"]*"><\/script>/,'<script src="js/local-account.js"></script>'));
    res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(data);
  }catch(e){send(e.status|| (e.code==='ENOENT'?404:400),{error:e.message});}
});
server.listen(port,'127.0.0.1',()=>{console.log(`Local preview: http://127.0.0.1:${port}\nAdmin: dodoonglee@gmail.com\nLocal test password: ${password}\nProduction data is not connected. Sample data resets when this server restarts.`);});
