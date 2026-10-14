import { describe, expect, it } from "vitest";
import { generateSampleAnswers } from "@/lib/engine/sample-answers";
import { getAllQuestions, validateAnswers } from "@/lib/engine/validate";
import { getAllTemplates } from "@/lib/templates";
import type { LetterDocument, LetterTemplate } from "@/lib/templates/types";

const TODAY = new Date(2026, 9, 14);
const STUB_DESCRIPTION = "Szablon w przygotowaniu.";

const templates = getAllTemplates();
const isStub = (t: LetterTemplate) => t.shortDescription === STUB_DESCRIPTION;

/** Wszystkie teksty pisma (nagłówki, akapity, pozycje list, załączniki, strony). */
function allStrings(doc: LetterDocument): string[] {
  const out: string[] = [doc.place, doc.date, doc.title, doc.closing, doc.signatureName, ...doc.attachments];
  if (doc.subject) out.push(doc.subject);
  if (doc.salutation) out.push(doc.salutation);
  for (const party of [doc.sender, doc.recipient]) out.push(party.name, ...party.addressLines, ...(party.extra ?? []));
  for (const p of doc.paragraphs) {
    if (p.type === "list") out.push(...p.items);
    else out.push(p.text);
  }
  return out;
}

function wordCount(text: string): number {
  return text.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
}

describe("katalog szablonów", () => {
  it("ma unikalne slugi", () => {
    const slugs = templates.map((t) => t.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });
});

describe.each(templates.map((t) => [t.slug, t] as const))("szablon %s", (_slug, template) => {
  const questions = getAllQuestions(template);
  const byId = new Map(questions.map((q) => [q.id, q]));

  it("ma unikalne id pytań", () => {
    const ids = questions.map((q) => q.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("render z pustymi odpowiedziami nie rzuca i nie zawiera artefaktów", () => {
    const doc = template.render({ answers: {}, today: TODAY });
    const serialized = JSON.stringify(doc);
    expect(serialized).not.toContain("undefined");
    expect(serialized).not.toContain("NaN");
    expect(serialized).not.toContain("[object");
  });

  it("render z przykładowymi odpowiedziami daje poprawne pismo", () => {
    const validation = validateAnswers(template, generateSampleAnswers(template));
    expect(validation.ok ? null : validation.fieldErrors).toBeNull();
    if (!validation.ok) return;

    const doc = template.render({ answers: validation.answers, today: TODAY });
    // stuby („Szablon w przygotowaniu.”) mają jeden akapit zastępczy – reszta sprawdzeń obowiązuje wszystkich
    if (!isStub(template)) expect(doc.paragraphs.length).toBeGreaterThanOrEqual(4);
    expect(doc.previewParagraphCount).toBeLessThanOrEqual(doc.paragraphs.length);

    const serialized = JSON.stringify(doc);
    expect(serialized).not.toContain("undefined");
    expect(serialized).not.toContain("NaN");
    expect(serialized).not.toContain("[object");
    for (const text of allStrings(doc)) {
      expect(text, `podwójna spacja w: „${text}”`).not.toMatch(/ {2}/);
      expect(text, `podwójna kropka w: „${text}”`).not.toMatch(/(?<!\.)\.\.(?!\.)/);
    }
  });

  it("terminy liczone są od pytań typu date", () => {
    for (const rule of template.deadlines) {
      const q = byId.get(rule.fromQuestionId);
      expect(q, `brak pytania ${rule.fromQuestionId}`).toBeDefined();
      expect(q?.type).toBe("date");
    }
  });

  it("ai.factQuestionIds wskazują istniejące pytania", () => {
    for (const id of template.ai.factQuestionIds) expect(byId.has(id), `brak pytania ${id}`).toBe(true);
  });

  it.skipIf(isStub(template))("ma kompletną treść (podstawy prawne, poradnik, FAQ, SEO, instrukcje)", () => {
    expect(template.legalBasis.length).toBeGreaterThanOrEqual(1);
    const guideWords = template.seo.guide.reduce((sum, s) => sum + wordCount(`${s.heading} ${s.body}`), 0);
    expect(guideWords).toBeGreaterThanOrEqual(500);
    expect(template.seo.faq.length).toBeGreaterThanOrEqual(4);
    expect(template.seo.title.length).toBeLessThanOrEqual(70);
    expect(template.instructions.checklist.length).toBeGreaterThanOrEqual(3);
  });
});
