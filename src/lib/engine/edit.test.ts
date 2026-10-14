import { describe, expect, it } from "vitest";
import { EDIT_LIMITS, validateEditedContent } from "./edit";

describe("validateEditedContent", () => {
  it("akceptuje i normalizuje akapity", () => {
    const res = validateEditedContent(
      [
        { type: "heading", text: " Uzasadnienie\n" },
        { type: "p", text: "Linia 1\r\nLinia 2\u0007", extra: "x" },
        { type: "p", text: "   " },
        { type: "list", items: ["a", " ", "b"] },
      ],
      ["Kopia paragonu", ""],
    );
    expect(res).toEqual({
      ok: true,
      paragraphs: [
        { type: "heading", text: "Uzasadnienie" },
        { type: "p", text: "Linia 1\nLinia 2" },
        { type: "list", items: ["a", "b"] },
      ],
      attachments: ["Kopia paragonu"],
    });
  });

  it("bez załączników nie zwraca pola attachments", () => {
    const res = validateEditedContent([{ type: "p", text: "A" }], undefined);
    expect(res).toEqual({ ok: true, paragraphs: [{ type: "p", text: "A" }] });
  });

  it.each([
    ["nie tablica", "x", undefined],
    ["pusta lista", [], undefined],
    ["zły typ", [{ type: "img", text: "a" }], undefined],
    ["za długi akapit", [{ type: "p", text: "a".repeat(EDIT_LIMITS.maxParagraphChars + 1) }], undefined],
    ["za dużo akapitów", Array.from({ length: EDIT_LIMITS.maxParagraphs + 1 }, () => ({ type: "p", text: "a" })), undefined],
    ["lista z liczbą", [{ type: "list", items: [1] }], undefined],
    ["za dużo załączników", [{ type: "p", text: "a" }], Array.from({ length: 21 }, () => "z")],
    ["za długi załącznik", [{ type: "p", text: "a" }], ["z".repeat(301)]],
    ["załączniki nie tekstowe", [{ type: "p", text: "a" }], [{}]],
  ])("odrzuca: %s", (_name, paragraphs, attachments) => {
    expect(validateEditedContent(paragraphs, attachments).ok).toBe(false);
  });
});
