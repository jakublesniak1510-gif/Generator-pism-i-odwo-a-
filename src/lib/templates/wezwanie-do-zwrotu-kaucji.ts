// STUB – zostanie zastąpiony pełnym szablonem przez zespół content.
import type { LetterTemplate } from "./types";
import { formatDatePl, p, partyFromAnswers, paragraphsFromText, recipientQuestions, senderQuestions, str } from "./helpers";

export const wezwanieDoZwrotuKaucji: LetterTemplate = {
  slug: "wezwanie-do-zwrotu-kaucji",
  name: "Wezwanie do zwrotu kaucji za mieszkanie",
  category: "mieszkanie",
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
  seo: { title: "Wezwanie do zwrotu kaucji za mieszkanie", metaDescription: "", h1: "Wezwanie do zwrotu kaucji za mieszkanie", intro: "", keywords: [], guide: [], faq: [] },
  ai: { context: "", factQuestionIds: ["facts_description"] },
  render: ({ answers, ai, today }) => ({
    sender: partyFromAnswers(answers, "sender"),
    recipient: partyFromAnswers(answers, "recipient"),
    place: str(answers, "sender_city"),
    date: formatDatePl(today),
    title: "Wezwanie do zwrotu kaucji za mieszkanie".toUpperCase(),
    paragraphs: ai ? paragraphsFromText(ai.facts) : [p(str(answers, "facts_description"))],
    closing: "Z poważaniem",
    signatureName: str(answers, "sender_name"),
    attachments: [],
    previewParagraphCount: 1,
  }),
};
