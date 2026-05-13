-- pg_cron job для авторассылки 'birthday'.
-- Каждый день в 07:00 UTC = 10:00 МСК.
-- Дёргает edge-функцию send-auto-broadcast с типом 'birthday'.
-- send_time из auto_broadcasts пока ИГНОРИРУЕТСЯ — cron всегда срабатывает в 10:00 МСК.
-- Если в будущем потребуется учитывать send_time per-row — переделаем cron на ежечасный
-- + проверка в edge.
--
-- Anti-spam обеспечен на уровне БД: UNIQUE(auto_id, recipient_id, run_date) в auto_broadcast_runs.
-- Если cron упал и перезапустится через 30 минут — повторно тем же людям ничего не уйдёт.

create or replace function public.process_auto_birthday()
returns int
language plpgsql security definer set search_path = public, extensions
as $$
declare
  v_key text;
  v_url text := 'https://momqnoeogfjjexwcwlpu.supabase.co/functions/v1/send-auto-broadcast';
begin
  if not pg_try_advisory_lock(hashtext('process_auto_birthday')) then
    raise notice 'process_auto_birthday: previous run still in progress, skip';
    return 0;
  end if;

  v_key := public._get_secret('service_role_key');
  if v_key is null then
    raise warning 'service_role_key не настроен в vault — auto-birthday не отправляется. select vault.create_secret(''<KEY>'', ''service_role_key'');';
    perform pg_advisory_unlock(hashtext('process_auto_birthday'));
    return 0;
  end if;

  perform net.http_post(
    url     := v_url,
    body    := jsonb_build_object('type', 'birthday'),
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || v_key
    )
  );

  perform pg_advisory_unlock(hashtext('process_auto_birthday'));
  return 1;
end;
$$;

revoke all on function public.process_auto_birthday() from anon, public, authenticated;

-- Регистрируем cron — idempotently.
do $$
declare v_jobid bigint;
begin
  select jobid into v_jobid from cron.job where jobname = 'auto-birthday-daily';
  if v_jobid is not null then
    perform cron.unschedule(v_jobid);
  end if;
  perform cron.schedule(
    'auto-birthday-daily',
    '0 7 * * *',  -- 07:00 UTC = 10:00 МСК ежедневно
    $cron$ select public.process_auto_birthday() $cron$
  );
end$$;
