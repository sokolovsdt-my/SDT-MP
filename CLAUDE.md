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
│   └── Profile.jsx       # профиль, мои занятия, статистика, рефералка, FCM-подписка
│
├── admin/                # админ-панель (sidebar 240px) + панель преподавателя
│   ├── AdminLayout.jsx           # каркас: aside-меню + Outlet
│   ├── AdminDashboard.jsx        # сводка (выручка для owner, занятия дня, ДР, новые клиенты)
│   ├── AdminClients.jsx, AdminClientCard.jsx
│   ├── AdminStaff.jsx, AdminStaffCard.jsx
│   ├── AdminSchedule.jsx         # календарь сетки занятий
│   ├── AdminCatalog.jsx          # абонементы, услуги, события, мерч, индив-пакеты
│   ├── AdminGroups.jsx           # учебные группы
│   ├── AdminCashbox.jsx          # касса, продажи
│   ├── AdminFinance.jsx          # P&L, расходы, зарплаты, лояльность (owner-only)
│   ├── AdminTasks.jsx            # задачи (kanban-подобный)
│   ├── AdminBroadcasts.jsx       # рассылки в Telegram-бот
│   ├── AdminNews.jsx, AdminPrizes.jsx
│   ├── AdminIndivs.jsx           # модерация заявок на индивы
│   ├── AttendancePanel.jsx       # отметка посещаемости на занятии (списание визитов)
│   └── TeacherPanel.jsx          # отдельный UI для роли teacher (/teacher)
│
├── components/
│   ├── BottomNav.jsx     # нижняя навигация клиента (6 пунктов)
│   ├── RequireRole.jsx   # гард по роли
│   └── AvatarUpload.jsx  # загрузка в bucket `avatars`
│
├── hooks/
│   └── useUserRole.js    # роль из profiles.role + флаг error
│
├── utils/
│   ├── tz.js             # todayMsk / toMskDateStr / mskDayStart/EndUtc для МСК-границ
│   └── safeHtml.js       # обёртка над DOMPurify для dangerouslySetInnerHTML
│
└── assets/               # hero.png и др. статика

public/
├── manifest.json                  # PWA, theme_color #BFD900
├── firebase-messaging-sw.js       # SW для фоновых пушей FCM
├── icon-192.png, icon-512.png, favicon.svg, icons.svg
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

- **profiles** — `id, full_name, first_name, last_name, patronymic, avatar_url, bio, email, phone, role, birth_date, ad_source, ad_source_custom, bonus_rubles, bonus_coins, push_token, sort_order, telegram_id, telegram_username, created_at`. Основная таблица всех пользователей. `id` = `auth.users.id`. CHECK на `role`: `client/teacher/admin/manager/owner/content_creator/other`. Изменение `role` защищено триггером `prevent_unauthorized_role_change` — менять можно только через RPC или с админским JWT.
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
- **indiv_subscriptions** — отдельный учёт индивов: `student_id, teacher_id, visits_total, visits_used, expires_at`.
- **indiv_packages** — `id, teacher_id, name, visits_count, price, description, sort_order`. Пакеты у конкретного преподавателя.

### Расписание и индивы

