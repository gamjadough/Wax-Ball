// Fresh production schema in an isolated in-memory database.
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
const require=createRequire(process.env.WAKPPU_TEST_NODE_PACKAGE||new URL('./test-results/tester-runtime/package.json',import.meta.url));
const {PGlite}=require('@electric-sql/pglite');
const {pgcrypto}=require('@electric-sql/pglite/contrib/pgcrypto');
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
export async function publicFixture({launch=true}={}){
 const db=new PGlite({extensions:{pgcrypto}});
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
 create schema auth;create schema extensions;create schema cron;
 create table auth.users(id uuid primary key,aud text,role text,is_anonymous boolean default false,email text,email_change text default '',email_confirmed_at timestamptz,created_at timestamptz default now(),updated_at timestamptz default now(),raw_user_meta_data jsonb default '{}');
 create table auth.sessions(id uuid primary key,user_id uuid references auth.users);
 create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;
 create function auth.uid() returns uuid language sql stable as $$select (auth.jwt()->>'sub')::uuid$$;
 create table cron.job(jobname text,active boolean default true);
 create function cron.schedule(text,text,text) returns bigint language sql as $$select 1::bigint$$;`);
 await db.exec(await read('supabase/public-server/migrations/20261118121025_public_server_baseline.sql'));
 await db.exec(await read('supabase/public-server/public-policy.sql'));
 if(launch)await db.exec(await read('supabase/public-server/migrations/20261122102300_public_launch_december.sql'));
 await db.exec(await read('supabase/migrations/20261124091334_expand_blue_gem_ball_catalog.sql'));
 async function rpc(u,b,anonymous=false){await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify(u?{sub:u,role:'authenticated',is_anonymous:anonymous}:{})]);return(await db.query('select public.wakppu_api($1::jsonb) r',[JSON.stringify(b)])).rows[0].r;}
 return {db,rpc};
}
