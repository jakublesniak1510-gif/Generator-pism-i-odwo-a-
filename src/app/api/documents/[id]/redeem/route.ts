import type { RedeemResponse } from "@/lib/api-types";
import { getDocument, recordConsent, verifyToken } from "@/lib/db";
import { getCode, normalizeCode, redeemCode } from "@/lib/payments/codes";
import { apiError, bodyToken, clientIp, isUuid, json, rateLimit, readJson, tooManyRequests } from "../../../_lib/http";

export const runtime = "nodejs";

/** Limit prób na IP – ochrona przed zgadywaniem kodów. */
const REDEEM_LIMIT_PER_HOUR = 10;

/** POST { token, code, consent: true } → odblokowanie pisma kodem (pakiet / promocja). */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await params;
  const body = await readJson(req);
  const token = bodyToken(body);

  if (!isUuid(id) || !verifyToken(id, token)) {
    return apiError(403, "Brak dostępu do tego pisma.");
  }
  const doc = getDocument(id);
  if (!doc) return apiError(404, "Nie znaleziono pisma.");

  const { code: rawCode, consent } = body as { code?: unknown; consent?: unknown };

  // limit także dla opłaconych pism – inaczej odpowiedź z `remaining` pozwalałaby sprawdzać kody bez limitu
  const retryAfter = rateLimit(`redeem:${clientIp(req)}`, REDEEM_LIMIT_PER_HOUR);
  if (retryAfter > 0) {
    return tooManyRequests(retryAfter, "Zbyt wiele prób wpisania kodu. Spróbuj ponownie później.");
  }

  // pismo już opłacone – nie zużywamy kodu
  if (doc.status === "paid") {
    const existing = typeof rawCode === "string" ? getCode(rawCode) : null;
    return json<RedeemResponse>({ status: "paid", remaining: existing?.usesLeft ?? 0 });
  }

  // Art. 38 ust. 1 pkt 13 ustawy o prawach konsumenta – jak przy płatności
  if (consent !== true) {
    return apiError(400, "Aby kontynuować, zaznacz zgodę na natychmiastowe dostarczenie pisma.");
  }

  if (!normalizeCode(rawCode)) {
    return apiError(400, "Nieprawidłowy kod. Sprawdź, czy został wpisany poprawnie (np. PG-ABCDE-FGHJK).", {
      code: "Nieprawidłowy kod.",
    });
  }

  // zgoda zapisywana przed dostarczeniem treści (jak w checkout)
  recordConsent(id);
  const result = redeemCode(rawCode as string, id);
  if (!result.ok) {
    if (result.reason === "exhausted") {
      return apiError(400, "Ten kod został już wykorzystany – nie ma na nim wolnych użyć.", {
        code: "Kod został wykorzystany.",
      });
    }
    if (result.reason === "document-not-found") return apiError(404, "Nie znaleziono pisma.");
    return apiError(400, "Nieprawidłowy kod. Sprawdź, czy został wpisany poprawnie.", { code: "Nieprawidłowy kod." });
  }

  return json<RedeemResponse>({ status: "paid", remaining: result.remaining });
}