- **schedule** — `id, title, starts_at, ends_at, hall, group_id, teacher_id, indiv_student_id, event_id, lesson_type, repeat_rule, repeat_id, is_cancelled, created_at`. `lesson_type='indiv'` для индивидуальных. `starts_at`/`ends_at` — `timestamp WITHOUT time zone`, хранятся в UTC.
- **schedule_history** — аудит. `action`-значения: `attendance_marked`, `cancelled`, и др.
- **bookings** — `id, student_id, schedule_id, subscription_id, status, created_at`. Статусы: `booked`, `cancelled`.
- **attendance** — `id, schedule_id, student_id, basis, status, subscription_id, subscription_expires, teacher_id, marked_by, marked_at, note, created_at`. `basis ∈ {subscription, single, trial, indiv, event, none}`, `status ∈ {present, absent, cancelled, transferred}`. **`UNIQUE(schedule_id, student_id)`** — UPSERT через `ON CONFLICT` безопасен, дубли невозможны.
- **teacher_substitutions** — `schedule_id, original_teacher_id, substitute_teacher_id`.
- **teacher_indiv_slots** — `id, teacher_id, slot_date, start_time, end_time, is_active, max_students`.
- **teacher_slot_dates** — доступность дат на 30 дней вперёд (см. недавний коммит).
- **indiv_requests** — `id, client_id, teacher_id, package_id, slot_date, start_time, end_time, hall, status, schedule_id, created_at`. Статусы: `pending, confirmed, rejected, cancelled`.

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

- **broadcasts**, **broadcast_templates**, **broadcast_recipients** — отправка через Telegram-бот.

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
| `mark_attendance(p_schedule_id, p_student_id, p_new_status)` | Отметка посещаемости в [AttendancePanel](src/admin/AttendancePanel.jsx), [TeacherPanel](src/admin/TeacherPanel.jsx) и при переносе пробного в `TransferModal` | UPSERT в `attendance` через `ON CONFLICT`. Сама подбирает подходящий `subscription_id` и `basis` для нового ученика. При переходе в/из `present` корректирует `subscriptions.visits_used` атомарно, с верхней границей (`out_of_visits`). Для индив-урока — `basis='indiv'` без списания. Учитель допускается только к своему/подменному уроку. |
| `cancel_lesson(p_schedule_id)` | «✕ Отменить занятие» в [AttendancePanel](src/admin/AttendancePanel.jsx) | Помечает урок `is_cancelled=true`, возвращает визиты всем `present`-ученикам, удаляет `lesson_payments` за этот урок, пишет в `schedule_history`. |
| `create_sale(p_payload jsonb)` | «Пробить продажу» в [AdminCashbox](src/admin/AdminCashbox.jsx) и `SaleModal` в [AdminClientCard](src/admin/AdminClientCard.jsx) | Один вызов вместо sales.insert + profiles.update + bonus_history.insert + subscriptions.insert + subscription_allowed_groups.insert. **Целочисленная разбивка сумм по позициям** (остаток в первую строку — сумма по строкам = общая). Проверка `bonus_rubles >= used`. `expires_at` для подписок считается из `product_subscriptions.duration_days` сервером. **При наличии в чеке позиций `subscription`/`service` `selected_group_ids` обязателен** — иначе `groups_required` (пустой список — это баг, не «универсальный абонемент»). |
| `cancel_sale(p_sale_id, p_cancel_whole_receipt bool=true)` | «Отменить» в [AdminFinance](src/admin/AdminFinance.jsx) | Отменяет весь чек по `receipt_id`, замораживает связанные подписки (`is_frozen=true` + `expires_at=today-1` + аудит в `subscription_date_changes`), возвращает `bonus_rubles` + reversal в `bonus_history`. Если у подписки были `visits_used > 0` — в ответе `visits_already_used: true`, визиты не возвращаются. |
| `save_lesson_salary(p_schedule_id)` | «📊 Рассчитать зарплату» / «✅ Подтвердить» в [AttendancePanel](src/admin/AttendancePanel.jsx) | Сервер сам считает `paid_students` из `attendance`, подбирает тариф из `salary_tiers` (приоритет `per_lesson_tiered → per_lesson`), учитывает `teacher_substitutions`, делает UPSERT в `lesson_payments` + INSERT в `schedule_history`. |
| `create_schedule_event(p_payload jsonb)` | «Сохранить» в `ScheduleForm` [AdminSchedule](src/admin/AdminSchedule.jsx) | Атомарное создание занятия или серии. Клиент передаёт naive-MSK timestamps в `dates[]`, RPC конвертирует в UTC через `at time zone 'Europe/Moscow'`. `pg_advisory_xact_lock(hall)` сериализует все вставки в зал — TOCTOU закрыт, даже если другой админ жмёт «Сохранить» одновременно. Конфликт хотя бы на одной дате серии → ничего не вставится (атомарный rollback). Ошибки: `hall_conflict` с массивом `conflicts`, `no_dates`, `invalid_dates`, и т.д. |
| `assign_substitution(p_schedule_id, p_substitute_teacher_id, p_reason?)` | Модалка «Замена преподавателя» в [AdminSchedule](src/admin/AdminSchedule.jsx) | UPSERT в `teacher_substitutions` через `UNIQUE(schedule_id)` + UPDATE `schedule.teacher_id` (для UX-консистенции рендера) + INSERT в `schedule_history` — всё в одной транзакции под `FOR UPDATE`. Ошибки: `same_teacher`, `lesson_cancelled`, `lesson_not_found`. |
| `confirm_indiv_request(p_request_id, p_hall)` | «Подтвердить и создать занятие» в `HallModal` [AdminTasks](src/admin/AdminTasks.jsx) | Атомарно: проверка зала под `advisory_xact_lock`, INSERT в `schedule` (с конвертацией МСК → UTC), UPDATE `indiv_requests` (status, hall, schedule_id), запись в `schedule_history`. Title строится из `profiles.full_name` клиента. Ошибки: `hall_conflict`, `already_handled`, `invalid_hall`. |
| `preview_lesson_salary(p_schedule_id)` | Кнопка «📊 Рассчитать зарплату» в [AttendancePanel](src/admin/AttendancePanel.jsx) | Read-only зеркало `save_lesson_salary`: считает `paid_students` и `amount` ровно той же формулой, что и save, но без UPSERT в `lesson_payments` и без записи в `schedule_history`. Гарантирует, что предпросмотр и фактическое сохранение совпадают. |
| `transfer_trial(p_schedule_id, p_target_schedule_id, p_student_id)` | `TransferModal` в [AttendancePanel](src/admin/AttendancePanel.jsx) | Атомарно: UPSERT attendance исходного урока со status='transferred' (если строки не было — basis='trial') + INSERT booking на новое занятие. Идемпотентность по `(target, student, 'booked')` — повторный вызов не дублирует. Раньше был двухшаговый flow с work-around на сбой второго запроса. |

