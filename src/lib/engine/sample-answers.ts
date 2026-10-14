import type { Answers, LetterTemplate, Question } from "@/lib/templates/types";
import { getAllQuestions, isQuestionVisible } from "./validate";

/**
 * Generator przykładowych, poprawnych odpowiedzi dla szablonu (testy, podglądy, skrypty).
 * Dwa przebiegi: (1) wartość dla każdego pytania, (2) usunięcie pytań ukrytych przez `showIf`.
 */

function matches(pattern: string | undefined, value: string): boolean {
  if (!pattern) return true;
  try {
    return new RegExp(pattern).test(value);
  } catch {
    return true;
  }
}

function clampNumber(q: Question, preferred: number): number {
  const { min, max } = q.validate ?? {};
  let n = preferred;
  if (min !== undefined && n < min) n = min;
  if (max !== undefined && n > max) n = max;
  return n;
}

function fitLength(q: Question, text: string, fallbackMax: number): string {
  const max = q.validate?.maxLength ?? fallbackMax;
  let t = text;
  const min = q.validate?.min;
  while (min !== undefined && t.length < min) t = `${t} ${text}`;
  return t.length > max ? t.slice(0, max).trim() : t;
}

export function sampleValue(q: Question): string | number | boolean | undefined {
  const pattern = q.validate?.pattern;
  switch (q.type) {
    case "text": {
      const candidates = [q.placeholder, "Przykład", "00-001", "ABC123", "12345", "1"].filter(
        (c): c is string => typeof c === "string" && c.trim() !== "",
      );
      const hit = candidates.find((c) => matches(pattern, c));
      return fitLength(q, hit ?? "Przykład", 200);
    }
    case "textarea":
      return fitLength(q, "To jest pierwsze przykładowe zdanie opisu. To jest drugie przykładowe zdanie opisu.", 2000);
    case "date":
      return "2026-09-01";
    case "number":
      return clampNumber(q, q.validate?.min ?? 2);
    case "money":
      return clampNumber(q, 149.99);
    case "select":
    case "radio":
      return q.options?.[0]?.value;
    case "checkbox":
      return true;
    case "email":
      return "jan.kowalski@example.com";
    case "phone":
      return "+48 600 700 800";
    default:
      return undefined;
  }
}

export function generateSampleAnswers(template: LetterTemplate): Answers {
  const questions = getAllQuestions(template);
  const byId = new Map(questions.map((q) => [q.id, q]));
  const answers: Record<string, string | number | boolean> = {};
  for (const q of questions) {
    const v = sampleValue(q);
    if (v !== undefined) answers[q.id] = v;
  }
  const snapshot = { ...answers };
  for (const q of questions) {
    if (!isQuestionVisible(q, byId, snapshot)) delete answers[q.id];
  }
  return answers;
}
