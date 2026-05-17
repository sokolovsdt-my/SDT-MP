-- ─── Шаг 2: серверная запись клиента на индив ────────────────────────────────
-- Контекст: до сих пор клиент делал прямой insert в indiv_requests с
-- TOCTOU-проверкой дубля, без валидации слота, и писал в package_id (FK на
-- indiv_packages) id из indiv_subscriptions — нарушение FK. Сейчас:
--   1. Добавляем subscription_id (FK на indiv_subscriptions) — нормальная
--      ссылка на «какой пакет используется». package_id оставляем — он
--      хранит снапшот выбранного при записи пакета (для аналитики, на случай
--      если у клиента позже появится другой пакет).
--   2. Partial UNIQUE на (teacher_id, slot_date, start_time) для активных
--      заявок — БД-гарантия от double-booking, закрывает остаток гонок.
--   3. RPC create_indiv_request: валидирует слот, время в будущем, дубли;
--      под advisory_xact_lock; подбирает активный indiv_subscriptions.

alter table indiv_requests
  add column if not exists subscription_id uuid references indiv_subscriptions(id);

-- Partial unique: только активные (pending/confirmed) держат слот занятым.
-- Отменённые/отклонённые в индекс не попадают — позволяет позже записаться
-- снова на тот же слот.
create unique index if not exists indiv_requests_active_slot_uniq
  on indiv_requests (teacher_id, slot_date, start_time)
  where status in ('pending','confirmed');

-- Для отладки/аналитики — найти заявку клиента у препода быстро.
create index if not exists indiv_requests_client_teacher_idx
  on indiv_requests (client_id, teacher_id, status);

create or replace function public.create_indiv_request(
  p_teacher_id uuid,
  p_slot_date  date,
  p_start_time time,
  p_end_time   time
) returns json
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_uid          uuid := auth.uid();
  v_now_msk      timestamptz := current_timestamp;
  v_slot_ts      timestamptz;
  v_slot_id      uuid;
  v_existing_id  uuid;
  v_sub          indiv_subscriptions%rowtype;
  v_today        date := (current_timestamp at time zone 'Europe/Moscow')::date;
  v_request_id   uuid;
  v_has_package  bool := false;
begin
  if v_uid is null then
    return json_build_object('ok', false, 'error', 'not_authenticated');
  end if;

  if p_teacher_id is null or p_slot_date is null or p_start_time is null or p_end_time is null then
    return json_build_object('ok', false, 'error', 'invalid_params');
  end if;
  if p_end_time <= p_start_time then
    return json_build_object('ok', false, 'error', 'invalid_time_range');
  end if;

  -- Слот должен начинаться в будущем (по МСК)
  v_slot_ts := (p_slot_date::timestamp + p_start_time) at time zone 'Europe/Moscow';
  if v_slot_ts <= v_now_msk then
    return json_build_object('ok', false, 'error', 'slot_in_past');
  end if;

  -- Сериализуем все попытки записи на этот слот
  perform pg_advisory_xact_lock(
    hashtextextended(p_teacher_id::text || '|' || p_slot_date::text || '|' || p_start_time::text, 0)
  );

  -- Слот должен быть в teacher_slot_dates и активен
  select id into v_slot_id
    from teacher_slot_dates
   where teacher_id = p_teacher_id
     and date       = p_slot_date
     and start_time = p_start_time
     and end_time   = p_end_time
     and coalesce(is_active, true) = true
   limit 1;
  if not found then
    return json_build_object('ok', false, 'error', 'slot_not_found');
  end if;

  -- Кто-то уже записан на этот слот?
  select id into v_existing_id
    from indiv_requests
   where teacher_id = p_teacher_id
     and slot_date  = p_slot_date
     and start_time = p_start_time
     and status in ('pending','confirmed')
   limit 1;
  if v_existing_id is not null then
    if exists (select 1 from indiv_requests where id = v_existing_id and client_id = v_uid) then
      return json_build_object('ok', false, 'error', 'already_booked_by_you',
                                'request_id', v_existing_id);
    end if;
    return json_build_object('ok', false, 'error', 'slot_taken');
  end if;

  -- Активный пакет клиента у этого препода (если есть) — самый «свежий»
  -- среди годных. Безлимит (visits_total IS NULL) считается годным всегда.
  select * into v_sub
    from indiv_subscriptions
   where client_id  = v_uid
     and teacher_id = p_teacher_id
     and coalesce(is_frozen, false) = false
     and (expires_at is null or expires_at >= v_today)
     and (visits_total is null or coalesce(visits_used, 0) < visits_total)
   order by (expires_at is null) desc, expires_at desc nulls last, created_at desc
   limit 1;
  v_has_package := found;

  insert into indiv_requests (
    client_id, teacher_id, slot_date, start_time, end_time,
    package_id, subscription_id, status, created_by
  ) values (
    v_uid, p_teacher_id, p_slot_date, p_start_time, p_end_time,
    v_sub.package_id, v_sub.id, 'pending', v_uid
  ) returning id into v_request_id;

  return json_build_object(
    'ok',              true,
    'request_id',      v_request_id,
    'has_package',     v_has_package,
    'subscription_id', v_sub.id
  );
end;
$function$;

revoke all on function public.create_indiv_request(uuid, date, time, time) from public, anon;
grant execute on function public.create_indiv_request(uuid, date, time, time) to authenticated;
