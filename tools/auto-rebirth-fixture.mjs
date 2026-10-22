import {readFile} from 'node:fs/promises';
export const autoMigration=new URL('../supabase/migrations/20261022083921_auto_rebirth.sql',import.meta.url);
export async function installAutoRebirth(db){
 // The bank fixture stubs legacy gameplay; model its save contract here. Production
 // rollback checks exercise the real legacy save chain, not this adapter.
 await db.exec(`alter table game_states add column if not exists unlocked_ball_ids jsonb default '["yellow"]',add column if not exists selected_ball_id text default 'yellow',add column if not exists discovered_ball_ids jsonb default '["yellow"]',add column if not exists honey_expires_at timestamptz,add column if not exists coating_expires_at timestamptz,add column if not exists hammer_owned boolean default false,add column if not exists hammer_level integer default 0,add column if not exists hammer_selected_level integer,add column if not exists admin_revision integer default 0,add column if not exists current_clicks integer default 0;
 alter table wakppu_limited_players add column if not exists selected text,add column if not exists clicks bigint default 0;
 alter function wakppu_api(jsonb) rename to fixture_api_before_rebirth_save;
 revoke all on function fixture_api_before_rebirth_save(jsonb) from public,anon,authenticated;
 create function wakppu_api(b jsonb) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$begin
  if b->>'action'='save_progress' then
   perform fixture_api_before_rebirth_save('{"action":"bootstrap"}');
   update game_states set gold=(b->>'gold')::numeric,rebirths=(b->>'rebirths')::integer,unlocked_ball_ids=b->'unlocked_ball_ids',selected_ball_id=b->>'selected_ball_id',current_clicks=(b->>'current_clicks')::integer,honey_expires_at=(b->>'honey_expires_at')::timestamptz,coating_expires_at=(b->>'coating_expires_at')::timestamptz where user_id=auth.uid();
   update wakppu_items set effects='{}' where user_id=auth.uid();return '{}'::jsonb;
  end if;return fixture_api_before_rebirth_save(b);end$$;`);
 await db.exec(await readFile(autoMigration,'utf8'));
}
