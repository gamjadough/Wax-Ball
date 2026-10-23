import {bankFixture} from './manual-bank-fixture.mjs';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
export const customMigration=new URL('../supabase/migrations/20261021131641_custom_ball_studio.sql',import.meta.url);
export const customPricesMigration=new URL('../supabase/migrations/20261023083506_custom_ball_prices.sql',import.meta.url);
export async function installCustom(db){
 const c=vm.createContext({window:{}});vm.runInContext(await readFile(new URL('../wakppuball/js/balls-data.js',import.meta.url),'utf8')+';window.ids=WAKPPU_BALLS.map(b=>b.id)',c);
 await db.exec(`create role service_role;create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(id uuid,bucket_id text);alter table storage.objects enable row level security;
 create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;
 create or replace function auth.uid() returns uuid language sql stable as $$select coalesce(nullif(current_setting('test.uid',true),''),auth.jwt()->>'sub')::uuid$$;
 create function wakppu_admin_content_access() returns boolean language sql stable as $$select exists(select 1 from players p join auth.users a on a.id=p.user_id where p.user_id=auth.uid() and p.role='admin' and not a.is_anonymous)$$;
 alter table game_states add column unlocked_ball_ids jsonb default '["yellow","green"]',add column selected_ball_id text default 'yellow';
 create table wakppu_item_balls(ball_id text primary key);create table wakppu_limited_players(user_id uuid primary key,owned jsonb default '{}');
 create table wakppu_skin_defs(skin_id text primary key);insert into wakppu_skin_defs values('eternity_transcendent'),('eternity_common');
 create table wakppu_pumpkin_skin_defs(skin_id text primary key);insert into wakppu_pumpkin_skin_defs values('pumpkin_ghost');
 create table wakppu_skins(user_id uuid primary key,owned jsonb default '{}');`);
 for(const id of c.window.ids)await db.query('insert into wakppu_item_balls values($1)',[id]);
 await db.exec(await readFile(customMigration,'utf8'));
 await db.exec(await readFile(customPricesMigration,'utf8'));
}
export async function customFixture(){const f=await bankFixture();await installCustom(f.db);return f;}
