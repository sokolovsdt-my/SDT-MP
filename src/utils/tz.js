// Часовой пояс приложения — Europe/Moscow (UTC+3, без DST с 2011 г.).
// БД хранит timestamp WITHOUT time zone в UTC, поэтому границы суток
// МСК нужно отдавать в UTC-проекции — иначе у админа не из МСК
// (и в редкий случай некорректной TZ браузера) выручка/расписание съезжают.

// Текущая МСК-дата в формате 'YYYY-MM-DD'
export const todayMsk = () =>
  new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Moscow' })

// МСК-дата произвольного момента
export const toMskDateStr = (d) =>
  new Date(d).toLocaleDateString('sv-SE', { timeZone: 'Europe/Moscow' })

// Начало суток МСК — naive-UTC ISO 'YYYY-MM-DDTHH:MM:SS'.
// Используется в .gte('sale_date', ...) для полей timestamp WITHOUT time zone.
export const mskDayStartUtc = (mskDateStr) =>
  new Date(`${mskDateStr}T00:00:00+03:00`).toISOString().slice(0, 19)

// Конец суток МСК — naive-UTC ISO
export const mskDayEndUtc = (mskDateStr) =>
  new Date(`${mskDateStr}T23:59:59+03:00`).toISOString().slice(0, 19)
