import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
const require=createRequire(process.env.WAKPPU_SQL_DEPS||new URL('./test-results/sql-check/package.json',import.meta.url));
const {PGlite}=require('@electric-sql/pglite');
test('background migration: permissions, allowed modes, public status, persistence and audit',async()=>{
  const db=new PGlite();
  try {
    await db.exec(`create role anon;create role authenticated;create schema auth;
      create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
      create function auth.uid() returns uuid language sql stable as $$ select (auth.jwt()->>'sub')::uuid $$;
      create table players(user_id uuid primary key,role text);
      insert into players values('00000000-0000-0000-0000-000000000001','admin'),('00000000-0000-0000-0000-000000000002','player');
      create table server_settings(id boolean primary key);insert into server_settings values(true);
      create table admin_audit_logs(admin_user_id uuid,action text,reason text,details jsonb);
      create function wakppu_api(jsonb) returns jsonb language sql as $$select '{"maintenance":false,"gold_event":null,"baseline":true}'::jsonb$$;`);
    const migration=await readFile(new URL('../supabase/migrations/20261017_admin_background.sql',import.meta.url),'utf8');
    await db.exec(migration);await db.exec(migration);
    async function rpc(user,body,anonymous=false){
      await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify(user?{sub:'00000000-0000-0000-0000-00000000000'+user,is_anonymous:anonymous}:{})]);
      return (await db.query('select wakppu_api($1::jsonb) as data',[JSON.stringify(body)])).rows[0].data;
    }
    assert.equal((await rpc(null,{action:'status'})).background_mode,'auto');
    await assert.rejects(rpc(null,{action:'admin_background',mode:'halloween'}),{code:'PT401'});
    await assert.rejects(rpc(2,{action:'admin_background',mode:'halloween'}),{code:'PT403'});
    await assert.rejects(rpc(1,{action:'admin_background',mode:'halloween'},true),{code:'PT403'});
    for(const mode of [null,'','fake'])await assert.rejects(rpc(1,{action:'admin_background',mode}),{code:'PT400'});
    for(const mode of ['halloween','default','auto']){
      assert.equal((await rpc(1,{action:'admin_background',mode})).background_mode,mode);
      const status=await rpc(null,{action:'status'});assert.equal(status.background_mode,mode);assert.equal(status.baseline,true);assert.ok(status.server_time);
    }
    assert.equal((await db.query('select count(*)::int n from admin_audit_logs')).rows[0].n,3);
    assert.equal((await db.query("select has_function_privilege('authenticated','wakppu_api_before_background(jsonb)','execute') allowed")).rows[0].allowed,false);
  }finally{await db.close();}
});
