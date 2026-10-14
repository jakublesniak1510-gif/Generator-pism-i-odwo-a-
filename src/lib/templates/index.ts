import type { LetterTemplate } from "./types";
import { reklamacjaTowaru } from "./reklamacja-towaru";
import { odstapienieOdUmowyNaOdleglosc } from "./odstapienie-od-umowy-na-odleglosc";
import { odwolanieParkingPrywatny } from "./odwolanie-oplata-parking-prywatny";
import { odwolanieStrefaParkowania } from "./odwolanie-oplata-strefa-parkowania";
import { odwolanieJazdaBezBiletu } from "./odwolanie-oplata-jazda-bez-biletu";
import { wypowiedzenieUmowy } from "./wypowiedzenie-umowy";
import { reklamacjaLotu } from "./reklamacja-lotu-odszkodowanie";
import { wezwanieDoZaplaty } from "./wezwanie-do-zaplaty";
import { pismoDoWspolnoty } from "./pismo-do-wspolnoty-spoldzielni";

export const TEMPLATES: LetterTemplate[] = [
  reklamacjaTowaru,
  odstapienieOdUmowyNaOdleglosc,
  odwolanieParkingPrywatny,
  odwolanieStrefaParkowania,
  odwolanieJazdaBezBiletu,
  wypowiedzenieUmowy,
  reklamacjaLotu,
  wezwanieDoZaplaty,
  pismoDoWspolnoty,
];

export function getTemplate(slug: string): LetterTemplate | undefined {
  return TEMPLATES.find((t) => t.slug === slug);
}

export function getAllTemplates(): LetterTemplate[] {
  return TEMPLATES;
}

export const CATEGORY_LABELS: Record<LetterTemplate["category"], string> = {
  konsument: "Konsument i zakupy",
  transport: "Transport i parkowanie",
  umowy: "Umowy i wypowiedzenia",
  finanse: "Pieniądze i windykacja",
  mieszkanie: "Mieszkanie",
};

export * from "./types";
