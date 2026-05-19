-- ─── P2 Партия H: бизнес-логика для bookings ───────────────────────────────
-- S16: блок is_closed-групп
-- S17: возрастная валидация по groups.age_min/age_max + profiles.birth_date
-- S18: pg_cron — auto-cancel pending индив-заявок старше 48 часов

-- ============================================================================
-- 1. S17 — добавляем age_min/age_max в groups
-- ============================================================================
alter table public.groups add column if not exists age_min int;
alter table public.groups add column if not exists age_max int;

-- ============================================================================
-- 2. S16+S17 — триггер prevent_invalid_booking BEFORE INSERT on bookings
-- ============================================================================
create or replace function public.prevent_invalid_booking()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_role        text;
  v_grp         record;
  v_bd          date;
  v_age_years   int;
  v_today_msk   date := (current_timestamp at time zone 'Europe/Moscow')::date;
begin
  -- Изнутри SECURITY DEFINER RPC current_user = postgres → пропускаем.
  if current_user <> 'authenticated' then
    return NEW;
  end if;

  if auth.uid() is null then
    return NEW;
  end if;

  -- Админ может вписать кого угодно — пропускаем (выбор в AttendancePanel).
  select role into v_role from profiles where id = auth.uid();
  if v_role in ('admin','manager','owner') then
    return NEW;
  end if;

  -- Только групповые занятия (group_id IS NOT NULL) проверяются на is_closed
  -- и возраст. Индив/event пропускаются.
  select g.is_closed, g.age_min, g.age_max
    into v_grp
    from schedule s
    left join groups g on g.id = s.group_id
   where s.id = NEW.schedule_id;

  if v_grp.is_closed = true then
    raise exception 'group_closed'
      using hint = 'В эту группу клиентская запись закрыта. Обратись к администратору.';
  end if;

  if v_grp.age_min is not null or v_grp.age_max is not null then
    select birth_date into v_bd from profiles where id = NEW.student_id;
    if v_bd is not null then
      v_age_years := extract(year from age(v_today_msk, v_bd))::int;
      if v_grp.age_min is not null and v_age_years < v_grp.age_min then
        raise exception 'age_below_min'
          using hint = 'Эта группа для возраста от ' || v_grp.age_min || ' лет.';
      end if;
      if v_grp.age_max is not null and v_age_years > v_grp.age_max then
        raise exception 'age_above_max'
          using hint = 'Эта группа для возраста до ' || v_grp.age_max || ' лет.';
      end if;
    end if;
  end if;

  return NEW;
end;
$function$;

drop trigger if exists prevent_invalid_booking on public.bookings;
create trigger prevent_invalid_booking
  before insert on public.bookings
  for each row
  execute function public.prevent_invalid_booking();


-- ============================================================================
-- 3. S18 — process_stale_indiv_requests + pg_cron hourly
-- ============================================================================
create or replace function public.process_stale_indiv_requests()
returns int
language plpgsql
security definer
set search_path to public
as $function$
declare
  v_count int;
begin
  if not pg_try_advisory_lock(hashtext('process_stale_indiv_requests')) then
    raise notice 'process_stale_indiv_requests: previous run still in progress, skip';
    return 0;
  end if;

  update public.indiv_requests
     set status        = 'cancelled',
         reject_reason = coalesce(reject_reason, 'Истекла без подтверждения (48ч)')
   where status      = 'pending'
     and created_at  < now() - interval '48 hours';
  get diagnostics v_count = row_count;

  perform pg_advisory_unlock(hashtext('process_stale_indiv_requests'));
  return v_count;
end;
$function$;

revoke all on function public.process_stale_indiv_requests() from anon, public, authenticated;


-- Регистрируем cron idempotently — раз в час, в 15-ю минуту.
do $$
declare v_jobid bigint;
begin
  select jobid into v_jobid from cron.job where jobname = 'cleanup-stale-indiv-requests-hourly';
  if v_jobid is not null then
    perform cron.unschedule(v_jobid);
  end if;
  perform cron.schedule(
    'cleanup-stale-indiv-requests-hourly',
    '15 * * * *',
    $cron$ select public.process_stale_indiv_requests() $cron$
  );
end$$;
