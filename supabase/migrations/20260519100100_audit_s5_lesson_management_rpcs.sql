-- ─── S5: RPC вместо прямых DELETE/UPDATE schedule ────────────────────────────
-- Раньше AdminSchedule.handleDeleteEvent/handleSeriesChoice делали прямой
-- supabase.from('schedule').delete() — FK каскадом чистил attendance/bookings/
-- lesson_payments, но визиты НЕ возвращались и зарплата НЕ отзывалась.
-- AttendancePanel.handleReschedule/handleChangeTeacher — прямой update без
-- advisory_lock на зал и без отката зарплаты при смене препода.

-- Хелпер: возврат визитов + удаление зарплаты для одного занятия.
-- Используется в delete_lesson и delete_lesson_series. Только для service_role
-- (вызывается внутри других SECURITY DEFINER RPC).
create or replace function public._refund_visits_for_lesson(p_schedule_id uuid)
returns json
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_att              record;
  v_iatt             record;
  v_refunded_visits  int := 0;
  v_refunded_indiv   int := 0;
  v_removed_payments int := 0;
begin
  for v_att in
    select a.id as attendance_id, a.subscription_id, s.visits_total
      from attendance a
      left join subscriptions s on s.id = a.subscription_id
     where a.schedule_id = p_schedule_id
       and a.status = 'present'
       and a.subscription_id is not null
       and s.visits_total is not null
     for update of a
  loop
    update subscriptions
       set visits_used = greatest(0, coalesce(visits_used, 0) - 1)
     where id = v_att.subscription_id;
    v_refunded_visits := v_refunded_visits + 1;
  end loop;

  for v_iatt in
    select a.id as attendance_id, a.indiv_subscription_id, i.visits_total
      from attendance a
      left join indiv_subscriptions i on i.id = a.indiv_subscription_id
     where a.schedule_id = p_schedule_id
       and a.status = 'present'
       and a.indiv_subscription_id is not null
       and i.visits_total is not null
     for update of a
  loop
    update indiv_subscriptions
       set visits_used = greatest(0, coalesce(visits_used, 0) - 1)
     where id = v_iatt.indiv_subscription_id;
    v_refunded_indiv := v_refunded_indiv + 1;
  end loop;

  delete from lesson_payments where schedule_id = p_schedule_id;
  get diagnostics v_removed_payments = row_count;

  return json_build_object(
    'refunded_visits',       v_refunded_visits,
    'refunded_indiv_visits', v_refunded_indiv,
    'removed_payments',      v_removed_payments
  );
end;
$function$;

revoke all on function public._refund_visits_for_lesson(uuid) from public, anon, authenticated;
grant  execute on function public._refund_visits_for_lesson(uuid) to service_role;


-- 1. delete_lesson — полное удаление одного занятия с возвратом визитов/зарплат.
create or replace function public.delete_lesson(p_schedule_id uuid)
returns json
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_admin_id   uuid := auth.uid();
  v_admin_role text;
  v_lesson     schedule%rowtype;
  v_refund     json;
begin
  if v_admin_id is null then return json_build_object('ok', false, 'error', 'not_authenticated'); end if;
  select role into v_admin_role from profiles where id = v_admin_id;
  if v_admin_role is null or v_admin_role not in ('admin','manager','owner') then
    return json_build_object('ok', false, 'error', 'forbidden');
  end if;

  select * into v_lesson from schedule where id = p_schedule_id for update;
  if not found then return json_build_object('ok', false, 'error', 'lesson_not_found'); end if;

  v_refund := public._refund_visits_for_lesson(p_schedule_id);

  insert into schedule_history (schedule_id, action, author_id, changes, comment)
  values (p_schedule_id, 'deleted', v_admin_id, v_refund,
          'Занятие удалено. Возвращено визитов: ' ||
          ((v_refund->>'refunded_visits')::int + (v_refund->>'refunded_indiv_visits')::int));

  delete from schedule where id = p_schedule_id;

  return json_build_object('ok', true, 'lesson_id', p_schedule_id,
    'refunded_visits',       (v_refund->>'refunded_visits')::int,
    'refunded_indiv_visits', (v_refund->>'refunded_indiv_visits')::int,
    'removed_payments',      (v_refund->>'removed_payments')::int);
