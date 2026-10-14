import type { Instructions, LegalBasis, LetterDocument } from "./templates/types";

export type DocumentStatus = "preview" | "paid";

export interface ComputedDeadline {
  id: string;
  label: string;
  /** ISO date (YYYY-MM-DD) albo null, gdy użytkownik nie podał daty bazowej */
  date: string | null;
  /** ile dni zostało (ujemne = termin minął); null gdy brak daty */
  daysLeft: number | null;
  description: string;
}

/** POST /api/documents  (body: { slug: string; answers: Answers }) */
export interface CreateDocumentResponse {
  id: string;
  token: string;
  status: DocumentStatus;
  /** pismo ucięte do `previewParagraphCount` akapitów; pozostałe akapity zastąpione `lockedParagraphs` */
  document: LetterDocument;
  lockedParagraphs: number;
  deadlines: ComputedDeadline[];
  /** true gdy akapity faktów zredagowało AI; false = czysty szablon */
  aiUsed: boolean;
}

/** GET /api/documents/[id]?token=... */
export interface GetDocumentResponse extends CreateDocumentResponse {
  slug: string;
  templateName: string;
  priceGrosze: number;
  legalBasis: LegalBasis[];
  instructions: Instructions;
  createdAt: string;
  paidAt: string | null;
}

/** POST /api/documents/[id]/checkout  (body: { token: string; consent: true }) – `consent` to zgoda na natychmiastowe dostarczenie treści cyfrowej (art. 38 ust. 1 pkt 13 u.p.k.); bez niej 400 */
export interface CheckoutResponse {
  /** adres, na który przeglądarka ma przekierować (Stripe Checkout lub od razu strona dokumentu w trybie dev) */
  url: string;
}

export interface ApiError {
  error: string;
  /** błędy walidacji: id pytania -> komunikat */
  fieldErrors?: Record<string, string>;
}

/* ===================== FALA 2 ===================== */

/** GET /api/capabilities – co jest skonfigurowane na serwerze (UI ukrywa niedostępne funkcje) */
export interface CapabilitiesResponse {
  /** wypełnianie formularza ze zdjęcia/tekstu dokumentu (wymaga ANTHROPIC_API_KEY) */
  aiPrefill: boolean;
  /** wysyłka linku do pisma e-mailem (wymaga RESEND_API_KEY) */
  email: boolean;
  payments: "dev" | "stripe";
}

/**
 * POST /api/prefill – multipart/form-data: `slug`, opcjonalnie `text` (wklejona treść) i/lub `file`
 * (image/jpeg, image/png, image/webp, application/pdf, ≤ 8 MB). Zwraca tylko pola, które model
 * odczytał z dokumentu. 503 gdy AI nieskonfigurowane, 400 zły plik, 429 limit 10/h/IP.
 */
export interface PrefillResponse {
  answers: Record<string, string | number | boolean>;
  /** id pytań, które udało się wypełnić */
  filledQuestionIds: string[];
}

/**
 * PATCH /api/documents/[id] – body { token, paragraphs: Paragraph[], attachments?: string[] }.
 * Tylko dla opłaconych pism. Limity: ≤ 60 akapitów, każdy ≤ 3000 znaków, załączniki ≤ 20 × 300 znaków.
 * Zwraca GetDocumentResponse z zaktualizowanym pismem; DOCX/PDF generują się z wersji po edycji.
 */

/** POST /api/documents/[id]/redeem – body { token, code, consent: true } → odblokowanie kodem (pakiet / promocja) */
export interface RedeemResponse {
  status: "paid";
  /** ile użyć kodu pozostało */
  remaining: number;
}

/**
 * POST /api/packages/checkout – body { consent: true, email?: string } → { url }.
 * Tryb dev: od razu tworzy kod i przekierowuje na /pakiet/sukces?session=<id>.
 * Tryb stripe: Stripe Checkout; webhook tworzy kod; success_url = /pakiet/sukces?session={CHECKOUT_SESSION_ID}.
 */
export interface PackageCheckoutResponse {
  url: string;
}

/** GET /api/packages/session?session=... → kod pakietu (gdy webhook już go utworzył), inaczej { ready: false } */
export type PackageSessionResponse = { ready: true; code: string; uses: number } | { ready: false };

/** POST /api/documents/[id]/email – body { token, email } → 202 (wysłano) / 503 (brak konfiguracji e-mail) */

/** POST /api/cron/cleanup – nagłówek `Authorization: Bearer <CRON_SECRET>` → usuwa pisma starsze niż DOCUMENT_RETENTION_DAYS (domyślnie 90) */
export interface CleanupResponse {
  deleted: number;
}
