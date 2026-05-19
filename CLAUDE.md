# CLAUDE.md — SDT Mobile/Web App

Веб-приложение студии танца **Sokolov Dance Theatre (SDT)**: личный кабинет клиента (mobile-first PWA) + админка для преподавателей, администраторов, управляющих и владельца. Один SPA, три UI-режима, общий бэкенд на Supabase.

---

## Стек

- **Frontend:** React 19, Vite 8, react-router-dom 7
- **Язык:** JavaScript + JSX (TypeScript НЕ используется)
- **Бэкенд:** Supabase (Postgres + Auth + Storage + Edge Functions + **RPC**)
- **Пуши:** Firebase Cloud Messaging (web push)
- **Деплой:** Vercel (SPA-fallback в [vercel.json](vercel.json))
- **Линт:** ESLint flat config ([eslint.config.js](eslint.config.js)) — `no-unused-vars` с исключением `^[A-Z_]`
- **Стили:** **только inline `style={{}}`** в JSX. Никаких CSS-классов, Tailwind, styled-components, CSS-модулей. Глобальный [src/index.css](src/index.css) почти не используется (наследие шаблона Vite — можно игнорировать).
- **Sanitization:** `dompurify ^3.4.2` — единственная UI-зависимость кроме React/Supabase/Firebase. Доступна через [src/utils/safeHtml.js](src/utils/safeHtml.js).
- **Тестов нет**, фреймворка для тестов в зависимостях тоже нет. Серверная логика покрыта Postgres `do $$ ... assert ... $$`-смоук-тестами при разработке RPC, постоянных тестов нет.

### Скрипты

```
npm run dev      # vite, dev-сервер
npm run build    # vite build
npm run preview  # vite preview
npm run lint     # eslint .
```

### Переменные окружения (Vite, `import.meta.env`)

- `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
- `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_SENDER_ID`, `VITE_FIREBASE_APP_ID`, `VITE_FIREBASE_VAPID_KEY`

Supabase project id виден в URL edge functions: `momqnoeogfjjexwcwlpu.supabase.co`. Firebase project id — `sdt-mp`. Эти значения и ключ FCM в SW захардкожены в [public/firebase-messaging-sw.js](public/firebase-messaging-sw.js).

---

## Структура файлов

```
src/
├── main.jsx              # точка входа, StrictMode
├── App.jsx               # роутинг, RootRedirect по роли, Login (Telegram-бот / magic-link / пароль)
├── supabase.js           # createClient — единственный экспорт `supabase`
├── firebase.js           # requestPermission / onMessageListener для FCM
├── index.css, App.css    # лучше не править (наследие шаблона)
│
├── pages/                # клиентская мобилка (maxWidth 480, BottomNav)
│   ├── Home.jsx          # приветствие, следующее занятие, статы, бонусы, новости
│   ├── Schedule.jsx      # календарь, запись на занятие, проверка абонемента
│   ├── Shop.jsx          # каталог: абонементы / события / мерч / индивы
│   ├── News.jsx          # лента новостей, теги
│   ├── Team.jsx          # карточки преподавателей, запись на индив-слоты
│   ├── Bonus.jsx         # призы за SDTшки
│   └── Profile.jsx       # профиль, мои занятия, мои индивы (MyIndivs), статистика, рефералка, FCM-подписка
│
├── admin/                # админ-панель (sidebar 240px) + панель преподавателя
│   ├── AdminLayout.jsx           # каркас: aside-меню + Outlet
│   ├── AdminDashboard.jsx        # сводка (выручка для owner, занятия дня, ДР, новые клиенты)
│   ├── AdminClients.jsx, AdminClientCard.jsx
│   ├── AdminStaff.jsx, AdminStaffCard.jsx
│   ├── AdminSchedule.jsx         # календарь сетки занятий
│   ├── AdminCatalog.jsx          # абонементы, услуги, события, мерч, индив-пакеты
│   ├── AdminGroups.jsx           # учебные группы
│   ├── AdminCashbox.jsx          # касса, продажи. Принимает ?client=<uuid> для предзаполнения клиента (используется из NoBasisModal в AttendancePanel)
│   ├── AdminFinance.jsx          # P&L, расходы, зарплаты, индивы (выручка/топ препов/загрузка слотов), лояльность (owner-only)
│   ├── AdminTasks.jsx            # задачи (kanban-подобный) + вкладка «Индивы» (модерация заявок)
│   ├── AdminBroadcasts.jsx       # рассылки FCM + Resend: новая (фильтры аудитории, тест-отправка), шаблоны, авторассылки (вкладка «Авто» с расписанием), история
│   ├── AdminNews.jsx, AdminPrizes.jsx
│   ├── AttendancePanel.jsx       # отметка посещаемости на занятии (списание визитов)
│   └── TeacherPanel.jsx          # отдельный UI для роли teacher (/teacher)
│
├── components/
│   ├── BottomNav.jsx     # нижняя навигация клиента (6 пунктов, семантичные <button>)
│   ├── RequireRole.jsx   # внешний гард для /admin и /teacher (делает useUserRole)
│   ├── RequireSubRole.jsx # внутренний гард — читает роль из AdminRoleContext
│   ├── AvatarUpload.jsx  # загрузка в bucket `avatars`
│   └── TeacherIndivDetail.jsx # общий блок «Пакеты»/«Записаться» для Shop и Team
│
├── contexts/
│   └── AdminRoleContext.jsx  # роль на всё /admin/*: один useUserRole, дочерние не дёргают
│
├── hooks/
│   └── useUserRole.js    # роль из profiles.role + флаг error
│
├── utils/
│   ├── tz.js             # МСК-границы суток + parseMskNaive/mskParts для чтения starts_at
│   ├── safeHtml.js       # обёртка над DOMPurify для dangerouslySetInnerHTML
│   ├── supabaseEdge.js   # edgeUrl(fn) — URL для Supabase Edge Functions из env
│   └── plural.js         # plural(n, ['день','дня','дней']) — русские склонения
│
└── assets/               # hero.png и др. статика

public/
├── manifest.json                  # PWA, theme_color #BFD900
├── firebase-messaging-sw.js       # SW для фоновых пушей FCM (регистрируется явно в main.jsx)
├── icon-192.png, icon-512.png, favicon.svg, icons.svg

.env.example                       # шаблон для VITE_* переменных
                                   # для git worktree: cp /path/to/main/.env.local ./.env.local

supabase/                          # серверный код в git (source of truth)
├── README.md                      # workflow деплоя через MCP / CLI, env-переменные, vault
├── functions/
│   ├── send-broadcast/index.ts        # отправка обычных рассылок (FCM + Resend)
│   └── send-auto-broadcast/index.ts   # отправка авторассылок (тип 'birthday')
└── migrations/                    # SQL-миграции с timestamp в имени
    └── *.sql                      # старые миграции живут только в Supabase (исторически),
                                   # новые сразу коммитим сюда параллельно apply_migration
