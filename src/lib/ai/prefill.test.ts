import { afterEach, describe, expect, it } from "vitest";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { makeTestTemplate } from "@/lib/engine/test-template";
import { getAllTemplates } from "@/lib/templates";
import { buildPrefillSchema, detectMediaType, prefillableQuestions, prefillFromDocument, sanitizePrefill } from "./prefill";

const template = makeTestTemplate();

describe("detectMediaType", () => {
  it("rozpoznaje pliki po sygnaturze", () => {
    expect(detectMediaType(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0]))).toBe("image/jpeg");
    expect(detectMediaType(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]))).toBe("image/png");
    expect(detectMediaType(Buffer.from("RIFF\x00\x00\x00\x00WEBPVP8 ", "latin1"))).toBe("image/webp");
    expect(detectMediaType(Buffer.from("%PDF-1.7\n"))).toBe("application/pdf");
  });
  it("odrzuca inne pliki", () => {
    expect(detectMediaType(Buffer.from("<html>"))).toBeNull();
    expect(detectMediaType(Buffer.from("GIF89a"))).toBeNull();
    expect(detectMediaType(Buffer.alloc(0))).toBeNull();
  });
});

describe("buildPrefillSchema", () => {
  it("pomija wymagane oświadczenia i pola *_description", () => {
    const t = makeTestTemplate({
      sections: [
        {
          id: "s",
          title: "s",
          questions: [
            { id: "facts_description", label: "Opis", type: "textarea" },
            { id: "statement", label: "Oświadczenie", type: "checkbox", required: true },
            { id: "name", label: "Imię", type: "text" },
          ],
        },
      ],
    });
    expect(prefillableQuestions(t).map((q) => q.id)).toEqual(["name"]);
  });

  it.each(getAllTemplates().map((t) => [t.slug, t] as const))(
    "%s: schemat mieści się w limitach structured outputs (bez pól opcjonalnych i unii)",
    (_slug, t) => {
      const format = zodOutputFormat(buildPrefillSchema(t));
      const schema = format.schema as { properties: Record<string, Record<string, unknown>>; required?: string[] };
      const keys = Object.keys(schema.properties);
      expect(keys.length).toBeGreaterThan(0);
      expect([...(schema.required ?? [])].sort()).toEqual([...keys].sort());
      for (const prop of Object.values(schema.properties)) {
        expect(prop.anyOf).toBeUndefined();
        expect(Array.isArray(prop.type)).toBe(false);
        expect(typeof prop.description).toBe("string");
      }
    },
  );
});

describe("sanitizePrefill", () => {
  it("zostawia tylko poprawne, niepuste wartości", () => {
    const res = sanitizePrefill(template, {
      name: "  Jan   Kowalski ",
      postal: "00001", // niezgodny ze wzorcem
      note: "x".repeat(50), // obcięte do maxLength 20
      purchase_date: "2026-02-30",
      price: "1 234,50 zł",
      count: "11", // poza zakresem
      kind: "service",
      goods_name: "",
      has_receipt: "tak",
      email: "zly-email",
      phone: "+48 600 700 800",
      statement: "tak", // pominięte – oświadczenie wypełnia użytkownik
      unknown_field: "x",
    });
    expect(res.answers).toEqual({
      name: "Jan Kowalski",
      note: "x".repeat(20),
      price: 1234.5,
      kind: "service",
      has_receipt: true,
      phone: "+48 600 700 800",
    });
    expect(res.filledQuestionIds.sort()).toEqual(Object.keys(res.answers).sort());
  });

  it("odrzuca wartości spoza listy opcji i poprawia datę", () => {
    const res = sanitizePrefill(template, { kind: "inne", purchase_date: " 2026-03-15 ", has_receipt: "nie" });
    expect(res.answers).toEqual({ purchase_date: "2026-03-15", has_receipt: false });
  });
});

describe("prefillFromDocument", () => {
  const key = process.env.ANTHROPIC_API_KEY;
  afterEach(() => {
    if (key === undefined) delete process.env.ANTHROPIC_API_KEY;
    else process.env.ANTHROPIC_API_KEY = key;
  });

  it("bez klucza API zwraca not-configured (bez wywołania sieci)", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    expect(await prefillFromDocument(template, { text: "Wezwanie do zapłaty" })).toEqual({
      ok: false,
      reason: "not-configured",
    });
  });
});
