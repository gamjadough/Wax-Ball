-- Fresh public server only. Never apply this baseline to the friends project.

-- Catalogs and schema only; no users, progress, orders or entitlements.

set search_path=public,extensions; set check_function_bodies=off;

create table public."admin_audit_logs" (
 "id" bigint generated always as identity not null,
 "admin_user_id" uuid not null,
 "target_user_id" uuid,
 "action" text not null,
 "reason" text,
 "details" jsonb default '{}'::jsonb not null,
 "created_at" timestamp with time zone default now() not null
);

create table public."click_events" (
 "id" bigint generated always as identity not null,
 "user_id" uuid not null,
 "ball_id" text not null,
 "received_at" timestamp with time zone default now() not null,
 "interval_ms" integer,
 "accepted" boolean not null,
 "reason" text
);

create table public."game_states" (
 "user_id" uuid not null,
 "gold" numeric default 0 not null,
 "rebirths" smallint default 0 not null,
 "unlocked_ball_ids" jsonb default '["yellow"]'::jsonb not null,
 "discovered_ball_ids" jsonb default '["yellow"]'::jsonb not null,
 "selected_ball_id" text default 'yellow'::text not null,
 "honey_expires_at" timestamp with time zone,
 "current_ball_id" text default 'yellow'::text not null,
 "current_clicks" integer default 0 not null,
 "updated_at" timestamp with time zone default now() not null,
 "hammer_owned" boolean default false not null,
 "hammer_level" integer default 0 not null,
 "progress_imported_at" timestamp with time zone,
 "admin_revision" integer default 0 not null,
 "coating_expires_at" timestamp with time zone,
 "item_revision" bigint default 0 not null,
 "item_current_clicks" bigint default 0 not null,
 "hammer_selected_level" integer,
 "supporter_gold_remainder" smallint default 0 not null
);

create table public."guest_lifecycle" (
 "user_id" uuid not null,
 "created_at" timestamp with time zone not null,
 "first_play_at" timestamp with time zone
);

create table public."moderation_cases" (
 "user_id" uuid not null,
 "status" text default 'active'::text not null,
 "suspicion_score" integer default 0 not null,
 "strikes" integer default 0 not null,
 "suspended_until" timestamp with time zone,
 "last_reason" text,
 "updated_at" timestamp with time zone default now() not null
);

create table public."player_presence" (
 "user_id" uuid not null,
 "last_seen_at" timestamp with time zone not null
);

create table public."players" (
 "user_id" uuid not null,
 "nickname" text not null,
 "role" text default 'player'::text not null,
 "created_at" timestamp with time zone default now() not null,
 "updated_at" timestamp with time zone default now() not null,
 "ranking_hidden" boolean default false not null
);

create table public."server_settings" (
 "id" boolean default true not null,
 "maintenance" boolean default false not null,
 "message" text default ''::text not null,
 "announcement" jsonb,
 "gold_event" jsonb,
 "admin_ball_event" jsonb,
 "background_mode" text default 'auto'::text not null,
 "manual_gold_event" jsonb,
 "manual_ball_event" jsonb
);

create table public."wakppu_auto_rebirth" (
 "user_id" uuid not null,
 "enabled" boolean default false not null
);

create table public."wakppu_ball_rewards" (
 "ball_id" text not null,
 "reward" numeric not null
);

create table public."wakppu_blue_gem_exclusions" (
 "ball_id" text not null
);

create table public."wakppu_blue_gem_products" (
 "level" integer not null,
 "price" numeric not null,
 "multiplier" numeric not null
);

create table public."wakppu_blue_gem_requests" (
 "user_id" uuid not null,
 "request_id" uuid not null,
 "level" integer not null,
 "response" jsonb not null
);

create table public."wakppu_blue_gems" (
 "user_id" uuid not null,
 "balance" numeric default 0 not null,
 "level" integer default 0 not null,
 "admin_level" integer default 0 not null,
 "revision" bigint default 0 not null
);

create table public."wakppu_custom_accounts" (
 "user_id" uuid not null,
 "revision" bigint default 0 not null,
 "last_save" timestamp with time zone,
 "upload_window" timestamp with time zone,
 "upload_count" integer default 0 not null
);

create table public."wakppu_custom_assets" (
 "id" uuid not null,
 "user_id" uuid not null,
 "path" text not null,
 "sha256" text not null,
 "bytes" integer not null,
 "created_at" timestamp with time zone default clock_timestamp() not null
);

create table public."wakppu_custom_gc" (
 "path" text not null,
 "created_at" timestamp with time zone default clock_timestamp() not null
);

create table public."wakppu_custom_profiles" (
 "user_id" uuid not null,
 "target" text not null,
 "asset_id" uuid,
 "effect" text,
 "sound" text,
 "disabled" boolean default false not null
);

create table public."wakppu_custom_requests" (
 "user_id" uuid not null,
 "request_id" uuid not null,
 "request" jsonb not null,
 "created_at" timestamp with time zone default clock_timestamp() not null
);

create table public."wakppu_developer_keepsakes" (
 "user_id" uuid not null,
 "granted_by" uuid not null,
 "request_id" uuid not null,
 "reason" text not null,
 "granted_at" timestamp with time zone default clock_timestamp() not null
);

create table public."wakppu_ember_hit_requests" (
 "user_id" uuid not null,
 "request_id" uuid not null,
 "fingerprint" jsonb not null,
 "response" jsonb not null,
 "created_at" timestamp with time zone default clock_timestamp() not null
);

create table public."wakppu_event_ball_progress" (
 "user_id" uuid not null,
 "event_id" text not null,
 "clicks" integer default 0 not null,
 "request_id" text,
 "response" jsonb
);

create table public."wakppu_first_steps_grants" (
 "user_id" uuid not null,
 "order_id" uuid not null,
 "gold" numeric default 3000 not null,
 "items" jsonb default '{"rare_honey": 2, "common_wax_feather": 2, "rare_crack_booster": 3}'::jsonb not null,
 "revision" bigint not null,
 "granted_at" timestamp with time zone default clock_timestamp() not null,
 "reclaimed_at" timestamp with time zone
);

create table public."wakppu_gem_ball_defs" (
 "ball_id" text not null,
 "name" text not null,
 "price" numeric not null,
 "clicks" bigint not null,
 "gem_reward" numeric not null
);

create table public."wakppu_gem_ball_players" (
 "user_id" uuid not null,
 "owned" jsonb default '[]'::jsonb not null,
 "selected" text,
 "clicks" bigint default 0 not null
);

create table public."wakppu_gem_ball_requests" (
 "user_id" uuid not null,
 "request_id" uuid not null,
 "fingerprint" jsonb not null,
 "response" jsonb not null
);

create table public."wakppu_halloween_cosmetic_requests" (
 "user_id" uuid not null,
 "request_id" uuid not null,
 "request" jsonb not null,
 "result" jsonb not null
);

create table public."wakppu_halloween_cosmetics" (
 "user_id" uuid not null,
 "owned" jsonb default '{}'::jsonb not null,
 "equipped" text,
 "shards" bigint default 0 not null,
 "opened" bigint default 0 not null,
 "revision" bigint default 0 not null,
 "pet_gold_remainder" smallint default 0 not null,
 "ember_last_hit_at" timestamp with time zone
);

create table public."wakppu_halloween_goods" (
 "user_id" uuid not null,
 "stock" jsonb default '{}'::jsonb not null,
 "expires" jsonb default '{}'::jsonb not null,
 "admin_expires" jsonb default '{}'::jsonb not null,
 "revision" bigint default 0 not null,
 "gold_remainder" smallint default 0 not null
);

create table public."wakppu_halloween_goods_defs" (
 "id" text not null,
 "name" text not null,
 "kind" text not null,
 "price" integer not null,
 "image" text
);

create table public."wakppu_halloween_goods_requests" (
 "user_id" uuid not null,
 "request_id" uuid not null,
 "fingerprint" jsonb not null
);

create table public."wakppu_input_events" (
 "id" bigint generated always as identity not null,
 "user_id" uuid,
 "created_at" timestamp with time zone default clock_timestamp() not null,
 "score" integer not null,
 "reasons" jsonb not null,
 "metrics" jsonb not null,
 "server_hits" integer not null,
 "corroborated" boolean not null,
 "restricted_until" timestamp with time zone
);

create table public."wakppu_input_guard" (
 "user_id" uuid not null,
 "tokens" numeric default 80 not null,
 "token_at" timestamp with time zone default clock_timestamp() not null,
 "first_seen" timestamp with time zone default clock_timestamp() not null,
 "hits" timestamp with time zone[] default '{}'::timestamp with time zone[] not null,
 "score" integer default 0 not null,
 "streak" integer default 0 not null,
 "last_report" timestamp with time zone,
 "last_session" uuid,
 "last_end" bigint default '-1'::integer not null,
 "speed_limited_until" timestamp with time zone
);

create table public."wakppu_input_reports" (
 "user_id" uuid not null,
 "request_id" uuid not null,
 "response" jsonb not null,
 "created_at" timestamp with time zone default clock_timestamp() not null
);

create table public."wakppu_item_balls" (
 "ball_id" text not null,
 "clicks" bigint not null,
 "reward" numeric not null
);

create table public."wakppu_item_defs" (
 "item_id" text not null,
 "rank" text not null,
 "seconds" integer not null,
 "channel" text not null,
 "value" integer not null,
 "charges" integer not null,
 "unit" text not null
);

create table public."wakppu_item_ranks" (
 "rank" text not null,
 "position" integer not null,
 "weight" integer not null
);

create table public."wakppu_item_requests" (
 "user_id" uuid not null,
 "request_id" uuid not null,
 "action" text not null,
 "response" jsonb not null
);

create table public."wakppu_items" (
 "user_id" uuid not null,
 "inventory" jsonb default '{}'::jsonb not null,
 "effects" jsonb default '{}'::jsonb not null,
 "pity" integer default 0 not null,
 "total" bigint default 0 not null
);

create table public."wakppu_limited_players" (
 "user_id" uuid not null,
 "tokens" bigint default 0 not null,
 "owned" jsonb default '{}'::jsonb not null,
 "selected" text,
 "clicks" bigint default 0 not null,
 "scare_disabled" boolean default false not null,
 "scare_optout_owned" boolean default false not null
);

create table public."wakppu_limited_requests" (
 "user_id" uuid not null,
 "request_id" uuid not null,
 "action" text not null,
 "response" jsonb not null
);

create table public."wakppu_limited_settings" (
 "id" boolean default true not null,
 "starts_at" timestamp with time zone not null,
 "ends_at" timestamp with time zone not null
);

create table public."wakppu_monthly_clicks" (
 "month" date not null,
 "user_id" uuid not null,
 "clicks" bigint not null,
 "reached_at" timestamp with time zone not null
);

create table public."wakppu_monthly_results" (
 "month" date not null,
 "user_id" uuid not null,
 "rank" bigint not null,
 "clicks" bigint not null,
 "nickname" text not null
);

create table public."wakppu_monthly_rewards" (
 "user_id" uuid not null,
 "month" date not null,
 "kind" text not null
);

create table public."wakppu_monthly_seasons" (
 "month" date not null,
 "finalized_at" timestamp with time zone
);

create table public."wakppu_profile_card_defs" (
 "card_id" text not null,
 "name" text not null,
 "rarity" text not null,
 "free" boolean default false not null,
 "image" text not null
);

create table public."wakppu_profile_card_grants" (
 "user_id" uuid not null,
 "card_id" text not null,
 "awarded_at" timestamp with time zone default now() not null
);

create table public."wakppu_profile_cards" (
 "user_id" uuid not null,
 "equipped" text,
 "title_id" text default 'auto'::text not null,
 "monthly_badge" text
);

create table public."wakppu_pumpkin_skin_defs" (
 "skin_id" text not null,
 "ball_id" text not null,
 "candy_cost" bigint not null,
 "position" integer not null
);

create table public."wakppu_purchase_config" (
 "id" boolean default true not null,
 "enabled" boolean default false not null,
 "bank_name" text default ''::text not null,
 "account_number" text default ''::text not null,
 "account_holder" text default ''::text not null,
 "support_contact" text default ''::text not null,
 "revision" integer default 0 not null
);

create table public."wakppu_purchase_cosmetics" (
 "user_id" uuid not null,
 "equipped" boolean default false not null,
 "title_visible" boolean default true not null
);

create table public."wakppu_purchase_entitlements" (
 "user_id" uuid not null,
 "product_id" text not null,
 "order_id" uuid not null
);

create table public."wakppu_purchase_orders" (
 "id" uuid default gen_random_uuid() not null,
 "user_id" uuid,
 "request_id" uuid not null,
 "product_id" text not null,
 "product_name" text not null,
 "amount" integer not null,
 "depositor" text not null,
 "bank" jsonb not null,
 "status" text default 'pending'::text not null,
 "created_at" timestamp with time zone default clock_timestamp() not null,
 "claimed_at" timestamp with time zone,
 "approved_at" timestamp with time zone,
 "refunded_at" timestamp with time zone,
 "deposit_reference" text,
 "approved_by" uuid,
 "refund_reference" text,
 "supporter_upgrade_order_id" uuid,
 "source" text default 'bank'::text not null,
 "deleted_user_id" uuid,
 "custom_target" text,
 "custom_upgrade_order_id" uuid
);

create table public."wakppu_purchase_products" (
 "id" text not null,
 "name" text not null,
 "amount" integer not null,
 "description" text not null
);

create table public."wakppu_skin_defs" (
 "skin_id" text not null,
 "ball_id" text not null,
 "rank" text not null,
 "position" integer not null,
 "weight" integer not null,
 "duplicate_shards" integer not null,
 "exchange_shards" integer not null
);

create table public."wakppu_skin_requests" (
 "user_id" uuid not null,
 "request_id" uuid not null,
 "request" jsonb not null,
 "response" jsonb not null
);

create table public."wakppu_skins" (
 "user_id" uuid not null,
 "owned" jsonb default '{}'::jsonb not null,
 "equipped" jsonb default '{}'::jsonb not null,
 "shards" bigint default 0 not null,
 "pity" integer default 0 not null,
 "total" bigint default 0 not null,
 "revision" bigint default 0 not null
);

create table public."wakppu_weekly_events" (
 "id" text not null,
 "weekday" integer not null,
 "local_time" time without time zone not null,
 "ball_seconds" integer not null,
 "gold_seconds" integer not null,
 "multiplier" integer not null,
 "enabled" boolean default false not null,
 "skip_gold" date,
 "skip_ball" date
);

alter table public."moderation_cases" add constraint "moderation_cases_strikes_check" CHECK ((strikes >= 0));

alter table public."moderation_cases" add constraint "moderation_cases_pkey" PRIMARY KEY (user_id);

alter table public."click_events" add constraint "click_events_pkey" PRIMARY KEY (id);

alter table public."admin_audit_logs" add constraint "admin_audit_logs_pkey" PRIMARY KEY (id);

alter table public."server_settings" add constraint "server_settings_id_check" CHECK (id);

alter table public."server_settings" add constraint "server_settings_pkey" PRIMARY KEY (id);

alter table public."wakppu_profile_card_defs" add constraint "wakppu_profile_card_defs_image_check" CHECK ((image ~ '^images/profile-cards/[a-z0-9-]+\.(png|webp|svg)$'::text));

alter table public."players" add constraint "players_nickname_check" CHECK (((char_length(nickname) >= 2) AND (char_length(nickname) <= 16)));

alter table public."players" add constraint "players_role_check" CHECK ((role = ANY (ARRAY['player'::text, 'admin'::text])));

alter table public."players" add constraint "players_pkey" PRIMARY KEY (user_id);

alter table public."players" add constraint "players_nickname_key" UNIQUE (nickname);

alter table public."game_states" add constraint "game_states_current_clicks_check" CHECK ((current_clicks >= 0));

alter table public."game_states" add constraint "game_states_pkey" PRIMARY KEY (user_id);

alter table public."moderation_cases" add constraint "moderation_cases_suspicion_score_check" CHECK ((suspicion_score >= 0));

alter table public."moderation_cases" add constraint "moderation_cases_status_check" CHECK ((status = ANY (ARRAY['active'::text, 'review'::text, 'suspended'::text, 'banned'::text])));

alter table public."guest_lifecycle" add constraint "guest_lifecycle_pkey" PRIMARY KEY (user_id);

alter table public."wakppu_ball_rewards" add constraint "wakppu_ball_rewards_reward_check" CHECK ((reward > (0)::numeric));

alter table public."wakppu_ball_rewards" add constraint "wakppu_ball_rewards_pkey" PRIMARY KEY (ball_id);

alter table public."wakppu_event_ball_progress" add constraint "wakppu_event_ball_progress_pkey" PRIMARY KEY (user_id, event_id);

alter table public."game_states" add constraint "game_states_hammer_level_check" CHECK (((hammer_level >= 0) AND (hammer_level <= 30)));

alter table public."wakppu_purchase_orders" add constraint "wakppu_purchase_orders_source_check" CHECK ((source = ANY (ARRAY['bank'::text, 'admin_grant'::text])));

alter table public."wakppu_purchase_orders" add constraint "wakppu_purchase_orders_amount_check" CHECK ((((source = 'bank'::text) AND (amount > 0)) OR ((source = 'admin_grant'::text) AND (amount = 0))));

alter table public."wakppu_halloween_goods_requests" add constraint "wakppu_halloween_goods_requests_pkey" PRIMARY KEY (user_id, request_id);

alter table public."wakppu_event_ball_progress" add constraint "wakppu_event_ball_progress_clicks_check" CHECK (((clicks >= 0) AND (clicks <= 1199)));

alter table public."wakppu_item_defs" add constraint "wakppu_item_defs_pkey" PRIMARY KEY (item_id);

alter table public."wakppu_item_ranks" add constraint "wakppu_item_ranks_weight_check" CHECK ((weight >= 0));

alter table public."wakppu_item_ranks" add constraint "wakppu_item_ranks_pkey" PRIMARY KEY (rank);

alter table public."wakppu_item_ranks" add constraint "wakppu_item_ranks_position_key" UNIQUE ("position");

alter table public."wakppu_items" add constraint "wakppu_items_pity_check" CHECK (((pity >= 0) AND (pity <= 99)));

alter table public."wakppu_items" add constraint "wakppu_items_pkey" PRIMARY KEY (user_id);

alter table public."wakppu_item_requests" add constraint "wakppu_item_requests_pkey" PRIMARY KEY (user_id, request_id);

alter table public."wakppu_item_balls" add constraint "wakppu_item_balls_pkey" PRIMARY KEY (ball_id);

alter table public."wakppu_limited_settings" add constraint "wakppu_limited_settings_id_check" CHECK (id);

alter table public."wakppu_limited_settings" add constraint "wakppu_limited_settings_check" CHECK ((ends_at > starts_at));

alter table public."wakppu_limited_settings" add constraint "wakppu_limited_settings_pkey" PRIMARY KEY (id);

alter table public."wakppu_limited_players" add constraint "wakppu_limited_players_tokens_check" CHECK ((tokens >= 0));

alter table public."wakppu_limited_players" add constraint "wakppu_limited_players_pkey" PRIMARY KEY (user_id);

alter table public."wakppu_limited_requests" add constraint "wakppu_limited_requests_pkey" PRIMARY KEY (user_id, request_id);

alter table public."player_presence" add constraint "player_presence_pkey" PRIMARY KEY (user_id);

alter table public."game_states" add constraint "game_states_rebirths_check" CHECK (((rebirths >= 0) AND (rebirths <= 1000)));

alter table public."game_states" add constraint "game_states_gold_check" CHECK (((gold >= (0)::numeric) AND (gold = trunc(gold)) AND (gold < power((10)::numeric, (4096)::numeric))));

alter table public."server_settings" add constraint "server_settings_background_mode_check" CHECK ((background_mode = ANY (ARRAY['auto'::text, 'default'::text, 'halloween'::text])));

alter table public."wakppu_weekly_events" add constraint "wakppu_weekly_events_weekday_check" CHECK (((weekday >= 1) AND (weekday <= 7)));

alter table public."wakppu_weekly_events" add constraint "wakppu_weekly_events_ball_seconds_check" CHECK (((ball_seconds >= 1) AND (ball_seconds <= 86400)));

alter table public."wakppu_weekly_events" add constraint "wakppu_weekly_events_gold_seconds_check" CHECK (((gold_seconds >= 1) AND (gold_seconds <= 86400)));

alter table public."wakppu_weekly_events" add constraint "wakppu_weekly_events_multiplier_check" CHECK (((multiplier >= 1) AND (multiplier <= 1000)));

alter table public."wakppu_weekly_events" add constraint "wakppu_weekly_events_pkey" PRIMARY KEY (id);

alter table public."wakppu_custom_assets" add constraint "wakppu_custom_assets_bytes_check" CHECK (((bytes >= 1) AND (bytes <= 1200000)));

alter table public."wakppu_custom_assets" add constraint "wakppu_custom_assets_pkey" PRIMARY KEY (id);

alter table public."game_states" add constraint "game_states_hammer_selected_level_check" CHECK (((hammer_selected_level IS NULL) OR (hammer_owned AND ((hammer_selected_level >= 0) AND (hammer_selected_level <= hammer_level)))));

alter table public."wakppu_skin_defs" add constraint "wakppu_skin_defs_weight_check" CHECK ((weight >= 0));

alter table public."wakppu_skin_defs" add constraint "wakppu_skin_defs_duplicate_shards_check" CHECK ((duplicate_shards > 0));

alter table public."wakppu_skin_defs" add constraint "wakppu_skin_defs_exchange_shards_check" CHECK ((exchange_shards > 0));

alter table public."wakppu_skin_defs" add constraint "wakppu_skin_defs_pkey" PRIMARY KEY (skin_id);

alter table public."wakppu_skin_defs" add constraint "wakppu_skin_defs_position_key" UNIQUE ("position");

alter table public."wakppu_skins" add constraint "wakppu_skins_shards_check" CHECK ((shards >= 0));

alter table public."wakppu_skins" add constraint "wakppu_skins_pity_check" CHECK (((pity >= 0) AND (pity <= 99)));

alter table public."wakppu_skins" add constraint "wakppu_skins_pkey" PRIMARY KEY (user_id);

alter table public."wakppu_skin_requests" add constraint "wakppu_skin_requests_pkey" PRIMARY KEY (user_id, request_id);

alter table public."wakppu_purchase_config" add constraint "wakppu_purchase_config_id_check" CHECK (id);

alter table public."wakppu_purchase_config" add constraint "wakppu_purchase_config_pkey" PRIMARY KEY (id);

alter table public."wakppu_purchase_products" add constraint "wakppu_purchase_products_amount_check" CHECK ((amount > 0));

alter table public."wakppu_purchase_products" add constraint "wakppu_purchase_products_pkey" PRIMARY KEY (id);

alter table public."wakppu_purchase_orders" add constraint "wakppu_purchase_orders_pkey" PRIMARY KEY (id);

alter table public."wakppu_purchase_orders" add constraint "wakppu_purchase_orders_deposit_reference_key" UNIQUE (deposit_reference);

alter table public."wakppu_purchase_orders" add constraint "wakppu_purchase_orders_user_id_request_id_key" UNIQUE (user_id, request_id);

alter table public."wakppu_purchase_entitlements" add constraint "wakppu_purchase_entitlements_pkey" PRIMARY KEY (user_id, product_id);

alter table public."wakppu_purchase_entitlements" add constraint "wakppu_purchase_entitlements_order_id_key" UNIQUE (order_id);

alter table public."wakppu_purchase_cosmetics" add constraint "wakppu_purchase_cosmetics_pkey" PRIMARY KEY (user_id);

alter table public."game_states" add constraint "game_states_supporter_gold_remainder_check" CHECK (((supporter_gold_remainder >= 0) AND (supporter_gold_remainder <= 99)));

alter table public."wakppu_input_guard" add constraint "wakppu_input_guard_pkey" PRIMARY KEY (user_id);

alter table public."wakppu_input_reports" add constraint "wakppu_input_reports_pkey" PRIMARY KEY (user_id, request_id);

alter table public."wakppu_input_events" add constraint "wakppu_input_events_pkey" PRIMARY KEY (id);

alter table public."wakppu_first_steps_grants" add constraint "wakppu_first_steps_grants_gold_check" CHECK ((gold = (3000)::numeric));

alter table public."wakppu_first_steps_grants" add constraint "wakppu_first_steps_grants_pkey" PRIMARY KEY (user_id);

alter table public."wakppu_first_steps_grants" add constraint "wakppu_first_steps_grants_order_id_key" UNIQUE (order_id);

alter table public."wakppu_purchase_orders" add constraint "wakppu_purchase_orders_status_check" CHECK ((status = ANY (ARRAY['pending'::text, 'claimed'::text, 'approved'::text, 'cancelled'::text, 'refunded'::text, 'revoked'::text])));

alter table public."wakppu_pumpkin_skin_defs" add constraint "wakppu_pumpkin_skin_defs_ball_id_check" CHECK ((ball_id = 'halloween-pumpkin-2026'::text));

alter table public."wakppu_pumpkin_skin_defs" add constraint "wakppu_pumpkin_skin_defs_candy_cost_check" CHECK ((candy_cost > 0));

alter table public."wakppu_pumpkin_skin_defs" add constraint "wakppu_pumpkin_skin_defs_pkey" PRIMARY KEY (skin_id);

alter table public."wakppu_pumpkin_skin_defs" add constraint "wakppu_pumpkin_skin_defs_position_key" UNIQUE ("position");

alter table public."wakppu_developer_keepsakes" add constraint "wakppu_developer_keepsakes_reason_check" CHECK (((length(reason) >= 3) AND (length(reason) <= 200)));

alter table public."wakppu_developer_keepsakes" add constraint "wakppu_developer_keepsakes_pkey" PRIMARY KEY (user_id);

alter table public."wakppu_developer_keepsakes" add constraint "wakppu_developer_keepsakes_granted_by_request_id_key" UNIQUE (granted_by, request_id);

alter table public."wakppu_custom_accounts" add constraint "wakppu_custom_accounts_pkey" PRIMARY KEY (user_id);

alter table public."wakppu_custom_assets" add constraint "wakppu_custom_assets_sha256_check" CHECK ((sha256 ~ '^[0-9a-f]{64}$'::text));

alter table public."wakppu_custom_assets" add constraint "wakppu_custom_assets_path_key" UNIQUE (path);

alter table public."wakppu_custom_profiles" add constraint "wakppu_custom_profiles_check" CHECK ((disabled OR ((asset_id IS NOT NULL) AND (effect IS NOT NULL) AND (sound IS NOT NULL))));

alter table public."wakppu_custom_profiles" add constraint "wakppu_custom_profiles_pkey" PRIMARY KEY (user_id, target);

alter table public."wakppu_custom_requests" add constraint "wakppu_custom_requests_pkey" PRIMARY KEY (user_id, request_id);

alter table public."wakppu_custom_gc" add constraint "wakppu_custom_gc_pkey" PRIMARY KEY (path);

alter table public."wakppu_auto_rebirth" add constraint "wakppu_auto_rebirth_pkey" PRIMARY KEY (user_id);

alter table public."wakppu_halloween_cosmetics" add constraint "wakppu_halloween_cosmetics_owned_check" CHECK ((jsonb_typeof(owned) = 'object'::text));

alter table public."wakppu_halloween_cosmetics" add constraint "wakppu_halloween_cosmetics_shards_check" CHECK ((shards >= 0));

alter table public."wakppu_halloween_cosmetics" add constraint "wakppu_halloween_cosmetics_opened_check" CHECK ((opened >= 0));

alter table public."wakppu_halloween_cosmetics" add constraint "wakppu_halloween_cosmetics_pkey" PRIMARY KEY (user_id);

alter table public."wakppu_halloween_cosmetic_requests" add constraint "wakppu_halloween_cosmetic_requests_pkey" PRIMARY KEY (user_id, request_id);

alter table public."wakppu_halloween_cosmetics" add constraint "wakppu_halloween_cosmetics_equipped_check" CHECK ((equipped = ANY (ARRAY['little_ghost'::text, 'pumpkin_ember'::text, 'bat_swarm'::text])));

alter table public."wakppu_halloween_cosmetics" add constraint "wakppu_halloween_cosmetics_pet_gold_remainder_check" CHECK (((pet_gold_remainder >= 0) AND (pet_gold_remainder <= 99)));

alter table public."wakppu_profile_card_defs" add constraint "wakppu_profile_card_defs_pkey" PRIMARY KEY (card_id);

alter table public."wakppu_profile_cards" add constraint "wakppu_profile_cards_pkey" PRIMARY KEY (user_id);

alter table public."wakppu_profile_card_grants" add constraint "wakppu_profile_card_grants_pkey" PRIMARY KEY (user_id, card_id);

alter table public."wakppu_blue_gem_products" add constraint "wakppu_blue_gem_products_level_check" CHECK ((level > 0));

alter table public."wakppu_blue_gem_products" add constraint "wakppu_blue_gem_products_price_check" CHECK (((price > (0)::numeric) AND (price = trunc(price))));

alter table public."wakppu_blue_gem_products" add constraint "wakppu_blue_gem_products_multiplier_check" CHECK (((multiplier > (1)::numeric) AND (multiplier = trunc(multiplier))));

alter table public."wakppu_blue_gem_products" add constraint "wakppu_blue_gem_products_pkey" PRIMARY KEY (level);

alter table public."wakppu_blue_gems" add constraint "wakppu_blue_gems_balance_check" CHECK (((balance >= (0)::numeric) AND (balance = trunc(balance))));

alter table public."wakppu_blue_gems" add constraint "wakppu_blue_gems_level_check" CHECK ((level >= 0));

alter table public."wakppu_blue_gems" add constraint "wakppu_blue_gems_admin_level_check" CHECK ((admin_level >= 0));

alter table public."wakppu_blue_gems" add constraint "wakppu_blue_gems_revision_check" CHECK ((revision >= 0));

alter table public."wakppu_blue_gems" add constraint "wakppu_blue_gems_pkey" PRIMARY KEY (user_id);

alter table public."wakppu_blue_gem_exclusions" add constraint "wakppu_blue_gem_exclusions_pkey" PRIMARY KEY (ball_id);

alter table public."wakppu_blue_gem_requests" add constraint "wakppu_blue_gem_requests_pkey" PRIMARY KEY (user_id, request_id);

alter table public."wakppu_ember_hit_requests" add constraint "wakppu_ember_hit_requests_pkey" PRIMARY KEY (user_id, request_id);

alter table public."wakppu_monthly_seasons" add constraint "wakppu_monthly_seasons_month_check" CHECK (((EXTRACT(day FROM month) = (1)::numeric) AND (month >= '2026-10-01'::date)));

alter table public."wakppu_monthly_seasons" add constraint "wakppu_monthly_seasons_pkey" PRIMARY KEY (month);

alter table public."wakppu_monthly_clicks" add constraint "wakppu_monthly_clicks_clicks_check" CHECK ((clicks > 0));

alter table public."wakppu_monthly_clicks" add constraint "wakppu_monthly_clicks_pkey" PRIMARY KEY (month, user_id);

alter table public."wakppu_monthly_results" add constraint "wakppu_monthly_results_pkey" PRIMARY KEY (month, user_id);

alter table public."wakppu_monthly_results" add constraint "wakppu_monthly_results_month_rank_key" UNIQUE (month, rank);

alter table public."wakppu_monthly_rewards" add constraint "wakppu_monthly_rewards_kind_check" CHECK ((kind = ANY (ARRAY['champion'::text, 'top10'::text, 'participant'::text])));

alter table public."wakppu_monthly_rewards" add constraint "wakppu_monthly_rewards_pkey" PRIMARY KEY (user_id, month, kind);

alter table public."wakppu_gem_ball_defs" add constraint "wakppu_gem_ball_defs_price_check" CHECK (((price >= (0)::numeric) AND (price = trunc(price))));

alter table public."wakppu_gem_ball_defs" add constraint "wakppu_gem_ball_defs_clicks_check" CHECK ((clicks > 0));

alter table public."wakppu_gem_ball_defs" add constraint "wakppu_gem_ball_defs_gem_reward_check" CHECK (((gem_reward > (0)::numeric) AND (gem_reward = trunc(gem_reward))));

alter table public."wakppu_gem_ball_defs" add constraint "wakppu_gem_ball_defs_pkey" PRIMARY KEY (ball_id);

alter table public."wakppu_gem_ball_players" add constraint "wakppu_gem_ball_players_clicks_check" CHECK ((clicks >= 0));

alter table public."wakppu_gem_ball_players" add constraint "wakppu_gem_ball_players_pkey" PRIMARY KEY (user_id);

alter table public."wakppu_gem_ball_requests" add constraint "wakppu_gem_ball_requests_pkey" PRIMARY KEY (user_id, request_id);

alter table public."wakppu_halloween_goods_defs" add constraint "wakppu_halloween_goods_defs_kind_check" CHECK ((kind = ANY (ARRAY['potion'::text, 'card'::text, 'title'::text])));

alter table public."wakppu_halloween_goods_defs" add constraint "wakppu_halloween_goods_defs_price_check" CHECK ((price > 0));

alter table public."wakppu_halloween_goods_defs" add constraint "wakppu_halloween_goods_defs_pkey" PRIMARY KEY (id);

alter table public."wakppu_halloween_goods" add constraint "wakppu_halloween_goods_gold_remainder_check" CHECK ((gold_remainder = ANY (ARRAY[0, 1])));

alter table public."wakppu_halloween_goods" add constraint "wakppu_halloween_goods_pkey" PRIMARY KEY (user_id);

alter table public."wakppu_profile_cards" add constraint "wakppu_profile_cards_title_id_check" CHECK (((title_id = ANY (ARRAY['auto'::text, 'none'::text, 'supporter'::text, 'premium'::text, 'champion'::text, 'halloween_witch_title'::text, 'halloween_ghost_title'::text, 'halloween_pumpkin_title'::text])) OR (title_id ~ '^monthly_[0-9]{6}_(champion|top10)$'::text)));

alter table public."moderation_cases" add constraint "moderation_cases_user_id_fkey" FOREIGN KEY (user_id) REFERENCES players(user_id) ON DELETE CASCADE;

alter table public."click_events" add constraint "click_events_user_id_fkey" FOREIGN KEY (user_id) REFERENCES players(user_id) ON DELETE CASCADE;

alter table public."admin_audit_logs" add constraint "admin_audit_logs_admin_user_id_fkey" FOREIGN KEY (admin_user_id) REFERENCES players(user_id);

alter table public."player_presence" add constraint "player_presence_user_id_fkey" FOREIGN KEY (user_id) REFERENCES players(user_id) ON DELETE CASCADE;

alter table public."players" add constraint "players_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

alter table public."game_states" add constraint "game_states_user_id_fkey" FOREIGN KEY (user_id) REFERENCES players(user_id) ON DELETE CASCADE;

alter table public."guest_lifecycle" add constraint "guest_lifecycle_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

alter table public."wakppu_event_ball_progress" add constraint "wakppu_event_ball_progress_user_id_fkey" FOREIGN KEY (user_id) REFERENCES players(user_id) ON DELETE CASCADE;

alter table public."wakppu_limited_requests" add constraint "wakppu_limited_requests_user_id_fkey" FOREIGN KEY (user_id) REFERENCES players(user_id) ON DELETE CASCADE;

alter table public."wakppu_halloween_goods_requests" add constraint "wakppu_halloween_goods_requests_user_id_fkey" FOREIGN KEY (user_id) REFERENCES players(user_id) ON DELETE CASCADE;

alter table public."wakppu_items" add constraint "wakppu_items_user_id_fkey" FOREIGN KEY (user_id) REFERENCES players(user_id) ON DELETE CASCADE;

alter table public."wakppu_item_requests" add constraint "wakppu_item_requests_user_id_fkey" FOREIGN KEY (user_id) REFERENCES players(user_id) ON DELETE CASCADE;

alter table public."wakppu_limited_players" add constraint "wakppu_limited_players_user_id_fkey" FOREIGN KEY (user_id) REFERENCES players(user_id) ON DELETE CASCADE;

alter table public."wakppu_skins" add constraint "wakppu_skins_user_id_fkey" FOREIGN KEY (user_id) REFERENCES players(user_id) ON DELETE CASCADE;

alter table public."wakppu_skin_requests" add constraint "wakppu_skin_requests_user_id_fkey" FOREIGN KEY (user_id) REFERENCES players(user_id) ON DELETE CASCADE;

alter table public."wakppu_purchase_orders" add constraint "wakppu_purchase_orders_product_id_fkey" FOREIGN KEY (product_id) REFERENCES wakppu_purchase_products(id);

alter table public."wakppu_purchase_entitlements" add constraint "wakppu_purchase_entitlements_user_id_fkey" FOREIGN KEY (user_id) REFERENCES players(user_id);

alter table public."wakppu_purchase_entitlements" add constraint "wakppu_purchase_entitlements_product_id_fkey" FOREIGN KEY (product_id) REFERENCES wakppu_purchase_products(id);

alter table public."wakppu_purchase_entitlements" add constraint "wakppu_purchase_entitlements_order_id_fkey" FOREIGN KEY (order_id) REFERENCES wakppu_purchase_orders(id);

alter table public."wakppu_purchase_cosmetics" add constraint "wakppu_purchase_cosmetics_user_id_fkey" FOREIGN KEY (user_id) REFERENCES players(user_id);

alter table public."wakppu_input_guard" add constraint "wakppu_input_guard_user_id_fkey" FOREIGN KEY (user_id) REFERENCES players(user_id) ON DELETE CASCADE;

alter table public."wakppu_input_reports" add constraint "wakppu_input_reports_user_id_fkey" FOREIGN KEY (user_id) REFERENCES players(user_id) ON DELETE CASCADE;

alter table public."wakppu_input_events" add constraint "wakppu_input_events_user_id_fkey" FOREIGN KEY (user_id) REFERENCES players(user_id) ON DELETE CASCADE;

alter table public."wakppu_first_steps_grants" add constraint "wakppu_first_steps_grants_user_id_fkey" FOREIGN KEY (user_id) REFERENCES players(user_id);

