// Утилиты для безопасного построения PostgREST-запросов.

// escapeIlike — экранирует пользовательский ввод для использования внутри
// .or(`col.ilike.%${value}%`) или .ilike('col', `%${value}%`).
//
// Закрывает три класса проблем:
//   1. Wildcard inflation в ilike: `%` и `_` имеют специальное значение,
//      пользовательский ввод не должен превращаться в wildcards.
//   2. Поломка .or-парсера PostgREST: запятые делят OR на N условий,
//      скобки группируют, * — alias для %. Экранируем символы через
//      backslash, иначе строка ломает грамматику.
//   3. Защита от запросов вида `,,,,name.is.null` — попытка инъекции
//      дополнительных операторов через ввод.
//
// Используй для любого user-provided value перед подстановкой в template-
// literal .or() / .ilike(). Если значение пустое — возвращает пустую строку.
//
// Примеры:
//   escapeIlike("o'leary")      → "o''leary"  (PostgREST-style single quote)
//   escapeIlike("100%")         → "100\\%"
//   escapeIlike("a,b)c*")       → "a\\,b\\)c\\*"
export function escapeIlike(value) {
  if (value == null) return ''
  // Single quote — двойной для SQL-литералов в .or().
  // Остальные — backslash-escape.
  return String(value)
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "''")
    .replace(/%/g, '\\%')
    .replace(/_/g, '\\_')
    .replace(/,/g, '\\,')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
    .replace(/\*/g, '\\*')
}
