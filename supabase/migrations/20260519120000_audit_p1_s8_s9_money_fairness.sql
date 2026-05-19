-- ─── P1 (S8, S9): денежная справедливость в cancel_sale и cancel_lesson ─────
--
-- S8: cancel_sale возвращал 100% bonus_rubles даже если клиент уже потратил
-- часть визитов / срока подписки. Теперь возврат пропорциональный:
--   visits-based: bonus_refund = floor(bonus_rubles_used * (1 - visits_used/visits_total))
--   time-based (безлимит с expires_at): coef = used_days/total_days
--   бессрочный безлимит и услуги без подписки: 100% возврат
--
-- S9: cancel_lesson и delete_lesson возвращали визит в любую подписку, включая
-- мёртвую (is_frozen=true или expires_at<today) — визит виснул мёртвым грузом.
-- Теперь _refund_visits_for_lesson проверяет состояние подписки:
--   живая  → visits_used--
--   мёртвая → конвертирует визит в bonus_rubles по цене amount_paid/visits_total
--             + запись в bonus_history с client_reason='cancellation'

-- ============================================================================
-- 1. S9 — _refund_visits_for_lesson: учёт мёртвой подписки
-- ============================================================================
create or replace function public._refund_visits_for_lesson(p_schedule_id uuid)
returns json
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_att              record;
  v_iatt             record;
  v_sub              subscriptions%rowtype;
  v_isub             indiv_subscriptions%rowtype;
  v_today            date := (current_timestamp at time zone 'Europe/Moscow')::date;
  v_amount_paid      int;
  v_price_per_visit  int;
  v_refunded_visits  int := 0;
  v_refunded_indiv   int := 0;
  v_converted_rubles int := 0;
  v_removed_payments int := 0;
  v_compensations    jsonb := '[]'::jsonb;
  v_caller           uuid := auth.uid();
begin
  -- ─── Обычные подписки ───────────────────────────────────────────────────
  for v_att in
    select a.id as att_id, a.subscription_id, a.student_id
      from attendance a
     where a.schedule_id = p_schedule_id
       and a.status      = 'present'
       and a.subscription_id is not null
     for update of a
  loop
    select * into v_sub from subscriptions where id = v_att.subscription_id for update;
    if not found then continue; end if;
    -- Безлимит — нечего возвращать (визит не из счётчика, и денежно за него
    -- клиент не платил «за визит»).
    if v_sub.visits_total is null then continue; end if;

    if v_sub.is_frozen or (v_sub.expires_at is not null and v_sub.expires_at < v_today) then
      -- Мёртвая подписка → компенсация в bonus_rubles по цене из sales.amount_paid.
      v_amount_paid := 0;
      if v_sub.sale_id is not null then
        select coalesce(amount_paid, 0)::int into v_amount_paid
          from sales where id = v_sub.sale_id;
      end if;
      v_price_per_visit := case
        when v_sub.visits_total > 0 then floor(v_amount_paid::numeric / v_sub.visits_total)::int
        else 0
      end;
      if v_price_per_visit > 0 then
        update profiles
           set bonus_rubles = coalesce(bonus_rubles, 0) + v_price_per_visit
         where id = v_att.student_id;
        insert into bonus_history (student_id, type, amount, operation, reason, client_reason, created_by)
        values (v_att.student_id, 'rubles', v_price_per_visit, 'credit',
                'Компенсация за отмену занятия (абонемент истёк/заморожен)',
                'cancellation', v_caller);
        v_converted_rubles := v_converted_rubles + v_price_per_visit;
        v_compensations := v_compensations || jsonb_build_object(
          'student_id',       v_att.student_id,
          'subscription_id',  v_sub.id,
          'amount_rubles',    v_price_per_visit,
          'kind',             'subscription'
        );
      end if;
    else
      -- Живая подписка → возврат визита.
      update subscriptions
         set visits_used = greatest(0, coalesce(visits_used, 0) - 1)
       where id = v_sub.id;
      v_refunded_visits := v_refunded_visits + 1;
    end if;
  end loop;

  -- ─── Индив-подписки ─────────────────────────────────────────────────────
  for v_iatt in
    select a.id as att_id, a.indiv_subscription_id, a.student_id
      from attendance a
     where a.schedule_id = p_schedule_id
       and a.status      = 'present'
       and a.indiv_subscription_id is not null
     for update of a
  loop
    select * into v_isub from indiv_subscriptions where id = v_iatt.indiv_subscription_id for update;
    if not found then continue; end if;
    if v_isub.visits_total is null then continue; end if;

    if v_isub.is_frozen or (v_isub.expires_at is not null and v_isub.expires_at < v_today) then
      -- indiv_subscriptions.price хранит общую стоимость пакета — точнее, чем sales.amount_paid
      -- (последний мог быть размыт скидкой по чеку).
      v_price_per_visit := case
        when v_isub.visits_total > 0 then floor(coalesce(v_isub.price, 0)::numeric / v_isub.visits_total)::int
        else 0
      end;
      if v_price_per_visit > 0 then
        update profiles
           set bonus_rubles = coalesce(bonus_rubles, 0) + v_price_per_visit
         where id = v_iatt.student_id;
        insert into bonus_history (student_id, type, amount, operation, reason, client_reason, created_by)
        values (v_iatt.student_id, 'rubles', v_price_per_visit, 'credit',
                'Компенсация за отмену занятия (индив-пакет истёк/заморожен)',
                'cancellation', v_caller);
        v_converted_rubles := v_converted_rubles + v_price_per_visit;
        v_compensations := v_compensations || jsonb_build_object(
          'student_id',            v_iatt.student_id,
          'indiv_subscription_id', v_isub.id,
          'amount_rubles',         v_price_per_visit,
          'kind',                  'indiv'
        );
      end if;
    else
      update indiv_subscriptions
         set visits_used = greatest(0, coalesce(visits_used, 0) - 1)
       where id = v_isub.id;
      v_refunded_indiv := v_refunded_indiv + 1;
    end if;
  end loop;

  delete from lesson_payments where schedule_id = p_schedule_id;
  get diagnostics v_removed_payments = row_count;

  return json_build_object(
    'refunded_visits',       v_refunded_visits,
    'refunded_indiv_visits', v_refunded_indiv,
    'converted_to_rubles',   v_converted_rubles,
    'compensations',         v_compensations,
    'removed_payments',      v_removed_payments
  );