alter table public."wakppu_first_steps_grants" add constraint "wakppu_first_steps_grants_order_id_fkey" FOREIGN KEY (order_id) REFERENCES wakppu_purchase_orders(id);

alter table public."wakppu_purchase_orders" add constraint "wakppu_purchase_orders_supporter_upgrade_order_id_fkey" FOREIGN KEY (supporter_upgrade_order_id) REFERENCES wakppu_purchase_orders(id);

alter table public."admin_audit_logs" add constraint "admin_audit_logs_target_user_id_fkey" FOREIGN KEY (target_user_id) REFERENCES players(user_id) ON DELETE SET NULL;

alter table public."wakppu_purchase_orders" add constraint "wakppu_purchase_orders_user_id_fkey" FOREIGN KEY (user_id) REFERENCES players(user_id) ON DELETE SET NULL;

alter table public."wakppu_developer_keepsakes" add constraint "wakppu_developer_keepsakes_user_id_fkey" FOREIGN KEY (user_id) REFERENCES players(user_id) ON DELETE CASCADE;

alter table public."wakppu_developer_keepsakes" add constraint "wakppu_developer_keepsakes_granted_by_fkey" FOREIGN KEY (granted_by) REFERENCES players(user_id);

alter table public."wakppu_purchase_orders" add constraint "wakppu_purchase_orders_custom_upgrade_order_id_fkey" FOREIGN KEY (custom_upgrade_order_id) REFERENCES wakppu_purchase_orders(id);

alter table public."wakppu_custom_accounts" add constraint "wakppu_custom_accounts_user_id_fkey" FOREIGN KEY (user_id) REFERENCES players(user_id) ON DELETE CASCADE;

alter table public."wakppu_custom_assets" add constraint "wakppu_custom_assets_user_id_fkey" FOREIGN KEY (user_id) REFERENCES players(user_id) ON DELETE CASCADE;

alter table public."wakppu_custom_profiles" add constraint "wakppu_custom_profiles_user_id_fkey" FOREIGN KEY (user_id) REFERENCES players(user_id) ON DELETE CASCADE;

alter table public."wakppu_custom_profiles" add constraint "wakppu_custom_profiles_asset_id_fkey" FOREIGN KEY (asset_id) REFERENCES wakppu_custom_assets(id);

alter table public."wakppu_custom_requests" add constraint "wakppu_custom_requests_user_id_fkey" FOREIGN KEY (user_id) REFERENCES players(user_id) ON DELETE CASCADE;

alter table public."wakppu_auto_rebirth" add constraint "wakppu_auto_rebirth_user_id_fkey" FOREIGN KEY (user_id) REFERENCES players(user_id) ON DELETE CASCADE;

alter table public."wakppu_halloween_cosmetics" add constraint "wakppu_halloween_cosmetics_user_id_fkey" FOREIGN KEY (user_id) REFERENCES players(user_id) ON DELETE CASCADE;

alter table public."wakppu_halloween_cosmetic_requests" add constraint "wakppu_halloween_cosmetic_requests_user_id_fkey" FOREIGN KEY (user_id) REFERENCES players(user_id) ON DELETE CASCADE;

alter table public."wakppu_profile_cards" add constraint "wakppu_profile_cards_user_id_fkey" FOREIGN KEY (user_id) REFERENCES players(user_id) ON DELETE CASCADE;

alter table public."wakppu_profile_cards" add constraint "wakppu_profile_cards_equipped_fkey" FOREIGN KEY (equipped) REFERENCES wakppu_profile_card_defs(card_id);

alter table public."wakppu_profile_card_grants" add constraint "wakppu_profile_card_grants_user_id_fkey" FOREIGN KEY (user_id) REFERENCES players(user_id) ON DELETE CASCADE;

alter table public."wakppu_profile_card_grants" add constraint "wakppu_profile_card_grants_card_id_fkey" FOREIGN KEY (card_id) REFERENCES wakppu_profile_card_defs(card_id);

alter table public."wakppu_blue_gems" add constraint "wakppu_blue_gems_user_id_fkey" FOREIGN KEY (user_id) REFERENCES players(user_id) ON DELETE CASCADE;

alter table public."wakppu_blue_gem_requests" add constraint "wakppu_blue_gem_requests_user_id_fkey" FOREIGN KEY (user_id) REFERENCES players(user_id) ON DELETE CASCADE;

alter table public."wakppu_ember_hit_requests" add constraint "wakppu_ember_hit_requests_user_id_fkey" FOREIGN KEY (user_id) REFERENCES players(user_id) ON DELETE CASCADE;

alter table public."wakppu_monthly_clicks" add constraint "wakppu_monthly_clicks_month_fkey" FOREIGN KEY (month) REFERENCES wakppu_monthly_seasons(month);

alter table public."wakppu_monthly_clicks" add constraint "wakppu_monthly_clicks_user_id_fkey" FOREIGN KEY (user_id) REFERENCES players(user_id) ON DELETE CASCADE;

alter table public."wakppu_monthly_results" add constraint "wakppu_monthly_results_month_fkey" FOREIGN KEY (month) REFERENCES wakppu_monthly_seasons(month);

alter table public."wakppu_monthly_results" add constraint "wakppu_monthly_results_user_id_fkey" FOREIGN KEY (user_id) REFERENCES players(user_id) ON DELETE CASCADE;

alter table public."wakppu_monthly_rewards" add constraint "wakppu_monthly_rewards_user_id_fkey" FOREIGN KEY (user_id) REFERENCES players(user_id) ON DELETE CASCADE;

alter table public."wakppu_monthly_rewards" add constraint "wakppu_monthly_rewards_month_fkey" FOREIGN KEY (month) REFERENCES wakppu_monthly_seasons(month);

alter table public."wakppu_gem_ball_players" add constraint "wakppu_gem_ball_players_user_id_fkey" FOREIGN KEY (user_id) REFERENCES players(user_id) ON DELETE CASCADE;

alter table public."wakppu_gem_ball_players" add constraint "wakppu_gem_ball_players_selected_fkey" FOREIGN KEY (selected) REFERENCES wakppu_gem_ball_defs(ball_id);

alter table public."wakppu_gem_ball_requests" add constraint "wakppu_gem_ball_requests_user_id_fkey" FOREIGN KEY (user_id) REFERENCES players(user_id) ON DELETE CASCADE;

alter table public."wakppu_halloween_goods" add constraint "wakppu_halloween_goods_user_id_fkey" FOREIGN KEY (user_id) REFERENCES players(user_id) ON DELETE CASCADE;

CREATE INDEX wakppu_input_events_user_created_idx ON public.wakppu_input_events USING btree (user_id, created_at DESC, id DESC);

CREATE INDEX wakppu_input_events_created_idx ON public.wakppu_input_events USING btree (created_at DESC, id DESC);

CREATE INDEX wakppu_custom_profiles_asset_idx ON public.wakppu_custom_profiles USING btree (asset_id) WHERE (asset_id IS NOT NULL);

CREATE INDEX wakppu_purchase_inbox_idx ON public.wakppu_purchase_orders USING btree (GREATEST(created_at, COALESCE(claimed_at, created_at)) DESC, id) WHERE ((source = 'bank'::text) AND (status = ANY (ARRAY['pending'::text, 'claimed'::text])));

CREATE INDEX wakppu_custom_assets_owner_idx ON public.wakppu_custom_assets USING btree (user_id);

CREATE INDEX wakppu_monthly_results_user_idx ON public.wakppu_monthly_results USING btree (user_id, month);

CREATE INDEX game_states_rankings_idx ON public.game_states USING btree (rebirths DESC, gold DESC);

CREATE INDEX click_events_user_received_idx ON public.click_events USING btree (user_id, received_at DESC);

CREATE INDEX wakppu_custom_upgrade_idx ON public.wakppu_purchase_orders USING btree (custom_upgrade_order_id) WHERE (custom_upgrade_order_id IS NOT NULL);

CREATE INDEX wakppu_input_reports_created_idx ON public.wakppu_input_reports USING btree (user_id, created_at DESC);

CREATE INDEX wakppu_monthly_clicks_user_idx ON public.wakppu_monthly_clicks USING btree (user_id, month);

CREATE INDEX wakppu_monthly_clicks_rank_idx ON public.wakppu_monthly_clicks USING btree (month, clicks DESC, reached_at, user_id);

CREATE INDEX wakppu_purchase_pending_idx ON public.wakppu_purchase_orders USING btree (status, created_at DESC);

CREATE INDEX guest_lifecycle_unplayed_idx ON public.guest_lifecycle USING btree (created_at) WHERE (first_play_at IS NULL);

CREATE INDEX wakppu_upgrade_source_idx ON public.wakppu_purchase_orders USING btree (supporter_upgrade_order_id) WHERE (supporter_upgrade_order_id IS NOT NULL);

