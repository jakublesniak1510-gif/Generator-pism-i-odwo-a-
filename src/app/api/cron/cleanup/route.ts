import crypto from "node:crypto";
import type { CleanupResponse } from "@/lib/api-types";
import { deleteDocumentsCreatedBefore } from "@/lib/db";
import { apiError, json } from "../../_lib/http";

export const runtime = "nodejs";

const DEFAULT_RETENTION_DAYS = 90;
const DAY_MS = 24 * 60 * 60 * 1000;

function retentionDays(): number {
  const n = Number(process.env.DOCUMENT_RETENTION_DAYS);
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : DEFAULT_RETENTION_DAYS;
}

function safeEqual(a: string, b: string): boolean {
  const ha = crypto.createHash("sha256").update(a).digest();
  const hb = crypto.createHash("sha256").update(b).digest();
  return crypto.timingSafeEqual(ha, hb);
}

/** Retencja (RODO): usuwa pisma starsze niż DOCUMENT_RETENTION_DAYS. Wywoływane przez cron (Vercel). */
async function handle(req: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET;
  if (!secret) return apiError(503, "Czyszczenie nie jest skonfigurowane (brak CRON_SECRET).");

  const header = req.headers.get("authorization") ?? "";
  if (!header.startsWith("Bearer ") || !safeEqual(header.slice("Bearer ".length), secret)) {
    return apiError(401, "Brak autoryzacji.");
  }

  const cutoff = new Date(Date.now() - retentionDays() * DAY_MS);
  const deleted = deleteDocumentsCreatedBefore(cutoff);
  console.info(`[cron/cleanup] usunięto ${deleted} pism utworzonych przed ${cutoff.toISOString()}`);
  return json<CleanupResponse>({ deleted });
}

export const POST = handle;
// Vercel Cron wywołuje endpointy metodą GET
export const GET = handle;