end;
$function$;

revoke all on function public._refund_visits_for_lesson(uuid) from public, anon, authenticated;
grant  execute on function public._refund_visits_for_lesson(uuid) to service_role;


-- ============================================================================
-- 2. S9 — cancel_lesson: переключение на _refund_visits_for_lesson (DRY).
-- Логика возврата теперь живёт в одном месте — хелпере. cancel_lesson
-- отвечает только за авторизацию, статус и аудит.
-- ============================================================================
create or replace function public.cancel_lesson(p_schedule_id uuid)
returns json
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_admin            uuid := auth.uid();
  v_admin_role       text;
  v_lesson           schedule%rowtype;
  v_substitute       uuid;
  v_refund           json;
  v_refunded_subs    uuid[];
  v_refunded_isubs   uuid[];
begin
  if v_admin is null then return json_build_object('ok', false, 'error', 'not_authenticated'); end if;
  select role into v_admin_role from profiles where id = v_admin;
  if v_admin_role is null or v_admin_role not in ('admin','manager','owner','teacher') then
    return json_build_object('ok', false, 'error', 'forbidden');
  end if;

  select * into v_lesson from schedule where id = p_schedule_id for update;
  if not found            then return json_build_object('ok', false, 'error', 'lesson_not_found'); end if;
  if v_lesson.is_cancelled then return json_build_object('ok', false, 'error', 'already_cancelled'); end if;

  if v_admin_role = 'teacher' then
    select substitute_teacher_id into v_substitute
      from teacher_substitutions where schedule_id = p_schedule_id;
    if v_lesson.teacher_id <> v_admin and (v_substitute is null or v_substitute <> v_admin) then
      return json_build_object('ok', false, 'error', 'not_your_lesson');
    end if;
  end if;

  v_refund := public._refund_visits_for_lesson(p_schedule_id);

  -- Собираем id подписок, в которые реально вернули визит (для UI-консистенции).
  select coalesce(array_agg(distinct a.subscription_id) filter (where a.subscription_id is not null), '{}')
    into v_refunded_subs
    from attendance a
   where a.schedule_id = p_schedule_id
     and a.status = 'present';

  select coalesce(array_agg(distinct a.indiv_subscription_id) filter (where a.indiv_subscription_id is not null), '{}')
    into v_refunded_isubs
    from attendance a
   where a.schedule_id = p_schedule_id
     and a.status = 'present';

  update schedule set is_cancelled = true where id = p_schedule_id;

  insert into schedule_history (schedule_id, action, author_id, changes, comment)
  values (p_schedule_id, 'cancelled', v_admin, v_refund,
          'Занятие отменено. Визитов вернулось: ' ||
          ((v_refund->>'refunded_visits')::int + (v_refund->>'refunded_indiv_visits')::int) ||
          case when (v_refund->>'converted_to_rubles')::int > 0
               then ', компенсация ' || (v_refund->>'converted_to_rubles') || ' ₽ за мёртвые абонементы'
               else '' end ||
          case when (v_refund->>'removed_payments')::int > 0 then ', отозвана зарплата' else '' end);

  return json_build_object(
    'ok',                              true,
    'refunded_visits',                 (v_refund->>'refunded_visits')::int,
    'refunded_indiv_visits',           (v_refund->>'refunded_indiv_visits')::int,
    'converted_to_rubles',             (v_refund->>'converted_to_rubles')::int,
    'compensations',                   v_refund->'compensations',
    'refunded_subscription_ids',       to_jsonb(v_refunded_subs),
    'refunded_indiv_subscription_ids', to_jsonb(v_refunded_isubs),
    'removed_payments',                (v_refund->>'removed_payments')::int
  );
