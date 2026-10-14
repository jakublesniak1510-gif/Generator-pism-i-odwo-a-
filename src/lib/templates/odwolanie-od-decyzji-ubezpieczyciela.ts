// STUB – zostanie zastąpiony pełnym szablonem przez zespół content.
import type { LetterTemplate } from "./types";
import { formatDatePl, p, partyFromAnswers, paragraphsFromText, recipientQuestions, senderQuestions, str } from "./helpers";

export const odwolanieOdDecyzjiUbezpieczyciela: LetterTemplate = {
  slug: "odwolanie-od-decyzji-ubezpieczyciela",
  name: "Odwołanie od decyzji ubezpieczyciela",
  category: "finanse",
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
  seo: { title: "Odwołanie od decyzji ubezpieczyciela", metaDescription: "", h1: "Odwołanie od decyzji ubezpieczyciela", intro: "", keywords: [], guide: [], faq: [] },
  ai: { context: "", factQuestionIds: ["facts_description"] },
  render: ({ answers, ai, today }) => ({
    sender: partyFromAnswers(answers, "sender"),
    recipient: partyFromAnswers(answers, "recipient"),
    place: str(answers, "sender_city"),
    date: formatDatePl(today),
    title: "Odwołanie od decyzji ubezpieczyciela".toUpperCase(),
    paragraphs: ai ? paragraphsFromText(ai.facts) : [p(str(answers, "facts_description"))],
    closing: "Z poważaniem",
    signatureName: str(answers, "sender_name"),
    attachments: [],
    previewParagraphCount: 1,
  }),
};
