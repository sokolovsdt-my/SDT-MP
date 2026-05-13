# Supabase

Серверная часть проекта: edge‑функции, миграции БД, RPC, RLS политики.

Этот каталог — **источник истины** для серверного кода. Изменения в Supabase Dashboard вне git считаются drift'ом и должны переноситься сюда.

## Структура

```
supabase/
└── functions/
    └── send-broadcast/      # отправка пушей FCM + email Resend
        └── index.ts
```

Миграции БД и определения RPC‑функций ранее жили только в Supabase. Постепенно дублируем сюда в виде `supabase/migrations/<timestamp>_<name>.sql` — для reproducibility и code review. Новые миграции теперь сразу коммитим в репо тем же SQL, который применяется через MCP `apply_migration`.

## Workflow для edge‑функций

**Source of truth:** файлы в этом каталоге.

**Как менять:**
1. Правишь `supabase/functions/<name>/index.ts` локально.
2. Коммитишь в git.
3. Деплоишь:
   - Через Supabase MCP (текущий путь): `apply_migration` для DDL, `deploy_edge_function` для функций.
   - Или через Supabase CLI (если установлен): `supabase functions deploy <name> --project-ref momqnoeogfjjexwcwlpu`.

Версия в Dashboard и версия в репо должны совпадать. После деплоя git‑коммит — обязательная часть процесса.

## Edge‑функции

### `send-broadcast`
Отправка пушей (FCM HTTP v1) и email (Resend) для строки `broadcasts`. Подробнее в шапке файла `functions/send-broadcast/index.ts`.

**Env‑переменные** (Dashboard → Edge Functions → send-broadcast → Secrets):
- `FCM_SERVICE_ACCOUNT_JSON` — JSON service account из Firebase Console.
- `RESEND_API_KEY` — API key из Resend.
- `RESEND_FROM` — verified отправитель Resend (например `'SDT <noreply@sdt.example>'`).

`SUPABASE_URL` и `SUPABASE_SERVICE_ROLE_KEY` подставляются платформой автоматически.

**Vault‑секрет** (для pg_cron, который дёргает функцию для scheduled рассылок):
```sql
select vault.create_secret('<SERVICE_ROLE_KEY>', 'service_role_key');
```

### `create-staff` и `telegram-login`
Существуют в Supabase, но исходники пока не в репо. Перенести при следующем касании.
