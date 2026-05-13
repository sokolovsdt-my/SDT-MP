-- Авторассылки: настройки (auto_broadcasts) + журнал отправок (auto_broadcast_runs).
--
-- auto_broadcast_runs нужен для anti-spam: UNIQUE(auto_id, recipient_id, run_date)
-- гарантирует что edge-функция не отправит одно и то же поздравление с ДР дважды
-- одному человеку в один день, даже если cron упал и повторился.
--
-- Settings (auto_broadcasts) хранят настройки одной строкой на каждый тип авторассылки.
-- Сейчас один тип 'birthday', в будущем легко добавить 'subscription_expiring',
-- 'days_after_signup' и т.д. без миграций — просто INSERT.

create table if not exists public.auto_broadcasts (
  id          uuid primary key default gen_random_uuid(),
  type        text not null check (type in ('birthday')),
  is_active   boolean default false,
  channel     text default 'push' check (channel in ('push','email','push+email')),
  title       text,
  content     text,
  send_time   time default '10:00',
  days_before int  default 0,
  sent_count  int  default 0,
  updated_by  uuid references public.profiles(id),
  updated_at  timestamptz default now()
);

create unique index if not exists auto_broadcasts_type_uq on public.auto_broadcasts(type);

alter table public.auto_broadcasts enable row level security;

create policy auto_broadcasts_admin_select on public.auto_broadcasts
  for select to authenticated
  using (exists (select 1 from public.profiles where id = auth.uid() and role in ('admin','manager','owner')));

create policy auto_broadcasts_admin_modify on public.auto_broadcasts
  for all to authenticated
  using      (exists (select 1 from public.profiles where id = auth.uid() and role in ('admin','manager','owner')))
  with check (exists (select 1 from public.profiles where id = auth.uid() and role in ('admin','manager','owner')));


create table if not exists public.auto_broadcast_runs (
  id            uuid primary key default gen_random_uuid(),
  auto_id       uuid not null references public.auto_broadcasts(id) on delete cascade,
  recipient_id  uuid not null references public.profiles(id) on delete cascade,
  run_date      date not null default ((now() at time zone 'Europe/Moscow')::date),
  sent_at       timestamptz default now(),
  channels_sent text,    -- 'push' / 'email' / 'push+email' / null если упало
  error         text,
  unique (auto_id, recipient_id, run_date)
);

create index if not exists auto_broadcast_runs_auto_date on public.auto_broadcast_runs(auto_id, run_date);

alter table public.auto_broadcast_runs enable row level security;

create policy auto_broadcast_runs_admin_select on public.auto_broadcast_runs
  for select to authenticated
  using (exists (select 1 from public.profiles where id = auth.uid() and role in ('admin','manager','owner')));

-- INSERT/UPDATE/DELETE — только через service_role в edge-функции (RLS by default deny).


-- Seed: одна строка для type='birthday' (выключена по дефолту, текст-плейсхолдер).
insert into public.auto_broadcasts (type, is_active, channel, title, content, send_time, days_before)
values ('birthday', false, 'push', '🎂 С днём рождения!',
        'Поздравляем вас с днём рождения! Желаем здоровья, радости и танцев. Команда SDT.',
        '10:00', 0)
on conflict (type) do nothing;
