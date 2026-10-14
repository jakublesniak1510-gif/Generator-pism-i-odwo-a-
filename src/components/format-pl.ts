/** Formatowanie po polsku (bezpieczne dla komponentów klienckich). */

const MONTHS_GENITIVE = [
  "stycznia", "lutego", "marca", "kwietnia", "maja", "czerwca",
  "lipca", "sierpnia", "września", "października", "listopada", "grudnia",
];

/** "2026-10-14" -> "14 października 2026 r." (bez przesunięć strefy czasowej). */
export function formatIsoDatePl(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  const month = Number(m[2]) - 1;
  if (month < 0 || month > 11) return iso;
  return `${Number(m[3])} ${MONTHS_GENITIVE[month]} ${m[1]} r.`;
}

/** Odmiana: 1 akapit, 2 akapity, 5 akapitów. */
export function pluralPl(n: number, one: string, few: string, many: string): string {
  const abs = Math.abs(n);
  if (abs === 1) return one;
  const lastDigit = abs % 10;
  const lastTwo = abs % 100;
  if (lastDigit >= 2 && lastDigit <= 4 && (lastTwo < 12 || lastTwo > 14)) return few;
  return many;
}

/** "zostało 5 dni" / "został 1 dzień" / "termin upływa dziś" / "termin minął". */
export function daysLeftLabel(daysLeft: number): string {
  if (daysLeft < 0) return "termin minął";
  if (daysLeft === 0) return "termin upływa dziś";
  if (daysLeft === 1) return "został 1 dzień";
  return `zostało ${daysLeft} dni`;
}
