import type { CheckoutResponse } from "@/lib/api-types";
import { getDocument, verifyToken } from "@/lib/db";
import { createCheckoutUrl, documentUrl } from "@/lib/payments/stripe";
import { getTemplate } from "@/lib/templates";
import { apiError, isUuid, json, readJson } from "../../../_lib/http";

export const runtime = "nodejs";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await params;
  const body = await readJson(req);
  const token =
    typeof body === "object" && body !== null && typeof (body as { token?: unknown }).token === "string"
      ? (body as { token: string }).token
      : null;

  if (!isUuid(id) || !verifyToken(id, token)) {
    return apiError(403, "Brak dostępu do tego pisma.");
  }
  const doc = getDocument(id);
  const template = doc ? getTemplate(doc.slug) : undefined;
  if (!doc || !template) return apiError(404, "Nie znaleziono pisma.");

  if (doc.status === "paid") {
    return json<CheckoutResponse>({ url: documentUrl(id, token as string) });
  }

  try {
    const url = await createCheckoutUrl(doc, template, token as string);
    return json<CheckoutResponse>({ url });
  } catch (err) {
    console.error("[api/checkout] nie udało się utworzyć płatności", err);
    return apiError(502, "Nie udało się rozpocząć płatności. Spróbuj ponownie za chwilę.");
  }
}
