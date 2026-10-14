import { describe, expect, it } from "vitest";
import type { LetterDocument } from "@/lib/templates/types";
import { toPreview } from "./preview";

function doc(paragraphCount: number, preview: number): LetterDocument {
  return {
    sender: { name: "A", addressLines: ["ul. A 1"] },
    recipient: { name: "B", addressLines: ["ul. B 2"] },
    place: "Warszawa",
    date: "14 października 2026 r.",
    title: "PISMO",
    paragraphs: Array.from({ length: paragraphCount }, (_, i) => ({ type: "p" as const, text: `Akapit ${i + 1}` })),
    closing: "Z poważaniem",
    signatureName: "A",
    attachments: ["Kopia paragonu"],
    previewParagraphCount: preview,
  };
}

describe("toPreview", () => {
  it("ucina do previewParagraphCount i liczy zablokowane akapity", () => {
    const res = toPreview(doc(6, 2));
    expect(res.document.paragraphs).toHaveLength(2);
    expect(res.lockedParagraphs).toBe(4);
    expect(res.document.title).toBe("PISMO");
  });

  it("nie modyfikuje oryginału", () => {
    const original = doc(5, 1);
    const res = toPreview(original);
    res.document.attachments.push("x");
    expect(original.paragraphs).toHaveLength(5);
    expect(original.attachments).toEqual(["Kopia paragonu"]);
  });

  it("obsługuje wartości brzegowe", () => {
    expect(toPreview(doc(3, 10)).lockedParagraphs).toBe(0);
    expect(toPreview(doc(3, -1)).document.paragraphs).toHaveLength(0);
    expect(toPreview(doc(3, 1.7)).document.paragraphs).toHaveLength(1);
  });
});
