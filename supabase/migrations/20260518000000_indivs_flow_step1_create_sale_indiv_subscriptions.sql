-- ─── Шаг 1: продажа индив-пакета создаёт indiv_subscriptions ──────────────────
-- Контекст: каталог индивов живёт в indiv_packages (18 строк), а старая связка
-- products+product_indivs пуста и не используется. AdminCashbox теперь будет
-- передавать в create_sale id из indiv_packages как product_id — но
-- sales_product_id_fkey ссылается на products(id) и блокирует это. Снимаем FK,
-- product_id остаётся uuid (для индивов — indiv_packages.id, для остальных —
-- products.id), интерпретация определяется product_type.
alter table sales drop constraint if exists sales_product_id_fkey;

-- ─── create_sale: ветка product_type='indiv' ─────────────────────────────────
-- Для каждой позиции индив-типа находим indiv_packages по product_id,
-- создаём indiv_subscriptions со ссылкой на sale и на пакет.
-- visits_total/duration_days/teacher_rate берём с сервера из пакета — клиент
-- не может их подделать.
create or replace function public.create_sale(p_payload jsonb)
returns json
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_admin           uuid    := auth.uid();
  v_admin_role      text;
  v_client_id       uuid    := nullif(p_payload->>'client_id','')::uuid;
  v_client_balance  int;
  v_items           jsonb   := p_payload->'items';
  v_n               int     := coalesce(jsonb_array_length(v_items), 0);
  v_subtotal        int     := 0;
  v_disc            int     := coalesce((p_payload->>'discount_amount')::int, 0);
  v_disc_pct        numeric := coalesce((p_payload->>'discount_percent')::numeric, 0);
  v_disc_reason     text    := nullif(btrim(p_payload->>'discount_reason'), '');
  v_bonus           int     := coalesce((p_payload->>'bonus_rubles_used')::int, 0);
  v_method          text    := p_payload->>'payment_method';
  v_acq_percent     numeric := coalesce((p_payload->>'acquiring_fee_percent')::numeric, 0);
  v_payer_type      text    := coalesce(p_payload->>'payer_type', 'client');
  v_payer_rep       uuid    := nullif(p_payload->>'payer_representative_id','')::uuid;
  v_payer_name      text    := nullif(p_payload->>'payer_name', '');
  v_comment         text    := nullif(p_payload->>'comment', '');
  v_groups          jsonb   := coalesce(p_payload->'selected_group_ids', '[]'::jsonb);
  v_has_sub_items   bool;
  v_after           int;
  v_acq             int;
  v_net             int;
  v_receipt         uuid    := gen_random_uuid();
  v_disc_each       int; v_bonus_each int; v_paid_each int; v_acq_each int; v_net_each int;
  v_item            jsonb;
  v_idx             int     := 0;
  v_sale_id         uuid;
  v_sub_id          uuid;
  v_sale_ids        uuid[]  := '{}';
  v_sub_ids         uuid[]  := '{}';
  v_indiv_sub_ids   uuid[]  := '{}';
  v_ptype           text;
  v_ps              product_subscriptions%rowtype;
  v_pkg             indiv_packages%rowtype;
  v_today           date    := (current_timestamp at time zone 'Europe/Moscow')::date;
  v_exp             date;
  v_new_balance     int;
  v_product_names   text;
