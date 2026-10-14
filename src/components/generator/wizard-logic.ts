/**
 * Czysta logika kreatora: widoczność pól (showIf), walidacja po stronie klienta
 * i serializacja odpowiedzi do `Answers` wysyłanych do POST /api/documents.
 */
import type { Answers, Question, QuestionSection } from "@/lib/templates/types";

/** Surowy stan formularza: teksty jako string, checkbox jako boolean. */
export type FormValues = Record<string, string | boolean>;

/**
 * Domyślnie pole jest wymagane. Wyjątek (zgodnie z walidacją backendu): checkbox jest
 * wymagany tylko przy jawnym `required: true` (np. oświadczenie / zgoda).
 */
export function isRequired(q: Question): boolean {
  if (q.type === "checkbox") return q.required === true;
  return q.required !== false;
}

/** Domyślne limity długości – takie same jak w walidacji backendu (src/lib/engine/validate.ts). */
const DEFAULT_MAX_LENGTH: Partial<Record<Question["type"], number>> = {
  text: 200,
  textarea: 2000,
  email: 254,
  phone: 30,
};

export function maxLengthOf(q: Question): number | undefined {
  return q.validate?.maxLength ?? DEFAULT_MAX_LENGTH[q.type];
}

function rawToComparable(v: string | boolean | undefined): string {
  if (v === undefined) return "";
  return typeof v === "boolean" ? String(v) : v;
}

/** Pole jest widoczne, gdy spełnia `showIf` (i pole sterujące samo jest widoczne). */
export function isVisible(q: Question, values: FormValues, all: Map<string, Question>, depth = 0): boolean {
  if (!q.showIf) return true;
  if (depth > 10) return true;
  const { questionId, equals } = q.showIf;
  const parent = all.get(questionId);
  if (parent && !isVisible(parent, values, all, depth + 1)) return false;
  const current = rawToComparable(values[questionId]);
  const expected = Array.isArray(equals) ? equals : [equals];
  return expected.includes(current);
}

export function indexQuestions(sections: QuestionSection[]): Map<string, Question> {
  const map = new Map<string, Question>();
  for (const s of sections) for (const q of s.questions) map.set(q.id, q);
  return map;
}

/** "1 234,50" -> 1234.5; NaN gdy nie da się odczytać. */
export function parseDecimal(raw: string): number {
  const cleaned = raw.replace(/[\s ]/g, "").replace(/zł$/i, "").replace(",", ".");
  if (!/^-?\d+(\.\d+)?$/.test(cleaned)) return Number.NaN;
  return Number(cleaned);
}

