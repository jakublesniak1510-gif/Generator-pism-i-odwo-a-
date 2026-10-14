// STUB – zostanie zastąpiony pełnym szablonem przez zespół content.
import type { LetterTemplate } from "./types";
import { formatDatePl, p, partyFromAnswers, paragraphsFromText, recipientQuestions, senderQuestions, str } from "./helpers";

export const zadanieUsunieciaDanychRodo: LetterTemplate = {
  slug: "zadanie-usuniecia-danych-rodo",
  name: "Żądanie usunięcia danych osobowych (RODO)",
  category: "dane-osobowe",
  shortDescription: "Szablon w przygotowaniu.",
  priceGrosze: 2499,
  icon: "📄",
  estimatedMinutes: 5,
  sections: [
    { id: "sender", title: "Twoje dane", questions: senderQuestions() },
    { id: "recipient", title: "Adresat", questions: recipientQuestions() },
    { id: "facts", title: "Co się stało", questions: [
      { id: "facts_description", label: "Opisz sytuację", type: "textarea" },
    ] },
  ],
  legalBasis: [],
  deadlines: [],
  instructions: { whereToSend: "", howToSend: "", afterSending: "", checklist: [] },
  seo: { title: "Żądanie usunięcia danych osobowych (RODO)", metaDescription: "", h1: "Żądanie usunięcia danych osobowych (RODO)", intro: "", keywords: [], guide: [], faq: [] },
  ai: { context: "", factQuestionIds: ["facts_description"] },
  render: ({ answers, ai, today }) => ({
    sender: partyFromAnswers(answers, "sender"),
    recipient: partyFromAnswers(answers, "recipient"),
    place: str(answers, "sender_city"),
    date: formatDatePl(today),
    title: "Żądanie usunięcia danych osobowych (RODO)".toUpperCase(),
    paragraphs: ai ? paragraphsFromText(ai.facts) : [p(str(answers, "facts_description"))],
    closing: "Z poważaniem",
    signatureName: str(answers, "sender_name"),
    attachments: [],
    previewParagraphCount: 1,
  }),
};
