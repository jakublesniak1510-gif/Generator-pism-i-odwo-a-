import { getDocument, verifyToken } from "@/lib/db";
import { documentLinkEmail, isEmailConfigured, isValidEmail, sendEmail } from "@/lib/email";
import { documentUrl } from "@/lib/payments/stripe";
import { getTemplate } from "@/lib/templates";
import { apiError, bodyToken, clientIp, isUuid, json, rateLimit, readJson, tooManyRequests } from "../../../_lib/http";

export const runtime = "nodejs";

const EMAIL_LIMIT_PER_HOUR = 5;

/**
 * POST { token, email } → 202 – wysyła na podany adres LINK do pisma (nigdy treść pisma).
 * 503 gdy e-mail nie jest skonfigurowany.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await params;
  const body = await readJson(req);
  const token = bodyToken(body);

  if (!isUuid(id) || !verifyToken(id, token)) {
    return apiError(403, "Brak dostępu do tego pisma.");
  }
  const doc = getDocument(id);
  const template = doc ? getTemplate(doc.slug) : undefined;
  if (!doc || !template) return apiError(404, "Nie znaleziono pisma.");

  if (!isEmailConfigured()) {
    return apiError(503, "Wysyłka e-mail jest obecnie niedostępna. Skopiuj link do pisma i zapisz go u siebie.");
  }

  const rawEmail = (body as { email?: unknown }).email;
  const email = typeof rawEmail === "string" ? rawEmail.trim() : rawEmail;
  if (!isValidEmail(email)) {
    return apiError(400, "Podaj poprawny adres e-mail.", { email: "Podaj poprawny adres e-mail." });
  }

  const retryAfter = rateLimit(`email:${clientIp(req)}`, EMAIL_LIMIT_PER_HOUR);
  if (retryAfter > 0) {
    return tooManyRequests(retryAfter, "Zbyt wiele wysyłek w krótkim czasie. Spróbuj ponownie później.");
  }

  const result = await sendEmail(
    documentLinkEmail({ to: email, templateName: template.name, url: documentUrl(id, token as string) }),
  );
  if (!result.sent) {
    if (result.reason === "not-configured") {
      return apiError(503, "Wysyłka e-mail jest obecnie niedostępna.");
    }
    return apiError(502, "Nie udało się wysłać wiadomości. Spróbuj ponownie za chwilę.");
  }
  return json({ sent: true }, 202);
}