end;
$function$;

revoke all on function public.delete_lesson(uuid) from public, anon;
grant  execute on function public.delete_lesson(uuid) to authenticated;


-- 2. delete_lesson_series — удаление по repeat_id с scope='one|future|all'.
create or replace function public.delete_lesson_series(
  p_schedule_id uuid,
  p_scope       text
) returns json
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_admin_id   uuid := auth.uid();
  v_admin_role text;
  v_lesson     schedule%rowtype;
  v_ids        uuid[];
  v_id         uuid;
  v_total_visits int := 0;
  v_total_indiv  int := 0;
  v_total_payments int := 0;
  v_refund     json;
  v_count      int := 0;
begin
  if v_admin_id is null then return json_build_object('ok', false, 'error', 'not_authenticated'); end if;
  select role into v_admin_role from profiles where id = v_admin_id;
  if v_admin_role is null or v_admin_role not in ('admin','manager','owner') then
    return json_build_object('ok', false, 'error', 'forbidden');
  end if;
  if p_scope not in ('one','future','all') then
    return json_build_object('ok', false, 'error', 'invalid_scope');
  end if;

  select * into v_lesson from schedule where id = p_schedule_id for update;
  if not found then return json_build_object('ok', false, 'error', 'lesson_not_found'); end if;

  if p_scope = 'one' or v_lesson.repeat_id is null then
    v_ids := array[p_schedule_id];
  elsif p_scope = 'future' then
    select array_agg(id) into v_ids from schedule
      where repeat_id = v_lesson.repeat_id and starts_at >= v_lesson.starts_at;
  else
    select array_agg(id) into v_ids from schedule where repeat_id = v_lesson.repeat_id;
  end if;

  foreach v_id in array v_ids loop
    v_refund := public._refund_visits_for_lesson(v_id);
    v_total_visits   := v_total_visits   + (v_refund->>'refunded_visits')::int;
    v_total_indiv    := v_total_indiv    + (v_refund->>'refunded_indiv_visits')::int;
    v_total_payments := v_total_payments + (v_refund->>'removed_payments')::int;
    insert into schedule_history (schedule_id, action, author_id, changes, comment)
    values (v_id, 'deleted', v_admin_id, v_refund,
            'Удалено в составе серии (scope=' || p_scope || ')');
    delete from schedule where id = v_id;
    v_count := v_count + 1;
  end loop;

  return json_build_object('ok', true,
    'deleted_count',         v_count,
    'refunded_visits',       v_total_visits,
    'refunded_indiv_visits', v_total_indiv,
    'removed_payments',      v_total_payments);
end;
$function$;

revoke all on function public.delete_lesson_series(uuid, text) from public, anon;
grant  execute on function public.delete_lesson_series(uuid, text) to authenticated;


-- 3. reschedule_lesson — перенос с advisory_lock на зал + конфликт-проверка.
create or replace function public.reschedule_lesson(
  p_schedule_id   uuid,
  p_new_starts_at timestamp,  -- MSK naive
  p_new_ends_at   timestamp   -- MSK naive
) returns json
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_admin_id    uuid := auth.uid();
  v_admin_role  text;
  v_lesson      schedule%rowtype;
  v_conflict_id uuid;
