import type { LetterTemplate } from "@/lib/templates/types";

/** Minimalny szablon do testów jednostkowych silnika (nie trafia do katalogu pism). */
export function makeTestTemplate(overrides: Partial<LetterTemplate> = {}): LetterTemplate {
  return {
    slug: "test-pismo",
    name: "Pismo testowe",
    category: "konsument",
    shortDescription: "Test.",
    priceGrosze: 2499,
    icon: "📄",
    estimatedMinutes: 1,
    sections: [
      {
        id: "s1",
        title: "Dane",
        questions: [
          { id: "name", label: "Imię i nazwisko", type: "text" },
          { id: "postal", label: "Kod pocztowy", type: "text", validate: { pattern: "^\\d{2}-\\d{3}$" } },
          { id: "note", label: "Uwagi", type: "textarea", required: false, validate: { maxLength: 20 } },
          { id: "purchase_date", label: "Data zakupu", type: "date" },
          { id: "price", label: "Cena", type: "money" },
          { id: "count", label: "Liczba sztuk", type: "number", validate: { min: 1, max: 10 } },
          {
            id: "kind",
            label: "Rodzaj",
            type: "radio",
            options: [
              { value: "goods", label: "Towar" },
              { value: "service", label: "Usługa" },
            ],
          },
          { id: "goods_name", label: "Nazwa towaru", type: "text", showIf: { questionId: "kind", equals: "goods" } },
          { id: "has_receipt", label: "Mam paragon", type: "checkbox" },
          { id: "receipt_no", label: "Nr paragonu", type: "text", showIf: { questionId: "has_receipt", equals: "true" } },
          { id: "statement", label: "Oświadczam, że dane są prawdziwe", type: "checkbox", required: true },
          { id: "email", label: "E-mail", type: "email", required: false },
          { id: "phone", label: "Telefon", type: "phone", required: false },
        ],
      },
    ],
    legalBasis: [],
    deadlines: [
      { id: "d1", label: "Termin", fromQuestionId: "purchase_date", years: 2, description: "Dwa lata od zakupu." },
      { id: "d2", label: "Termin 14 dni", fromQuestionId: "purchase_date", days: 14, description: "14 dni." },
    ],
    instructions: { whereToSend: "", howToSend: "", afterSending: "", checklist: [] },
    seo: { title: "", metaDescription: "", h1: "", intro: "", keywords: [], guide: [], faq: [] },
    ai: { context: "", factQuestionIds: ["name"] },
    render: () => ({
      sender: { name: "A", addressLines: [] },
      recipient: { name: "B", addressLines: [] },
      place: "Warszawa",
      date: "1 stycznia 2026 r.",
      title: "PISMO",
      paragraphs: [],
      closing: "Z poważaniem",
      signatureName: "A",
      attachments: [],
      previewParagraphCount: 1,
    }),
    ...overrides,
  };
}
