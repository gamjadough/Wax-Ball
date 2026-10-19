import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import net from 'node:net';
import {once} from 'node:events';
import {fileURLToPath} from 'node:url';
async function server(enabled,fn){
 const socket=net.createServer();socket.listen(0,'127.0.0.1');await once(socket,'listening');const port=socket.address().port;await new Promise(resolve=>socket.close(resolve));
 const child=spawn(process.execPath,[fileURLToPath(new URL('./local-server.mjs',import.meta.url))],{env:{...process.env,WAKPPU_LOCAL_PORT:String(port),WAKPPU_LOCAL_PAYMENTS:enabled?'1':'0',WAKPPU_LOCAL_SLEEP_TIME:'2026-10-19T12:00:00+09:00'},stdio:['ignore','pipe','pipe']});
 try{
  await new Promise((resolve,reject)=>{let output='';const timer=setTimeout(()=>reject(new Error('Local server startup timed out')),10000);child.stdout.on('data',chunk=>{output+=chunk;if(output.includes('Local preview:')){clearTimeout(timer);resolve();}});child.once('error',reject);child.once('exit',code=>{clearTimeout(timer);reject(new Error('Local server exited: '+code));});});
  await fn('http://127.0.0.1:'+port);
 }finally{const ended=once(child,'exit');child.kill();await ended;}
}
test('mock payment endpoints are disabled by default and isolate local game pages',()=>server(false,async base=>{
 assert.equal((await fetch(base+'/local/payments',{method:'POST',body:'{}'})).status,404);
 assert.equal((await fetch(base+'/local/payments-demo-link',{method:'POST',body:'{}'})).status,404);
 assert.equal((await fetch(base+'/local-payments/checkout.html')).status,404);
 assert.doesNotMatch(await(await fetch(base+'/?preview=payments')).text(),/local-payments\/store\.js/);
}));
test('HTTP sessions, origin, server prices and recoverable delivery are enforced',()=>server(true,async base=>{
 const post=(path,body,token,origin=base)=>fetch(base+path,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify(body)});
 assert.equal((await post('/local/payments',{action:'catalog'})).status,401);
 const {token}=await(await post('/local/login',{email:'guest',password:''})).json();
 const order={action:'order',product_id:'supporter_pack',request_id:'test_http_request_1'};
 assert.equal((await post('/local/payments',order,token)).status,403);
 assert.equal((await post('/local/payments-demo-link',{},token,'https://untrusted.example')).status,403);
 assert.equal((await post('/local/payments-demo-link',{},token)).status,200);
 assert.equal((await post('/local/payments',{...order,amount:1},token)).status,400);
 const {order:o}=await(await post('/local/payments',order,token)).json();assert.equal(o.amount,1100);
 assert.equal((await post('/local/payments',{action:'fulfill',order_id:o.id},token)).status,409);
 await post('/local/payments',{action:'authorize',order_id:o.id,outcome:'success'},token);
 const data=await(await post('/local/payments',{action:'fulfill',order_id:o.id},token)).json();assert.equal(data.owned.supporter_pack,o.id);
 assert.equal((await post('/local/payments',{action:'catalog'},'forged-token')).status,401);
 assert.match(await(await fetch(base+'/?preview=payments')).text(),/local-payments\/store\.js/);
 assert.doesNotMatch(await(await fetch(base+'/')).text(),/local-payments\/store\.js/);
}));
