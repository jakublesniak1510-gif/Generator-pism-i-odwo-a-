import type { LetterDocument } from "@/lib/templates/types";

export interface PreviewResult {
  document: LetterDocument;
  /** liczba akapitów usuniętych z podglądu */
  lockedParagraphs: number;
}

/** Ucina pismo do `previewParagraphCount` akapitów (darmowy podgląd). */
export function toPreview(doc: LetterDocument): PreviewResult {
  const keep = Math.max(0, Math.floor(doc.previewParagraphCount));
  const visible = doc.paragraphs.slice(0, keep);
  return {
    document: {
      ...doc,
      paragraphs: visible,
      attachments: [...doc.attachments],
    },
    lockedParagraphs: doc.paragraphs.length - visible.length,
  };
}