CREATE INDEX wakppu_purchase_owner_idx ON public.wakppu_purchase_orders USING btree (user_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.wakppu_monthly_eligible(u uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
 select exists(select 1 from public.players p where p.user_id=u and p.role<>'admin' and not p.ranking_hidden
 and not exists(select 1 from public.moderation_cases m where m.user_id=u and (m.status='banned' or (m.status='suspended' and (m.suspended_until is null or m.suspended_until>statement_timestamp()))))
 and not exists(select 1 from public.wakppu_guest_accounts() g where g.id=u and g.eligible and g.hide_at<=statement_timestamp()));
$function$
;

CREATE OR REPLACE FUNCTION public.wakppu_item_winners(effects jsonb, ms bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare it record; result jsonb:='{}'; channels jsonb; pair record;
begin
 for it in select def.*,e.value as effect from jsonb_each(effects) e
  join public.wakppu_item_defs def on def.item_id=e.key order by def.item_id loop
  if not (case when it.seconds>0 then coalesce((it.effect->>'expires_at')::bigint,0)>ms
   else coalesce((it.effect->>'remaining')::bigint,0)>0 end) then continue;end if;
  channels:=case when it.channel='heart' then '{"reward":600,"animation":250,"respawn":400}'::jsonb
   when it.item_id='hero_haste_wax' then '{"respawn":200,"animation":150}'::jsonb
   else jsonb_build_object(it.channel,it.value) end;
  for pair in select key,value from jsonb_each_text(channels) loop
   if pair.value::numeric>coalesce((result->pair.key->>'value')::numeric,100) then
    result:=jsonb_set(result,array[pair.key],jsonb_build_object('value',pair.value::numeric,'id',it.item_id));
   end if;
  end loop;
 end loop;
 return result;
end $function$
;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  insert into public.players (user_id, nickname)
  values (new.id, 'Player-' || substr(new.id::text, 1, 6));
  insert into public.game_states (user_id) values (new.id);
  insert into public.moderation_cases (user_id) values (new.id);
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.wakppu_state_json(s game_states)
 RETURNS jsonb
 LANGUAGE sql
 IMMUTABLE
AS $function$ select to_jsonb(s)||jsonb_build_object('gold',s.gold::text) $function$
;

CREATE OR REPLACE FUNCTION public.wakppu_api_before_events(b jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
 a text:=b->>'action'; u uuid:=auth.uid(); r text; s game_states; player_row players; t uuid; before_data jsonb; result jsonb;
 settings server_settings; ids jsonb; amount numeric; val numeric; mode text:=b->>'mode'; balls text[]:=array['yellow','green','strawberry','apple','chocolate','donut','rainbow','water','emerald','diamond','planet','sun','blackhole','whitehole','starlight','hellfire','heaven-cloud','hell-ember','heaven-gem','hell-core','judgment','heaven-earth','soul','eternity']; idx integer; m moderation_cases; blocked boolean; ban_hours integer; ban_reason text;
begin
 select * into settings from server_settings where id=true;
 select role into r from players where user_id=u;
 if coalesce((auth.jwt()->>'is_anonymous')::boolean,false) then r:='player'; end if;
 select * into m from moderation_cases where user_id=u;
 blocked:=coalesce(m.status='banned' or (m.status='suspended' and (m.suspended_until is null or m.suspended_until>now())),false);
 if a='status' then return jsonb_build_object('role',coalesce(r,'player'),'maintenance',settings.maintenance,'message',settings.message,'announcement',settings.announcement,'moderation',coalesce(to_jsonb(m),'{}'::jsonb)||jsonb_build_object('blocked',blocked),'admin_revision',(select admin_revision from game_states where user_id=u)); end if;
 if u is null or r is null then raise sqlstate 'PT401' using message='로그인이 필요합니다.'; end if;
 if left(a,6)='admin_' and r<>'admin' then raise sqlstate 'PT403' using message='관리자 권한이 필요합니다.'; end if;
 if settings.maintenance and r<>'admin' then raise sqlstate 'PT503' using message='현재 패치 중입니다.'; end if;
 if blocked then raise sqlstate 'PT403' using message='이 계정은 이용이 제한되었습니다.'; end if;
 if a='bootstrap' then
 select * into s from game_states where user_id=u; select * into player_row from players where user_id=u;
 return jsonb_build_object('player',to_jsonb(player_row),'state',wakppu_state_json(s),'moderation',(select to_jsonb(mc) from moderation_cases mc where user_id=u));
 elsif a='rankings' then
 return (select coalesce(jsonb_agg(x),'[]'::jsonb) from (select p.nickname,g.gold::text as gold,g.rebirths from game_states g join players p using(user_id) where not p.ranking_hidden and not exists(select 1 from moderation_cases mc where mc.user_id=p.user_id and (mc.status='banned' or (mc.status='suspended' and (mc.suspended_until is null or mc.suspended_until>now())))) order by g.rebirths desc,g.gold desc,g.user_id limit 100) x);
 elsif a='set_nickname' then
 if length(trim(b->>'nickname')) not between 2 and 16 then raise exception '닉네임은 2~16자입니다.'; end if;
 update players set nickname=trim(b->>'nickname'),updated_at=now() where user_id=u;
 return jsonb_build_object('ok',true);
 elsif a='save_progress' then
 select * into s from game_states where user_id=u for update;
 if s.admin_revision<>coalesce((b->>'admin_revision')::integer,0) then raise sqlstate 'PT409' using message='관리자가 변경한 진행도를 다시 불러옵니다.'; end if;
 if exists(select 1 from moderation_cases where user_id=u and (status='banned' or (status='suspended' and (suspended_until is null or suspended_until>now())))) then raise sqlstate 'PT403' using message='정지된 계정입니다.'; end if;
 if (coalesce(b->>'gold','') !~ '^[0-9]+$' or length(coalesce(b->>'gold',''))>4096) then raise exception '올바른 Gold 값이 필요합니다.'; end if;
 amount:=(b->>'gold')::numeric;
 if (b->>'rebirths')::integer not between 0 and 1000 or coalesce((b->>'hammer_level')::integer,0) not between 0 and 30 then raise exception '저장 범위를 초과했습니다.'; end if;
 if jsonb_typeof(b->'unlocked_ball_ids')<>'array' or exists(select 1 from jsonb_array_elements_text(b->'unlocked_ball_ids') x where not x=any(balls)) or not (b->>'selected_ball_id')=any(balls) then raise exception '잘못된 왁뿌볼입니다.'; end if;
 if b ? 'discovered_ball_ids' and (jsonb_typeof(b->'discovered_ball_ids')<>'array' or exists(select 1 from jsonb_array_elements_text(b->'discovered_ball_ids') x where not x=any(balls))) then raise exception '잘못된 도감입니다.'; end if; update game_states set discovered_ball_ids=(select coalesce(jsonb_agg(distinct x),'[]'::jsonb) from jsonb_array_elements(discovered_ball_ids||coalesce(b->'discovered_ball_ids','[]'::jsonb)) x),gold=amount,rebirths=(b->>'rebirths')::smallint,unlocked_ball_ids=b->'unlocked_ball_ids',selected_ball_id=b->>'selected_ball_id',hammer_owned=coalesce((b->>'hammer_owned')::boolean,false),hammer_level=coalesce((b->>'hammer_level')::integer,1),honey_expires_at=(b->>'honey_expires_at')::timestamptz,coating_expires_at=(b->>'coating_expires_at')::timestamptz,progress_imported_at=coalesce(progress_imported_at,now()),updated_at=now() where user_id=u;
 return jsonb_build_object('ok',true);
 elsif a='admin_search' then
 return (select coalesce(jsonb_agg(x),'[]'::jsonb) from (select p.user_id as id,p.nickname,p.ranking_hidden,wakppu_state_json(g) as state,to_jsonb(mc) as moderation from players p join game_states g using(user_id) left join moderation_cases mc using(user_id) where strpos(lower(p.nickname),lower(coalesce(b->>'query','')))>0 or strpos(p.user_id::text,coalesce(b->>'query',''))>0 order by p.nickname limit 50) x);
 elsif a='admin_logs' then
 return (select coalesce(jsonb_agg(x),'[]'::jsonb) from (select * from admin_audit_logs order by created_at desc,id desc limit 100) x);
 elsif a='admin_test' then
 if not (b->>'ball_id')=any(balls) then raise exception '잘못된 왁뿌볼입니다.'; end if;
 return jsonb_build_object('ball_id',b->>'ball_id','authorized',true);
 elsif a in ('admin_maintenance','admin_announcement') then
 select to_jsonb(z) into before_data from server_settings z where id=true for update;
 if a='admin_maintenance' then update server_settings set maintenance=(b->>'enabled')::boolean,message=coalesce(left(b->>'message',500),message) where id=true;
 elsif b->'clear'='true'::jsonb then
 update server_settings set announcement=null where id=true;
 else
 if coalesce(length(trim(b->>'message')),0) not between 1 and 500 then raise exception '공지는 1~500자입니다.'; end if;
 update server_settings set announcement=jsonb_build_object('message',b->>'message','author',u,'created_at',now()) where id=true;
 end if;
 select to_jsonb(z) into result from server_settings z where id=true;
 else
 if a not in ('admin_gold','admin_rebirths','admin_unban','admin_unlock','admin_discovery','admin_ban','admin_ranking_visibility') then raise exception '지원하지 않는 작업입니다.'; end if;
 t:=(b->>'user_id')::uuid;
 select * into s from game_states where user_id=t for update;
 if not found then raise exception '플레이어가 없습니다.'; end if;
 before_data:=wakppu_state_json(s)||jsonb_build_object('ranking_hidden',(select ranking_hidden from players where user_id=t),'moderation',(select to_jsonb(mc) from moderation_cases mc where user_id=t));
 if a in ('admin_gold','admin_rebirths') then
 if (coalesce(b->>'value','') !~ '^[0-9]+$' or length(coalesce(b->>'value',''))>4096) or mode not in ('add','subtract','set') then raise exception '올바른 정수와 변경 방식을 선택하세요.'; end if;
 amount:=(b->>'value')::numeric; val:=case when a='admin_gold' then s.gold else s.rebirths end;
 val:=case mode when 'add' then val+amount when 'subtract' then greatest(0,val-amount) else amount end;
 if val>(case when a='admin_gold' then power(10::numeric,4096)-1 else 1000 end) then raise exception '변경 범위를 초과했습니다.'; end if;
 if a='admin_gold' then update game_states set gold=val where user_id=t; else update game_states set rebirths=val::smallint where user_id=t; end if;
 elsif a='admin_ranking_visibility' then
 if jsonb_typeof(b->'hidden') is distinct from 'boolean' or length(coalesce(b->>'reason',''))>500 then raise exception '올바른 랭킹 숨김 여부와 사유가 필요합니다.'; end if;
 update players set ranking_hidden=(b->>'hidden')::boolean,updated_at=now() where user_id=t;
 elsif a='admin_ban' then
 if exists(select 1 from players where user_id=t and role='admin') then raise exception '관리자 계정은 밴할 수 없습니다.'; end if;
 ban_reason:=trim(coalesce(b->>'reason',''));
 if length(ban_reason) not between 1 and 500 or coalesce(mode,'') not in ('temporary','permanent') then raise exception '밴 종류와 1~500자 사유가 필요합니다.'; end if;
 if mode='temporary' then
 if coalesce(b->>'duration_hours','') !~ '^[0-9]{1,4}$' then raise exception '밴 기간은 1~8760시간입니다.'; end if;
 ban_hours:=(b->>'duration_hours')::integer;
 if ban_hours not between 1 and 8760 then raise exception '밴 기간은 1~8760시간입니다.'; end if;
 end if;
 insert into moderation_cases(user_id,status,suspended_until,last_reason,updated_at)
 values(t,case when mode='permanent' then 'banned' else 'suspended' end,case when mode='temporary' then now()+make_interval(hours=>ban_hours) else null end,ban_reason,now())
 on conflict(user_id) do update set status=excluded.status,suspended_until=excluded.suspended_until,last_reason=excluded.last_reason,updated_at=now();
 elsif a='admin_unban' then
 insert into moderation_cases(user_id,status,suspicion_score,strikes,suspended_until,last_reason,updated_at)
 values(t,'active',0,0,null,'관리자 밴 해제',now())
 on conflict(user_id) do update set status='active',suspicion_score=0,strikes=0,suspended_until=null,last_reason='관리자 밴 해제',updated_at=now();
 else
 idx:=array_position(balls,b->>'ball_id');
 if mode not in ('one','all','reset_one','reset_all') or (mode in ('one','reset_one') and idx is null) then raise exception '잘못된 도감 작업입니다.'; end if;
 ids:=case when mode='all' then to_jsonb(balls) when a='admin_unlock' then to_jsonb(balls[1:idx]) else jsonb_build_array(b->>'ball_id') end;
 if a='admin_unlock' then
 if mode not in ('one','all') then raise exception '잘못된 해금 작업입니다.'; end if;
 update game_states set unlocked_ball_ids=(select jsonb_agg(distinct x) from jsonb_array_elements(unlocked_ball_ids||ids) x),discovered_ball_ids=(select jsonb_agg(distinct x) from jsonb_array_elements(discovered_ball_ids||ids) x) where user_id=t;
 elsif mode='reset_all' then update game_states set discovered_ball_ids='[]' where user_id=t;
 elsif mode='reset_one' then update game_states set discovered_ball_ids=discovered_ball_ids-(b->>'ball_id') where user_id=t;
 else update game_states set discovered_ball_ids=(select jsonb_agg(distinct x) from jsonb_array_elements(discovered_ball_ids||ids) x) where user_id=t;
 end if;
 end if;
 update game_states set admin_revision=admin_revision+1,updated_at=now() where user_id=t;
 select jsonb_build_object('id',p.user_id,'nickname',p.nickname,'ranking_hidden',p.ranking_hidden,'state',wakppu_state_json(g),'moderation',to_jsonb(mc)) into result from players p join game_states g using(user_id) left join moderation_cases mc using(user_id) where p.user_id=t;
 end if;
 insert into admin_audit_logs(admin_user_id,target_user_id,action,reason,details) values(u,t,upper(a),coalesce(nullif(trim(b->>'reason'),''),'관리자 패널'),jsonb_build_object('before',before_data,'after',result));
 return case when t is null then jsonb_build_object('ok',true) else jsonb_build_object('target',result) end;
exception when unique_violation then raise sqlstate 'PT409' using message='이미 사용 중인 닉네임입니다.';
end
$function$
;

CREATE OR REPLACE FUNCTION public.wakppu_track_new_guest()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
 if new.is_anonymous then
  insert into guest_lifecycle(user_id,created_at) values(new.id,coalesce(new.created_at,now())) on conflict do nothing;
 end if;
 return new;
end $function$
;

CREATE OR REPLACE FUNCTION public.wakppu_guest_accounts()
 RETURNS TABLE(id uuid, nickname text, created_at timestamp with time zone, first_play_at timestamp with time zone, eligible boolean, exemption text, hide_at timestamp with time zone, delete_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
 select l.user_id,p.nickname,l.created_at,l.first_play_at,
  l.first_play_at is null and coalesce(u.is_anonymous,false) and coalesce(u.email,'')='' and coalesce(u.raw_user_meta_data->>'wakppu_email_link_pending','false')<>'true' and p.role<>'admin' and not exists(select 1 from admin_audit_logs a where a.admin_user_id=l.user_id) and not exists(select 1 from public.wakppu_developer_keepsakes k where k.user_id=l.user_id) /* developer_keepsake_lifecycle_guard */ and not exists(select 1 from public.wakppu_purchase_orders po where po.user_id=l.user_id and po.source='admin_grant') /* admin_paid_lifecycle_guard */,
  case when p.role='admin' then '관리자' when exists(select 1 from public.wakppu_developer_keepsakes k where k.user_id=l.user_id) then '개발자 소장품 지급 이력' when exists(select 1 from public.wakppu_purchase_orders po where po.user_id=l.user_id and po.source='admin_grant') then '관리자 지급 이력' when l.first_play_at is not null then '플레이 기록 있음'
   when not coalesce(u.is_anonymous,false) or coalesce(u.email,'')<>'' or coalesce(u.raw_user_meta_data->>'wakppu_email_link_pending','false')='true' then '이메일 연결'
   when exists(select 1 from admin_audit_logs a where a.admin_user_id=l.user_id) then '관리자 작업 기록 있음' else null end,
  l.created_at+interval '30 minutes',l.created_at+interval '3 days'
 from guest_lifecycle l join auth.users u on u.id=l.user_id join players p on p.user_id=l.user_id
$function$
;

CREATE OR REPLACE FUNCTION public.wakppu_api_before_pumpkin_skins(b jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare a text:=b->>'action';u uuid:=auth.uid();t uuid;reason text;rid uuid;o public.wakppu_purchase_orders;p public.wakppu_purchase_products;new_id uuid;
begin
 if a is null or a not in ('admin_paid_status','admin_paid_grant','admin_paid_revoke') then return public.wakppu_api_before_admin_paid_grants(b);end if;
 if u is null then raise sqlstate 'PT401';end if;
 perform public.wakppu_api_before_admin_paid_grants('{"action":"bootstrap"}');
 if not exists(select 1 from public.players pl join auth.users au on au.id=pl.user_id where pl.user_id=u and pl.role='admin' and not coalesce(au.is_anonymous,true)) then raise sqlstate 'PT403' using message='관리자 권한이 필요합니다.';end if;
 t:=(b->>'user_id')::uuid;if t is null or not exists(select 1 from public.players where user_id=t) then raise sqlstate 'PT404' using message='대상 계정을 확인하세요.';end if;
 perform pg_advisory_xact_lock(hashtextextended(t::text,19));
 if a='admin_paid_status' then return public.wakppu_admin_paid_snapshot(t);end if;
 reason:=trim(coalesce(b->>'reason',''));if length(reason)<3 or length(reason)>200 then raise sqlstate 'PT400' using message='지급·회수 사유를 3~200자로 입력하세요.';end if;
 if a='admin_paid_grant' then
  rid:=(b->>'request_id')::uuid;if rid is null then raise sqlstate 'PT400';end if;
  select * into o from public.wakppu_purchase_orders where user_id=t and request_id=rid;
  if found then
   if o.source<>'admin_grant' or o.product_id is distinct from b->>'product_id' then raise sqlstate 'PT409';end if;
   return public.wakppu_admin_paid_snapshot(t);
  end if;
  select * into p from public.wakppu_purchase_products where id=b->>'product_id';if not found then raise sqlstate 'PT400';end if;
  if exists(select 1 from public.wakppu_purchase_entitlements where user_id=t and product_id=p.id) then raise sqlstate 'PT409' using message='이미 보유한 상품입니다.';end if;
  if p.id='supporter_pack' and public.wakppu_supporter_percent(t)=30 then raise sqlstate 'PT409' using message='프리미엄에 포함된 혜택입니다.';end if;
  if p.id='first_steps_pack' and exists(select 1 from public.wakppu_first_steps_grants where user_id=t) then raise sqlstate 'PT409' using message='첫걸음 성장팩은 계정당 한 번만 지급할 수 있습니다.';end if;
  if exists(select 1 from public.wakppu_purchase_orders where user_id=t and product_id=p.id and status in ('pending','claimed')) then raise sqlstate 'PT409' using message='입금 대기 주문이 있습니다. 실제 입금 여부를 먼저 확인하세요.';end if;
  insert into public.wakppu_purchase_orders(user_id,request_id,product_id,product_name,amount,depositor,bank,status,approved_at,approved_by,source)
   values(t,rid,p.id,p.name,0,'관리자 직접 지급','{}','approved',clock_timestamp(),u,'admin_grant') returning id into new_id;
  insert into wakppu_purchase_entitlements(user_id,product_id,order_id) values(t,p.id,new_id);
  insert into public.admin_audit_logs(admin_user_id,target_user_id,action,reason,details) values(u,t,a,reason,jsonb_build_object('order_id',new_id,'product_id',p.id,'source','admin_grant','amount',0));
 else
  select * into o from public.wakppu_purchase_orders where id=(b->>'order_id')::uuid and user_id=t for update;
  if not found or o.source<>'admin_grant' then raise sqlstate 'PT404';end if;
  if o.status='revoked' then return public.wakppu_admin_paid_snapshot(t);end if;
  if o.status<>'approved' then raise sqlstate 'PT409';end if;
  if exists(select 1 from public.wakppu_purchase_entitlements e join public.wakppu_purchase_orders q on q.id=e.order_id where q.supporter_upgrade_order_id=o.id) then raise sqlstate 'PT409' using message='이 응원팩으로 업그레이드한 프리미엄을 먼저 회수·환불하세요.';end if;
  delete from public.wakppu_purchase_entitlements where order_id=o.id;
  update public.wakppu_purchase_orders set status='revoked' where id=o.id;
  if o.product_id='starlight_skin' then update public.wakppu_purchase_cosmetics set equipped=false where user_id=t;end if;
  insert into public.admin_audit_logs(admin_user_id,target_user_id,action,reason,details) values(u,t,a,reason,jsonb_build_object('order_id',o.id,'product_id',o.product_id,'source','admin_grant'));
 end if;
 return public.wakppu_admin_paid_snapshot(t);
end $function$
;

CREATE OR REPLACE FUNCTION public.wakppu_api_before_guest_lifecycle(b jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
 actor uuid:=auth.uid(); role_name text; settings server_settings;
 previous jsonb; next_event jsonb; result jsonb; instant timestamptz:=clock_timestamp();
 event_multiplier integer; duration_seconds integer; delay_seconds integer;
begin
 if b->>'action'='admin_gold_event' then
  select role into role_name from players where user_id=actor;
  if actor is null or role_name is null then raise sqlstate 'PT401' using message='로그인이 필요합니다.'; end if;
  if role_name<>'admin' or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) then raise sqlstate 'PT403' using message='관리자 권한이 필요합니다.'; end if;
  if exists(select 1 from moderation_cases where user_id=actor and (status='banned' or (status='suspended' and (suspended_until is null or suspended_until>instant)))) then raise sqlstate 'PT403' using message='이용 제한 계정입니다.'; end if;
  if coalesce(b->>'mode','') not in ('start','stop') then raise sqlstate 'PT400' using message='이벤트 작업을 선택하세요.'; end if;
  select * into settings from server_settings where id=true for update;
  instant:=clock_timestamp();previous:=settings.gold_event;
  if b->>'mode'='start' then
   if settings.maintenance then raise sqlstate 'PT409' using message='점검 모드를 끈 뒤 이벤트를 시작하세요.'; end if;
   if previous is not null and (previous->>'ends_at')::timestamptz>instant then raise sqlstate 'PT409' using message='이미 예고/진행 중인 이벤트가 있습니다.'; end if;
   if coalesce(b->>'multiplier','10') !~ '^[0-9]{1,4}$'
    or coalesce(b->>'duration_seconds','60') !~ '^[0-9]{1,5}$'
    or coalesce(b->>'delay_seconds','30') !~ '^[0-9]{1,5}$' then raise sqlstate 'PT400' using message='배율과 시간은 정수로 입력하세요.'; end if;
   event_multiplier:=coalesce(b->>'multiplier','10')::integer;
   duration_seconds:=coalesce(b->>'duration_seconds','60')::integer;
   delay_seconds:=coalesce(b->>'delay_seconds','30')::integer;
   if event_multiplier not between 1 and 1000 or duration_seconds not between 1 and 86400 or delay_seconds not between 0 and 86400 then raise sqlstate 'PT400' using message='배율은 1~1000배, 진행은 1~86400초, 대기는 0~86400초입니다.'; end if;
   next_event:=jsonb_build_object('id',gen_random_uuid(),'multiplier',event_multiplier,'starts_at',instant+make_interval(secs=>delay_seconds),'ends_at',instant+make_interval(secs=>delay_seconds+duration_seconds));
  else next_event:=null;
  end if;
  update server_settings set gold_event=next_event where id=true;
  insert into admin_audit_logs(admin_user_id,target_user_id,action,reason,details)
   values(actor,null,'ADMIN_GOLD_EVENT_'||upper(b->>'mode'),'전체 골드 타임',jsonb_build_object('before',previous,'after',next_event));
  return jsonb_build_object('ok',true,'gold_event',next_event,'server_time',instant);
 end if;
 result:=public.wakppu_api_before_events(b);
 if b->>'action'='status' then
  select * into settings from server_settings where id=true;
  return result||jsonb_build_object('gold_event',case when settings.maintenance then null else settings.gold_event end,'server_time',clock_timestamp());
 end if;
 return result;
end $function$
;

CREATE OR REPLACE FUNCTION public.wakppu_guest_cleanup_enabled()
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare enabled boolean:=false;
begin
 if to_regclass('cron.job') is not null then
  execute 'select exists(select 1 from cron.job where jobname=''wakppu-unplayed-guest-cleanup'' and active)' into enabled;
 end if;
 return enabled;
end $function$
;

CREATE OR REPLACE FUNCTION public.wakppu_sleep_hours(instant timestamp with time zone)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
 with local_time as (select instant at time zone 'Asia/Seoul' as t), schedule as (
  select t,extract(hour from t)>=23 or extract(hour from t)<6 as active,
   date_trunc('day',t)+case when extract(hour from t)<6 then interval '6 hours' else interval '30 hours' end as opens
  from local_time
 ) select jsonb_build_object('active',active,'next_open_at',opens at time zone 'Asia/Seoul',
  'next_change_at',(case when active then opens else date_trunc('day',t)+interval '23 hours' end) at time zone 'Asia/Seoul') from schedule;
$function$
;

CREATE OR REPLACE FUNCTION public.wakppu_api_before_sleep(b jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare actor uuid:=auth.uid(); role_name text; previous text; selected text; result jsonb;
begin
  if b->>'action'='admin_background' then
    if actor is null then raise sqlstate 'PT401' using message='로그인이 필요합니다.'; end if;
    select role into role_name from players where user_id=actor;
    if role_name is distinct from 'admin' or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) then
      raise sqlstate 'PT403' using message='관리자 권한이 필요합니다.';
    end if;
    perform public.wakppu_api_before_background('{"action":"bootstrap"}'::jsonb);
    selected:=b->>'mode';
    if selected is null or selected not in ('auto','default','halloween') then
      raise sqlstate 'PT400' using message='배경 설정을 선택하세요.';
    end if;
    select background_mode into previous from server_settings where id=true for update;
    update server_settings set background_mode=selected where id=true;
    insert into admin_audit_logs(admin_user_id,action,reason,details)
      values(actor,'ADMIN_BACKGROUND','전체 배경 변경',jsonb_build_object('before',previous,'after',selected));
    return jsonb_build_object('ok',true,'background_mode',selected,'server_time',clock_timestamp());
  end if;
  result:=public.wakppu_api_before_background(b);
  if b->>'action'='status' then
    return result||jsonb_build_object('background_mode',(select background_mode from server_settings where id=true),'server_time',clock_timestamp());
  end if;
  return result;
end $function$
;

CREATE OR REPLACE FUNCTION public.wakppu_cleanup_unplayed_guests()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare candidate record; removed integer:=0;
begin
 for candidate in
  select u.id from auth.users u join guest_lifecycle l on l.user_id=u.id join players p on p.user_id=u.id
  where l.first_play_at is null and l.created_at<=now()-interval '3 days' and u.is_anonymous and coalesce(u.email,'')=''
   and coalesce(u.raw_user_meta_data->>'wakppu_email_link_pending','false')<>'true' and p.role<>'admin'
   and not exists(select 1 from admin_audit_logs a where a.admin_user_id=u.id) and not exists(select 1 from public.wakppu_developer_keepsakes k where k.user_id=u.id) /* developer_keepsake_lifecycle_guard */ and not exists(select 1 from public.wakppu_purchase_orders po where po.user_id=u.id and po.source='admin_grant') /* admin_paid_lifecycle_guard */
  order by l.created_at limit 100 for update of u,l,p skip locked
 loop
  -- Preserve audit history while releasing the target FK; never delete audit records.
  update admin_audit_logs set target_user_id=null,details=coalesce(details,'{}'::jsonb)||jsonb_build_object('deleted_target_user_id',candidate.id) where target_user_id=candidate.id;
  delete from auth.users where id=candidate.id;
  removed:=removed+1;
 end loop;
 return removed;
end $function$
;

CREATE OR REPLACE FUNCTION public.wakppu_hammer_damage(owned boolean, level integer)
 RETURNS integer
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare damage integer; i integer;
begin
 if not coalesce(owned,false) or level is null or level not between 1 and 30 then return 1; end if;
 if level<=10 then return (array[3,5,8,12,18,27,40,60,90,135])[level]; end if;
 damage:=135;
 for i in 11..level loop damage:=ceil(damage::numeric*1.5)::integer; end loop;
 return damage;
end $function$
;

CREATE OR REPLACE FUNCTION public.wakppu_api_before_admin_ball(b jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare actor uuid:=auth.uid(); result jsonb; filter_name text:=coalesce(b->>'filter','unplayed'); page_number integer; query_text text:=coalesce(b->>'query',''); previous_state game_states;
begin
 if b->>'action' in ('mark_first_play','save_progress') and actor is not null then
  -- Same lock order as cleanup; serializes play/email updates with deletion.
  perform 1 from auth.users where id=actor for update;
  perform 1 from guest_lifecycle where user_id=actor for update;
  if b->>'action'='save_progress' then select * into previous_state from game_states where user_id=actor; end if;
 end if;
 if b->>'action' in ('mark_first_play','admin_guest_accounts') then
  -- Reuse existing login, anonymous-admin, maintenance and ban checks.
  result:=wakppu_api_before_guest_lifecycle(jsonb_build_object('action',case when b->>'action'='mark_first_play' then 'bootstrap' else 'admin_search' end,'query',''));
  if b->>'action'='mark_first_play' then
   update guest_lifecycle set first_play_at=coalesce(first_play_at,now()) where user_id=actor;
   return jsonb_build_object('ok',true);
  end if;
  if filter_name not in ('all','unplayed','hidden','due','protected') or length(query_text)>100 or coalesce(b->>'page','0') !~ '^[0-9]{1,6}$' then raise exception '잘못된 조회 조건입니다.'; end if;
  page_number:=coalesce(b->>'page','0')::integer;
  with matches as (
   select * from wakppu_guest_accounts() g where
    (strpos(lower(g.nickname),lower(query_text))>0 or strpos(g.id::text,query_text)>0) and
    (filter_name='all' or (filter_name='unplayed' and g.eligible) or (filter_name='hidden' and g.eligible and g.hide_at<=now()) or (filter_name='due' and g.eligible and g.delete_at<=now()) or (filter_name='protected' and not g.eligible))
  ), rows as (select * from matches order by created_at,id limit 50 offset page_number*50)
  select jsonb_build_object('total',(select count(*) from matches),'page',page_number,'rows',coalesce((select jsonb_agg(to_jsonb(rows)||jsonb_build_object('ranking_excluded',eligible and hide_at<=now(),'delete_due',eligible and delete_at<=now()) order by created_at,id) from rows),'[]'::jsonb),'server_time',now(),'cleanup_enabled',wakppu_guest_cleanup_enabled()) into result;
  return result;
 end if;
 if b->>'action'='rankings' then
  perform wakppu_api_before_guest_lifecycle(jsonb_build_object('action','bootstrap'));
  return (select coalesce(jsonb_agg(x),'[]'::jsonb) from (
   select p.nickname,g.gold::text as gold,g.rebirths from game_states g join players p using(user_id)
   where not p.ranking_hidden and not exists(select 1 from moderation_cases m where m.user_id=p.user_id and (m.status='banned' or (m.status='suspended' and (m.suspended_until is null or m.suspended_until>now()))))
    and not exists(select 1 from wakppu_guest_accounts() c where c.id=p.user_id and c.eligible and c.hide_at<=now())
   order by g.rebirths desc,g.gold desc,g.user_id limit 100) x);
 end if;
 result:=wakppu_api_before_guest_lifecycle(b);
 if b->>'action'='save_progress' and (b->'play_occurred'='true'::jsonb or (coalesce((b->>'current_clicks')::integer,0)>0) or (coalesce((b->>'rebirths')::integer,0)>0)
  or (previous_state.progress_imported_at is null and (b->>'gold')::numeric>0)
  or (previous_state.progress_imported_at is not null and previous_state.gold<>(b->>'gold')::numeric)) then
  update guest_lifecycle set first_play_at=coalesce(first_play_at,now()) where user_id=actor;
 end if;
 return result;
end $function$
;

CREATE OR REPLACE FUNCTION public.wakppu_api_before_items(b jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare a text:=b->>'action'; u uuid:=auth.uid(); role_name text; result jsonb; settings server_settings;
 e jsonb; previous jsonb; instant timestamptz; duration integer; delay integer;
 s game_states; p wakppu_event_ball_progress; hits integer; total integer; damage integer; reward numeric:=0; best numeric; multiplier integer:=1;
begin
 if a='admin_ball_event' then
  if u is null then raise sqlstate 'PT401' using message='로그인이 필요합니다.'; end if;
  select role into role_name from players where user_id=u;
  if role_name is distinct from 'admin' or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) then raise sqlstate 'PT403' using message='관리자 권한이 필요합니다.'; end if;
  perform public.wakppu_api_before_admin_ball(jsonb_build_object('action','bootstrap'));
  if coalesce(b->>'mode','') not in ('start','stop') then raise sqlstate 'PT400' using message='이벤트 작업을 선택하세요.'; end if;
  select * into settings from server_settings where id=true for update;instant:=clock_timestamp();previous:=settings.admin_ball_event;
  if b->>'mode'='start' then
   if settings.maintenance or (previous->>'ends_at')::timestamptz>instant then raise sqlstate 'PT409' using message='점검 또는 기존 이벤트를 종료해주세요.'; end if;
   if coalesce(b->>'duration_seconds','300')!~'^[0-9]{1,5}$' or coalesce(b->>'delay_seconds','0')!~'^[0-9]{1,5}$' then raise sqlstate 'PT400' using message='시간은 정수로 입력하세요.'; end if;
   duration:=coalesce((b->>'duration_seconds')::integer,300);delay:=coalesce((b->>'delay_seconds')::integer,0);
   if duration not between 1 and 86400 or delay not between 0 and 86400 then raise sqlstate 'PT400' using message='시간 범위를 확인해주세요.'; end if;
   e:=jsonb_build_object('id',gen_random_uuid(),'starts_at',instant+make_interval(secs=>delay),'ends_at',instant+make_interval(secs=>delay+duration));
  end if;
  update server_settings set admin_ball_event=e where id=true;
  -- Old progress is no longer reachable after a new event and does not need to accumulate.
  delete from wakppu_event_ball_progress where event_id not like 'weekly:%' and event_id<>'admin-always' and event_id is distinct from e->>'id';
  insert into admin_audit_logs(admin_user_id,action,reason,details) values(u,'ADMIN_BALL_EVENT_'||upper(b->>'mode'),'관리자 왁뿌볼 이벤트',jsonb_build_object('before',previous,'after',e));
  return jsonb_build_object('ok',true,'admin_ball_event',e,'server_time',instant);
 elsif a='event_ball_hit' then
  -- Reuse account, moderation and maintenance enforcement from the existing API.
  perform public.wakppu_api_before_admin_ball(jsonb_build_object('action','bootstrap'));
  select * into settings from server_settings where id=true for share;instant:=clock_timestamp();e:=settings.admin_ball_event;
  select role into role_name from players where user_id=u;
  if b->>'event_id'='admin-always' and role_name='admin' and not coalesce((auth.jwt()->>'is_anonymous')::boolean,false) then
   e:=jsonb_build_object('id','admin-always','starts_at',instant-interval '1 second','ends_at',instant+interval '1 second');
  end if;
  if (settings.maintenance and e->>'id' is distinct from 'admin-always') or e is null or e->>'id' is distinct from b->>'event_id' or instant<(e->>'starts_at')::timestamptz or instant>=(e->>'ends_at')::timestamptz then raise sqlstate 'PT409' using message='관리자 볼 이벤트가 종료되었거나 아직 시작되지 않았습니다.'; end if;
  if coalesce(b->>'request_id','')!~'^[a-f0-9-]{36}$' then raise sqlstate 'PT400' using message='잘못된 타격 요청입니다.'; end if;
  select * into s from game_states where user_id=u for update;
  insert into wakppu_event_ball_progress(user_id,event_id) values(u,e->>'id') on conflict do nothing;
  select * into p from wakppu_event_ball_progress where user_id=u and event_id=e->>'id' for update;
  if p.request_id=b->>'request_id' then return p.response; end if;
  damage:=public.wakppu_hammer_damage(s.hammer_owned,least(s.hammer_level,coalesce(s.hammer_selected_level,s.hammer_level)));
  total:=case when s.coating_expires_at>instant then 1200 else 600 end; hits:=least(total,p.clicks+damage);
  if hits=total then
   select coalesce(max(c.reward),1) into best from wakppu_ball_rewards c where s.unlocked_ball_ids ? c.ball_id;
   if settings.gold_event is not null and instant>=(settings.gold_event->>'starts_at')::timestamptz and instant<(settings.gold_event->>'ends_at')::timestamptz then multiplier:=(settings.gold_event->>'multiplier')::integer; end if;
   reward:=public.wakppu_supporter_reward(u,trunc(best*10*power(2::numeric,s.rebirths)*(case when s.honey_expires_at>instant then 2 else 1 end)*multiplier*(case when s.coating_expires_at>instant then 3 else 1 end)));
   update game_states set gold=gold+reward,updated_at=instant where user_id=u returning * into s;
  end if;
  perform public.wakppu_api_before_admin_ball(jsonb_build_object('action','mark_first_play'));
  result:=jsonb_build_object('clicks',hits,'required_clicks',total,'reward',reward::text,'gold',trunc(s.gold)::text);
  update wakppu_event_ball_progress set clicks=case when hits=total then 0 else hits end,request_id=b->>'request_id',response=result where user_id=u and event_id=e->>'id';
  return result;
 end if;
 result:=public.wakppu_api_before_admin_ball(b);
 if a='status' then
  select * into settings from server_settings where id=true;
  return result||jsonb_build_object('admin_ball_event',case when settings.maintenance then null else settings.admin_ball_event end,'admin_ball_always',exists(select 1 from players where user_id=auth.uid() and role='admin') and not coalesce((auth.jwt()->>'is_anonymous')::boolean,false));
 end if;
 return result;
end$function$
;

CREATE OR REPLACE FUNCTION public.wakppu_api_before_event_schedule(b jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare u uuid:=auth.uid(); a text:=b->>'action'; s public.game_states%rowtype; inv public.wakppu_items%rowtype; d public.wakppu_item_defs%rowtype; stat jsonb; result jsonb; cached jsonb; ids text[]; rank_name text; n integer; cost numeric; roll bigint; chosen text; results jsonb:='[]'; instant timestamptz:=clock_timestamp(); ms bigint:=floor(extract(epoch from instant)*1000);
 expires bigint; charges bigint; channel text; multiplier numeric; honey numeric:=1; bonus numeric:=1; damage_mult numeric:=1; addition numeric:=0; difficulty numeric:=1;
 winners jsonb:='{}'; it record; total_hits bigint; hits bigint; damage bigint; base_reward numeric; earned numeric:=0; event jsonb; event_key text:=b->>'event_id'; ball text; previous jsonb; old_rebirth integer;
begin
 if a='item_hit' and coalesce(b->>'event_id','')='' and exists(select 1 from public.wakppu_gem_ball_players gp where gp.user_id=u and gp.selected is not null and (gp.owned ? gp.selected or public.wakppu_admin_content_access())) then
  return public.wakppu_gem_ball_hit(b);
 end if;
 if a not in ('items','item_draw','item_use','item_hit','save_progress') then return public.wakppu_api_before_items(b); end if;
 if u is null then raise sqlstate 'PT401' using message='로그인이 필요합니다.'; end if;
 -- Reuse the existing authentication, maintenance and moderation checks.
 previous:=public.wakppu_api_before_items(jsonb_build_object('action','bootstrap'));
 select * into s from public.game_states where user_id=u for update;
 insert into public.wakppu_items(user_id) values(u) on conflict do nothing;
 select * into inv from public.wakppu_items where user_id=u for update;
 if a='save_progress' then
  if coalesce((b->>'item_revision')::bigint,0)<>s.item_revision then raise sqlstate 'PT409' using message='아이템 상태를 다시 불러옵니다.'; end if;
  old_rebirth:=s.rebirths;result:=public.wakppu_api_before_items(b);
  if coalesce((b->>'current_clicks')::bigint,0) not between 0 and 1000000000 then raise exception '잘못된 타격 진행도'; end if;
  update public.game_states set item_current_clicks=coalesce((b->>'current_clicks')::bigint,0) where user_id=u;
  if (b->>'rebirths')::integer>old_rebirth then update public.wakppu_items set effects='{}' where user_id=u; end if;
  return result;
 end if;
 if a<>'items' then
  if coalesce(b->>'request_id','') !~ '^[a-f0-9-]{36}$' then raise exception '잘못된 요청 ID'; end if;
  select response,action into cached,chosen from public.wakppu_item_requests where user_id=u and request_id=(b->>'request_id')::uuid;
  if found then if chosen<>a then raise exception '요청 ID 충돌'; end if;return cached;end if;
  if (b->>'item_revision') is null or (b->>'item_revision')::bigint<>s.item_revision then raise sqlstate 'PT409' using message='아이템 상태를 다시 불러옵니다.'; end if;
 end if;
 if a='item_draw' then
  n:=(b->>'count')::integer;cost:=case n when 1 then 5000000000000000000 when 3 then 14000000000000000000 when 5 then 22000000000000000000 end;
  if cost is null then raise exception '뽑기 횟수 오류'; end if;
  if s.gold<cost then raise exception 'Gold가 부족합니다.';end if;
  for i in 1..n loop
   if inv.pity=99 then rank_name:='transcendent';
   else
    roll:=floor(('x'||substr(replace(gen_random_uuid()::text,'-',''),1,8))::bit(32)::bigint::numeric/4294967296*10000);
    if (select sum(weight) from public.wakppu_item_ranks)<>10000 then raise exception '확률 설정 오류';end if;
    select r.rank into rank_name from (select rank,sum(weight) over(order by position) as edge from public.wakppu_item_ranks) r where roll<r.edge order by r.edge limit 1;
   end if;
   select array_agg(item_id order by item_id) into ids from public.wakppu_item_defs where rank=rank_name;
   roll:=floor(('x'||substr(replace(gen_random_uuid()::text,'-',''),1,8))::bit(32)::bigint::numeric/4294967296*array_length(ids,1));chosen:=ids[roll+1];
   inv.inventory:=jsonb_set(inv.inventory,array[chosen],to_jsonb(coalesce((inv.inventory->>chosen)::bigint,0)+1));
   inv.pity:=case when rank_name='transcendent' then 0 else inv.pity+1 end;inv.total:=inv.total+1;results:=results||jsonb_build_array(chosen);
  end loop;
  s.gold:=s.gold-cost;
 elsif a='item_use' then
  select * into d from public.wakppu_item_defs where item_id=b->>'item_id';
  if not found or (not public.wakppu_admin_content_access() and coalesce((inv.inventory->>d.item_id)::bigint,0)<=0) then raise exception '보유한 아이템이 없습니다.'; end if;
  if d.seconds>0 then
   expires:=greatest(ms,coalesce((inv.effects->d.item_id->>'expires_at')::bigint,0))+d.seconds::bigint*1000;
   if expires>ms+604800000 then raise exception '최대 연장 시간은 7일입니다.'; end if;
   inv.effects:=jsonb_set(inv.effects,array[d.item_id],jsonb_build_object('expires_at',expires));
  else
   inv.effects:=jsonb_set(inv.effects,array[d.item_id],jsonb_build_object('remaining',coalesce((inv.effects->d.item_id->>'remaining')::bigint,0)+d.charges));
  end if;
  if not public.wakppu_admin_content_access() then inv.inventory:=jsonb_set(inv.inventory,array[d.item_id],to_jsonb((inv.inventory->>d.item_id)::bigint-1));end if;
 elsif a='item_hit' then
  honey:=case when s.honey_expires_at>instant then 2 else 1 end;
  bonus:=case when s.coating_expires_at>instant then 3 else 1 end;
  winners:=public.wakppu_item_winners(inv.effects,ms);
  bonus:=bonus*coalesce((winners->'reward'->>'value')::numeric/100,1);
  addition:=0;damage_mult:=1;difficulty:=1;
  ball:=s.selected_ball_id;hits:=s.item_current_clicks;
  if event_key is not null then
   stat:=public.wakppu_api_before_items(jsonb_build_object('action','status'));event:=stat->'admin_ball_event';
   if not (event_key='admin-always' and coalesce((stat->>'admin_ball_always')::boolean,false)) and
    (event is null or event='null'::jsonb or event->>'id'<>event_key or instant<(event->>'starts_at')::timestamptz or instant>=(event->>'ends_at')::timestamptz) then raise sqlstate 'PT409' using message='이벤트가 종료되었습니다.';end if;
   select coalesce(max(r.reward),1)*10 into base_reward from public.wakppu_ball_rewards r where s.unlocked_ball_ids ? r.ball_id;
   total_hits:=600;
   insert into public.wakppu_event_ball_progress(user_id,event_id) values(u,event_key) on conflict do nothing;
   select p.clicks into hits from public.wakppu_event_ball_progress p where p.user_id=u and p.event_id=event_key for update;
  else
   select clicks,reward into total_hits,base_reward from public.wakppu_item_balls where ball_id=ball;
   if total_hits is null or not s.unlocked_ball_ids ? ball then raise exception '왁뿌볼 오류';end if;
  end if;
  total_hits:=greatest(1,ceil(total_hits*(case when s.coating_expires_at>instant then 2 else 1 end)*difficulty));
  damage:=greatest(1,floor((public.wakppu_hammer_damage(s.hammer_owned,least(s.hammer_level,coalesce(s.hammer_selected_level,s.hammer_level)))+addition)*damage_mult));
  hits:=least(total_hits,hits+damage);
  if hits=total_hits then
   stat:=public.wakppu_api_before_items(jsonb_build_object('action','status'));event:=stat->'gold_event';multiplier:=1;
   if event is not null and event<>'null'::jsonb and instant>=(event->>'starts_at')::timestamptz and instant<(event->>'ends_at')::timestamptz then multiplier:=(event->>'multiplier')::numeric;end if;
   earned:=public.wakppu_supporter_reward(u,floor(base_reward*power(2::numeric,s.rebirths)*honey*bonus*multiplier));s.gold:=s.gold+earned;
  end if;
  for it in select distinct value->>'id' as id from jsonb_each(winners) where value ? 'id' loop
   select * into d from public.wakppu_item_defs where item_id=it.id;
   if d.seconds=0 and (d.unit='hit' or hits=total_hits) then inv.effects:=jsonb_set(inv.effects,array[d.item_id,'remaining'],to_jsonb(greatest(0,(inv.effects->d.item_id->>'remaining')::bigint-1)));end if;
  end loop;
  if event_key is not null then update public.wakppu_event_ball_progress p set clicks=case when hits=total_hits then 0 else hits end where p.user_id=u and p.event_id=event_key;
  else s.item_current_clicks:=case when hits=total_hits then 0 else hits end;end if;
 end if;
 if a<>'items' then
  s.item_revision:=s.item_revision+1;
  update public.game_states set gold=s.gold,item_revision=s.item_revision,item_current_clicks=s.item_current_clicks where user_id=u;
  update public.wakppu_items set inventory=inv.inventory,effects=inv.effects,pity=inv.pity,total=inv.total where user_id=u;
 end if;
 result:=jsonb_build_object('inventory',inv.inventory,'effects',inv.effects,'pity',inv.pity,'total',inv.total,'revision',s.item_revision,'gold',s.gold::text,'results',results);
 if a='item_hit' then result:=result||jsonb_build_object('clicks',hits,'required_clicks',total_hits,'reward',earned::text);end if;
 if a<>'items' then insert into public.wakppu_item_requests values(u,(b->>'request_id')::uuid,a,result);end if;
 return result;
end $function$
;

CREATE OR REPLACE FUNCTION public.wakppu_custom_commit(u uuid, b jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare s jsonb;expected bigint;rid uuid;fp jsonb;cached jsonb;t text;asset uuid;path text;img boolean;anonymous boolean;begin
 if coalesce(auth.jwt()->>'role','')<>'service_role' then raise sqlstate 'PT403';end if;
 select is_anonymous into anonymous from auth.users where id=u;if not found then raise sqlstate 'PT401';end if;
 perform pg_advisory_xact_lock(hashtextextended(u::text,19));
 perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated','is_anonymous',anonymous)::text,true);
 perform public.wakppu_api_before_custom_studio('{"action":"bootstrap"}');
 if b?'user_id' then raise sqlstate 'PT400';end if;
 rid:=(b->>'request_id')::uuid;if rid is null then raise sqlstate 'PT400';end if;
 fp:=b-'path';select request into cached from public.wakppu_custom_requests where user_id=u and request_id=rid;
 if found then if cached is distinct from fp then raise sqlstate 'PT409' using message='같은 저장 요청을 변경할 수 없습니다.';end if;return public.wakppu_custom_snapshot(u);end if;
 s:=public.wakppu_custom_snapshot(u);t:=b->>'target';
 if s->>'plan'='none' or not(t='@all' and s->>'plan'='all' or public.wakppu_custom_owned(u,t) and(s->>'plan'='all' or s->>'target'=t)) then raise sqlstate 'PT403' using message='이 볼에 적용할 이용권과 해금 상태를 확인하세요.';end if;
 insert into public.wakppu_custom_accounts(user_id) values(u) on conflict do nothing;
 select revision into expected from public.wakppu_custom_accounts where user_id=u for update;
 if (b->>'revision')::bigint is distinct from expected then raise sqlstate 'PT409' using message='다른 창에서 설정이 변경되었습니다. 다시 불러오세요.';end if;
 if(select count(*) from public.wakppu_custom_requests where user_id=u and created_at>clock_timestamp()-interval '1 minute')>=30 then raise sqlstate 'PT429' using message='저장이 너무 잦습니다. 잠시 후 다시 시도해주세요.';end if;
 if b->>'mode'='restore' then
  if t='@all' then delete from public.wakppu_custom_profiles where user_id=u;
  else insert into public.wakppu_custom_profiles(user_id,target,disabled) values(u,t,true) on conflict(user_id,target) do update set asset_id=null,effect=null,sound=null,disabled=true;end if;
 elsif b->>'mode'='save' then
  if public.wakppu_custom_preset(u,b->>'effect') is not true or public.wakppu_custom_preset(u,b->>'sound') is not true then raise sqlstate 'PT403' using message='보유한 연출과 사운드만 선택할 수 있습니다.';end if;
  img:=coalesce((b->>'new_image')::boolean,false);
  if img then
   asset:=rid;path:=u::text||'/'||rid::text||'.png';if b->>'path' is distinct from path then raise sqlstate 'PT400';end if;
   insert into public.wakppu_custom_assets(id,user_id,path,sha256,bytes) values(asset,u,path,b->>'sha256',(b->>'bytes')::integer);
  else asset:=(b->>'asset_id')::uuid;if not exists(select 1 from public.wakppu_custom_assets where id=asset and user_id=u) then raise sqlstate 'PT403';end if;end if;
  if t='@all' then delete from public.wakppu_custom_profiles where user_id=u;end if;
  insert into public.wakppu_custom_profiles(user_id,target,asset_id,effect,sound) values(u,t,asset,b->>'effect',b->>'sound') on conflict(user_id,target) do update set asset_id=excluded.asset_id,effect=excluded.effect,sound=excluded.sound,disabled=false;
 else raise sqlstate 'PT400';end if;
 update public.wakppu_custom_accounts set revision=revision+1,last_save=clock_timestamp() where user_id=u;
 delete from public.wakppu_custom_assets a where a.user_id=u and not exists(select 1 from public.wakppu_custom_profiles p where p.asset_id=a.id);
 if(select coalesce(sum(bytes),0) from public.wakppu_custom_assets where user_id=u)>33554432 then raise sqlstate 'PT413' using message='이미지 저장 용량을 초과했습니다. 사용하지 않는 커스텀을 복원해주세요.';end if;
 insert into public.wakppu_custom_requests(user_id,request_id,request) values(u,rid,fp);
 delete from public.wakppu_custom_requests where user_id=u and request_id in(select request_id from public.wakppu_custom_requests where user_id=u order by created_at desc offset 64);
 return public.wakppu_custom_snapshot(u);
end$function$
;

CREATE OR REPLACE FUNCTION public.wakppu_api_before_admin_content(b jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$begin return public.wakppu_separate_weekly_api(b);end$function$
;

CREATE OR REPLACE FUNCTION public.wakppu_gem_ball_snapshot(u uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare p public.wakppu_gem_ball_players%rowtype;access boolean;
begin
 if u is null or u is distinct from auth.uid() then raise sqlstate 'PT403';end if;
 access:=public.wakppu_admin_content_access();select * into p from public.wakppu_gem_ball_players where user_id=u;
 return jsonb_build_object('owned',coalesce(p.owned,'[]'),'selected',case when access or p.owned ? p.selected then p.selected end,
  'clicks',coalesce(p.clicks,0),'admin_access',access,
  'catalog',(select jsonb_agg(jsonb_build_object('id',ball_id,'name',name,'price',price::text,'clicks',clicks,'gem_reward',gem_reward::text) order by ball_id) from public.wakppu_gem_ball_defs));
end $function$
;

CREATE OR REPLACE FUNCTION public.wakppu_api_before_presence(b jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare a text:=b->>'action';u uuid:=auth.uid();instant timestamptz:=clock_timestamp();ms bigint:=floor(extract(epoch from instant)*1000);
 settings public.wakppu_limited_settings%rowtype;l public.wakppu_limited_players%rowtype;s public.game_states%rowtype;inv public.wakppu_items%rowtype;d public.wakppu_item_defs%rowtype;
 active boolean;result jsonb;previous jsonb;cached jsonb;cached_action text;info jsonb;earned numeric:=0;base_reward numeric;total_hits bigint;hits bigint;damage bigint;
 honey numeric:=1;bonus numeric:=1;damage_mult numeric:=1;addition numeric:=0;difficulty numeric:=1;multiplier numeric;winners jsonb:='{}';it record;stat jsonb;event jsonb;dropped boolean:=false;
begin
 if a not in ('limited','limited_buy','limited_select','limited_hit','item_hit') then return public.wakppu_api_before_limited(b);end if;
 previous:=public.wakppu_api_before_limited(jsonb_build_object('action','bootstrap'));
 select * into s from public.game_states where user_id=u for update;
 insert into public.wakppu_limited_players(user_id) values(u) on conflict do nothing;
 select * into l from public.wakppu_limited_players where user_id=u for update;
 select * into settings from public.wakppu_limited_settings where id=true;
 active:=instant>=settings.starts_at and instant<settings.ends_at;
 if a<>'limited' then
  if coalesce(b->>'request_id','') !~ '^[a-f0-9-]{36}$' then raise exception '잘못된 요청 ID';end if;
  select response,action into cached,cached_action from public.wakppu_limited_requests where user_id=u and request_id=(b->>'request_id')::uuid;
  if found then if cached_action<>a then raise exception '요청 ID 충돌';end if;return cached;end if;
  if coalesce((b->>'item_revision')::bigint,-1)<>s.item_revision then raise sqlstate 'PT409' using message='상태를 다시 불러옵니다.';end if;
 end if;
 if a='item_hit' then
  result:=public.wakppu_api_before_limited(b);
  if active and b->>'event_id' is null and (result->>'reward')::numeric>0 and (('x'||substr(replace(gen_random_uuid()::text,'-',''),1,8))::bit(32)::bigint)/4294967296.0<0.1 then l.tokens:=l.tokens+1;dropped:=true;end if;
 elsif a='limited_buy' then
  if not active then raise sqlstate 'PT409' using message='할로윈 이벤트 기간이 아닙니다.';end if;
  if l.owned ? 'halloween-pumpkin-2026' then raise sqlstate 'PT409' using message='이미 보유한 한정 볼입니다.';end if;
  if l.tokens<100 then raise exception '할로윈 사탕이 부족합니다.';end if;
  base_reward:=1500000000;
  l.tokens:=l.tokens-100;l.owned:=jsonb_set(l.owned,array['halloween-pumpkin-2026'],jsonb_build_object('reward',base_reward::text));
 elsif a='limited_select' then
  if not b ? 'ball_id' or (b->>'ball_id' is not null and not l.owned ? (b->>'ball_id') and not (public.wakppu_limited_admin() and b->>'ball_id'='halloween-pumpkin-2026')) then raise exception '보유한 한정 볼이 아닙니다.';end if;
  l.selected:=b->>'ball_id';l.clicks:=0;
 elsif a='limited_hit' then
  if l.selected is null or (not l.owned ? l.selected and not (public.wakppu_limited_admin() and l.selected='halloween-pumpkin-2026')) then raise exception '한정 볼을 선택해주세요.';end if;
  insert into public.wakppu_items(user_id) values(u) on conflict do nothing;
  select * into inv from public.wakppu_items where user_id=u for update;
  honey:=case when s.honey_expires_at>instant then 2 else 1 end;
  bonus:=case when s.coating_expires_at>instant then 3 else 1 end;
  winners:=public.wakppu_item_winners(inv.effects,ms);
  bonus:=bonus*coalesce((winners->'reward'->>'value')::numeric/100,1);
  addition:=0;damage_mult:=1;difficulty:=1;

  total_hits:=greatest(1,ceil(100*(case when s.coating_expires_at>instant then 2 else 1 end)*difficulty));
  damage:=greatest(1,floor((public.wakppu_hammer_damage(s.hammer_owned,least(s.hammer_level,coalesce(s.hammer_selected_level,s.hammer_level)))+addition)*damage_mult));hits:=least(total_hits,l.clicks+damage);
  if hits=total_hits then
   -- pumpkin_candy_drop_v1
   if active and l.selected='halloween-pumpkin-2026' and public.wakppu_pumpkin_candy_roll()<0.3 then l.tokens:=l.tokens+1;dropped:=true;end if;
   stat:=public.wakppu_api_before_limited(jsonb_build_object('action','status'));event:=stat->'gold_event';multiplier:=1;
   if event is not null and event<>'null'::jsonb and instant>=(event->>'starts_at')::timestamptz and instant<(event->>'ends_at')::timestamptz then multiplier:=(event->>'multiplier')::numeric;end if;
   earned:=public.wakppu_supporter_reward(u,floor(1500000000::numeric*power(2::numeric,s.rebirths)*honey*bonus*multiplier));s.gold:=s.gold+earned;
  end if;
  for it in select distinct value->>'id' as id from jsonb_each(winners) where value ? 'id' loop
   select * into d from public.wakppu_item_defs where item_id=it.id;
   if d.seconds=0 and (d.unit='hit' or hits=total_hits) then inv.effects:=jsonb_set(inv.effects,array[d.item_id,'remaining'],to_jsonb(greatest(0,(inv.effects->d.item_id->>'remaining')::bigint-1)));end if;
  end loop;

  update public.wakppu_items set effects=inv.effects where user_id=u;l.clicks:=case when hits=total_hits then 0 else hits end;
 end if;
 if a in ('limited_buy','limited_select','limited_hit') then update public.game_states set item_revision=item_revision+1,gold=s.gold where user_id=u;end if;
 if a not in ('limited','item_hit') then result:=public.wakppu_api_before_limited(jsonb_build_object('action','items'));end if;
 update public.wakppu_limited_players set tokens=l.tokens,owned=l.owned,selected=l.selected,clicks=l.clicks where user_id=u;
 info:=jsonb_build_object('admin_access',public.wakppu_limited_admin(),'season',jsonb_build_object('id','halloween-2026','name','🎃 할로윈 2026','starts_at',settings.starts_at,'ends_at',settings.ends_at,'active',active,'dropChance',0.1,'pumpkinDropChance',0.3,'cost',100),'tokens',l.tokens,'owned',l.owned,'selected',case when l.owned ? l.selected or (public.wakppu_limited_admin() and l.selected='halloween-pumpkin-2026') then l.selected else null end,'clicks',l.clicks);
 if a='limited' then return info;end if;
 result:=result||jsonb_build_object('limited',info,'candy_drop',dropped);
 if a='limited_hit' then result:=result||jsonb_build_object('clicks',hits,'required_clicks',total_hits,'reward',earned::text);end if;
 insert into public.wakppu_limited_requests values(u,(b->>'request_id')::uuid,a,result);return result;
end $function$
;

CREATE OR REPLACE FUNCTION public.wakppu_admin_content_access()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
 select auth.uid() is not null
 and exists(select 1 from public.players where user_id=auth.uid() and role='admin')
 and not coalesce((auth.jwt()->>'is_anonymous')::boolean,false)
$function$
;

CREATE OR REPLACE FUNCTION public.wakppu_api_before_purchases(b jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare u uuid:=auth.uid();a text:=b->>'action';g public.game_states%rowtype;s public.wakppu_skins%rowtype;d public.wakppu_skin_defs%rowtype;
 access boolean;admin_skin_catalog jsonb;prior jsonb;result jsonb;cached public.wakppu_skin_requests%rowtype;fingerprint jsonb;rid uuid;roll bigint;duplicate boolean:=false;awarded integer:=0;cost numeric:=220000000000000000000;
begin
 if a is null or a not in ('skins','skin_draw','skin_equip','skin_exchange') then return public.wakppu_api_before_skins(b);end if;
 if u is null then raise sqlstate 'PT401' using message='로그인이 필요합니다.';end if;
 prior:=public.wakppu_api_before_skins(jsonb_build_object('action','bootstrap'));
 access:=public.wakppu_admin_content_access();select * into g from public.game_states where user_id=u for update;
 if not found then raise sqlstate 'PT401' using message='게임 계정을 다시 불러와주세요.';end if;
 insert into public.wakppu_skins(user_id) values(u) on conflict do nothing;
 select * into s from public.wakppu_skins where user_id=u for update;
 if a<>'skins' then
  if coalesce(b->>'request_id','')!~'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then raise exception '잘못된 요청 ID';end if;
  rid:=(b->>'request_id')::uuid;
  fingerprint:=jsonb_build_object('action',a,'skin_id',b->'skin_id','ball_id',b->'ball_id','count',b->'count');
  select * into cached from public.wakppu_skin_requests where user_id=u and request_id=rid;
  if found then if cached.request<>fingerprint then raise exception '요청 ID 충돌';end if;return cached.response||jsonb_build_object('owned',s.owned||case when access then (select coalesce(jsonb_object_agg(skin_id,true),'{}') from public.wakppu_skin_defs) else '{}'::jsonb end,'can_equip',access or g.unlocked_ball_ids?'eternity');end if;
  if (b->>'item_revision') is null or (b->>'item_revision')::bigint<>g.item_revision or (b->>'skin_revision') is null or (b->>'skin_revision')::bigint<>s.revision then raise sqlstate 'PT409' using message='스킨 상태가 변경되었습니다. 다시 불러와주세요.';end if;
  if a='skin_draw' then
   if coalesce((b->>'count')::integer,1)<>1 then raise exception '스킨 뽑기는 1회씩만 가능합니다.';end if;
   if g.gold<cost then raise exception 'Gold가 부족합니다.';end if;
   if s.pity=99 then select * into d from public.wakppu_skin_defs where skin_id='eternity_transcendent';
   else
    if (select sum(weight) from public.wakppu_skin_defs)<>10000 then raise exception '스킨 확률 설정 오류';end if;
    roll:=floor(('x'||substr(replace(gen_random_uuid()::text,'-',''),1,8))::bit(32)::bigint::numeric/4294967296*10000);
    select def.* into d from public.wakppu_skin_defs def join (select skin_id,sum(weight) over(order by position) as edge from public.wakppu_skin_defs) weights using(skin_id) where roll<weights.edge order by weights.edge limit 1;
   end if;
   if d.skin_id is null then raise exception '스킨 설정 오류';end if;
   duplicate:=s.owned?d.skin_id;
   if duplicate then awarded:=d.duplicate_shards;s.shards:=s.shards+awarded;else s.owned:=s.owned||jsonb_build_object(d.skin_id,true);end if;
   s.pity:=case when d.rank='transcendent' then 0 else s.pity+1 end;s.total:=s.total+1;g.gold:=g.gold-cost;
  elsif a='skin_exchange' then
   select * into d from public.wakppu_skin_defs where skin_id=b->>'skin_id';
   if not found or s.owned?d.skin_id then raise exception '교환할 미보유 스킨을 선택해주세요.';end if;
   if s.shards<d.exchange_shards then raise exception '스킨 조각이 부족합니다.';end if;
   s.shards:=s.shards-d.exchange_shards;s.owned:=s.owned||jsonb_build_object(d.skin_id,true);
  elsif a='skin_equip' then
   if b->>'ball_id'<>'eternity' or b->>'ball_id' is null then raise exception '대상 왁뿌볼 오류';end if;
   if b->>'skin_id' is null then s.equipped:=s.equipped-'eternity';
   else
    select * into d from public.wakppu_skin_defs where skin_id=b->>'skin_id' and ball_id=b->>'ball_id';
    if not found or (not access and not(s.owned?d.skin_id)) then raise exception '보유한 전용 스킨만 장착할 수 있습니다.';end if;
    if not access and not(g.unlocked_ball_ids?'eternity') then raise exception '영겁의 왁뿌볼을 먼저 해금해주세요.';end if;
    s.equipped:=s.equipped||jsonb_build_object(d.ball_id,d.skin_id);
   end if;
  end if;
  s.revision:=s.revision+1;g.item_revision:=g.item_revision+1;
  update public.game_states set gold=g.gold,item_revision=g.item_revision where user_id=u;
  update public.wakppu_skins set owned=s.owned,equipped=s.equipped,shards=s.shards,pity=s.pity,total=s.total,revision=s.revision where user_id=u;
 end if;
 result:=jsonb_build_object('owned',s.owned,'equipped',s.equipped,'shards',s.shards::text,'pity',s.pity,'total',s.total::text,'skin_revision',s.revision,'revision',g.item_revision,'gold',g.gold::text,'can_equip',access or g.unlocked_ball_ids?'eternity','price',cost::text);
 if access then select coalesce(jsonb_object_agg(skin_id,true),'{}') into admin_skin_catalog from public.wakppu_skin_defs;result:=result||jsonb_build_object('owned',s.owned||admin_skin_catalog,'admin_content_access',true);end if;
 if a in ('skin_draw','skin_exchange') then result:=result||jsonb_build_object('result',jsonb_build_object('skin_id',d.skin_id,'duplicate',duplicate,'shards_awarded',awarded));end if;
 if a<>'skins' then insert into public.wakppu_skin_requests values(u,rid,fingerprint,result);end if;
 return result;
end $function$
;

CREATE OR REPLACE FUNCTION public.wakppu_api_before_input_guard(b jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare u uuid:=auth.uid();a text:=b->>'action';admin boolean;eligible boolean;c public.wakppu_purchase_config;
 o public.wakppu_purchase_orders;p public.wakppu_purchase_products;result jsonb;rid uuid;ref text;offset_n integer;who uuid;
begin
 if a='rankings' then
  result:=public.wakppu_api_before_purchases(b);
  return coalesce((select jsonb_agg(row||jsonb_build_object('supporter',exists(select 1 from public.players pl join public.wakppu_purchase_entitlements e on e.user_id=pl.user_id where pl.nickname=row->>'nickname' and e.product_id in ('supporter_pack','premium_supporter_pack')),'premium_supporter',exists(select 1 from public.players pl join public.wakppu_purchase_entitlements e on e.user_id=pl.user_id where pl.nickname=row->>'nickname' and e.product_id='premium_supporter_pack'),'supporter_title_visible',coalesce((select pc.title_visible from public.players pl join public.wakppu_purchase_cosmetics pc on pc.user_id=pl.user_id where pl.nickname=row->>'nickname'),true)) order by ord) from jsonb_array_elements(result) with ordinality as entries(row,ord)),'[]');
 end if;
 if a is null or a not in ('purchase_catalog','purchase_order','purchase_claim','purchase_cancel','purchase_equip','purchase_title','admin_purchase_config','admin_purchase_orders','admin_purchase_approve','admin_purchase_refund') then return public.wakppu_api_before_purchases(b);end if;
 if u is null then raise sqlstate 'PT401' using message='로그인이 필요합니다.';end if;
 perform public.wakppu_api_before_purchases('{"action":"bootstrap"}');
 select pl.role='admin' and not coalesce(au.is_anonymous,true),not coalesce(au.is_anonymous,true) and au.email_confirmed_at is not null and coalesce(au.email,'')<>'' into admin,eligible from public.players pl join auth.users au on au.id=pl.user_id where pl.user_id=u;
 if a like 'admin_purchase_%' and not coalesce(admin,false) then raise sqlstate 'PT403' using message='관리자 권한이 필요합니다.';end if;
 if a='admin_purchase_config' then
  select * into c from public.wakppu_purchase_config where id for update;
  if coalesce(b->>'mode','get')='set' then
   if (b->>'revision')::integer is distinct from c.revision then raise sqlstate 'PT409' using message='다른 관리자가 설정을 변경했습니다. 새로고침하세요.';end if;
   if jsonb_typeof(b->'enabled') is distinct from 'boolean' then raise sqlstate 'PT400' using message='판매 상태를 확인하세요.';end if;
   if length(coalesce(b->>'bank_name',''))>50 or length(coalesce(b->>'account_number',''))>50 or length(coalesce(b->>'account_holder',''))>50 or length(coalesce(b->>'support_contact',''))>200 then raise sqlstate 'PT400' using message='계좌 정보가 너무 깁니다.';end if;
   if (b->>'enabled')::boolean and (length(trim(coalesce(b->>'bank_name','')))<2 or coalesce(b->>'account_number','')!~ '^[0-9 -]{5,50}$' or length(trim(coalesce(b->>'account_holder','')))<2 or length(trim(coalesce(b->>'support_contact','')))<3) then raise sqlstate 'PT400' using message='은행·계좌번호·예금주·문의 방법을 입력하세요.';end if;
   update public.wakppu_purchase_config set enabled=(b->>'enabled')::boolean,bank_name=trim(b->>'bank_name'),account_number=trim(b->>'account_number'),account_holder=trim(b->>'account_holder'),support_contact=trim(b->>'support_contact'),revision=revision+1 where id returning * into c;
   insert into public.admin_audit_logs(admin_user_id,action,reason,details) values(u,a,'수동 계좌이체 설정 변경',jsonb_build_object('enabled',c.enabled,'bank_name',c.bank_name,'revision',c.revision));
  elsif coalesce(b->>'mode','get')<>'get' then raise sqlstate 'PT400';end if;
  return to_jsonb(c);
 end if;
 if a='admin_purchase_orders' then
  offset_n:=coalesce((b->>'offset')::integer,0);if offset_n<0 or offset_n>100000 then raise sqlstate 'PT400';end if;
  return jsonb_build_object('orders',(select coalesce(jsonb_agg(to_jsonb(t)||jsonb_build_object('supporter_refund_blocked',exists(select 1 from public.wakppu_purchase_entitlements e join public.wakppu_purchase_orders q on q.id=e.order_id where e.product_id='premium_supporter_pack' and q.supporter_upgrade_order_id=t.id)) order by created_at desc),'[]') from (select ord.*,pl.nickname,case when ord.product_id='first_steps_pack' then public.wakppu_first_steps_refundable(ord.user_id) else null end as starter_refundable from public.wakppu_purchase_orders ord join public.players pl on pl.user_id=ord.user_id where coalesce(b->>'status','all')='all' or ord.status=b->>'status' order by created_at desc,id limit 50 offset offset_n) t),'offset',offset_n);
 end if;
 if a='purchase_catalog' then return public.wakppu_purchase_snapshot(u);end if;
 if a='purchase_order' then
  if not coalesce(eligible,false) then raise sqlstate 'PT403' using message='이메일을 연결하고 인증한 계정만 주문할 수 있습니다.';end if;
  perform pg_advisory_xact_lock(hashtextextended(u::text,19));
  rid:=(b->>'request_id')::uuid;if rid is null then raise sqlstate 'PT400';end if;
  select * into o from public.wakppu_purchase_orders where user_id=u and request_id=rid;
  if found then
   if o.product_id is distinct from b->>'product_id' or o.depositor is distinct from trim(b->>'depositor') then raise sqlstate 'PT409' using message='같은 주문 요청을 변경할 수 없습니다.';end if;
   return public.wakppu_purchase_snapshot(u)||jsonb_build_object('order',to_jsonb(o));
  end if;
  select * into c from public.wakppu_purchase_config where id for share;
  if not c.enabled then raise sqlstate 'PT409' using message='현재 유료 주문을 받고 있지 않습니다.';end if;
  select * into p from public.wakppu_purchase_products where id=b->>'product_id';if not found then raise sqlstate 'PT400' using message='판매 상품을 확인하세요.';end if;
  if length(trim(coalesce(b->>'depositor','')))<2 or length(trim(b->>'depositor'))>30 then raise sqlstate 'PT400' using message='입금자명을 2~30자로 입력하세요.';end if;
  -- starter_once_guard: retain the one-time limit even after refund.
  if p.id='first_steps_pack' and exists(select 1 from public.wakppu_first_steps_grants where user_id=u) then raise sqlstate 'PT409' using message='첫걸음 성장팩은 계정당 한 번만 구매할 수 있습니다.';end if;
  -- premium_upgrade_guard: server-priced discount with an immutable source order.
  if p.id='premium_supporter_pack' and exists(select 1 from public.wakppu_purchase_entitlements where user_id=u and product_id='supporter_pack') then p.amount:=8900;end if;
  if p.id='supporter_pack' and exists(select 1 from public.wakppu_purchase_entitlements where user_id=u and product_id='premium_supporter_pack') then raise sqlstate 'PT409' using message='프리미엄 후원팩에 응원팩 혜택이 포함되어 있습니다.';end if;
  if b?'amount' and (b->>'amount')::integer is distinct from p.amount then raise sqlstate 'PT400' using message='상품 금액이 일치하지 않습니다.';end if;
  if exists(select 1 from public.wakppu_purchase_entitlements where user_id=u and product_id=p.id) then raise sqlstate 'PT409' using message='이미 보유한 상품입니다.';end if;
  select * into o from public.wakppu_purchase_orders where user_id=u and product_id=p.id and status in ('pending','claimed') order by created_at desc limit 1;
  if found then return public.wakppu_purchase_snapshot(u)||jsonb_build_object('order',to_jsonb(o));end if;
  insert into public.wakppu_purchase_orders(user_id,request_id,product_id,product_name,amount,depositor,bank,supporter_upgrade_order_id) values(u,rid,p.id,p.name,p.amount,trim(b->>'depositor'),to_jsonb(c)-'id'-'revision'-'enabled',case when p.id='premium_supporter_pack' and p.amount=8900 then (select order_id from public.wakppu_purchase_entitlements where user_id=u and product_id='supporter_pack') else null end) returning * into o;
  return public.wakppu_purchase_snapshot(u)||jsonb_build_object('order',to_jsonb(o));
 end if;
 if a='purchase_title' then
  perform pg_advisory_xact_lock(hashtextextended(u::text,19));
  if jsonb_typeof(b->'visible') is distinct from 'boolean' then raise sqlstate 'PT400';end if;
  if public.wakppu_supporter_percent(u)<>30 then raise sqlstate 'PT403';end if;
  insert into public.wakppu_purchase_cosmetics(user_id,title_visible) values(u,(b->>'visible')::boolean) on conflict(user_id) do update set title_visible=excluded.title_visible;
  return public.wakppu_purchase_snapshot(u);
 end if;
 if a='purchase_equip' then
  perform pg_advisory_xact_lock(hashtextextended(u::text,19));
  if jsonb_typeof(b->'equipped') is distinct from 'boolean' then raise sqlstate 'PT400';end if;
  if (b->>'equipped')::boolean and not exists(select 1 from public.wakppu_purchase_entitlements where user_id=u and product_id='starlight_skin') then raise sqlstate 'PT403' using message='보유한 스킨만 장착할 수 있습니다.';end if;
  insert into public.wakppu_purchase_cosmetics(user_id,equipped) values(u,(b->>'equipped')::boolean) on conflict(user_id) do update set equipped=excluded.equipped;
  return public.wakppu_purchase_snapshot(u);
 end if;
 -- Lock the owner before the order for every mutation, including administrator work.
 select user_id into who from public.wakppu_purchase_orders where id=(b->>'order_id')::uuid;
 if who is null or (not coalesce(admin,false) and who<>u) then raise sqlstate 'PT404' using message='주문을 찾을 수 없습니다.';end if;
 perform pg_advisory_xact_lock(hashtextextended(who::text,19));
 select * into o from public.wakppu_purchase_orders where id=(b->>'order_id')::uuid for update;
 if a in ('purchase_claim','purchase_cancel') then
  if o.user_id<>u then raise sqlstate 'PT404';end if;
  if a='purchase_claim' and o.status='pending' then update public.wakppu_purchase_orders set status='claimed',claimed_at=clock_timestamp() where id=o.id;
  elsif a='purchase_cancel' and o.status='pending' then update public.wakppu_purchase_orders set status='cancelled' where id=o.id;
  elsif (a='purchase_claim' and o.status not in ('claimed','approved')) or (a='purchase_cancel' and o.status<>'cancelled') then raise sqlstate 'PT409' using message='처리 상태가 바뀌었습니다. 새로고침하세요.';end if;
  return public.wakppu_purchase_snapshot(u);
 end if;
 if a='admin_purchase_approve' then
  ref:=trim(coalesce(b->>'deposit_reference',''));
  if length(ref)<4 or length(ref)>100 or (b->>'confirmed_amount')::integer is distinct from o.amount then raise sqlstate 'PT400' using message='실제 입금액과 거래 식별 기록을 확인하세요.';end if;
  if o.status='approved' then
   if o.deposit_reference<>ref then raise sqlstate 'PT409' using message='이미 확인한 입금 기록과 다릅니다.';end if;
   return jsonb_build_object('ok',true,'order_id',o.id);
  end if;
  if o.status not in ('pending','claimed') then raise sqlstate 'PT409' using message='확인할 수 없는 주문 상태입니다.';end if;
  if exists(select 1 from public.wakppu_purchase_entitlements where user_id=o.user_id and product_id=o.product_id) then raise sqlstate 'PT409' using message='이미 보유한 상품입니다.';end if;
  if o.product_id='premium_supporter_pack' and o.amount=8900 and not exists(select 1 from public.wakppu_purchase_entitlements where user_id=o.user_id and product_id='supporter_pack' and order_id=o.supporter_upgrade_order_id) then raise sqlstate 'PT409' using message='업그레이드 대상 응원팩 보유 상태가 변경되었습니다. 지급 전 주문을 확인하세요.';end if;
  if o.product_id='supporter_pack' and exists(select 1 from public.wakppu_purchase_entitlements where user_id=o.user_id and product_id='premium_supporter_pack') then raise sqlstate 'PT409' using message='이미 프리미엄 혜택을 보유하고 있습니다. 입금 내역을 확인하세요.';end if;
  update public.wakppu_purchase_orders set status='approved',approved_at=clock_timestamp(),approved_by=u,deposit_reference=ref where id=o.id;
  insert into public.wakppu_purchase_entitlements values(o.user_id,o.product_id,o.id);
  insert into public.admin_audit_logs(admin_user_id,target_user_id,action,reason,details) values(u,o.user_id,a,'실제 입금 확인 후 지급',jsonb_build_object('order_id',o.id,'amount',o.amount));
 elsif a='admin_purchase_refund' then
  -- admin_grant_refund_guard
  if o.source='admin_grant' then raise sqlstate 'PT409' using message='관리자 지급은 환불이 아닌 직접 지급 회수 메뉴를 이용하세요.';end if;
  ref:=trim(coalesce(b->>'refund_reference',''));
  if length(ref)<4 or length(ref)>100 then raise sqlstate 'PT400' using message='실제 환불 완료 기록을 입력하세요.';end if;
  if o.status='refunded' then return jsonb_build_object('ok',true,'order_id',o.id);end if;
  if o.status<>'approved' then raise sqlstate 'PT409' using message='지급 완료된 주문만 환불 처리할 수 있습니다.';end if;
  if exists(select 1 from public.wakppu_purchase_entitlements e join public.wakppu_purchase_orders q on q.id=e.order_id where e.user_id=o.user_id and e.product_id='premium_supporter_pack' and q.supporter_upgrade_order_id=o.id) then raise sqlstate 'PT409' using message='이 응원팩으로 업그레이드한 프리미엄 후원팩을 먼저 환불 처리하세요.';end if;
  update public.wakppu_purchase_orders set status='refunded',refunded_at=clock_timestamp(),refund_reference=ref where id=o.id;
  delete from public.wakppu_purchase_entitlements where order_id=o.id;
  if o.product_id='starlight_skin' then update public.wakppu_purchase_cosmetics set equipped=false where user_id=o.user_id;end if;
  insert into public.admin_audit_logs(admin_user_id,target_user_id,action,reason,details) values(u,o.user_id,a,'실제 환불 완료 후 상품 회수',jsonb_build_object('order_id',o.id));
 end if;
 return jsonb_build_object('ok',true,'order_id',o.id);
end $function$
;

CREATE OR REPLACE FUNCTION public.wakppu_admin_paid_snapshot(t uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
 select jsonb_build_object('user_id',t,'products',(select jsonb_agg(to_jsonb(p) order by amount,id) from public.wakppu_purchase_products p),
 'owned',(select coalesce(jsonb_object_agg(e.product_id,jsonb_build_object('order_id',e.order_id,'source',o.source,'revoke_blocked',exists(select 1 from public.wakppu_purchase_entitlements x join public.wakppu_purchase_orders q on q.id=x.order_id where (q.supporter_upgrade_order_id=o.id or q.custom_upgrade_order_id=o.id)),'reclaimable',case when e.product_id='first_steps_pack' then public.wakppu_first_steps_refundable(t) else true end)),'{}') from public.wakppu_purchase_entitlements e join public.wakppu_purchase_orders o on o.id=e.order_id where e.user_id=t),
 'starter_used',exists(select 1 from public.wakppu_first_steps_grants where user_id=t),
 'history',(select coalesce(jsonb_agg(to_jsonb(q) order by created_at desc),'[]') from (select id,product_name,status,created_at,approved_at from public.wakppu_purchase_orders where user_id=t and source='admin_grant' order by created_at desc limit 20) q));
$function$
;

CREATE OR REPLACE FUNCTION public.wakppu_api_before_limited(b jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare actor uuid:=auth.uid(); role_name text; kind text:=b->>'event_type';
 instant timestamptz; starts timestamptz; settings server_settings; event jsonb; result jsonb; action_name text;
begin
 if b->>'action' not in ('admin_event_schedule','admin_event_schedule_cancel') or b->>'action' is null then
  return public.wakppu_api_before_event_schedule(b);
 end if;
 select role into role_name from players where user_id=actor;
 if actor is null or role_name is null then raise sqlstate 'PT401' using message='로그인이 필요합니다.'; end if;
 if role_name<>'admin' or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) then raise sqlstate 'PT403' using message='관리자 권한이 필요합니다.'; end if;
 perform public.wakppu_api_before_event_schedule(jsonb_build_object('action','bootstrap'));
 if kind is null or kind not in ('gold','ball') then raise sqlstate 'PT400' using message='이벤트 종류를 선택하세요.'; end if;
 select * into settings from server_settings where id=true for update;
 instant:=clock_timestamp();
 action_name:=case when kind='gold' then 'admin_gold_event' else 'admin_ball_event' end;
 event:=case when kind='gold' then settings.gold_event else settings.admin_ball_event end;
 if b->>'action'='admin_event_schedule_cancel' then
  if event is null or event->>'id' is distinct from b->>'event_id' then raise sqlstate 'PT409' using message='이벤트가 변경되었습니다. 다시 확인해주세요.'; end if;
  return public.wakppu_api_before_event_schedule(jsonb_build_object('action',action_name,'mode','stop'));
 end if;
 if coalesce(b->>'starts_at','')!~'^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(\.[0-9]{1,6})?Z$' then raise sqlstate 'PT400' using message='UTC 시작 시각 형식이 올바르지 않습니다.'; end if;
 begin starts:=(b->>'starts_at')::timestamptz;
 exception when others then raise sqlstate 'PT400' using message='시작 날짜와 시각이 올바르지 않습니다.'; end;
 if to_char(starts at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS') is distinct from left(b->>'starts_at',19) then raise sqlstate 'PT400' using message='올바른 날짜와 시각을 입력하세요.'; end if;
 if starts<=instant or starts>instant+interval '365 days' then raise sqlstate 'PT400' using message='서버 현재 시각 이후부터 365일 이내로 예약하세요.'; end if;
 result:=public.wakppu_api_before_event_schedule((b-'starts_at'-'event_type')||jsonb_build_object('action',action_name,'mode','start','delay_seconds',0));
 select * into settings from server_settings where id=true;
 event:=case when kind='gold' then settings.gold_event else settings.admin_ball_event end;
 event:=event||jsonb_build_object('starts_at',starts,'ends_at',starts+((event->>'ends_at')::timestamptz-(event->>'starts_at')::timestamptz));
 if kind='gold' then update server_settings set gold_event=event where id=true;
 else update server_settings set admin_ball_event=event where id=true;end if;
 insert into admin_audit_logs(admin_user_id,action,reason,details) values(actor,'ADMIN_EVENT_SCHEDULE','시각 지정 예약',jsonb_build_object('event_type',kind,'after',event));
 return jsonb_build_object('ok',true,case when kind='gold' then 'gold_event' else 'admin_ball_event' end,event,'server_time',clock_timestamp());
end$function$
;

CREATE OR REPLACE FUNCTION public.wakppu_limited_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
 select exists(select 1 from public.players where user_id=auth.uid() and role='admin')
 and not coalesce((auth.jwt()->>'is_anonymous')::boolean,false)
$function$
;

CREATE OR REPLACE FUNCTION public.wakppu_halloween_goods_snapshot(u uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare e jsonb:=public.wakppu_halloween_goods_expiry(u);ms bigint:=floor(extract(epoch from statement_timestamp())*1000);access boolean:=public.wakppu_admin_content_access();
begin
 return jsonb_build_object('server_time',ms,'expires',e,'admin_access',access,
 'stock',coalesce((select stock from public.wakppu_halloween_goods where user_id=u),'{}'),
 'revision',coalesce((select revision from public.wakppu_halloween_goods where user_id=u),0),
 'tokens',coalesce((select tokens::text from public.wakppu_limited_players where user_id=u),'0'),
 'active',coalesce((select statement_timestamp()>=starts_at and statement_timestamp()<ends_at from public.wakppu_limited_settings where id),false),
 'catalog',(select jsonb_agg(jsonb_build_object('id',id,'name',name,'kind',kind,'price',price,'image',image) order by kind,id) from public.wakppu_halloween_goods_defs),
 'timing',jsonb_build_object('animation',case when (e->>'ghost_potion')::bigint>ms then 2 else 1 end,'respawn',case when (e->>'pumpkin_potion')::bigint>ms then 2 else 1 end));
end $function$
;

CREATE OR REPLACE FUNCTION public.wakppu_supporter_reward(u uuid, base numeric)
 RETURNS numeric
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare paid numeric;parts numeric;carry integer;
begin
 paid:=public.wakppu_supporter_reward_before_halloween_goods(u,base);
 if paid<=0 or coalesce((public.wakppu_halloween_goods_expiry(u)->>'witch_potion')::bigint,0)<=extract(epoch from statement_timestamp())*1000 then return paid;end if;
 select gold_remainder into carry from public.wakppu_halloween_goods where user_id=u for update;
 parts:=paid*3+coalesce(carry,0);
 update public.wakppu_halloween_goods set gold_remainder=mod(parts,2)::integer where user_id=u;
 return floor(parts/2);
end $function$
;

CREATE OR REPLACE FUNCTION public.wakppu_supporter_reward_before_pets(u uuid, base numeric)
 RETURNS numeric
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare carry integer;parts numeric;extra numeric;bonus integer;
begin
 if u is null or u is distinct from auth.uid() then raise sqlstate 'PT403';end if;
 if base<0 or base<>trunc(base) then raise sqlstate 'PT400';end if;
 bonus:=public.wakppu_supporter_percent(u);if base=0 or bonus=0 then return base;end if;
 select supporter_gold_remainder into carry from public.game_states where user_id=u for update;
 if not found then raise sqlstate 'PT404';end if;
 parts:=base*bonus+carry;extra:=floor(parts/100);
 update public.game_states set supporter_gold_remainder=mod(parts,100)::integer where user_id=u;
 return base+extra;
end $function$
;

CREATE OR REPLACE FUNCTION public.wakppu_profile_title_state(u uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare r jsonb:=public.wakppu_profile_title_before_halloween_goods(u);catalog jsonb;choice text;label text;visible boolean;access boolean;
begin
 access:=case when u=auth.uid() then public.wakppu_admin_content_access() else exists(select 1 from public.players p join auth.users a on a.id=p.user_id where p.user_id=u and p.role='admin' and not coalesce(a.is_anonymous,false)) end;
 select coalesce(jsonb_agg(jsonb_build_object('id',d.id,'name',d.name) order by d.id),'[]') into catalog from public.wakppu_halloween_goods_defs d
 where d.kind='title' and (access or exists(select 1 from public.wakppu_halloween_goods g where g.user_id=u and coalesce((g.stock->>d.id)::integer,0)>0));
 select title_id into choice from public.wakppu_profile_cards where user_id=u;
 select title_visible into visible from public.wakppu_purchase_cosmetics where user_id=u;
 if visible is distinct from false then select c->>'name' into label from jsonb_array_elements(catalog)c where c->>'id'=choice;end if;
 return r||jsonb_build_object('title_catalog',(r->'title_catalog')||catalog)||case when label is not null then jsonb_build_object('title_equipped',choice,'title',label) else '{}'::jsonb end;
end $function$
;

CREATE OR REPLACE FUNCTION public.wakppu_public_base_api(b jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare u uuid:=auth.uid();a text:=b->>'action';r jsonb;g public.wakppu_halloween_goods;d public.wakppu_halloween_goods_defs;
 l public.wakppu_limited_players;rid uuid;fp jsonb;prior jsonb;access boolean;ms bigint;until_ms bigint;
begin
 if a in ('halloween_goods','halloween_goods_buy','halloween_goods_use') then
  if u is null then raise sqlstate 'PT401' using message='로그인이 필요합니다.';end if;
  perform public.wakppu_api_before_halloween_goods('{"action":"bootstrap"}');
  if b ?| array['user_id','target_user_id','price','stock','expires','gold','reward','admin_access'] then raise sqlstate 'PT403';end if;
  perform 1 from public.game_states where user_id=u for update;
  insert into public.wakppu_limited_players(user_id) values(u) on conflict do nothing;
  select * into l from public.wakppu_limited_players where user_id=u for update;
  insert into public.wakppu_halloween_goods(user_id) values(u) on conflict do nothing;
  select * into g from public.wakppu_halloween_goods where user_id=u for update;
  if a='halloween_goods' then return public.wakppu_halloween_goods_snapshot(u);end if;
  if coalesce(b->>'request_id','')!~'^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$' or coalesce(b->>'goods_revision','')!~'^[0-9]{1,18}$' then raise sqlstate 'PT400';end if;
  rid:=(b->>'request_id')::uuid;fp:=jsonb_build_object('action',a,'id',b->>'id');
  select fingerprint into prior from public.wakppu_halloween_goods_requests where user_id=u and request_id=rid;
  if found then
   if prior<>fp then raise sqlstate 'PT409' using message='다른 작업에 사용한 요청입니다.';end if;
   return public.wakppu_halloween_goods_snapshot(u);
  end if;
  if g.revision<>(b->>'goods_revision')::bigint then raise sqlstate 'PT409' using message='한정 아이템 상태를 다시 불러와주세요.';end if;
  select * into d from public.wakppu_halloween_goods_defs where id=b->>'id';
  if not found then raise sqlstate 'PT400' using message='없는 한정 아이템입니다.';end if;
  access:=public.wakppu_admin_content_access();
  if a='halloween_goods_buy' then
   if not coalesce((public.wakppu_halloween_goods_snapshot(u)->>'active')::boolean,false) then raise sqlstate 'PT409' using message='할로윈 판매 기간이 아닙니다.';end if;
   if access then raise sqlstate 'PT409' using message='관리자는 구매 없이 바로 사용할 수 있습니다.';end if;
   if d.kind<>'potion' and coalesce((g.stock->>d.id)::integer,0)>0 then raise sqlstate 'PT409' using message='이미 보유한 아이템입니다.';end if;
   if l.tokens<d.price then raise sqlstate 'PT400' using message='캔디가 부족합니다.';end if;
   if coalesce((g.stock->>d.id)::integer,0)>=1000000 then raise sqlstate 'PT400' using message='보관 한도입니다.';end if;
   update public.wakppu_limited_players set tokens=tokens-d.price where user_id=u;
   g.stock:=g.stock||jsonb_build_object(d.id,coalesce((g.stock->>d.id)::integer,0)+1);
   if d.kind='card' then insert into public.wakppu_profile_card_grants(user_id,card_id) values(u,d.id) on conflict do nothing;end if;
  else
   if d.kind<>'potion' then raise sqlstate 'PT400';end if;
   if not access and coalesce((g.stock->>d.id)::integer,0)<=0 then raise sqlstate 'PT403' using message='보유한 포션이 없습니다.';end if;
   ms:=floor(extract(epoch from statement_timestamp())*1000);
   until_ms:=greatest(ms,coalesce(((case when access then g.admin_expires else g.expires end)->>d.id)::bigint,0))+1800000;
   if until_ms>ms+604800000 then raise sqlstate 'PT400' using message='최대 연장 시간은 7일입니다.';end if;
   if access then g.admin_expires:=g.admin_expires||jsonb_build_object(d.id,until_ms);
   else g.expires:=g.expires||jsonb_build_object(d.id,until_ms);g.stock:=g.stock||jsonb_build_object(d.id,(g.stock->>d.id)::integer-1);end if;
  end if;
  update public.wakppu_halloween_goods set stock=g.stock,expires=g.expires,admin_expires=g.admin_expires,revision=revision+1 where user_id=u;
  insert into public.wakppu_halloween_goods_requests values(u,rid,fp);
  return public.wakppu_halloween_goods_snapshot(u);
 end if;
 r:=public.wakppu_api_before_halloween_goods(b);
 if u is not null and a in ('bootstrap','items','item_hit','limited_hit','event_ball_hit','ember_auto_hit','save_progress','auto_rebirth_run') then
  r:=r||jsonb_build_object('halloween_goods',public.wakppu_halloween_goods_snapshot(u)-'server_time'-'catalog'-'stock');
 end if;
 return r;
end $function$
;

CREATE OR REPLACE FUNCTION public.wakppu_api_before_background(b jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare actor uuid:=auth.uid(); instant timestamptz:=clock_timestamp();
begin
 if b->>'action' in ('rankings','presence_ping') then
  if exists(select 1 from moderation_cases m where m.user_id=actor and
    (m.status='banned' or (m.status='suspended' and (m.suspended_until is null or m.suspended_until>instant)))) then
   raise sqlstate 'PT403' using message='이 계정은 이용이 제한되었습니다.';
  end if;
  if b->>'action'='presence_ping' then
   if actor is null or not exists(select 1 from players where user_id=actor) then
    raise sqlstate 'PT401' using message='로그인이 필요합니다.';
   end if;
   insert into player_presence(user_id,last_seen_at) values(actor,instant)
    on conflict(user_id) do update set last_seen_at=excluded.last_seen_at
    where player_presence.last_seen_at<instant-interval '25 seconds';
   return jsonb_build_object('ok',true);
  end if;
  return (select coalesce(jsonb_agg(to_jsonb(x)-'sort_gold'-'sort_id' order by x.rebirths desc,x.sort_gold desc,x.sort_id),'[]'::jsonb) from (
   select p.nickname,g.gold::text as gold,g.rebirths,
    coalesce(pr.last_seen_at>instant-interval '90 seconds',false) as online,
    g.gold as sort_gold,g.user_id as sort_id
   from game_states g join players p using(user_id) left join player_presence pr using(user_id)
   where not p.ranking_hidden and not exists(select 1 from moderation_cases m where m.user_id=p.user_id and
    (m.status='banned' or (m.status='suspended' and (m.suspended_until is null or m.suspended_until>instant))))
    and not exists(select 1 from wakppu_guest_accounts() c where c.id=p.user_id and c.eligible and c.hide_at<=instant)
   order by g.rebirths desc,g.gold desc,g.user_id limit 100
  ) x);
 end if;
 return public.wakppu_api_before_presence(b);
end $function$
;

CREATE OR REPLACE FUNCTION public.wakppu_api_before_weekly_events(b jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare a text:=b->>'action'; instant timestamptz:=clock_timestamp(); hours jsonb:=public.wakppu_sleep_hours(instant); result jsonb; is_admin boolean;
begin
 select exists(select 1 from public.players where user_id=auth.uid() and role='admin')
  and not coalesce((auth.jwt()->>'is_anonymous')::boolean,false) into is_admin;
 -- Keep the public ranking/presence wrapper available during sleep hours.
 if a in ('rankings','presence_ping') then return public.wakppu_api_before_sleep(b); end if;
 if a='status' then
  result:=public.wakppu_api_before_sleep(b);
  result:=result||jsonb_build_object('sleep_hours',hours,'server_time',instant);
  if coalesce(result->>'role','player')='admin' and not is_admin then result:=result||jsonb_build_object('role','player'); end if;
  if (hours->>'active')::boolean and not is_admin then
   result:=result||jsonb_build_object('gold_event',null,'admin_ball_event',null);
  end if;
  return result;
 end if;
 if auth.uid() is null then raise sqlstate 'PT401' using message='로그인이 필요합니다.'; end if;
 if exists(select 1 from public.moderation_cases m where m.user_id=auth.uid() and
  (m.status='banned' or (m.status='suspended' and (m.suspended_until is null or m.suspended_until>instant)))) then
  raise sqlstate 'PT403' using message='이 계정은 이용이 제한되었습니다.';
 end if;
 if auth.uid() is not null and (hours->>'active')::boolean and not is_admin then
  raise sqlstate 'PT503' using message='수면 시간입니다. 오전 6시부터 다시 이용할 수 있습니다.';
 end if;
 return public.wakppu_api_before_sleep(b);
end $function$
;

CREATE OR REPLACE FUNCTION public.wakppu_weekly_candidate(kind text, instant timestamp with time zone)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
with windows as (select s.*,((date_trunc('week',instant at time zone 'Asia/Seoul')::date+(s.weekday-1)+7*w.n)+s.local_time) at time zone 'Asia/Seoul' as starts,case when kind='gold' then s.gold_seconds else s.ball_seconds end as duration from public.wakppu_weekly_events s cross join generate_series(-1,2) w(n) where s.enabled),next_window as (select * from windows where starts+make_interval(secs=>duration)>instant and (starts at time zone 'Asia/Seoul')::date is distinct from case when kind='gold' then skip_gold else skip_ball end order by starts,id limit 1) select jsonb_build_object('id','weekly:'||id||':'||extract(epoch from starts)::bigint,'source','weekly','schedule_id',id,'starts_at',starts,'ends_at',starts+make_interval(secs=>duration))||case when kind='gold' then jsonb_build_object('multiplier',multiplier) else '{}'::jsonb end from next_window
$function$
;

CREATE OR REPLACE FUNCTION public.wakppu_refresh_weekly_events(instant timestamp with time zone DEFAULT clock_timestamp())
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare s server_settings;gold jsonb;ball jsonb;
begin
 select * into s from server_settings where id=true;
 if s.maintenance then return;end if;
 gold:=public.wakppu_separate_event(s.manual_gold_event,public.wakppu_weekly_candidate('gold',instant),instant);
 ball:=public.wakppu_separate_event(s.manual_ball_event,public.wakppu_weekly_candidate('ball',instant),instant);
 if s.gold_event is not distinct from gold and s.admin_ball_event is not distinct from ball then return;end if;
 select * into s from server_settings where id=true for update;
 if s.maintenance then return;end if;
 gold:=public.wakppu_separate_event(s.manual_gold_event,public.wakppu_weekly_candidate('gold',instant),instant);
 ball:=public.wakppu_separate_event(s.manual_ball_event,public.wakppu_weekly_candidate('ball',instant),instant);
 update server_settings set gold_event=gold,admin_ball_event=ball where id=true;
end $function$
;

CREATE OR REPLACE FUNCTION public.wakppu_separate_event(manual jsonb, weekly jsonb, instant timestamp with time zone)
 RETURNS jsonb
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
 select case
 when instant>=(manual->>'starts_at')::timestamptz and instant<(manual->>'ends_at')::timestamptz then manual
 when instant>=(weekly->>'starts_at')::timestamptz and instant<(weekly->>'ends_at')::timestamptz then weekly
 when (manual->>'ends_at')::timestamptz>instant and (weekly is null or (manual->>'starts_at')::timestamptz<=(weekly->>'starts_at')::timestamptz) then manual
 else weekly end
$function$
;

CREATE OR REPLACE FUNCTION public.wakppu_api_before_hammer_selection(b jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare result jsonb; s public.game_states%rowtype; access boolean; catalog jsonb; unlocked jsonb; discovered jsonb; virtual_inventory jsonb;
begin
 -- Delegate first: preserve authentication, maintenance, sleep and ban rules.
 result:=public.wakppu_api_before_admin_content(b);
 access:=public.wakppu_admin_content_access();
 if not access then return result;end if;
 if b->>'action' in ('bootstrap','save_progress') then
  select coalesce(jsonb_agg(ball_id order by ball_id),'[]') into catalog from public.wakppu_item_balls;
  select * into s from public.game_states where user_id=auth.uid() for update;
  select jsonb_agg(id order by id) into unlocked from (select distinct value as id from jsonb_array_elements(s.unlocked_ball_ids||catalog)) q;
  select jsonb_agg(id order by id) into discovered from (select distinct value as id from jsonb_array_elements(s.discovered_ball_ids||catalog)) q;
  update public.game_states set unlocked_ball_ids=unlocked,discovered_ball_ids=discovered
   where user_id=auth.uid() and (unlocked_ball_ids is distinct from unlocked or discovered_ball_ids is distinct from discovered);
  if result ? 'state' then result:=jsonb_set(result,'{state}',result->'state'||jsonb_build_object('unlocked_ball_ids',unlocked,'discovered_ball_ids',discovered));end if;
 end if;
 if result ? 'inventory' then
  select coalesce(jsonb_object_agg(item_id,greatest(1,coalesce((result->'inventory'->>item_id)::bigint,0))),'{}') into virtual_inventory from public.wakppu_item_defs;
  result:=result||jsonb_build_object('inventory',result->'inventory'||virtual_inventory,'admin_content_access',true);
 end if;
 return result;
end $function$
;

CREATE OR REPLACE FUNCTION public.wakppu_separate_weekly_api(b jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare actor uuid:=auth.uid();role_name text;a text:=b->>'action';mode text:=b->>'mode';
 s server_settings;previous jsonb;result jsonb;instant timestamptz:=clock_timestamp();blocked boolean;
begin
 select role into role_name from players where user_id=actor;
 if a in ('admin_weekly_events','admin_gold_event','admin_ball_event','admin_event_schedule','admin_event_schedule_cancel') then
  if actor is null or role_name is null then raise sqlstate 'PT401' using message='로그인이 필요합니다.';end if;
  if role_name<>'admin' or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) then raise sqlstate 'PT403' using message='관리자 권한이 필요합니다.';end if;
  perform public.wakppu_api_before_weekly_events('{"action":"bootstrap"}');
  select * into s from server_settings where id=true for update;
  if a='admin_weekly_events' then
   if mode is null or mode not in ('enable','disable','list') then raise sqlstate 'PT400' using message='반복 예약 작업을 선택하세요.';end if;
   if mode='enable' and s.maintenance then raise sqlstate 'PT409' using message='점검 모드를 해제하세요.';end if;
   if mode<>'list' then
    select jsonb_agg(to_jsonb(w) order by local_time) into previous from wakppu_weekly_events w;
    update wakppu_weekly_events set enabled=(mode='enable');
    insert into admin_audit_logs(admin_user_id,action,reason,details) values(actor,'ADMIN_WEEKLY_EVENTS_'||upper(mode),'금요일 반복 이벤트',jsonb_build_object('before',previous,'enabled',mode='enable'));
   end if;
   result:=jsonb_build_object('ok',true);
  else
   -- Only administrator mutations use these temporary slots. Row locking and
   -- transaction isolation prevent players/cron from observing intermediate data.
   update server_settings set gold_event=s.manual_gold_event,admin_ball_event=s.manual_ball_event where id=true;
   result:=public.wakppu_api_before_weekly_events(b);
   update server_settings set manual_gold_event=gold_event,manual_ball_event=admin_ball_event where id=true;
  end if;
  perform public.wakppu_refresh_weekly_events();
  result:=result||public.wakppu_api_before_weekly_events('{"action":"status"}');
 else
  perform public.wakppu_refresh_weekly_events();
  result:=public.wakppu_api_before_weekly_events(b);
 end if;
 if a='status' or a in ('admin_weekly_events','admin_gold_event','admin_ball_event','admin_event_schedule','admin_event_schedule_cancel') then
  select * into s from server_settings where id=true;
  blocked:=s.maintenance or (coalesce((result->'sleep_hours'->>'active')::boolean,false) and role_name is distinct from 'admin');
  result:=result||jsonb_build_object(
   'manual_gold_event',case when not blocked and (s.manual_gold_event->>'ends_at')::timestamptz>instant then s.manual_gold_event end,
   'manual_ball_event',case when not blocked and (s.manual_ball_event->>'ends_at')::timestamptz>instant then s.manual_ball_event end);
  if role_name='admin' and not coalesce((auth.jwt()->>'is_anonymous')::boolean,false) then
   result:=result||jsonb_build_object('weekly_events',(select jsonb_agg(to_jsonb(w) order by local_time) from wakppu_weekly_events w),
    'weekly_gold_event',public.wakppu_weekly_candidate('gold',instant),'weekly_ball_event',public.wakppu_weekly_candidate('ball',instant));
  end if;
 end if;
 return result;
end $function$
;

CREATE OR REPLACE FUNCTION public.wakppu_api_before_skins(b jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare result jsonb; s public.game_states%rowtype; cached jsonb; cached_action text; chosen integer;
begin
 if b->>'action'='hammer_select' then
  -- Reuse all existing account, ban, sleep and maintenance validation.
  perform public.wakppu_api_before_hammer_selection('{"action":"bootstrap"}'::jsonb);
  select * into s from public.game_states where user_id=auth.uid() for update;
  if coalesce(b->>'request_id','') !~ '^[a-f0-9-]{36}$' then raise exception '잘못된 요청 ID';end if;
  select response,action into cached,cached_action from public.wakppu_item_requests where user_id=auth.uid() and request_id=(b->>'request_id')::uuid;
  if found then
   if cached_action<>'hammer_select' then raise exception '요청 ID 충돌';end if;
   return cached;
  end if;
  if coalesce((b->>'item_revision')::bigint,-1)<>s.item_revision then raise sqlstate 'PT409' using message='상태를 다시 불러옵니다.';end if;
  if not s.hammer_owned or not b ? 'level' then raise exception '구매한 망치 레벨 안에서 선택해주세요.';end if;
  if b->'level'<>'null'::jsonb then
   if jsonb_typeof(b->'level')<>'number' or b->>'level' !~ '^(0|[1-9][0-9]*)$' then raise exception '올바른 망치 레벨을 선택해주세요.';end if;
   chosen:=(b->>'level')::integer;
   if chosen not between 0 and s.hammer_level then raise exception '구매한 망치 레벨 안에서 선택해주세요.';end if;
  end if;
  update public.game_states set hammer_selected_level=chosen,item_revision=item_revision+1 where user_id=auth.uid();
  result:=public.wakppu_api_before_hammer_selection('{"action":"items"}'::jsonb)||jsonb_build_object('hammer_selected_level',chosen);
  insert into public.wakppu_item_requests values(auth.uid(),(b->>'request_id')::uuid,'hammer_select',result);
  return result;
 end if;
 result:=public.wakppu_api_before_hammer_selection(b);
 if result ? 'inventory' then
  select hammer_selected_level into chosen from public.game_states where user_id=auth.uid();
  result:=result||jsonb_build_object('hammer_selected_level',chosen);
 end if;
 return result;
end $function$
;

CREATE OR REPLACE FUNCTION public.wakppu_api_before_admin_paid_grants(b jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare a text:=b->>'action';u uuid:=auth.uid();instant timestamptz:=clock_timestamp();g public.wakppu_input_guard%rowtype;result jsonb;cached jsonb;m jsonb;observed integer;elapsed numeric;corroborated boolean;suspect boolean;staff boolean;until_at timestamptz;first_t bigint;end_t bigint;page_no integer;rows jsonb;total bigint;seen boolean:=false;
begin
 if a not in ('item_hit','limited_hit','event_ball_hit','input_report','admin_input_guard') then
  if a='admin_unban' and u is not null and exists(select 1 from public.players where user_id=u and role='admin') and not coalesce((auth.jwt()->>'is_anonymous')::boolean,false) then
   -- Match report lock order before the legacy moderation update.
   perform 1 from public.game_states where user_id=(b->>'user_id')::uuid for update;
   perform 1 from public.wakppu_input_guard where user_id=(b->>'user_id')::uuid for update;
  end if;
  result:=public.wakppu_api_before_input_guard(b);
  if a='admin_unban' then update public.wakppu_input_guard set speed_limited_until=null,score=0,streak=0,last_report=null,last_session=null,last_end=-1,hits='{}' where user_id=(b->>'user_id')::uuid;end if;
  return result;
 end if;
 perform public.wakppu_api_before_input_guard('{"action":"bootstrap"}'::jsonb);
 staff:=exists(select 1 from public.players where user_id=u and role='admin') and not coalesce((auth.jwt()->>'is_anonymous')::boolean,false);
 if a='admin_input_guard' then
  if not staff then raise sqlstate 'PT403' using message='관리자 권한이 필요합니다.';end if;
  if coalesce(b->>'page','0') !~ '^[0-9]{1,6}$' then raise exception '잘못된 페이지';end if;
  page_no:=coalesce((b->>'page')::integer,0);if page_no>100000 then raise exception '잘못된 페이지';end if;
  select count(*) into total from public.wakppu_input_events;
  select coalesce(jsonb_agg(q.row order by q.created_at desc,q.id desc),'[]') into rows from
   (select e.id,e.created_at,jsonb_build_object('at',floor(extract(epoch from e.created_at)*1000),'user_id',e.user_id,'nickname',p.nickname,'score',e.score,'reasons',e.reasons,'metrics',e.metrics,'server_hits',e.server_hits,'corroborated',e.corroborated,'restricted_until',e.restricted_until) as row from public.wakppu_input_events e join public.players p on p.user_id=e.user_id order by e.created_at desc,e.id desc limit 20 offset page_no*20) q;
  return jsonb_build_object('rows',rows,'page',page_no,'total',total);
 end if;
 if coalesce(b->>'request_id','') !~ '^[a-f0-9-]{36}$' then raise exception '잘못된 요청 ID';end if;
 -- Consistent game-state then guard-row locking order across reports and hit APIs.
 perform 1 from public.game_states where user_id=u for update;
 insert into public.wakppu_input_guard(user_id) values(u) on conflict do nothing;
 select * into g from public.wakppu_input_guard where user_id=u for update;
 instant:=clock_timestamp();
 if a in ('item_hit','limited_hit','event_ball_hit') then
  select exists(select 1 from public.wakppu_item_requests where user_id=u and request_id=(b->>'request_id')::uuid)
   or exists(select 1 from public.wakppu_limited_requests where user_id=u and request_id=(b->>'request_id')::uuid)
   or exists(select 1 from public.wakppu_event_ball_progress where user_id=u and request_id=b->>'request_id') into seen;
  if seen then return public.wakppu_api_before_input_guard(b);end if;
  -- multi-position-v2: a soft cap is not an account suspension.
  g.tokens:=least(case when g.speed_limited_until>instant and not staff then 24 else 80 end,g.tokens+greatest(0,extract(epoch from instant-g.token_at))*case when g.speed_limited_until>instant and not staff then 12 else 40 end);
  if g.tokens<1 then raise sqlstate 'PT429' using message='입력이 너무 빠릅니다. 잠시 쉬었다가 눌러주세요.';end if;
  result:=public.wakppu_api_before_input_guard(b);
  select coalesce(array_agg(t order by t),'{}') into g.hits from (select t from unnest(g.hits||case when b->>'hit_source'='ember_auto' then '{}'::timestamptz[] else array[instant] end) t where t>=instant-interval '30 seconds' order by t desc limit 512) q;
  if b->>'hit_source' is distinct from 'ember_auto' then perform public.wakppu_monthly_record(u);end if; update public.wakppu_input_guard set tokens=g.tokens-1,token_at=instant,hits=g.hits where user_id=u;return result;
 end if;
 if b ? 'user_id' then raise exception '대상 계정을 지정할 수 없습니다.';end if;
 if coalesce(b->>'session_id','') !~ '^[a-f0-9-]{36}$' then raise exception '잘못된 입력 세션';end if;
 select response into cached from public.wakppu_input_reports where user_id=u and request_id=(b->>'request_id')::uuid;if found then return cached;end if;
 m:=public.wakppu_input_metrics(b->'samples');first_t:=coalesce((b->'samples'->0->>0)::bigint,0);end_t:=coalesce((b->'samples'->-1->>0)::bigint,0);
 if g.last_report is not null and instant<g.last_report+interval '10 seconds' then raise sqlstate 'PT429' using message='입력 기록 전송 간격이 너무 짧습니다.';end if;
 if g.last_session=(b->>'session_id')::uuid and first_t<=g.last_end then raise exception '이미 분석한 입력 구간입니다.';end if;
 select count(*) into observed from unnest(g.hits) t where t>=instant-interval '30 seconds';
 elapsed:=extract(epoch from instant-coalesce(g.last_report,g.first_seen))*1000;corroborated:=observed>=8 and elapsed>=10000;
 if ((m->>'overspeed')::boolean or (m->>'cyclic')::boolean) and corroborated and not staff then g.speed_limited_until:=instant+interval '30 seconds';end if;
 if g.last_session is distinct from (b->>'session_id')::uuid then g.streak:=0;end if;
 suspect:=(m->>'suspect')::boolean and corroborated;
 g.streak:=case when suspect then g.streak+1 else 0 end;g.score:=case when suspect then least(100,g.score+35+case when (m->>'fixed')::numeric>=.95 then 5 else 0 end) else greatest(0,g.score-10) end;
 if suspect and g.streak>=3 and g.score>=100 and not staff then
  until_at:=instant+interval '2 minutes';
  insert into public.moderation_cases(user_id,status,suspicion_score,strikes,suspended_until,last_reason,updated_at) values(u,'suspended',g.score,1,until_at,'입력 패턴 복수 신호 반복 · 자동 2분 제한',instant)
   on conflict(user_id) do update set status='suspended',suspicion_score=g.score,strikes=moderation_cases.strikes+1,suspended_until=until_at,last_reason=excluded.last_reason,updated_at=instant;
 end if;
 update public.wakppu_input_guard set hits='{}',last_report=instant,last_session=(b->>'session_id')::uuid,last_end=end_t,score=g.score,streak=g.streak,speed_limited_until=g.speed_limited_until where user_id=u;
 m:=m||jsonb_build_object('speed_limited_until',case when g.speed_limited_until>instant then g.speed_limited_until else null end);
 if jsonb_array_length(m->'reasons')>0 or g.score>0 then
  insert into public.wakppu_input_events(user_id,score,reasons,metrics,server_hits,corroborated,restricted_until) values(u,g.score,m->'reasons',m-'reasons',observed,corroborated,until_at);
 end if;
 result:=jsonb_build_object('ok',true,'input_guard',jsonb_build_object('score',g.score,'restricted_until',until_at,'speed_limited_until',case when g.speed_limited_until>instant then g.speed_limited_until else null end));
 insert into public.wakppu_input_reports(user_id,request_id,response) values(u,(b->>'request_id')::uuid,result);
 -- Bounded per-account retention; normalized coordinates are never persisted.
 delete from public.wakppu_input_events where id in(select id from public.wakppu_input_events where created_at<instant-interval '7 days' order by created_at limit 500);
 delete from public.wakppu_input_events where user_id=u and id in(select id from public.wakppu_input_events where user_id=u order by created_at desc,id desc offset 200);
 delete from public.wakppu_input_reports where user_id=u and request_id in(select request_id from public.wakppu_input_reports where user_id=u order by created_at desc,request_id desc offset 64);
 return result;
end $function$
;

CREATE OR REPLACE FUNCTION public.wakppu_first_steps_refundable(u uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
 select exists(select 1 from public.wakppu_first_steps_grants r join public.game_states g using(user_id) join public.wakppu_items i using(user_id)
 where r.user_id=u and r.reclaimed_at is null and g.gold>=r.gold
 and not exists(select 1 from jsonb_each_text(r.items) x where coalesce((i.inventory->>x.key)::bigint,0)<x.value::bigint));
$function$
;

CREATE OR REPLACE FUNCTION public.wakppu_input_metrics(samples jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare p jsonb;n int;i int:=0;j int;k int;c int;label int;segment int:=0;overflow boolean:=false;
 t numeric;x numeric;y numeric;previous numeric;first_t numeric;dt double precision;
 ts double precision[]:='{}';xs double precision[]:='{}';ys double precision[]:='{}';cx double precision[]:='{}';cy double precision[]:='{}';labels int[]:='{}';segments int[]:='{}';frequency int[]:='{}';
 span double precision:=0;sum_sq double precision:=0;min_dt double precision;max_dt double precision;mean double precision;variation double precision:=1;cps double precision:=0;fixed double precision:=0;
 active_span double precision:=0;active_count int:=0;active_cps double precision:=0;batch_count int:=0;batch_ratio double precision:=0;simultaneous boolean;eligible boolean;fast boolean;regular boolean;extended boolean;extreme boolean;overspeed boolean;cyclic boolean;
 period int:=0;accuracy double precision:=0;timing double precision:=0;cycle_cv double precision:=1;
 stable int;pairs int;matches int;times int;time_matches int;cycles int;total double precision;squares double precision;duration double precision;cv double precision;a double precision;tr double precision;reasons jsonb:='[]';
begin
 if samples is null or jsonb_typeof(samples)<>'array' or jsonb_array_length(samples)>2048 then raise exception '입력 기록 형식 오류';end if;
 n:=jsonb_array_length(samples);
 for p in select value from jsonb_array_elements(samples) loop
  if jsonb_typeof(p)<>'array' or jsonb_array_length(p)<>3 or jsonb_typeof(p->0)<>'number' or jsonb_typeof(p->1)<>'number' or jsonb_typeof(p->2)<>'number' then raise exception '입력 기록 형식 오류';end if;
  t:=(p->>0)::numeric;x:=(p->>1)::numeric;y:=(p->>2)::numeric;
  if t<>trunc(t) or x<>trunc(x) or y<>trunc(y) or t not between 0 and 1000000000000 or x not between 0 and 1000 or y not between 0 and 1000 or (previous is not null and t<previous) then raise exception '입력 기록 범위 오류';end if;
  if i=0 then first_t:=t;else
   dt:=t-previous;sum_sq:=sum_sq+dt*dt;min_dt:=least(min_dt,dt);max_dt:=greatest(max_dt,dt);
   if dt<=8 then batch_count:=batch_count+1;end if;
   if dt>0 and dt<=250 then active_span:=active_span+dt;active_count:=active_count+1;end if;
   if dt>250 then segment:=segment+1;end if;
  end if;
  ts:=array_append(ts,t::double precision);xs:=array_append(xs,x::double precision);ys:=array_append(ys,y::double precision);segments:=array_append(segments,segment);
  label:=0;
  if cardinality(cx)>0 then for c in 1..cardinality(cx) loop
   if (cx[c]-x)^2+(cy[c]-y)^2<=1225 then label:=c;exit;end if;
  end loop;end if;
  if label=0 and cardinality(cx)<16 then cx:=array_append(cx,x::double precision);cy:=array_append(cy,y::double precision);frequency:=array_append(frequency,0);label:=cardinality(cx);
  elsif label=0 then overflow:=true;end if;
  labels:=array_append(labels,label);if label>0 then frequency[label]:=frequency[label]+1;end if;
  previous:=t;i:=i+1;
 end loop;
 if n>1 then span:=previous-first_t;mean:=span/(n-1);if mean>0 then cps:=(n-1)*1000/span;variation:=sqrt(greatest(0,sum_sq/(n-1)-mean*mean))/mean;end if;end if;
 if n>0 then select coalesce(max(q.c),0)::double precision/n into fixed from(select count(*) c from unnest(xs,ys) xy(x,y) group by floor(xy.x/5+.5),floor(xy.y/5+.5)) q;end if;
 if active_span>0 then active_cps:=active_count*1000/active_span;end if;
 eligible:=n>=120 and span between 10000 and 30000;fast:=eligible and cps>=10;regular:=eligible and variation<=.02 and max_dt-min_dt<=4;
 extended:=n>=120 and span between 6000 and 30000 and active_span>=4000;extreme:=n>=120 and span between 2000 and 30000 and cps>=60;
 overspeed:=(extended and active_cps>=25) or extreme;
 if n>1 then batch_ratio:=batch_count::double precision/(n-1);end if;
 simultaneous:=cardinality(cx)>=3 and not overflow and batch_ratio>=.35;
 if (extended or extreme) and active_cps>=10 and not overflow and not simultaneous then
  for k in 3..12 loop
   select count(*) into stable from unnest(frequency) f where f>=n::double precision/(2*k);if stable<3 then continue;end if;
   pairs:=0;matches:=0;times:=0;time_matches:=0;cycles:=0;total:=0;squares:=0;
   for j in k+1..n loop
    if segments[j]<>segments[j-k] or labels[j]=0 or labels[j-k]=0 then continue;end if;
    pairs:=pairs+1;if labels[j]=labels[j-k] then matches:=matches+1;end if;
    if j>k+1 and segments[j-k]=segments[j-k-1] then
     times:=times+1;if abs((ts[j]-ts[j-1])-(ts[j-k]-ts[j-k-1]))<=6 then time_matches:=time_matches+1;end if;
    end if;
    if (j-1)%k=0 then duration:=ts[j]-ts[j-k];cycles:=cycles+1;total:=total+duration;squares:=squares+duration*duration;end if;
   end loop;
   mean:=case when cycles>0 then total/cycles else 0 end;cv:=case when mean>0 then sqrt(greatest(0,squares/cycles-mean*mean))/mean else 1 end;
   a:=case when pairs>0 then matches::double precision/pairs else 0 end;tr:=case when times>0 then time_matches::double precision/times else 0 end;
   if pairs>=100 and cycles>=8 and a>=.92 and tr>=.85 and cv<=.12 then period:=k;accuracy:=a;timing:=tr;cycle_cv:=cv;exit;end if;
  end loop;
 end if;
 cyclic:=period>0;
 if fast then reasons:=reasons||jsonb_build_array('지속적인 고속 입력');end if;
 if regular then reasons:=reasons||jsonb_build_array('거의 동일한 입력 간격');end if;
 if eligible and fixed>=.95 then reasons:=reasons||jsonb_build_array('같은 상대 좌표 반복');end if;
 if cyclic then reasons:=reasons||jsonb_build_array('다중 위치 순환 반복','반복되는 순환 입력 주기');end if;
 if overspeed then reasons:=reasons||jsonb_build_array('지속적인 과속 입력 · 일시적 속도 제한 대상');end if;
 return jsonb_build_object('count',n,'span',span,'cps',cps,'variation',variation,'fixed',fixed,'fast',fast,'regular',regular,'active_cps',active_cps,'active_span',active_span,'clusters',cardinality(cx)+case when overflow then 1 else 0 end,'batch_ratio',batch_ratio,'simultaneous',simultaneous,'loop_period',period,'loop_accuracy',accuracy,'timing_repeat',timing,'cycle_cv',cycle_cv,'cyclic',cyclic,'overspeed',overspeed,'suspect',(fast and regular and not simultaneous) or cyclic,'reasons',reasons);
end $function$
;

CREATE OR REPLACE FUNCTION public.wakppu_first_steps_delivery()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare who uuid;balance numeric;rev bigint;stock jsonb;contents jsonb:='{"rare_honey":2,"rare_crack_booster":3,"common_wax_feather":2}';x record;receipt public.wakppu_first_steps_grants;delta integer;
begin
 if (case when tg_op='INSERT' then new.product_id else old.product_id end)<>'first_steps_pack' then
  if tg_op='INSERT' then return new;else return old;end if;
 end if;
 who:=case when tg_op='INSERT' then new.user_id else old.user_id end;
 select gold,item_revision into balance,rev from public.game_states where user_id=who for update;
 if not found then raise sqlstate 'PT404' using message='게임 계정이 없습니다.';end if;
 insert into public.wakppu_items(user_id) values(who) on conflict do nothing;
 select inventory into stock from public.wakppu_items where user_id=who for update;
 if tg_op='INSERT' then
  if exists(select 1 from public.wakppu_first_steps_grants where user_id=who) then raise sqlstate 'PT409' using message='첫걸음 성장팩은 계정당 한 번만 구매할 수 있습니다.';end if;
  if not exists(select 1 from public.wakppu_purchase_orders where id=new.order_id and user_id=who and product_id='first_steps_pack' and status='approved') then raise sqlstate 'PT409';end if;
  delta:=1;
 else
  select * into receipt from public.wakppu_first_steps_grants where user_id=who and order_id=old.order_id for update;
  if not found or receipt.reclaimed_at is not null then raise sqlstate 'PT409';end if;
  if not public.wakppu_first_steps_refundable(who) then raise sqlstate 'PT409' using message='지급한 골드 또는 아이템이 부족하여 자동 회수할 수 없습니다. 사용 내역을 확인하세요.';end if;
  delta:=-1;
 end if;
 for x in select key,value from jsonb_each_text(contents) loop
  stock:=jsonb_set(stock,array[x.key],to_jsonb(coalesce((stock->>x.key)::bigint,0)+delta*x.value::bigint));
 end loop;
 update public.wakppu_items set inventory=stock where user_id=who;
 update public.game_states set gold=gold+delta*3000,item_revision=item_revision+1 where user_id=who returning item_revision into rev;
 if tg_op='INSERT' then
  insert into public.wakppu_first_steps_grants(user_id,order_id,revision) values(who,new.order_id,rev);return new;
 else
  update public.wakppu_first_steps_grants set reclaimed_at=clock_timestamp(),revision=rev where user_id=who;return old;
 end if;
end $function$
;

CREATE OR REPLACE FUNCTION public.wakppu_supporter_percent(u uuid)
 RETURNS integer
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
 select coalesce(max(case product_id when 'premium_supporter_pack' then 30 when 'supporter_pack' then 5 end),0) from public.wakppu_purchase_entitlements where user_id=u and product_id in ('supporter_pack','premium_supporter_pack');
$function$
;

CREATE OR REPLACE FUNCTION public.wakppu_purchase_snapshot(u uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare c public.wakppu_purchase_config;ready boolean;
begin
 if u is null or u is distinct from auth.uid() then raise sqlstate 'PT403';end if;
 select * into c from public.wakppu_purchase_config where id;
 select not coalesce(is_anonymous,true) and email_confirmed_at is not null and coalesce(email,'')<>'' into ready from auth.users where id=u;
 return jsonb_build_object('starter_grant',(select to_jsonb(r) from public.wakppu_first_steps_grants r where user_id=u),'title_visible',coalesce((select title_visible from public.wakppu_purchase_cosmetics where user_id=u),true),'supporter_percent',public.wakppu_supporter_percent(u),'eligible',coalesce(ready,false),'enabled',c.enabled,'bank',case when c.enabled then to_jsonb(c)-'id'-'revision'-'enabled' else '{}'::jsonb end,
  'products',(select coalesce(jsonb_agg(to_jsonb(p)||jsonb_build_object('regular_amount',p.amount,'amount',case when p.id='premium_supporter_pack' and exists(select 1 from public.wakppu_purchase_entitlements where user_id=u and product_id='supporter_pack') then 8900 else p.amount end) order by amount),'[]') from public.wakppu_purchase_products p),
  'owned',(select coalesce(jsonb_object_agg(product_id,order_id),'{}') from public.wakppu_purchase_entitlements where user_id=u),
  'equipped',coalesce((select equipped from public.wakppu_purchase_cosmetics where user_id=u),false),
  'orders',(select coalesce(jsonb_agg(to_jsonb(o)-'approved_by'-'deposit_reference'-'refund_reference'-'request_id' order by created_at desc),'[]') from (select * from public.wakppu_purchase_orders where user_id=u order by created_at desc limit 50) o));
end $function$
;

CREATE OR REPLACE FUNCTION public.wakppu_pumpkin_candy_roll()
 RETURNS double precision
 LANGUAGE sql
 SET search_path TO 'pg_catalog'
AS $function$
 select (('x'||substr(replace(gen_random_uuid()::text,'-',''),1,8))::bit(32)::bigint)/4294967296.0
$function$
;

CREATE OR REPLACE FUNCTION public.wakppu_api_before_guest_exit(b jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare a text:=b->>'action';u uuid:=auth.uid();g public.game_states%rowtype;
 l public.wakppu_limited_players%rowtype;s public.wakppu_skins%rowtype;d public.wakppu_pumpkin_skin_defs%rowtype;
 cached public.wakppu_skin_requests%rowtype;fp jsonb;rid uuid;access boolean;active boolean;
 result jsonb;catalog jsonb;owned jsonb;equipped text;can_equip boolean;
begin
 if a is null or a not in ('pumpkin_skins','pumpkin_skin_exchange','pumpkin_skin_equip','pumpkin_scare_disable_buy','pumpkin_scare_disable_equip') then return public.wakppu_api_before_pumpkin_skins(b);end if;
 if u is null then raise sqlstate 'PT401' using message='로그인이 필요합니다.';end if;
 -- Shared auth, maintenance, moderation and sleep gates remain authoritative.
 perform public.wakppu_api_before_pumpkin_skins(jsonb_build_object('action','bootstrap'));
 access:=public.wakppu_admin_content_access();
 -- Same per-user lock order as limited API; do not trust client balances or role claims.
 select * into g from public.game_states where user_id=u for update;
 if not found then raise sqlstate 'PT401' using message='게임 계정을 다시 불러와주세요.';end if;
 insert into public.wakppu_limited_players(user_id) values(u) on conflict do nothing;
 select * into l from public.wakppu_limited_players where user_id=u for update;
 insert into public.wakppu_skins(user_id) values(u) on conflict do nothing;
 select * into s from public.wakppu_skins where user_id=u for update;
 select clock_timestamp()>=starts_at and clock_timestamp()<ends_at into active from public.wakppu_limited_settings where id=true;
 active:=coalesce(active,false);can_equip:=access or l.owned?'halloween-pumpkin-2026';
 if a<>'pumpkin_skins' then
  if coalesce(b->>'request_id','')!~'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then raise exception '잘못된 요청 ID';end if;
  rid:=(b->>'request_id')::uuid;
  fp:=jsonb_build_object('action',a,'skin_id',b->'skin_id','ball_id',b->'ball_id','count',b->'count');
  if a='pumpkin_scare_disable_equip' then fp:=fp||jsonb_build_object('enabled',b->'enabled');end if;
  select * into cached from public.wakppu_skin_requests where user_id=u and request_id=rid;
  if found then
   if cached.request<>fp then raise exception '요청 ID 충돌';end if;
   -- A retry never charges or changes equip again, and never revives revoked admin access.
  else
   if coalesce((b->>'item_revision')::bigint,-1)<>g.item_revision or coalesce((b->>'skin_revision')::bigint,-1)<>s.revision then raise sqlstate 'PT409' using message='스킨 상태가 변경되었습니다. 다시 불러와주세요.';end if;
   if a='pumpkin_scare_disable_buy' then
    if not active then raise sqlstate 'PT409' using message='할로윈 이벤트 기간이 아닙니다.';end if;
    if l.scare_optout_owned then raise sqlstate 'PT409' using message='이미 영구 해제를 구매했습니다.';end if;
    if l.tokens<100 then raise sqlstate 'PT409' using message='할로윈 사탕이 부족합니다.';end if;
    l.tokens:=l.tokens-100;l.scare_disabled:=true;l.scare_optout_owned:=true;
    update public.wakppu_limited_players set tokens=l.tokens,scare_disabled=true,scare_optout_owned=true where user_id=u;
   elsif a='pumpkin_scare_disable_equip' then
    if not l.scare_optout_owned then raise sqlstate 'PT403' using message='구매한 점프스케어 해제 상품만 장착할 수 있습니다.';end if;
    if jsonb_typeof(b->'enabled') is distinct from 'boolean' then raise sqlstate 'PT400';end if;
    l.scare_disabled:=(b->>'enabled')::boolean;
    update public.wakppu_limited_players set scare_disabled=l.scare_disabled where user_id=u;
   elsif a='pumpkin_skin_exchange' then
    if access then raise exception '관리자는 구매 없이 바로 장착할 수 있습니다.';end if;
    if not active then raise sqlstate 'PT409' using message='할로윈 이벤트 기간이 아닙니다.';end if;
    select * into d from public.wakppu_pumpkin_skin_defs where skin_id=b->>'skin_id';
    if not found or s.owned?d.skin_id then raise exception '교환할 미보유 스킨을 선택해주세요.';end if;
    if l.tokens<d.candy_cost then raise exception '할로윈 사탕이 부족합니다.';end if;
    l.tokens:=l.tokens-d.candy_cost;s.owned:=s.owned||jsonb_build_object(d.skin_id,true);
    update public.wakppu_limited_players set tokens=l.tokens where user_id=u;
   else
    if b->>'ball_id' is distinct from 'halloween-pumpkin-2026' then raise exception '대상 왁뿌볼 오류';end if;
    if b->>'skin_id' is null then s.equipped:=s.equipped-'halloween-pumpkin-2026';
    else
     select * into d from public.wakppu_pumpkin_skin_defs where skin_id=b->>'skin_id' and ball_id=b->>'ball_id';
     if not found or (not access and not(s.owned?d.skin_id)) then raise exception '보유한 전용 스킨만 장착할 수 있습니다.';end if;
     if not can_equip then raise exception '잭오랜턴 왁뿌볼을 먼저 해금해주세요.';end if;
     s.equipped:=s.equipped||jsonb_build_object(d.ball_id,d.skin_id);
    end if;
   end if;
   s.revision:=s.revision+1;g.item_revision:=g.item_revision+1;
   update public.wakppu_skins set owned=s.owned,equipped=s.equipped,revision=s.revision where user_id=u;
   update public.game_states set item_revision=g.item_revision where user_id=u;
  end if;
 end if;
 select coalesce(jsonb_agg(jsonb_build_object('skin_id',skin_id,'ball_id',ball_id,'cost',candy_cost::text) order by position),'[]') into catalog from public.wakppu_pumpkin_skin_defs;
 owned:=s.owned;
 if access then owned:=owned||(select coalesce(jsonb_object_agg(skin_id,true),'{}') from public.wakppu_pumpkin_skin_defs);end if;
 equipped:=s.equipped->>'halloween-pumpkin-2026';
 if not can_equip or not(owned?equipped) or not exists(select 1 from public.wakppu_pumpkin_skin_defs where skin_id=equipped) then equipped:=null;end if;
 result:=jsonb_build_object('scare_optout_owned',l.scare_optout_owned,'scare_disabled',l.scare_disabled,'scare_disable_cost','100','catalog',catalog,'owned',owned,'equipped',equipped,'tokens',l.tokens::text,'active',active,'can_equip',can_equip,'admin_content_access',access,'skin_revision',s.revision,'revision',g.item_revision,'gold',g.gold::text);
 if a<>'pumpkin_skins' and cached.user_id is null then insert into public.wakppu_skin_requests values(u,rid,fp,result);end if;
 return result;
end $function$
;

CREATE OR REPLACE FUNCTION public.wakppu_custom_entitlement()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare o public.wakppu_purchase_orders;src uuid;who uuid;product text;begin
 if tg_op='INSERT' then who:=new.user_id;product:=new.product_id;else who:=old.user_id;product:=old.product_id;end if;
 if product not in('custom_ball_single','custom_ball_all') then if tg_op='INSERT' then return new;else return old;end if;end if;
 perform pg_advisory_xact_lock(hashtextextended(who::text,19));
 if tg_op='INSERT' then
  select * into o from public.wakppu_purchase_orders where id=new.order_id and user_id=who and product_id=product and status='approved';if not found then raise sqlstate 'PT409';end if;
  if product='custom_ball_single' then
   if exists(select 1 from public.wakppu_purchase_entitlements where user_id=who and product_id in('custom_ball_single','custom_ball_all')) then raise sqlstate 'PT409' using message='이미 커스텀 이용권을 보유하고 있습니다.';end if;
   if o.custom_target is null and o.source='admin_grant' then select selected_ball_id into o.custom_target from public.game_states where user_id=who;update public.wakppu_purchase_orders set custom_target=o.custom_target where id=o.id;end if;
   if not public.wakppu_custom_known(o.custom_target) then raise sqlstate 'PT400' using message='적용 대상 볼을 확인하세요.';end if;
  else
   select order_id into src from public.wakppu_purchase_entitlements where user_id=who and product_id='custom_ball_single';
   if exists(select 1 from public.wakppu_purchase_entitlements where user_id=who and product_id='custom_ball_all') then raise sqlstate 'PT409';end if;
   if o.custom_upgrade_order_id is not null and o.custom_upgrade_order_id is distinct from src then raise sqlstate 'PT409' using message='업그레이드에 필요한 단일 이용권이 없습니다. 입금 내역을 확인하세요.';end if;
   if o.source='bank' and src is not null and o.custom_upgrade_order_id is null then raise sqlstate 'PT409' using message='단일 이용권을 이미 보유하고 있습니다. 주문 금액을 확인하세요.';end if;
  end if;
  return new;
 end if;
 if product='custom_ball_single' and current_setting('wakppu.custom_discard',true) is distinct from who::text and exists(select 1 from public.wakppu_purchase_entitlements e join public.wakppu_purchase_orders q on q.id=e.order_id where e.user_id=who and q.custom_upgrade_order_id=old.order_id) then raise sqlstate 'PT409' using message='이 이용권으로 업그레이드한 전체 상품을 먼저 회수·환불하세요.';end if;
 return old;
end$function$
;

CREATE OR REPLACE FUNCTION public.wakppu_custom_asset_retire()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$begin insert into public.wakppu_custom_gc(path) values(old.path) on conflict do nothing;return old;end$function$
;

CREATE OR REPLACE FUNCTION public.wakppu_api_before_developer_keepsake(b jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare u uuid:=auth.uid();anonymous boolean;a text:=b->>'action';sid text:=auth.jwt()->>'session_id';begin
 if a='guest_discard' then
  if u is null then raise sqlstate 'PT401' using message='로그인이 필요합니다.';end if;
  if b->>'confirmation' is distinct from 'DELETE_GUEST' or b->>'expected_user_id' is distinct from u::text or b?'user_id' or b?'target_user_id' then
   raise sqlstate 'PT409' using message='본인 빠른 시작 계정의 삭제를 다시 확인해주세요.';
  end if;
  select is_anonymous into anonymous from auth.users where id=u for update;
  -- Safe retry after a lost success response. Never recreate a deleted account.
  if not found then return jsonb_build_object('deleted',true,'user_id',u);end if;
  if anonymous is distinct from true or exists(select 1 from public.players where user_id=u and role='admin') then raise sqlstate 'PT403' using message='빠른 시작 계정만 삭제할 수 있습니다. 이메일 계정은 삭제하지 않습니다.';end if;
  if sid is null or not exists(select 1 from auth.sessions where id=sid::uuid and user_id=u) then raise sqlstate 'PT401' using message='로그인이 만료됐습니다. 계정 삭제를 다시 확인해주세요.';end if;
  -- Lock the progress row before removing owned progress/entitlements.
  perform 1 from public.game_states where user_id=u for update;
  update public.wakppu_purchase_orders set deleted_user_id=u where user_id=u;
  update public.admin_audit_logs set details=coalesce(details,'{}')||jsonb_build_object('deleted_target_user_id',u) where target_user_id=u;
  delete from public.wakppu_purchase_entitlements where user_id=u;
  delete from public.wakppu_purchase_cosmetics where user_id=u;
  delete from public.wakppu_first_steps_grants where user_id=u;
  -- Auth sessions/identities and all FK-cascaded gameplay rows are removed atomically.
  delete from auth.users where id=u;
  return jsonb_build_object('deleted',true,'user_id',u);
 end if;
 -- JWTs can remain cryptographically valid after deletion; deny every stale-token API.
 if u is not null and not exists(select 1 from auth.users where id=u) then raise sqlstate 'PT401' using message='삭제되었거나 만료된 계정입니다. 다시 로그인해주세요.';end if;
 return public.wakppu_api_before_guest_exit(b);
end $function$
;

CREATE OR REPLACE FUNCTION public.wakppu_custom_gc_batch(paths text[] DEFAULT NULL::text[])
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$begin
 if coalesce(auth.jwt()->>'role','')<>'service_role' then raise sqlstate 'PT403';end if;
 if paths is not null then delete from public.wakppu_custom_gc where path=any(paths);end if;
 return(select coalesce(jsonb_agg(path),'[]') from(select path from public.wakppu_custom_gc order by created_at limit 32)s);
end$function$
;

CREATE OR REPLACE FUNCTION public.wakppu_custom_known(t text)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
 select coalesce(exists(select 1 from public.wakppu_item_balls where ball_id=t) or t in('admin-event','halloween-pumpkin-2026'),false);$function$
;

CREATE OR REPLACE FUNCTION public.wakppu_api_before_pet_traits(b jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare a text:=b->>'action';u uuid:=auth.uid();g public.game_states;l public.wakppu_limited_players;c public.wakppu_halloween_cosmetics;
 cached public.wakppu_halloween_cosmetic_requests;rid uuid;fp jsonb;reward jsonb;id text;active boolean;duplicate boolean;
begin
 if a is null or a not in ('halloween_cosmetics','halloween_decor_open','halloween_decor_exchange','halloween_decor_equip','halloween_decor_use') then return public.wakppu_api_before_halloween_cosmetics(b);end if;
 if u is null then raise sqlstate 'PT401' using message='로그인이 필요합니다.';end if;
 perform public.wakppu_api_before_halloween_cosmetics('{"action":"bootstrap"}');
 select * into g from public.game_states where user_id=u for update;
 if not found then raise sqlstate 'PT401';end if;
 insert into public.wakppu_limited_players(user_id) values(u) on conflict do nothing;
 select * into l from public.wakppu_limited_players where user_id=u for update;
 insert into public.wakppu_halloween_cosmetics(user_id) values(u) on conflict do nothing;
 select * into c from public.wakppu_halloween_cosmetics where user_id=u for update;
 if a='halloween_cosmetics' then return public.wakppu_halloween_cosmetic_snapshot(u);end if;
 if coalesce(b->>'request_id','')!~'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then raise sqlstate 'PT400' using message='잘못된 요청 ID';end if;
 rid:=(b->>'request_id')::uuid;fp:=jsonb_build_object('action',a,'item_id',b->'item_id');
 select * into cached from public.wakppu_halloween_cosmetic_requests where user_id=u and request_id=rid;
 if found then
  if cached.request<>fp then raise sqlstate 'PT409' using message='다른 작업에 사용된 요청입니다.';end if;
  return public.wakppu_halloween_cosmetic_snapshot(u)||jsonb_build_object('result',cached.result);
 end if;
 if coalesce((b->>'item_revision')::bigint,-1)<>g.item_revision or coalesce((b->>'decor_revision')::bigint,-1)<>c.revision then raise sqlstate 'PT409' using message='상태가 변경되었습니다. 다시 불러와주세요.';end if;
 id:=b->>'item_id';reward:='{}';
 if a='halloween_decor_open' then
  select clock_timestamp()>=starts_at and clock_timestamp()<ends_at into active from public.wakppu_limited_settings ls where ls.id=true;
  if not coalesce(active,false) then raise sqlstate 'PT409' using message='할로윈 상자 판매 기간이 아닙니다.';end if;
  if l.tokens<100 then raise sqlstate 'PT409' using message='100캔디가 필요합니다.';end if;
  -- One server-side uniform draw; no client seed, price, odds or prize is trusted.
  id:=(array['little_ghost','pumpkin_ember','bat_swarm'])[1+floor(random()*3)::integer];duplicate:=c.owned?id;
  l.tokens:=l.tokens-100;c.opened:=c.opened+1;
  if duplicate then c.shards:=c.shards+1;else c.owned:=c.owned||jsonb_build_object(id,true);end if;
  reward:=jsonb_build_object('item_id',id,'duplicate',duplicate,'shards_gained',case when duplicate then 1 else 0 end);
 elsif a='halloween_decor_exchange' then
  if id is null or id not in ('little_ghost','pumpkin_ember','bat_swarm') then raise sqlstate 'PT400';end if;
  if c.owned?id then raise sqlstate 'PT409' using message='이미 보유한 꾸미기입니다.';end if;
  if c.shards<3 then raise sqlstate 'PT409' using message='할로윈 조각 3개가 필요합니다.';end if;
  c.shards:=c.shards-3;c.owned:=c.owned||jsonb_build_object(id,true);reward:=jsonb_build_object('item_id',id,'exchanged',true);
 elsif a='halloween_decor_equip' then
  if id is not null and (id not in ('little_ghost','pumpkin_ember','bat_swarm') or (not(c.owned?id) and not public.wakppu_admin_content_access())) then raise sqlstate 'PT403' using message='보유한 꾸미기만 장착할 수 있습니다.';end if;
  c.equipped:=id;
 else
  if id is distinct from 'bat_swarm' or (not(c.owned?id) and not public.wakppu_admin_content_access()) then raise sqlstate 'PT403' using message='보유한 박쥐 무리만 사용할 수 있습니다.';end if;
  c.equipped:='bat_swarm';reward:=jsonb_build_object('used','bat_swarm');
 end if;
 c.revision:=c.revision+1;g.item_revision:=g.item_revision+1;
 update public.wakppu_halloween_cosmetics set owned=c.owned,equipped=c.equipped,shards=c.shards,opened=c.opened,revision=c.revision where user_id=u;
 update public.wakppu_limited_players set tokens=l.tokens where user_id=u;
 update public.game_states set item_revision=g.item_revision where user_id=u;
 insert into public.wakppu_halloween_cosmetic_requests values(u,rid,fp,reward);
 return public.wakppu_halloween_cosmetic_snapshot(u)||jsonb_build_object('result',reward);
end $function$
;

CREATE OR REPLACE FUNCTION public.wakppu_api_before_custom_studio(b jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare a text:=b->>'action';u uuid:=auth.uid();t uuid;rid uuid;why text;result jsonb;rev bigint;prior public.wakppu_developer_keepsakes;
begin
 if a in ('admin_keepsake_status','admin_keepsake_grant') then
  if u is null then raise sqlstate 'PT401';end if;
  perform public.wakppu_api_before_developer_keepsake('{"action":"bootstrap"}');
  if not exists(select 1 from public.players p join auth.users au on au.id=p.user_id where p.user_id=u and p.role='admin' and not coalesce(au.is_anonymous,true)) then raise sqlstate 'PT403' using message='개발자 권한이 필요합니다.';end if;
  t:=(b->>'user_id')::uuid;if t is null or not exists(select 1 from public.players where user_id=t) then raise sqlstate 'PT404' using message='대상 계정을 확인하세요.';end if;
  perform pg_advisory_xact_lock(hashtextextended(t::text,19));
  if a='admin_keepsake_grant' then
   why:=trim(coalesce(b->>'reason',''));rid:=(b->>'request_id')::uuid;
   if rid is null or length(why)<3 or length(why)>200 or b->>'item_id' is distinct from 'developer_piercing_fragment' then raise sqlstate 'PT400';end if;
   select * into prior from public.wakppu_developer_keepsakes where granted_by=u and request_id=rid;
   if found and prior.user_id<>t then raise sqlstate 'PT409' using message='같은 요청을 다른 계정에 사용할 수 없습니다.';end if;
   if not exists(select 1 from public.wakppu_developer_keepsakes where user_id=t) then
    insert into public.wakppu_developer_keepsakes(user_id,granted_by,request_id,reason) values(t,u,rid,why);
    insert into public.admin_audit_logs(admin_user_id,target_user_id,action,reason,details) values(u,t,a,why,jsonb_build_object('item_id','developer_piercing_fragment','permanent',true));
   end if;
  end if;
  return jsonb_build_object('user_id',t,'owned',exists(select 1 from public.wakppu_developer_keepsakes where user_id=t),'granted_at',(select granted_at from public.wakppu_developer_keepsakes where user_id=t));
 end if;
 if a='item_use' and b->>'item_id'='developer_piercing_fragment' then
  if u is null then raise sqlstate 'PT401';end if;
  perform public.wakppu_api_before_developer_keepsake('{"action":"bootstrap"}');
  select item_revision into rev from public.game_states where user_id=u for update;
  if not exists(select 1 from public.wakppu_developer_keepsakes where user_id=u) then raise sqlstate 'PT403' using message='지급받은 소장품만 사용할 수 있습니다.';end if;
  if coalesce(b->>'request_id','')!~'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then raise sqlstate 'PT400';end if;
  if coalesce((b->>'item_revision')::bigint,-1)<>rev then raise sqlstate 'PT409';end if;
  -- A cosmetic use is a pure read: no stock consumption, effects or reward/revision changes.
  result:=public.wakppu_api_before_developer_keepsake('{"action":"items"}');
 else result:=public.wakppu_api_before_developer_keepsake(b);end if;
 if jsonb_typeof(result)='object' and (result?'inventory' or (a='item_use' and b->>'item_id'='developer_piercing_fragment')) and exists(select 1 from public.wakppu_developer_keepsakes where user_id=u) then
  result:=jsonb_set(result,'{inventory}',coalesce(result->'inventory','{}')||'{"developer_piercing_fragment":1}'::jsonb);
 end if;
 return result;
end $function$
;

CREATE OR REPLACE FUNCTION public.wakppu_custom_owned(u uuid, t text)
 RETURNS boolean
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare e jsonb;begin
 if not public.wakppu_custom_known(t) then return false;end if;
 if public.wakppu_admin_content_access() then return true;end if;
 if t='halloween-pumpkin-2026' then return exists(select 1 from public.wakppu_limited_players where user_id=u and owned?t);end if;
 if t='admin-event' then
  e:=public.wakppu_api_before_custom_studio('{"action":"status"}')->'admin_ball_event';
  return coalesce(e is not null and clock_timestamp()>=(e->>'starts_at')::timestamptz and clock_timestamp()<(e->>'ends_at')::timestamptz,false);
 end if;
 return exists(select 1 from public.game_states where user_id=u and unlocked_ball_ids?t);
end$function$
;

CREATE OR REPLACE FUNCTION public.wakppu_custom_preset(u uuid, t text)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
 select public.wakppu_custom_known(t) or (t like 'skin:%' and exists(select 1 from public.wakppu_skin_defs d where d.skin_id='eternity_'||substr(t,6)) and(public.wakppu_admin_content_access() or exists(select 1 from public.wakppu_skins where user_id=u and owned?('eternity_'||substr(t,6)))))
 or(t like 'pumpkin:%' and exists(select 1 from public.wakppu_pumpkin_skin_defs d where d.skin_id='pumpkin_'||substr(t,9)) and(public.wakppu_admin_content_access() or exists(select 1 from public.wakppu_skins where user_id=u and owned?('pumpkin_'||substr(t,9)))));$function$
;

CREATE OR REPLACE FUNCTION public.wakppu_custom_snapshot(u uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare plan text:='none';bound_ball text;settings jsonb;balls jsonb;presets jsonb;begin
 if u is null or u is distinct from auth.uid() then raise sqlstate 'PT401';end if;
 if public.wakppu_admin_content_access() or exists(select 1 from public.wakppu_purchase_entitlements where user_id=u and product_id='custom_ball_all') then plan:='all';
 else select o.custom_target into bound_ball from public.wakppu_purchase_entitlements e join public.wakppu_purchase_orders o on o.id=e.order_id where e.user_id=u and e.product_id='custom_ball_single';if found then plan:='single';end if;end if;
 select coalesce(jsonb_agg(t),'[]') into balls from(select ball_id t from public.wakppu_item_balls union select 'admin-event' union select 'halloween-pumpkin-2026') c where public.wakppu_custom_owned(u,t);
 select coalesce(jsonb_agg(t),'[]') into presets from(select ball_id t from public.wakppu_item_balls union select 'admin-event' union select 'halloween-pumpkin-2026' union select 'skin:'||substr(skin_id,10) from public.wakppu_skin_defs union select 'pumpkin:'||substr(skin_id,9) from public.wakppu_pumpkin_skin_defs)c where public.wakppu_custom_preset(u,t);
 select coalesce(jsonb_object_agg(p.target,jsonb_build_object('asset_id',p.asset_id,'effect',p.effect,'sound',p.sound,'disabled',p.disabled)),'{}') into settings from public.wakppu_custom_profiles p where p.user_id=u and(plan='all' or(plan='single' and p.target in(bound_ball,'@all')));
 return jsonb_build_object('plan',plan,'target',bound_ball,'revision',coalesce((select revision from public.wakppu_custom_accounts where user_id=u),0),'global',settings->'@all','profiles',settings-'@all','balls',balls,'presets',presets,'admin_access',public.wakppu_admin_content_access());
end$function$
;

CREATE OR REPLACE FUNCTION public.wakppu_api_before_auto_rebirth(b jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare a text:=b->>'action';u uuid:=auth.uid();c public.wakppu_purchase_config;p public.wakppu_purchase_products;o public.wakppu_purchase_orders;src uuid;rid uuid;price integer;s jsonb;r jsonb;target text;paths jsonb;begin
 if a='guest_discard' then perform set_config('wakppu.custom_discard',u::text,true);r:=public.wakppu_api_before_custom_studio(b);perform set_config('wakppu.custom_discard','',true);return r;end if;
 if a in('custom_status','custom_image_paths','custom_prepare') or(a='purchase_order' and b->>'product_id' in('custom_ball_single','custom_ball_all')) then
  if u is null then raise sqlstate 'PT401';end if;perform pg_advisory_xact_lock(hashtextextended(u::text,19));perform public.wakppu_api_before_custom_studio('{"action":"bootstrap"}');
  if b?'user_id' then raise sqlstate 'PT400';end if;
  s:=public.wakppu_custom_snapshot(u);
  if a='custom_status' then return s;end if;
  if a='custom_prepare' then
   if s->>'plan'='none' then raise sqlstate 'PT403';end if;
   if not exists(select 1 from public.wakppu_custom_requests where user_id=u and request_id=(b->>'request_id')::uuid) and (b->>'revision')::bigint is distinct from(s->>'revision')::bigint then raise sqlstate 'PT409' using message='다른 창에서 설정이 변경되었습니다. 다시 불러오세요.';end if;
   insert into public.wakppu_custom_accounts(user_id) values(u) on conflict do nothing;
   update public.wakppu_custom_accounts set upload_count=case when upload_window>clock_timestamp()-interval '1 minute' then upload_count+1 else 1 end,upload_window=case when upload_window>clock_timestamp()-interval '1 minute' then upload_window else clock_timestamp() end where user_id=u;
   if(select upload_count from public.wakppu_custom_accounts where user_id=u)>60 then raise sqlstate 'PT429' using message='이미지 요청이 너무 잦습니다. 잠시 후 시도해주세요.';end if;
   return jsonb_build_object('ok',true);
  end if;

  if a='custom_image_paths' then
   select coalesce(jsonb_agg(jsonb_build_object('id',x.id,'path',x.path)),'[]') into paths from public.wakppu_custom_assets x where x.user_id=u and exists(select 1 from public.wakppu_custom_profiles f where f.user_id=u and f.asset_id=x.id and not f.disabled and public.wakppu_custom_preset(u,f.effect) and public.wakppu_custom_preset(u,f.sound) and(s->>'plan'='all' or s->>'plan'='single' and f.target in(s->>'target','@all')));
   return paths;
  end if;
  if not exists(select 1 from auth.users where id=u and not is_anonymous and email_confirmed_at is not null and coalesce(email,'')<>'') then raise sqlstate 'PT403' using message='이메일 인증 후 주문할 수 있습니다.';end if;
  rid:=(b->>'request_id')::uuid;if rid is null then raise sqlstate 'PT400';end if;
  select * into o from public.wakppu_purchase_orders where user_id=u and request_id=rid;
  if found then if o.product_id is distinct from b->>'product_id' or o.depositor is distinct from trim(b->>'depositor') or o.product_id='custom_ball_single' and o.custom_target is distinct from b->>'target' then raise sqlstate 'PT409';end if;return public.wakppu_purchase_snapshot(u)||jsonb_build_object('order',to_jsonb(o));end if;
  select * into c from public.wakppu_purchase_config where id for share;if not c.enabled then raise sqlstate 'PT409' using message='현재 새 주문을 받고 있지 않습니다.';end if;
  select * into p from public.wakppu_purchase_products where id=b->>'product_id';price:=p.amount;
  if s->>'plan'='all' or(p.id='custom_ball_single' and s->>'plan'='single') then raise sqlstate 'PT409' using message='이미 이용권을 보유하고 있습니다.';end if;
  if p.id='custom_ball_all' then select order_id into src from public.wakppu_purchase_entitlements where user_id=u and product_id='custom_ball_single';if src is not null then price:=19100;end if;
  else target:=b->>'target';if not public.wakppu_custom_owned(u,target) then raise sqlstate 'PT403' using message='보유한 적용 대상 볼을 선택하세요.';end if;end if;
  if b?'amount' and(b->>'amount')::integer is distinct from price then raise sqlstate 'PT400' using message='상품 금액이 일치하지 않습니다.';end if;
  if length(trim(coalesce(b->>'depositor','')))<2 or length(trim(b->>'depositor'))>30 then raise sqlstate 'PT400';end if;
  select * into o from public.wakppu_purchase_orders where user_id=u and product_id in('custom_ball_single','custom_ball_all') and status in('pending','claimed') order by created_at desc limit 1;
  if found then if o.product_id<>p.id or o.custom_target is distinct from target then raise sqlstate 'PT409' using message='기존 커스텀 주문을 먼저 확인·취소해주세요.';end if;return public.wakppu_purchase_snapshot(u)||jsonb_build_object('order',to_jsonb(o));end if;
  insert into public.wakppu_purchase_orders(user_id,request_id,product_id,product_name,amount,depositor,bank,custom_target,custom_upgrade_order_id) values(u,rid,p.id,p.name,price,trim(b->>'depositor'),to_jsonb(c)-'id'-'revision'-'enabled',target,src) returning * into o;
  return public.wakppu_purchase_snapshot(u)||jsonb_build_object('order',to_jsonb(o));
 end if;
 r:=public.wakppu_api_before_custom_studio(b);
 if a='purchase_catalog' then
  s:=public.wakppu_custom_snapshot(u);
  r:=r||jsonb_build_object('custom',s,'products',(select jsonb_agg(case when x->>'id'='custom_ball_all' and s->>'plan'='single' then x||'{"amount":19100}'::jsonb else x end order by (x->>'amount')::integer) from jsonb_array_elements(r->'products')x));
 end if;
 if a='admin_purchase_orders' then r:=jsonb_set(r,'{orders}',(select coalesce(jsonb_agg(x||jsonb_build_object('custom_refund_blocked',exists(select 1 from public.wakppu_purchase_entitlements e join public.wakppu_purchase_orders q on q.id=e.order_id where q.custom_upgrade_order_id=(x->>'id')::uuid))),'[]') from jsonb_array_elements(r->'orders')x));end if;
 return r;
end$function$
;

CREATE OR REPLACE FUNCTION public.wakppu_auto_rebirth_reset()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$begin
 if coalesce(new.product_id,old.product_id)='auto_rebirth' then
  if tg_op='DELETE' then update public.wakppu_auto_rebirth set enabled=false where user_id=old.user_id;
  else insert into public.wakppu_auto_rebirth(user_id,enabled) values(new.user_id,false) on conflict(user_id) do update set enabled=false;end if;
 end if;return null;
end$function$
;

CREATE OR REPLACE FUNCTION public.wakppu_rebirth_cost(n integer)
 RETURNS numeric
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare costs numeric[]:=array[2000000,6000000,16000000,40000000,100000000,240000000,600000000,1600000000,4000000000,10000000000,30000000000,80000000000,200000000000,500000000000,1200000000000,3000000000000,8000000000000,20000000000000,48000000000000,120000000000000,300000000000000,800000000000000,2000000000000000,4800000000000000,12000000000000000];c numeric; i integer;
begin
 if n is null or n<0 or n>=1000 then return null;end if;
 if n<25 then return costs[n+1];end if;c:=costs[25];
 for i in 26..n+1 loop c:=c*case when i<=100 and (i-26)%10=9 then 1 when i<=500 then 2 else 3 end;end loop;
 return c;
end$function$
;

CREATE OR REPLACE FUNCTION public.wakppu_equipped_pet(u uuid)
 RETURNS text
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
 select c.equipped from public.wakppu_halloween_cosmetics c where c.user_id=u and u=auth.uid()
 and (c.owned?c.equipped or public.wakppu_admin_content_access());
$function$
;

CREATE OR REPLACE FUNCTION public.wakppu_api_before_halloween_cosmetics(b jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare u uuid:=auth.uid();result jsonb;begin
 if b->>'action' is distinct from 'admin_purchase_inbox' then return public.wakppu_api_before_admin_inbox(b);end if;
 if u is null then raise sqlstate 'PT401';end if;
 perform public.wakppu_api_before_admin_inbox('{"action":"bootstrap"}');
 if not exists(select 1 from public.players p join auth.users a on a.id=p.user_id where p.user_id=u and p.role='admin' and not a.is_anonymous) then raise sqlstate 'PT403' using message='관리자 권한이 필요합니다.';end if;
 select jsonb_build_object('total',count(*),'pending',count(*) filter(where status='pending'),'claimed',count(*) filter(where status='claimed')) into result
 from public.wakppu_purchase_orders where source='bank' and status in('pending','claimed');
 return result||jsonb_build_object('orders',(select coalesce(jsonb_agg(to_jsonb(x) order by x.changed_at desc,x.id),'[]') from
  (select o.id,p.nickname,o.product_name,o.amount,o.status,o.created_at,o.claimed_at,greatest(o.created_at,coalesce(o.claimed_at,o.created_at)) as changed_at,
    case when b?'order_id' then o.bank end as bank,case when b?'order_id' then o.depositor end as depositor
   from public.wakppu_purchase_orders o join public.players p on p.user_id=o.user_id
   where o.source='bank' and o.status in('pending','claimed') and (not b?'order_id' or o.id=(b->>'order_id')::uuid)
   order by greatest(o.created_at,coalesce(o.claimed_at,o.created_at)) desc,o.id limit 20)x));
end$function$
;

CREATE OR REPLACE FUNCTION public.wakppu_supporter_reward_before_blue_gems(u uuid, base numeric)
 RETURNS numeric
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare paid numeric; carry integer; parts numeric;
begin
 paid:=public.wakppu_supporter_reward_before_pets(u,base);
 if paid=0 or public.wakppu_equipped_pet(u) is distinct from 'little_ghost' then return paid;end if;
 perform 1 from public.game_states where user_id=u for update;
 select pet_gold_remainder into carry from public.wakppu_halloween_cosmetics where user_id=u for update;
 parts:=paid*10+carry;
 update public.wakppu_halloween_cosmetics set pet_gold_remainder=mod(parts,100)::integer where user_id=u;
 return paid+floor(parts/100);
end $function$
;

CREATE OR REPLACE FUNCTION public.wakppu_halloween_cosmetic_snapshot_before_pets(u uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
 select jsonb_build_object('owned',c.effective_owned,'admin_content_access',c.admin_access,'equipped',case when c.effective_owned?c.equipped then c.equipped else null end,'shards',c.shards::text,'opened',c.opened::text,'decor_revision',c.revision,
 'tokens',coalesce(l.tokens,0)::text,'gold',g.gold::text,'revision',g.item_revision,'price','100','exchange_cost','3',
 'active',coalesce((select clock_timestamp()>=starts_at and clock_timestamp()<ends_at from public.wakppu_limited_settings ls where ls.id=true),false),
 'catalog',jsonb_build_array(
 jsonb_build_object('id','little_ghost','name','길 잃은 꼬마 유령','kind','equip','weight',1),
 jsonb_build_object('id','pumpkin_ember','name','잭오랜턴의 불씨','kind','equip','weight',1),
 jsonb_build_object('id','bat_swarm','name','박쥐 무리','kind','use','weight',1)))
 from (select raw.*, raw.owned || case when u=auth.uid() and public.wakppu_admin_content_access() then '{"little_ghost":true,"pumpkin_ember":true,"bat_swarm":true}'::jsonb else '{}'::jsonb end effective_owned, coalesce(u=auth.uid() and public.wakppu_admin_content_access(),false) admin_access from public.wakppu_halloween_cosmetics raw) c join public.game_states g on g.user_id=c.user_id
 left join public.wakppu_limited_players l on l.user_id=c.user_id where c.user_id=u;
$function$
;

CREATE OR REPLACE FUNCTION public.wakppu_api_before_profiles(b jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare result jsonb;pet text;
begin
 result:=public.wakppu_api_before_pet_traits(b);
 if b->>'action' in ('item_hit','limited_hit','items') then
  pet:=public.wakppu_equipped_pet(auth.uid());
  result:=result||jsonb_build_object('pet_timing',jsonb_build_object('equipped',pet,'animation',1,'respawn',case when pet='bat_swarm' then 0.9 else 1 end));
 end if;
 return result;
end $function$
;

CREATE OR REPLACE FUNCTION public.wakppu_api_before_admin_inbox(b jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare a text:=b->>'action';u uuid:=auth.uid();s public.game_states%rowtype;r jsonb;owned boolean;enabled_now boolean;cost numeric;done boolean:=false;
begin
 if a not in('auto_rebirth_status','auto_rebirth_toggle','auto_rebirth_run','purchase_catalog') then return public.wakppu_api_before_auto_rebirth(b);end if;
 if u is null then raise sqlstate 'PT401';end if;
 perform pg_advisory_xact_lock(hashtextextended(u::text,19));
 r:=public.wakppu_api_before_auto_rebirth('{"action":"bootstrap"}');
 owned:=public.wakppu_admin_content_access() or exists(select 1 from public.wakppu_purchase_entitlements where user_id=u and product_id='auto_rebirth');
 select * into s from public.game_states where user_id=u for update;
 select coalesce(enabled,false) into enabled_now from public.wakppu_auto_rebirth where user_id=u;
 enabled_now:=owned and coalesce(enabled_now,false);cost:=public.wakppu_rebirth_cost(s.rebirths);
 if a='auto_rebirth_toggle' then
  if not owned then raise sqlstate 'PT403' using message='자동 환생 이용권이 필요합니다.';end if;
  if jsonb_typeof(b->'enabled') is distinct from 'boolean' then raise sqlstate 'PT400';end if;
  enabled_now:=(b->>'enabled')::boolean;
  insert into public.wakppu_auto_rebirth values(u,enabled_now) on conflict(user_id) do update set enabled=excluded.enabled;
 elsif a='auto_rebirth_run' then
  if not owned then raise sqlstate 'PT403' using message='자동 환생 이용권이 필요합니다.';end if;
  -- atomic-auto-rebirth-progress: stale/replayed requests must never save old rewards.
  if enabled_now and cost is not null and (b->>'rebirths')::integer=s.rebirths and (b->>'item_revision')::bigint=s.item_revision and b ? 'progress' then
   if jsonb_typeof(b->'progress') is distinct from 'object' then raise sqlstate 'PT400';end if;
   perform public.wakppu_api((b->'progress')||jsonb_build_object('action','save_progress','rebirths',s.rebirths,'item_revision',s.item_revision));
   select * into s from public.game_states where user_id=u for update;
  end if;
  if enabled_now and cost is not null and s.gold>=cost and (b->>'rebirths')::integer=s.rebirths and (b->>'item_revision')::bigint=s.item_revision then
   -- Use the existing reset/save chain, including item-effect cleanup and moderation checks.
   perform public.wakppu_api_before_auto_rebirth(to_jsonb(s)||jsonb_build_object('action','save_progress','gold','0','rebirths',s.rebirths+1,'unlocked_ball_ids',jsonb_build_array('yellow'),'selected_ball_id','yellow','current_ball_id','yellow','current_clicks',0,'honey_expires_at',null,'coating_expires_at',null));
   update public.game_states set item_revision=item_revision+1,current_clicks=0,item_current_clicks=0,current_ball_id='yellow' where user_id=u;
   update public.wakppu_limited_players set selected=null,clicks=0 where user_id=u;
   done:=true;
  end if;
  -- fast-auto-rebirth-snapshot: no client-side bootstrap/items round trip.
   select * into s from public.game_states where user_id=u;
   return jsonb_build_object('performed',done,'progress',to_jsonb(s)||jsonb_build_object('gold',s.gold::text),'items',public.wakppu_api('{"action":"items"}'::jsonb));
 elsif a='purchase_catalog' then
  r:=public.wakppu_api_before_auto_rebirth(b);
  return r||jsonb_build_object('auto_rebirth',jsonb_build_object('owned',owned,'enabled',enabled_now));
 end if;
 return jsonb_build_object('owned',owned,'enabled',enabled_now,'rebirths',s.rebirths,'cost',cost::text);
end$function$
;

CREATE OR REPLACE FUNCTION public.wakppu_halloween_cosmetic_snapshot(u uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
 select public.wakppu_halloween_cosmetic_snapshot_before_pets(u)||jsonb_build_object('pet_version',2,'ember_interval_ms',1000,'catalog',jsonb_build_array(
 jsonb_build_object('id','little_ghost','name','길 잃은 꼬마 유령','kind','equip','weight',1,'effect','골드 +10%'),
 jsonb_build_object('id','pumpkin_ember','name','잭오랜턴의 불씨','kind','equip','weight',1,'effect','1초마다 자동 공격'),
 jsonb_build_object('id','bat_swarm','name','꼬마 박쥐','kind','equip','weight',1,'effect','재생성 대기 시간 10% 단축')));
$function$
;

CREATE OR REPLACE FUNCTION public.wakppu_profile_title_before_monthly(u uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare bonus integer:=public.wakppu_supporter_percent(u);access boolean;choice text;visible boolean;catalog jsonb;label text;
begin
 access:=case when u=auth.uid() then public.wakppu_admin_content_access() else
  exists(select 1 from public.players p join auth.users a on a.id=p.user_id where p.user_id=u and p.role='admin' and not coalesce(a.is_anonymous,false)) end;
 catalog:='[{"id":"auto","name":"자동 선택 (보유한 최고 칭호)"},{"id":"none","name":"칭호 없음"}]'::jsonb;
 if bonus>=5 or access then catalog:=catalog||'[{"id":"supporter","name":"왁뿌볼 후원자"}]'::jsonb;end if;
 if bonus>=30 or access then catalog:=catalog||'[{"id":"premium","name":"프리미엄 후원자"}]'::jsonb;end if;
 -- No nickname, client rank, historic card grant or admin bypass can confer this title.
 if u is not null and u=public.wakppu_current_champion() then
  catalog:=catalog||'[{"id":"champion","name":"👑 왁뿌볼의 정점"}]'::jsonb;
 end if;
 select title_id into choice from public.wakppu_profile_cards where user_id=u;
 choice:=coalesce(choice,'auto');
 select title_visible into visible from public.wakppu_purchase_cosmetics where user_id=u;
 if visible=false or not exists(select 1 from jsonb_array_elements(catalog) c where c->>'id'=choice) then choice:='none';end if;
 label:=case choice when 'champion' then '👑 왁뿌볼의 정점'
  when 'supporter' then '왁뿌볼 후원자' when 'premium' then '프리미엄 후원자'
  when 'auto' then case when bonus>=30 then '프리미엄 후원자' when bonus>=5 then '왁뿌볼 후원자' end end;
 return jsonb_build_object('title_catalog',catalog,'title_equipped',choice,'title',label);
end $function$
;

CREATE OR REPLACE FUNCTION public.wakppu_api_before_champion_cards(b jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare actor uuid:=auth.uid();r jsonb;t jsonb;choice text;target uuid;
begin
 if b->>'action'='profile_title' then
  if actor is null then raise sqlstate 'PT401' using message='로그인이 필요합니다.';end if;
  perform public.wakppu_api_before_profile_titles('{"action":"bootstrap"}');
  if b ? 'user_id' or b ? 'target_user_id' then raise sqlstate 'PT403' using message='다른 계정의 칭호는 변경할 수 없습니다.';end if;
  if jsonb_typeof(b->'title_id') is distinct from 'string' then raise sqlstate 'PT400' using message='잘못된 칭호입니다.';end if;
  choice:=b->>'title_id';t:=public.wakppu_profile_title_state(actor);
  if not exists(select 1 from jsonb_array_elements(t->'title_catalog') c where c->>'id'=choice) then
   raise sqlstate 'PT403' using message='보유하지 않은 칭호입니다.';
  end if;
  insert into public.wakppu_profile_cards(user_id,equipped,title_id) values(actor,'wax_beginning',choice)
   on conflict(user_id) do update set title_id=excluded.title_id;
  insert into public.wakppu_purchase_cosmetics(user_id,title_visible) values(actor,choice<>'none')
   on conflict(user_id) do update set title_visible=excluded.title_visible;
  return public.wakppu_api_before_profile_titles('{"action":"profile_status"}')||public.wakppu_profile_title_state(actor);
 end if;
 r:=public.wakppu_api_before_profile_titles(b);
 if b->>'action' in ('profile_status','profile_equip') then
  return r||public.wakppu_profile_title_state(actor);
 elsif b->>'action'='player_profile' then
  select user_id into target from public.players where nickname=b->>'nickname';
  return r||jsonb_build_object('title',public.wakppu_profile_title_state(target)->'title');
 elsif b->>'action'='rankings' then
  return (select coalesce(jsonb_agg(e.value||jsonb_build_object('profile_title',public.wakppu_profile_title_state(p.user_id)->'title') order by e.ordinality),'[]')
   from jsonb_array_elements(r) with ordinality e join public.players p on p.nickname=e.value->>'nickname');
 end if;
 return r;
end $function$
;

CREATE OR REPLACE FUNCTION public.wakppu_api_before_profile_titles(b jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
 actor uuid:=auth.uid();target uuid;selected text;catalog jsonb;owned jsonb;
 rows jsonb;entry jsonb;position bigint;card jsonb;state public.game_states%rowtype;
 admin_access boolean;
begin
 if b->>'action' not in ('profile_status','profile_equip','player_profile') or b->>'action' is null then
  return public.wakppu_api_before_profiles(b);
 end if;
 if actor is null then raise sqlstate 'PT401' using message='로그인이 필요합니다.';end if;
 -- Preserve all existing maintenance, suspension, sleep and session gates.
 perform public.wakppu_api_before_profiles('{"action":"bootstrap"}'::jsonb);
 if b ? 'user_id' or b ? 'target_user_id' then
  raise sqlstate 'PT403' using message='다른 계정의 카드를 변경할 수 없습니다.';
 end if;
 admin_access:=public.wakppu_admin_content_access();
 if b->>'action' in ('profile_status','profile_equip') then
  if b->>'action'='profile_equip' then
   if not b ? 'card_id' or jsonb_typeof(b->'card_id') not in ('string','null') then
    raise sqlstate 'PT400' using message='잘못된 카드입니다.';
   end if;
   selected:=b->>'card_id';
   if selected is not null and not exists(select 1 from wakppu_profile_card_defs where card_id=selected and (public.wakppu_profile_card_available(actor,card_id))) then
    raise sqlstate 'PT400' using message='보유하지 않은 프로필 카드입니다.';
   end if;
   insert into wakppu_profile_cards values(actor,selected)
    on conflict(user_id) do update set equipped=excluded.equipped;
  end if;
  select equipped into selected from wakppu_profile_cards where user_id=actor;
  if not found then selected:='wax_beginning';end if;
  if selected is not null and not public.wakppu_profile_card_available(actor,selected) then selected:='wax_beginning';end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',card_id,'name',name,'rarity',rarity,'free',free,'image',image) order by card_id),'[]'),
   coalesce(jsonb_agg(card_id order by card_id),'[]')
   into catalog,owned from wakppu_profile_card_defs where public.wakppu_profile_card_available(actor,card_id);
  return jsonb_build_object('catalog',catalog,'owned',owned,'equipped',selected,
   'nickname',(select nickname from players where user_id=actor));
 end if;
 if jsonb_typeof(b->'nickname') is distinct from 'string' or length(b->>'nickname') not between 1 and 100 then
  raise sqlstate 'PT400' using message='잘못된 플레이어입니다.';
 end if;
 rows:=public.wakppu_api_before_profiles('{"action":"rankings"}'::jsonb);
 select r.value,r.ordinality into entry,position from jsonb_array_elements(rows) with ordinality r
  where r.value->>'nickname'=b->>'nickname';
 select user_id into target from players where nickname=b->>'nickname';
 if target is null or (entry is null and target<>actor and not (public.wakppu_monthly_eligible(target) and exists(select 1 from public.wakppu_monthly_clicks c where c.user_id=target))) then
  raise sqlstate 'PT404' using message='프로필을 찾을 수 없습니다.';
 end if;
 select * into state from game_states where user_id=target;
 select equipped into selected from wakppu_profile_cards where user_id=target;
 if not found then selected:='wax_beginning';end if;
 if selected is not null and not public.wakppu_profile_card_available(target,selected) then selected:='wax_beginning';end if;
 select jsonb_build_object('id',card_id,'name',name,'rarity',rarity,'free',free,'image',image)
  into card from wakppu_profile_card_defs where card_id=selected;
 return jsonb_build_object('nickname',b->>'nickname','rank',position,
  'gold',state.gold::text,'rebirths',state.rebirths,'online',coalesce((entry->>'online')::boolean,false),
  'title',case when coalesce((entry->>'supporter_title_visible')::boolean,true) then
    case when (entry->>'premium_supporter')::boolean then '프리미엄 후원자'
         when (entry->>'supporter')::boolean then '왁뿌볼 후원자' end end,
  'card',card,
  'discovered_count',(select count(*) from wakppu_item_balls where state.discovered_ball_ids ? ball_id),
  'discovery_total',(select count(*) from wakppu_item_balls));
end $function$
;

CREATE OR REPLACE FUNCTION public.wakppu_award_champion()
 RETURNS void
 LANGUAGE sql
 SET search_path TO 'public', 'pg_temp'
AS $function$
 insert into public.wakppu_profile_card_grants(user_id,card_id)
 select g.user_id,'golden_champion' from public.game_states g join public.players p using(user_id)
 where not p.ranking_hidden and not exists(select 1 from public.moderation_cases m where m.user_id=p.user_id and
  (m.status='banned' or (m.status='suspended' and (m.suspended_until is null or m.suspended_until>clock_timestamp()))))
 and not exists(select 1 from public.wakppu_guest_accounts() c where c.id=p.user_id and c.eligible and c.hide_at<=clock_timestamp())
 order by g.rebirths desc,g.gold desc,g.user_id limit 1
 on conflict(user_id,card_id) do nothing;
$function$
;

CREATE OR REPLACE FUNCTION public.wakppu_api_before_blue_gems(b jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare r jsonb;a text:=b->>'action';depth integer:=coalesce(nullif(current_setting('wakppu.champion_depth',true),''),'0')::integer;
begin
 -- Nested calls (e.g. save inside auto rebirth) must not award an intermediate state.
 perform set_config('wakppu.champion_depth',(depth+1)::text,true);
 if depth=0 and a in ('profile_status','profile_equip','profile_title','player_profile') then
  perform public.wakppu_api_before_champion_cards('{"action":"bootstrap"}');
  perform public.wakppu_award_champion();
 end if;
 r:=public.wakppu_api_before_champion_cards(b);
 perform set_config('wakppu.champion_depth',depth::text,true);
 if depth=0 and a in ('rankings','save_progress','auto_rebirth_run','item_hit','limited_hit','event_ball_hit','limited_buy','item_draw','item_use','admin_gold','admin_rebirths','admin_ranking_visibility','admin_ban','admin_unban') then
  perform public.wakppu_award_champion();
 end if;
 return r;
exception when others then
 perform set_config('wakppu.champion_depth',depth::text,true);raise;
end $function$
;

CREATE OR REPLACE FUNCTION public.wakppu_profile_card_available(u uuid, c text)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
 select exists(select 1 from public.wakppu_profile_card_defs d where d.card_id=c and (
 d.free or
 (c not like 'monthly\_%' escape '\' and case when u=auth.uid() then public.wakppu_admin_content_access() else exists(select 1 from public.players p join auth.users a on a.id=p.user_id where p.user_id=u and p.role='admin' and not coalesce(a.is_anonymous,false)) end) or
 (c not in ('supporter_glow','premium_celestial') and exists(select 1 from public.wakppu_profile_card_grants g where g.user_id=u and g.card_id=c)) or
 (c='supporter_glow' and exists(select 1 from public.wakppu_purchase_entitlements e where e.user_id=u and e.product_id in ('supporter_pack','premium_supporter_pack'))) or
 (c='premium_celestial' and exists(select 1 from public.wakppu_purchase_entitlements e where e.user_id=u and e.product_id='premium_supporter_pack'))));
$function$
;

CREATE OR REPLACE FUNCTION public.wakppu_supporter_card_cleanup()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
 if old.product_id in ('supporter_pack','premium_supporter_pack') then
  update public.wakppu_profile_cards set equipped='wax_beginning'
  where user_id=old.user_id and equipped in ('supporter_glow','premium_celestial')
   and not public.wakppu_profile_card_available(user_id,equipped);
 end if;
 return null;
end $function$
;

CREATE OR REPLACE FUNCTION public.wakppu_blue_gem_snapshot(u uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare g public.wakppu_blue_gems%rowtype;access boolean;chosen integer;
begin
 if u is null or u is distinct from auth.uid() then raise sqlstate 'PT403';end if;
 select * into g from public.wakppu_blue_gems where user_id=u;
 access:=public.wakppu_admin_content_access();chosen:=greatest(coalesce(g.level,0),case when access then coalesce(g.admin_level,0) else 0 end);
 return jsonb_build_object('balance',coalesce(g.balance,0)::text,'level',chosen,'revision',coalesce(g.revision,0),
  'multiplier',coalesce((select multiplier from public.wakppu_blue_gem_products where level=chosen),1)::text,'admin_access',access,
  'catalog',(select jsonb_agg(jsonb_build_object('level',level,'price',price::text,'multiplier',multiplier::text) order by level) from public.wakppu_blue_gem_products));
end $function$
;

CREATE OR REPLACE FUNCTION public.wakppu_supporter_reward_before_halloween_goods(u uuid, base numeric)
 RETURNS numeric
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare paid numeric;chosen integer;factor numeric;
begin
 paid:=public.wakppu_supporter_reward_before_blue_gems(u,base);
 if paid<=0 then return paid;end if;
 perform 1 from public.game_states where user_id=u for update;
 insert into public.wakppu_blue_gems(user_id) values(u) on conflict do nothing;
 if not exists(select 1 from public.wakppu_blue_gem_exclusions where ball_id=current_setting('wakppu.blue_gem_ball',true)) then
  update public.wakppu_blue_gems set balance=balance+1,revision=revision+1 where user_id=u;
 end if;
 select greatest(level,case when public.wakppu_admin_content_access() then admin_level else 0 end) into chosen from public.wakppu_blue_gems where user_id=u;
 select multiplier into factor from public.wakppu_blue_gem_products where level=chosen;
 return paid*coalesce(factor,1);
end $function$
;

CREATE OR REPLACE FUNCTION public.wakppu_current_champion()
 RETURNS uuid
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
 select g.user_id from public.game_states g join public.players p using(user_id)
 where not p.ranking_hidden and not exists(select 1 from public.moderation_cases m where m.user_id=p.user_id and
  (m.status='banned' or (m.status='suspended' and (m.suspended_until is null or m.suspended_until>statement_timestamp()))))
 and not exists(select 1 from public.wakppu_guest_accounts() c where c.id=p.user_id and c.eligible and c.hide_at<=statement_timestamp())
 order by g.rebirths desc,g.gold desc,g.user_id limit 1;
$function$
;

CREATE OR REPLACE FUNCTION public.wakppu_api_before_ember_auto(b jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare u uuid:=auth.uid();a text:=b->>'action';r jsonb;g public.wakppu_blue_gems%rowtype;
 p public.wakppu_blue_gem_products%rowtype;cached public.wakppu_blue_gem_requests%rowtype;rid uuid;chosen integer;access boolean;
begin
 if a in ('blue_gems','blue_gem_buy') then
  if u is null then raise sqlstate 'PT401' using message='로그인이 필요합니다.';end if;
  perform public.wakppu_api_before_blue_gems('{"action":"bootstrap"}');
  if b ?| array['user_id','target_user_id','balance','price','multiplier'] then raise sqlstate 'PT403' using message='서버가 가격과 재화를 결정합니다.';end if;
  if a='blue_gems' then return public.wakppu_blue_gem_snapshot(u);end if;
  if coalesce(b->>'request_id','') !~ '^[a-fA-F0-9]{8}(-[a-fA-F0-9]{4}){3}-[a-fA-F0-9]{12}$' or coalesce(b->>'level','') !~ '^[1-9][0-9]{0,3}$'
   or coalesce(b->>'gem_revision','') !~ '^[0-9]{1,18}$' then raise sqlstate 'PT400' using message='잘못된 구매 요청입니다.';end if;
  rid:=(b->>'request_id')::uuid;
  perform 1 from public.game_states where user_id=u for update;
  insert into public.wakppu_blue_gems(user_id) values(u) on conflict do nothing;
  select * into cached from public.wakppu_blue_gem_requests where user_id=u and request_id=rid;
  if found then
   if cached.level<>(b->>'level')::integer then raise sqlstate 'PT409' using message='다른 상품에서 사용한 요청입니다.';end if;
   return cached.response;
  end if;
  select * into g from public.wakppu_blue_gems where user_id=u for update;
  if g.revision<>(b->>'gem_revision')::bigint then raise sqlstate 'PT409' using message='푸른젬 상태가 바뀌었습니다. 다시 확인해주세요.';end if;
  select * into p from public.wakppu_blue_gem_products where level=(b->>'level')::integer;
  if not found then raise sqlstate 'PT400' using message='없는 상품입니다.';end if;
  access:=public.wakppu_admin_content_access();chosen:=greatest(g.level,case when access then g.admin_level else 0 end);
  if p.level<=chosen then raise sqlstate 'PT409' using message='이미 같거나 높은 배율을 보유하고 있습니다.';end if;
  if not access and g.balance<p.price then raise sqlstate 'PT400' using message='푸른젬이 부족합니다.';end if;
  update public.wakppu_blue_gems set balance=balance-case when access then 0 else p.price end,
   level=case when access then level else p.level end,admin_level=case when access then p.level else admin_level end,revision=revision+1 where user_id=u;
  r:=public.wakppu_blue_gem_snapshot(u);
  insert into public.wakppu_blue_gem_requests values(u,rid,p.level,r);
  return r;
 end if;
 if a in ('item_hit','event_ball_hit','limited_hit') then
  perform set_config('wakppu.blue_gem_ball',case when a='limited_hit' then 'halloween-pumpkin-2026'
   when a='event_ball_hit' or b ? 'event_id' then 'admin-event'
   else coalesce((select selected_ball_id from public.game_states where user_id=u),'') end,true);
 end if;
 r:=public.wakppu_api_before_blue_gems(b);
 if u is not null and (a in ('item_hit','event_ball_hit','limited_hit','bootstrap','items','save_progress') or a like 'auto_rebirth_%') then
  r:=r||jsonb_build_object('blue_gems',public.wakppu_blue_gem_snapshot(u));
 end if;
 return r;
end $function$
;

CREATE OR REPLACE FUNCTION public.wakppu_profile_title_before_halloween_goods(u uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare base jsonb:=public.wakppu_profile_title_before_monthly(u);catalog jsonb;choice text;label text;visible boolean;
begin
 select coalesce(jsonb_agg(jsonb_build_object('id','monthly_'||to_char(month,'YYYYMM')||'_'||kind,'name',to_char(month,'YYYY년 MM월')||case kind when 'champion' then ' 클릭왕' else ' 클릭 TOP 10' end) order by month desc,kind),'[]')
 into catalog from public.wakppu_monthly_rewards where user_id=u and kind in ('champion','top10');
 select title_id into choice from public.wakppu_profile_cards where user_id=u;
 select title_visible into visible from public.wakppu_purchase_cosmetics where user_id=u;
 if visible is distinct from false then select c->>'name' into label from jsonb_array_elements(catalog)c where c->>'id'=choice;end if;
 return base||jsonb_build_object('title_catalog',(base->'title_catalog')||catalog)||case when label is not null then jsonb_build_object('title_equipped',choice,'title',label) else '{}'::jsonb end;
end $function$
;

CREATE OR REPLACE FUNCTION public.wakppu_api_before_gem_balls(b jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare a text:=b->>'action';u uuid:=auth.uid();r jsonb;m date;badge text;target uuid;
begin
 if a in ('monthly_rankings','monthly_badge_equip') and b ?| array['user_id','target_user_id'] then raise sqlstate 'PT403';end if;
 if a='monthly_rankings' then
  -- Reuse the read-only ranking gate: visible during maintenance and night lock.
  perform public.wakppu_api_before_monthly('{"action":"rankings"}');
  if b ? 'month' and (jsonb_typeof(b->'month') is distinct from 'string' or b->>'month' !~ '^20[0-9]{2}-(0[1-9]|1[0-2])$') then raise sqlstate 'PT400';end if;
  m:=coalesce((b->>'month'||'-01')::date,date_trunc('month',public.wakppu_monthly_now() at time zone 'Asia/Seoul')::date);
  perform public.wakppu_monthly_settle();
  return public.wakppu_monthly_snapshot(u,m);
 elsif a='monthly_badge_equip' then
  perform public.wakppu_api_before_monthly('{"action":"bootstrap"}');
  if u is null then raise sqlstate 'PT401';end if;
  if not b ? 'badge_id' or jsonb_typeof(b->'badge_id') not in ('string','null') then raise sqlstate 'PT400';end if;
  badge:=b->>'badge_id';
  if badge is not null and not exists(select 1 from public.wakppu_monthly_rewards where user_id=u and kind='participant' and badge='monthly_'||to_char(month,'YYYYMM')||'_participant') then raise sqlstate 'PT403' using message='보유하지 않은 배지입니다.';end if;
  insert into public.wakppu_profile_cards(user_id,equipped,monthly_badge) values(u,'wax_beginning',badge) on conflict(user_id) do update set monthly_badge=excluded.monthly_badge;
  return public.wakppu_api_before_monthly('{"action":"profile_status"}')||public.wakppu_monthly_badge_state(u);
 end if;
 r:=public.wakppu_api_before_monthly(b);
 if a in ('profile_status','profile_equip','profile_title') then return r||public.wakppu_monthly_badge_state(u);
 elsif a='player_profile' then
  select user_id into target from public.players where nickname=b->>'nickname';
  return r||jsonb_build_object('monthly_badge',public.wakppu_monthly_badge_state(target)->'monthly_badge');
 elsif a='rankings' then
  return (select coalesce(jsonb_agg(e.value||jsonb_build_object('monthly_badge',public.wakppu_monthly_badge_state(p.user_id)->'monthly_badge') order by e.ordinality),'[]')
   from jsonb_array_elements(r) with ordinality e join public.players p on p.nickname=e.value->>'nickname');
 end if;
 return r;
end $function$
;

CREATE OR REPLACE FUNCTION public.wakppu_monthly_badge_state(u uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
 select jsonb_build_object('badge_catalog',coalesce((select jsonb_agg(jsonb_build_object(
  'id','monthly_'||to_char(month,'YYYYMM')||'_participant',
  'name',case when month=date '2026-10-01' then '2026년 10월 테스터 배지' else to_char(month,'YYYY년 MM월')||' 참여 배지' end) order by month desc)
  from public.wakppu_monthly_rewards where user_id=u and kind='participant'),'[]'),
  'badge_equipped',c.monthly_badge,'monthly_badge',(select
   case when r.month=date '2026-10-01' then '2026년 10월 테스터 배지' else to_char(r.month,'YYYY년 MM월')||' 참여 배지' end
   from public.wakppu_monthly_rewards r where r.user_id=u and r.kind='participant'
   and c.monthly_badge='monthly_'||to_char(r.month,'YYYYMM')||'_participant'))
 from (select (select monthly_badge from public.wakppu_profile_cards where user_id=u) monthly_badge)c;
$function$
;

CREATE OR REPLACE FUNCTION public.wakppu_monthly_now()
 RETURNS timestamp with time zone
 LANGUAGE sql
 SET search_path TO 'public', 'pg_temp'
AS $function$select clock_timestamp()$function$
;

CREATE OR REPLACE FUNCTION public.wakppu_api_before_monthly(b jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare u uuid:=auth.uid();rid uuid;target text:=b->>'hit_action';instant timestamptz;last_at timestamptz;cached public.wakppu_ember_hit_requests%rowtype;r jsonb;fp jsonb:=b-'request_id';
begin
 -- Only this validated action can mark a hit as an authorized pet attack.
 if b->>'action' is distinct from 'ember_auto_hit' then return public.wakppu_api_before_ember_auto(b-'hit_source');end if;
 perform public.wakppu_api_before_ember_auto('{"action":"bootstrap"}');
 if u is null then raise sqlstate 'PT401';end if;
 if target is null or target not in ('item_hit','limited_hit') or b ?| array['user_id','target_user_id'] or coalesce(b->>'request_id','') !~ '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$' then raise sqlstate 'PT400';end if;
 rid:=(b->>'request_id')::uuid;
 -- Match the existing hit lock order; concurrent windows share the same cooldown.
 perform 1 from public.game_states where user_id=u for update;
 if public.wakppu_equipped_pet(u) is distinct from 'pumpkin_ember' then raise sqlstate 'PT403' using message='잭오랜턴 불씨를 장착해야 자동 공격할 수 있습니다.';end if;
 select * into cached from public.wakppu_ember_hit_requests where user_id=u and request_id=rid;
 if found then
  if cached.fingerprint<>fp then raise sqlstate 'PT409' using message='다른 자동 공격에 사용한 요청입니다.';end if;
  return cached.response;
 end if;
 instant:=clock_timestamp();select ember_last_hit_at into last_at from public.wakppu_halloween_cosmetics where user_id=u;
 if last_at is not null and instant<last_at+interval '1 second' then raise sqlstate 'PT429' using message='불씨는 1초마다 한 번 공격할 수 있습니다.';end if;
 r:=public.wakppu_api_before_ember_auto((b-'hit_action')||jsonb_build_object('action',target,'hit_source','ember_auto'));
 update public.wakppu_halloween_cosmetics set ember_last_hit_at=instant where user_id=u;
 insert into public.wakppu_ember_hit_requests(user_id,request_id,fingerprint,response) values(u,rid,fp,r);
 delete from public.wakppu_ember_hit_requests where user_id=u and request_id in
  (select request_id from public.wakppu_ember_hit_requests where user_id=u order by created_at desc,request_id desc offset 64);
 return r;
end $function$
;

CREATE OR REPLACE FUNCTION public.wakppu_monthly_record(u uuid)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare instant timestamptz:=public.wakppu_monthly_now();m date:=(instant at time zone 'Asia/Seoul')::date;done timestamptz;
begin
 if not public.wakppu_monthly_eligible(u) then return;end if;
 m:=date_trunc('month',m)::date;if m<'2026-10-01' then return;end if;
 insert into public.wakppu_monthly_seasons(month) values(m) on conflict do nothing;
 -- Concurrent players share this lock; settlement takes an exclusive season lock.
 select finalized_at into done from public.wakppu_monthly_seasons where month=m for share;
 if done is not null then return;end if;
 insert into public.wakppu_monthly_clicks values(m,u,1,instant)
 on conflict(month,user_id) do update set clicks=wakppu_monthly_clicks.clicks+1,reached_at=excluded.reached_at;
end $function$
;

CREATE OR REPLACE FUNCTION public.wakppu_monthly_snapshot(u uuid, m date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare rows jsonb;me jsonb;done timestamptz;instant timestamptz:=public.wakppu_monthly_now();current_month date:=date_trunc('month',instant at time zone 'Asia/Seoul')::date;periods jsonb;
begin
 if m<'2026-10-01' or m>current_month then raise sqlstate 'PT400' using message='집계 가능한 월을 선택해주세요.';end if;
 select finalized_at into done from public.wakppu_monthly_seasons where month=m;
 with ranked as (
  select c.user_id,p.nickname,c.clicks,row_number() over(order by c.clicks desc,c.reached_at,c.user_id) rank
  from public.wakppu_monthly_clicks c join public.players p using(user_id) where c.month=m and done is null and public.wakppu_monthly_eligible(c.user_id)
  union all select r.user_id,r.nickname,r.clicks,r.rank from public.wakppu_monthly_results r where r.month=m and done is not null and public.wakppu_monthly_eligible(r.user_id)
 ), output as(select q.*,jsonb_build_object('nickname',q.nickname,'profile_nickname',(select nickname from public.players where user_id=q.user_id),'rank',q.rank,'clicks',q.clicks::text,'online',exists(select 1 from public.player_presence where user_id=q.user_id and last_seen_at>clock_timestamp()-interval '90 seconds'),'monthly_badge',public.wakppu_monthly_badge_state(q.user_id)->'monthly_badge') value from ranked q)
 select coalesce(jsonb_agg(value order by rank) filter(where rank<=100),'[]'),(jsonb_agg(value) filter(where user_id=u))->0 into rows,me from output;
 select coalesce(jsonb_agg(to_char(month,'YYYY-MM') order by month desc),'[]') into periods from
 (select month from public.wakppu_monthly_seasons union select current_month) s;
 return jsonb_build_object('month',to_char(m,'YYYY-MM'),'trial',m<'2026-11-01','finalized',done is not null,
 'ends_at',((m+interval '1 month') at time zone 'Asia/Seoul'),'server_now',instant,'seasons',periods,
 'rows',rows,'me',coalesce(me,jsonb_build_object('rank',null,'clicks','0')),'eligible',public.wakppu_monthly_eligible(u));
end $function$
;

CREATE OR REPLACE FUNCTION public.wakppu_monthly_settle()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare s record;m date:=date_trunc('month',public.wakppu_monthly_now() at time zone 'Asia/Seoul')::date;key text;label text;
begin
 for s in select month from public.wakppu_monthly_seasons where month<m and finalized_at is null order by month for update skip locked loop
  insert into public.wakppu_monthly_results(month,user_id,rank,clicks,nickname)
   select s.month,c.user_id,row_number() over(order by c.clicks desc,c.reached_at,c.user_id),c.clicks,p.nickname
   from public.wakppu_monthly_clicks c join public.players p using(user_id)
   where c.month=s.month and public.wakppu_monthly_eligible(c.user_id);
  -- October is a short, explicitly labelled trial. Formal rewards start November.
  if s.month>='2026-11-01' then
   key:=to_char(s.month,'YYYYMM');label:=to_char(s.month,'YYYY년 MM월');
   insert into public.wakppu_profile_card_defs(card_id,name,rarity,free,image) values
    ('monthly_'||key||'_gold',label||' 클릭왕','월간 1위',false,'images/profile-cards/monthly-gold.webp'),
    ('monthly_'||key||'_silver',label||' 은빛 도전자','월간 2위',false,'images/profile-cards/monthly-silver.webp'),
    ('monthly_'||key||'_bronze',label||' 동빛 도전자','월간 3위',false,'images/profile-cards/monthly-bronze.webp');
   insert into public.wakppu_profile_card_grants(user_id,card_id)
    select user_id,'monthly_'||key||case rank when 1 then '_gold' when 2 then '_silver' else '_bronze' end
    from public.wakppu_monthly_results where month=s.month and rank<=3 on conflict do nothing;
   insert into public.wakppu_monthly_rewards
    select user_id,s.month,'champion' from public.wakppu_monthly_results where month=s.month and rank=1 on conflict do nothing;
   insert into public.wakppu_monthly_rewards
    select user_id,s.month,'top10' from public.wakppu_monthly_results where month=s.month and rank<=10 on conflict do nothing;
   insert into public.wakppu_monthly_rewards
    select user_id,s.month,'participant' from public.wakppu_monthly_results where month=s.month and clicks>=1000 on conflict do nothing;
  end if;
  update public.wakppu_monthly_seasons set finalized_at=public.wakppu_monthly_now() where month=s.month;
 end loop;
end $function$
;

CREATE OR REPLACE FUNCTION public.wakppu_gem_ball_hit(b jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare u uuid:=auth.uid();s public.game_states%rowtype;p public.wakppu_gem_ball_players%rowtype;d public.wakppu_gem_ball_defs%rowtype;
 inv public.wakppu_items%rowtype;r jsonb;cached jsonb;kind text;rid uuid;hits bigint;winners jsonb;it record;ms bigint:=floor(extract(epoch from clock_timestamp())*1000);
begin
 if u is null then raise sqlstate 'PT401';end if;
 perform public.wakppu_api_before_gem_balls('{"action":"bootstrap"}');
 if b ?| array['user_id','target_user_id','gem_reward','gold','damage'] or coalesce(b->>'request_id','') !~ '^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$' then raise sqlstate 'PT400';end if;
 rid:=(b->>'request_id')::uuid;
 select * into s from public.game_states where user_id=u for update;
 select response,action into cached,kind from public.wakppu_item_requests where user_id=u and request_id=rid;
 if found then if kind<>'item_hit' then raise sqlstate 'PT409';end if;return cached;end if;
 if (b->>'item_revision')::bigint is distinct from s.item_revision then raise sqlstate 'PT409';end if;
 select * into p from public.wakppu_gem_ball_players where user_id=u for update;
 select * into d from public.wakppu_gem_ball_defs where ball_id=p.selected;
 if not found or not (coalesce(p.owned ? p.selected,false) or public.wakppu_admin_content_access()) then raise sqlstate 'PT403' using message='보유한 푸른젬 볼을 선택해주세요.';end if;
 insert into public.wakppu_items(user_id) values(u) on conflict do nothing;
 select * into inv from public.wakppu_items where user_id=u for update;
 hits:=least(d.clicks,p.clicks+public.wakppu_hammer_damage(s.hammer_owned,least(s.hammer_level,coalesce(s.hammer_selected_level,s.hammer_level))));
 winners:=public.wakppu_item_winners(inv.effects,ms);
 -- Consume only effects that actually influence this zero-Gold ball.
 for it in select distinct value->>'id' as id from jsonb_each(winners) where key in ('animation','respawn','damage','add','difficulty') loop
  if exists(select 1 from public.wakppu_item_defs where item_id=it.id and seconds=0 and (unit='hit' or hits=d.clicks)) then
   inv.effects:=jsonb_set(inv.effects,array[it.id,'remaining'],to_jsonb(greatest(0,coalesce((inv.effects->it.id->>'remaining')::bigint,0)-1)));
  end if;
 end loop;
 if hits=d.clicks then
  insert into public.wakppu_blue_gems(user_id) values(u) on conflict do nothing;
  update public.wakppu_blue_gems set balance=balance+d.gem_reward,revision=revision+1 where user_id=u;
 end if;
 update public.wakppu_gem_ball_players set clicks=case when hits=d.clicks then 0 else hits end where user_id=u;
 update public.wakppu_items set effects=inv.effects where user_id=u;
 update public.game_states set item_revision=item_revision+1 where user_id=u;
 r:=public.wakppu_api_before_gem_balls('{"action":"items"}')||jsonb_build_object('reward','0','broken',hits=d.clicks,'clicks',hits,'required_clicks',d.clicks,
  'gem_reward',case when hits=d.clicks then d.gem_reward::text else '0' end,'gem_balls',public.wakppu_gem_ball_snapshot(u),'blue_gems',public.wakppu_blue_gem_snapshot(u));
 insert into public.wakppu_item_requests(user_id,request_id,action,response) values(u,rid,'item_hit',r);
 return r;
end $function$
;

CREATE OR REPLACE FUNCTION public.wakppu_halloween_goods_expiry(u uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
 select coalesce(jsonb_object_agg(d.id,greatest(coalesce((g.expires->>d.id)::bigint,0),
 case when public.wakppu_admin_content_access() and u=auth.uid() then coalesce((g.admin_expires->>d.id)::bigint,0) else 0 end)),'{}')
 from public.wakppu_halloween_goods_defs d left join public.wakppu_halloween_goods g on g.user_id=u where d.kind='potion';
$function$
;

CREATE OR REPLACE FUNCTION public.wakppu_api_before_halloween_goods(b jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare u uuid:=auth.uid();a text:=b->>'action';r jsonb;p public.wakppu_gem_ball_players%rowtype;d public.wakppu_gem_ball_defs%rowtype;s public.game_states%rowtype;
 rid uuid;cached public.wakppu_gem_ball_requests%rowtype;old_rebirth integer;old_ball text;fp jsonb:=b-'request_id';
begin
 if a in ('gem_balls','gem_ball_buy','gem_ball_select') then
  if u is null then raise sqlstate 'PT401';end if;
  perform public.wakppu_api_before_gem_balls('{"action":"bootstrap"}');
  if b ?| array['user_id','target_user_id','price','gem_reward','owned','gold','clicks'] then raise sqlstate 'PT403';end if;
  if a='gem_balls' then return public.wakppu_gem_ball_snapshot(u);end if;
  if coalesce(b->>'request_id','') !~ '^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$' then raise sqlstate 'PT400';end if;
  rid:=(b->>'request_id')::uuid;
  select * into s from public.game_states where user_id=u for update;
  select * into cached from public.wakppu_gem_ball_requests where user_id=u and request_id=rid;
  if found then if cached.fingerprint<>fp then raise sqlstate 'PT409';end if;return cached.response;end if;
  if (b->>'item_revision')::bigint is distinct from s.item_revision then raise sqlstate 'PT409';end if;
  insert into public.wakppu_gem_ball_players(user_id) values(u) on conflict do nothing;
  select * into p from public.wakppu_gem_ball_players where user_id=u for update;
  if a='gem_ball_buy' or b->>'ball_id' is not null then
   select * into d from public.wakppu_gem_ball_defs where ball_id=b->>'ball_id';
   if not found then raise sqlstate 'PT400';end if;
  end if;
  if a='gem_ball_buy' then
   if p.owned ? d.ball_id then raise sqlstate 'PT409' using message='이미 해금한 볼입니다.';end if;
   if public.wakppu_admin_content_access() then raise sqlstate 'PT409' using message='관리자는 구매 없이 선택할 수 있습니다.';end if;
   insert into public.wakppu_blue_gems(user_id) values(u) on conflict do nothing;
   perform 1 from public.wakppu_blue_gems where user_id=u for update;
   if (select balance<d.price from public.wakppu_blue_gems where user_id=u) then raise sqlstate 'PT400' using message='푸른젬이 부족합니다.';end if;
   update public.wakppu_blue_gems set balance=balance-d.price,revision=revision+1 where user_id=u;
   update public.wakppu_gem_ball_players set owned=owned||to_jsonb(d.ball_id) where user_id=u;
  else
   if not b ? 'ball_id' or jsonb_typeof(b->'ball_id') not in ('string','null') then raise sqlstate 'PT400';end if;
   if b->>'ball_id' is not null and not (p.owned ? d.ball_id or public.wakppu_admin_content_access()) then raise sqlstate 'PT403';end if;
   if b->>'ball_id' is not null then
    r:=public.wakppu_api_before_gem_balls('{"action":"limited"}');
    if r->>'selected' is not null then
     perform public.wakppu_api_before_gem_balls(jsonb_build_object('action','limited_select','ball_id',null,'request_id',gen_random_uuid(),'item_revision',s.item_revision));
    end if;
   end if;
   update public.wakppu_gem_ball_players set selected=b->>'ball_id',clicks=0 where user_id=u;
  end if;
  update public.game_states set item_revision=item_revision+1 where user_id=u;
  r:=public.wakppu_api_before_gem_balls('{"action":"items"}')||jsonb_build_object('gem_balls',public.wakppu_gem_ball_snapshot(u),'blue_gems',public.wakppu_blue_gem_snapshot(u),'limited',public.wakppu_api_before_gem_balls('{"action":"limited"}'));
  insert into public.wakppu_gem_ball_requests values(u,rid,fp,r);return r;
 end if;
 select rebirths,selected_ball_id into old_rebirth,old_ball from public.game_states where user_id=u;
 r:=public.wakppu_api_before_gem_balls(b);
 if u is not null and (a='limited_select' and b->>'ball_id' is not null or a='save_progress' and b->>'selected_ball_id' is distinct from old_ball) then
  update public.wakppu_gem_ball_players set selected=null,clicks=0 where user_id=u;
 end if;
 if exists(select 1 from public.game_states where user_id=u and rebirths>old_rebirth) then update public.wakppu_gem_ball_players set clicks=0 where user_id=u;end if;
 if u is not null and (a in ('bootstrap','items','item_hit','limited_hit','ember_auto_hit','save_progress','limited_select') or a like 'auto_rebirth_%') then
  r:=r||jsonb_build_object('gem_balls',public.wakppu_gem_ball_snapshot(u));
 end if;
 return r;
end $function$
;

insert into public."wakppu_item_defs" ("rank","unit","value","channel","charges","item_id","seconds") select "rank","unit","value","channel","charges","item_id","seconds" from jsonb_populate_record(null::public."wakppu_item_defs",'{"rank":"common","unit":"break","value":125,"channel":"reward","charges":0,"item_id":"common_honey_small","seconds":300}'::jsonb);

insert into public."wakppu_item_defs" ("rank","unit","value","channel","charges","item_id","seconds") select "rank","unit","value","channel","charges","item_id","seconds" from jsonb_populate_record(null::public."wakppu_item_defs",'{"rank":"common","unit":"break","value":110,"channel":"respawn","charges":30,"item_id":"common_crack_piece","seconds":0}'::jsonb);

insert into public."wakppu_item_defs" ("rank","unit","value","channel","charges","item_id","seconds") select "rank","unit","value","channel","charges","item_id","seconds" from jsonb_populate_record(null::public."wakppu_item_defs",'{"rank":"common","unit":"break","value":125,"channel":"reward","charges":1,"item_id":"common_wax_polish","seconds":0}'::jsonb);

insert into public."wakppu_item_defs" ("rank","unit","value","channel","charges","item_id","seconds") select "rank","unit","value","channel","charges","item_id","seconds" from jsonb_populate_record(null::public."wakppu_item_defs",'{"rank":"common","unit":"break","value":115,"channel":"respawn","charges":20,"item_id":"common_mini_hammer","seconds":0}'::jsonb);

insert into public."wakppu_item_defs" ("rank","unit","value","channel","charges","item_id","seconds") select "rank","unit","value","channel","charges","item_id","seconds" from jsonb_populate_record(null::public."wakppu_item_defs",'{"rank":"common","unit":"break","value":150,"channel":"reward","charges":10,"item_id":"common_lucky_wax","seconds":0}'::jsonb);

insert into public."wakppu_item_defs" ("rank","unit","value","channel","charges","item_id","seconds") select "rank","unit","value","channel","charges","item_id","seconds" from jsonb_populate_record(null::public."wakppu_item_defs",'{"rank":"common","unit":"break","value":105,"channel":"respawn","charges":0,"item_id":"common_candle","seconds":300}'::jsonb);

insert into public."wakppu_item_defs" ("rank","unit","value","channel","charges","item_id","seconds") select "rank","unit","value","channel","charges","item_id","seconds" from jsonb_populate_record(null::public."wakppu_item_defs",'{"rank":"common","unit":"break","value":110,"channel":"respawn","charges":20,"item_id":"common_wax_thread","seconds":0}'::jsonb);

insert into public."wakppu_item_defs" ("rank","unit","value","channel","charges","item_id","seconds") select "rank","unit","value","channel","charges","item_id","seconds" from jsonb_populate_record(null::public."wakppu_item_defs",'{"rank":"common","unit":"break","value":125,"channel":"animation","charges":0,"item_id":"common_wax_feather","seconds":300}'::jsonb);

insert into public."wakppu_item_defs" ("rank","unit","value","channel","charges","item_id","seconds") select "rank","unit","value","channel","charges","item_id","seconds" from jsonb_populate_record(null::public."wakppu_item_defs",'{"rank":"common","unit":"break","value":125,"channel":"reward","charges":3,"item_id":"common_micro_elixir","seconds":0}'::jsonb);

insert into public."wakppu_item_defs" ("rank","unit","value","channel","charges","item_id","seconds") select "rank","unit","value","channel","charges","item_id","seconds" from jsonb_populate_record(null::public."wakppu_item_defs",'{"rank":"common","unit":"break","value":120,"channel":"reward","charges":10,"item_id":"common_wax_coin","seconds":0}'::jsonb);

insert into public."wakppu_item_defs" ("rank","unit","value","channel","charges","item_id","seconds") select "rank","unit","value","channel","charges","item_id","seconds" from jsonb_populate_record(null::public."wakppu_item_defs",'{"rank":"rare","unit":"break","value":150,"channel":"reward","charges":0,"item_id":"rare_honey","seconds":600}'::jsonb);

insert into public."wakppu_item_defs" ("rank","unit","value","channel","charges","item_id","seconds") select "rank","unit","value","channel","charges","item_id","seconds" from jsonb_populate_record(null::public."wakppu_item_defs",'{"rank":"rare","unit":"break","value":150,"channel":"respawn","charges":0,"item_id":"rare_crack_booster","seconds":120}'::jsonb);

insert into public."wakppu_item_defs" ("rank","unit","value","channel","charges","item_id","seconds") select "rank","unit","value","channel","charges","item_id","seconds" from jsonb_populate_record(null::public."wakppu_item_defs",'{"rank":"rare","unit":"break","value":200,"channel":"reward","charges":5,"item_id":"rare_wax_coating","seconds":0}'::jsonb);

insert into public."wakppu_item_defs" ("rank","unit","value","channel","charges","item_id","seconds") select "rank","unit","value","channel","charges","item_id","seconds" from jsonb_populate_record(null::public."wakppu_item_defs",'{"rank":"rare","unit":"break","value":150,"channel":"respawn","charges":50,"item_id":"rare_iron_hammer","seconds":0}'::jsonb);

insert into public."wakppu_item_defs" ("rank","unit","value","channel","charges","item_id","seconds") select "rank","unit","value","channel","charges","item_id","seconds" from jsonb_populate_record(null::public."wakppu_item_defs",'{"rank":"rare","unit":"break","value":150,"channel":"reward","charges":0,"item_id":"rare_lucky_crystal","seconds":600}'::jsonb);

insert into public."wakppu_item_defs" ("rank","unit","value","channel","charges","item_id","seconds") select "rank","unit","value","channel","charges","item_id","seconds" from jsonb_populate_record(null::public."wakppu_item_defs",'{"rank":"rare","unit":"break","value":175,"channel":"reward","charges":0,"item_id":"rare_concentrated_honey","seconds":600}'::jsonb);

insert into public."wakppu_item_defs" ("rank","unit","value","channel","charges","item_id","seconds") select "rank","unit","value","channel","charges","item_id","seconds" from jsonb_populate_record(null::public."wakppu_item_defs",'{"rank":"rare","unit":"break","value":175,"channel":"respawn","charges":0,"item_id":"rare_strong_crack_booster","seconds":180}'::jsonb);

insert into public."wakppu_item_defs" ("rank","unit","value","channel","charges","item_id","seconds") select "rank","unit","value","channel","charges","item_id","seconds" from jsonb_populate_record(null::public."wakppu_item_defs",'{"rank":"rare","unit":"break","value":175,"channel":"reward","charges":10,"item_id":"rare_advanced_coating","seconds":0}'::jsonb);

insert into public."wakppu_item_defs" ("rank","unit","value","channel","charges","item_id","seconds") select "rank","unit","value","channel","charges","item_id","seconds" from jsonb_populate_record(null::public."wakppu_item_defs",'{"rank":"rare","unit":"break","value":175,"channel":"respawn","charges":50,"item_id":"rare_reinforced_hammer","seconds":0}'::jsonb);

insert into public."wakppu_item_defs" ("rank","unit","value","channel","charges","item_id","seconds") select "rank","unit","value","channel","charges","item_id","seconds" from jsonb_populate_record(null::public."wakppu_item_defs",'{"rank":"rare","unit":"break","value":175,"channel":"reward","charges":0,"item_id":"rare_amplifying_crystal","seconds":600}'::jsonb);

insert into public."wakppu_item_defs" ("rank","unit","value","channel","charges","item_id","seconds") select "rank","unit","value","channel","charges","item_id","seconds" from jsonb_populate_record(null::public."wakppu_item_defs",'{"rank":"hero","unit":"break","value":200,"channel":"reward","charges":0,"item_id":"hero_golden_honey","seconds":900}'::jsonb);

insert into public."wakppu_item_defs" ("rank","unit","value","channel","charges","item_id","seconds") select "rank","unit","value","channel","charges","item_id","seconds" from jsonb_populate_record(null::public."wakppu_item_defs",'{"rank":"hero","unit":"break","value":200,"channel":"respawn","charges":0,"item_id":"hero_explosion_crystal","seconds":300}'::jsonb);

insert into public."wakppu_item_defs" ("rank","unit","value","channel","charges","item_id","seconds") select "rank","unit","value","channel","charges","item_id","seconds" from jsonb_populate_record(null::public."wakppu_item_defs",'{"rank":"hero","unit":"break","value":200,"channel":"respawn","charges":0,"item_id":"hero_time_wax","seconds":180}'::jsonb);

insert into public."wakppu_item_defs" ("rank","unit","value","channel","charges","item_id","seconds") select "rank","unit","value","channel","charges","item_id","seconds" from jsonb_populate_record(null::public."wakppu_item_defs",'{"rank":"hero","unit":"break","value":250,"channel":"respawn","charges":0,"item_id":"hero_explosive_wax","seconds":300}'::jsonb);

insert into public."wakppu_item_defs" ("rank","unit","value","channel","charges","item_id","seconds") select "rank","unit","value","channel","charges","item_id","seconds" from jsonb_populate_record(null::public."wakppu_item_defs",'{"rank":"hero","unit":"break","value":250,"channel":"reward","charges":0,"item_id":"hero_gem_honey","seconds":900}'::jsonb);

insert into public."wakppu_item_defs" ("rank","unit","value","channel","charges","item_id","seconds") select "rank","unit","value","channel","charges","item_id","seconds" from jsonb_populate_record(null::public."wakppu_item_defs",'{"rank":"hero","unit":"break","value":200,"channel":"respawn","charges":0,"item_id":"hero_haste_wax","seconds":300}'::jsonb);

insert into public."wakppu_item_defs" ("rank","unit","value","channel","charges","item_id","seconds") select "rank","unit","value","channel","charges","item_id","seconds" from jsonb_populate_record(null::public."wakppu_item_defs",'{"rank":"hero","unit":"break","value":300,"channel":"reward","charges":10,"item_id":"hero_destruction_crystal","seconds":0}'::jsonb);

insert into public."wakppu_item_defs" ("rank","unit","value","channel","charges","item_id","seconds") select "rank","unit","value","channel","charges","item_id","seconds" from jsonb_populate_record(null::public."wakppu_item_defs",'{"rank":"legendary","unit":"break","value":300,"channel":"respawn","charges":0,"item_id":"legendary_destruction_core","seconds":600}'::jsonb);

insert into public."wakppu_item_defs" ("rank","unit","value","channel","charges","item_id","seconds") select "rank","unit","value","channel","charges","item_id","seconds" from jsonb_populate_record(null::public."wakppu_item_defs",'{"rank":"legendary","unit":"break","value":400,"channel":"reward","charges":20,"item_id":"legendary_golden_coating","seconds":0}'::jsonb);

insert into public."wakppu_item_defs" ("rank","unit","value","channel","charges","item_id","seconds") select "rank","unit","value","channel","charges","item_id","seconds" from jsonb_populate_record(null::public."wakppu_item_defs",'{"rank":"transcendent","unit":"break","value":600,"channel":"heart","charges":0,"item_id":"transcendent_wax_heart","seconds":1800}'::jsonb);

insert into public."wakppu_item_balls" ("clicks","reward","ball_id") select "clicks","reward","ball_id" from jsonb_populate_record(null::public."wakppu_item_balls",'{"clicks":5,"reward":1,"ball_id":"yellow"}'::jsonb);

insert into public."wakppu_item_balls" ("clicks","reward","ball_id") select "clicks","reward","ball_id" from jsonb_populate_record(null::public."wakppu_item_balls",'{"clicks":8,"reward":10,"ball_id":"green"}'::jsonb);

insert into public."wakppu_item_balls" ("clicks","reward","ball_id") select "clicks","reward","ball_id" from jsonb_populate_record(null::public."wakppu_item_balls",'{"clicks":11,"reward":30,"ball_id":"strawberry"}'::jsonb);

insert into public."wakppu_item_balls" ("clicks","reward","ball_id") select "clicks","reward","ball_id" from jsonb_populate_record(null::public."wakppu_item_balls",'{"clicks":14,"reward":50,"ball_id":"apple"}'::jsonb);

insert into public."wakppu_item_balls" ("clicks","reward","ball_id") select "clicks","reward","ball_id" from jsonb_populate_record(null::public."wakppu_item_balls",'{"clicks":17,"reward":100,"ball_id":"chocolate"}'::jsonb);

insert into public."wakppu_item_balls" ("clicks","reward","ball_id") select "clicks","reward","ball_id" from jsonb_populate_record(null::public."wakppu_item_balls",'{"clicks":20,"reward":250,"ball_id":"donut"}'::jsonb);

insert into public."wakppu_item_balls" ("clicks","reward","ball_id") select "clicks","reward","ball_id" from jsonb_populate_record(null::public."wakppu_item_balls",'{"clicks":23,"reward":400,"ball_id":"rainbow"}'::jsonb);

insert into public."wakppu_item_balls" ("clicks","reward","ball_id") select "clicks","reward","ball_id" from jsonb_populate_record(null::public."wakppu_item_balls",'{"clicks":26,"reward":1000,"ball_id":"water"}'::jsonb);

insert into public."wakppu_item_balls" ("clicks","reward","ball_id") select "clicks","reward","ball_id" from jsonb_populate_record(null::public."wakppu_item_balls",'{"clicks":29,"reward":1500,"ball_id":"emerald"}'::jsonb);

insert into public."wakppu_item_balls" ("clicks","reward","ball_id") select "clicks","reward","ball_id" from jsonb_populate_record(null::public."wakppu_item_balls",'{"clicks":32,"reward":2000,"ball_id":"diamond"}'::jsonb);

insert into public."wakppu_item_balls" ("clicks","reward","ball_id") select "clicks","reward","ball_id" from jsonb_populate_record(null::public."wakppu_item_balls",'{"clicks":50,"reward":10000,"ball_id":"planet"}'::jsonb);

insert into public."wakppu_item_balls" ("clicks","reward","ball_id") select "clicks","reward","ball_id" from jsonb_populate_record(null::public."wakppu_item_balls",'{"clicks":100,"reward":500000,"ball_id":"sun"}'::jsonb);

insert into public."wakppu_item_balls" ("clicks","reward","ball_id") select "clicks","reward","ball_id" from jsonb_populate_record(null::public."wakppu_item_balls",'{"clicks":180,"reward":5000000,"ball_id":"blackhole"}'::jsonb);

insert into public."wakppu_item_balls" ("clicks","reward","ball_id") select "clicks","reward","ball_id" from jsonb_populate_record(null::public."wakppu_item_balls",'{"clicks":300,"reward":15000000,"ball_id":"whitehole"}'::jsonb);

insert into public."wakppu_item_balls" ("clicks","reward","ball_id") select "clicks","reward","ball_id" from jsonb_populate_record(null::public."wakppu_item_balls",'{"clicks":360,"reward":20000000,"ball_id":"starlight"}'::jsonb);

insert into public."wakppu_item_balls" ("clicks","reward","ball_id") select "clicks","reward","ball_id" from jsonb_populate_record(null::public."wakppu_item_balls",'{"clicks":720,"reward":30000000,"ball_id":"hellfire"}'::jsonb);

insert into public."wakppu_item_balls" ("clicks","reward","ball_id") select "clicks","reward","ball_id" from jsonb_populate_record(null::public."wakppu_item_balls",'{"clicks":1440,"reward":45000000,"ball_id":"heaven-cloud"}'::jsonb);

insert into public."wakppu_item_balls" ("clicks","reward","ball_id") select "clicks","reward","ball_id" from jsonb_populate_record(null::public."wakppu_item_balls",'{"clicks":2880,"reward":70000000,"ball_id":"hell-ember"}'::jsonb);

insert into public."wakppu_item_balls" ("clicks","reward","ball_id") select "clicks","reward","ball_id" from jsonb_populate_record(null::public."wakppu_item_balls",'{"clicks":5760,"reward":100000000,"ball_id":"heaven-gem"}'::jsonb);

insert into public."wakppu_item_balls" ("clicks","reward","ball_id") select "clicks","reward","ball_id" from jsonb_populate_record(null::public."wakppu_item_balls",'{"clicks":11520,"reward":150000000,"ball_id":"hell-core"}'::jsonb);

insert into public."wakppu_item_balls" ("clicks","reward","ball_id") select "clicks","reward","ball_id" from jsonb_populate_record(null::public."wakppu_item_balls",'{"clicks":23040,"reward":250000000,"ball_id":"judgment"}'::jsonb);

insert into public."wakppu_item_balls" ("clicks","reward","ball_id") select "clicks","reward","ball_id" from jsonb_populate_record(null::public."wakppu_item_balls",'{"clicks":46080,"reward":400000000,"ball_id":"heaven-earth"}'::jsonb);

insert into public."wakppu_item_balls" ("clicks","reward","ball_id") select "clicks","reward","ball_id" from jsonb_populate_record(null::public."wakppu_item_balls",'{"clicks":92160,"reward":600000000,"ball_id":"soul"}'::jsonb);

insert into public."wakppu_item_balls" ("clicks","reward","ball_id") select "clicks","reward","ball_id" from jsonb_populate_record(null::public."wakppu_item_balls",'{"clicks":184320,"reward":1000000000,"ball_id":"eternity"}'::jsonb);

insert into public."wakppu_ball_rewards" ("reward","ball_id") select "reward","ball_id" from jsonb_populate_record(null::public."wakppu_ball_rewards",'{"reward":1,"ball_id":"yellow"}'::jsonb);

insert into public."wakppu_ball_rewards" ("reward","ball_id") select "reward","ball_id" from jsonb_populate_record(null::public."wakppu_ball_rewards",'{"reward":10,"ball_id":"green"}'::jsonb);

insert into public."wakppu_ball_rewards" ("reward","ball_id") select "reward","ball_id" from jsonb_populate_record(null::public."wakppu_ball_rewards",'{"reward":30,"ball_id":"strawberry"}'::jsonb);

insert into public."wakppu_ball_rewards" ("reward","ball_id") select "reward","ball_id" from jsonb_populate_record(null::public."wakppu_ball_rewards",'{"reward":50,"ball_id":"apple"}'::jsonb);

insert into public."wakppu_ball_rewards" ("reward","ball_id") select "reward","ball_id" from jsonb_populate_record(null::public."wakppu_ball_rewards",'{"reward":100,"ball_id":"chocolate"}'::jsonb);

insert into public."wakppu_ball_rewards" ("reward","ball_id") select "reward","ball_id" from jsonb_populate_record(null::public."wakppu_ball_rewards",'{"reward":250,"ball_id":"donut"}'::jsonb);

insert into public."wakppu_ball_rewards" ("reward","ball_id") select "reward","ball_id" from jsonb_populate_record(null::public."wakppu_ball_rewards",'{"reward":400,"ball_id":"rainbow"}'::jsonb);

insert into public."wakppu_ball_rewards" ("reward","ball_id") select "reward","ball_id" from jsonb_populate_record(null::public."wakppu_ball_rewards",'{"reward":1000,"ball_id":"water"}'::jsonb);

insert into public."wakppu_ball_rewards" ("reward","ball_id") select "reward","ball_id" from jsonb_populate_record(null::public."wakppu_ball_rewards",'{"reward":1500,"ball_id":"emerald"}'::jsonb);

insert into public."wakppu_ball_rewards" ("reward","ball_id") select "reward","ball_id" from jsonb_populate_record(null::public."wakppu_ball_rewards",'{"reward":2000,"ball_id":"diamond"}'::jsonb);

insert into public."wakppu_ball_rewards" ("reward","ball_id") select "reward","ball_id" from jsonb_populate_record(null::public."wakppu_ball_rewards",'{"reward":10000,"ball_id":"planet"}'::jsonb);

insert into public."wakppu_ball_rewards" ("reward","ball_id") select "reward","ball_id" from jsonb_populate_record(null::public."wakppu_ball_rewards",'{"reward":500000,"ball_id":"sun"}'::jsonb);

insert into public."wakppu_ball_rewards" ("reward","ball_id") select "reward","ball_id" from jsonb_populate_record(null::public."wakppu_ball_rewards",'{"reward":5000000,"ball_id":"blackhole"}'::jsonb);

insert into public."wakppu_ball_rewards" ("reward","ball_id") select "reward","ball_id" from jsonb_populate_record(null::public."wakppu_ball_rewards",'{"reward":15000000,"ball_id":"whitehole"}'::jsonb);

insert into public."wakppu_ball_rewards" ("reward","ball_id") select "reward","ball_id" from jsonb_populate_record(null::public."wakppu_ball_rewards",'{"reward":20000000,"ball_id":"starlight"}'::jsonb);

insert into public."wakppu_ball_rewards" ("reward","ball_id") select "reward","ball_id" from jsonb_populate_record(null::public."wakppu_ball_rewards",'{"reward":30000000,"ball_id":"hellfire"}'::jsonb);

insert into public."wakppu_ball_rewards" ("reward","ball_id") select "reward","ball_id" from jsonb_populate_record(null::public."wakppu_ball_rewards",'{"reward":45000000,"ball_id":"heaven-cloud"}'::jsonb);

insert into public."wakppu_ball_rewards" ("reward","ball_id") select "reward","ball_id" from jsonb_populate_record(null::public."wakppu_ball_rewards",'{"reward":70000000,"ball_id":"hell-ember"}'::jsonb);

insert into public."wakppu_ball_rewards" ("reward","ball_id") select "reward","ball_id" from jsonb_populate_record(null::public."wakppu_ball_rewards",'{"reward":100000000,"ball_id":"heaven-gem"}'::jsonb);

insert into public."wakppu_ball_rewards" ("reward","ball_id") select "reward","ball_id" from jsonb_populate_record(null::public."wakppu_ball_rewards",'{"reward":150000000,"ball_id":"hell-core"}'::jsonb);

insert into public."wakppu_ball_rewards" ("reward","ball_id") select "reward","ball_id" from jsonb_populate_record(null::public."wakppu_ball_rewards",'{"reward":250000000,"ball_id":"judgment"}'::jsonb);

insert into public."wakppu_ball_rewards" ("reward","ball_id") select "reward","ball_id" from jsonb_populate_record(null::public."wakppu_ball_rewards",'{"reward":400000000,"ball_id":"heaven-earth"}'::jsonb);

insert into public."wakppu_ball_rewards" ("reward","ball_id") select "reward","ball_id" from jsonb_populate_record(null::public."wakppu_ball_rewards",'{"reward":600000000,"ball_id":"soul"}'::jsonb);

insert into public."wakppu_ball_rewards" ("reward","ball_id") select "reward","ball_id" from jsonb_populate_record(null::public."wakppu_ball_rewards",'{"reward":1000000000,"ball_id":"eternity"}'::jsonb);

insert into public."wakppu_purchase_products" ("id","name","amount","description") select "id","name","amount","description" from jsonb_populate_record(null::public."wakppu_purchase_products",'{"id":"first_steps_pack","name":"첫걸음 성장팩","amount":1100,"description":"계정당 1회 · 3,000G + 고급 꿀병 2개(개당 Gold ×1.5·10분), 재생 촉진제 3개(개당 재등장 대기 약 33% 감소·2분), 가벼운 왁스 깃털 2개(개당 파괴 모션 ×1.25·5분) · 아이템은 인벤토리에 지급, 직접 사용 · 사용 후 로그아웃 중에도 시간 경과"}'::jsonb);

insert into public."wakppu_purchase_products" ("id","name","amount","description") select "id","name","amount","description" from jsonb_populate_record(null::public."wakppu_purchase_products",'{"id":"starlight_skin","name":"별빛 오라 스킨","amount":500,"description":"모든 볼에 별빛 고리와 반짝임 · 능력치 변화 없음"}'::jsonb);

insert into public."wakppu_purchase_products" ("id","name","amount","description") select "id","name","amount","description" from jsonb_populate_record(null::public."wakppu_purchase_products",'{"id":"auto_rebirth","name":"자동 환생 영구 이용권","amount":4000,"description":"접속 중 필요 골드 도달 시 자동 환생 · 구매 후 OFF · ON/OFF 가능 · 기존 환생 초기화 규칙 적용"}'::jsonb);

insert into public."wakppu_purchase_products" ("id","name","amount","description") select "id","name","amount","description" from jsonb_populate_record(null::public."wakppu_purchase_products",'{"id":"custom_ball_single","name":"커스텀 왁뿌볼 · 단일","amount":9900,"description":"선택한 보유 볼 1종 · 이미지 자유 교체 · 보유 연출·사운드 조합 · 능력치 변화 없음"}'::jsonb);

insert into public."wakppu_purchase_products" ("id","name","amount","description") select "id","name","amount","description" from jsonb_populate_record(null::public."wakppu_purchase_products",'{"id":"custom_ball_all","name":"커스텀 왁뿌볼 · 전체","amount":29000,"description":"보유한 모든 볼·추후 해금 볼에 적용 · 볼별 저장·전체 공통 적용 · 단일 상품 보유 시 차액 19,100원"}'::jsonb);

insert into public."wakppu_purchase_products" ("id","name","amount","description") select "id","name","amount","description" from jsonb_populate_record(null::public."wakppu_purchase_products",'{"id":"supporter_pack","name":"왁뿌볼 응원팩","amount":1100,"description":"후원자 칭호·전용 테두리 + 영구 파괴 골드 보너스 5% · 전용 프로필 카드 「따뜻한 응원」 포함 · 인벤토리 → 프로필에서 장착 · 기존 구매자도 적용 · 1G 미만 누적"}'::jsonb);

insert into public."wakppu_purchase_products" ("id","name","amount","description") select "id","name","amount","description" from jsonb_populate_record(null::public."wakppu_purchase_products",'{"id":"premium_supporter_pack","name":"프리미엄 후원팩","amount":10000,"description":"영구 파괴 골드 +30% · 금빛 랭킹 디자인·전용 칭호·프로필 배지 · 전용 프로필 카드 「찬란한 성좌」와 후원자 카드 「따뜻한 응원」 포함 · 기존 구매자도 적용 · 응원팩 보유 시 8,900원 업그레이드 · +5%와 합산하지 않음"}'::jsonb);

insert into public."wakppu_blue_gem_products" ("level","price","multiplier") select "level","price","multiplier" from jsonb_populate_record(null::public."wakppu_blue_gem_products",'{"level":1,"price":1000,"multiplier":2}'::jsonb);

insert into public."wakppu_blue_gem_products" ("level","price","multiplier") select "level","price","multiplier" from jsonb_populate_record(null::public."wakppu_blue_gem_products",'{"level":2,"price":10000,"multiplier":5}'::jsonb);

insert into public."wakppu_blue_gem_products" ("level","price","multiplier") select "level","price","multiplier" from jsonb_populate_record(null::public."wakppu_blue_gem_products",'{"level":3,"price":100000,"multiplier":10}'::jsonb);

insert into public."wakppu_blue_gem_products" ("level","price","multiplier") select "level","price","multiplier" from jsonb_populate_record(null::public."wakppu_blue_gem_products",'{"level":4,"price":1000000,"multiplier":100}'::jsonb);

insert into public."wakppu_blue_gem_products" ("level","price","multiplier") select "level","price","multiplier" from jsonb_populate_record(null::public."wakppu_blue_gem_products",'{"level":5,"price":10000000,"multiplier":1000}'::jsonb);

insert into public."wakppu_blue_gem_products" ("level","price","multiplier") select "level","price","multiplier" from jsonb_populate_record(null::public."wakppu_blue_gem_products",'{"level":6,"price":1000000000000000,"multiplier":1000000}'::jsonb);

insert into public."wakppu_blue_gem_products" ("level","price","multiplier") select "level","price","multiplier" from jsonb_populate_record(null::public."wakppu_blue_gem_products",'{"level":7,"price":1e+39,"multiplier":1000000000}'::jsonb);

insert into public."wakppu_gem_ball_defs" ("name","price","clicks","ball_id","gem_reward") select "name","price","clicks","ball_id","gem_reward" from jsonb_populate_record(null::public."wakppu_gem_ball_defs",'{"name":"푸른 수정 왁뿌볼","price":5000,"clicks":100,"ball_id":"blue-crystal-wax","gem_reward":5}'::jsonb);

insert into public."wakppu_profile_card_defs" ("free","name","image","rarity","card_id") select "free","name","image","rarity","card_id" from jsonb_populate_record(null::public."wakppu_profile_card_defs",'{"free":true,"name":"왁스의 시작","image":"images/profile-cards/wax-beginning.png","rarity":"기본","card_id":"wax_beginning"}'::jsonb);

insert into public."wakppu_profile_card_defs" ("free","name","image","rarity","card_id") select "free","name","image","rarity","card_id" from jsonb_populate_record(null::public."wakppu_profile_card_defs",'{"free":false,"name":"황금의 정점","image":"images/profile-cards/golden-champion.webp","rarity":"1위 기념","card_id":"golden_champion"}'::jsonb);

insert into public."wakppu_profile_card_defs" ("free","name","image","rarity","card_id") select "free","name","image","rarity","card_id" from jsonb_populate_record(null::public."wakppu_profile_card_defs",'{"free":false,"name":"따뜻한 응원","image":"images/profile-cards/supporter-glow.webp","rarity":"후원자 전용","card_id":"supporter_glow"}'::jsonb);

insert into public."wakppu_profile_card_defs" ("free","name","image","rarity","card_id") select "free","name","image","rarity","card_id" from jsonb_populate_record(null::public."wakppu_profile_card_defs",'{"free":false,"name":"찬란한 성좌","image":"images/profile-cards/premium-celestial.webp","rarity":"프리미엄 전용","card_id":"premium_celestial"}'::jsonb);

insert into public."server_settings" ("id","maintenance","message","background_mode") select "id","maintenance","message","background_mode" from jsonb_populate_record(null::public."server_settings",'{"id":true,"maintenance":false,"message":"","background_mode":"default"}'::jsonb);

insert into public."wakppu_limited_settings" ("id","starts_at","ends_at") select "id","starts_at","ends_at" from jsonb_populate_record(null::public."wakppu_limited_settings",'{"id":true,"starts_at":"2000-01-01T00:00:00Z","ends_at":"2000-01-02T00:00:00Z"}'::jsonb);

insert into public."wakppu_weekly_events" ("id","enabled","weekday","skip_ball","skip_gold","local_time","multiplier","ball_seconds","gold_seconds") select "id","enabled","weekday","skip_ball","skip_gold","local_time","multiplier","ball_seconds","gold_seconds" from jsonb_populate_record(null::public."wakppu_weekly_events",'{"id":"friday-morning","enabled":true,"weekday":5,"skip_ball":null,"skip_gold":null,"local_time":"07:00:00","multiplier":10,"ball_seconds":600,"gold_seconds":600}'::jsonb);

insert into public."wakppu_weekly_events" ("id","enabled","weekday","skip_ball","skip_gold","local_time","multiplier","ball_seconds","gold_seconds") select "id","enabled","weekday","skip_ball","skip_gold","local_time","multiplier","ball_seconds","gold_seconds" from jsonb_populate_record(null::public."wakppu_weekly_events",'{"id":"friday-evening","enabled":true,"weekday":5,"skip_ball":null,"skip_gold":null,"local_time":"21:30:00","multiplier":100,"ball_seconds":900,"gold_seconds":600}'::jsonb);

insert into public."wakppu_weekly_events" ("id","enabled","weekday","skip_ball","skip_gold","local_time","multiplier","ball_seconds","gold_seconds") select "id","enabled","weekday","skip_ball","skip_gold","local_time","multiplier","ball_seconds","gold_seconds" from jsonb_populate_record(null::public."wakppu_weekly_events",'{"id":"tuesday-evening","enabled":true,"weekday":2,"skip_ball":null,"skip_gold":null,"local_time":"21:30:00","multiplier":100,"ball_seconds":900,"gold_seconds":600}'::jsonb);

insert into public."wakppu_skin_defs" ("rank","weight","ball_id","skin_id","position","exchange_shards","duplicate_shards") select "rank","weight","ball_id","skin_id","position","exchange_shards","duplicate_shards" from jsonb_populate_record(null::public."wakppu_skin_defs",'{"rank":"common","weight":7000,"ball_id":"eternity","skin_id":"eternity_common","position":0,"exchange_shards":10,"duplicate_shards":1}'::jsonb);

insert into public."wakppu_skin_defs" ("rank","weight","ball_id","skin_id","position","exchange_shards","duplicate_shards") select "rank","weight","ball_id","skin_id","position","exchange_shards","duplicate_shards" from jsonb_populate_record(null::public."wakppu_skin_defs",'{"rank":"rare","weight":2200,"ball_id":"eternity","skin_id":"eternity_rare","position":1,"exchange_shards":30,"duplicate_shards":3}'::jsonb);

insert into public."wakppu_skin_defs" ("rank","weight","ball_id","skin_id","position","exchange_shards","duplicate_shards") select "rank","weight","ball_id","skin_id","position","exchange_shards","duplicate_shards" from jsonb_populate_record(null::public."wakppu_skin_defs",'{"rank":"hero","weight":600,"ball_id":"eternity","skin_id":"eternity_hero","position":2,"exchange_shards":100,"duplicate_shards":10}'::jsonb);

insert into public."wakppu_skin_defs" ("rank","weight","ball_id","skin_id","position","exchange_shards","duplicate_shards") select "rank","weight","ball_id","skin_id","position","exchange_shards","duplicate_shards" from jsonb_populate_record(null::public."wakppu_skin_defs",'{"rank":"legendary","weight":190,"ball_id":"eternity","skin_id":"eternity_legendary","position":3,"exchange_shards":300,"duplicate_shards":30}'::jsonb);

insert into public."wakppu_skin_defs" ("rank","weight","ball_id","skin_id","position","exchange_shards","duplicate_shards") select "rank","weight","ball_id","skin_id","position","exchange_shards","duplicate_shards" from jsonb_populate_record(null::public."wakppu_skin_defs",'{"rank":"transcendent","weight":10,"ball_id":"eternity","skin_id":"eternity_transcendent","position":4,"exchange_shards":1000,"duplicate_shards":100}'::jsonb);

insert into public."wakppu_item_ranks" ("rank","weight","position") select "rank","weight","position" from jsonb_populate_record(null::public."wakppu_item_ranks",'{"rank":"common","weight":7000,"position":0}'::jsonb);

insert into public."wakppu_item_ranks" ("rank","weight","position") select "rank","weight","position" from jsonb_populate_record(null::public."wakppu_item_ranks",'{"rank":"rare","weight":2200,"position":1}'::jsonb);

insert into public."wakppu_item_ranks" ("rank","weight","position") select "rank","weight","position" from jsonb_populate_record(null::public."wakppu_item_ranks",'{"rank":"hero","weight":600,"position":2}'::jsonb);

insert into public."wakppu_item_ranks" ("rank","weight","position") select "rank","weight","position" from jsonb_populate_record(null::public."wakppu_item_ranks",'{"rank":"legendary","weight":190,"position":3}'::jsonb);

insert into public."wakppu_item_ranks" ("rank","weight","position") select "rank","weight","position" from jsonb_populate_record(null::public."wakppu_item_ranks",'{"rank":"transcendent","weight":10,"position":4}'::jsonb);

insert into public.wakppu_purchase_config(id,enabled) values(true,false);

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION handle_new_user();

CREATE TRIGGER wakppu_track_new_guest AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION wakppu_track_new_guest();

CREATE TRIGGER wakppu_first_steps_delivery BEFORE INSERT OR DELETE ON public.wakppu_purchase_entitlements FOR EACH ROW EXECUTE FUNCTION wakppu_first_steps_delivery();

CREATE TRIGGER wakppu_custom_entitlement BEFORE INSERT OR DELETE ON public.wakppu_purchase_entitlements FOR EACH ROW EXECUTE FUNCTION wakppu_custom_entitlement();

CREATE TRIGGER wakppu_custom_asset_retire BEFORE DELETE ON public.wakppu_custom_assets FOR EACH ROW EXECUTE FUNCTION wakppu_custom_asset_retire();

CREATE TRIGGER wakppu_auto_rebirth_reset AFTER INSERT OR DELETE ON public.wakppu_purchase_entitlements FOR EACH ROW EXECUTE FUNCTION wakppu_auto_rebirth_reset();

CREATE TRIGGER wakppu_supporter_card_cleanup AFTER DELETE OR UPDATE ON public.wakppu_purchase_entitlements FOR EACH ROW EXECUTE FUNCTION wakppu_supporter_card_cleanup();

alter table public."admin_audit_logs" enable row level security;

revoke all on public."admin_audit_logs" from public,anon,authenticated;

grant all on public."admin_audit_logs" to service_role;

alter table public."click_events" enable row level security;

revoke all on public."click_events" from public,anon,authenticated;

grant all on public."click_events" to service_role;

alter table public."game_states" enable row level security;

revoke all on public."game_states" from public,anon,authenticated;

grant all on public."game_states" to service_role;

alter table public."guest_lifecycle" enable row level security;

revoke all on public."guest_lifecycle" from public,anon,authenticated;

grant all on public."guest_lifecycle" to service_role;

alter table public."moderation_cases" enable row level security;

revoke all on public."moderation_cases" from public,anon,authenticated;

grant all on public."moderation_cases" to service_role;

alter table public."player_presence" enable row level security;

revoke all on public."player_presence" from public,anon,authenticated;

grant all on public."player_presence" to service_role;

alter table public."players" enable row level security;

revoke all on public."players" from public,anon,authenticated;

grant all on public."players" to service_role;

alter table public."server_settings" enable row level security;

revoke all on public."server_settings" from public,anon,authenticated;

grant all on public."server_settings" to service_role;

alter table public."wakppu_auto_rebirth" enable row level security;

revoke all on public."wakppu_auto_rebirth" from public,anon,authenticated;

grant all on public."wakppu_auto_rebirth" to service_role;

alter table public."wakppu_ball_rewards" enable row level security;

revoke all on public."wakppu_ball_rewards" from public,anon,authenticated;

grant all on public."wakppu_ball_rewards" to service_role;

alter table public."wakppu_blue_gem_exclusions" enable row level security;

revoke all on public."wakppu_blue_gem_exclusions" from public,anon,authenticated;

grant all on public."wakppu_blue_gem_exclusions" to service_role;

alter table public."wakppu_blue_gem_products" enable row level security;

revoke all on public."wakppu_blue_gem_products" from public,anon,authenticated;

grant all on public."wakppu_blue_gem_products" to service_role;

alter table public."wakppu_blue_gem_requests" enable row level security;

revoke all on public."wakppu_blue_gem_requests" from public,anon,authenticated;

grant all on public."wakppu_blue_gem_requests" to service_role;

alter table public."wakppu_blue_gems" enable row level security;

revoke all on public."wakppu_blue_gems" from public,anon,authenticated;

grant all on public."wakppu_blue_gems" to service_role;

alter table public."wakppu_custom_accounts" enable row level security;

revoke all on public."wakppu_custom_accounts" from public,anon,authenticated;

grant all on public."wakppu_custom_accounts" to service_role;

alter table public."wakppu_custom_assets" enable row level security;

revoke all on public."wakppu_custom_assets" from public,anon,authenticated;

grant all on public."wakppu_custom_assets" to service_role;

alter table public."wakppu_custom_gc" enable row level security;

revoke all on public."wakppu_custom_gc" from public,anon,authenticated;

grant all on public."wakppu_custom_gc" to service_role;

alter table public."wakppu_custom_profiles" enable row level security;

revoke all on public."wakppu_custom_profiles" from public,anon,authenticated;

grant all on public."wakppu_custom_profiles" to service_role;

alter table public."wakppu_custom_requests" enable row level security;

revoke all on public."wakppu_custom_requests" from public,anon,authenticated;

grant all on public."wakppu_custom_requests" to service_role;

alter table public."wakppu_developer_keepsakes" enable row level security;

revoke all on public."wakppu_developer_keepsakes" from public,anon,authenticated;

grant all on public."wakppu_developer_keepsakes" to service_role;

alter table public."wakppu_ember_hit_requests" enable row level security;

revoke all on public."wakppu_ember_hit_requests" from public,anon,authenticated;

grant all on public."wakppu_ember_hit_requests" to service_role;

alter table public."wakppu_event_ball_progress" enable row level security;

revoke all on public."wakppu_event_ball_progress" from public,anon,authenticated;

grant all on public."wakppu_event_ball_progress" to service_role;

alter table public."wakppu_first_steps_grants" enable row level security;

revoke all on public."wakppu_first_steps_grants" from public,anon,authenticated;

grant all on public."wakppu_first_steps_grants" to service_role;

alter table public."wakppu_gem_ball_defs" enable row level security;

revoke all on public."wakppu_gem_ball_defs" from public,anon,authenticated;

grant all on public."wakppu_gem_ball_defs" to service_role;

alter table public."wakppu_gem_ball_players" enable row level security;

revoke all on public."wakppu_gem_ball_players" from public,anon,authenticated;

grant all on public."wakppu_gem_ball_players" to service_role;

alter table public."wakppu_gem_ball_requests" enable row level security;

revoke all on public."wakppu_gem_ball_requests" from public,anon,authenticated;

grant all on public."wakppu_gem_ball_requests" to service_role;

alter table public."wakppu_halloween_cosmetic_requests" enable row level security;

revoke all on public."wakppu_halloween_cosmetic_requests" from public,anon,authenticated;

grant all on public."wakppu_halloween_cosmetic_requests" to service_role;

alter table public."wakppu_halloween_cosmetics" enable row level security;

revoke all on public."wakppu_halloween_cosmetics" from public,anon,authenticated;

grant all on public."wakppu_halloween_cosmetics" to service_role;

alter table public."wakppu_halloween_goods" enable row level security;

revoke all on public."wakppu_halloween_goods" from public,anon,authenticated;

grant all on public."wakppu_halloween_goods" to service_role;

alter table public."wakppu_halloween_goods_defs" enable row level security;

revoke all on public."wakppu_halloween_goods_defs" from public,anon,authenticated;

grant all on public."wakppu_halloween_goods_defs" to service_role;

alter table public."wakppu_halloween_goods_requests" enable row level security;

revoke all on public."wakppu_halloween_goods_requests" from public,anon,authenticated;

grant all on public."wakppu_halloween_goods_requests" to service_role;

alter table public."wakppu_input_events" enable row level security;

revoke all on public."wakppu_input_events" from public,anon,authenticated;

grant all on public."wakppu_input_events" to service_role;

alter table public."wakppu_input_guard" enable row level security;

revoke all on public."wakppu_input_guard" from public,anon,authenticated;

grant all on public."wakppu_input_guard" to service_role;

alter table public."wakppu_input_reports" enable row level security;

revoke all on public."wakppu_input_reports" from public,anon,authenticated;

grant all on public."wakppu_input_reports" to service_role;

alter table public."wakppu_item_balls" enable row level security;

revoke all on public."wakppu_item_balls" from public,anon,authenticated;

grant all on public."wakppu_item_balls" to service_role;

alter table public."wakppu_item_defs" enable row level security;

revoke all on public."wakppu_item_defs" from public,anon,authenticated;

grant all on public."wakppu_item_defs" to service_role;

alter table public."wakppu_item_ranks" enable row level security;

revoke all on public."wakppu_item_ranks" from public,anon,authenticated;

grant all on public."wakppu_item_ranks" to service_role;

alter table public."wakppu_item_requests" enable row level security;

revoke all on public."wakppu_item_requests" from public,anon,authenticated;

grant all on public."wakppu_item_requests" to service_role;

alter table public."wakppu_items" enable row level security;

revoke all on public."wakppu_items" from public,anon,authenticated;

grant all on public."wakppu_items" to service_role;

alter table public."wakppu_limited_players" enable row level security;

revoke all on public."wakppu_limited_players" from public,anon,authenticated;

grant all on public."wakppu_limited_players" to service_role;

alter table public."wakppu_limited_requests" enable row level security;

revoke all on public."wakppu_limited_requests" from public,anon,authenticated;

grant all on public."wakppu_limited_requests" to service_role;

alter table public."wakppu_limited_settings" enable row level security;

revoke all on public."wakppu_limited_settings" from public,anon,authenticated;

grant all on public."wakppu_limited_settings" to service_role;

alter table public."wakppu_monthly_clicks" enable row level security;

revoke all on public."wakppu_monthly_clicks" from public,anon,authenticated;

grant all on public."wakppu_monthly_clicks" to service_role;

alter table public."wakppu_monthly_results" enable row level security;

revoke all on public."wakppu_monthly_results" from public,anon,authenticated;

grant all on public."wakppu_monthly_results" to service_role;

alter table public."wakppu_monthly_rewards" enable row level security;

revoke all on public."wakppu_monthly_rewards" from public,anon,authenticated;

grant all on public."wakppu_monthly_rewards" to service_role;

alter table public."wakppu_monthly_seasons" enable row level security;

revoke all on public."wakppu_monthly_seasons" from public,anon,authenticated;

grant all on public."wakppu_monthly_seasons" to service_role;

alter table public."wakppu_profile_card_defs" enable row level security;

revoke all on public."wakppu_profile_card_defs" from public,anon,authenticated;

grant all on public."wakppu_profile_card_defs" to service_role;

alter table public."wakppu_profile_card_grants" enable row level security;

revoke all on public."wakppu_profile_card_grants" from public,anon,authenticated;

grant all on public."wakppu_profile_card_grants" to service_role;

alter table public."wakppu_profile_cards" enable row level security;

revoke all on public."wakppu_profile_cards" from public,anon,authenticated;

grant all on public."wakppu_profile_cards" to service_role;

alter table public."wakppu_pumpkin_skin_defs" enable row level security;

revoke all on public."wakppu_pumpkin_skin_defs" from public,anon,authenticated;

grant all on public."wakppu_pumpkin_skin_defs" to service_role;

alter table public."wakppu_purchase_config" enable row level security;

revoke all on public."wakppu_purchase_config" from public,anon,authenticated;

grant all on public."wakppu_purchase_config" to service_role;

alter table public."wakppu_purchase_cosmetics" enable row level security;

revoke all on public."wakppu_purchase_cosmetics" from public,anon,authenticated;

grant all on public."wakppu_purchase_cosmetics" to service_role;

alter table public."wakppu_purchase_entitlements" enable row level security;

revoke all on public."wakppu_purchase_entitlements" from public,anon,authenticated;

grant all on public."wakppu_purchase_entitlements" to service_role;

alter table public."wakppu_purchase_orders" enable row level security;

revoke all on public."wakppu_purchase_orders" from public,anon,authenticated;

grant all on public."wakppu_purchase_orders" to service_role;

alter table public."wakppu_purchase_products" enable row level security;

revoke all on public."wakppu_purchase_products" from public,anon,authenticated;

grant all on public."wakppu_purchase_products" to service_role;

alter table public."wakppu_skin_defs" enable row level security;

revoke all on public."wakppu_skin_defs" from public,anon,authenticated;

grant all on public."wakppu_skin_defs" to service_role;

alter table public."wakppu_skin_requests" enable row level security;

revoke all on public."wakppu_skin_requests" from public,anon,authenticated;

grant all on public."wakppu_skin_requests" to service_role;

alter table public."wakppu_skins" enable row level security;

revoke all on public."wakppu_skins" from public,anon,authenticated;

grant all on public."wakppu_skins" to service_role;

alter table public."wakppu_weekly_events" enable row level security;

revoke all on public."wakppu_weekly_events" from public,anon,authenticated;

grant all on public."wakppu_weekly_events" to service_role;

create policy "players can view their own game state" on public."game_states" as PERMISSIVE for SELECT to authenticated using ((auth.uid() = user_id));

create policy "players can view their own profile" on public."players" as PERMISSIVE for SELECT to authenticated using ((auth.uid() = user_id));

grant select on public.players,public.game_states to authenticated;

grant usage on schema public to anon,authenticated,service_role;

grant usage,select on all sequences in schema public to service_role;

set check_function_bodies=on;
