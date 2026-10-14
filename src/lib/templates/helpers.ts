import type { Answers, Paragraph, Party, Question } from "./types";

const MONTHS_GENITIVE = [
  "stycznia", "lutego", "marca", "kwietnia", "maja", "czerwca",
  "lipca", "sierpnia", "września", "października", "listopada", "grudnia",
];

/** "14 października 2026 r." */
export function formatDatePl(date: Date | string | undefined): string {
  if (!date) return "____________";
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return "____________";
  return `${d.getDate()} ${MONTHS_GENITIVE[d.getMonth()]} ${d.getFullYear()} r.`;
}

/** "1 234,50 zł" */
export function formatMoneyPl(amount: number | string | undefined): string {
  if (amount === undefined || amount === "" || amount === null) return "______ zł";
  const n = typeof amount === "string" ? Number(amount.replace(",", ".")) : amount;
  if (Number.isNaN(n)) return "______ zł";
  return (
    new Intl.NumberFormat("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n) +
    " zł"
  );
}

export function str(answers: Answers, id: string, fallback = "____________"): string {
  const v = answers[id];
  if (v === undefined || v === null || v === "" || v === false) return fallback;
  return String(v).trim();
}

export function num(answers: Answers, id: string): number | undefined {
  const v = answers[id];
  if (v === undefined || v === "" || v === null) return undefined;
  const n = typeof v === "number" ? v : Number(String(v).replace(",", "."));
  return Number.isNaN(n) ? undefined : n;
}

export function bool(answers: Answers, id: string): boolean {
  const v = answers[id];
  return v === true || v === "true" || v === "tak";
}

/** Buduje stronę pisma z typowych pól: *_name, *_street, *_postal, *_city */
export function partyFromAnswers(answers: Answers, prefix: string, extra: string[] = []): Party {
  const street = str(answers, `${prefix}_street`, "");
  const postal = str(answers, `${prefix}_postal`, "");
  const city = str(answers, `${prefix}_city`, "");
  const addressLines = [street, [postal, city].filter(Boolean).join(" ")].filter(Boolean);
  return {
    name: str(answers, `${prefix}_name`),
    addressLines: addressLines.length ? addressLines : ["____________"],
    extra: extra.filter(Boolean),
  };
}

export const p = (text: string): Paragraph => ({ type: "p", text });
export const heading = (text: string): Paragraph => ({ type: "heading", text });
export const list = (items: string[]): Paragraph => ({ type: "list", items });

/** Dzieli tekst AI na akapity */
export function paragraphsFromText(text: string | undefined): Paragraph[] {
  if (!text) return [];
  return text
    .split(/\n{2,}/)
    .map((t) => t.trim())
    .filter(Boolean)
    .map(p);
}

/** Standardowe pytania o dane nadawcy (osoba fizyczna) */
export function senderQuestions(withEmailPhone = true): Question[] {
  const qs: Question[] = [
    { id: "sender_name", label: "Imię i nazwisko", type: "text", placeholder: "Jan Kowalski" },
    { id: "sender_street", label: "Ulica i numer", type: "text", placeholder: "ul. Prosta 1/2" },
    { id: "sender_postal", label: "Kod pocztowy", type: "text", placeholder: "00-001", validate: { pattern: "^\\d{2}-\\d{3}$" } },
    { id: "sender_city", label: "Miejscowość", type: "text", placeholder: "Warszawa" },
  ];
  if (withEmailPhone) {
    qs.push(
      { id: "sender_email", label: "Adres e-mail", type: "email", placeholder: "jan@przyklad.pl", required: false },
      { id: "sender_phone", label: "Telefon", type: "phone", placeholder: "600 000 000", required: false },
    );
  }
  return qs;
}

/** Standardowe pytania o adresata (firma / instytucja) */
export function recipientQuestions(label = "Dane adresata"): Question[] {
  return [
    { id: "recipient_name", label: `${label} – nazwa`, type: "text", placeholder: "Nazwa firmy / instytucji" },
    { id: "recipient_street", label: "Ulica i numer", type: "text", placeholder: "ul. Przykładowa 10" },
    { id: "recipient_postal", label: "Kod pocztowy", type: "text", placeholder: "00-001", validate: { pattern: "^\\d{2}-\\d{3}$" } },
    { id: "recipient_city", label: "Miejscowość", type: "text", placeholder: "Warszawa" },
  ];
}

/** Pierwsza litera wielka, kropka na końcu (do zdań budowanych z odpowiedzi użytkownika). */
export function sentence(text: string): string {
  const t = text.trim().replace(/[ \t]+/g, " ");
  if (!t) return t;
  const capital = t.charAt(0).toUpperCase() + t.slice(1);
  return /[.!?…:]$/.test(capital) ? capital : `${capital}.`;
}

/** Usuwa podwójne kropki i spacje, spacje przed interpunkcją. */
export function tidy(text: string): string {
  return text
    .replace(/\.{2,}/g, (m) => (m.length === 2 ? "." : m))
    .replace(/[ \t]{2,}/g, " ")
    .replace(/ +([,.;:])/g, "$1")
    .trim();
}

export function tidyParagraph(par: Paragraph): Paragraph {
  if (par.type === "list") return { type: "list", items: par.items.map(tidy) };
  return { ...par, text: tidy(par.text) };
}

/** Opis użytkownika (textarea) -> lista zdań/akapitów z poprawioną wielką literą i kropką. */
export function userParagraphs(text: string): string[] {
  return text
    .split(/\n+/)
    .map((t) => sentence(t))
    .filter(Boolean);
}
