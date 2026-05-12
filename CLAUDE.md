# CLAUDE.md — SDT Mobile/Web App

Веб-приложение студии танца **Sokolov Dance Theatre (SDT)**: личный кабинет клиента (mobile-first PWA) + админка для преподавателей, администраторов, управляющих и владельца. Один SPA, три UI-режима, общий бэкенд на Supabase.

---

## Стек

- **Frontend:** React 19, Vite 8, react-router-dom 7
- **Язык:** JavaScript + JSX (TypeScript НЕ используется)
- **Бэкенд:** Supabase (Postgres + Auth + Storage + Edge Functions)
- **Пуши:** Firebase Cloud Messaging (web push)
- **Деплой:** Vercel (SPA-fallback в [vercel.json](vercel.json))
- **Линт:** ESLint flat config ([eslint.config.js](eslint.config.js)) — `no-unused-vars` с исключением `^[A-Z_]`
- **Стили:** **только inline `style={{}}`** в JSX. Никаких CSS-классов, Tailwind, styled-components, CSS-модулей. Глобальный [src/index.css](src/index.css) почти не используется (наследие шаблона Vite — можно игнорировать).
- **Тестов нет**, фреймворка для тестов в зависимостях тоже нет.

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
│   └── useUserRole.js    # роль из profiles.role
│
└── assets/               # hero.png и др. статика

