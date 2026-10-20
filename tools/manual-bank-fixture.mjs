// Real purchase SQL in isolated PGlite for tests and the explicit loopback preview.
import {createRequire} from 'node:module';
import {existsSync} from 'node:fs';
import {readFile} from 'node:fs/promises';
const pkg=new URL('./test-results/sql-check/package.json',import.meta.url);
const require=createRequire(existsSync(pkg)?pkg:new URL('../../sql-check/package.json',import.meta.url));
const {PGlite}=require('@electric-sql/pglite');
export const bankMigration=new URL('../supabase/migrations/20261019084353_manual_bank_orders.sql',import.meta.url);
export const premiumMigration=new URL('../supabase/migrations/20261020100009_premium_supporter_pack.sql',import.meta.url);
export const adminPaidMigration=new URL('../supabase/migrations/20261020124915_admin_paid_grants.sql',import.meta.url);
export async function bankFixture({premium=true,gifts=true}={}){
 const db=new PGlite();
 await db.exec(`create role anon;create role authenticated;create schema auth;
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
 create table auth.users(id uuid primary key,is_anonymous boolean default false,email text,email_confirmed_at timestamptz);
 create table players(user_id uuid primary key,nickname text unique,role text default 'player',banned boolean default false);
 create table test_settings(maintenance boolean);insert into test_settings values(false);
 create table game_states(user_id uuid primary key,gold numeric default 12345,rebirths integer default 7,item_revision bigint default 0);
 create table wakppu_items(user_id uuid primary key references players,inventory jsonb default '{}',effects jsonb default '{}',pity integer default 0,total bigint default 0);
 create table admin_audit_logs(id bigint generated always as identity primary key,admin_user_id uuid,target_user_id uuid,action text,reason text,details jsonb,created_at timestamptz default now());
 create function public.wakppu_api(b jsonb) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$begin
  if b->>'action'='rankings' then return (select jsonb_agg(jsonb_build_object('nickname',nickname,'gold','12345','rebirths',7)) from players);end if;
  if auth.uid() is null then raise sqlstate 'PT401';end if;
  if (select banned from players where user_id=auth.uid()) then raise sqlstate 'PT403';end if;
  if (select maintenance from test_settings) and (select role from players where user_id=auth.uid())<>'admin' then raise sqlstate 'PT503';end if;
  return '{}'::jsonb;end$$;`);
 const sql=await readFile(bankMigration,'utf8');await db.exec(sql);await db.exec(await readFile(new URL('../supabase/migrations/20261020010000_supporter_gold_bonus.sql',import.meta.url),'utf8'));
 await db.exec(await readFile(new URL('../supabase/migrations/20261020110000_first_steps_pack.sql',import.meta.url),'utf8'));
 if(premium)await db.exec(await readFile(premiumMigration,'utf8'));
 if(premium&&gifts)await db.exec(await readFile(adminPaidMigration,'utf8'));
 async function add(id,role='player',anonymous=false){
  await db.query('insert into auth.users values($1,$2,$3,case when $2 then null else now() end) on conflict(id) do update set is_anonymous=$2,email=$3,email_confirmed_at=excluded.email_confirmed_at',[id,anonymous,id+'@local.test']);
  await db.query('insert into players values($1,$2,$3,false) on conflict(user_id) do update set role=$3',[id,'유저'+id.slice(-2),role]);
  await db.query('insert into game_states(user_id) values($1) on conflict do nothing',[id]);
 }
 async function rpc(user,b){await db.query("select set_config('test.uid',$1,false)",[user||'']);return (await db.query('select public.wakppu_api($1::jsonb) as data',[JSON.stringify(b)])).rows[0].data;}
 return {db,sql,add,rpc};
}