```

---

## Роутинг и роли

Роль читается из `profiles.role` в [src/hooks/useUserRole.js](src/hooks/useUserRole.js). Хук возвращает `{ role, loading, error }`. Значения роли:

- `client` (по умолчанию) — мобильный UI с BottomNav, страница выбирается через `useState`+`localStorage('activePage')`, **роутера у клиента нет**.
- `teacher` — попадает на `/teacher` ([src/admin/TeacherPanel.jsx](src/admin/TeacherPanel.jsx)).
- `admin` / `manager` / `owner` — на `/admin/dashboard`, layout [src/admin/AdminLayout.jsx](src/admin/AdminLayout.jsx).

Сотрудник может одновременно иметь `staff_roles.role='teacher'` — тогда в админке появляется кнопка «🎓 Режим преподавателя».

Гард уровня роута — `<RequireRole allow={['owner', ...]}>` ([src/components/RequireRole.jsx](src/components/RequireRole.jsx)). Финансы доступны только `owner`. Расписание и задачи — всем, включая `teacher`.

**Важно:** при транзитной ошибке (сеть, RLS deny) `useUserRole` возвращает `error: true, role: null`. `RequireRole` и `RootRedirect` в этом случае показывают «Не удалось проверить доступ» с кнопкой «Обновить», **а не понижают админа до клиентского UI** — это была одна из критичных уязвимостей и она закрыта. Не возвращай старое поведение `role='client'` на ошибке.

### Авторизация

Три способа в [src/App.jsx:138](src/App.jsx:138) (`Login`):

1. **Telegram-бот** `@sdt_auth_bot` через edge function `telegram-login` (поллинг каждые 2 сек по сгенерированному коду).
2. **Magic link** — `supabase.auth.signInWithOtp`. Жёсткий чёрный список: сотрудники из массива `STAFF` входят только по паролю.
3. **Email+пароль** — `supabase.auth.signInWithPassword`.

---

## Supabase: таблицы (извлечено из кода)

Все запросы идут напрямую через `supabase.from('...')` — слоя репозиториев/сервисов нет.

### Профили и роли

- **profiles** — `id, full_name, first_name, last_name, patronymic, avatar_url, bio, email, phone, role, birth_date, ad_source, ad_source_custom, bonus_rubles, bonus_coins, push_token, sort_order, telegram_id, telegram_username, created_at`. Основная таблица всех пользователей. `id` = `auth.users.id`. CHECK на `role`: `client/teacher/admin/manager/owner/other`. Изменение `role` защищено триггером `prevent_unauthorized_role_change` — менять можно только через RPC или с админским JWT.
- **staff_roles** — `staff_id, role, is_primary`. Доп. роли сотрудника (например, админ + преподаватель).
- **staff_info** — `staff_id, hire_date, phone, contact`.
- **salary_tiers** — `staff_id, role_context, tier_type, amount, tiers (jsonb), is_active`. **Источник истины для ставок.** `tier_type ∈ {salary, per_lesson, per_lesson_tiered, percentage}`. Для `per_lesson_tiered` ставка зависит от количества учеников — массив в `tiers`.
- **staff_salary_settings** — `staff_id, type, amount, is_active`. **Legacy**, в проде 1 случайная строка, никем не пополняется. Не используй, если только не правишь миграцию. Реальные ставки — в `salary_tiers`.
- **staff_absences** — `staff_id, absence_date, reason`.

### Абонементы и каталог продаж

- **products** — `id, type, name, description, price, available_from_day, available_to_day, is_active, sort_order`. Типы: абонемент, услуга, событие, мерч, индив.
- **product_subscriptions** / **product_subscription_groups** / **product_subscription_teachers** — конфиг подписочных продуктов: разрешённые группы и преподаватели.
- **subscriptions** — `id, student_id, subscription_id, type, visits_total, visits_used, expires_at, activated_at, is_frozen, sale_id, created_at`. **Безлимит:** `visits_total IS NULL`. **Бессрочный:** `expires_at IS NULL`.
- **subscription_allowed_groups** — какие группы покрывает абонемент.
- **subscription_date_changes** — аудит изменений дат/визитов.
- **indiv_subscriptions** — отдельный учёт индивов: `client_id, teacher_id, package_id, visits_total, visits_used, price, teacher_rate, activated_at, expires_at, is_frozen, sale_id, created_by`. Создаётся `create_sale` при `product_type='indiv'`. **Безлимит:** `visits_total IS NULL`. **Бессрочный:** `expires_at IS NULL`.
- **indiv_packages** — `id, teacher_id, name, visits_count, price, teacher_rate, duration_days, sort_order, is_active`. Пакеты у конкретного преподавателя. **Единственный источник истины каталога индивов** — и магазин (Shop/Team), и касса (AdminCashbox) читают отсюда. Старая связка `products(type='indiv') + product_indivs` пустая, не используется (мертвый код в схеме).

### Расписание и индивы

- **schedule** — `id, title, starts_at, ends_at, hall, group_id, teacher_id, indiv_student_id, event_id, lesson_type, repeat_rule, repeat_id, is_cancelled, created_at`. `lesson_type='indiv'` для индивидуальных. `starts_at`/`ends_at` — `timestamp WITHOUT time zone`, **хранятся в МСК naive** (как админ ввёл в форме). RPC `create_schedule_event` и `confirm_indiv_request` пишут как пришло, без TZ-конверсии. Серверные `*.created_at` (всё что через `default now()`) — наоборот UTC naive.
- **schedule_history** — аудит. `action`-значения: `attendance_marked`, `cancelled`, и др.
- **bookings** — `id, student_id, schedule_id, subscription_id, status, created_at`. Статусы: `booked`, `cancelled`.
- **attendance** — `id, schedule_id, student_id, basis, status, subscription_id, indiv_subscription_id, subscription_expires, teacher_id, marked_by, marked_at, note, created_at`. `basis ∈ {subscription, single, trial, indiv, event, none}`, `status ∈ {present, absent, cancelled, transferred}`. **`UNIQUE(schedule_id, student_id)`** — UPSERT через `ON CONFLICT` безопасен, дубли невозможны. `subscription_id` — FK на `subscriptions` (для basis=subscription/single), `indiv_subscription_id` — FK на `indiv_subscriptions` (для basis=indiv). Списание визита в `mark_attendance` идёт в ту таблицу, на которую указывает соответствующий id.
- **teacher_substitutions** — `schedule_id, original_teacher_id, substitute_teacher_id`.
- **teacher_slot_dates** — `id, teacher_id, date, start_time, end_time, is_active`. Реальные слоты на 30 дней; читают Shop/Team через общий [TeacherIndivDetail](src/components/TeacherIndivDetail.jsx), пишут AdminCatalog SlotsSection и TeacherPanel SlotsCalendar.
- **indiv_requests** — `id, client_id, teacher_id, package_id, subscription_id, slot_date, start_time, end_time, hall, status, schedule_id, reject_reason, created_by, created_at`. Статусы: `pending, confirmed, rejected, cancelled`. **`package_id`** — снапшот выбранного на момент записи `indiv_packages.id` (FK), для аналитики. **`subscription_id`** — конкретный `indiv_subscriptions.id`, который используется при подтверждении/проведении (FK). **Partial UNIQUE `(teacher_id, slot_date, start_time) WHERE status IN ('pending','confirmed')`** — БД-гарантия от double-booking.

### Группы

- **groups** — `id, name, description, color, is_closed, teacher_id`.

### События

- **events** — `id, name, type, description, image_url, hall, teacher_id, max_participants, price, is_available_online, allow_client_booking, age_info, sort_order, is_active`.
- **event_dates** — `id, event_id, date_start, date_end, time_start, time_end, label, sort_order`.
- **event_price_tiers** — динамический прайс по номеру участника.
- **event_registrations** — `event_id, client_id, status`.

### Мерч

- **merch_products** — `id, name, description, image_url, category, is_active, is_available_online, sort_order`.
- **merch_variants** — `product_id, size, color, stock_count, price`.
- **merch_images** — галерея.
- **merch_preorders** — `product_id, client_id, variant_id, quantity, status`.

### Новости

- **news** — `id, title, body, image_url, card_bg, title_color, body_color, tag, tag_color, tag_text_color, is_pinned, is_active, published_at, created_by, created_at`.
- **news_tags** — `value, label, color`.
- **news_views** — `news_id, user_id, viewed_at`.
- **news_history** — аудит.

### Задачи

- **tasks** — `id, title, description, status, priority, client_id, created_by, deadline, created_at`. Статусы: `new, in_progress, postponed, problem` (и наверняка `done`/`closed`).
- **task_assignees** — `task_id, user_id` (многие-ко-многим).
- **task_clients** — связка задача↔клиент.
- **task_client_representatives** — представители клиента в задаче.
- **task_history** — аудит.

### Рассылки

- **broadcasts** — `id, title, content, channel ('push'|'email'|'push+email'), status ('draft'|'scheduled'|'sending'|'sent'|'failed'|'cancelled'), scheduled_at, sent_at, created_by, filter_type, filter_payload (jsonb — единый снимок фильтра подбора аудитории, читать вместо устаревших filter_* колонок)`.
- **broadcast_recipients** — `broadcast_id, client_id, is_excluded, delivered_at, failed_at, error`. Заполняется edge-функцией `send-broadcast`.
- **broadcast_templates** — `name, title, content, created_by`.
- **auto_broadcasts** — настройки авторассылок (пока type='birthday'): `is_active, channel, title, content, send_time, days_before, sent_count`. RLS: только admin/manager/owner.
- **auto_broadcast_runs** — журнал отправок авторассылок: `auto_id, recipient_id, run_date, sent_at, channels_sent, error` с `UNIQUE(auto_id, recipient_id, run_date)` (anti-spam).

### Финансы

- **sales** — `id, sale_date, client_id, product_id, product_type, product_name, teacher_id, price_original, discount_percent, discount_amount, discount_reason, bonus_rubles_used, bonus_coins_used, payment_method, amount_paid, acquiring_fee, total_net, payer_type, payer_representative_id, payer_name, receipt_id, comment, is_cancelled, cancelled_at, cancelled_by, created_by, created_at`. **Не учитывать отменённые: `is_cancelled = false`**. Один чек = несколько строк с общим `receipt_id`. CHECK на `payment_method` (`cash, bank, bank_transfer, online, bonus, bonus_only, coins, mixed, other`) и `product_type` (`subscription, service, indiv, merch, event, other`).
- **lesson_payments** — почасовая/поурочная оплата преподавателей. **`UNIQUE(schedule_id, staff_id)`** — UPSERT через `ON CONFLICT`.
- **staff_payments**, **staff_payments_history** — выплаты сотрудникам.
- **expenses**, **expense_categories**, **expense_subcategories** — расходы.
- **finance_settings** — `key, value` (KV).

### Бонусы и призы

- **prizes** — `id, name, description, image_url, coins_price, stock_count, badge_text, badge_color, sort_order, is_active`.
- **prize_requests** — `client_id, prize_id, status, handled_by, handled_at`. Статус `pending` показывается бейджем в меню.
- **bonus_history** — `student_id, type, amount, operation, reason, client_reason, created_by, created_at`. CHECK на `operation` (`credit/debit`) и `client_reason` (`manual_credit, manual_debit, prize, referral, subscription_payment, cancellation`). `type` свободный — по факту `coins` или `rubles`. Поля баланса (`bonus_rubles`, `bonus_coins`) живут прямо в `profiles` и **меняются только через RPC** (см. ниже).
- **client_loyalty** — `client_id, level` (`adept, loyal, edge, risk`).

### Прочее

- **client_comments**, **comment_history** — заметки по клиенту.
- **client_representatives** — родители/представители (для детских групп).

### Storage buckets

`avatars` (публичный, путь `${userId}.${ext}`), `events`, `merch`, `prizes`.

### Edge Functions

- **telegram-login** — выдача кода, поллинг подтверждения, выдача `hashed_token` для `verifyOtp`.
- **create-staff** — создание `auth.users` + строки в `profiles` от имени админа (используется и для добавления клиента в [AdminDashboard.jsx:134](src/admin/AdminDashboard.jsx:134)).
- **send-broadcast** — отправка рассылки. Принимает `{broadcast_id}`. CORS preflight обрабатывает (иначе `supabase.functions.invoke()` с Vercel падает «Failed to send a request»). Атомарно клеймит `broadcasts.status='sending'`, читает получателей + `profiles.push_token/email`, шлёт FCM HTTP v1 (требуется env `FCM_SERVICE_ACCOUNT_JSON`) и/или Resend (`RESEND_API_KEY`, `RESEND_FROM`). Обновляет `broadcast_recipients.delivered_at`/`failed_at`/`error` и `broadcasts.status='sent', sent_at=now()`. Возврат `{ok, sent_push, sent_email, failed}`. Вызывается из клиента при немедленной отправке и из pg_cron job для `status='scheduled' AND scheduled_at <= now()`. **Исходник в git**: [supabase/functions/send-broadcast/index.ts](supabase/functions/send-broadcast/index.ts). Workflow деплоя — в [supabase/README.md](supabase/README.md).
- **send-auto-broadcast** — отправка авторассылок (пока тип `birthday`). Принимает `{type:'birthday'}`. Читает `auto_broadcasts WHERE type AND is_active`, ищет клиентов у которых ДР через `days_before` дней (МСК, edge-case 29 февраля → 28 в невисокосный год), для каждого делает INSERT в `auto_broadcast_runs` с `UNIQUE(auto_id, recipient_id, run_date)` — anti-spam от повторных запусков cron. Затем FCM/Resend, обновляет `channels_sent`/`error` в run-row, инкрементит `auto_broadcasts.sent_count`. Возврат `{ok, sent, already_today, total_candidates}`. Исходник: [supabase/functions/send-auto-broadcast/index.ts](supabase/functions/send-auto-broadcast/index.ts).

### pg_cron

- **process-scheduled-broadcasts** (каждую минуту) — выбирает все `broadcasts` со `status='scheduled' AND scheduled_at <= now()` (до 50 за тик) и через `net.http_post` дёргает edge-функцию `send-broadcast` с заголовком `Authorization: Bearer <key из vault>`. Защищён `pg_try_advisory_lock` от наложения тиков. **В vault лежит приватный cron-secret** (не JWT — 32 случайных байта base64) под именем `service_role_key`. Раньше там был anon JWT, который является публичным ключом → любой пользователь сайта мог дёрнуть edge с этим JWT. После S1-аудита секрет регенерирован, edge-функции (`verify_jwt: false`) сверяют `Authorization Bearer` со значением из vault через `_get_cron_secret()` RPC (доступна только service_role). Альтернативный путь авторизации edge — user JWT с ролью admin/manager/owner (через `auth.getUser`). Внутри edge для DB-write используется `SUPABASE_SERVICE_ROLE_KEY` из env (auto-injected). Для регенерации секрета (если утёк): `update vault.secrets set secret = encode(extensions.gen_random_bytes(32), 'base64') where name='service_role_key';`.
- **auto-birthday-daily** (каждый день в 07:00 UTC = 10:00 МСК) — `process_auto_birthday()` дёргает `send-auto-broadcast` с `{type:'birthday'}`. Тоже использует service_role_key из vault. Anti-spam обеспечен на уровне БД: UNIQUE(auto_id, recipient_id, run_date) в `auto_broadcast_runs`.

### RPC-функции (Postgres `SECURITY DEFINER`)

Все денежные / визитные / отменяющие операции идут через RPC. Каждая функция:
- авторизуется через `auth.uid()`, проверяет роль вызывающего;
- блокирует задействованные строки `FOR UPDATE`;
- возвращает `json` вида `{ ok: true, ... }` либо `{ ok: false, error: '...', ... }`;
- доступна только `authenticated` (revoke от `anon`).

| RPC | Когда вызывать | Что делает |
|---|---|---|
| `complete_prize_request(p_req_id uuid)` | Админ жмёт «✅ Приз выдан» в [AdminPrizes](src/admin/AdminPrizes.jsx) | Атомарно: статус заявки → `completed`, `prizes.stock_count -= 1`, `profiles.bonus_coins -= price`, запись в `bonus_history`. Ошибки: `already_handled`, `out_of_stock`, `insufficient_balance`. |
| `admin_adjust_coins(p_client_id, p_delta int, p_reason text)` | Ручное начисление/списание SDTшек в карточке клиента в `AdminPrizes` | Атомарный сдвиг `bonus_coins` + запись `bonus_history` с `manual_credit/manual_debit`. Не пускает в минус. |
| `admin_adjust_rubles(p_client_id, p_delta int, p_reason text)` | Ручное начисление/списание бонусных рублей в карточке клиента в [AdminClientCard](src/admin/AdminClientCard.jsx) (`handleAddBonus`) | Копия `admin_adjust_coins` для `bonus_rubles`. Атомарно, FOR UPDATE на profiles, не пускает в минус. Ошибки: `invalid_delta`, `reason_required`, `client_not_found`, `insufficient_balance`. |
| `admin_update_subscription(p_sub_id, p_payload jsonb, p_reason text)` | «Изменить даты/визиты/заморозку подписки» в [AdminClientCard](src/admin/AdminClientCard.jsx) (`saveDateChange`) | Общий patch полей подписки: `activated_at`/`expires_at` (date|null), `visits_total` (int|null), `visits_used` (int≥0), `is_frozen` (bool). FOR UPDATE на subscriptions + аудит каждого изменённого поля в `subscription_date_changes`. Серверная валидация `visits_used <= visits_total`. Ошибки: `visits_used_negative`, `visits_used_exceeds_total`, `subscription_not_found`, `reason_required`. |
| `delete_lesson(p_schedule_id)` | «Удалить» одно занятие в [AdminSchedule](src/admin/AdminSchedule.jsx) (`handleDeleteEvent`) | Атомарно: возврат визитов (subscriptions И indiv_subscriptions) через хелпер `_refund_visits_for_lesson`, удаление `lesson_payments`, запись в `schedule_history`, `delete from schedule`. Раньше прямой `schedule.delete()` каскадил attendance/bookings — визиты не возвращались. |
| `delete_lesson_series(p_schedule_id, p_scope text)` | Модалка «Это занятие / Это и будущие / Всю серию» в [AdminSchedule](src/admin/AdminSchedule.jsx) (`handleSeriesChoice`) | Тоже что `delete_lesson` но для всей серии по `repeat_id`. `p_scope IN ('one','future','all')`. Возврат визитов суммарно. |
| `reschedule_lesson(p_schedule_id, p_new_starts_at, p_new_ends_at)` | «Перенести» в [AttendancePanel](src/admin/AttendancePanel.jsx) (`handleReschedule`) | Под `pg_advisory_xact_lock` по залу проверяет `hall_conflict` (исключая сам урок), обновляет `starts_at/ends_at`, пишет аудит. starts_at/ends_at — MSK naive. Ошибки: `invalid_time_range`, `lesson_cancelled`, `hall_conflict` (с `conflict_id` и `hall`). |
| `change_lesson_teacher(p_schedule_id, p_new_teacher_id)` | «Заменить препода» в [AttendancePanel](src/admin/AttendancePanel.jsx) (`handleChangeTeacher`) | Проверка что новый user — реально teacher (либо `profiles.role='teacher'`, либо `staff_roles.role='teacher'`). Откат уже сохранённой зарплаты (`delete from lesson_payments`), `update schedule.teacher_id`, аудит. Не путать с `assign_substitution` — та через `teacher_substitutions` (подмена без смены основного teacher_id). Ошибки: `same_teacher`, `teacher_not_found`, `not_a_teacher`, `lesson_cancelled`. |
| `mark_attendance(p_schedule_id, p_student_id, p_new_status, p_mark_as_trial?)` | Отметка посещаемости в [AttendancePanel](src/admin/AttendancePanel.jsx), [TeacherPanel](src/admin/TeacherPanel.jsx) и при переносе пробного в `TransferModal`. `p_mark_as_trial=true` — из `NoBasisModal` для пробных в групповых уроках | UPSERT в `attendance` через `ON CONFLICT`. **Главный инвариант:** переход в `present` для ЛЮБОГО типа урока (group/indiv/event) ВСЕГДА пересматривает basis заново — никогда не доверяет старой строке. Это закрывает класс багов «вчерашняя attendance с basis='subscription'/'event'/'indiv' позволяет present и сегодня, даже если основание уже не действует». Алгоритм: `p_mark_as_trial=true` → `trial`; при `new_status='present'` или отсутствии валидной existing записи — пересмотр по `lesson_type`: `indiv` (через `indiv_requests.subscription_id`, fallback — свежий активный пакет клиента у препода), `event` (актуальная `event_registrations`), иначе подбор активного абонемента под группу. Не-present переход с валидной existing записью (`basis≠none` И корректный id для типа) использует её — это нужно, чтобы корректно вернуть визит в ту же подписку, с которой списывали. **Гард `no_valid_basis`:** `present` с `basis='none'` отклоняется для любого типа. В ответ ошибки идёт `lesson_type` — клиент показывает «Нет оплаченного пакета на индив» для индив-уроков и общий текст «Нет действующего основания…» для прочих. При переходе в/из `present` корректирует `subscriptions.visits_used` ИЛИ `indiv_subscriptions.visits_used` атомарно (зависит от basis), с верхней границей: `out_of_visits` для обычных, `indiv_out_of_visits` для индив-пакетов. Учитель допускается только к своему/подменному уроку. Возврат включает `indiv_subscription_id`, `indiv_visits_used`, `indiv_visits_total`, `indiv_delta`. |
| `cancel_lesson(p_schedule_id)` | «✕ Отменить занятие» в [AttendancePanel](src/admin/AttendancePanel.jsx) | Помечает урок `is_cancelled=true`, делегирует возврат визитов хелперу `_refund_visits_for_lesson` (он же используется в `delete_lesson`/`delete_lesson_series`), удаляет `lesson_payments` за этот урок, пишет в `schedule_history`. **Логика возврата (S9):** для каждой present-attendance смотрим живая ли подписка. **Живая** (не frozen и `expires_at>=today`) → `visits_used--`. **Мёртвая** → визит конвертируется в `bonus_rubles` по цене `floor(amount_paid/visits_total)` (для индивов — `floor(indiv_subscriptions.price/visits_total)`); кредит идёт в `profiles.bonus_rubles` + запись в `bonus_history(client_reason='cancellation')`. Это закрывает класс «визит висит на мёртвой подписке». В ответ: `refunded_visits`, `refunded_indiv_visits`, **`converted_to_rubles`** (сумма компенсаций), **`compensations`** (jsonb-массив с `student_id`/`subscription_id`/`amount_rubles`/`kind='subscription'\|'indiv'`), `removed_payments`. |
| `create_sale(p_payload jsonb)` | «Пробить продажу» в [AdminCashbox](src/admin/AdminCashbox.jsx) и `SaleModal` в [AdminClientCard](src/admin/AdminClientCard.jsx) | Один вызов вместо sales.insert + profiles.update + bonus_history.insert + subscriptions/indiv_subscriptions.insert + subscription_allowed_groups.insert. **Целочисленная разбивка сумм по позициям** (остаток в первую строку — сумма по строкам = общая). Проверка `bonus_rubles >= used`. `expires_at` для подписок считается из `product_subscriptions.duration_days` сервером, для индивов — из `indiv_packages.duration_days`. **При наличии в чеке позиций `subscription`/`service` `selected_group_ids` обязателен** — иначе `groups_required`. **Для `product_type='indiv'`** `product_id` должен указывать на активный `indiv_packages.id` (иначе `indiv_package_required` / `indiv_package_not_found`); сервер создаёт строку в `indiv_subscriptions` с `teacher_id`/`visits_total`/`teacher_rate` из пакета. **`sales.product_id` больше не имеет FK** (т.к. для индивов хранит id из `indiv_packages`, для остальных — из `products`); тип определяется `product_type`. |
| `cancel_sale(p_sale_id, p_cancel_whole_receipt bool=true)` | «Отменить» в [AdminFinance](src/admin/AdminFinance.jsx) | Отменяет весь чек по `receipt_id`, замораживает связанные подписки и индив-пакеты (`is_frozen=true` + `expires_at=today-1` + аудит в `subscription_date_changes`). **Пропорциональный возврат бонусов (S8):** по каждой строке считается `coefficient_used` — `visits_used/visits_total` (visits-based), `(today-activated_at)/(expires_at-activated_at)` (time-based безлимит), `0` (бессрочный или услуга без подписки). Возврат строки = `floor(bonus_rubles_used*(1-coef))`. Сумма возврата кредитуется в `bonus_rubles` + reversal в `bonus_history`. В ответе: `refunded_bonus_rubles`, `full_bonus_paid` (сколько изначально было оплачено бонусами), `refund_breakdown` (jsonb по позициям с `sale_id`/`product_name`/`coefficient_used`/`refund`), `visits_already_used`, `new_balance`. |
| `save_lesson_salary(p_schedule_id)` | «📊 Рассчитать зарплату» / «✅ Подтвердить» в [AttendancePanel](src/admin/AttendancePanel.jsx) | Сервер сам считает `paid_students` из `attendance`, подбирает тариф из `salary_tiers` (приоритет `per_lesson_tiered → per_lesson`), учитывает `teacher_substitutions`, делает UPSERT в `lesson_payments` + INSERT в `schedule_history`. |
| `create_schedule_event(p_payload jsonb)` | «Сохранить» в `ScheduleForm` [AdminSchedule](src/admin/AdminSchedule.jsx) | Атомарное создание занятия или серии. Клиент передаёт МСК-naive timestamps в `dates[]`, RPC пишет как есть (схема MSK naive — без конверсии). `pg_advisory_xact_lock(hall)` сериализует все вставки в зал — TOCTOU закрыт. Конфликт хотя бы на одной дате серии → ничего не вставится (атомарный rollback). Ошибки: `hall_conflict` с массивом `conflicts`, `no_dates`, `invalid_dates`. |
| `assign_substitution(p_schedule_id, p_substitute_teacher_id, p_reason?)` | Модалка «Замена преподавателя» в [AdminSchedule](src/admin/AdminSchedule.jsx) | UPSERT в `teacher_substitutions` через `UNIQUE(schedule_id)` + UPDATE `schedule.teacher_id` (для UX-консистенции рендера) + INSERT в `schedule_history` — всё в одной транзакции под `FOR UPDATE`. Ошибки: `same_teacher`, `lesson_cancelled`, `lesson_not_found`. |
| `confirm_indiv_request(p_request_id, p_hall)` | «Подтвердить и создать занятие» в `HallModal` [AdminTasks](src/admin/AdminTasks.jsx) | Атомарно: проверка зала под `advisory_xact_lock`, INSERT в `schedule` (МСК naive, без конверсии), UPDATE `indiv_requests` (status, hall, schedule_id), запись в `schedule_history`. Title из `profiles.full_name` клиента. Ошибки: `hall_conflict`, `already_handled`, `invalid_hall`. |
| `preview_lesson_salary(p_schedule_id)` | Кнопка «📊 Рассчитать зарплату» в [AttendancePanel](src/admin/AttendancePanel.jsx) | Read-only зеркало `save_lesson_salary`: считает `paid_students` и `amount` ровно той же формулой, что и save, но без UPSERT в `lesson_payments` и без записи в `schedule_history`. Гарантирует, что предпросмотр и фактическое сохранение совпадают. |
| `transfer_trial(p_schedule_id, p_target_schedule_id, p_student_id)` | `TransferModal` в [AttendancePanel](src/admin/AttendancePanel.jsx) | Атомарно: UPSERT attendance исходного урока со status='transferred' (если строки не было — basis='trial') + INSERT booking на новое занятие. Идемпотентность по `(target, student, 'booked')` — повторный вызов не дублирует. Раньше был двухшаговый flow с work-around на сбой второго запроса. |
| `create_indiv_request(p_teacher_id, p_slot_date, p_start_time, p_end_time)` | «Записаться» в `TeacherDetail` ([Team.jsx](src/pages/Team.jsx)/[Shop.jsx](src/pages/Shop.jsx)) | Серверная запись клиента на индив-слот. Проверяет: `auth.uid()` есть, время в будущем (МСК), `end > start`, слот существует в `teacher_slot_dates` и активен, нет другой активной заявки на этот же `(teacher_id, slot_date, start_time)`. Под `pg_advisory_xact_lock` по этим трём полям + partial UNIQUE-индекс — TOCTOU закрыт. Подбирает активный `indiv_subscriptions` клиента у препода (приоритет: безлимит → дальний expires → свежий) и пишет его id в `indiv_requests.subscription_id` + `package_id` (снапшот). Возврат `{ok, request_id, has_package, subscription_id}`. Ошибки: `invalid_params`, `invalid_time_range`, `slot_in_past`, `slot_not_found`, `slot_taken`, `already_booked_by_you`. |
| `cancel_indiv_request(p_request_id, p_reason text default null)` | Кнопка «Отменить» в `MyLessons` ([Profile.jsx](src/pages/Profile.jsx))/`TeacherDetail`; «Отклонить»/«Отменить занятие» в [IndivRequestCard (AdminTasks.jsx)](src/admin/AdminTasks.jsx) | Отмена pending/confirmed-заявок. **Клиент** (`uid == client_id`): только свои, для `confirmed` — 12-часовой барьер; статус → `cancelled`. **Админ** (`admin/manager/owner`): любая заявка, без барьера; `pending → 'rejected'`, `confirmed → 'cancelled'`. В обоих случаях, если есть `schedule_id`, занятие ставится `is_cancelled=true` с записью в `schedule_history`. `p_reason` опционально пишется в `reject_reason`. Ошибки: `not_authenticated`, `forbidden`, `request_not_found`, `not_cancellable` (с `current_status`), `too_late` (с `hours_left`, только клиент). |
| `recipients_for_broadcast(p_filters jsonb)` | «👥 Подобрать получателей» в [AdminBroadcasts](src/admin/AdminBroadcasts.jsx) | Серверный подбор аудитории рассылки — один SQL вместо N+1 запросов на клиенте. Принимает JSON с любой комбинацией: `product_ids[]`, `purchase_from/to`, `no_active_sub`, `group_ids[]`, `subscription_status` ('active'/'expiring'/'expired'), `ltv_min/max`, `age_min/max`, `last_visit_days` (по `attendance.marked_at` со `status='present'`), `loyalty_levels[]` (с поддержкой `'none'` для клиентов без записи в `client_loyalty`), `push_filter` ('with_push'/'without_push'), `registered_days`, `birthday_days` (с edge case 29 февраля → 28 февраля в невисокосный год), `exclude_received_days` (исключить попавших в `broadcast_recipients` за N дней). Возвращает SETOF (id, full_name, email, phone, push_token). Доступна `admin/manager/owner`. Тот же payload сохраняется в `broadcasts.filter_payload` как снимок фильтра. |
| `cancel_booking(p_booking_id)` | «Отменить ✕» в [Schedule.jsx](src/pages/Schedule.jsx) (`handleCancel`) и `MyLessons.handleCancel` в [Profile.jsx](src/pages/Profile.jsx) для booking-ветки | Отмена записи на групповое занятие. **Клиент** (`uid == student_id`): 12-часовой барьер по `schedule.starts_at` (MSK naive vs `now() at time zone 'Europe/Moscow'`). **Админ** (`admin/manager/owner`): без барьера. UPDATE `bookings.status='cancelled'`. Защита в БД: триггер `prevent_client_booking_modifications` BEFORE UPDATE на `bookings` дублирует те же проверки для прямых UPDATE через PostgREST (различает прямой клиент vs SECURITY DEFINER по `current_user='authenticated'`). Ошибки: `booking_not_found`, `forbidden`, `already_cancelled`, `too_late` (с `hours_left`). |
| `request_prize(p_prize_id)` | Кнопка «Хочу! 🎁» в [Bonus.jsx](src/pages/Bonus.jsx) (`PrizesTab.handleRequest`) | Серверная подача заявки на приз. Проверки: `prizes.is_active`, `stock_count > 0` (или `NULL`), `profiles.bonus_coins >= prize.coins_price`, нет другой `pending`-заявки на тот же приз у того же клиента. Под `FOR UPDATE` на `prizes` и `profiles`. INSERT в `prize_requests(status='pending')`. RLS-полис `"prize_requests: client create"` снят — прямой INSERT клиентом теперь блокируется. Ошибки: `prize_not_found`, `prize_inactive`, `out_of_stock`, `insufficient_balance` (с balance/price), `already_pending`. |
| `register_push_token(p_token)` | «Включить уведомления» в [Profile.jsx](src/pages/Profile.jsx) и push-banner в [Schedule.jsx](src/pages/Schedule.jsx) | Регистрация FCM-токена с защитой от перекрёстных push. Атомарно: обнуляет `push_token` у всех чужих профилей где `push_token=p_token`, затем UPDATE `push_token` на своём. Возврат `detached_from` — сколько чужих профилей расцепили. Минимальная валидация: длина >= 20 (FCM-токены гораздо длиннее). Ошибки: `not_authenticated`, `invalid_token`. |
| `update_my_profile(p_payload jsonb)` | «Сохранить» в редакторе профиля [Profile.jsx](src/pages/Profile.jsx) (`handleSave`) и [AvatarUpload.jsx](src/components/AvatarUpload.jsx) после загрузки аватара | Patch собственного профиля клиентом/учителем. **Whitelist полей**: `first_name`/`last_name`/`patronymic`/`avatar_url`/`bio`/`ad_source`/`ad_source_custom` — перезаписываются свободно; `full_name` пересобирается из ФИО. **Set-once**: `birth_date`/`email`/`phone` — если в БД уже не NULL, попытка изменить даёт `birth_date_already_set`/`email_already_set`/`phone_already_set` (изменения только через админа). Это закрывает фрод «поставить ДР на завтра → авторассылка». Поля **никогда не доступные** клиенту (`role`/`bonus_*`/`telegram_*`/`sort_order`) — защищены триггером `prevent_unauthorized_profile_fields` (см. ниже), сам RPC их не пишет. Триггер пропускает RPC SECURITY DEFINER через `current_user <> 'authenticated'`, поэтому существующие денежные RPC, меняющие `bonus_*`, продолжают работать. Ошибки: `invalid_payload`, `profile_not_found`, `birth_date_already_set`, `email_already_set`, `phone_already_set`. |

**Общая модель ошибок:** `not_authenticated`, `forbidden`, `<resource>_not_found`, `lesson_cancelled`, `not_your_lesson` (для teacher), `already_handled` / `already_cancelled`. Все клиентские обработчики имеют словарь `{ error_code: 'русское сообщение' }` и `alert()` на неизвестный код. Сохраняй этот паттерн при добавлении новых RPC.

### Особенности запросов

- FK-алиасы в join: `teacher:profiles!schedule_teacher_id_fkey(full_name)`, `package:indiv_packages(name)` и т.д.
- Часовой пояс для дат `slot_date` и т.п. — **Europe/Moscow**. В БД две конвенции для `timestamp WITHOUT time zone`:
  - **UTC naive** (`sales.sale_date`, все `*.created_at`, `attendance.marked_at` — серверный `default now()`). Фильтрация — `mskDayStartUtc(date)` / `mskDayEndUtc(date)`.
  - **MSK naive** (`schedule.starts_at`/`ends_at` — админ ввёл напрямую через форму, RPC и UPDATE сохраняют как есть). Фильтрация — `mskDayStartNaive(date)` / `mskDayEndNaive(date)`. Для фильтров «от сейчас» — `nowMskNaive()`, для произвольного момента — `toMskNaive(d)`.
  - **Не пиши `from + 'T00:00:00'`** для UTC-naive колонок — это даст границу в TZ браузера. Используй хелперы из [src/utils/tz.js](src/utils/tz.js).
- **Чтение `schedule.starts_at`/`ends_at` на клиенте — через `parseMskNaive(s)`** из [src/utils/tz.js](src/utils/tz.js), а не через голый `new Date(s)`. Голый парсер интерпретирует naive-строку как локальное время браузера — у админа из MSK работает по совпадению, у не-MSK даёт сдвиг 3ч на отображение, фильтры `>= now`, `isPast`, расчёт позиции в календарном гриде. Для МСК-частей (часы/минуты для `getEventStyle` и т.п.) — `mskParts(s)` возвращает `{y, m, d, h, mi}` именно в МСК, независимо от TZ браузера. Сортировки и расчёт длительности `(end - start)` через голый `new Date()` остаются корректны (порядок и разность одинаковых сдвигов не меняются).

---

## Договорённости по коду

### Общее

- **Только функциональные компоненты + хуки.** Без классов. Без `useReducer`/`context`/Redux — состояние локальное, поднимается через пропсы.
- **Все стили inline** через `style={{...}}`. Если нужен hover/анимация — `onMouseEnter`/`onMouseLeave` или встроенный `<style>{`@keyframes pulse{...}`}</style>` в конце компонента (см. [src/App.jsx:366](src/App.jsx:366)). Не вводи Tailwind/styled — это нарушит единый стиль файла.
- **Read-операции — прямо через `supabase.from(...)`** в компоненте, без слоя репозиториев/сервисов. `useEffect` → `async load()` → `setState` — это сознательный паттерн.
- **Мутации денег/визитов/учёта — ТОЛЬКО через RPC.** Изменение `profiles.bonus_rubles` / `profiles.bonus_coins` / `subscriptions.visits_used` / `prizes.stock_count` через прямой `update()` запрещено — у этих полей нет защиты от гонок, и read-modify-write на клиенте уже стоил нам нескольких критических багов (см. историю в `git log --grep='RPC'`). Если нужна новая денежная операция — заводи новую RPC по образцу [миграций Supabase](https://supabase.com/docs/guides/database/functions). Простые CRUD (новости, задачи, представители, расписание без денег) — пиши прямо.
- **Файлы крупные** (300–1500 строк) и содержат несколько вложенных компонентов одной фичи (например, `MyLessons`, `MyIndivs`, `MyStats`, `Referral` внутри [Profile.jsx](src/pages/Profile.jsx)). Это норма — не дроби без необходимости.
- **Язык интерфейса — русский.** Все строки UI, статусы, alert/confirm — по-русски. Допустимы эмодзи в UI-копи.
- **Комментарии в коде — по-русски**, чаще всего как разделители блоков: `// ─── Заголовок ──────────`.
- **localStorage используется как лёгкий «роутер»** для клиента: `activePage`, `lessons_tab`, `profileScreen`, `shop_cat`, `news_tag`.
- **Кнопки `confirm()` и `alert()`** для критичных действий — это нормально, не заменяй на кастомный модал без просьбы.
- **`session` пробрасывается пропсом** во все страницы; не дёргай `supabase.auth.getUser()` повторно без причины.
- **HTML от админов всегда через `safeHtml()`.** Любой `dangerouslySetInnerHTML` из новостей/рассылок/RichEditor должен идти через [src/utils/safeHtml.js](src/utils/safeHtml.js) (DOMPurify под капотом). Без этого утечка админ-аккаунта = stored XSS у всех клиентов.
- **Границы суток МСК — через хелперы из [src/utils/tz.js](src/utils/tz.js).** Для UTC-naive колонок (`sale_date`, `created_at`) — `mskDayStartUtc(todayMsk())`. Для MSK-naive (`schedule.starts_at`) — `mskDayStartNaive(todayMsk())`. Для фильтров «от сейчас» по `starts_at` — `nowMskNaive()`, **не** `new Date().toISOString()` (даст 3-часовое смещение, т.к. колонка MSK naive).
- **Защита от двойного клика** на любой мутирующей кнопке: локальный `if (saving) return` в начале handler + `disabled={saving}`. Особенно критично для денежных RPC, у которых RPC сама идемпотентна, но клиент может успеть отправить два запроса до ответа.

