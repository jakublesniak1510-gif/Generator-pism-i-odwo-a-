import type { Answers, LetterTemplate, Question } from "@/lib/templates/types";

export type ValidationResult =
  | { ok: true; answers: Answers }
  | { ok: false; fieldErrors: Record<string, string> };

export const DEFAULT_MAX_LENGTH: Partial<Record<Question["type"], number>> = {
  text: 200,
  textarea: 2000,
  email: 254,
  phone: 30,
};

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export const PHONE_RE = /^\+?[0-9\s\-()]+$/;
const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const NUMBER_RE = /^-?\d+(\.\d+)?$/;

export function getAllQuestions(template: LetterTemplate): Question[] {
  return template.sections.flatMap((s) => s.questions);
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function isEmpty(v: unknown): boolean {
  return v === undefined || v === null || (typeof v === "string" && v.trim() === "");
}

/** Wartość porównywana w `showIf` – checkbox: "true"/"false", reszta: tekst. */
function comparable(v: unknown): string {
  if (v === undefined || v === null) return "";
  if (typeof v === "boolean") return v ? "true" : "false";
  return String(v).trim();
}

/** Czy pytanie jest widoczne (rekurencyjnie – ukryty rodzic ukrywa dziecko). */
export function isQuestionVisible(
  q: Question,
  byId: Map<string, Question>,
  raw: Record<string, unknown>,
  seen: Set<string> = new Set(),
): boolean {
  if (!q.showIf) return true;
  if (seen.has(q.id)) return false; // cykl w definicji szablonu
  seen.add(q.id);
  const parent = byId.get(q.showIf.questionId);
  if (parent && !isQuestionVisible(parent, byId, raw, seen)) return false;
  let parentValue = raw[q.showIf.questionId];
  if (parent?.type === "checkbox") parentValue = toBoolean(parentValue) ?? false;
  const value = comparable(parentValue);
  const expected = Array.isArray(q.showIf.equals) ? q.showIf.equals : [q.showIf.equals];
  return expected.includes(value);
}

function toBoolean(v: unknown): boolean | null {
  if (v === true || v === 1) return true;
  if (v === false || v === 0 || v === undefined || v === null) return false;
  if (typeof v === "string") {
    const s = v.trim().toLowerCase();
    if (["true", "on", "tak", "1", "yes"].includes(s)) return true;
    if (["false", "off", "nie", "0", "no", ""].includes(s)) return false;
  }
  return null;
}

export function parseNumber(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v !== "string") return null;
  const s = v.replace(/[\s ]/g, "").replace(",", ".");
  if (!NUMBER_RE.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export function isValidIsoDate(s: string): boolean {
  const m = ISO_DATE_RE.exec(s);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (y < 1900 || y > 2200) return false;
  const date = new Date(Date.UTC(y, mo - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === mo - 1 && date.getUTCDate() === d;
}

function formatLimit(n: number): string {
  return String(n).replace(".", ",");
}

/**
 * Waliduje i normalizuje odpowiedzi na podstawie `template.sections`.
 * Zwraca tylko odpowiedzi na widoczne pytania; nieznane klucze są błędem.
 */
export function validateAnswers(template: LetterTemplate, rawAnswers: unknown): ValidationResult {
  const fieldErrors: Record<string, string> = {};
  if (!isPlainObject(rawAnswers)) {
    return { ok: false, fieldErrors: { _form: "Nieprawidłowy format odpowiedzi." } };
  }

  const questions = getAllQuestions(template);
  const byId = new Map(questions.map((q) => [q.id, q]));

  for (const key of Object.keys(rawAnswers)) {
    if (!byId.has(key)) fieldErrors[key] = "Nieznane pole formularza.";
  }

  const answers: Answers = {};

  for (const q of questions) {
    if (!isQuestionVisible(q, byId, rawAnswers)) continue;
    const raw = rawAnswers[q.id];

    if (q.type === "checkbox") {
      const b = toBoolean(raw);
      if (b === null) {
        fieldErrors[q.id] = "Nieprawidłowa wartość pola wyboru.";
      } else if (q.required === true && !b) {
        // checkbox jest wymagany tylko przy jawnym `required: true` (np. zgoda/oświadczenie)
        fieldErrors[q.id] = "Zaznacz to pole, aby kontynuować.";
      } else {
        answers[q.id] = b;
      }
      continue;
    }

    if (isEmpty(raw)) {
      if (q.required !== false) fieldErrors[q.id] = "To pole jest wymagane.";
      continue;
    }

    if (typeof raw !== "string" && typeof raw !== "number") {
      fieldErrors[q.id] = "Nieprawidłowa wartość.";
      continue;
    }

    const rules = q.validate ?? {};

    switch (q.type) {
      case "number":
      case "money": {
        const n = parseNumber(raw);
        if (n === null) {
          fieldErrors[q.id] = q.type === "money" ? "Podaj kwotę, np. 149,99." : "Podaj liczbę.";
          break;
        }
        const min = rules.min ?? (q.type === "money" ? 0 : undefined);
        if (min !== undefined && n < min) {
          fieldErrors[q.id] = `Wartość nie może być mniejsza niż ${formatLimit(min)}.`;
          break;
        }
        if (rules.max !== undefined && n > rules.max) {
          fieldErrors[q.id] = `Wartość nie może być większa niż ${formatLimit(rules.max)}.`;
          break;
        }
        answers[q.id] = q.type === "money" ? Math.round(n * 100) / 100 : n;
        break;
      }

      case "date": {
        const s = String(raw).trim();
        if (!isValidIsoDate(s)) {
          fieldErrors[q.id] = "Podaj poprawną datę (RRRR-MM-DD).";
          break;
        }
        answers[q.id] = s;
        break;
      }

      case "select":
      case "radio": {
        const s = String(raw).trim();
        const allowed = (q.options ?? []).map((o) => o.value);
        if (!allowed.includes(s)) {
          fieldErrors[q.id] = "Wybierz jedną z dostępnych opcji.";
          break;
        }
        answers[q.id] = s;
        break;
      }

      case "text":
      case "textarea":
      case "email":
      case "phone": {
        const s = String(raw).trim();
        const maxLength = rules.maxLength ?? DEFAULT_MAX_LENGTH[q.type] ?? 200;
        if (s.length > maxLength) {
          fieldErrors[q.id] = `Tekst jest za długi (maksymalnie ${maxLength} znaków).`;
          break;
        }
        if (q.type === "email" && !EMAIL_RE.test(s)) {
          fieldErrors[q.id] = "Podaj poprawny adres e-mail.";
          break;
        }
        if (q.type === "phone") {
          const digits = s.replace(/\D/g, "").length;
          if (!PHONE_RE.test(s) || digits < 6 || digits > 15) {
            fieldErrors[q.id] = "Podaj poprawny numer telefonu.";
            break;
          }
        }
        if (rules.pattern) {
          let re: RegExp | null = null;
          try {
            re = new RegExp(rules.pattern);
          } catch {
            re = null; // błędny wzorzec w szablonie – nie blokujemy użytkownika
          }
          if (re && !re.test(s)) {
            fieldErrors[q.id] = "Nieprawidłowy format.";
            break;
          }
        }
        if (rules.min !== undefined && s.length < rules.min) {
          fieldErrors[q.id] = `Tekst jest za krótki (minimum ${rules.min} znaków).`;
          break;
        }
        answers[q.id] = s;
        break;
      }

      default: {
        fieldErrors[q.id] = "Nieobsługiwany typ pola.";
      }
    }
  }

  if (Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors };
  return { ok: true, answers };
}
