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
