// Хелпер для построения URL Supabase Edge Functions.
// Все вызовы (telegram-login, create-staff, ...) идут на один origin —
// держим его в одном месте, чтобы при смене проекта (stage/prod)
// не пришлось править 4 файла.
export const edgeUrl = (fn) => `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${fn}`
