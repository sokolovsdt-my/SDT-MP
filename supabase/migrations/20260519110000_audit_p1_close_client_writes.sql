-- ─── P1 (S6, S7, S11, S12): закрыть прямые клиентские мутации ───────────────
-- Раньше клиент мог делать:
--   S6  bookings.update({status:'cancelled'}) без 12h-барьера (Schedule.jsx, Profile.jsx)
--   S7  prize_requests.insert(...) без проверки баланса/стока/дубля (Bonus.jsx)
--   S11 profiles.upsert({push_token}) — дубли FCM-токена у разных профилей (Profile.jsx, Schedule.jsx)
--   S6  profiles.update({birth_date, email, phone, ...}) — фрод с авторассылкой ДР (Profile.jsx)
--
-- Подход: RPC SECURITY DEFINER для UX + триггеры BEFORE UPDATE как defense-in-depth.
-- Триггеры используют `current_user = 'authenticated'` чтобы различать прямой клиент vs
-- SECURITY DEFINER (которая работает с правами postgres-owner). Так не нужно править
-- существующие RPC, которые легитимно меняют bonus_coins/bonus_rubles.

-- ============================================================================
-- 1. S12 — cancel_booking RPC (отмена записи на групповое занятие)
-- ============================================================================
create or replace function public.cancel_booking(p_booking_id uuid)
returns json
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_uid     uuid := auth.uid();
  v_role    text;
  v_booking record;
  v_now_msk timestamp;
  v_hours   numeric;
begin
  if v_uid is null then
    return json_build_object('ok', false, 'error', 'not_authenticated');
  end if;

  select role into v_role from profiles where id = v_uid;

  select b.id, b.student_id, b.status, b.schedule_id,
         s.starts_at, s.is_cancelled as lesson_cancelled
    into v_booking
    from bookings b
    left join schedule s on s.id = b.schedule_id
   where b.id = p_booking_id
     for update of b;

  if not found then
    return json_build_object('ok', false, 'error', 'booking_not_found');
  end if;

  if v_role is null or v_role not in ('admin','manager','owner') then
    if v_booking.student_id is distinct from v_uid then
      return json_build_object('ok', false, 'error', 'forbidden');
    end if;
  end if;

  if v_booking.status = 'cancelled' then
    return json_build_object('ok', false, 'error', 'already_cancelled');
  end if;

  -- 12h-барьер только для клиента, как и для cancel_indiv_request.
  -- schedule.starts_at — MSK naive, сравниваем с (now() at time zone 'MSK')::timestamp.
  if v_role is null or v_role not in ('admin','manager','owner') then
    if v_booking.starts_at is not null then
      v_now_msk := (now() at time zone 'Europe/Moscow')::timestamp;
      v_hours := extract(epoch from (v_booking.starts_at - v_now_msk)) / 3600;
      if v_hours < 12 then
        return json_build_object(
          'ok', false, 'error', 'too_late',
          'hours_left', round(v_hours::numeric, 1)
        );
      end if;
    end if;
  end if;

  update bookings set status = 'cancelled' where id = p_booking_id;

  return json_build_object('ok', true, 'booking_id', p_booking_id);
end;
$function$;

revoke all on function public.cancel_booking(uuid) from public, anon;
grant  execute on function public.cancel_booking(uuid) to authenticated;


-- ============================================================================
-- 2. S12 — триггер bookings: блокировать прямой UPDATE статуса клиентом
-- ============================================================================
create or replace function public.prevent_client_booking_modifications()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_role    text;
  v_starts  timestamp;
  v_now_msk timestamp;
  v_hours   numeric;
begin
  -- Изнутри SECURITY DEFINER RPC current_user = postgres (owner функции) —
  -- эти RPC уже сами всё проверили, пропускаем триггер.
  if current_user <> 'authenticated' then
    return NEW;
  end if;

  -- Если status не меняется, ничего не делаем (например смена subscription_id админом).
  if NEW.status is not distinct from OLD.status then
    return NEW;
  end if;

  select role into v_role from profiles where id = auth.uid();
  if v_role in ('admin','manager','owner') then
    return NEW;
  end if;

  -- Клиент может только cancel (не возвращать обратно в booked).
  if NEW.status <> 'cancelled' or OLD.status = 'cancelled' then
    raise exception 'client_can_only_cancel_active_bookings';
  end if;

  -- 12h-барьер
  select starts_at into v_starts from schedule where id = NEW.schedule_id;
  if v_starts is not null then
    v_now_msk := (now() at time zone 'Europe/Moscow')::timestamp;
    v_hours := extract(epoch from (v_starts - v_now_msk)) / 3600;
    if v_hours < 12 then
      raise exception 'cancel_too_late_client_bypass';
    end if;
  end if;

  return NEW;
end;
$function$;

drop trigger if exists prevent_client_booking_modifications on public.bookings;
create trigger prevent_client_booking_modifications
  before update on public.bookings
  for each row
  execute function public.prevent_client_booking_modifications();


