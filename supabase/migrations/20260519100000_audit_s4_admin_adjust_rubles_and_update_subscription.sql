-- ─── S4: RPC вместо прямых UPDATE балансов/подписок ──────────────────────────
-- Раньше AdminClientCard.handleAddBonus делал read-modify-write на
-- profiles.bonus_rubles/bonus_coins (гонка двух параллельных кредитов
-- переписывала балансы), и handleSaveDate напрямую обновлял subscriptions
-- (даты/визиты/is_frozen) без блокировки и серверной валидации.
-- CLAUDE.md явно запрещает такое: «мутации денег/визитов — только RPC».

-- 1. admin_adjust_rubles — точная копия admin_adjust_coins, но для bonus_rubles.
create or replace function public.admin_adjust_rubles(
  p_client_id uuid,
  p_delta     int,
  p_reason    text
) returns json
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_admin_id    uuid := auth.uid();
  v_admin_role  text;
  v_balance     int;
  v_new_balance int;
begin
  if v_admin_id is null then
    return json_build_object('ok', false, 'error', 'not_authenticated');
  end if;
  if p_delta is null or p_delta = 0 then
    return json_build_object('ok', false, 'error', 'invalid_delta');
  end if;
  if p_reason is null or btrim(p_reason) = '' then
    return json_build_object('ok', false, 'error', 'reason_required');
  end if;

  select role into v_admin_role from profiles where id = v_admin_id;
  if v_admin_role is null or v_admin_role not in ('admin','manager','owner') then
    return json_build_object('ok', false, 'error', 'forbidden');
  end if;

  select coalesce(bonus_rubles, 0) into v_balance
    from profiles where id = p_client_id for update;
  if not found then
    return json_build_object('ok', false, 'error', 'client_not_found');
  end if;

  if p_delta < 0 and v_balance + p_delta < 0 then
    return json_build_object('ok', false, 'error', 'insufficient_balance',
      'balance', v_balance, 'required', -p_delta);
  end if;

  update profiles
     set bonus_rubles = coalesce(bonus_rubles, 0) + p_delta
   where id = p_client_id
   returning bonus_rubles into v_new_balance;

  insert into bonus_history (student_id, type, amount, operation, reason, client_reason, created_by)
  values (
    p_client_id,
    'rubles',
    p_delta,
    case when p_delta > 0 then 'credit' else 'debit' end,
    p_reason,
    case when p_delta > 0 then 'manual_credit' else 'manual_debit' end,
    v_admin_id
  );

  return json_build_object('ok', true, 'new_balance', v_new_balance);
end;
$function$;

revoke all on function public.admin_adjust_rubles(uuid, int, text) from public, anon;
grant  execute on function public.admin_adjust_rubles(uuid, int, text) to authenticated;


-- 2. admin_update_subscription — общий update полей подписки админом.
-- Принимает jsonb-payload: любые из {activated_at date|null, expires_at date|null,
-- visits_total int|null, visits_used int, is_frozen bool}. Обязательно p_reason.
-- FOR UPDATE на подписку, аудит каждого изменённого поля в subscription_date_changes.
create or replace function public.admin_update_subscription(
  p_sub_id  uuid,
  p_payload jsonb,
  p_reason  text
) returns json
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_admin_id   uuid := auth.uid();
  v_admin_role text;
  v_sub        subscriptions%rowtype;
  v_changed    jsonb := '{}'::jsonb;
  v_new_activated_at date;
  v_new_expires_at   date;
  v_new_visits_total int;
  v_new_visits_used  int;
  v_new_is_frozen    bool;
  v_has_activated bool := p_payload ? 'activated_at';
  v_has_expires   bool := p_payload ? 'expires_at';
  v_has_vt        bool := p_payload ? 'visits_total';
  v_has_vu        bool := p_payload ? 'visits_used';
  v_has_frozen    bool := p_payload ? 'is_frozen';
