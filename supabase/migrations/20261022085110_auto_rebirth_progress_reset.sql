begin;
do $migration$
declare source text;patched text;begin
 source:=pg_get_functiondef('public.wakppu_api(jsonb)'::regprocedure);
 patched:=replace(source,'set item_revision=item_revision+1 where user_id=u;','set item_revision=item_revision+1,current_clicks=0,item_current_clicks=0,current_ball_id=''yellow'' where user_id=u;');
 if patched=source then raise exception 'Unexpected auto rebirth function; migration aborted';end if;
 execute patched;
end $migration$;
commit;