-- ============================================================================
-- 3. S7 — request_prize RPC + закрытие прямого INSERT клиентом
-- ============================================================================
create or replace function public.request_prize(p_prize_id uuid)
returns json
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_uid           uuid := auth.uid();
  v_prize         prizes%rowtype;
  v_balance       int;
  v_pending_count int;
  v_req_id        uuid;
begin
  if v_uid is null then
    return json_build_object('ok', false, 'error', 'not_authenticated');
  end if;

  select * into v_prize from prizes where id = p_prize_id for update;
  if not found then
    return json_build_object('ok', false, 'error', 'prize_not_found');
  end if;
  if not v_prize.is_active then
    return json_build_object('ok', false, 'error', 'prize_inactive');
  end if;
  if v_prize.stock_count is not null and v_prize.stock_count <= 0 then
    return json_build_object('ok', false, 'error', 'out_of_stock');
  end if;

  select bonus_coins into v_balance from profiles where id = v_uid for update;
  if coalesce(v_balance, 0) < v_prize.coins_price then
    return json_build_object(
      'ok', false, 'error', 'insufficient_balance',
      'balance', coalesce(v_balance, 0), 'price', v_prize.coins_price
    );
  end if;

  select count(*) into v_pending_count
    from prize_requests
   where client_id = v_uid and prize_id = p_prize_id and status = 'pending';
  if v_pending_count > 0 then
    return json_build_object('ok', false, 'error', 'already_pending');
  end if;

  insert into prize_requests (prize_id, client_id, status)
  values (p_prize_id, v_uid, 'pending')
  returning id into v_req_id;

  return json_build_object('ok', true, 'request_id', v_req_id);
end;
$function$;

revoke all on function public.request_prize(uuid) from public, anon;
grant  execute on function public.request_prize(uuid) to authenticated;

-- Убираем прямой INSERT-полис для клиента — теперь только через RPC.
drop policy if exists "prize_requests: client create" on public.prize_requests;


-- ============================================================================
-- 4. S11 — register_push_token RPC (обнуление дублей)
-- ============================================================================
create or replace function public.register_push_token(p_token text)
returns json
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_uid     uuid := auth.uid();
  v_token   text;
  v_removed int;
begin
  if v_uid is null then
    return json_build_object('ok', false, 'error', 'not_authenticated');
  end if;

  v_token := nullif(trim(p_token), '');
  if v_token is null or length(v_token) < 20 then
    return json_build_object('ok', false, 'error', 'invalid_token');
  end if;

  -- Обнуляем токен у всех остальных профилей — защита от перекрёстных push
  -- когда несколько человек заходили на одном устройстве/браузере.
  update profiles
     set push_token = null
   where push_token = v_token
     and id <> v_uid;
  get diagnostics v_removed = row_count;

  update profiles set push_token = v_token where id = v_uid;

  return json_build_object('ok', true, 'detached_from', v_removed);
end;
$function$;

revoke all on function public.register_push_token(text) from public, anon;
grant  execute on function public.register_push_token(text) to authenticated;


-- ============================================================================
-- 5. S6 — update_my_profile RPC (whitelist полей + set-once)
-- ============================================================================
create or replace function public.update_my_profile(p_payload jsonb)
returns json
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_uid       uuid := auth.uid();
  v_prof      profiles%rowtype;
  v_first     text;
  v_last      text;
  v_patro     text;
  v_full      text;
  v_bd        date;
  v_email     text;
  v_phone     text;
  v_avatar    text;
  v_bio       text;
  v_ad_src    text;
  v_ad_custom text;
begin
  if v_uid is null then
    return json_build_object('ok', false, 'error', 'not_authenticated');
  end if;
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    return json_build_object('ok', false, 'error', 'invalid_payload');
  end if;

  select * into v_prof from profiles where id = v_uid for update;
  if not found then
    return json_build_object('ok', false, 'error', 'profile_not_found');
  end if;

  -- ─── ФИО — всегда-разрешённое (trim + NULLIF к '') ───
  v_first := case when p_payload ? 'first_name'
                  then nullif(trim(p_payload->>'first_name'), '') else v_prof.first_name end;
  v_last  := case when p_payload ? 'last_name'
                  then nullif(trim(p_payload->>'last_name'), '')  else v_prof.last_name  end;
  v_patro := case when p_payload ? 'patronymic'
                  then nullif(trim(p_payload->>'patronymic'), '') else v_prof.patronymic end;
  v_full  := nullif(concat_ws(' ', v_last, v_first, v_patro), '');

  -- ─── set-once: birth_date / email / phone ───
  if p_payload ? 'birth_date' then
    v_bd := nullif(p_payload->>'birth_date', '')::date;
    if v_prof.birth_date is not null and v_bd is distinct from v_prof.birth_date then
      return json_build_object('ok', false, 'error', 'birth_date_already_set');
    end if;
  else
    v_bd := v_prof.birth_date;
  end if;

  if p_payload ? 'email' then
    v_email := nullif(trim(p_payload->>'email'), '');
    if v_prof.email is not null and v_email is distinct from v_prof.email then
      return json_build_object('ok', false, 'error', 'email_already_set');
    end if;
  else
    v_email := v_prof.email;
  end if;

  if p_payload ? 'phone' then
    v_phone := nullif(trim(p_payload->>'phone'), '');
    if v_prof.phone is not null and v_phone is distinct from v_prof.phone then
      return json_build_object('ok', false, 'error', 'phone_already_set');
    end if;
  else
    v_phone := v_prof.phone;
  end if;

  -- ─── разрешённые без ограничений (могут перезаписываться) ───
  v_avatar    := case when p_payload ? 'avatar_url'
                      then nullif(p_payload->>'avatar_url', '') else v_prof.avatar_url end;
  v_bio       := case when p_payload ? 'bio'
                      then nullif(p_payload->>'bio', '')         else v_prof.bio end;
  v_ad_src    := case when p_payload ? 'ad_source'
                      then nullif(trim(p_payload->>'ad_source'), '') else v_prof.ad_source end;
  v_ad_custom := case when p_payload ? 'ad_source_custom'
                      then nullif(trim(p_payload->>'ad_source_custom'), '') else v_prof.ad_source_custom end;

  update profiles
     set first_name       = v_first,
         last_name        = v_last,
         patronymic       = v_patro,
         full_name        = v_full,
         birth_date       = v_bd,
         email            = v_email,
         phone            = v_phone,
         avatar_url       = v_avatar,
         bio              = v_bio,
         ad_source        = v_ad_src,
         ad_source_custom = v_ad_custom
   where id = v_uid;

  return json_build_object('ok', true, 'full_name', v_full);