### Конвенции запросов

- Сначала проверка валидности (`if (!session?.user?.id) return`), затем `setLoading(true)`, потом запросы, затем `setLoading(false)`.
- Для счётчиков-бейджей в layout — `setInterval` + `window.addEventListener('focus', fetch)` (см. [AdminLayout.jsx:48](src/admin/AdminLayout.jsx:48)).
- Дата «сегодня» в МСК: `todayMsk()` из `utils/tz.js` (старое `toLocaleDateString('sv-SE', { timeZone: 'Europe/Moscow' })` теперь только внутри хелпера).
- Границы суток для фильтров: UTC-naive — `.gte('sale_date', mskDayStartUtc(from)).lte('sale_date', mskDayEndUtc(to))`. MSK-naive — `.gte('starts_at', mskDayStartNaive(from)).lte('starts_at', mskDayEndNaive(to))`.
- Деньги: `(Number(n) || 0).toLocaleString('ru-RU') + ' ₽'`.
- Время: `toLocaleTimeString('ru-RU', { hour:'2-digit', minute:'2-digit', timeZone:'Europe/Moscow' })` — таймзону указывай явно, даже если кажется что не нужна.
- `is_cancelled=false` для всех агрегаций `sales` — без этого фильтра отчёты включают отменённые продажи. Все денежные суммы на UI берут только активные строки.

