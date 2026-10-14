import { getDocument, verifyToken } from "@/lib/db";
import { getTemplate } from "@/lib/templates";
import { buildGetResponse } from "../../_lib/document-response";
import { apiError, isUuid, json } from "../../_lib/http";

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
