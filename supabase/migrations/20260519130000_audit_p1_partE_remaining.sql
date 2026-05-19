-- ─── P1 Партия E: остаток высокого приоритета ──────────────────────────────
-- 1. teacher_stats RPC — переносим N+1 счёт attendance из TeacherPanel в БД.
-- 2. staff_whitelist таблица + триггер — единый источник правды по сотрудникам;
--    серверный гард что staff не может войти через magic-link без пароля.
-- 3. task_overdue_notifications таблица + RPC + pg_cron — эскалация просроченных
--    задач: cron раз в час дёргает edge, edge шлёт FCM ответственным.

-- ============================================================================
-- 1. RPC teacher_stats — агрегация в БД
-- ============================================================================
-- TeacherPanel сейчас тянет всю историю attendance препода + bookings всех
-- групп для расчёта uniqueStudents/thisMonth/birthdays. На препе с 3+ годами
-- работы это десятки тысяч строк через клиент. Переносим в RPC с агрегацией.

create or replace function public.teacher_stats(p_month_start date default null)
returns json
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_uid          uuid := auth.uid();
  v_role         text;
  v_month_start  date;
  v_lessons      int;
  v_students     int;
  v_this_month   int;
begin
  if v_uid is null then return json_build_object('ok', false, 'error', 'not_authenticated'); end if;
  select role into v_role from profiles where id = v_uid;
  -- Учитель сам смотрит свои; admin/manager/owner могут смотреть статистику
  -- любого препода через тот же RPC (если потом добавим p_teacher_id).
  if v_role is null or v_role not in ('teacher','admin','manager','owner') then
    return json_build_object('ok', false, 'error', 'forbidden');
  end if;

  v_month_start := coalesce(p_month_start, date_trunc('month', current_date)::date);

  select count(*),
         count(distinct student_id),
         count(*) filter (where created_at >= v_month_start::timestamp)
    into v_lessons, v_students, v_this_month
    from attendance
   where teacher_id = v_uid
     and status = 'present';

  return json_build_object(
    'ok',           true,
    'lessons',      coalesce(v_lessons, 0),
    'students',     coalesce(v_students, 0),
    'this_month',   coalesce(v_this_month, 0),
    'month_start',  v_month_start
  );
end;
$function$;

revoke all on function public.teacher_stats(date) from public, anon;
grant  execute on function public.teacher_stats(date) to authenticated;


-- ============================================================================
-- 2. staff_whitelist — таблица + триггер на profiles
-- ============================================================================
-- Заменяем хардкод STAFF в App.jsx на серверную таблицу. Триггер на profiles
-- проверяет: если email в whitelist и у auth.users.encrypted_password нет —
-- значит пытались войти через magic-link → raise. UI App.jsx тоже читает
-- эту таблицу для блокировки magic-link до отправки OTP.
--
-- ВАЖНО: для полной защиты нужен Supabase Before-User-Created auth hook
-- (настраивается в Dashboard). Триггер на profiles работает только если
-- flow INSERT'ит в profiles после auth.users (наш текущий случай через
-- handle_new_user trigger). Если бы auth.users создавалась без profiles —
-- блокировки не было бы. TODO в CLAUDE.md.

create table if not exists public.staff_whitelist (
  email      text primary key,
  added_at   timestamptz default now(),
  added_by   uuid references public.profiles(id),
  comment    text
);

alter table public.staff_whitelist enable row level security;

drop policy if exists "staff_whitelist read by staff" on public.staff_whitelist;
create policy "staff_whitelist read by staff"
  on public.staff_whitelist
  for select
  using (true);  -- читать может любой authenticated (используется в Login UI)

drop policy if exists "staff_whitelist write by manager" on public.staff_whitelist;
create policy "staff_whitelist write by manager"
  on public.staff_whitelist
  for all
  using (exists (select 1 from profiles where id = auth.uid() and role in ('manager','owner')))
  with check (exists (select 1 from profiles where id = auth.uid() and role in ('manager','owner')));

grant select on public.staff_whitelist to authenticated, anon;

-- Сидируем существующих staff из App.jsx — те же два email-а, и docks email-ы
-- сотрудников с активной ролью staff (admin/manager/owner/teacher).
insert into public.staff_whitelist (email, comment)
values
  ('sokolov-ruslan2014@ya.ru', 'Перенесено из App.jsx STAFF массива'),
  ('syuziedancer@mail.ru',     'Перенесено из App.jsx STAFF массива')
on conflict (email) do nothing;

-- Добавляем все живые staff из profiles, чтобы whitelist был в реальности
-- полный. Если в БД есть лишние — admin может их подчистить через таблицу.
insert into public.staff_whitelist (email, comment)
  select p.email, 'Авто-импорт из profiles ' || p.role
    from profiles p
   where p.email is not null
     and p.role in ('admin','manager','owner','teacher')
     and not exists (select 1 from staff_whitelist sw where sw.email = p.email)