public/
├── manifest.json                  # PWA, theme_color #BFD900
├── firebase-messaging-sw.js       # SW для фоновых пушей FCM
├── icon-192.png, icon-512.png, favicon.svg, icons.svg
```

---

## Роутинг и роли

Роль читается из `profiles.role` в [src/hooks/useUserRole.js](src/hooks/useUserRole.js). Значения:

- `client` (по умолчанию) — мобильный UI с BottomNav, страница выбирается через `useState`+`localStorage('activePage')`, **роутера у клиента нет**.
- `teacher` — попадает на `/teacher` ([src/admin/TeacherPanel.jsx](src/admin/TeacherPanel.jsx)).
- `admin` / `manager` / `owner` — на `/admin/dashboard`, layout [src/admin/AdminLayout.jsx](src/admin/AdminLayout.jsx).

Сотрудник может одновременно иметь `staff_roles.role='teacher'` — тогда в админке появляется кнопка «🎓 Режим преподавателя».

Гард уровня роута — `<RequireRole allow={['owner', ...]}>` ([src/components/RequireRole.jsx](src/components/RequireRole.jsx)). Финансы доступны только `owner`. Расписание и задачи — всем, включая `teacher`.

### Авторизация

Три способа в [src/App.jsx:138](src/App.jsx:138) (`Login`):

1. **Telegram-бот** `@sdt_auth_bot` через edge function `telegram-login` (поллинг каждые 2 сек по сгенерированному коду).
2. **Magic link** — `supabase.auth.signInWithOtp`. Жёсткий чёрный список: сотрудники из массива `STAFF` входят только по паролю.
3. **Email+пароль** — `supabase.auth.signInWithPassword`.

---

## Supabase: таблицы (извлечено из кода)

Все запросы идут напрямую через `supabase.from('...')` — слоя репозиториев/сервисов нет.

### Профили и роли

- **profiles** — `id, full_name, first_name, last_name, patronymic, avatar_url, bio, email, phone, role, birth_date, ad_source, ad_source_custom, bonus_rubles, bonus_coins, push_token, created_at`. Основная таблица всех пользователей. `id` = `auth.users.id`.
- **staff_roles** — `staff_id, role, is_primary`. Доп. роли сотрудника (например, админ + преподаватель).
- **staff_info** — `staff_id, hire_date, phone, contact`.
- **salary_tiers** — `staff_id, tier_type, amount, is_active`.
- **staff_salary_settings** — `staff_id, field, value`.
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

- **schedule** — `id, title, starts_at, ends_at, hall, group_id, teacher_id, indiv_student_id, event_id, lesson_type, is_cancelled, created_by, created_at`. `lesson_type='indiv'` для индивидуальных.
- **schedule_history** — аудит.
- **bookings** — `id, student_id, schedule_id, status, created_at`. Статусы: `booked`, `cancelled`.
- **attendance** — `id, schedule_id, student_id, basis, status, marked_by, marked_at, created_at`. `basis ∈ {subscription, single, trial, indiv, event, none}`, `status ∈ {present, absent}`.
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
- **merch** / **sales** — устаревшие/общие таблицы (см. использование в [src/admin/AdminCashbox.jsx](src/admin/AdminCashbox.jsx)).

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

- **sales** — `id, sale_date, client_id, product_id, total_net, amount_paid, payment_method, is_cancelled, created_by, created_at`. **Не учитывать отменённые: `is_cancelled = false`**.
- **lesson_payments** — почасовая/поурочная оплата преподавателей.
- **staff_payments**, **staff_payments_history** — выплаты сотрудникам.
- **expenses**, **expense_categories**, **expense_subcategories** — расходы.
- **finance_settings** — `key, value` (KV).

### Бонусы и призы

- **prizes** — `id, name, description, image_url, coins_price, stock_count, badge_text, badge_color, sort_order, is_active`.
- **prize_requests** — `client_id, prize_id, status, handled_by, handled_at`. Статус `pending` показывается бейджем в меню.
- **bonus_history** — `student_id, amount, reason, created_by`. Поля баланса (`bonus_rubles`, `bonus_coins`) живут прямо в `profiles`.
- **client_loyalty** — `client_id, level` (`adept, loyal, edge, risk`).

### Прочее

- **client_comments**, **comment_history** — заметки по клиенту.
- **client_representatives** — родители/представители (для детских групп).

### Storage buckets

`avatars` (публичный, путь `${userId}.${ext}`), `events`, `merch`, `prizes`.

### Edge Functions

- **telegram-login** — выдача кода, поллинг подтверждения, выдача `hashed_token` для `verifyOtp`.
- **create-staff** — создание `auth.users` + строки в `profiles` от имени админа (используется и для добавления клиента в [AdminDashboard.jsx:134](src/admin/AdminDashboard.jsx:134)).

### Особенности запросов

- FK-алиасы в join: `teacher:profiles!schedule_teacher_id_fkey(full_name)`, `package:indiv_packages(name)` и т.д.
- Часовой пояс для дат `slot_date` и т.п. — **Europe/Moscow**, формат `YYYY-MM-DD` получается через `toLocaleDateString('sv-SE', { timeZone: 'Europe/Moscow' })`.

---

## Договорённости по коду

### Общее

- **Только функциональные компоненты + хуки.** Без классов. Без `useReducer`/`context`/Redux — состояние локальное, поднимается через пропсы.
- **Все стили inline** через `style={{...}}`. Если нужен hover/анимация — `onMouseEnter`/`onMouseLeave` или встроенный `<style>{`@keyframes pulse{...}`}</style>` в конце компонента (см. [src/App.jsx:366](src/App.jsx:366)). Не вводи Tailwind/styled — это нарушит единый стиль файла.
- **Никакой абстракции над Supabase.** Запросы пишутся прямо в компоненте, рядом с использованием. `useEffect` → `async load()` → `setState`. Это сознательное решение, не переноси в отдельные сервисы/хуки без явной просьбы.
- **Файлы крупные** (300–1500 строк) и содержат несколько вложенных компонентов одной фичи (например, `MyLessons`, `MyStats`, `Referral` внутри [Profile.jsx](src/pages/Profile.jsx)). Это норма — не дроби без необходимости.
- **Язык интерфейса — русский.** Все строки UI, статусы, alert/confirm — по-русски. Допустимы эмодзи в UI-копи.
- **Комментарии в коде — по-русски**, чаще всего как разделители блоков: `// ─── Заголовок ──────────`.
- **localStorage используется как лёгкий «роутер»** для клиента: `activePage`, `lessons_tab`, `profileScreen`, `shop_cat`, `news_tag`.
- **Кнопки `confirm()` и `alert()`** для критичных действий — это нормально, не заменяй на кастомный модал без просьбы.
- **`session` пробрасывается пропсом** во все страницы; не дёргай `supabase.auth.getUser()` повторно без причины.

### Конвенции запросов

- Сначала проверка валидности (`if (!session?.user?.id) return`), затем `setLoading(true)`, потом запросы, затем `setLoading(false)`.
- Для счётчиков-бейджей в layout — `setInterval` + `window.addEventListener('focus', fetch)` (см. [AdminLayout.jsx:48](src/admin/AdminLayout.jsx:48)).
- Дата «сегодня» в МСК: `new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Moscow' })`.
- Деньги: `(Number(n) || 0).toLocaleString('ru-RU') + ' ₽'`.
- Время: `toLocaleTimeString('ru-RU', { hour:'2-digit', minute:'2-digit' })`.

### Что не делать

- Не добавлять TypeScript, JSX-классы, новые CSS-файлы, Tailwind, CSS-in-JS-библиотеки.
- Не вводить `useContext` / провайдеры без сильной причины — текущий код работает без них.
- Не заменять inline-стили на классы «для красоты».
- Не писать комментарии-описания того, что и так видно. Разделители `// ─── … ───` сохранять, если они уже есть.
- Не трогать `index.css` без явной просьбы — он почти везде не действует (`#root` имеет свой layout в JSX).

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