end;
$function$;

revoke all on function public.cancel_lesson(uuid) from public, anon;
grant  execute on function public.cancel_lesson(uuid) to authenticated;


-- ============================================================================
-- 3. S8 — cancel_sale: пропорциональный возврат бонусов
-- ============================================================================
create or replace function public.cancel_sale(
  p_sale_id              uuid,
  p_cancel_whole_receipt boolean default true
)
returns json
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_admin               uuid := auth.uid();
  v_admin_role          text;
  v_sale                sales%rowtype;
  v_receipt             uuid;
  v_sales_to_cancel     uuid[];
  v_client_id           uuid;
  v_today               date := (current_timestamp at time zone 'Europe/Moscow')::date;
  v_subs_frozen         uuid[] := '{}';
  v_indiv_subs_frozen   uuid[] := '{}';
  v_visits_already_used bool := false;
  v_sale_row            record;
  v_sub                 subscriptions%rowtype;
  v_isub                indiv_subscriptions%rowtype;
  v_total_refund        int  := 0;
  v_total_full_charge   int  := 0;
  v_line_refund         int;
  v_coef                numeric;
  v_used_days           numeric;
  v_total_days          numeric;
  v_breakdown           jsonb := '[]'::jsonb;
  v_new_balance         int;
  v_product_names       text;