### Паттерн вызова RPC на клиенте

```js
const { data, error } = await supabase.rpc('rpc_name', { p_arg: value })
if (error) { alert('Ошибка сети: ' + error.message); return }
if (!data?.ok) {
  const msg = {
    forbidden:         'Недостаточно прав',
    not_authenticated: 'Сессия истекла, войдите заново',
    // ... остальные специфичные для этой RPC коды
  }[data?.error] || `Не удалось выполнить: ${data?.error || 'неизвестная ошибка'}`
  alert(msg); return
}
// успех — используй data.* (new_balance, refunded_visits, ...)
```

### Что не делать

- Не добавлять TypeScript, JSX-классы, новые CSS-файлы, Tailwind, CSS-in-JS-библиотеки.
- Не вводить `useContext` / провайдеры без сильной причины — текущий код работает без них.
- Не заменять inline-стили на классы «для красоты».
- Не писать комментарии-описания того, что и так видно. Разделители `// ─── … ───` сохранять, если они уже есть.
- Не трогать `index.css` без явной просьбы — он почти везде не действует (`#root` имеет свой layout в JSX).
- **Не делать прямой `update` балансов / `visits_used` / `stock_count`** — только через RPC. См. раздел «RPC-функции» выше.
- **Не делать `delete + insert`** там, где можно UPSERT через `ON CONFLICT`. В `attendance` и `lesson_payments` уже есть нужные `UNIQUE`-constraints.
- **Не понижать `useUserRole` до `client` при ошибке.** Возвращай `error: true` — гарды покажут «обновить». Это закрытая критическая уязвимость.
- **Не использовать `staff_salary_settings`** для чтения ставок — она legacy и не наполняется. Реальные ставки в `salary_tiers`.

