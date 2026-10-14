import type { PackageCheckoutResponse } from "@/lib/api-types";
import { isValidEmail } from "@/lib/email";
import { createPackageCheckoutUrl } from "@/lib/payments/stripe";
import { apiError, clientIp, json, rateLimit, readJson, tooManyRequests } from "../../_lib/http";

export const runtime = "nodejs";

/** POST { consent: true, email?: string } → { url } – zakup pakietu 5 pism. */
export async function POST(req: Request): Promise<Response> {
  const body = await readJson(req);
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return apiError(400, "Nieprawidłowe dane żądania.");
  }
  const { consent, email: rawEmail } = body as { consent?: unknown; email?: unknown };

  // zgoda na natychmiastowe dostarczenie treści cyfrowej (art. 38 ust. 1 pkt 13 u.p.k.)
  if (consent !== true) {
    return apiError(400, "Aby kontynuować, zaznacz zgodę na natychmiastowe dostarczenie treści cyfrowej.");
  }

  let email: string | null = null;
  if (rawEmail !== undefined && rawEmail !== null && rawEmail !== "") {
    const trimmed = typeof rawEmail === "string" ? rawEmail.trim() : rawEmail;
    if (!isValidEmail(trimmed)) {
      return apiError(400, "Podaj poprawny adres e-mail.", { email: "Podaj poprawny adres e-mail." });
    }
    email = trimmed;
  }

  const retryAfter = rateLimit(`package-checkout:${clientIp(req)}`);
  if (retryAfter > 0) return tooManyRequests(retryAfter);

  try {
    const url = await createPackageCheckoutUrl({ email });
    return json<PackageCheckoutResponse>({ url });
  } catch (err) {
    console.error("[api/packages/checkout] nie udało się utworzyć płatności", err);
    return apiError(502, "Nie udało się rozpocząć płatności. Spróbuj ponownie za chwilę.");
  }
}