end;
$function$;

revoke all on function public.update_my_profile(jsonb) from public, anon;
grant  execute on function public.update_my_profile(jsonb) to authenticated;


-- ============================================================================
-- 6. S6 — триггер profiles: жёсткий blacklist + set-once для клиента
-- ============================================================================
create or replace function public.prevent_unauthorized_profile_fields()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_role text;
begin
  -- Изнутри SECURITY DEFINER RPC current_user = postgres → пропускаем.
  if current_user <> 'authenticated' then
    return NEW;
  end if;

  if auth.uid() is null then
    return NEW;
  end if;

  -- Админ редактирует чужую запись — пропускаем (role-меняющие операции
  -- остаются под защитой prevent_unauthorized_role_change).
  if NEW.id is distinct from auth.uid() then
    return NEW;
  end if;

  select role into v_role from profiles where id = auth.uid();
  if v_role in ('admin','manager','owner') then
    return NEW;
  end if;

  -- ─── жёсткий blacklist: клиент/учитель не может менять никогда ───
  if coalesce(NEW.bonus_rubles, 0) is distinct from coalesce(OLD.bonus_rubles, 0) then
    raise exception 'profile_field_forbidden_bonus_rubles';
  end if;
  if coalesce(NEW.bonus_coins, 0) is distinct from coalesce(OLD.bonus_coins, 0) then
    raise exception 'profile_field_forbidden_bonus_coins';
  end if;
  if NEW.telegram_id is distinct from OLD.telegram_id then
    raise exception 'profile_field_forbidden_telegram_id';
  end if;
  if NEW.telegram_username is distinct from OLD.telegram_username then
    raise exception 'profile_field_forbidden_telegram_username';
  end if;
  if NEW.sort_order is distinct from OLD.sort_order then
    raise exception 'profile_field_forbidden_sort_order';
  end if;

  -- ─── set-once: birth_date / email / phone ───
  if NEW.birth_date is distinct from OLD.birth_date and OLD.birth_date is not null then
    raise exception 'profile_field_locked_birth_date';
  end if;
  if NEW.email is distinct from OLD.email and OLD.email is not null then
    raise exception 'profile_field_locked_email';
  end if;
  if NEW.phone is distinct from OLD.phone and OLD.phone is not null then
    raise exception 'profile_field_locked_phone';
  end if;

  return NEW;
end;
$function$;

drop trigger if exists prevent_unauthorized_profile_fields on public.profiles;
create trigger prevent_unauthorized_profile_fields
  before update on public.profiles
  for each row
  execute function public.prevent_unauthorized_profile_fields();


-- ============================================================================
-- 7. Smoke-test: ассерт что новые RPC возвращают понятные ошибки.
-- Запуск с null auth.uid() (анонимная сессия) — все 4 должны вернуть not_authenticated.
-- ============================================================================
do $$
declare
  r1 json;
  r2 json;
  r3 json;
  r4 json;
begin
  r1 := public.cancel_booking('00000000-0000-0000-0000-000000000000'::uuid);
  r2 := public.request_prize('00000000-0000-0000-0000-000000000000'::uuid);
  r3 := public.register_push_token('test');
  r4 := public.update_my_profile('{}'::jsonb);

  assert (r1->>'ok') = 'false' and (r1->>'error') = 'not_authenticated', 'cancel_booking anon: ' || r1::text;
  assert (r2->>'ok') = 'false' and (r2->>'error') = 'not_authenticated', 'request_prize anon: ' || r2::text;
  assert (r3->>'ok') = 'false' and (r3->>'error') = 'not_authenticated', 'register_push_token anon: ' || r3::text;
  assert (r4->>'ok') = 'false' and (r4->>'error') = 'not_authenticated', 'update_my_profile anon: ' || r4::text;
end $$;