---

## Визуальный стиль

### Палитра

| Назначение | Цвет |
|---|---|
| **Основной акцент (бренд)** | `#BFD900` (limey) — кнопки, активные state'ы, бейджи, прогресс-бары |
| Акцент тёмный | `#6a7700` — текст на светлом limey-фоне |
| Акцент светлый фон | `#fafde8` — карточки бонусов/абонемента |
| Бордер limey | `#e8f0aa` |
| Основной текст | `#2a2a2a` |
| Текст 2 / heading | `#1f2024` (сайдбар админки), `#3a3a3a` |
| Текст серый / placeholder | `#BDBDBD`, `#888` |
| Фон страницы | `#F8F8F8` |
| Фон карточки | `#fff` |
| Бордеры | `#f0f0f0`, `#e8e8e8`, `#e0e0e0` |
| Делитель тонкий | `#f8f8f8`, `#f5f5f5` |
| Успех | `#27ae60` (текст), `#eafaf1` (фон), `#a9dfbf` |
| Ошибка/опасность | `#e74c3c` (текст), `#fdecea` (фон) |
| Предупреждение | `#f39c12` (текст), `#fef9e7` (фон) |
| Инфо / ссылка | `#2980b9` (текст), `#e8f4fd` (фон) |
| Telegram-кнопка | `#229ED9` |
| Доп. фиолетовый | `#8e44ad` (текст), `#f5eef8` (фон), `#7B1FA2` |
| Сайдбар-фон | `#1f2024`, бордеры `#2a2b30` |

### Типографика

- Везде `fontFamily: 'Inter,sans-serif'` (Inter в проект не подгружается шрифтовым файлом — браузер берёт системный fallback).
- Заголовки: `fontWeight: 300` для крупных «лёгких» цифр (статы), `600`/`700` для CTA и активных табов.
- Размеры (типичные): мобильные карточки 13–15px, подписи 10–11px, заголовки экрана 16–22px, hero-цифры 22–28px (`fontWeight: 300`).
- ALL-CAPS подписи: `fontSize: 9–11px, letterSpacing: '0.06–0.12em', textTransform: 'uppercase'`.

### Формы и компоненты

