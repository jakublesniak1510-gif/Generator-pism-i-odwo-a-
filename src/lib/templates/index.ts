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
import { odwolanieOdDecyzjiUbezpieczyciela } from "./odwolanie-od-decyzji-ubezpieczyciela";
import { reklamacjaDoBanku } from "./reklamacja-do-banku-nieautoryzowana-transakcja";
import { zwrotProwizjiKredyt } from "./zwrot-prowizji-wczesniejsza-splata-kredytu";
import { sprzeciwOdNakazuZaplaty } from "./sprzeciw-od-nakazu-zaplaty";
import { wypowiedzenieUmowyOPrace } from "./wypowiedzenie-umowy-o-prace";
import { wezwanieDoZwrotuKaucji } from "./wezwanie-do-zwrotu-kaucji";
import { reklamacjaUslugi } from "./reklamacja-uslugi";
import { zadanieUsunieciaDanychRodo } from "./zadanie-usuniecia-danych-rodo";
import { reklamacjaPrzesylkiKurierskiej } from "./reklamacja-przesylki-kurierskiej";

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
  odwolanieOdDecyzjiUbezpieczyciela,
  reklamacjaDoBanku,
  zwrotProwizjiKredyt,
  sprzeciwOdNakazuZaplaty,
  wypowiedzenieUmowyOPrace,
  wezwanieDoZwrotuKaucji,
  reklamacjaUslugi,
  zadanieUsunieciaDanychRodo,
  reklamacjaPrzesylkiKurierskiej,
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
  praca: "Praca",
  "dane-osobowe": "Dane osobowe i RODO",
};

export * from "./types";
