-- ─── Шаг 3: cancel_indiv_request теперь и для админов ────────────────────────
-- До: только клиент мог отменять свои заявки. Админ откланял прямым UPDATE
-- без RPC, кнопки «Отменить» для confirmed не было — занятие могло остаться
-- висеть в расписании. Сейчас:
--   • client (uid == client_id): только свои, 12h-барьер для confirmed,
--     status → 'cancelled' (как было).
--   • admin/manager/owner: любые, без барьера. pending → 'rejected',
--     confirmed → 'cancelled' с отменой schedule.
--   • p_reason — опционально, сохраняется в reject_reason.
--
-- PostgREST не умеет выбирать перегрузку при default-аргументе — дропаем
-- старую сигнатуру (uuid).
drop function if exists public.cancel_indiv_request(uuid);

create or replace function public.cancel_indiv_request(
  p_request_id uuid,
  p_reason     text default null
) returns json
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_uid             uuid := auth.uid();
  v_user_role       text;
  v_is_admin        bool := false;
  v_req             indiv_requests%rowtype;
  v_was_confirmed   bool := false;
  v_sched_cancelled bool := false;
  v_start_ts        timestamptz;
  v_hours_left      numeric;
  v_new_status      text;
  v_reason          text := nullif(btrim(p_reason), '');
begin
  if v_uid is null then
    return json_build_object('ok', false, 'error', 'not_authenticated');
  end if;

  select role into v_user_role from profiles where id = v_uid;
  v_is_admin := v_user_role in ('admin','manager','owner');

  select * into v_req from indiv_requests where id = p_request_id for update;
  if not found then
    return json_build_object('ok', false, 'error', 'request_not_found');
  end if;

  -- Авторизация: либо это твоя заявка, либо ты админ.
  if not v_is_admin and v_req.client_id is distinct from v_uid then
    return json_build_object('ok', false, 'error', 'forbidden');
  end if;

  if v_req.status not in ('pending','confirmed') then
    return json_build_object('ok', false, 'error', 'not_cancellable',
                              'current_status', v_req.status);
  end if;

  -- 12h-барьер — ТОЛЬКО для клиента (админ может всегда).
  if not v_is_admin and v_req.status = 'confirmed' then
    v_start_ts   := (v_req.slot_date::timestamp + v_req.start_time)
                      at time zone 'Europe/Moscow';
    v_hours_left := extract(epoch from (v_start_ts - now())) / 3600.0;
    if v_hours_left < 12 then
      return json_build_object('ok', false, 'error', 'too_late',
                                'hours_left', round(v_hours_left::numeric, 1));
    end if;
  end if;

  v_was_confirmed := (v_req.status = 'confirmed');

  -- Связанное занятие — отменяем тоже.
  if v_req.schedule_id is not null then
    update schedule
       set is_cancelled = true
     where id = v_req.schedule_id
       and coalesce(is_cancelled, false) = false;
    if found then
      v_sched_cancelled := true;
      insert into schedule_history (schedule_id, action, author_id, comment)
      values (v_req.schedule_id, 'cancelled', v_uid,
              case
                when v_is_admin then 'Индив-заявка отменена администратором' ||
                                     coalesce(' (' || v_reason || ')', '')
                else 'Отменено клиентом через личный кабинет'
              end);
    end if;
  end if;

  -- pending+admin = rejected; всё остальное = cancelled.
  v_new_status := case
    when v_is_admin and v_req.status = 'pending' then 'rejected'
    else 'cancelled'
  end;

  update indiv_requests
     set status        = v_new_status,
         reject_reason = coalesce(v_reason, reject_reason)
   where id = p_request_id;

  return json_build_object(
    'ok',                 true,
    'new_status',         v_new_status,
    'was_confirmed',      v_was_confirmed,
    'schedule_cancelled', v_sched_cancelled,
    'by_admin',           v_is_admin
  );
end;
$function$;