- **Radius:** `8` (кнопки в админке), `10–12` (инпуты), `14–16` (карточки), `22` (hero-карточка «Следующее занятие»).
- **Кнопка primary:** `background:'#BFD900', color:'#2a2a2a', fontWeight:700, padding:'13px', borderRadius:12`.
- **Кнопка secondary:** `background:'transparent', border:'1px solid #e0e0e0', color:'#555/#888'`.
- **Инпут:** `padding:'12px 14px', border:'1px solid #e8e8e8', borderRadius:12, boxSizing:'border-box', fontFamily:'Inter,sans-serif'`.
- **Статус-бейдж:** маленькая капсула — text-цвет + светлый bg той же гаммы (паттерн `{ status: { label, color, bg } }`).
- **Карточка:** `background:'#fff', borderRadius:14, border:'1px solid #f0f0f0', padding:20, marginBottom:16` (см. константу `cardStyle` в [AdminDashboard.jsx:5](src/admin/AdminDashboard.jsx:5)).
- **Тёмная hero-карточка** (для «следующего занятия» и т.п.): `background:'#2a2a2a', borderRadius:22, color:'#fff'`, акцент limey-плашкой в правом верхнем углу.

### Layout

- **Клиент:** `maxWidth: 480, margin: '0 auto', paddingBottom: 80` (отступ под BottomNav). BottomNav фиксированный, 6 пунктов, активный иконка/текст `#6a7700`.
- **Админка:** `aside` 240px тёмный (`#1f2024`) + `main` со скроллом, header 64px с кнопками «Режим преподавателя» / «Выйти».
- **PWA:** standalone, `theme_color: #BFD900`, иконки 192/512. SW для пушей — [public/firebase-messaging-sw.js](public/firebase-messaging-sw.js).

---

## Полезные точки входа при доработке

- Изменить навигацию клиента — [src/App.jsx:33](src/App.jsx:33) (`ClientApp`) + [src/components/BottomNav.jsx](src/components/BottomNav.jsx).
- Изменить меню админки/бейджи — [src/admin/AdminLayout.jsx:82](src/admin/AdminLayout.jsx:82).
- Поправить логин/Telegram-flow — [src/App.jsx:138](src/App.jsx:138).
- Логика записи на занятие и проверка абонемента — [src/pages/Schedule.jsx](src/pages/Schedule.jsx) и [src/admin/AttendancePanel.jsx](src/admin/AttendancePanel.jsx).
- Каталог продаваемых продуктов (включая 30-дневные индив-слоты) — [src/admin/AdminCatalog.jsx](src/admin/AdminCatalog.jsx).
- Индив-флоу клиента end-to-end: продажа пакета админом — [AdminCashbox](src/admin/AdminCashbox.jsx) (вкладка «Индив» в ProductPicker, читает `indiv_packages` напрямую) → `create_sale` создаёт `indiv_subscriptions`. Запись клиента — [Team.jsx](src/pages/Team.jsx)/[Shop.jsx](src/pages/Shop.jsx) каждый рисует свой хедер препода (аватар + bio + группы), а табы «Пакеты»/«Записаться» вкладывают общий [TeacherIndivDetail](src/components/TeacherIndivDetail.jsx) — там же фильтр уже занятых слотов по `indiv_requests(status IN pending/confirmed)`, кнопка «Записаться» → RPC `create_indiv_request` под advisory_lock + partial UNIQUE, секция «Ваши заявки» с отменой. Подтверждение/отклонение/отмена заявок админом — [AdminTasks](src/admin/AdminTasks.jsx) (`tab=indivs`; «Назначить зал» → `confirm_indiv_request`, «Отклонить»/«Отменить занятие» → `cancel_indiv_request`). Проведение — [TeacherPanel](src/admin/TeacherPanel.jsx)/[AttendancePanel](src/admin/AttendancePanel.jsx), отметка `present` списывает визит из `indiv_subscriptions` через `attendance.indiv_subscription_id`. История проведённых индивов клиенту — [Profile.jsx](src/pages/Profile.jsx) (`MyIndivs`). Аналитика по индивам (выручка/топ-3 препода/загрузка слотов) — [AdminFinance](src/admin/AdminFinance.jsx) (`FinanceIndivs`, owner-only).
- Расписание препода (TeacherPanel) — собственные занятия + замены через `teacher_substitutions` (мерж двух запросов, бейдж «Замена»), индивы; отметка посещаемости с подсветкой текущего статуса и оптимистичным апдейтом — [src/admin/TeacherPanel.jsx](src/admin/TeacherPanel.jsx).
- Админ-сетка [AdminSchedule.jsx](src/admin/AdminSchedule.jsx) — день/неделя/месяц. На каждой карточке `EventBlock` показывается счётчик записанных (`bookingCount(ev)`): для группы — `bookings(status='booked')`, для индива — 1 по `indiv_student_id`, для event — `event_registrations≠cancelled` (формат `N/M` если у event есть `max_participants`). Один запрос `loadAll` обогащён join'ами `bookings(id, status)` и `event:events(max_participants, event_registrations(...))` — N+1 нет. UI: в day абсолютный бейдж `👥 N/M` в правом верхнем углу карточки; в week узкие карточки — счётчик inline в строке времени `18:00–19:00 (1)`; в month — `· 👥N` в конце строки. На отменённых занятиях счётчик не показываем.
- Гард «нет основания»: ученик без активного абонемента/регистрации в `AttendancePanel` видит красную кнопку «Нет абонемента» вместо StatusButton → `NoBasisModal` с тремя ветками: открыть кассу с предзаполненным клиентом (`/admin/cashbox?client=<id>` — AdminCashbox читает query‑param при монтировании), открыть карточку клиента, «Отметить как пробное» (для групповых уроков, через `mark_attendance(p_mark_as_trial=true)`). На сервере дублирующий гард — RPC возвращает `no_valid_basis` если кто‑то обойдёт UI. Логика покрывает все типы уроков: группа/индив/event и все типы оснований: subscription/single/trial/indiv/event. **Для индив-уроков** ровно та же логика: если у клиента нет активного `indiv_subscriptions` (через `indiv_requests.subscription_id` или fallback), basis='none', и present отбивается тем же `no_valid_basis` — клиент видит «Нет оплаченного пакета на индив».
- **Гард «занятие уже началось»** (применяется ко всем местам, где есть кнопка отмены для любого типа урока: группа/индив/event):
  - [AttendancePanel](src/admin/AttendancePanel.jsx) — кнопка «✕ Отменить» disabled (текст «✕ Уже началось» + title-подсказка) если `parseMskNaive(starts_at) <= now()`. Отменять активный/прошедший урок задним числом нельзя — для пришедших учеников «отмена» = отъём оплаченного визита, плюс зарплата уже могла быть подтверждена.
  - [Schedule.jsx](src/pages/Schedule.jsx) (клиент, групповые) — кнопка «Записаться»/«Отменить ✕» скрывается если `parseMskNaive(cls.starts_at) <= now()`. Фильтр БД по дню грубый, не учитывает время — для сегодняшнего дня после старта кнопку прячем.
  - [TeacherIndivDetail](src/components/TeacherIndivDetail.jsx) (клиент, индивы) — кнопка «Отменить» рядом с заявкой скрывается если `parseMskNaive(slot_date+T+start_time) <= now()`. Тот же грубый фильтр по дате.
  - [Profile.MyLessons](src/pages/Profile.jsx) (клиент) — отдельной защиты не нужно: upcoming фильтруется минутным `parseMskNaive(starts_at) >= now`.
  - Это UI-правила. Серверные `cancel_lesson`/`cancel_indiv_request` оставлены открытыми (12h-барьер для `cancel_indiv_request` от клиента сохраняется, админ без барьера — для фиксации ошибок задним числом).
- Рассылки — [src/admin/AdminBroadcasts.jsx](src/admin/AdminBroadcasts.jsx): четыре вкладки — «Новая» (RichEditor + 11 фильтров аудитории через `PillsMultiSelect` + ручное добавление + 🧪 тест‑отправка), «Шаблоны», «⚡ Авто» (карточки авторассылок с тумблером, расписанием «вчера/сегодня/завтра» с именами и статусами, модалкой настройки), «История». Подбор аудитории — RPC `recipients_for_broadcast(p_filters)`, payload сохраняется в `broadcasts.filter_payload`. Реальная отправка — edge `send-broadcast` для немедленных, edge `send-auto-broadcast` + cron `auto-birthday-daily` для авто. Per‑recipient статусы доставки в `broadcast_recipients.delivered_at/failed_at/error` и в `auto_broadcast_runs.channels_sent/error`.
- Денежные операции (продажа / отмена / бонусы / призы / визиты / зарплата / отмена урока / запись на индив / отмена индив-заявки) — RPC из раздела «RPC-функции». Клиентский вызов — `supabase.rpc(...)` с обработкой ошибок по общему паттерну.
- HTML-контент от админов в UI — оборачивай `safeHtml()` из [src/utils/safeHtml.js](src/utils/safeHtml.js).
- Любые границы суток / фильтры по датам — через хелперы из [src/utils/tz.js](src/utils/tz.js).
- Если нужно посмотреть, что менялось в денежно-учётном контуре — `git log --grep='fix(prizes\|fix(sales\|fix(attendance\|fix(salary\|fix(lesson\|feat(indivs'`.

---

## Остаток аудита

Бэклог по результатам полного аудита проекта (на момент `83dfb2f`). Структура: P0 → срочно, P1 → ближайший спринт, P2 → плановые улучшения, P3 → когда дотянутся руки. Закрытые исторически пункты (раздел «🔴 Критичные» с коммитами `512900d`..`538f548`, ранние «🟢 Низкие» по префиксу `fix(low)`) не дублируются — смотри `git log`. **Все P0 закрыты** (S1-S5), теперь приоритет — Трек 2 (бизнес-логика, S6-S12) и Трек 3 (производительность, S13-S14).

### 🔴 P0 — критично, потенциальная потеря данных/денег

