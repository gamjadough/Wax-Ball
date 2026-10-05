import http from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomBytes,scryptSync,timingSafeEqual} from 'node:crypto';
import {createStore,execute} from './admin-service.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../wakppuball');
const store=createStore(),sessions=new Map();
const password=randomBytes(9).toString('base64url');
const passwordSalt=randomBytes(16);
const localUser=actor=>({id:actor.id,email:actor.email||null,is_anonymous:actor.role!=='admin'&&!actor.localAuth?.verified,
  email_confirmed_at:actor.localAuth?.verified||null,user_metadata:{wakppu_email_link_pending:!!actor.localAuth?.pending}});
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
        const actor=admin?store.players[0]:body.email==='guest'?store.players[1]:store.players.find(p=>p.localAuth?.verified&&p.email===body.email);
        if(!actor||(!admin&&body.email!=='guest'&&(!actor.localAuth?.passwordHash||!timingSafeEqual(actor.localAuth.passwordHash,scryptSync(String(body.password),passwordSalt,32)))))return send(401,{error:'이메일 또는 비밀번호가 틀립니다.'});
        if(body.email==='guest'&&!actor.lifecycle)actor.lifecycle={created_at:new Date().toISOString(),first_play_at:null};
        const token=randomBytes(24).toString('hex');sessions.set(token,actor);return send(200,{token,user:localUser(actor)});
      }
      const actor=sessions.get(req.headers.authorization?.replace(/^Bearer /,''));
      if(req.url==='/local/email-link'||req.url==='/local/verify-email'||req.url==='/local/complete-email-link'){
        if(!actor)return send(401,{error:'로그인이 필요합니다.'});
        if(req.url==='/local/email-link'){
          if(!localUser(actor).is_anonymous)return send(400,{error:'빠른 시작 계정에서 연결해주세요.'});
          if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email))return send(400,{error:'올바른 이메일 주소를 입력하세요.'});
          if(store.players.some(p=>p.email===body.email&&p.id!==actor.id))return send(409,{error:'이미 사용 중인 이메일입니다.'});
          actor.localAuth={email:body.email,pending:true,verified:null};
        }else if(req.url==='/local/verify-email'){
          if(!actor.localAuth?.pending)return send(400,{error:'이메일 연결을 먼저 시작해주세요.'});
          actor.email=actor.localAuth.email;actor.localAuth.verified=new Date().toISOString();
        }else{
          if(!actor.localAuth?.verified||!actor.localAuth?.pending)return send(400,{error:'이메일 인증을 먼저 완료해주세요.'});
          if(String(body.password||'').length<6)return send(400,{error:'비밀번호는 6자 이상입니다.'});
          actor.localAuth.passwordHash=scryptSync(body.password,passwordSalt,32);actor.localAuth.pending=false;
        }
        return send(200,{user:localUser(actor)});
      }
      return send(200,execute(store,actor,body));
    }
    const url=new URL(req.url,'http://localhost');let name=decodeURIComponent(url.pathname);
    if(name==='/'||name==='/wakppuball/')name='/index.html';name=name.replace(/^\/wakppuball\//,'/');
    const file=path.resolve(root,'.'+name);if(!file.startsWith(root+path.sep))return send(403,{error:'forbidden'});
    let data=await readFile(file);
    if(name==='/index.html') data=Buffer.from(data.toString().replace(/<script src="js\/account.js[^\"]*"><\/script>/,'<script src="js/local-account.js"></script>'));
    if(name==='/index.html'&&url.searchParams.get('preview')==='whitehole')data=Buffer.from(data.toString().replace('</body>','<script src="js/local-whitehole-preview.js"></script></body>'));
    if(name==='/index.html'&&url.searchParams.get('preview')==='adminball')data=Buffer.from(data.toString().replace('</body>',`<script src="js/local-admin-ball-preview.js"></script><script>WakppuLocalAdminBallPreview(${JSON.stringify(password)});</script></body>`));
    res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(data);
  }catch(e){send(e.status|| (e.code==='ENOENT'?404:400),{error:e.message});}
});
server.listen(port,'127.0.0.1',()=>{console.log(`Local preview: http://127.0.0.1:${port}\nAdmin: dodoonglee@gmail.com\nLocal test password: ${password}\nProduction data is not connected. Sample data resets when this server restarts.`);});
