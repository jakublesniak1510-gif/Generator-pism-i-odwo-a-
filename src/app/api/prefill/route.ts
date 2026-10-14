import type { PrefillResponse } from "@/lib/api-types";
import { detectMediaType, PREFILL_LIMITS, prefillFromDocument, type PrefillInput } from "@/lib/ai/prefill";
import { getTemplate } from "@/lib/templates";
import { apiError, clientIp, json, rateLimit, tooManyRequests } from "../_lib/http";

export const runtime = "nodejs";

const PREFILL_LIMIT_PER_HOUR = 10;
/** zapas na pola tekstowe i narzut multipart */
const MAX_BODY_BYTES = PREFILL_LIMITS.maxFileBytes + 256 * 1024;

/**
 * POST multipart/form-data: `slug`, `text?`, `file?` → PrefillResponse.
 * Plik jest przetwarzany wyłącznie w pamięci – nie zapisujemy go i nie logujemy jego treści.
 */
export async function POST(req: Request): Promise<Response> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return apiError(503, "Wypełnianie formularza z dokumentu jest obecnie niedostępne.");
  }

  const declaredLength = Number(req.headers.get("content-length") ?? "0");
  if (declaredLength > MAX_BODY_BYTES) {
    return apiError(400, "Plik jest za duży (maksymalnie 8 MB).");
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return apiError(400, "Nieprawidłowe dane formularza (oczekiwano multipart/form-data).");
  }

  const slug = form.get("slug");
  if (typeof slug !== "string" || !slug) return apiError(400, "Brak rodzaju pisma (slug).");
  const template = getTemplate(slug);
  if (!template) return apiError(404, "Nie znaleziono takiego rodzaju pisma.");

  const input: PrefillInput = {};

  const text = form.get("text");
  if (text !== null && typeof text !== "string") return apiError(400, "Pole „text” musi być tekstem.");
  if (typeof text === "string" && text.trim()) {
    if (text.length > PREFILL_LIMITS.maxTextChars) {
      return apiError(400, "Wklejony tekst jest za długi (maksymalnie 20 000 znaków).");
    }
    input.text = text.trim();
  }

  const file = form.get("file");
  if (file !== null && typeof file !== "string" && file.size > 0) {
    if (file.size > PREFILL_LIMITS.maxFileBytes) {
      return apiError(400, "Plik jest za duży (maksymalnie 8 MB).");
    }
    const data = Buffer.from(await file.arrayBuffer());
    const mediaType = detectMediaType(data);
    if (!mediaType) {
      return apiError(400, "Nieobsługiwany format pliku. Prześlij zdjęcie (JPG, PNG, WebP) albo PDF.");
    }
    if (mediaType !== "application/pdf" && data.byteLength > PREFILL_LIMITS.maxImageBytes) {
      return apiError(400, "Zdjęcie jest za duże (maksymalnie 7,5 MB). Zmniejsz je i spróbuj ponownie.");
    }
    input.file = { data, mediaType };
  } else if (typeof file === "string" && file) {
    return apiError(400, "Pole „file” musi być plikiem.");
  }

  if (!input.file && !input.text) {
    return apiError(400, "Dodaj zdjęcie lub PDF dokumentu albo wklej jego treść.");
  }

  // limit liczymy dla żądań, które faktycznie wywołają model
  const retryAfter = rateLimit(`prefill:${clientIp(req)}`, PREFILL_LIMIT_PER_HOUR);
  if (retryAfter > 0) {
    return tooManyRequests(retryAfter, "Zbyt wiele prób odczytu dokumentów. Spróbuj ponownie później.");
  }

  const outcome = await prefillFromDocument(template, input);
  if (!outcome.ok) {
    if (outcome.reason === "not-configured") {
      return apiError(503, "Wypełnianie formularza z dokumentu jest obecnie niedostępne.");
    }
    if (outcome.reason === "bad-document") {
      return apiError(400, "Nie udało się odczytać dokumentu. Sprawdź, czy plik nie jest uszkodzony ani zabezpieczony hasłem.");
    }
    return apiError(502, "Nie udało się odczytać dokumentu. Spróbuj ponownie za chwilę albo wypełnij formularz ręcznie.");
  }
  return json<PrefillResponse>(outcome.result);
}