on conflict (email) do nothing;


-- Триггер на profiles: блокирует создание профиля сотрудника без пароля.
create or replace function public.check_staff_email_has_password()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_is_staff     bool;
  v_has_password bool;
begin
  if NEW.email is null then return NEW; end if;

  select exists (
    select 1 from public.staff_whitelist where lower(email) = lower(NEW.email)
  ) into v_is_staff;
  if not v_is_staff then return NEW; end if;

  -- email в whitelist → должен иметь пароль в auth.users.
  select coalesce(encrypted_password, '') <> '' into v_has_password
    from auth.users where id = NEW.id;

  if not v_has_password then
    raise exception 'staff_email_requires_password'
      using hint = 'Этот email в списке сотрудников — войдите по паролю, а не через magic-link.';
  end if;

  return NEW;
end;
$function$;

drop trigger if exists profiles_staff_password_check on public.profiles;
create trigger profiles_staff_password_check
  before insert on public.profiles
  for each row
  execute function public.check_staff_email_has_password();


-- ============================================================================
-- 3. task_overdue_notifications — anti-spam для эскалаций
-- ============================================================================
-- UNIQUE(task_id, assignee_id, run_date) — каждому ответственному не больше
-- одного пуша в день про конкретную просроченную задачу. После «дозамачивания»
-- задачи (закрытия или продления deadline) запись остаётся в истории.

create table if not exists public.task_overdue_notifications (
  id            uuid primary key default gen_random_uuid(),
  task_id       uuid not null references public.tasks(id) on delete cascade,
  assignee_id   uuid not null references public.profiles(id) on delete cascade,
  run_date      date not null,
  sent_at       timestamptz default now(),
  channels_sent text,
  error         text,
  unique (task_id, assignee_id, run_date)
);

alter table public.task_overdue_notifications enable row level security;

drop policy if exists "task_overdue_notifications read by staff" on public.task_overdue_notifications;
create policy "task_overdue_notifications read by staff"
  on public.task_overdue_notifications
  for select
  using (exists (select 1 from profiles where id = auth.uid() and role in ('admin','manager','owner')));

revoke all on public.task_overdue_notifications from public, anon, authenticated;
grant select on public.task_overdue_notifications to authenticated;
-- INSERT/UPDATE — только service_role (edge function).

create index if not exists idx_task_overdue_run_date on public.task_overdue_notifications (run_date desc);


-- ============================================================================
-- 4. pg_cron job → notify-overdue-tasks edge
-- ============================================================================
-- Аналог auto-birthday-daily. Раз в час дёргает edge с cron-secret из vault.
-- Edge сама ищет просроченные задачи (deadline < МСК now), читает push_token
-- из profiles, делает INSERT в task_overdue_notifications ON CONFLICT
-- DO NOTHING (anti-spam) и шлёт FCM.

create or replace function public.process_overdue_tasks()
returns int
language plpgsql
security definer
set search_path to public, extensions
as $function$
declare
  v_key text;
  v_url text := 'https://momqnoeogfjjexwcwlpu.supabase.co/functions/v1/notify-overdue-tasks';
begin
  if not pg_try_advisory_lock(hashtext('process_overdue_tasks')) then
    raise notice 'process_overdue_tasks: previous run still in progress, skip';
    return 0;
  end if;

  v_key := public._get_secret('service_role_key');
  if v_key is null then
    raise warning 'service_role_key не настроен в vault — overdue notifications не отправляются.';
    perform pg_advisory_unlock(hashtext('process_overdue_tasks'));
    return 0;
  end if;

  perform net.http_post(
    url     := v_url,
    body    := jsonb_build_object('source', 'pg_cron'),
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || v_key
    )
  );

  perform pg_advisory_unlock(hashtext('process_overdue_tasks'));
  return 1;
end;
$function$;

revoke all on function public.process_overdue_tasks() from anon, public, authenticated;

-- Регистрируем cron idempotently — раз в час.
do $$
declare v_jobid bigint;
begin
  select jobid into v_jobid from cron.job where jobname = 'notify-overdue-tasks-hourly';
  if v_jobid is not null then
    perform cron.unschedule(v_jobid);
  end if;
  perform cron.schedule(
    'notify-overdue-tasks-hourly',
    '0 * * * *',
    $cron$ select public.process_overdue_tasks() $cron$
  );
end$$;


-- ============================================================================
-- 5. Smoke-test
-- ============================================================================
do $$
declare
  r1 json;
begin
  r1 := public.teacher_stats(null);
  assert (r1->>'ok') = 'false' and (r1->>'error') = 'not_authenticated',
    'teacher_stats anon: ' || r1::text;
end $$;
