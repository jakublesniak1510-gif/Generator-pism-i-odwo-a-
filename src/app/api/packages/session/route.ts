import type { PackageSessionResponse } from "@/lib/api-types";
import { getCodeByStripeSession } from "@/lib/payments/codes";
import { apiError, json } from "../../_lib/http";

export const runtime = "nodejs";

/** Identyfikator sesji Stripe (`cs_…`) albo sesji dev (`dev-<uuid>`). */
const SESSION_RE = /^(cs_(test|live)_[A-Za-z0-9]{10,200}|dev-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/;

/**
 * Kod pakietu dla sesji płatności. Identyfikator sesji z adresu strony sukcesu pełni rolę
 * sekretu – kod zwracamy wyłącznie dla sesji, która go wygenerowała.
 */
export async function GET(req: Request): Promise<Response> {
  const session = new URL(req.url).searchParams.get("session") ?? "";
  if (!SESSION_RE.test(session)) return apiError(400, "Nieprawidłowy identyfikator sesji płatności.");

  const code = getCodeByStripeSession(session);
  if (!code) return json<PackageSessionResponse>({ ready: false });
  return json<PackageSessionResponse>({ ready: true, code: code.code, uses: code.usesLeft });
}
