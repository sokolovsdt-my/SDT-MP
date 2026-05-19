-- ─── S20: GIN trigram-индекс на profiles для ускорения ILIKE-поиска ─────────
-- AdminCashbox/AdminBroadcasts/AttendancePanel делают ILIKE по full_name/
-- email/phone. Без trgm — full table scan на каждый запрос. С GIN-индексом
-- на trgm-операторах PostgreSQL может использовать индекс для ILIKE
-- с обоих сторон wildcard'ов ('%val%').

create extension if not exists pg_trgm;

-- Композитный индекс на конкатенацию полей — один индекс покрывает поиск
-- по full_name, email и phone в .or(...ilike...). Используется в:
--   AdminCashbox.ClientSearch (.or full_name+phone+email)
--   AdminBroadcasts.handleManualSearch (.or full_name+phone+email)
--   AttendancePanel student search (.ilike full_name)
create index if not exists profiles_search_trgm_idx
  on public.profiles
  using gin ((coalesce(full_name, '') || ' ' || coalesce(email, '') || ' ' || coalesce(phone, '')) gin_trgm_ops);

-- Отдельный индекс на full_name — для случаев когда .ilike() идёт только
-- по этому полю (более селективный план):
create index if not exists profiles_full_name_trgm_idx
  on public.profiles
  using gin (full_name gin_trgm_ops);