begin
  if v_admin_id is null then return json_build_object('ok', false, 'error', 'not_authenticated'); end if;
  select role into v_admin_role from profiles where id = v_admin_id;
  if v_admin_role is null or v_admin_role not in ('admin','manager','owner') then
    return json_build_object('ok', false, 'error', 'forbidden');
  end if;
  if p_new_ends_at <= p_new_starts_at then
    return json_build_object('ok', false, 'error', 'invalid_time_range');
  end if;

  select * into v_lesson from schedule where id = p_schedule_id for update;
  if not found            then return json_build_object('ok', false, 'error', 'lesson_not_found'); end if;
  if v_lesson.is_cancelled then return json_build_object('ok', false, 'error', 'lesson_cancelled'); end if;

  if v_lesson.hall is not null then
    perform pg_advisory_xact_lock(hashtext('schedule_hall:' || v_lesson.hall));

    select id into v_conflict_id
      from schedule
     where hall = v_lesson.hall
       and is_cancelled = false
       and id <> p_schedule_id
       and starts_at < p_new_ends_at
       and ends_at   > p_new_starts_at
     limit 1;
    if v_conflict_id is not null then
      return json_build_object('ok', false, 'error', 'hall_conflict',
        'conflict_id', v_conflict_id, 'hall', v_lesson.hall);
    end if;
  end if;

  update schedule
     set starts_at = p_new_starts_at,
         ends_at   = p_new_ends_at
   where id = p_schedule_id;

  insert into schedule_history (schedule_id, action, author_id, changes, comment)
  values (p_schedule_id, 'rescheduled', v_admin_id,
          jsonb_build_object(
            'old_starts_at', v_lesson.starts_at,
            'old_ends_at',   v_lesson.ends_at,
            'new_starts_at', p_new_starts_at,
            'new_ends_at',   p_new_ends_at
          ),
          'Занятие перенесено');

  return json_build_object('ok', true,
    'new_starts_at', p_new_starts_at, 'new_ends_at', p_new_ends_at);
end;
$function$;

revoke all on function public.reschedule_lesson(uuid, timestamp, timestamp) from public, anon;
grant  execute on function public.reschedule_lesson(uuid, timestamp, timestamp) to authenticated;


-- 4. change_lesson_teacher — смена преподавателя у занятия + откат зарплаты.
-- (assign_substitution — это другой кейс: подмена через teacher_substitutions
-- без изменения основного teacher_id. change_lesson_teacher жёстко меняет
-- teacher_id у самого schedule, отзывая прежнюю зарплату.)
create or replace function public.change_lesson_teacher(
  p_schedule_id     uuid,
  p_new_teacher_id  uuid
) returns json
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_admin_id     uuid := auth.uid();
  v_admin_role   text;
  v_lesson       schedule%rowtype;
  v_new_role     text;
  v_is_teacher   bool;
  v_removed_pay  int := 0;
begin
  if v_admin_id is null then return json_build_object('ok', false, 'error', 'not_authenticated'); end if;
  select role into v_admin_role from profiles where id = v_admin_id;
  if v_admin_role is null or v_admin_role not in ('admin','manager','owner') then
    return json_build_object('ok', false, 'error', 'forbidden');
  end if;

  select * into v_lesson from schedule where id = p_schedule_id for update;
  if not found            then return json_build_object('ok', false, 'error', 'lesson_not_found'); end if;
  if v_lesson.is_cancelled then return json_build_object('ok', false, 'error', 'lesson_cancelled'); end if;
  if v_lesson.teacher_id = p_new_teacher_id then
    return json_build_object('ok', false, 'error', 'same_teacher');
  end if;

  select role into v_new_role from profiles where id = p_new_teacher_id;
  if v_new_role is null then
    return json_build_object('ok', false, 'error', 'teacher_not_found');
  end if;
  v_is_teacher := v_new_role = 'teacher'
    or exists (select 1 from staff_roles where staff_id = p_new_teacher_id and role = 'teacher');
  if not v_is_teacher then
    return json_build_object('ok', false, 'error', 'not_a_teacher');
  end if;

  delete from lesson_payments where schedule_id = p_schedule_id;
  get diagnostics v_removed_pay = row_count;

  update schedule
     set teacher_id = p_new_teacher_id
   where id = p_schedule_id;

  insert into schedule_history (schedule_id, action, author_id, changes, comment)
  values (p_schedule_id, 'teacher_changed', v_admin_id,
          jsonb_build_object(
            'old_teacher_id', v_lesson.teacher_id,
            'new_teacher_id', p_new_teacher_id,
            'removed_payments', v_removed_pay
          ),
          'Преподаватель заменён' ||
          case when v_removed_pay > 0 then ', зарплата отозвана' else '' end);

  return json_build_object('ok', true,
    'old_teacher_id', v_lesson.teacher_id,
    'new_teacher_id', p_new_teacher_id,
    'removed_payments', v_removed_pay);
end;
$function$;

revoke all on function public.change_lesson_teacher(uuid, uuid) from public, anon;
grant  execute on function public.change_lesson_teacher(uuid, uuid) to authenticated;
