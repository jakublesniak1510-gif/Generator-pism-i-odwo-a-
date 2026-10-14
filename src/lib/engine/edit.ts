import type { Paragraph } from "@/lib/templates/types";

/** Limity edycji pisma w przeglądarce (kontrakt: PATCH /api/documents/[id]). */
export const EDIT_LIMITS = {
  maxParagraphs: 60,
  maxParagraphChars: 3000,
  maxListItems: 50,
  maxAttachments: 20,
  maxAttachmentChars: 300,
} as const;

export type EditValidationResult =
  | { ok: true; paragraphs: Paragraph[]; attachments?: string[] }
  | { ok: false; error: string };

/** Usuwa znaki sterujące (poza \n), normalizuje końce linii, przycina. */
function cleanText(s: string, allowNewlines: boolean): string {
  let t = s.replace(/\r\n?/g, "\n").replace(/\t/g, " ");
  t = t.replace(/[\u0000-\u0009\u000b-\u001f\u007f\u2028\u2029]/g, "");
  if (!allowNewlines) t = t.replace(/\n+/g, " ");
  return t.replace(/\n{3,}/g, "\n\n").trim();
}

/**
 * Waliduje akapity i załączniki przesłane przez użytkownika. Puste akapity są pomijane.
 * Zwraca znormalizowane dane (nowe obiekty – bez dodatkowych pól z żądania).
 */
export function validateEditedContent(rawParagraphs: unknown, rawAttachments: unknown): EditValidationResult {
  const L = EDIT_LIMITS;
  if (!Array.isArray(rawParagraphs)) return { ok: false, error: "Brak listy akapitów (paragraphs)." };
  if (rawParagraphs.length > L.maxParagraphs) {
    return { ok: false, error: `Pismo może mieć najwyżej ${L.maxParagraphs} akapitów.` };
  }

  const paragraphs: Paragraph[] = [];
  for (let i = 0; i < rawParagraphs.length; i++) {
    const raw = rawParagraphs[i] as { type?: unknown; text?: unknown; items?: unknown } | null;
    const n = i + 1;
    if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
      return { ok: false, error: `Akapit ${n}: nieprawidłowy format.` };
    }
    if (raw.type === "p" || raw.type === "heading") {
      if (typeof raw.text !== "string") return { ok: false, error: `Akapit ${n}: brak tekstu.` };
      const text = cleanText(raw.text, raw.type === "p");
      if (text.length > L.maxParagraphChars) {
        return { ok: false, error: `Akapit ${n} jest za długi (maksymalnie ${L.maxParagraphChars} znaków).` };
      }
      if (text) paragraphs.push({ type: raw.type, text });
      continue;
    }
    if (raw.type === "list") {
      if (!Array.isArray(raw.items) || raw.items.some((it) => typeof it !== "string")) {
        return { ok: false, error: `Akapit ${n}: lista musi zawierać pozycje tekstowe.` };
      }
      if (raw.items.length > L.maxListItems) {
        return { ok: false, error: `Akapit ${n}: lista może mieć najwyżej ${L.maxListItems} pozycji.` };
      }
      const items = (raw.items as string[]).map((it) => cleanText(it, false)).filter(Boolean);
      const total = items.reduce((sum, it) => sum + it.length, 0);
      if (total > L.maxParagraphChars) {
        return { ok: false, error: `Akapit ${n} jest za długi (maksymalnie ${L.maxParagraphChars} znaków).` };
      }
      if (items.length) paragraphs.push({ type: "list", items });
      continue;
    }
    return { ok: false, error: `Akapit ${n}: nieobsługiwany typ (dozwolone: p, heading, list).` };
  }
  if (paragraphs.length === 0) return { ok: false, error: "Pismo musi zawierać co najmniej jeden akapit." };

  if (rawAttachments === undefined) return { ok: true, paragraphs };
  if (!Array.isArray(rawAttachments) || rawAttachments.some((a) => typeof a !== "string")) {
    return { ok: false, error: "Załączniki muszą być listą tekstów." };
  }
  if (rawAttachments.length > L.maxAttachments) {
    return { ok: false, error: `Możesz podać najwyżej ${L.maxAttachments} załączników.` };
  }
  const attachments = (rawAttachments as string[]).map((a) => cleanText(a, false)).filter(Boolean);
  if (attachments.some((a) => a.length > L.maxAttachmentChars)) {
    return { ok: false, error: `Opis załącznika może mieć najwyżej ${L.maxAttachmentChars} znaków.` };
  }
  return { ok: true, paragraphs, attachments };
}
