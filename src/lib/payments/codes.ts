import crypto from "node:crypto";
import { getDb } from "@/lib/db";

/**
 * Kody odblokowujące pisma (pakiet 5 pism, kody promocyjne i partnerskie).
 * Format: `PG-XXXXX-XXXXX` – 10 znaków z alfabetu bez mylących znaków (0/O, 1/I/L).
 */

export type CodeKind = "package" | "promo";

export interface StoredCode {
  code: string;
  kind: CodeKind;
  usesTotal: number;
  usesLeft: number;
  createdAt: string;
  stripeSessionId: string | null;
  email: string | null;
}

interface CodeRow {
  code: string;
  kind: string;
  uses_total: number;
  uses_left: number;
  created_at: string;
  stripe_session_id: string | null;
  email: string | null;
}

export const CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
const CODE_BODY_LENGTH = 10;
const CODE_PREFIX = "PG";

function rowToCode(row: CodeRow): StoredCode {
  return {
    code: row.code,
    kind: row.kind === "package" ? "package" : "promo",
    usesTotal: row.uses_total,
    usesLeft: row.uses_left,
    createdAt: row.created_at,
    stripeSessionId: row.stripe_session_id,
    email: row.email,
  };
}

function formatCode(body: string): string {
  return `${CODE_PREFIX}-${body.slice(0, 5)}-${body.slice(5)}`;
}

/** Losowy kod w formacie `PG-XXXXX-XXXXX` (crypto.randomInt – bez obciążenia rozkładu). */
export function generateCode(): string {
  let body = "";
  for (let i = 0; i < CODE_BODY_LENGTH; i++) body += CODE_ALPHABET[crypto.randomInt(CODE_ALPHABET.length)];
  return formatCode(body);
}

/**
 * Normalizuje kod wpisany przez użytkownika: wielkie litery, bez spacji i myślników,
 * z prefiksem `PG` lub bez. Zwraca postać kanoniczną albo null, gdy format jest błędny.
 */
export function normalizeCode(input: unknown): string | null {
  if (typeof input !== "string" || input.length > 64) return null;
  let raw = input.toUpperCase().replace(/[\s\-–—_]/g, "");
  if (raw.length === CODE_BODY_LENGTH + CODE_PREFIX.length && raw.startsWith(CODE_PREFIX)) {
    raw = raw.slice(CODE_PREFIX.length);
  }
  if (raw.length !== CODE_BODY_LENGTH) return null;
  for (const ch of raw) if (!CODE_ALPHABET.includes(ch)) return null;
  return formatCode(raw);
}

export function getCode(code: string): StoredCode | null {
  const normalized = normalizeCode(code);
  if (!normalized) return null;
  const row = getDb().prepare("SELECT * FROM codes WHERE code = ?").get(normalized) as CodeRow | undefined;
  return row ? rowToCode(row) : null;
}

export function getCodeByStripeSession(sessionId: string): StoredCode | null {
  const row = getDb().prepare("SELECT * FROM codes WHERE stripe_session_id = ?").get(sessionId) as CodeRow | undefined;
  return row ? rowToCode(row) : null;
}

/** Tworzy nowy kod. `uses` – liczba pism, które można nim odblokować (1–1000). */
export function createCode(
  kind: CodeKind,
  uses: number,
  extra: { stripeSessionId?: string | null; email?: string | null } = {},
): StoredCode {
  if (!Number.isInteger(uses) || uses < 1 || uses > 1000) {
    throw new Error("Liczba użyć kodu musi być liczbą całkowitą z zakresu 1–1000.");
  }
  const db = getDb();
  const insert = db.prepare(
    `INSERT INTO codes (code, kind, uses_total, uses_left, created_at, stripe_session_id, email)
     VALUES (@code, @kind, @uses, @uses, @created_at, @stripe_session_id, @email)`,
  );
  // kolizja przy 31^10 kombinacji jest praktycznie niemożliwa, ale nie zakładamy tego
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateCode();
    const createdAt = new Date().toISOString();
    try {
      insert.run({
        code,
        kind,
        uses,
        created_at: createdAt,
        stripe_session_id: extra.stripeSessionId ?? null,
        email: extra.email ?? null,
      });
      return {
        code,
        kind,
        usesTotal: uses,
        usesLeft: uses,
        createdAt,
        stripeSessionId: extra.stripeSessionId ?? null,
        email: extra.email ?? null,
      };
    } catch (err) {
      const sqliteCode = (err as { code?: string }).code;
      if (sqliteCode === "SQLITE_CONSTRAINT_PRIMARYKEY") continue;
      throw err;
    }
  }
  throw new Error("Nie udało się wygenerować unikalnego kodu.");
}

/**
 * Kod pakietu dla sesji płatności – idempotentnie (ponowny webhook nie tworzy drugiego kodu).
 * `created` = true tylko przy pierwszym wywołaniu dla danej sesji.
 */
export function createPackageCodeForSession(
  sessionId: string,
  uses: number,
  email: string | null,
): { code: StoredCode; created: boolean } {
  const db = getDb();
  const tx = db.transaction(() => {
    const existing = getCodeByStripeSession(sessionId);
    if (existing) return { code: existing, created: false };
    return { code: createCode("package", uses, { stripeSessionId: sessionId, email }), created: true };
  });
  return tx.immediate();
}

export type RedeemResult =
  | { ok: true; remaining: number; alreadyPaid: boolean }
  | { ok: false; reason: "invalid-code" | "exhausted" | "document-not-found" };

/**
 * Odblokowuje pismo kodem – atomowo: sprawdza `uses_left > 0`, zmniejsza licznik,
 * oznacza pismo jako opłacone (`paid_via = code:<kod>`). Gdy pismo jest już opłacone,
 * kod nie jest zużywany.
 */
export function redeemCode(codeInput: string, documentId: string): RedeemResult {
  const code = normalizeCode(codeInput);
  if (!code) return { ok: false, reason: "invalid-code" };

  const db = getDb();
  const tx = db.transaction((): RedeemResult => {
    const doc = db.prepare("SELECT status FROM documents WHERE id = ?").get(documentId) as
      | { status: string }
      | undefined;
    if (!doc) return { ok: false, reason: "document-not-found" };

    const row = db.prepare("SELECT * FROM codes WHERE code = ?").get(code) as CodeRow | undefined;
    if (!row) return { ok: false, reason: "invalid-code" };
    if (doc.status === "paid") return { ok: true, remaining: row.uses_left, alreadyPaid: true };

    const dec = db.prepare("UPDATE codes SET uses_left = uses_left - 1 WHERE code = ? AND uses_left > 0").run(code);
    if (dec.changes === 0) return { ok: false, reason: "exhausted" };

    const paid = db
      .prepare("UPDATE documents SET status = 'paid', paid_at = ?, paid_via = ? WHERE id = ? AND status != 'paid'")
      .run(new Date().toISOString(), `code:${code}`, documentId);
    if (paid.changes === 0) {
      // nie powinno się zdarzyć (status sprawdzony w tej samej transakcji) – wycofujemy zużycie
      throw new Error("Nie udało się oznaczyć pisma jako opłaconego.");
    }
    return { ok: true, remaining: row.uses_left - 1, alreadyPaid: false };
  });
  return tx.immediate();
}
