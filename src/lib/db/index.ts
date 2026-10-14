import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import type { DocumentStatus } from "@/lib/api-types";
import type { Answers, LetterDocument } from "@/lib/templates/types";

export interface StoredDocument {
  id: string;
  slug: string;
  answers: Answers;
  document: LetterDocument;
  status: DocumentStatus;
  aiUsed: boolean;
  stripeSessionId: string | null;
  createdAt: string;
  paidAt: string | null;
}

interface DocumentRow {
  id: string;
  slug: string;
  answers_json: string;
  document_json: string;
  status: string;
  ai_used: number;
  token_hash: string;
  stripe_session_id: string | null;
  created_at: string;
  paid_at: string | null;
}

const globalForDb = globalThis as unknown as { __pismaDb?: Database.Database };

function openDatabase(): Database.Database {
  const file = path.resolve(process.cwd(), process.env.DATABASE_PATH || "./data/pisma.db");
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new Database(file);
  db.pragma("journal_mode = WAL");
  db.pragma("busy_timeout = 5000");
  db.exec(`
    CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY,
      slug TEXT NOT NULL,
      answers_json TEXT NOT NULL,
      document_json TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'preview',
      ai_used INTEGER NOT NULL DEFAULT 0,
      token_hash TEXT NOT NULL,
      stripe_session_id TEXT,
      created_at TEXT NOT NULL,
      paid_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_documents_stripe_session ON documents(stripe_session_id);
  `);
  return db;
}

/** Singleton na `globalThis`, żeby hot reload w dev nie otwierał wielu połączeń. */
export function getDb(): Database.Database {
  if (!globalForDb.__pismaDb) globalForDb.__pismaDb = openDatabase();
  return globalForDb.__pismaDb;
}

function tokenSecret(): string {
  const secret = process.env.DOCUMENT_TOKEN_SECRET;
  if (!secret && process.env.NODE_ENV === "production") {
    throw new Error("Brak DOCUMENT_TOKEN_SECRET w środowisku produkcyjnym.");
  }
  return secret || "dev-insecure-secret";
}

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token + tokenSecret()).digest("hex");
}

function rowToDocument(row: DocumentRow): StoredDocument {
  return {
    id: row.id,
    slug: row.slug,
    answers: JSON.parse(row.answers_json) as Answers,
    document: JSON.parse(row.document_json) as LetterDocument,
    status: row.status === "paid" ? "paid" : "preview",
    aiUsed: row.ai_used === 1,
    stripeSessionId: row.stripe_session_id,
    createdAt: row.created_at,
    paidAt: row.paid_at,
  };
}

/** Zapisuje nowe pismo. Zwraca dokument i jednorazowo jawny token dostępu. */
export function createDocument(input: {
  slug: string;
  answers: Answers;
  document: LetterDocument;
  aiUsed: boolean;
}): { doc: StoredDocument; token: string } {
  const id = crypto.randomUUID();
  const token = crypto.randomBytes(32).toString("hex");
  const createdAt = new Date().toISOString();
  getDb()
    .prepare(
      `INSERT INTO documents (id, slug, answers_json, document_json, status, ai_used, token_hash, stripe_session_id, created_at, paid_at)
       VALUES (@id, @slug, @answers_json, @document_json, 'preview', @ai_used, @token_hash, NULL, @created_at, NULL)`,
    )
    .run({
      id,
      slug: input.slug,
      answers_json: JSON.stringify(input.answers),
      document_json: JSON.stringify(input.document),
      ai_used: input.aiUsed ? 1 : 0,
      token_hash: hashToken(token),
      created_at: createdAt,
    });
  return {
    token,
    doc: {
      id,
      slug: input.slug,
      answers: input.answers,
      document: input.document,
      status: "preview",
      aiUsed: input.aiUsed,
      stripeSessionId: null,
      createdAt,
      paidAt: null,
    },
  };
}

export function getDocument(id: string): StoredDocument | null {
  const row = getDb().prepare("SELECT * FROM documents WHERE id = ?").get(id) as DocumentRow | undefined;
  return row ? rowToDocument(row) : null;
}

/** Porównanie tokenu w stałym czasie. */
export function verifyToken(id: string, token: string | null | undefined): boolean {
  if (!token || typeof token !== "string" || !/^[0-9a-f]{64}$/i.test(token)) return false;
  const row = getDb().prepare("SELECT token_hash FROM documents WHERE id = ?").get(id) as
    | { token_hash: string }
    | undefined;
  if (!row) return false;
  const expected = Buffer.from(row.token_hash, "hex");
  const actual = Buffer.from(hashToken(token), "hex");
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

/** Oznacza pismo jako opłacone. Idempotentne – zwraca true tylko przy faktycznej zmianie. */
export function markPaid(id: string): boolean {
  const res = getDb()
    .prepare("UPDATE documents SET status = 'paid', paid_at = ? WHERE id = ? AND status != 'paid'")
    .run(new Date().toISOString(), id);
  return res.changes > 0;
}

export function setStripeSession(id: string, sessionId: string): void {
  getDb().prepare("UPDATE documents SET stripe_session_id = ? WHERE id = ?").run(sessionId, id);
}
