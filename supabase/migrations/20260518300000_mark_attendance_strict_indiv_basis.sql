-- Раньше для lesson_type='indiv' basis всегда ставился 'indiv' независимо от
-- наличия пакета: гард no_valid_basis не срабатывал, и админ/препод мог
-- отметить «Пришёл» без оплаты — визиты не списывались, ученик ходил вечно.
-- Теперь: если у клиента нет активного indiv_subscriptions (ни через
-- indiv_requests.subscription_id, ни через fallback-подбор) — basis='none',
-- и present отбивается уже существующим гардом no_valid_basis.
create or replace function public.mark_attendance(
  p_schedule_id  uuid,
  p_student_id   uuid,
  p_new_status   text,
  p_mark_as_trial boolean default false
) returns json
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_user_id       uuid := auth.uid();
  v_user_role     text;
  v_lesson        schedule%rowtype;
  v_substitute    uuid;
  v_att           attendance%rowtype;
  v_old_status    text;
  v_basis         text;
  v_sub_id        uuid;
  v_sub           subscriptions%rowtype;
  v_isub_id       uuid;
  v_isub          indiv_subscriptions%rowtype;
  v_today         date := (current_timestamp at time zone 'Europe/Moscow')::date;
  v_attendance_id uuid;
  v_visits_new    int;
  v_indiv_visits_new int;
  v_delta         int := 0;
  v_indiv_delta   int := 0;
