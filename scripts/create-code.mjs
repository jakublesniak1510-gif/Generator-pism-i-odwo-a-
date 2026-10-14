#!/usr/bin/env node
/**
 * Ręczne tworzenie kodów odblokowujących (partnerskie, testowe, promocyjne).
 *
 *   node scripts/create-code.mjs --uses 5 --kind promo [--count 3] [--email jan@example.com]
 *
 * Baza: DATABASE_PATH (ze środowiska lub z pliku .env), domyślnie ./data/pisma.db.
 * Format kodu i alfabet muszą być zgodne z src/lib/payments/codes.ts.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import Database from "better-sqlite3";

const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

function usage(message) {
  if (message) console.error(`Błąd: ${message}\n`);
  console.error("Użycie: node scripts/create-code.mjs --uses <1–1000> [--kind promo|package] [--count <1–100>] [--email <adres>]");
  process.exit(1);
}

let args;
try {
  args = parseArgs({
    options: {
      uses: { type: "string", default: "1" },
      kind: { type: "string", default: "promo" },
      count: { type: "string", default: "1" },
      email: { type: "string" },
      help: { type: "boolean", short: "h" },
    },
  }).values;
} catch (err) {
  usage(err.message);
}
if (args.help) usage();

const uses = Number(args.uses);
const count = Number(args.count);
if (!Number.isInteger(uses) || uses < 1 || uses > 1000) usage("--uses musi być liczbą całkowitą 1–1000.");
if (!Number.isInteger(count) || count < 1 || count > 100) usage("--count musi być liczbą całkowitą 1–100.");
if (args.kind !== "promo" && args.kind !== "package") usage("--kind musi mieć wartość promo albo package.");

if (!process.env.DATABASE_PATH && fs.existsSync(".env")) {
  try {
    process.loadEnvFile(".env");
  } catch {
    // brak obsługi .env – zostaje wartość domyślna
  }
}
const configured = process.env.DATABASE_PATH || "./data/pisma.db";
const file = configured === ":memory:" ? ":memory:" : path.resolve(process.cwd(), configured);
if (file !== ":memory:") fs.mkdirSync(path.dirname(file), { recursive: true });

const db = new Database(file);
db.pragma("busy_timeout = 5000");
db.exec(`
  CREATE TABLE IF NOT EXISTS codes (
    code TEXT PRIMARY KEY,
    kind TEXT NOT NULL,
    uses_total INTEGER NOT NULL,
    uses_left INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    stripe_session_id TEXT,
    email TEXT
  );
  CREATE UNIQUE INDEX IF NOT EXISTS idx_codes_stripe_session ON codes(stripe_session_id);
`);

function generateCode() {
  let body = "";
  for (let i = 0; i < 10; i++) body += ALPHABET[crypto.randomInt(ALPHABET.length)];
  return `PG-${body.slice(0, 5)}-${body.slice(5)}`;
}

const insert = db.prepare(
  "INSERT INTO codes (code, kind, uses_total, uses_left, created_at, stripe_session_id, email) VALUES (?, ?, ?, ?, ?, NULL, ?)",
);
for (let i = 0; i < count; i++) {
  let code;
  for (let attempt = 0; attempt < 5 && !code; attempt++) {
    const candidate = generateCode();
    try {
      insert.run(candidate, args.kind, uses, uses, new Date().toISOString(), args.email ?? null);
      code = candidate;
    } catch (err) {
      if (err.code !== "SQLITE_CONSTRAINT_PRIMARYKEY") throw err;
    }
  }
  if (!code) {
    console.error("Nie udało się wygenerować unikalnego kodu.");
    process.exit(1);
  }
  console.log(code);
}
console.error(`Utworzono ${count} kod(ów): rodzaj ${args.kind}, ${uses} użyć każdy (baza: ${configured}).`);
db.close();
