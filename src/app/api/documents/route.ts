import { draftWithAi } from "@/lib/ai/draft";
import { createDocument } from "@/lib/db";
import { validateAnswers } from "@/lib/engine/validate";
import { getTemplate } from "@/lib/templates";
import type { AiDraft, LetterDocument } from "@/lib/templates/types";
import { buildCreateResponse } from "../_lib/document-response";
import { apiError, clientIp, json, rateLimit, readJson } from "../_lib/http";

export const runtime = "nodejs";

export async function POST(req: Request): Promise<Response> {
  const body = await readJson(req);
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return apiError(400, "Nieprawidłowe dane żądania.");
  }
  const { slug, answers: rawAnswers } = body as { slug?: unknown; answers?: unknown };
  if (typeof slug !== "string" || !slug) return apiError(400, "Brak rodzaju pisma (slug).");

  const template = getTemplate(slug);
  if (!template) return apiError(404, "Nie znaleziono takiego rodzaju pisma.");

  const validation = validateAnswers(template, rawAnswers ?? {});
  if (!validation.ok) {
    return apiError(400, "Formularz zawiera błędy. Popraw zaznaczone pola.", validation.fieldErrors);
  }

  // limit liczymy dla żądań, które faktycznie tworzą pismo (i mogą wywołać AI)
  const retryAfter = rateLimit(`create:${clientIp(req)}`);
  if (retryAfter > 0) {
    return apiError(429, "Zbyt wiele pism w krótkim czasie. Spróbuj ponownie później.", undefined, {
      "Retry-After": String(retryAfter),
    });
  }

  const answers = validation.answers;

  let draft: AiDraft | null = null;
  try {
    draft = await draftWithAi(template, answers);
  } catch (err) {
    console.error("[api/documents] błąd AI – składamy pismo bez AI", err);
    draft = null;
  }

  let letter: LetterDocument;
  try {
    letter = template.render({ answers, ai: draft ?? undefined, today: new Date() });
  } catch (err) {
    if (!draft) {
      console.error("[api/documents] błąd renderowania szablonu", slug, err);
      return apiError(500, "Nie udało się przygotować pisma. Spróbuj ponownie.");
    }
    // awaryjnie: wersja czysto szablonowa
    console.error("[api/documents] błąd renderowania z AI – próba bez AI", slug, err);
    try {
      draft = null;
      letter = template.render({ answers, today: new Date() });
    } catch (err2) {
      console.error("[api/documents] błąd renderowania szablonu", slug, err2);
      return apiError(500, "Nie udało się przygotować pisma. Spróbuj ponownie.");
    }
  }

  const { doc, token } = createDocument({ slug, answers, document: letter, aiUsed: draft !== null });
  return json(buildCreateResponse(doc, template, token), 201);
}