begin
  if v_user_id is null then
    return json_build_object('ok', false, 'error', 'not_authenticated');
  end if;

  select role into v_user_role from profiles where id = v_user_id;
  if v_user_role is null or v_user_role not in ('admin','manager','owner','teacher') then
    return json_build_object('ok', false, 'error', 'forbidden');
  end if;

  if p_new_status not in ('present','absent','cancelled','transferred') then
    return json_build_object('ok', false, 'error', 'invalid_status');
  end if;

  select * into v_lesson from schedule where id = p_schedule_id for update;
  if not found then
    return json_build_object('ok', false, 'error', 'lesson_not_found');
  end if;
  if v_lesson.is_cancelled then
    return json_build_object('ok', false, 'error', 'lesson_cancelled');
  end if;

  if v_user_role = 'teacher' then
    select substitute_teacher_id into v_substitute
      from teacher_substitutions where schedule_id = p_schedule_id;
    if v_lesson.teacher_id <> v_user_id and (v_substitute is null or v_substitute <> v_user_id) then
      return json_build_object('ok', false, 'error', 'not_your_lesson');
    end if;
  end if;

  select * into v_att
    from attendance
   where schedule_id = p_schedule_id and student_id = p_student_id
     for update;
  v_old_status := v_att.status;

  if v_old_status is not null and v_old_status = p_new_status then
    return json_build_object('ok', true, 'unchanged', true,
                              'attendance_id', v_att.id, 'status', v_old_status,
                              'basis', v_att.basis, 'subscription_id', v_att.subscription_id,
                              'indiv_subscription_id', v_att.indiv_subscription_id);
  end if;

  -- ─── Определяем basis / subscription_id / indiv_subscription_id ──────────
  if p_mark_as_trial then
    v_basis  := 'trial';
    v_sub_id := null;
    v_isub_id := null;

  elsif v_att.id is not null and v_att.basis is not null and v_att.basis <> 'none' then
    v_basis   := v_att.basis;
    v_sub_id  := v_att.subscription_id;
    v_isub_id := v_att.indiv_subscription_id;
    if v_sub_id is not null then
      select * into v_sub from subscriptions where id = v_sub_id for update;
    end if;
    if v_isub_id is not null then
      select * into v_isub from indiv_subscriptions where id = v_isub_id for update;
    end if;

  elsif v_lesson.lesson_type = 'indiv' then
    -- Точный пакет, привязанный при подтверждении заявки:
    select subscription_id into v_isub_id
      from indiv_requests
     where schedule_id = p_schedule_id
       and subscription_id is not null
     limit 1;
    -- Fallback: свежий активный пакет клиента у этого препода
    if v_isub_id is null then
      select id into v_isub_id
        from indiv_subscriptions
       where client_id  = p_student_id
         and teacher_id = v_lesson.teacher_id
         and coalesce(is_frozen, false) = false
         and (expires_at  is null or expires_at  >= v_today)
         and (visits_total is null or coalesce(visits_used, 0) < visits_total)
       order by (expires_at is null) desc, expires_at desc nulls last, created_at desc
       limit 1;
    end if;
    if v_isub_id is not null then
      select * into v_isub from indiv_subscriptions where id = v_isub_id for update;
      v_basis := 'indiv';
    else
      -- Нет пакета → basis='none'; гард no_valid_basis ниже отобьёт present.
      v_basis := 'none';
    end if;
    v_sub_id := null;

  elsif v_lesson.lesson_type = 'event' and v_lesson.event_id is not null then
    if exists (
      select 1 from event_registrations
       where event_id  = v_lesson.event_id
         and client_id = p_student_id
         and status is distinct from 'cancelled'
    ) then
      v_basis  := 'event';
    else
      v_basis  := 'none';
    end if;
    v_sub_id := null;
    v_isub_id := null;

  else
    select * into v_sub
      from subscriptions s
     where s.student_id = p_student_id
       and s.is_frozen  = false
       and (s.expires_at  is null or s.expires_at >= v_today)
       and (s.visits_total is null or coalesce(s.visits_used, 0) < s.visits_total)
       and (
         not exists (select 1 from subscription_allowed_groups sag
                      where sag.subscription_id = s.id)
         or exists (select 1 from subscription_allowed_groups sag
                     where sag.subscription_id = s.id
                       and sag.group_id = v_lesson.group_id)
       )
     order by (s.expires_at is null) desc, s.expires_at asc nulls last
     limit 1
     for update;

    if found then
      v_basis  := case when v_sub.visits_total is null then 'subscription'
                       when v_sub.visits_total = 1   then 'single'
                       else 'subscription' end;
      v_sub_id := v_sub.id;
    else
      v_basis  := 'none';
      v_sub_id := null;
    end if;
    v_isub_id := null;
  end if;

  -- Единый гард: present без основания запрещён для ЛЮБОГО типа урока.
  if p_new_status = 'present' and v_basis = 'none' then
    return json_build_object('ok', false, 'error', 'no_valid_basis',
                              'student_id',  p_student_id,
                              'lesson_type', v_lesson.lesson_type);
  end if;

  if v_sub_id is not null and v_sub.visits_total is not null then
    if p_new_status = 'present' and (v_old_status is null or v_old_status <> 'present') then
      v_delta := 1;
    elsif v_old_status = 'present' and p_new_status <> 'present' then
      v_delta := -1;
    end if;
    if v_delta = 1 and coalesce(v_sub.visits_used, 0) >= v_sub.visits_total then
      return json_build_object('ok', false, 'error', 'out_of_visits',
                                'visits_used',  v_sub.visits_used,
                                'visits_total', v_sub.visits_total);
    end if;
  end if;

  if v_isub_id is not null and v_isub.visits_total is not null then
    if p_new_status = 'present' and (v_old_status is null or v_old_status <> 'present') then
      v_indiv_delta := 1;
    elsif v_old_status = 'present' and p_new_status <> 'present' then
      v_indiv_delta := -1;
    end if;
    if v_indiv_delta = 1 and coalesce(v_isub.visits_used, 0) >= v_isub.visits_total then
      return json_build_object('ok', false, 'error', 'indiv_out_of_visits',
                                'visits_used',  v_isub.visits_used,
                                'visits_total', v_isub.visits_total);
    end if;
  end if;

  insert into attendance (schedule_id, student_id, status, basis,
                          subscription_id, indiv_subscription_id,
                          marked_by, marked_at, teacher_id)
       values (p_schedule_id, p_student_id, p_new_status, v_basis,
               v_sub_id, v_isub_id,
               v_user_id, now(), v_lesson.teacher_id)
  on conflict (schedule_id, student_id) do update
       set status                = excluded.status,
           basis                 = excluded.basis,
           subscription_id       = excluded.subscription_id,
           indiv_subscription_id = excluded.indiv_subscription_id,
           marked_by             = excluded.marked_by,
           marked_at             = now(),
           teacher_id            = coalesce(attendance.teacher_id, excluded.teacher_id)
       returning id into v_attendance_id;

  if v_delta <> 0 then
    update subscriptions
       set visits_used = greatest(0, coalesce(visits_used, 0) + v_delta)
     where id = v_sub_id
     returning visits_used into v_visits_new;
  else
    v_visits_new := case when v_sub_id is not null then v_sub.visits_used else null end;
  end if;

  if v_indiv_delta <> 0 then
    update indiv_subscriptions
       set visits_used = greatest(0, coalesce(visits_used, 0) + v_indiv_delta)
     where id = v_isub_id
     returning visits_used into v_indiv_visits_new;
  else
    v_indiv_visits_new := case when v_isub_id is not null then v_isub.visits_used else null end;
  end if;

  return json_build_object(
    'ok',                    true,
    'attendance_id',         v_attendance_id,
    'status',                p_new_status,
    'basis',                 v_basis,
    'subscription_id',       v_sub_id,
    'indiv_subscription_id', v_isub_id,
    'visits_used',           v_visits_new,
    'visits_total',          case when v_sub_id is not null then v_sub.visits_total else null end,
    'indiv_visits_used',     v_indiv_visits_new,
    'indiv_visits_total',    case when v_isub_id is not null then v_isub.visits_total else null end,
    'delta',                 v_delta,
    'indiv_delta',           v_indiv_delta
  );
end;
$function$;
