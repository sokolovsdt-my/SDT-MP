// Русские склонения: plural(n, ['день', 'дня', 'дней'])
// → 1 день, 2 дня, 5 дней, 11 дней, 21 день, 22 дня...
export const plural = (n, forms) => {
  const abs = Math.abs(n) % 100
  if (abs >= 11 && abs <= 19) return forms[2]
  const last = abs % 10
  if (last === 1) return forms[0]
  if (last >= 2 && last <= 4) return forms[1]
  return forms[2]
}
