-- Универсальный JSON-снимок фильтров рассылки.
--
-- Раньше каждый фильтр требовал отдельной колонки (filter_group_id,
-- filter_subscription_status, filter_ltv_min/max, filter_age_min/max,
-- filter_last_visit_days, filter_loyalty_level). При добавлении новых
-- фильтров (множественные продукты, push-фильтр, дни регистрации,
-- именинники, исключение получавших) пришлось бы плодить новые колонки
-- и каждый раз править INSERT/SELECT.
--
-- filter_payload хранит payload, который клиент передаёт в RPC
-- recipients_for_broadcast — один-в-один. Это даёт:
--   • ноль миграций при будущих фильтрах
--   • в истории видно ВСЕ параметры одной строкой JSON
--   • кнопка «Дублировать рассылку» = просто скопировать payload
--
-- Старые filter_* колонки оставлены для обратной совместимости истории.
-- Новые рассылки пишут в filter_payload и оставляют старые колонки NULL.

alter table public.broadcasts
  add column if not exists filter_payload jsonb;
