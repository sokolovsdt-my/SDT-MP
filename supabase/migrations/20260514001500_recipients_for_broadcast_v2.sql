-- Расширение RPC recipients_for_broadcast под новые фильтры:
--   • product_ids[]                — массив (раньше только один product_id)
--   • group_ids[]                  — уже было
--   • loyalty_levels[]             — поддержка 'none' для клиентов БЕЗ записи в client_loyalty
--   • push_filter                  — 'with_push' / 'without_push'
--   • registered_days              — зарегистрировались за последние N дней
--   • birthday_days                — день рождения в ближайшие N дней (с поправкой 29 февраля → 28 февраля в невисокосный год)
--   • exclude_received_days        — исключить получавших ЛЮБУЮ рассылку за N дней
--                                    (по факту попадания в broadcast_recipients, не по delivery)

create or replace function public.recipients_for_broadcast(p_filters jsonb default '{}'::jsonb)
returns table (
  id         uuid,
  full_name  text,
  email      text,
  phone      text,
  push_token text
)
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_uid  uuid := auth.uid();
  v_role text;

  v_product_ids         uuid[]  := case when jsonb_typeof(p_filters->'product_ids')='array'
                                        then array(select jsonb_array_elements_text(p_filters->'product_ids'))::uuid[]
                                        else null end;
  v_purchase_from       date    := nullif(p_filters->>'purchase_from','')::date;
  v_purchase_to         date    := nullif(p_filters->>'purchase_to','')::date;
  v_no_active_sub       boolean := coalesce((p_filters->>'no_active_sub')::boolean, false);
  v_group_ids           uuid[]  := case when jsonb_typeof(p_filters->'group_ids')='array'
                                        then array(select jsonb_array_elements_text(p_filters->'group_ids'))::uuid[]
                                        else null end;
  v_sub_status          text    := nullif(p_filters->>'subscription_status','');
  v_ltv_min             numeric := nullif(p_filters->>'ltv_min','')::numeric;
  v_ltv_max             numeric := nullif(p_filters->>'ltv_max','')::numeric;
  v_age_min             int     := nullif(p_filters->>'age_min','')::int;
  v_age_max             int     := nullif(p_filters->>'age_max','')::int;
  v_last_visit_days     int     := nullif(p_filters->>'last_visit_days','')::int;
  v_loyalty_levels      text[]  := case when jsonb_typeof(p_filters->'loyalty_levels')='array'
                                        then array(select jsonb_array_elements_text(p_filters->'loyalty_levels'))
                                        else null end;
  v_loyalty_no_label    boolean := v_loyalty_levels is not null and 'none' = any(v_loyalty_levels);
  v_loyalty_real        text[]  := case when v_loyalty_levels is not null
                                        then array(select unnest(v_loyalty_levels) except select 'none')
                                        else null end;
  v_push_filter         text    := nullif(p_filters->>'push_filter','');
  v_registered_days     int     := nullif(p_filters->>'registered_days','')::int;
  v_birthday_days       int     := nullif(p_filters->>'birthday_days','')::int;
  v_exclude_received_days int   := nullif(p_filters->>'exclude_received_days','')::int;

  v_today      date := (now() at time zone 'Europe/Moscow')::date;
  v_in7        date := v_today + 7;
  v_ago30      date := v_today - 30;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;
  select role into v_role from profiles where profiles.id = v_uid;
  if v_role not in ('admin','manager','owner') then
    raise exception 'forbidden' using errcode = 'P0002';
  end if;

  return query
  with base as (
    select p.id, p.full_name, p.email, p.phone, p.push_token, p.birth_date, p.created_at
      from profiles p
     where p.role = 'client'
  ),
  ltv as (
    select s.client_id, sum(coalesce(s.amount_paid, 0))::numeric as total
      from sales s
     where s.is_cancelled = false
     group by s.client_id
  ),
  product_buyers as (
    select distinct s.client_id
      from sales s
     where s.is_cancelled = false
       and (v_product_ids   is null or s.product_id = any(v_product_ids))
       and (v_purchase_from is null or s.sale_date >= ((v_purchase_from::text || ' 00:00:00+03')::timestamptz))
       and (v_purchase_to   is null or s.sale_date <= ((v_purchase_to::text   || ' 23:59:59+03')::timestamptz))
  ),
  active_subs as (
    select distinct sub.student_id
      from subscriptions sub
     where sub.is_frozen = false
       and (sub.expires_at is null or sub.expires_at >= v_today)
       and (sub.visits_total is null or coalesce(sub.visits_used,0) < sub.visits_total)
  ),
  group_subs as (
    select distinct sub.student_id
      from subscriptions sub
      join subscription_allowed_groups sag on sag.subscription_id = sub.id
     where sag.group_id = any(v_group_ids)
       and sub.is_frozen = false
       and (sub.expires_at is null or sub.expires_at >= v_today)
  ),
  status_subs as (
    select distinct sub.student_id
      from subscriptions sub
     where case v_sub_status
             when 'active'   then sub.expires_at >= v_today
             when 'expiring' then sub.expires_at >= v_today and sub.expires_at <= v_in7
             when 'expired'  then sub.expires_at <  v_today and sub.expires_at >= v_ago30
             else true
           end
  ),
  recent_visits as (
    select distinct a.student_id
      from attendance a
     where v_last_visit_days is not null
       and a.status = 'present'
       and a.marked_at >= now() - make_interval(days => v_last_visit_days)
  ),
  loyalty_clients as (
    -- Объединение: либо клиент имеет одну из реальных меток, либо помечен 'none'
    -- (т.е. в client_loyalty его нет вовсе).
    select cl.client_id
      from client_loyalty cl
     where v_loyalty_real is not null
       and array_length(v_loyalty_real, 1) > 0
       and cl.level = any(v_loyalty_real)
    union
    select b.id as client_id
      from base b
     where v_loyalty_no_label
       and not exists (select 1 from client_loyalty cl2 where cl2.client_id = b.id)
  ),
  -- Именинники в ближайшие N дней. Сравниваем по (месяц, день), игнорируя год.
  -- Edge case: 29 февраля. Если N=0..1 в невисокосный год — пользователи с 29 февраля
  -- технически «совпадают» с 28 февраля → включаем их если cutoff покрывает 28.
  birthday_clients as (
    select b.id as client_id
      from base b
     where v_birthday_days is not null
       and b.birth_date is not null
       and exists (
         select 1
           from generate_series(0, v_birthday_days) as d(offset_days)
          where to_char(v_today + d.offset_days, 'MM-DD') = to_char(b.birth_date, 'MM-DD')
             -- в невисокосный год 29 февраля поздравляем 28-го
             or (to_char(b.birth_date, 'MM-DD') = '02-29'
                 and to_char(v_today + d.offset_days, 'MM-DD') = '02-28'
                 and not (extract(year from v_today + d.offset_days)::int % 4 = 0
                          and (extract(year from v_today + d.offset_days)::int % 100 <> 0
                               or extract(year from v_today + d.offset_days)::int % 400 = 0)))
       )
  ),
  -- Получали ЛЮБУЮ рассылку (попали в broadcast_recipients) за последние N дней.
  recently_messaged as (
    select distinct br.client_id
      from broadcast_recipients br
      join broadcasts b on b.id = br.broadcast_id
     where v_exclude_received_days is not null
       and (b.sent_at >= now() - make_interval(days => v_exclude_received_days)
            or br.created_at >= now() - make_interval(days => v_exclude_received_days))
  )
  select b.id, b.full_name, b.email, b.phone, b.push_token
    from base b
   where (v_age_min is null or
          (b.birth_date is not null
           and (extract(year from age(b.birth_date::timestamp))::int) >= v_age_min))
     and (v_age_max is null or
          (b.birth_date is not null
           and (extract(year from age(b.birth_date::timestamp))::int) <= v_age_max))
     and (v_product_ids is null and v_purchase_from is null and v_purchase_to is null
          or b.id in (select client_id from product_buyers))
     and (v_no_active_sub = false
          or b.id not in (select student_id from active_subs))
     and (v_group_ids is null
          or b.id in (select student_id from group_subs))
     and (v_sub_status is null
          or b.id in (select student_id from status_subs))
     and (v_ltv_min is null
          or coalesce((select total from ltv where ltv.client_id = b.id), 0) >= v_ltv_min)
     and (v_ltv_max is null
          or coalesce((select total from ltv where ltv.client_id = b.id), 0) <= v_ltv_max)
     and (v_last_visit_days is null
          or b.id not in (select student_id from recent_visits))
     and (v_loyalty_levels is null
          or b.id in (select client_id from loyalty_clients))
     and (v_push_filter is null
          or (v_push_filter = 'with_push'    and b.push_token is not null)
          or (v_push_filter = 'without_push' and b.push_token is null))
     and (v_registered_days is null
          or b.created_at >= now() - make_interval(days => v_registered_days))
     and (v_birthday_days is null
          or b.id in (select client_id from birthday_clients))
     and (v_exclude_received_days is null
          or b.id not in (select client_id from recently_messaged))
   order by b.full_name nulls last;
end;
$$;

revoke all on function public.recipients_for_broadcast(jsonb) from anon, public;
grant execute on function public.recipients_for_broadcast(jsonb) to authenticated;