- ~~**S1. Edge-функции `send-broadcast` и `send-auto-broadcast` без авторизации.**~~ **ЗАКРЫТО** (см. ниже + git log `feat(security): S1-S3`). Добавлен RPC `_get_cron_secret()` + проверка авторизации в edge: либо cron-secret из vault (для pg_cron), либо user JWT с ролью admin/manager/owner (через `auth.getUser`). vault.service_role_key регенерирован на приватный 32-байт secret (раньше там был публичный anon JWT). Claim в `send-broadcast` сужен до `'scheduled'/'draft'` — повторные отправки `'sent'` исключены.
- ~~**S2. RLS выключен на трёх публичных таблицах** `bookings`, `indiv_requests`, `teacher_slot_dates`.~~ **ЗАКРЫТО.** RLS включён везде. `bookings` — политики own/admin для всех CMD. `indiv_requests` — SELECT own/staff, write только через RPC (SECURITY DEFINER). `teacher_slot_dates` — SELECT для authenticated, write только staff (admin/manager/owner или teacher для своих).
- ~~**S3. Email-канал рассылок — нет HTML-санитайза.**~~ **ЗАКРЫТО.** В обеих edge-функциях добавлен `sanitizeEmailHtml(html)` через `npm:xss@1` (whitelist популярных тегов, без `<script>/<style>/<iframe>/on*`-атрибутов/inline-style). `isomorphic-dompurify` не подошёл — тянет jsdom, не работает в Deno edge runtime.
- ~~**S4. Прямой UPDATE балансов в обход RPC.**~~ **ЗАКРЫТО.** Новые RPC `admin_adjust_rubles(client, delta, reason)` (точная копия `admin_adjust_coins`, FOR UPDATE на profiles + аудит в bonus_history) и `admin_update_subscription(sub_id, payload, reason)` (общий patch для activated_at/expires_at/visits_total/visits_used/is_frozen с проверкой `visits_used<=visits_total` и аудитом в subscription_date_changes). Клиент: `handleAddBonus` и `saveDateChange` в [AdminClientCard.jsx](src/admin/AdminClientCard.jsx) переключены на RPC.
- ~~**S5. Прямой DELETE/UPDATE `schedule` админом.**~~ **ЗАКРЫТО.** Новые RPC:
  - `delete_lesson(p_schedule_id)` — внутри `_refund_visits_for_lesson` хелпер (возврат визитов в subscriptions И indiv_subscriptions, удаление lesson_payments) + аудит + `delete from schedule`.
  - `delete_lesson_series(p_schedule_id, p_scope text)` — то же для серии, `scope IN ('one','future','all')`.
  - `reschedule_lesson(p_schedule_id, p_new_starts_at, p_new_ends_at)` — advisory_lock на зал + проверка `hall_conflict` + аудит.
  - `change_lesson_teacher(p_schedule_id, p_new_teacher_id)` — проверка что новый user — реально teacher (роль или staff_roles), откат `lesson_payments` (зарплата за этот урок отзывается), `update teacher_id`, аудит.
  - Клиент: `handleDeleteEvent`/`handleSeriesChoice` в [AdminSchedule](src/admin/AdminSchedule.jsx) и `handleReschedule`/`handleChangeTeacher` в [AttendancePanel](src/admin/AttendancePanel.jsx) переключены на RPC.

### 🟠 P1 — высокие, ближайший спринт

- ~~**S6. Клиент редактирует `profiles` напрямую.**~~ **ЗАКРЫТО.** Новая RPC `update_my_profile(p_payload jsonb)` — whitelist полей (`first_name`/`last_name`/`patronymic`/`full_name`/`avatar_url`/`bio`/`ad_source`/`ad_source_custom`) и **set-once** для `birth_date`/`email`/`phone` (после первого ввода менять только через админа). Триггер `prevent_unauthorized_profile_fields` BEFORE UPDATE на `profiles` дублирует защиту на уровне БД для категорий client/teacher: блокирует прямой UPDATE `bonus_rubles`/`bonus_coins`/`telegram_*`/`sort_order` и enforce-ит set-once. Триггер пропускает SECURITY DEFINER RPC через проверку `current_user <> 'authenticated'` (внутри RPC current_user = postgres-owner), поэтому существующие денежные RPC (`complete_prize_request`, `admin_adjust_coins`, `create_sale`, `cancel_sale`) не сломались. UI: [Profile.jsx](src/pages/Profile.jsx) (`handleSave`), [AvatarUpload.jsx](src/components/AvatarUpload.jsx) переключены на `update_my_profile`.
- ~~**S7. `prize_requests` без серверной проверки.**~~ **ЗАКРЫТО.** Новая RPC `request_prize(p_prize_id)` — проверяет `is_active`/`stock_count>0`/`bonus_coins>=price`/нет другой `pending`-заявки на тот же приз; INSERT идёт под `FOR UPDATE` на prizes и profiles. Снят RLS-полис `prize_requests: client create` — прямой INSERT клиентом теперь блокируется (только админ-INSERT и RPC). UI: [Bonus.jsx](src/pages/Bonus.jsx) переключён на `request_prize`. Ошибки: `prize_not_found`, `prize_inactive`, `out_of_stock`, `insufficient_balance` (с balance/price), `already_pending`.
- ~~**S8. `cancel_sale` возвращает 100% бонусов даже если визиты потрачены.**~~ **ЗАКРЫТО.** RPC переписан с пропорциональным возвратом по каждой строке чека: коэффициент использования `coef = visits_used / visits_total` для visits-based; `coef = (today - activated_at) / (expires_at - activated_at)` для time-based безлимита. Бессрочный безлимит и услуги без подписки — 100% возврат (`coef = 0`). Сумма возврата по строке: `floor(bonus_rubles_used * (1 - coef))`. В ответе теперь `full_bonus_paid`, `refund_breakdown` (jsonb-массив по позициям с `sale_id`/`product_name`/`coefficient_used`/`refund`) — UI показывает деталь «из X ₽ возвращено Y ₽, удержано Z за использованные занятия». Индив-пакеты учитываются по тем же правилам через `indiv_subscriptions`. [AdminFinance.handleCancel](src/admin/AdminFinance.jsx) обновлён.
- ~~**S9. Возврат визита в замороженную/истёкшую подписку.**~~ **ЗАКРЫТО.** Хелпер `_refund_visits_for_lesson` (используется в `cancel_lesson`, `delete_lesson`, `delete_lesson_series`) теперь проверяет каждую подписку перед возвратом: **живая** (не frozen и `expires_at >= today`) → обычный `visits_used--`; **мёртвая** → конвертация визита в `bonus_rubles` по цене `floor(amount_paid/visits_total)` для обычных подписок (читается из связанной `sales`-строки) и `floor(price/visits_total)` для индив-пакетов (читается из `indiv_subscriptions.price`). Кредит идёт через прямой UPDATE `profiles.bonus_rubles` с записью в `bonus_history(client_reason='cancellation', reason='Компенсация за отмену занятия (абонемент истёк/заморожен)')`. В ответе появились `converted_to_rubles` и `compensations` (jsonb-массив с разбивкой по клиентам). `cancel_lesson` заодно отрефакторен — inline-логика возврата визитов вытащена в общий хелпер. [AttendancePanel.handleCancel](src/admin/AttendancePanel.jsx) обновлён, показывает компенсацию отдельной строкой.
- **S10. Реферальная ссылка — fake-feature.** [Profile.jsx](src/pages/Profile.jsx) (компонент `Referral`, пункт меню «Привести друга ✦», ветка `screen==='referral'`) копирует `?ref=<8 hex>` ссылку, но `?ref=` нигде не парсится, нет колонки `referrer_id`, нет начисления. UI оставлен как плейсхолдер для будущей реализации — **доделать до боевого режима**: миграция `profiles.referrer_id uuid` (FK на `profiles.id`), парсинг `?ref=` при signup → запись в `referrer_id`, RPC `apply_referral_bonus(client_id, sale_id)` или триггер на `sales(product_type='subscription')` который начисляет 10% реферру и 10% новому клиенту через `bonus_history`. Криптостойкость кода (`session.user.id.slice(0, 8)` — 8 hex, легко угадать чужой) тоже под этот же спринт. **Не удалять UI до момента реализации** — пользователь видит обещание, мы держим его на видном месте чтобы не забыть закрыть.
- ~~**S11. Перекрёстные push.**~~ **ЗАКРЫТО.** Новая RPC `register_push_token(p_token)` — атомарно обнуляет `push_token=p_token` у всех чужих профилей, затем ставит свой. Минимальная валидация: длина токена >= 20 (FCM-токены гораздо длиннее, защита от мусора). UI: [Profile.jsx](src/pages/Profile.jsx) (Referral-баннер) и [Schedule.jsx](src/pages/Schedule.jsx) (банер push-разрешения) переключены на RPC.
- ~~**S12. `bookings.update({status:'cancelled'})` клиентом без проверки времени.**~~ **ЗАКРЫТО.** Новая RPC `cancel_booking(p_booking_id)` — 12-часовой барьер для клиента (по аналогии с `cancel_indiv_request`), без барьера для admin/manager/owner. Триггер `prevent_client_booking_modifications` BEFORE UPDATE на `bookings` дублирует защиту: при `current_user='authenticated'` и status→cancelled от клиента проверяет тот же 12h-барьер + запрещает откат cancelled→booked. UI: [Schedule.jsx](src/pages/Schedule.jsx) (`handleCancel`) и [Profile.jsx](src/pages/Profile.jsx) (`MyLessons.handleCancel` для booking-ветки) переключены на RPC. Ошибки: `booking_not_found`, `forbidden`, `already_cancelled`, `too_late` (с `hours_left`).
- ~~**S13. Bundle splitting.**~~ **ЗАКРЫТО.** Все 15 админ-страниц + `TeacherPanel` лениво грузятся через `React.lazy()` + `<Suspense fallback={<Loader />}>` в [App.jsx](src/App.jsx). В [vite.config.js](vite.config.js) подключён `manualChunks` (функция, как требует Rolldown в Vite 8) — отдельные vendor-чанки: `vendor-react`, `vendor-supabase`, `vendor-firebase`, `vendor-dompurify`. После `npm run build`: главный `index.js` = 121 KB (раньше всё в одном ~700+ KB), каждая админ-страница — собственный chunk (AdminCatalog 83 KB, AdminClientCard 75 KB, AdminFinance 65 KB и т.д.). Клиент на мобилке грузит только `vendor-*` + `index.js` + клиентские страницы (Home/Schedule/Shop/News/Profile/Bonus/Team остались eager — UI после логина сразу видим).
- ~~**S14. AdminFinance без `useMemo`.**~~ **ЗАКРЫТО (точечно для FinanceSales).** В [AdminFinance.jsx](src/admin/AdminFinance.jsx) heavy `filter().reduce()*4 + sort()` (filtered/total/totalNet/avgCheck/top5) объединены в один `useMemo` с зависимостями `[sales, onlyAcquiring, filterMethod, filterType, filterSeller, search]`. Это убирает повторные пересчёты при re-render'ах не связанных с фильтрами (polling бейджей AdminLayout каждые 30 сек, hover в дочерних элементах). При 1000+ продаж UI станет заметно отзывчивее. Дополнительно агрегаты считаются за один проход массива вместо 4-х. Аналогичный pass по AdminClientCard/AdminSchedule пока отложен в Трек 4.
- **S15. Задачи без ассайни + без эскалации** — [AdminTasks.jsx:551](src/admin/AdminTasks.jsx:551). Создать «безответственную» задачу легко, просроченные — только красный бейдж. **План:** алерт при создании без ассайни; cron `notify_overdue_tasks` (раз в час) → push ответственным.
- **STAFF-whitelist на клиенте** ([App.jsx:179](src/App.jsx:179)). Реальной защиты нет, любой может убрать ветку из бандла. **План:** Supabase Auth Hook или RLS на signInWithOtp.
- **Индив-flow: уведомлений нет.** Edge или trigger на `indiv_requests` INSERT/UPDATE → push преподу/клиенту.
- **AdminFinance loyalty/groups attendance без даты-фильтра** ([AdminFinance.jsx:1402](src/admin/AdminFinance.jsx:1402)) — тянет всю историю present-посещений всех активных абонементщиков. Растёт линейно во времени. **План:** `.gte('marked_at', mskDayStartUtc(ago60))` либо RPC `loyalty_last_visits` с агрегацией.
- **TeacherPanel: `attendance`/`bookings` без лимита** ([TeacherPanel.jsx:513,522](src/admin/TeacherPanel.jsx:513)) — за всю историю препода для расчёта статистики и ДР. **План:** RPC `teacher_stats(month_start)` с COUNT/DISTINCT в БД.

