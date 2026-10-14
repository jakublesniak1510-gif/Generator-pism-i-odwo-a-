import type { CreateDocumentResponse, GetDocumentResponse } from "@/lib/api-types";
import type { StoredDocument } from "@/lib/db";
import { computeDeadlines } from "@/lib/engine/deadlines";
import { toPreview } from "@/lib/engine/preview";
import type { LetterTemplate } from "@/lib/templates/types";

/** Pełne pismo tylko po opłaceniu; inaczej podgląd. */
export function buildCreateResponse(doc: StoredDocument, template: LetterTemplate, token: string): CreateDocumentResponse {
  const view =
    doc.status === "paid" ? { document: doc.document, lockedParagraphs: 0 } : toPreview(doc.document);
  return {
    id: doc.id,
    token,
    status: doc.status,
    document: view.document,
    lockedParagraphs: view.lockedParagraphs,
    deadlines: computeDeadlines(template, doc.answers, new Date()),
    aiUsed: doc.aiUsed,
  };
}

export function buildGetResponse(doc: StoredDocument, template: LetterTemplate, token: string): GetDocumentResponse {
  return {
    ...buildCreateResponse(doc, template, token),
    slug: doc.slug,
    templateName: template.name,
    priceGrosze: template.priceGrosze,
    legalBasis: template.legalBasis,
    instructions: template.instructions,
    createdAt: doc.createdAt,
    paidAt: doc.paidAt,
  };
}
