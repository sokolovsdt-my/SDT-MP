-- RPC для edge-функций чтобы прочитать cron-secret из vault.
-- Использует _get_secret (уже существующая SECURITY DEFINER функция).
-- Доступна ТОЛЬКО service_role — edge-функции работают под ним
-- (SUPABASE_SERVICE_ROLE_KEY в env). Для anon/authenticated — revoke.
create or replace function public._get_cron_secret()
returns text
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  return public._get_secret('service_role_key');
end;
$function$;

revoke all on function public._get_cron_secret() from public, anon, authenticated;
grant  execute on function public._get_cron_secret() to service_role;