function formatNumberPl(n: number, money: boolean): string {
  const s = new Intl.NumberFormat("pl-PL", {
    minimumFractionDigits: money ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(n);
  return money ? `${s} zł` : s;
}

function isEmpty(v: string | boolean | undefined): boolean {
  return v === undefined || v === "" || (typeof v === "string" && v.trim() === "");
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_RE = /^\+?[\d\s()-]+$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Zwraca komunikat błędu po polsku albo null. */
export function validateQuestion(q: Question, value: string | boolean | undefined): string | null {
  const required = isRequired(q);

  if (q.type === "checkbox") {
    if (required && value !== true) return "Zaznacz to pole, aby przejść dalej.";
    return null;
  }

  if (isEmpty(value)) {
    if (!required) return null;
    if (q.type === "select" || q.type === "radio") return "Wybierz jedną z opcji.";
    return "To pole jest wymagane.";
  }

  const str = String(value).trim();
  const v = q.validate ?? {};

  switch (q.type) {
    case "email":
      if (!EMAIL_RE.test(str)) return "Podaj poprawny adres e-mail, np. jan@przyklad.pl.";
      break;
    case "phone":
      if (!PHONE_RE.test(str) || str.replace(/\D/g, "").length < 6 || str.replace(/\D/g, "").length > 15)
        return "Podaj poprawny numer telefonu, np. 600 000 000.";
      break;
    case "date": {
      const d = new Date(str);
      if (!DATE_RE.test(str) || Number.isNaN(d.getTime())) return "Podaj poprawną datę.";
      break;
    }
    case "number":
    case "money": {
      const n = parseDecimal(str);
      const money = q.type === "money";
      if (Number.isNaN(n)) return money ? "Podaj kwotę, np. 149,99." : "Podaj liczbę.";
      if (money && !/^-?\d+([.,]\d{1,2})?$/.test(str.replace(/[\s ]/g, "").replace(/zł$/i, "")))
        return "Kwota może mieć najwyżej 2 miejsca po przecinku.";
      const min = v.min ?? (money ? 0 : undefined);
      if (min !== undefined && n < min) return `Wartość nie może być mniejsza niż ${formatNumberPl(min, money)}.`;
      if (v.max !== undefined && n > v.max) return `Wartość nie może być większa niż ${formatNumberPl(v.max, money)}.`;
      break;
    }
    case "select":
    case "radio":
      if (q.options && !q.options.some((o) => o.value === str)) return "Wybierz jedną z opcji.";
      break;
    default:
      break;
  }

  if (q.type === "text" || q.type === "textarea" || q.type === "email" || q.type === "phone") {
    const maxLength = maxLengthOf(q);
    if (maxLength !== undefined && str.length > maxLength)
      return `Maksymalnie ${maxLength} znaków (obecnie ${str.length}).`;
    if (v.min !== undefined && (q.type === "text" || q.type === "textarea") && str.length < v.min)
      return `Wpisz co najmniej ${v.min} znaków (obecnie ${str.length}).`;
  }

  if (v.pattern) {
    let re: RegExp | null = null;
    try {
      re = new RegExp(v.pattern);
    } catch {
      re = null;
    }
    if (re && !re.test(str)) {
      return q.placeholder ? `Niepoprawny format – wpisz np. ${q.placeholder}.` : "Niepoprawny format.";
    }
  }

  return null;
}

/** Waliduje widoczne pola sekcji. */
export function validateSection(
  section: QuestionSection,
  values: FormValues,
  all: Map<string, Question>,
): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const q of section.questions) {
    if (!isVisible(q, values, all)) continue;
    const err = validateQuestion(q, values[q.id]);
    if (err) errors[q.id] = err;
  }
  return errors;
}

/**
 * Buduje `Answers` dla API: money/number jako liczby, checkbox jako boolean,
 * puste i ukryte (showIf) pola pomijane.
 */
export function serializeAnswers(sections: QuestionSection[], values: FormValues): Answers {
  const all = indexQuestions(sections);
  const answers: Answers = {};
  for (const s of sections) {
    for (const q of s.questions) {
      if (!isVisible(q, values, all)) continue;
      const raw = values[q.id];
      if (q.type === "checkbox") {
        answers[q.id] = raw === true;
        continue;
      }
      if (isEmpty(raw)) continue;
      const str = String(raw).trim();
      if (q.type === "number" || q.type === "money") {
        const n = parseDecimal(str);
        if (!Number.isNaN(n)) answers[q.id] = n;
        continue;
      }
      answers[q.id] = str;
    }
  }
  return answers;
}

/** Klucz w sessionStorage dla danego pisma. */
export function storageKey(slug: string): string {
  return `pismogotowe:${slug}`;
}

export interface StoredWizardState {
  values: FormValues;
  step: number;
}

export function loadStoredState(slug: string): StoredWizardState | null {
  try {
    const raw = window.sessionStorage.getItem(storageKey(slug));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredWizardState>;
    if (!parsed || typeof parsed !== "object" || typeof parsed.values !== "object" || !parsed.values) return null;
    const values: FormValues = {};
    for (const [k, v] of Object.entries(parsed.values)) {
      if (typeof v === "string" || typeof v === "boolean") values[k] = v;
    }
    return { values, step: typeof parsed.step === "number" ? parsed.step : 0 };
  } catch {
    return null;
  }
}

export function saveStoredState(slug: string, state: StoredWizardState): void {
  try {
    window.sessionStorage.setItem(storageKey(slug), JSON.stringify(state));
  } catch {
    /* tryb prywatny / brak miejsca – ignorujemy */
  }
}

export function clearStoredState(slug: string): void {
  try {
    window.sessionStorage.removeItem(storageKey(slug));
  } catch {
    /* ignorujemy */
  }
}

/* ===================== Wypełnianie z dokumentu (POST /api/prefill) ===================== */

export interface PrefillMergeResult {
  values: FormValues;
  /** id pól, które wypełniliśmy */
  filled: string[];
  /** id pól pominiętych, bo użytkownik już je wypełnił */
  skippedFilledByUser: string[];
}

const DMY_RE = /^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/;

function toDateValue(raw: string): string | null {
  const s = raw.trim();
  if (DATE_RE.test(s)) return Number.isNaN(new Date(s).getTime()) ? null : s;
  const m = DMY_RE.exec(s);
  if (!m) return null;
  const iso = `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  return Number.isNaN(new Date(iso).getTime()) ? null : iso;
}

function toNumberValue(raw: string | number, money: boolean): string | null {
  const n = typeof raw === "number" ? raw : parseDecimal(raw);
  if (!Number.isFinite(n)) return null;
  // w formularzu kwoty wpisuje się po polsku: „149,99”
  const fixed = money ? n.toFixed(2) : String(n);
  return fixed.replace(".", ",");
}

/** Zamienia wartość z API na wartość pola formularza; null = nie da się jej użyć. */
function convertPrefillValue(q: Question, raw: string | number | boolean): string | boolean | null {
  if (q.type === "checkbox") {
    if (raw === true || raw === "true" || raw === "tak") return true;
    return null;
  }
  if (typeof raw === "boolean") return null;
  const str = String(raw).trim();
  if (!str) return null;
  switch (q.type) {
    case "select":
    case "radio": {
      const opts = q.options ?? [];
      const byValue = opts.find((o) => o.value === str);
      if (byValue) return byValue.value;
      const byLabel = opts.find((o) => o.label.trim().toLowerCase() === str.toLowerCase());
      return byLabel ? byLabel.value : null;
    }
    case "date":
      return toDateValue(str);
    case "number":
    case "money":
      return toNumberValue(typeof raw === "number" ? raw : str, q.type === "money");
    default: {
      const max = maxLengthOf(q);
      return max !== undefined ? str.slice(0, max) : str;
    }
  }
}

/**
 * Łączy odpowiedzi odczytane z dokumentu z bieżącym stanem kreatora.
 * Nie nadpisuje pól, które użytkownik już wypełnił. Pomija checkboxy wymagane
 * (oświadczenia i zgody) – te użytkownik musi zaznaczyć sam.
 */
export function mergePrefill(
  sections: QuestionSection[],
  current: FormValues,
  answers: Record<string, string | number | boolean>,
): PrefillMergeResult {
  const all = indexQuestions(sections);
  const values: FormValues = { ...current };
  const filled: string[] = [];
  const skippedFilledByUser: string[] = [];
  for (const [id, raw] of Object.entries(answers)) {
    const q = all.get(id);
    if (!q) continue;
    if (q.type === "checkbox" && q.required === true) continue;
    const converted = convertPrefillValue(q, raw);
    if (converted === null) continue;
    const existing = current[id];
    const userFilled = q.type === "checkbox" ? existing !== undefined : !isEmpty(existing);
    if (userFilled) {
      if (existing !== converted) skippedFilledByUser.push(id);
      continue;
    }
    values[id] = converted;
    filled.push(id);
  }
  return { values, filled, skippedFilledByUser };
}