begin
  if v_admin is null then return json_build_object('ok', false, 'error', 'not_authenticated'); end if;
  select role into v_admin_role from profiles where id = v_admin;
  if v_admin_role is null or v_admin_role not in ('admin','manager','owner') then
    return json_build_object('ok', false, 'error', 'forbidden');
  end if;

  if v_n = 0             then return json_build_object('ok', false, 'error', 'no_items'); end if;
  if v_client_id is null then return json_build_object('ok', false, 'error', 'no_client'); end if;
  if v_method is null    then return json_build_object('ok', false, 'error', 'no_payment_method'); end if;
  if v_disc < 0 or v_bonus < 0 then return json_build_object('ok', false, 'error', 'negative_amount'); end if;
  if v_disc > 0 and v_disc_reason is null then
    return json_build_object('ok', false, 'error', 'discount_reason_required');
  end if;

  -- Подписки/услуги требуют выбора групп (баг, не «универсальный абонемент»).
  select exists (
    select 1 from jsonb_array_elements(v_items) it
    where it->>'product_type' in ('subscription','service')
  ) into v_has_sub_items;
  if v_has_sub_items and jsonb_array_length(v_groups) = 0 then
    return json_build_object('ok', false, 'error', 'groups_required');
  end if;

  -- Для индивов: каждая позиция должна указывать существующий indiv_packages.id
  for v_item in select jsonb_array_elements(v_items) loop
    if v_item->>'product_type' = 'indiv' then
      if nullif(v_item->>'product_id','') is null then
        return json_build_object('ok', false, 'error', 'indiv_package_required');
      end if;
      perform 1 from indiv_packages
        where id = (v_item->>'product_id')::uuid and is_active = true;
      if not found then
        return json_build_object('ok', false, 'error', 'indiv_package_not_found',
                                 'product_id', v_item->>'product_id');
      end if;
    end if;
  end loop;

  select coalesce(bonus_rubles, 0) into v_client_balance from profiles where id = v_client_id for update;
  if not found then return json_build_object('ok', false, 'error', 'client_not_found'); end if;
  if v_bonus > v_client_balance then
    return json_build_object('ok', false, 'error', 'insufficient_bonus_rubles',
                              'balance', v_client_balance, 'required', v_bonus);
  end if;

  for v_item in select jsonb_array_elements(v_items) loop
    v_subtotal := v_subtotal + coalesce((v_item->>'price')::int, 0);
  end loop;
  if v_disc + v_bonus > v_subtotal then
    return json_build_object('ok', false, 'error', 'discount_exceeds_subtotal',
                              'subtotal', v_subtotal, 'discount', v_disc, 'bonus', v_bonus);
  end if;

  v_after := v_subtotal - v_disc - v_bonus;
  v_acq   := case when v_method = 'online' then round(v_after * v_acq_percent / 100)::int else 0 end;
  v_net   := case when v_method in ('bonus','coins','bonus_only') then 0 else v_after - v_acq end;

  v_disc_each  := v_disc  / v_n;
  v_bonus_each := v_bonus / v_n;
  v_paid_each  := v_after / v_n;
  v_acq_each   := v_acq   / v_n;
  v_net_each   := v_net   / v_n;

  for v_item in select jsonb_array_elements(v_items) loop
    declare
      first_row bool := (v_idx = 0);
      d  int := case when first_row then v_disc_each  + (v_disc  - v_disc_each  * v_n) else v_disc_each  end;
      b  int := case when first_row then v_bonus_each + (v_bonus - v_bonus_each * v_n) else v_bonus_each end;
      p  int := case when first_row then v_paid_each  + (v_after - v_paid_each  * v_n) else v_paid_each  end;
      a  int := case when first_row then v_acq_each   + (v_acq   - v_acq_each   * v_n) else v_acq_each   end;
      n  int := case when first_row then v_net_each   + (v_net   - v_net_each   * v_n) else v_net_each   end;
    begin
      insert into sales (
        receipt_id, client_id, product_id, product_type, product_name, teacher_id,
        price_original, discount_percent, discount_amount, discount_reason,
        bonus_rubles_used, bonus_coins_used, payment_method, amount_paid,
        acquiring_fee, total_net, payer_type, payer_representative_id, payer_name,
        comment, created_by, sale_date
      ) values (
        v_receipt, v_client_id, nullif(v_item->>'product_id','')::uuid,
        v_item->>'product_type', v_item->>'product_name',
        nullif(v_item->>'teacher_id','')::uuid,
        (v_item->>'price')::int, v_disc_pct, d, v_disc_reason,
        b, 0, v_method, p, a, n,
        v_payer_type,
        case when v_payer_type='representative' then v_payer_rep else null end,
        case when v_payer_type='other'          then v_payer_name else null end,
        v_comment, v_admin, now()
      ) returning id into v_sale_id;
      v_sale_ids := v_sale_ids || v_sale_id;
    end;
    v_idx := v_idx + 1;
  end loop;

  if v_bonus > 0 then
    update profiles set bonus_rubles = coalesce(bonus_rubles,0) - v_bonus
      where id = v_client_id
      returning bonus_rubles into v_new_balance;
    select string_agg(it->>'product_name', ', ') into v_product_names
      from jsonb_array_elements(v_items) it;
    insert into bonus_history (student_id, type, amount, operation, reason, client_reason, created_by)
    values (v_client_id, 'rubles', -v_bonus, 'debit',
            'Оплата: ' || coalesce(v_product_names, '—'),
            'subscription_payment', v_admin);
  else
    v_new_balance := v_client_balance;
  end if;

  -- ─── Создаём subscriptions / indiv_subscriptions по типу позиции ───────────
  v_idx := 0;
  for v_item in select jsonb_array_elements(v_items) loop
    v_ptype := v_item->>'product_type';

    if v_ptype in ('subscription','service') then
      select * into v_ps from product_subscriptions
        where product_id = (v_item->>'product_id')::uuid limit 1;
      v_exp := case when v_ps.duration_days is not null then v_today + v_ps.duration_days else null end;
      insert into subscriptions (
        student_id, type, visits_total, visits_used, price,
        activated_at, expires_at, is_frozen, sale_id
      ) values (
        v_client_id, v_item->>'product_name',
        v_ps.visits_count, 0, (v_item->>'price')::int,
        v_today, v_exp, false, v_sale_ids[v_idx + 1]
      ) returning id into v_sub_id;
      v_sub_ids := v_sub_ids || v_sub_id;

      insert into subscription_allowed_groups (subscription_id, group_id)
      select v_sub_id, (g)::uuid from jsonb_array_elements_text(v_groups) g;

    elsif v_ptype = 'indiv' then
      select * into v_pkg from indiv_packages
        where id = (v_item->>'product_id')::uuid;
      v_exp := v_today + v_pkg.duration_days;
      insert into indiv_subscriptions (
        client_id, teacher_id, package_id, visits_total, visits_used,
        price, teacher_rate, activated_at, expires_at, is_frozen,
        sale_id, created_by
      ) values (
        v_client_id, v_pkg.teacher_id, v_pkg.id, v_pkg.visits_count, 0,
        (v_item->>'price')::int, v_pkg.teacher_rate, v_today, v_exp, false,
        v_sale_ids[v_idx + 1], v_admin
      ) returning id into v_sub_id;
      v_indiv_sub_ids := v_indiv_sub_ids || v_sub_id;
    end if;

    v_idx := v_idx + 1;
  end loop;

  return json_build_object(
    'ok', true,
    'receipt_id',             v_receipt,
    'sale_ids',               to_jsonb(v_sale_ids),
    'subscription_ids',       to_jsonb(v_sub_ids),
    'indiv_subscription_ids', to_jsonb(v_indiv_sub_ids),
    'new_balance',            v_new_balance,
    'subtotal',               v_subtotal,
    'after_discount',         v_after,
    'total_net',              v_net,
    'acquiring_fee',          v_acq
  );
