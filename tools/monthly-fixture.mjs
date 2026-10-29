// Complete game hit pipeline plus real profile migrations, isolated in PGlite.
import {readFile} from 'node:fs/promises';import {createRequire} from 'node:module';
const require=createRequire(process.env.WAKPPU_TEST_NODE_PACKAGE||new URL('./test-results/sql-check/package.json',import.meta.url));const {PGlite}=require('@electric-sql/pglite');
export const admin='00000000-0000-0000-0000-000000000001',player='00000000-0000-0000-0000-000000000002';
const sql=n=>readFile(new URL('../supabase/migrations/'+n,import.meta.url),'utf8');
export async function monthlyFixture(){const db=new PGlite();
  const fixture=await readFile(new URL('./items-sql.test.mjs',import.meta.url),'utf8');await db.exec(fixture.match(/await db\.exec\(`([\s\S]*?)`\);/)[1].replaceAll('${admin}',admin).replaceAll('${player}',player));
  for(const n of ['20261004_accounts_and_rankings.sql','20261004_admin_exact_gold.sql','20261005_ranking_visibility_bans.sql','20261005_z_gold_event.sql','20261006_rebirth_100_big_gold.sql','20261007_hammer_level_30.sql'])await db.exec(await sql(n));
  await db.exec("create or replace function public.wakppu_api(b jsonb) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$begin if b->>'action'='mark_first_play' then return '{}'::jsonb;end if;return public.wakppu_api_before_events(b);end$$;");
  for(const n of ['20261007_admin_ball_event.sql','20261006_z_whitehole.sql','20261009_transcendent_balls.sql','20261008_gem_coating.sql','20261012_items_inventory.sql','20261015_items_30.sql','20261016_halloween_reward.sql','20261017_halloween_admin_access.sql','20261019_items_remake.sql','20261016083414_admin_content_access.sql','20261016090507_hammer_level_selection.sql','20261016091945_hammer_level_zero.sql'])await db.exec(await sql(n));
  await db.exec(`create table auth.users(id uuid primary key,is_anonymous boolean default false,email text,email_confirmed_at timestamptz,created_at timestamptz default now(),raw_user_meta_data jsonb default '{}');`);
  for(const n of ['20261019084353_manual_bank_orders.sql','20261020010000_supporter_gold_bonus.sql','20261020010100_supporter_gold_paths.sql','20261020085313_input_guard.sql','20261022081610_multi_position_input_guard.sql','20261022093644_halloween_decoration_box.sql','20261022095516_halloween_decor_admin_access.sql','20261022102841_halloween_pet_traits.sql','20261025054917_blue_gems.sql','20261025061053_ember_auto_attack.sql'])await db.exec(await sql(n));

 await db.exec(`create function wakppu_guest_accounts() returns table(id uuid,eligible boolean,hide_at timestamptz) language sql stable as $$select null::uuid,false,now() where false$$;
 create schema cron;create function cron.schedule(text,text,text) returns bigint language sql as $$select 1::bigint$$;`);
 for(const n of ['20261020100009_premium_supporter_pack.sql','20261016_rankings_presence.sql','20261014_sleep_hours.sql','20261023100846_player_profiles.sql','20261023102333_profile_inventory_titles.sql','20261024042843_champion_profile_card.sql','20261025052652_supporter_profile_cards.sql','20261025061222_champion_title.sql','20261029074416_monthly_click_rankings.sql','20261029080223_monthly_card_art.sql','20261029074522_blue_crystal_ball.sql'])await db.exec(await sql(n));
 async function rpc(u,b){await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify(u?{sub:u,is_anonymous:false}:{})]);return (await db.query('select wakppu_api($1::jsonb) r',[JSON.stringify(b)])).rows[0].r;}
 async function clock(iso){await db.exec("create or replace function wakppu_monthly_now() returns timestamptz language sql volatile set search_path=public,pg_temp as $$select '"+new Date(iso).toISOString()+"'::timestamptz$$;");}
 await clock('2026-10-29T03:00:00Z');return {db,rpc,clock};}
