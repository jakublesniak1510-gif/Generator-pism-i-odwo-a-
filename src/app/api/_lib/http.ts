import type { ApiError } from "@/lib/api-types";

export const NO_STORE = { "Cache-Control": "no-store" } as const;

export function json<T>(body: T, status = 200, headers: Record<string, string> = {}): Response {
  return Response.json(body, { status, headers: { ...NO_STORE, ...headers } });
}

export function apiError(status: number, error: string, fieldErrors?: Record<string, string>, headers?: Record<string, string>): Response {
  const body: ApiError = fieldErrors ? { error, fieldErrors } : { error };
  return json(body, status, headers);
}

export async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    return undefined;
  }
}

export function isUuid(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

export function clientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return req.headers.get("x-real-ip")?.trim() || "unknown";
}

/* ---------- prosty rate limit w pamięci procesu (okno przesuwne) ---------- */

const RATE_LIMIT = 20;
const RATE_WINDOW_MS = 60 * 60 * 1000;

const globalForRate = globalThis as unknown as { __pismaRateLimit?: Map<string, number[]> };
const hits: Map<string, number[]> = (globalForRate.__pismaRateLimit ??= new Map());

/**
 * Rejestruje żądanie. Zwraca liczbę sekund do odblokowania albo 0, gdy limit nie został przekroczony.
 * `limit` – maksymalna liczba żądań na godzinę dla danego klucza (domyślnie 20).
 */
export function rateLimit(key: string, limit: number = RATE_LIMIT, now = Date.now()): number {
  const from = now - RATE_WINDOW_MS;
  const list = (hits.get(key) ?? []).filter((t) => t > from);
  if (list.length >= limit) {
    hits.set(key, list);
    return Math.max(1, Math.ceil((list[0] + RATE_WINDOW_MS - now) / 1000));
  }
  list.push(now);
  hits.set(key, list);
  // sprzątanie, żeby mapa nie rosła bez końca
  if (hits.size > 10_000) {
    for (const [k, v] of hits) if (!v.some((t) => t > from)) hits.delete(k);
  }
  return 0;
}

/** Odpowiedź 429 z nagłówkiem Retry-After. */
export function tooManyRequests(retryAfter: number, message = "Zbyt wiele prób w krótkim czasie. Spróbuj ponownie później."): Response {
  return apiError(429, message, undefined, { "Retry-After": String(retryAfter) });
}

/** Odczytuje `token` z body JSON (lub null). */
export function bodyToken(body: unknown): string | null {
  return typeof body === "object" && body !== null && typeof (body as { token?: unknown }).token === "string"
    ? (body as { token: string }).token
    : null;
}
