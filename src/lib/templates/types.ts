/**
 * KONTRAKT SZABLONU PISMA.
 * Każde pismo w serwisie to obiekt `LetterTemplate`. Podstawy prawne, terminy
 * i instrukcje są STATYCZNE (w kodzie, sprawdzone przez prawnika). AI nigdy nie
 * wymyśla przepisów – może jedynie zredagować opis stanu faktycznego i żądanie
 * na podstawie odpowiedzi użytkownika (patrz `AiDraft`).
 */

export type QuestionType =
  | "text"
  | "textarea"
  | "date"
  | "number"
  | "money" // kwota w PLN, wpisywana jako liczba z groszami (np. 149.99)
  | "select"
  | "radio"
  | "checkbox"
  | "email"
  | "phone";

export interface QuestionOption {
  value: string;
  label: string;
}

export interface Question {
  /** klucz w `Answers` – unikalny w obrębie szablonu, snake_case */
  id: string;
  label: string;
  type: QuestionType;
  /** podpowiedź wyświetlana pod polem */
  help?: string;
  placeholder?: string;
  /** domyślnie true */
  required?: boolean;
  /** dla select/radio */
  options?: QuestionOption[];
  /** pole widoczne tylko gdy inna odpowiedź ma daną wartość */
  showIf?: { questionId: string; equals: string | string[] };
  validate?: { min?: number; max?: number; maxLength?: number; pattern?: string };
}

export interface QuestionSection {
  id: string;
  title: string;
  description?: string;
  questions: Question[];
}

/** Odpowiedzi użytkownika: id pytania -> wartość. Checkbox = boolean, money/number = number. */
export type Answers = Record<string, string | number | boolean | undefined>;

export interface LegalBasis {
  /** np. "Ustawa z dnia 30 maja 2014 r. o prawach konsumenta" */
  act: string;
  /** np. "art. 43d ust. 1" */
  article: string;
  /** jednozdaniowe streszczenie, co przepis daje użytkownikowi */
  summary: string;
  /** link do ISAP / EUR-Lex */
  url?: string;
}

export interface DeadlineRule {
  id: string;
  /** np. "Termin na zgłoszenie reklamacji" */
  label: string;
  /** id pytania typu date, od którego liczymy termin */
  fromQuestionId: string;
  days?: number;
  months?: number;
  years?: number;
  /** wyjaśnienie po polsku, skąd termin wynika */
  description: string;
}

export interface Instructions {
  /** markdown: komu i na jaki adres wysłać (skąd wziąć adres) */
  whereToSend: string;
  /** markdown: list polecony za potwierdzeniem odbioru / e-mail / formularz */
  howToSend: string;
  /** markdown: ile czasu ma adresat na odpowiedź i co jeśli nie odpowie */
  afterSending: string;
  /** krótka lista kontrolna przed wysłaniem */
  checklist: string[];
}

export interface GuideSection {
  heading: string;
  /** markdown (akapity, listy, pogrubienia) */
  body: string;
}

export interface FaqItem {
  question: string;
  answer: string;
}

export interface SeoContent {
  /** <title>, max ~60 znaków */
  title: string;
  /** meta description, max ~155 znaków */
  metaDescription: string;
  h1: string;
  /** 2–3 zdania nad generatorem */
  intro: string;
  keywords: string[];
  /** poradnik pod generatorem – min. 600 słów łącznie */
  guide: GuideSection[];
  faq: FaqItem[];
}

export type TemplateCategory =
  | "konsument"
  | "transport"
  | "umowy"
  | "finanse"
  | "mieszkanie"
  | "praca"
  | "dane-osobowe";

export interface Party {
  name: string;
  addressLines: string[];
  /** dodatkowe identyfikatory: PESEL, nr klienta, nr rezerwacji, e-mail */
  extra?: string[];
}

export type Paragraph =
  | { type: "p"; text: string }
  | { type: "heading"; text: string }
  | { type: "list"; items: string[] };

/** Gotowe pismo – niezależne od formatu (DOCX/PDF/HTML renderują to samo). */
export interface LetterDocument {
  sender: Party;
  recipient: Party;
  /** miejscowość nadawcy */
  place: string;
  /** data w formacie "14 października 2026 r." */
  date: string;
  /** tytuł pisma, np. "REKLAMACJA TOWARU" */
  title: string;
  /** opcjonalny podtytuł / dotyczy: */
  subject?: string;
  salutation?: string;
  paragraphs: Paragraph[];
  closing: string;
  signatureName: string;
  attachments: string[];
  /** ile pierwszych akapitów pokazujemy w darmowym podglądzie */
  previewParagraphCount: number;
}

/**
 * Tekst zredagowany przez AI na podstawie odpowiedzi użytkownika.
 * Zawiera WYŁĄCZNIE opis faktów i sformułowanie żądania – zero cytowań przepisów,
 * sygnatur, orzeczeń. Szablon wstawia te akapity w odpowiednie miejsce.
 */
export interface AiDraft {
  /** akapit opisujący stan faktyczny (1–3 akapity, rozdzielone \n\n) */
  facts: string;
  /** akapit z żądaniem / wnioskiem użytkownika */
  demand: string;
  /** opcjonalne uzasadnienie w języku faktów (dlaczego żądanie jest zasadne) */
  justification?: string;
}

export interface RenderContext {
  answers: Answers;
  /** jeśli brak (np. AI niedostępne) szablon musi zbudować pismo wyłącznie z odpowiedzi */
  ai?: AiDraft;
  today: Date;
}

export interface AiGuidance {
  /** opis roli i kontekstu prawnego dla modelu – co to za pismo i jak brzmi dobry opis faktów */
  context: string;
  /** id pytań, z których AI ma korzystać przy pisaniu faktów (reszta jest wstawiana sztywno) */
  factQuestionIds: string[];
}

export interface LetterTemplate {
  /** slug URL: /pisma/[slug] */
  slug: string;
  /** krótka nazwa, np. "Reklamacja towaru" */
  name: string;
  category: TemplateCategory;
  /** 1 zdanie do kafelka na stronie głównej */
  shortDescription: string;
  /** cena w groszach, np. 2499 */
  priceGrosze: number;
  /** emoji lub nazwa ikony do kafelka */
  icon: string;
  /** orientacyjny czas wypełnienia w minutach */
  estimatedMinutes: number;
  sections: QuestionSection[];
  legalBasis: LegalBasis[];
  deadlines: DeadlineRule[];
  instructions: Instructions;
  seo: SeoContent;
  ai: AiGuidance;
  /** deterministyczne składanie pisma; musi działać bez `ctx.ai` */
  render: (ctx: RenderContext) => LetterDocument;
}