end;
$function$;

-- ─── cancel_sale: также морозит indiv_subscriptions по sale_id ───────────────
create or replace function public.cancel_sale(p_sale_id uuid, p_cancel_whole_receipt boolean default true)
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
  v_total_bonus_refund  int  := 0;
  v_client_id           uuid;
  v_today               date := (current_timestamp at time zone 'Europe/Moscow')::date;
  v_subs_frozen         uuid[] := '{}';
  v_indiv_subs_frozen   uuid[] := '{}';
  v_visits_already_used bool := false;
  v_sub                 record;
  v_isub                record;
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
           sum(coalesce(bonus_rubles_used,0))::int,
           string_agg(product_name, ', ')
      into v_sales_to_cancel, v_total_bonus_refund, v_product_names
      from sales
     where receipt_id = v_receipt and is_cancelled = false;
  else
    v_sales_to_cancel    := array[p_sale_id];
    v_total_bonus_refund := coalesce(v_sale.bonus_rubles_used,0)::int;
    v_product_names      := v_sale.product_name;
  end if;

  update sales
     set is_cancelled = true,
         cancelled_at = now(),
         cancelled_by = v_admin
   where id = any(v_sales_to_cancel);

  -- Замораживаем обычные подписки
  for v_sub in
    select * from subscriptions where sale_id = any(v_sales_to_cancel) for update
  loop
    if coalesce(v_sub.visits_used, 0) > 0 then v_visits_already_used := true; end if;
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

  -- Замораживаем индив-пакеты (НОВОЕ: до этого индив-абонементы оставались
  -- активными после отмены продажи — клиент мог продолжать записываться).
  for v_isub in
    select * from indiv_subscriptions where sale_id = any(v_sales_to_cancel) for update
  loop
    if coalesce(v_isub.visits_used, 0) > 0 then v_visits_already_used := true; end if;
    update indiv_subscriptions
       set is_frozen  = true,
           expires_at = least(coalesce(expires_at, v_today - 1), v_today - 1)
     where id = v_isub.id;
    v_indiv_subs_frozen := v_indiv_subs_frozen || v_isub.id;
  end loop;

  if v_total_bonus_refund > 0 then
    update profiles set bonus_rubles = coalesce(bonus_rubles,0) + v_total_bonus_refund
      where id = v_client_id
      returning bonus_rubles into v_new_balance;
    insert into bonus_history (student_id, type, amount, operation, reason, client_reason, created_by)
    values (v_client_id, 'rubles', v_total_bonus_refund, 'credit',
            'Возврат при отмене: ' || coalesce(v_product_names, '—'),
            'cancellation', v_admin);
  end if;

  return json_build_object(
    'ok',                            true,
    'cancelled_sale_ids',            to_jsonb(v_sales_to_cancel),
    'frozen_subscription_ids',       to_jsonb(v_subs_frozen),
    'frozen_indiv_subscription_ids', to_jsonb(v_indiv_subs_frozen),
    'refunded_bonus_rubles',         v_total_bonus_refund,
    'visits_already_used',           v_visits_already_used,
    'new_balance',                   v_new_balance
  );
end;
$function$;
