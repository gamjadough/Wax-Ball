// Isolated real-crypto friends gate for regression tests and loopback previews.
import {readFile} from 'node:fs/promises';
import {publicFixture} from './public-server-fixture.mjs';
export async function friendsGateFixture(){
 const {db,rpc}=await publicFixture({launch:false});
 await db.exec('grant usage on schema auth to authenticated,anon;');
 await db.exec('create extension pgcrypto with schema extensions;');
 await db.exec(await readFile(new URL('../supabase/migrations/20261122100618_friends_entry_gate.sql',import.meta.url),'utf8'));
 await db.query("update wakppu_friend_gate_config set enabled=true,password_hash=extensions.crypt($1,extensions.gen_salt('bf',4))",['fixture-entry-only']);
 await db.exec(await readFile(new URL('../supabase/migrations/20261122102259_remember_friends_players.sql',import.meta.url),'utf8'));
 await db.exec(await readFile(new URL('../supabase/migrations/20261122110326_friends_paid_shop_closed.sql',import.meta.url),'utf8'));
 async function access(body,headers={},user=null){
  await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify(user?{sub:user,role:'authenticated'}:{})]);
  await db.query("select set_config('request.headers',$1,false)",[JSON.stringify(headers)]);
  return(await db.query('select wakppu_friend_access($1::jsonb) r',[JSON.stringify(body)])).rows[0].r;
 }
 async function gatedRpc(user,body,anonymous=false,headers={}){
  await db.query("select set_config('request.headers',$1,false)",[JSON.stringify(headers)]);
  return rpc(user,body,anonymous);
 }
 return {db,rpc:gatedRpc,access};
}
