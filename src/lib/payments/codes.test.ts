import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { closeDb, createDocument, getDb, getDocument } from "@/lib/db";
import type { LetterDocument } from "@/lib/templates/types";
import {
  CODE_ALPHABET,
  createCode,
  createPackageCodeForSession,
  generateCode,
  getCode,
  getCodeByStripeSession,
  normalizeCode,
  redeemCode,
} from "./codes";

const letter: LetterDocument = {
  sender: { name: "Jan Kowalski", addressLines: ["ul. Prosta 1", "00-001 Warszawa"] },
  recipient: { name: "Sklep", addressLines: ["ul. Krzywa 2"] },
  place: "Warszawa",
  date: "14 października 2026 r.",
  title: "REKLAMACJA",
  paragraphs: [{ type: "p", text: "Treść." }],
  closing: "Z poważaniem",
  signatureName: "Jan Kowalski",
  attachments: [],
  previewParagraphCount: 1,
};

function newDocument(): string {
  return createDocument({ slug: "reklamacja-towaru", answers: {}, document: letter, aiUsed: false }).doc.id;
}

const previousPath = process.env.DATABASE_PATH;

beforeAll(() => {
  closeDb();
  process.env.DATABASE_PATH = ":memory:";
});

beforeEach(() => {
  getDb().exec("DELETE FROM codes; DELETE FROM documents;");
});

afterAll(() => {
  closeDb();
  process.env.DATABASE_PATH = previousPath;
});

describe("format kodu", () => {
  it("generuje PG-XXXXX-XXXXX z bezpiecznego alfabetu", () => {
    for (let i = 0; i < 200; i++) {
      const code = generateCode();
      expect(code).toMatch(/^PG-[2-9A-HJKMNP-Z]{5}-[2-9A-HJKMNP-Z]{5}$/);
    }
    expect(CODE_ALPHABET).not.toMatch(/[01OIL]/);
  });

  it("normalizuje wpisany kod", () => {
    expect(normalizeCode("pg-abcde-fghjk")).toBe("PG-ABCDE-FGHJK");
    expect(normalizeCode(" PG ABCDE FGHJK ")).toBe("PG-ABCDE-FGHJK");
    expect(normalizeCode("abcdefghjk")).toBe("PG-ABCDE-FGHJK");
    expect(normalizeCode("ABCDE-FGHJK")).toBe("PG-ABCDE-FGHJK");
    expect(normalizeCode("PGABCDEFGHJK")).toBe("PG-ABCDE-FGHJK");
    // 10 znaków zaczynających się od PG to treść kodu, nie prefiks
    expect(normalizeCode("PGBCDEFGHJ")).toBe("PG-PGBCD-EFGHJ");
  });

  it("odrzuca błędne kody", () => {
    expect(normalizeCode("PG-ABCDE-FGHJ0")).toBeNull(); // 0 spoza alfabetu
    expect(normalizeCode("PG-ABCDE-FGHI")).toBeNull();
    expect(normalizeCode("")).toBeNull();
    expect(normalizeCode(123)).toBeNull();
    expect(normalizeCode("x".repeat(100))).toBeNull();
  });
});

describe("createCode / getCode", () => {
  it("tworzy kod z licznikiem użyć", () => {
    const created = createCode("promo", 3, { email: "a@b.pl" });
    const stored = getCode(created.code.toLowerCase());
    expect(stored).toMatchObject({ kind: "promo", usesTotal: 3, usesLeft: 3, email: "a@b.pl" });
  });

  it("waliduje liczbę użyć", () => {
    expect(() => createCode("promo", 0)).toThrow();
    expect(() => createCode("promo", 1.5)).toThrow();
  });

  it("kod pakietu jest idempotentny względem sesji płatności", () => {
    const first = createPackageCodeForSession("cs_test_123", 5, null);
    const second = createPackageCodeForSession("cs_test_123", 5, null);
    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
    expect(second.code.code).toBe(first.code.code);
    expect(getCodeByStripeSession("cs_test_123")?.code).toBe(first.code.code);
    expect((getDb().prepare("SELECT COUNT(*) AS n FROM codes").get() as { n: number }).n).toBe(1);
  });
});

describe("redeemCode", () => {
  it("odblokowuje pisma do wyczerpania kodu", () => {
    const { code } = createCode("promo", 2);
    const [a, b, c] = [newDocument(), newDocument(), newDocument()];

    expect(redeemCode(code, a)).toEqual({ ok: true, remaining: 1, alreadyPaid: false });
    expect(getDocument(a)).toMatchObject({ status: "paid", paidVia: `code:${code}` });

    // wpisany małymi literami i bez myślników
    expect(redeemCode(code.replace(/-/g, "").toLowerCase(), b)).toEqual({ ok: true, remaining: 0, alreadyPaid: false });
    expect(redeemCode(code, c)).toEqual({ ok: false, reason: "exhausted" });
    expect(getDocument(c)?.status).toBe("preview");
    expect(getCode(code)?.usesLeft).toBe(0);
  });

  it("nie zużywa kodu dla pisma już opłaconego", () => {
    const { code } = createCode("promo", 2);
    const a = newDocument();
    redeemCode(code, a);
    expect(redeemCode(code, a)).toEqual({ ok: true, remaining: 1, alreadyPaid: true });
    expect(getCode(code)?.usesLeft).toBe(1);
  });

  it("zwraca błąd dla nieistniejącego kodu lub pisma bez zmian w bazie", () => {
    const { code } = createCode("promo", 1);
    expect(redeemCode("PG-ABCDE-FGHJK", newDocument())).toEqual({ ok: false, reason: "invalid-code" });
    expect(redeemCode("zły kod", newDocument())).toEqual({ ok: false, reason: "invalid-code" });
    expect(redeemCode(code, "00000000-0000-4000-8000-000000000000")).toEqual({
      ok: false,
      reason: "document-not-found",
    });
    expect(getCode(code)?.usesLeft).toBe(1);
  });

  it("jest atomowe: błąd w trakcie transakcji wycofuje zużycie kodu", () => {
    const { code } = createCode("promo", 1);
    const a = newDocument();
    // wyzwalacz symulujący awarię zapisu pisma po zmniejszeniu licznika
    getDb().exec(`
      CREATE TEMP TRIGGER fail_paid BEFORE UPDATE OF status ON documents
      BEGIN SELECT RAISE(ABORT, 'awaria testowa'); END;
    `);
    try {
      expect(() => redeemCode(code, a)).toThrow(/awaria testowa/);
    } finally {
      getDb().exec("DROP TRIGGER fail_paid");
    }
    expect(getCode(code)?.usesLeft).toBe(1);
    expect(getDocument(a)?.status).toBe("preview");
  });

  it("przy wielu próbach kod z N użyciami odblokowuje dokładnie N pism", () => {
    const { code } = createCode("package", 5);
    const docs = Array.from({ length: 12 }, newDocument);
    const results = docs.map((id) => redeemCode(code, id));
    expect(results.filter((r) => r.ok)).toHaveLength(5);
    expect(results.filter((r) => !r.ok && r.reason === "exhausted")).toHaveLength(7);
    const paid = getDb().prepare("SELECT COUNT(*) AS n FROM documents WHERE status = 'paid'").get() as { n: number };
    expect(paid.n).toBe(5);
  });
});