### 🟡 P2 — средние, плановые улучшения

- **S16. `is_closed` группы не проверяется при клиентской записи** ([Schedule.jsx:105](src/pages/Schedule.jsx:105)). Клиент с подходящим абонементом запишется в закрытую группу. **План:** join `groups(is_closed)` + скрытие/блокировка записи.
- **S17. Возрастная валидация** — у групп нет min/max age, у events `age_info text` (свободная строка). **План:** `groups.age_min/age_max` + проверка в RPC `book_lesson`/в UI.
- **S18. Истёкшие `pending` индив-заявки занимают слот** — partial UNIQUE блокирует. **План:** pg_cron job (раз в час) → `pending` старше 48ч → `cancelled` + уведомление.
- **S19. Дубль кода: PeriodPicker + chip/card/inputStyle** — AdminFinance × 4 раза, ещё AdminCashbox/AdminClientCard. ~500 строк копипасты. **План:** `src/components/PeriodPicker.jsx`, `src/utils/styles.js`.
- **S20. ILIKE-поиск без trgm-индекса** — AdminCashbox/Broadcasts/AttendancePanel/ClientCard. При 1000+ клиентах full table scan. **План:** `CREATE EXTENSION pg_trgm; CREATE INDEX profiles_search_idx ON profiles USING GIN ((full_name||...) gin_trgm_ops)`.
- **S21. Прокидывание `session` prop + localStorage-«роутер»** — больно при добавлении страниц, и глубокие ссылки не работают. **План:** `SessionContext` + `react-router` для клиента (`/`, `/schedule`, `/profile`).
- **S22. PostgREST `.or(...ilike.%${val}%)` без escape** — запятые/скобки/звёздочки ломают парсер. **План:** `escapeIlike(val)` в utils.
- **S23. Картинки без `loading="lazy"` и без srcset** — все аватарки/призы/мерч в полном размере. **План:** `loading="lazy" decoding="async"` + Supabase Image Transformations (`?width=200&quality=80`).
- **S24. Контраст `#BFD900` на белом ≈1.7:1 (WCAG fail) + Inter не подгружен.** **План:** запрет `#BFD900` на белом для текста (только `#6a7700`); `<link>` на Inter (или self-host).
- **S25. SW без `notificationclick`** — клик по пушу не открывает приложение в нужном месте. **План:** добавить `clients.openWindow(data.url)` в [firebase-messaging-sw.js](public/firebase-messaging-sw.js).
- **1 legacy-подписка без групп.** На момент `8471e23` — одна активная подписка с пустым `subscription_allowed_groups`. `mark_attendance` считает её «универсальной» через фолбэк. Новые подписки через `create_sale` уже отклоняются (`groups_required`). При необходимости — точечный data-fix.
- **Глубокие ссылки клиента не работают** ([App.jsx:55](src/App.jsx:55)) — закрывается переходом на react-router (S21).
- **`alert/confirm` непоследовательны** — часть критичных действий без подтверждения.
- **Hardcoded Firebase ключи в SW** ([firebase-messaging-sw.js](public/firebase-messaging-sw.js)) при том что в [firebase.js](src/firebase.js) они в env — двойной источник истины.
- **ESLint flat config: преэкзистирующий React-hooks долг (~15-25 нарушений).** Подключён `eslint-plugin-react-hooks` (см. [eslint.config.js](eslint.config.js)), три категории накопились в больших файлах и проходят `npm run lint` как warnings, не падая:
  - **`react-hooks/purity`** — impure-вызовы в теле компонента (`Date.now()`, `Math.random()`, `Math.min(...emptyArray)`, чтение `window`/`localStorage` напрямую). Чинить: переносить в `useEffect` / `useMemo` / `useState(() => ...)`.
  - **`react-hooks/exhaustive-deps`** — `useEffect(fn, [])` где `fn` использует значения из замыкания. Чинить: `useCallback` + добавить в deps, либо явный `eslint-disable-next-line` с комментарием почему так задумано.
  - **`react-hooks/immutability`** — функция используется в `useEffect`/JSX до объявления (`const`-хоистинг работает в JS, но React 19 ругается на риск устаревания ссылки). Чинить: переставлять объявления выше использования.
  - **План фикса (Трек 4):** отдельный refactoring-PR — пройтись по всем `useEffect`/handler'ам, добавить `useCallback`/`useMemo`, исправить impure-вызовы. После — включить `react-hooks/exhaustive-deps` уровнем `error` в eslint.config.js.
- **Кликабельные `<div>` вместо `<button>`** в карточках списков (новости, продажи, расписание).
- **AdminClientCard SchedulesTab без `.limit()`** ([AdminClientCard.jsx:343-350](src/admin/AdminClientCard.jsx:343)). **План:** `.limit(100)` + «показать ещё».
- **AdminCashbox `today + 'T00:00:00'`** ([AdminCashbox.jsx:262](src/admin/AdminCashbox.jsx:262)) — нарушение правила TZ. Та же ошибка в [AdminStaffCard.jsx:649](src/admin/AdminStaffCard.jsx:649).
- **`AdminBroadcasts.handleSendTest` ставит `status:'sent'` ДО фактической отправки** ([AdminBroadcasts.jsx:863-887](src/admin/AdminBroadcasts.jsx:863)) — на UI рассылка выглядит успешной даже при провале edge; повторный тест уходит дважды (см. S1 про claim).
- **AdminSchedule грузит ВСЕХ клиентов студии при открытии** ([AdminSchedule.jsx:447](src/admin/AdminSchedule.jsx:447)). **План:** ленивый поиск как в `ClientSearch`.

### 🟢 P3 — низкие, фоном

- **Отметка `present` без проверки «занятие сегодня»** — можно отметить завтрашний урок.
- **Push-token в клиентском `select`** ([AdminBroadcasts handleManualSearch](src/admin/AdminBroadcasts.jsx)) — утечка позволяет напрямую слать FCM. **План:** не выбирать `push_token` в клиентских select, только в edge.
- **CHECK-констрейнты на enum-статусы** (`bookings.status`, `tasks.status`, `prize_requests.status`, `indiv_requests.status`) — проверить, есть ли в БД.
- **`firebase` импортируется целиком** — проверить subpath-импорты `firebase/app` + `firebase/messaging`.
- **AdminLayout polling 30s** при `document.hidden` тоже тикает — добавить pause.
- **`toLocalDateStr` дубль** в AdminClientCard/AdminCashbox — переключить на `toMskDateStr` из `utils/tz.js`.
- **Реферальный код `user.id.slice(0,8)`** — 8 hex символов, не криптостойко. Решается вместе с S10.
- **`profiles.update({role:...})` без RPC** ([AdminClientCard.jsx:197](src/admin/AdminClientCard.jsx:197)) — триггер `prevent_unauthorized_role_change` должен ловить, но логика на клиенте предполагает обход. Лучше — RPC `admin_set_role`.
- **`AutoTab` последовательные `await` в цикле** ([AdminBroadcasts.jsx:549](src/admin/AdminBroadcasts.jsx:549)) — `Promise.all`.
- **Отсутствие cancel-флага в useEffect** в pages/*.

### План разработки

В порядке приоритета — 4 параллельных трека:

- ~~**Трек 1 «Закрыть критические дыры»**~~ — **ЗАКРЫТО.** S1-S5 целиком (коммиты `0d8c30b` для S1-S3 и `83dfb2f` для S4-S5).
- **Трек 2 «Замкнуть бизнес-логику»:** ✅ S6/S7/S11/S12 (Партия A — RPC `cancel_booking`/`request_prize`/`register_push_token`/`update_my_profile` + два триггера-защитника). ✅ S8/S9 (Партия B — пропорциональный возврат бонусов в `cancel_sale`, конверсия визита в `bonus_rubles` на мёртвой подписке через обновлённый `_refund_visits_for_lesson`). Осталось: **S10 (рефералку доделываем до боевого режима, не удалять UI)**, S15 (задачи без ассайни + эскалация), уведомления для индивов + онлайн-оплата.
- **Трек 3 «Производительность и UX»:** ✅ S13/S14 (Партия D — bundle splitting через React.lazy + manualChunks для vendor-кусков; useMemo для AdminFinance). Осталось: S20, S22, S23, S25.
- **Трек 4 «Технический долг» (3-4 недели фоном):** S19, S21, S16, S17, S18, очистка дубликатов и мёртвых таблиц (`staff_salary_settings`, `product_indivs`, `products(type='indiv')`); React-hooks рефакторинг + включить `react-hooks/exhaustive-deps` уровнем `error`; смоук-тесты денежного контура через `do $$ assert ... $$`.

**Продуктовые идеи на будущее:**
- Уведомления о расписании (push за день/час), лента уведомлений в клиентском UI, кошелёк/история бонусов клиенту, «отзыв о занятии» — высокая ценность, низкая стоимость.
- CSV-экспорт, iCal-выгрузка препода, воронка продаж в AdminFinance.
- Онлайн-оплата (ЮKassa/Tinkoff), автопредложение замены при отмене урока, мультистудийность через `studio_id`.
- TypeScript (поэтапно), Vitest (хотя бы для tz.js/plural.js/денежного контура), feature flags через `finance_settings`.

### Как пополнять список

Когда находишь баг при работе — либо чини сразу (если он маленький и попутный), либо добавляй сюда новой строкой с пометкой приоритета и ссылкой на файл:строку. После фикса убирай отсюда и упоминай коммит-хэш в commit message.
