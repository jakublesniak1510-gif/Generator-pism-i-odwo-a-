import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import type { DocumentStatus } from "@/lib/api-types";
import type { Answers, LetterDocument, Paragraph } from "@/lib/templates/types";

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
  /** moment ostatniej edycji akapitów przez użytkownika (PATCH) */
  editedAt: string | null;
  /** 'stripe' | 'dev' | 'code:<kod>' */
  paidVia: string | null;
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
  edited_at: string | null;
  paid_via: string | null;
}

const globalForDb = globalThis as unknown as { __pismaDb?: Database.Database };

/** `DATABASE_PATH=:memory:` – baza w pamięci (testy). */
function openDatabase(): Database.Database {
  const configured = process.env.DATABASE_PATH || "./data/pisma.db";
  let db: Database.Database;
  if (configured === ":memory:") {
    db = new Database(":memory:");
  } else {
    const file = path.resolve(process.cwd(), configured);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    db = new Database(file);
    db.pragma("journal_mode = WAL");
  }
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
      paid_at TEXT,
      consent_at TEXT,
      edited_at TEXT,
      paid_via TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_documents_stripe_session ON documents(stripe_session_id);
    CREATE INDEX IF NOT EXISTS idx_documents_created_at ON documents(created_at);

    CREATE TABLE IF NOT EXISTS codes (
      code TEXT PRIMARY KEY,
      kind TEXT NOT NULL,
      uses_total INTEGER NOT NULL,
      uses_left INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      stripe_session_id TEXT,
      email TEXT
    );
    -- jeden kod na sesję płatności (idempotencja webhooka); SQLite dopuszcza wiele NULL
    CREATE UNIQUE INDEX IF NOT EXISTS idx_codes_stripe_session ON codes(stripe_session_id);
  `);
  // migracje dla baz utworzonych przed dodaniem kolumn
  const cols = db.prepare("PRAGMA table_info(documents)").all() as { name: string }[];
  for (const column of ["consent_at", "edited_at", "paid_via"]) {
    if (!cols.some((c) => c.name === column)) {
      db.exec(`ALTER TABLE documents ADD COLUMN ${column} TEXT`);
    }
  }
  return db;
}

/** Singleton na `globalThis`, żeby hot reload w dev nie otwierał wielu połączeń. */
export function getDb(): Database.Database {
  if (!globalForDb.__pismaDb) globalForDb.__pismaDb = openDatabase();
  return globalForDb.__pismaDb;
}

/** Zamyka połączenie (testy) – kolejne `getDb()` otworzy bazę od nowa wg `DATABASE_PATH`. */
export function closeDb(): void {
  globalForDb.__pismaDb?.close();
  globalForDb.__pismaDb = undefined;
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
    editedAt: row.edited_at ?? null,
    paidVia: row.paid_via ?? null,
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
      editedAt: null,
      paidVia: null,
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

/**
 * Oznacza pismo jako opłacone. Idempotentne – zwraca true tylko przy faktycznej zmianie.
 * `via`: 'stripe' | 'dev' | 'code:<kod>'.
 */
export function markPaid(id: string, via?: string): boolean {
  const res = getDb()
    .prepare("UPDATE documents SET status = 'paid', paid_at = ?, paid_via = ? WHERE id = ? AND status != 'paid'")
    .run(new Date().toISOString(), via ?? null, id);
  return res.changes > 0;
}

/** Zapisuje moment wyrażenia zgody na dostarczenie treści cyfrowej przed upływem terminu odstąpienia. */
export function recordConsent(id: string): void {
  getDb().prepare("UPDATE documents SET consent_at = COALESCE(consent_at, ?) WHERE id = ?").run(new Date().toISOString(), id);
}

export function setStripeSession(id: string, sessionId: string): void {
  getDb().prepare("UPDATE documents SET stripe_session_id = ? WHERE id = ?").run(sessionId, id);
}

/**
 * Podmienia akapity (i opcjonalnie załączniki) pisma po edycji przez użytkownika.
 * Pozostałe pola `LetterDocument` zostają bez zmian. Zwraca zaktualizowany dokument albo null.
 */
export function updateDocumentContent(
  id: string,
  content: { paragraphs: Paragraph[]; attachments?: string[] },
): StoredDocument | null {
  const db = getDb();
  const tx = db.transaction((): StoredDocument | null => {
    const row = db.prepare("SELECT * FROM documents WHERE id = ?").get(id) as DocumentRow | undefined;
    if (!row) return null;
    const current = JSON.parse(row.document_json) as LetterDocument;
    const next: LetterDocument = {
      ...current,
      paragraphs: content.paragraphs,
      attachments: content.attachments ?? current.attachments,
    };
    const editedAt = new Date().toISOString();
    db.prepare("UPDATE documents SET document_json = ?, edited_at = ? WHERE id = ?").run(JSON.stringify(next), editedAt, id);
    return rowToDocument({ ...row, document_json: JSON.stringify(next), edited_at: editedAt });
  });
  return tx.immediate();
}

/** Usuwa pisma utworzone przed `cutoff` (retencja danych). Zwraca liczbę usuniętych. */
export function deleteDocumentsCreatedBefore(cutoff: Date): number {
  return getDb().prepare("DELETE FROM documents WHERE created_at < ?").run(cutoff.toISOString()).changes;
}
