import type { ComputedDeadline } from "@/lib/api-types";
import type { Answers, LetterTemplate } from "@/lib/templates/types";

const DAY_MS = 24 * 60 * 60 * 1000;

function parseIsoDate(v: unknown): Date | null {
  if (typeof v !== "string") return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v.trim());
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return Number.isNaN(d.getTime()) ? null : d;
}

function daysInMonthUtc(year: number, monthIndex: number): number {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

/**
 * Dodaje lata/miesiące/dni do daty (UTC).
 * Miesiące i lata liczone jak w art. 112 k.c.: gdy w miesiącu końcowym nie ma
 * dnia o tej samej dacie, termin upływa ostatniego dnia miesiąca (31.01 + 1 mies. = 28/29.02).
 */
export function addPeriod(base: Date, period: { days?: number; months?: number; years?: number }): Date {
  const totalMonths = (period.years ?? 0) * 12 + (period.months ?? 0);
  const y = base.getUTCFullYear();
  const m = base.getUTCMonth() + totalMonths;
  const targetYear = y + Math.floor(m / 12);
  const targetMonth = ((m % 12) + 12) % 12;
  const day = Math.min(base.getUTCDate(), daysInMonthUtc(targetYear, targetMonth));
  const result = new Date(Date.UTC(targetYear, targetMonth, day));
  if (period.days) result.setUTCDate(result.getUTCDate() + period.days);
  return result;
}

function toIso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Terminy dla pisma; `today` – bieżąca data (liczona po dniu kalendarzowym w strefie serwera). */
export function computeDeadlines(template: LetterTemplate, answers: Answers, today: Date): ComputedDeadline[] {
  const todayUtc = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  return template.deadlines.map((rule) => {
    const base = parseIsoDate(answers[rule.fromQuestionId]);
    if (!base) {
      return { id: rule.id, label: rule.label, date: null, daysLeft: null, description: rule.description };
    }
    const due = addPeriod(base, rule);
    return {
      id: rule.id,
      label: rule.label,
      date: toIso(due),
      daysLeft: Math.round((due.getTime() - todayUtc) / DAY_MS),
      description: rule.description,
    };
  });
}
