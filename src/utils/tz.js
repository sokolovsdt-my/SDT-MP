// Часовой пояс приложения — Europe/Moscow (UTC+3, без DST с 2011 г.).
//
// В БД две конвенции для timestamp WITHOUT time zone:
//  • UTC naive — для серверных полей через DEFAULT now() (sales.sale_date,
//    *.created_at и т.п.). Сравниваются с UTC-проекцией МСК-границ.
//  • MSK naive — для расписания (schedule.starts_at/ends_at), куда админ
//    напрямую вводит МСК-время. Сравниваются с MSK-naive границами.
//
// Помощники ниже разделены по этим двум конвенциям. Не путать.

// Текущая МСК-дата в формате 'YYYY-MM-DD'
export const todayMsk = () =>
  new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Moscow' })

// МСК-дата произвольного момента
export const toMskDateStr = (d) =>
  new Date(d).toLocaleDateString('sv-SE', { timeZone: 'Europe/Moscow' })

// ─── UTC-naive колонки (sale_date, created_at, marked_at и т.п.) ──────────
// Начало/конец суток МСК — выражаем как UTC-naive ISO для сравнения
// с timestamp WITHOUT time zone, заполняемым через now() (UTC).
export const mskDayStartUtc = (mskDateStr) =>
  new Date(`${mskDateStr}T00:00:00+03:00`).toISOString().slice(0, 19)

export const mskDayEndUtc = (mskDateStr) =>
  new Date(`${mskDateStr}T23:59:59+03:00`).toISOString().slice(0, 19)

// ─── MSK-naive колонки (schedule.starts_at/ends_at) ───────────────────────
// Границы суток МСК как naive-MSK ISO — без всякой конверсии.
export const mskDayStartNaive = (mskDateStr) => `${mskDateStr}T00:00:00`
export const mskDayEndNaive   = (mskDateStr) => `${mskDateStr}T23:59:59`

// Текущий момент МСК как naive ISO — для фильтров "от сейчас" по starts_at.
export const nowMskNaive = () => {
  // sv-SE даёт 'YYYY-MM-DD HH:MM:SS' в указанной TZ; заменяем разделитель на 'T'.
  const s = new Date().toLocaleString('sv-SE', { timeZone: 'Europe/Moscow' })
  return s.replace(' ', 'T')
}

// MSK-naive ISO для произвольного момента (для гейтов "до старта урока" и т.п.)
export const toMskNaive = (d) => {
  const s = new Date(d).toLocaleString('sv-SE', { timeZone: 'Europe/Moscow' })
  return s.replace(' ', 'T')
}
