// Real profile and payment migrations in an isolated PGlite bank fixture.
import {readFile} from 'node:fs/promises';
export const supporterProfileMigration=new URL('../supabase/migrations/20261025052652_supporter_profile_cards.sql',import.meta.url);
export async function installSupporterProfiles(db,{cards=true}={}){
 await db.exec(`alter table players add column ranking_hidden boolean default false;
  alter table game_states add column discovered_ball_ids jsonb default '["yellow"]',add column unlocked_ball_ids jsonb default '["yellow"]',add column selected_ball_id text default 'yellow',add column hammer_level integer default 0;
  create table wakppu_item_balls(ball_id text primary key);insert into wakppu_item_balls values('yellow');
  create table moderation_cases(user_id uuid primary key,status text,suspended_until timestamptz);
  create function wakppu_guest_accounts() returns table(id uuid,eligible boolean,hide_at timestamptz) language sql stable as $$select null::uuid,false,now() where false$$;
  create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;
  create function wakppu_admin_content_access() returns boolean language sql stable security definer set search_path=public,pg_temp as $$select exists(select 1 from players p join auth.users a on a.id=p.user_id where p.user_id=auth.uid() and p.role='admin' and not a.is_anonymous) and not coalesce((auth.jwt()->>'is_anonymous')::boolean,false)$$;
  revoke all on function wakppu_admin_content_access() from public,anon,authenticated;`);
 for(const name of ['20261023100846_player_profiles.sql','20261023102333_profile_inventory_titles.sql','20261024042843_champion_profile_card.sql'])await db.exec(await readFile(new URL('../supabase/migrations/'+name,import.meta.url),'utf8'));
 if(cards)await db.exec(await readFile(supporterProfileMigration,'utf8'));
}