begin
  if v_admin is null then return json_build_object('ok', false, 'error', 'not_authenticated'); end if;
  select role into v_admin_role from profiles where id = v_admin;
  if v_admin_role is null or v_admin_role not in ('admin','manager','owner') then
    return json_build_object('ok', false, 'error', 'forbidden');
  end if;

  select * into v_sale from sales where id = p_sale_id for update;
  if not found              then return json_build_object('ok', false, 'error', 'not_found'); end if;
  if v_sale.is_cancelled    then return json_build_object('ok', false, 'error', 'already_cancelled'); end if;
  v_receipt   := v_sale.receipt_id;
  v_client_id := v_sale.client_id;

  if p_cancel_whole_receipt and v_receipt is not null then
    perform 1 from sales where receipt_id = v_receipt and is_cancelled = false for update;
    select array_agg(id),
           string_agg(product_name, ', ')
      into v_sales_to_cancel, v_product_names
      from sales
     where receipt_id = v_receipt and is_cancelled = false;
  else
    v_sales_to_cancel := array[p_sale_id];
    v_product_names   := v_sale.product_name;
  end if;

  -- ─── Пропорциональный возврат по каждой строке чека ───
  for v_sale_row in
    select * from sales
     where id = any(v_sales_to_cancel)
     order by created_at asc
  loop
    v_total_full_charge := v_total_full_charge + coalesce(v_sale_row.bonus_rubles_used, 0)::int;

    if coalesce(v_sale_row.bonus_rubles_used, 0) <= 0 then
      v_breakdown := v_breakdown || jsonb_build_object(
        'sale_id', v_sale_row.id,
        'product_name', v_sale_row.product_name,
        'bonus_paid', 0,
        'coefficient_used', 0,
        'refund', 0
      );
      continue;
    end if;

    v_coef := 0;  -- default: 100% возврат

    if v_sale_row.product_type = 'subscription' then
      select * into v_sub from subscriptions where sale_id = v_sale_row.id limit 1;
      if found then
        if coalesce(v_sub.visits_used, 0) > 0 then v_visits_already_used := true; end if;
        if v_sub.visits_total is not null and v_sub.visits_total > 0 then
          -- visits-based
          v_coef := least(1, greatest(0,
            coalesce(v_sub.visits_used, 0)::numeric / v_sub.visits_total::numeric));
        elsif v_sub.expires_at is not null and v_sub.activated_at is not null then
          -- time-based безлимит с expires_at
          v_used_days  := greatest(0, v_today::date - v_sub.activated_at::date);
          v_total_days := greatest(1, v_sub.expires_at::date - v_sub.activated_at::date);
          v_coef := least(1, greatest(0, v_used_days / v_total_days));
        end if;
      end if;
    elsif v_sale_row.product_type = 'indiv' then
      select * into v_isub from indiv_subscriptions where sale_id = v_sale_row.id limit 1;
      if found then
        if coalesce(v_isub.visits_used, 0) > 0 then v_visits_already_used := true; end if;
        if v_isub.visits_total is not null and v_isub.visits_total > 0 then
          v_coef := least(1, greatest(0,
            coalesce(v_isub.visits_used, 0)::numeric / v_isub.visits_total::numeric));
        elsif v_isub.expires_at is not null and v_isub.activated_at is not null then
          v_used_days  := greatest(0, v_today::date - v_isub.activated_at::date);
          v_total_days := greatest(1, v_isub.expires_at::date - v_isub.activated_at::date);
          v_coef := least(1, greatest(0, v_used_days / v_total_days));
        end if;
      end if;
    end if;
    -- service/event/merch/other — coef = 0, 100% возврат

    v_line_refund := floor(v_sale_row.bonus_rubles_used * (1 - v_coef))::int;
    v_total_refund := v_total_refund + v_line_refund;

    v_breakdown := v_breakdown || jsonb_build_object(
      'sale_id', v_sale_row.id,
      'product_name', v_sale_row.product_name,
      'product_type', v_sale_row.product_type,
      'bonus_paid', v_sale_row.bonus_rubles_used,
      'coefficient_used', round(v_coef::numeric, 4),
      'refund', v_line_refund
    );
  end loop;

  -- ─── Отменяем sales-строки ───
  update sales
     set is_cancelled = true,
         cancelled_at = now(),
         cancelled_by = v_admin
   where id = any(v_sales_to_cancel);

  -- ─── Замораживаем подписки ───
  for v_sub in
    select * from subscriptions where sale_id = any(v_sales_to_cancel) for update
  loop
    update subscriptions
       set is_frozen  = true,
           expires_at = least(coalesce(expires_at, v_today - 1), v_today - 1)
     where id = v_sub.id;
    insert into subscription_date_changes
           (subscription_id, field, old_value, new_value, reason, changed_by)
    values (v_sub.id, 'expires_at',
            v_sub.expires_at::timestamptz,
            (v_today - 1)::timestamptz,
            'Отмена продажи',
            v_admin);
    v_subs_frozen := v_subs_frozen || v_sub.id;
  end loop;

  for v_isub in
    select * from indiv_subscriptions where sale_id = any(v_sales_to_cancel) for update
  loop
    update indiv_subscriptions
       set is_frozen  = true,
           expires_at = least(coalesce(expires_at, v_today - 1), v_today - 1)
     where id = v_isub.id;
    v_indiv_subs_frozen := v_indiv_subs_frozen || v_isub.id;
  end loop;

  -- ─── Возврат бонусов ───
  if v_total_refund > 0 then
    update profiles set bonus_rubles = coalesce(bonus_rubles, 0) + v_total_refund
      where id = v_client_id
      returning bonus_rubles into v_new_balance;
    insert into bonus_history (student_id, type, amount, operation, reason, client_reason, created_by)
    values (v_client_id, 'rubles', v_total_refund, 'credit',
            'Пропорциональный возврат при отмене: ' || coalesce(v_product_names, '—'),
            'cancellation', v_admin);
  end if;

  return json_build_object(
    'ok',                            true,
    'cancelled_sale_ids',            to_jsonb(v_sales_to_cancel),
    'frozen_subscription_ids',       to_jsonb(v_subs_frozen),
    'frozen_indiv_subscription_ids', to_jsonb(v_indiv_subs_frozen),
    'refunded_bonus_rubles',         v_total_refund,
    'full_bonus_paid',               v_total_full_charge,
    'refund_breakdown',              v_breakdown,
    'visits_already_used',           v_visits_already_used,
    'new_balance',                   v_new_balance
  );
end;
$function$;

revoke all on function public.cancel_sale(uuid, boolean) from public, anon;
grant  execute on function public.cancel_sale(uuid, boolean) to authenticated;


-- ============================================================================
-- 4. Smoke-test
-- ============================================================================
do $$
declare
  r1 json;
  r2 json;
begin
  r1 := public.cancel_sale('00000000-0000-0000-0000-000000000000'::uuid, true);
  r2 := public.cancel_lesson('00000000-0000-0000-0000-000000000000'::uuid);

  assert (r1->>'ok') = 'false' and (r1->>'error') = 'not_authenticated',
    'cancel_sale anon: ' || r1::text;
  assert (r2->>'ok') = 'false' and (r2->>'error') = 'not_authenticated',
    'cancel_lesson anon: ' || r2::text;
end $$;
