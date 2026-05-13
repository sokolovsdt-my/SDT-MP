-- Добавляем статусы 'sending' и 'failed' к broadcasts.status.
--
-- 'sending' нужен edge-функции send-broadcast: при заходе она атомарно
-- переводит рассылку в этот статус (UPDATE … WHERE status IN ('scheduled','sent','draft'))
-- — это защищает от двойной отправки если клиент и pg_cron дёрнут одновременно.
-- Без этого статуса CHECK constraint заворачивал UPDATE с
-- «new row violates check constraint broadcasts_status_check», и edge возвращала 500.
--
-- 'failed' — на будущее: если edge-функция упадёт целиком, можно будет переводить
-- рассылку в этот статус, чтобы UI показал кнопку «Повторить отправку».

alter table public.broadcasts drop constraint if exists broadcasts_status_check;
alter table public.broadcasts add constraint broadcasts_status_check
  check (status = any (array['draft','scheduled','sending','sent','failed','cancelled']));
