/**
 * Filtr bezpieczeństwa tekstu AI. AI nie może przywoływać przepisów, orzeczeń
 * ani aktów prawnych – robi to wyłącznie szablon (zasada nr 1 w ARCHITEKTURA.md).
 */
const LEGAL_CITATION_PATTERNS: RegExp[] = [
  /\bart\./iu,
  /\bust\./iu,
  /§/u,
  /sygn/iu,
  /\bustaw/iu,
  /rozporządzeni/iu,
  /kodeks/iu,
  /k\.c\./iu,
  /\bkc\b/iu,
  /wyrok/iu,
  /orzecz/iu,
  /uchwał/iu,
  /trybunał/iu,
  /sąd najwyższy/iu,
  /dyrektyw/iu,
  /\b(WE|UE)\s*nr/iu,
];

export function containsLegalCitation(text: string | undefined | null): boolean {
  if (!text) return false;
  return LEGAL_CITATION_PATTERNS.some((re) => re.test(text));
}
