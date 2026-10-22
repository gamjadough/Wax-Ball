begin;
alter table public.wakppu_input_guard add column if not exists speed_limited_until timestamptz;
create or replace function public.wakppu_input_metrics(samples jsonb) returns jsonb
language plpgsql immutable set search_path=public,pg_temp as $metrics$
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
end $metrics$;
revoke all on function public.wakppu_input_metrics(jsonb) from public,anon,authenticated;
-- Patch only the existing input-guard wrapper, preserving all newer auth/economy wrappers.
do $patch$ declare f record;body text;updated text;matched int:=0;begin
 for f in select p.oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prosrc like '%corroborated:=observed>=8%' and p.prosrc like '%wakppu_input_guard%' loop
  body:=pg_get_functiondef(f.oid);updated:=body;
  if position('multi-position-v2' in body)=0 then
   updated:=replace(updated,'g.tokens:=least(80,g.tokens+greatest(0,extract(epoch from instant-g.token_at))*40);',
    '-- multi-position-v2: a soft cap is not an account suspension.
  g.tokens:=least(case when g.speed_limited_until>instant and not staff then 24 else 80 end,g.tokens+greatest(0,extract(epoch from instant-g.token_at))*case when g.speed_limited_until>instant and not staff then 12 else 40 end);');
   updated:=replace(updated,'set score=0,streak=0,last_report=null','set speed_limited_until=null,score=0,streak=0,last_report=null');
   updated:=replace(updated,'if g.last_session is distinct from',
    'if ((m->>''overspeed'')::boolean or (m->>''cyclic'')::boolean) and corroborated and not staff then g.speed_limited_until:=instant+interval ''30 seconds'';end if;
 if g.last_session is distinct from');
   updated:=replace(updated,'last_end=end_t,score=g.score,streak=g.streak','last_end=end_t,score=g.score,streak=g.streak,speed_limited_until=g.speed_limited_until');
   updated:=replace(updated,'if jsonb_array_length(m->''reasons'')>0 or g.score>0 then',
    'm:=m||jsonb_build_object(''speed_limited_until'',case when g.speed_limited_until>instant then g.speed_limited_until else null end);
 if jsonb_array_length(m->''reasons'')>0 or g.score>0 then');
   updated:=replace(updated,'''restricted_until'',until_at))','''restricted_until'',until_at,''speed_limited_until'',case when g.speed_limited_until>instant then g.speed_limited_until else null end))');
   if updated=body or position('multi-position-v2' in updated)=0 or position('speed_limited_until=g.speed_limited_until' in updated)=0 then raise exception 'Unexpected input-guard wrapper; refusing partial patch';end if;
   execute updated;
  end if;matched:=matched+1;
 end loop;
 if matched<>1 then raise exception 'Expected exactly one input-guard wrapper, found %',matched;end if;
end $patch$;
commit;