**Общая модель ошибок:** `not_authenticated`, `forbidden`, `<resource>_not_found`, `lesson_cancelled`, `not_your_lesson` (для teacher), `already_handled` / `already_cancelled`. Все клиентские обработчики имеют словарь `{ error_code: 'русское сообщение' }` и `alert()` на неизвестный код. Сохраняй этот паттерн при добавлении новых RPC.

### Особенности запросов

- FK-алиасы в join: `teacher:profiles!schedule_teacher_id_fkey(full_name)`, `package:indiv_packages(name)` и т.д.
- Часовой пояс для дат `slot_date` и т.п. — **Europe/Moscow**. Для границ суток в фильтрах по `timestamp WITHOUT time zone` (`sale_date`, `starts_at`, `created_at`) используй хелперы из [src/utils/tz.js](src/utils/tz.js): `todayMsk()`, `toMskDateStr(d)`, `mskDayStartUtc(dateStr)`, `mskDayEndUtc(dateStr)`. **Не пиши `from + 'T00:00:00'`** — это даст границу в TZ браузера, отчёты «съезжают» у админов не из МСК.

---

## Договорённости по коду

### Общее

- **Только функциональные компоненты + хуки.** Без классов. Без `useReducer`/`context`/Redux — состояние локальное, поднимается через пропсы.
- **Все стили inline** через `style={{...}}`. Если нужен hover/анимация — `onMouseEnter`/`onMouseLeave` или встроенный `<style>{`@keyframes pulse{...}`}</style>` в конце компонента (см. [src/App.jsx:366](src/App.jsx:366)). Не вводи Tailwind/styled — это нарушит единый стиль файла.
- **Read-операции — прямо через `supabase.from(...)`** в компоненте, без слоя репозиториев/сервисов. `useEffect` → `async load()` → `setState` — это сознательный паттерн.
- **Мутации денег/визитов/учёта — ТОЛЬКО через RPC.** Изменение `profiles.bonus_rubles` / `profiles.bonus_coins` / `subscriptions.visits_used` / `prizes.stock_count` через прямой `update()` запрещено — у этих полей нет защиты от гонок, и read-modify-write на клиенте уже стоил нам нескольких критических багов (см. историю в `git log --grep='RPC'`). Если нужна новая денежная операция — заводи новую RPC по образцу [миграций Supabase](https://supabase.com/docs/guides/database/functions). Простые CRUD (новости, задачи, представители, расписание без денег) — пиши прямо.
- **Файлы крупные** (300–1500 строк) и содержат несколько вложенных компонентов одной фичи (например, `MyLessons`, `MyStats`, `Referral` внутри [Profile.jsx](src/pages/Profile.jsx)). Это норма — не дроби без необходимости.
- **Язык интерфейса — русский.** Все строки UI, статусы, alert/confirm — по-русски. Допустимы эмодзи в UI-копи.
- **Комментарии в коде — по-русски**, чаще всего как разделители блоков: `// ─── Заголовок ──────────`.
- **localStorage используется как лёгкий «роутер»** для клиента: `activePage`, `lessons_tab`, `profileScreen`, `shop_cat`, `news_tag`.
- **Кнопки `confirm()` и `alert()`** для критичных действий — это нормально, не заменяй на кастомный модал без просьбы.
- **`session` пробрасывается пропсом** во все страницы; не дёргай `supabase.auth.getUser()` повторно без причины.
- **HTML от админов всегда через `safeHtml()`.** Любой `dangerouslySetInnerHTML` из новостей/рассылок/RichEditor должен идти через [src/utils/safeHtml.js](src/utils/safeHtml.js) (DOMPurify под капотом). Без этого утечка админ-аккаунта = stored XSS у всех клиентов.
- **Границы суток МСК — через хелперы из [src/utils/tz.js](src/utils/tz.js).** Не строй вручную `dateStr + 'T00:00:00'` для фильтров — это даст границу в TZ браузера. Используй `mskDayStartUtc(todayMsk())` и т.п.
- **Защита от двойного клика** на любой мутирующей кнопке: локальный `if (saving) return` в начале handler + `disabled={saving}`. Особенно критично для денежных RPC, у которых RPC сама идемпотентна, но клиент может успеть отправить два запроса до ответа.

### Конвенции запросов

- Сначала проверка валидности (`if (!session?.user?.id) return`), затем `setLoading(true)`, потом запросы, затем `setLoading(false)`.
- Для счётчиков-бейджей в layout — `setInterval` + `window.addEventListener('focus', fetch)` (см. [AdminLayout.jsx:48](src/admin/AdminLayout.jsx:48)).
- Дата «сегодня» в МСК: `todayMsk()` из `utils/tz.js` (старое `toLocaleDateString('sv-SE', { timeZone: 'Europe/Moscow' })` теперь только внутри хелпера).
- Границы суток для фильтров timestamp: `.gte('sale_date', mskDayStartUtc(from)).lte('sale_date', mskDayEndUtc(to))`.
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
- Денежные операции (продажа / отмена / бонусы / призы / визиты / зарплата / отмена урока) — RPC из раздела «RPC-функции». Клиентский вызов — `supabase.rpc(...)` с обработкой ошибок по общему паттерну.
- HTML-контент от админов в UI — оборачивай `safeHtml()` из [src/utils/safeHtml.js](src/utils/safeHtml.js).
- Любые границы суток / фильтры по датам — через хелперы из [src/utils/tz.js](src/utils/tz.js).
- Если нужно посмотреть, что менялось в денежно-учётном контуре — `git log --grep='fix(prizes\|fix(sales\|fix(attendance\|fix(salary\|fix(lesson'`.

---

## Остаток аудита

Бэклог из аудита на момент `62c4b7c`. Закрытые пункты не перечисляются — историю смотри в `git log` по префиксам выше. Ссылки на строки могут смещаться, но имена функций/файлов стабильны.

### 🔴 Критичные

Все закрыты (см. коммиты с `512900d` по `538f548`). Если найдёшь новый — добавь сюда.

### 🟠 Высокие

- **STAFF-whitelist на клиенте** ([App.jsx:179](src/App.jsx:179)). Сейчас это UX-фильтр от случайных magic-link логинов сотрудников — реальной защиты нет, любой может убрать ветку из бандла. Должно быть в Supabase Auth Hook или RLS-политике на signInWithOtp. *(Отложено.)*
- **Реферальная ссылка `user.id.slice(0,8)`** ([Profile.jsx:432](src/pages/Profile.jsx:432)). 8 hex символов uuid — не криптостойкая. Если рефералка начисляет бонусы, простой перебор даст чужой код. Заменить на отдельный `referral_codes` с настоящим случайным токеном или хотя бы HMAC от `user.id`. *(Отложено.)*
- **1 legacy-подписка без групп в БД.** На момент `8471e23` — одна активная подписка осталась с пустым `subscription_allowed_groups`. `mark_attendance` RPC по-прежнему считает её «универсальной» (фолбэк для backward-compat). Новые подписки через `create_sale` без групп уже отклоняются (`groups_required`). При необходимости — точечный data-fix через миграцию.

### 🟡 Средние

**Логика клиентской мобилки:**
- **Глубокие ссылки клиента не работают** ([App.jsx:55](src/App.jsx:55)): `*` ловит всё кроме `/admin` и `/teacher`, редиректит на `/`. Поделиться ссылкой на `/profile` нельзя, кнопка «Назад» браузера ломает навигацию. Перевод клиента на react-router — заметная работа.

**State и производительность:**
- **Отсутствие cancel-флага в useEffect** в большинстве `pages/*` (Profile, Schedule, Shop, Team, Bonus и др.) и в нескольких местах в `admin/*`. Home, AdminLayout и useUserRole уже исправлены. Остальные — низкий риск (setState на размонтированном даёт warning, не падает), массивная работа.

**Инфра и UX:**
- **Hardcoded Firebase ключи в SW** ([firebase-messaging-sw.js](public/firebase-messaging-sw.js)) при том что в [firebase.js](src/firebase.js) они в env — двойной источник истины. Firebase apiKey по факту публичный, но при ротации сломается SW.
- **ESLint flat config** не включает `react-hooks/exhaustive-deps` уровнем `error`. Куча `useEffect` с устаревшими зависимостями проходит молча. Включение даст десятки новых ошибок — нужен отдельный refactoring-блок.
- **`alert/confirm` непоследовательны** — часть критичных действий (отмена занятия в Schedule.jsx клиента) без подтверждения, часть с нативным confirm.
- **Кликабельные `<div>` вместо `<button>`** в карточках списков (новости, продажи, расписание), аватарка с overlay по hover. `BottomNav` уже переведён на `<button>` (a11y win), остальные места — массивная работа.

### 🟢 Низкие

Все закрыты — см. `git log` по префиксу `fix(low)`. Добавляй сюда новые точечные мелочи по мере находок.

### Как пополнять список

Когда находишь баг при работе — либо чини сразу (если он маленький и попутный), либо добавляй сюда новой строкой с пометкой приоритета и ссылкой на файл:строку. После фикса убирай отсюда и упоминай коммит-хэш в commit message.