begin
  if v_admin_id is null then
    return json_build_object('ok', false, 'error', 'not_authenticated');
  end if;
  if p_reason is null or btrim(p_reason) = '' then
    return json_build_object('ok', false, 'error', 'reason_required');
  end if;

  select role into v_admin_role from profiles where id = v_admin_id;
  if v_admin_role is null or v_admin_role not in ('admin','manager','owner') then
    return json_build_object('ok', false, 'error', 'forbidden');
  end if;

  select * into v_sub from subscriptions where id = p_sub_id for update;
  if not found then
    return json_build_object('ok', false, 'error', 'subscription_not_found');
  end if;

  if v_has_activated then v_new_activated_at := nullif(p_payload->>'activated_at','')::date; end if;
  if v_has_expires   then v_new_expires_at   := nullif(p_payload->>'expires_at','')::date;   end if;
  if v_has_vt        then v_new_visits_total := nullif(p_payload->>'visits_total','')::int;  end if;
  if v_has_vu then
    v_new_visits_used := coalesce((p_payload->>'visits_used')::int, 0);
    if v_new_visits_used < 0 then
      return json_build_object('ok', false, 'error', 'visits_used_negative');
    end if;
  end if;
  if v_has_frozen then v_new_is_frozen := (p_payload->>'is_frozen')::bool; end if;

  -- Валидация visits_used <= visits_total
  declare
    v_eff_total int := case when v_has_vt then v_new_visits_total else v_sub.visits_total end;
    v_eff_used  int := coalesce(case when v_has_vu then v_new_visits_used else v_sub.visits_used end, 0);
  begin
    if v_eff_total is not null and v_eff_used > v_eff_total then
      return json_build_object('ok', false, 'error', 'visits_used_exceeds_total',
        'visits_used', v_eff_used, 'visits_total', v_eff_total);
    end if;
  end;

  -- Применяем + аудит
  if v_has_activated and v_sub.activated_at is distinct from v_new_activated_at then
    insert into subscription_date_changes (subscription_id, field, old_value, new_value, reason, changed_by)
    values (p_sub_id, 'activated_at', v_sub.activated_at::timestamptz, v_new_activated_at::timestamptz, p_reason, v_admin_id);
    update subscriptions set activated_at = v_new_activated_at where id = p_sub_id;
    v_changed := v_changed || jsonb_build_object('activated_at', v_new_activated_at);
  end if;

  if v_has_expires and v_sub.expires_at is distinct from v_new_expires_at then
    insert into subscription_date_changes (subscription_id, field, old_value, new_value, reason, changed_by)
    values (p_sub_id, 'expires_at', v_sub.expires_at::timestamptz, v_new_expires_at::timestamptz, p_reason, v_admin_id);
    update subscriptions set expires_at = v_new_expires_at where id = p_sub_id;
    v_changed := v_changed || jsonb_build_object('expires_at', v_new_expires_at);
  end if;

  if v_has_vt and v_sub.visits_total is distinct from v_new_visits_total then
    insert into subscription_date_changes (subscription_id, field, old_value, new_value, reason, changed_by)
    values (p_sub_id, 'visits_total',
            (case when v_sub.visits_total is null then null else (date '2000-01-01' + v_sub.visits_total) end)::timestamptz,
            (case when v_new_visits_total is null then null else (date '2000-01-01' + v_new_visits_total) end)::timestamptz,
            p_reason, v_admin_id);
    update subscriptions set visits_total = v_new_visits_total where id = p_sub_id;
    v_changed := v_changed || jsonb_build_object('visits_total', v_new_visits_total);
  end if;

  if v_has_vu and coalesce(v_sub.visits_used, 0) is distinct from v_new_visits_used then
    insert into subscription_date_changes (subscription_id, field, old_value, new_value, reason, changed_by)
    values (p_sub_id, 'visits_used',
            (date '2000-01-01' + coalesce(v_sub.visits_used, 0))::timestamptz,
            (date '2000-01-01' + v_new_visits_used)::timestamptz,
            p_reason, v_admin_id);
    update subscriptions set visits_used = v_new_visits_used where id = p_sub_id;
    v_changed := v_changed || jsonb_build_object('visits_used', v_new_visits_used);
  end if;

  if v_has_frozen and coalesce(v_sub.is_frozen, false) is distinct from v_new_is_frozen then
    insert into subscription_date_changes (subscription_id, field, old_value, new_value, reason, changed_by)
    values (p_sub_id, 'is_frozen', null, null, p_reason || ' (' ||
            case when v_new_is_frozen then 'заморожен' else 'разморожен' end || ')', v_admin_id);
    update subscriptions set is_frozen = v_new_is_frozen where id = p_sub_id;
    v_changed := v_changed || jsonb_build_object('is_frozen', v_new_is_frozen);
  end if;

  return json_build_object('ok', true, 'changed', v_changed);
end;
$function$;

revoke all on function public.admin_update_subscription(uuid, jsonb, text) from public, anon;
grant  execute on function public.admin_update_subscription(uuid, jsonb, text) to authenticated;
