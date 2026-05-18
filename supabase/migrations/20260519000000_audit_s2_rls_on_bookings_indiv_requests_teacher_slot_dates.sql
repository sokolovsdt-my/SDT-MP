-- ─── S2: включить RLS на трёх публичных таблицах ────────────────────────────
-- bookings, indiv_requests, teacher_slot_dates были public-writable: любой
-- залогиненный клиент мог удалять/менять чужие brokings, читать заявки
-- других клиентов, вставлять слоты от имени любого препода.

-- 1. bookings — политики уже созданы (own SELECT/INSERT/UPDATE/DELETE +
--    admin везде). Просто включаем RLS.
alter table public.bookings enable row level security;
-- Service role и SECURITY DEFINER функции (RPC) обходят RLS — RPC
-- create_indiv_request/cancel_*/cancel_lesson продолжают работать.

-- 2. indiv_requests — пишем/модифицируем только через RPC
-- (create_indiv_request, cancel_indiv_request, confirm_indiv_request).
-- Прямые insert/update/delete от клиентов запрещены.
alter table public.indiv_requests enable row level security;

-- SELECT: клиент видит свои; admin/manager/owner — все; teacher — где он
-- упомянут как teacher_id.
create policy indiv_requests_select on public.indiv_requests
  for select
  using (
    client_id = auth.uid()
    or teacher_id = auth.uid()
    or is_admin_plus()
  );

-- INSERT/UPDATE/DELETE: только service role. Клиенты используют RPC
-- (они SECURITY DEFINER, RLS обходит).
-- Никаких политик на a/w/d не создаём → действия запрещены.

-- 3. teacher_slot_dates — клиенты читают (для Shop/Team).
-- Пишут: admin/manager/owner (любые слоты) или teacher (только свои).
alter table public.teacher_slot_dates enable row level security;

-- SELECT — для всех authenticated клиентов (нужно для записи на индив).
create policy teacher_slot_dates_select on public.teacher_slot_dates
  for select
  to authenticated
  using (true);

-- INSERT/UPDATE/DELETE — staff. Teacher только для своего teacher_id.
create policy teacher_slot_dates_write_admin on public.teacher_slot_dates
  for all
  to authenticated
  using (is_admin_plus())
  with check (is_admin_plus());

create policy teacher_slot_dates_write_teacher on public.teacher_slot_dates
  for all
  to authenticated
  using (is_staff() and teacher_id = auth.uid())
  with check (is_staff() and teacher_id = auth.uid());
