-- Read-only public launch checks. Gameplay mutations are tested in the isolated SQL fixture.
begin read only;
do $check$
begin
 if exists(select 1 from public.wakppu_monthly_seasons where month='2026-11-01') then raise exception 'November season still visible';end if;
 if exists(select 1 from public.wakppu_monthly_clicks where month<'2026-12-01') then raise exception 'Pre-launch clicks present';end if;
 if public.wakppu_supporter_percent(null)<>0 then raise exception 'Paid bonus enabled';end if;
 begin perform public.wakppu_api('{"action":"purchase_catalog"}');raise exception 'Paid shop accessible';exception when sqlstate 'PT403' then null;end;
 begin perform public.wakppu_api('{"action":"custom_status"}');raise exception 'Paid custom accessible';exception when sqlstate 'PT403' then null;end;
 begin perform public.wakppu_api('{"action":"admin_paid_grant"}');raise exception 'Paid grant accessible';exception when sqlstate 'PT403' then null;end;
 if has_function_privilege('authenticated','public.wakppu_api_before_public_launch(jsonb)','execute')
 or has_function_privilege('anon','public.wakppu_public_unpaid(jsonb)','execute')
 or has_table_privilege('anon','public.wakppu_purchase_config','select') then raise exception 'Private helper/data exposed';end if;
end $check$;
rollback;
select true as public_launch_policy_verified;
