import { getDocument, updateDocumentContent, verifyToken } from "@/lib/db";
import { validateEditedContent } from "@/lib/engine/edit";
import { getTemplate } from "@/lib/templates";
import { buildGetResponse } from "../../_lib/document-response";
import { apiError, bodyToken, isUuid, json, readJson } from "../../_lib/http";

export const runtime = "nodejs";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await params;
  const token = new URL(req.url).searchParams.get("token");

  if (!isUuid(id) || !verifyToken(id, token)) {
    return apiError(403, "Brak dostępu do tego pisma. Sprawdź, czy link jest kompletny.");
  }
  const doc = getDocument(id);
  const template = doc ? getTemplate(doc.slug) : undefined;
  if (!doc || !template) return apiError(404, "Nie znaleziono pisma.");

  return json(buildGetResponse(doc, template, token as string));
}

/**
 * PATCH { token, paragraphs, attachments? } – edycja treści opłaconego pisma.
 * Zmienia wyłącznie `paragraphs` (i opcjonalnie `attachments`); DOCX/PDF generują się z wersji po edycji.
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await params;
  const body = await readJson(req);
  const token = bodyToken(body);

  if (!isUuid(id) || !verifyToken(id, token)) {
    return apiError(403, "Brak dostępu do tego pisma.");
  }
  const doc = getDocument(id);
  const template = doc ? getTemplate(doc.slug) : undefined;
  if (!doc || !template) return apiError(404, "Nie znaleziono pisma.");
  if (doc.status !== "paid") {
    return apiError(403, "Edycja pisma jest dostępna po odblokowaniu pełnej wersji.");
  }

  const { paragraphs, attachments } = body as { paragraphs?: unknown; attachments?: unknown };
  const validation = validateEditedContent(paragraphs, attachments);
  if (!validation.ok) return apiError(400, validation.error);

  const updated = updateDocumentContent(id, {
    paragraphs: validation.paragraphs,
    attachments: validation.attachments,
  });
  if (!updated) return apiError(404, "Nie znaleziono pisma.");

  return json(buildGetResponse(updated, template, token as string));
}
