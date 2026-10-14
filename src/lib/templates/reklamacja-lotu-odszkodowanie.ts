import type { Answers, LetterTemplate, Paragraph } from "./types";
import {
  bool,
  formatDatePl,
  formatMoneyPl,
  heading,
  list,
  num,
  p,
  paragraphsFromText,
  partyFromAnswers,
  recipientQuestions,
  senderQuestions,
  str,
} from "./helpers";

/*
 * Reklamacja lotu i wniosek o odszkodowanie – rozporządzenie (WE) nr 261/2004.
 * Warianty (`incident_type`): delay (opóźnienie ≥ 3 h), cancellation (odwołanie), denied (odmowa przyjęcia na pokład).
 * Kwota = stawka z art. 7 ust. 1 × liczba pasażerów.
 * Przedawnienie 1 rok (art. 778 KC, uchwała SN III CZP 111/16) – [DO WERYFIKACJI], patrz docs/legal-review.
 */

const BLANK = "____________";

const REGULATION_FULL =
  "rozporządzenia (WE) nr 261/2004 Parlamentu Europejskiego i Rady z dnia 11 lutego 2004 r. ustanawiającego wspólne zasady odszkodowania i pomocy dla pasażerów w przypadku odmowy przyjęcia na pokład albo odwołania lub dużego opóźnienia lotów";

const RATES: Record<string, { eur: number; letter: string; lit: string }> = {
  short: { eur: 250, letter: "do 1500 km", lit: "a" },
  medium: { eur: 400, letter: "od 1500 do 3500 km (lub lotów wewnątrzwspólnotowych powyżej 1500 km)", lit: "b" },
  long: { eur: 600, letter: "powyżej 3500 km", lit: "c" },
};

function dateAnswer(answers: Answers, id: string): Date | undefined {
  const v = answers[id];
  if (typeof v !== "string") return undefined;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v.trim());
  if (!m) return undefined;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

function sentence(text: string): string {
  const t = text.replace(/\s+/g, " ").trim();
  if (!t) return t;
  const cap = t.charAt(0).toUpperCase() + t.slice(1);
  return /[.!?…]$/.test(cap) ? cap : `${cap}.`;
}

/** Opis użytkownika → akapity (puste linie rozdzielają akapity). */
function userParagraphs(text: string): Paragraph[] {
  return text
    .split(/\n\s*\n/)
    .map((t) => sentence(t))
    .filter(Boolean)
    .map(p);
}

function lines(text: string | undefined): string[] {
  if (!text) return [];
  return text
    .split(/\r?\n|;|,(?=\s*\p{Lu})/u)
    .map((l) => l.replace(/^\s*(?:[-–•*]|\d+[.)])\s*/, "").replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

/** "3 godziny", "5 godzin", "3,5 godziny" */
function hoursPl(h: number | undefined): string {
  if (h === undefined) return `${BLANK} godzin`;
  const formatted = new Intl.NumberFormat("pl-PL", { maximumFractionDigits: 1 }).format(h);
  if (!Number.isInteger(h)) return `${formatted} godziny`;
  if (h === 1) return "1 godziny";
  const mod10 = h % 10;
  const mod100 = h % 100;
  return mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14) ? `${formatted} godziny` : `${formatted} godzin`;
}

function formatEur(n: number): string {
  return `${new Intl.NumberFormat("pl-PL", { maximumFractionDigits: 0 }).format(n)} EUR`;
}

type Incident = "delay" | "cancellation" | "denied";

function incidentOf(answers: Answers): Incident {
  const v = str(answers, "incident_type", "delay");
  return v === "cancellation" || v === "denied" ? v : "delay";
}

function passengers(answers: Answers): { count: number; others: string[] } {
  const others = lines(str(answers, "co_passengers", ""));
  const declared = num(answers, "passengers_count");
  const count = declared && declared >= 1 ? Math.round(declared) : 1 + others.length;
  return { count: Math.max(count, 1), others };
}

/** Czy przysługuje odszkodowanie z art. 7 (przy odwołaniu zgłoszonym > 14 dni wcześniej – nie). */
function compensationClaimed(answers: Answers): boolean {
  return !(incidentOf(answers) === "cancellation" && str(answers, "cancellation_notice", "") === "gt14");
}

function flightLabel(answers: Answers): string {
  return `lotu nr ${str(answers, "flight_number")} na trasie ${str(answers, "departure_airport")} – ${str(answers, "arrival_airport")}, zaplanowanego na dzień ${formatDatePl(dateAnswer(answers, "flight_date"))},`;
}

function factsParagraphs(answers: Answers): Paragraph[] {
  const incident = incidentOf(answers);
  const { count } = passengers(answers);
  const many = count > 1;
  const out: Paragraph[] = [];
  const date = formatDatePl(dateAnswer(answers, "flight_date"));

  let first: string;
  if (incident === "delay") {
    first = `Lot został opóźniony. Na lotnisko docelowe – ${str(answers, "arrival_airport")} – samolot dotarł z opóźnieniem wynoszącym około ${hoursPl(num(answers, "delay_hours"))} w stosunku do planowego czasu przylotu.`;
  } else if (incident === "cancellation") {
    const notice = str(answers, "cancellation_notice", "");
    const noticeText =
      notice === "lt7"
        ? " Informację o odwołaniu lotu otrzymano mniej niż 7 dni przed planowanym wylotem."
        : notice === "7to14"
          ? " Informację o odwołaniu lotu otrzymano od 7 do 14 dni przed planowanym wylotem."
          : notice === "gt14"
            ? " Informację o odwołaniu lotu otrzymano ponad 14 dni przed planowanym wylotem."
            : "";
    first = `Lot został odwołany.${noticeText}`;
  } else {
    first = `W dniu ${date}, pomimo posiadania potwierdzonej rezerwacji na ten lot i stawienia się do odprawy w wymaganym czasie, odmówiono ${many ? "nam" : "mi"} przyjęcia na pokład wbrew ${many ? "naszej" : "mojej"} woli.`;
  }

  const care = str(answers, "care_provided", "");
  const careText =
    care === "yes"
      ? " Przewoźnik zapewnił opiekę na lotnisku."
      : care === "partial"
        ? " Przewoźnik zapewnił opiekę jedynie w ograniczonym zakresie."
        : care === "no"
          ? " Przewoźnik nie zapewnił opieki, do której był zobowiązany (posiłków i napojów, a w razie potrzeby zakwaterowania i transportu)."
          : "";
  out.push(p(`${first}${careText}`));

  if (bool(answers, "extra_costs")) {
    const desc = str(answers, "extra_costs_description", "");
    out.push(
      p(
        `W związku z tym poniesione zostały dodatkowe koszty w łącznej kwocie ${formatMoneyPl(num(answers, "extra_costs_amount"))}${desc ? `, obejmujące: ${desc.replace(/\s+/g, " ").replace(/[.;,]$/, "")}` : ""}. Dowody poniesienia tych kosztów załączam do reklamacji.`,
      ),
    );
  }

  const description = str(answers, "facts_description", "");
  if (description) out.push(...userParagraphs(description));
  return out;
}

function demandItems(answers: Answers): string[] {
  const { count } = passengers(answers);
  const rate = RATES[str(answers, "distance", "")];
  const items: string[] = [];
  if (compensationClaimed(answers)) {
    if (rate) {
      items.push(
        count > 1
          ? `wypłatę odszkodowania w łącznej kwocie ${formatEur(rate.eur * count)}, tj. ${formatEur(rate.eur)} dla każdego z ${count} pasażerów (art. 7 ust. 1 lit. ${rate.lit} rozporządzenia), lub równowartości tej kwoty w złotych`
          : `wypłatę odszkodowania w kwocie ${formatEur(rate.eur)} (art. 7 ust. 1 lit. ${rate.lit} rozporządzenia) lub równowartości tej kwoty w złotych`,
      );
    } else {
      items.push("wypłatę odszkodowania w kwocie ______ EUR na każdego pasażera, określonej w art. 7 ust. 1 rozporządzenia");
    }
  }
  if (bool(answers, "extra_costs")) {
    items.push(`zwrot dodatkowych kosztów poniesionych w związku z ${incidentOf(answers) === "delay" ? "opóźnieniem" : incidentOf(answers) === "cancellation" ? "odwołaniem lotu" : "odmową przyjęcia na pokład"} w kwocie ${formatMoneyPl(num(answers, "extra_costs_amount"))}`);
  }
  if (items.length === 0) {
    items.push("pisemne ustosunkowanie się do reklamacji oraz wskazanie, jakie świadczenia przysługujące pasażerom na podstawie art. 8 i 9 rozporządzenia zostały zapewnione");
  }
  return items;
}

function legalParagraphs(answers: Answers): Paragraph[] {
  const incident = incidentOf(answers);
  const rate = RATES[str(answers, "distance", "")];
  const out: Paragraph[] = [];

  if (incident === "delay") {
    out.push(
      p(
        `Zgodnie z art. 6 ${REGULATION_FULL} (dalej: rozporządzenie) w przypadku dużego opóźnienia lotu pasażerom przysługuje pomoc ze strony obsługującego przewoźnika lotniczego. W wyroku z dnia 19 listopada 2009 r. w sprawach połączonych C-402/07 i C-432/07 (Sturgeon i in.), potwierdzonym wyrokiem z dnia 23 października 2012 r. w sprawach połączonych C-581/10 i C-629/10 (Nelson i in.), Trybunał Sprawiedliwości Unii Europejskiej orzekł, że pasażerowie lotów opóźnionych, którzy dotarli do miejsca docelowego z opóźnieniem wynoszącym co najmniej trzy godziny, mają – na równi z pasażerami lotów odwołanych – prawo do odszkodowania przewidzianego w art. 7 rozporządzenia.`,
      ),
    );
  } else if (incident === "cancellation") {
    out.push(
      p(
        `Zgodnie z art. 5 ust. 1 ${REGULATION_FULL} (dalej: rozporządzenie) w przypadku odwołania lotu pasażerowie mają prawo do pomocy określonej w art. 8 (zwrot kosztu biletu albo zmiana planu podróży) i art. 9 (opieka) oraz – na podstawie art. 5 ust. 1 lit. c – do odszkodowania określonego w art. 7, chyba że zostali poinformowani o odwołaniu z wyprzedzeniem i na warunkach wskazanych w tym przepisie.`,
      ),
    );
  } else {
    out.push(
      p(
        `Zgodnie z art. 4 ust. 3 ${REGULATION_FULL} (dalej: rozporządzenie) w przypadku odmowy przyjęcia pasażerów na pokład wbrew ich woli obsługujący przewoźnik lotniczy niezwłocznie wypłaca im odszkodowanie zgodnie z art. 7 oraz udziela im pomocy zgodnie z art. 8 i 9 rozporządzenia.`,
      ),
    );
  }

  if (compensationClaimed(answers)) {
    out.push(
      p(
        `Zgodnie z art. 7 ust. 1 rozporządzenia odszkodowanie wynosi 250 EUR dla wszystkich lotów o długości do 1500 km, 400 EUR dla wszystkich lotów wewnątrzwspólnotowych dłuższych niż 1500 km i dla wszystkich innych lotów o długości od 1500 do 3500 km oraz 600 EUR dla pozostałych lotów.${rate ? ` Odległość przedmiotowego lotu mieści się w przedziale ${rate.letter}, co uzasadnia odszkodowanie w kwocie ${formatEur(rate.eur)} na każdego pasażera.` : ""}`,
      ),
    );
  }

  if (incident !== "denied" && compensationClaimed(answers)) {
    const what = incident === "delay" ? "opóźnienie" : "odwołanie";
    out.push(
      p(
        `Na podstawie art. 5 ust. 3 rozporządzenia przewoźnik jest zwolniony z obowiązku wypłaty odszkodowania wyłącznie wtedy, gdy udowodni, że ${what} zostało spowodowane zaistnieniem nadzwyczajnych okoliczności, których nie można było uniknąć pomimo podjęcia wszelkich racjonalnych środków. Ciężar dowodu spoczywa na przewoźniku, a problemy techniczne statku powietrznego co do zasady nie stanowią takich okoliczności (wyrok Trybunału Sprawiedliwości z dnia 22 grudnia 2008 r., C-549/07 Wallentin-Hermann). W razie powołania się na nadzwyczajne okoliczności proszę o przedstawienie dowodów ich wystąpienia oraz podjęcia wszelkich racjonalnych środków.`,
      ),
    );
  }

  const care = str(answers, "care_provided", "");
  if (bool(answers, "extra_costs") || care === "no" || care === "partial") {
    out.push(
      p(
        "Zgodnie z art. 9 rozporządzenia przewoźnik jest obowiązany zapewnić pasażerom nieodpłatnie posiłki i napoje w ilości adekwatnej do czasu oczekiwania, a w razie konieczności – zakwaterowanie w hotelu i transport między lotniskiem a miejscem zakwaterowania. Wydatki poniesione przez pasażera wskutek niewywiązania się przewoźnika z tego obowiązku powinny zostać zwrócone, w zakresie, w jakim były niezbędne, odpowiednie i rozsądne.",
      ),
    );
  }
  return out;
}

export const reklamacjaLotu: LetterTemplate = {
  slug: "reklamacja-lotu-odszkodowanie",
  name: "Reklamacja lotu i odszkodowanie",
  category: "transport",
  shortDescription:
    "Odszkodowanie do 600 EUR za opóźniony co najmniej 3 godziny, odwołany lot lub odmowę wejścia na pokład – reklamacja do linii lotniczej.",
  priceGrosze: 2499,
  icon: "✈️",
  estimatedMinutes: 7,
  sections: [
    { id: "sender", title: "Twoje dane", questions: senderQuestions() },
    {
      id: "recipient",
      title: "Linia lotnicza",
      description: "Reklamację kierujesz do przewoźnika, który faktycznie wykonywał lot – nawet jeśli bilet kupiłeś u innej linii lub w biurze podróży.",
      questions: recipientQuestions("Linia lotnicza").map((q) =>
        q.id === "recipient_name"
          ? {
              ...q,
              placeholder: "np. Polskie Linie Lotnicze LOT S.A.",
              help: "Pełną nazwę i adres przewoźnika znajdziesz w regulaminie przewozu, w stopce strony internetowej lub na potwierdzeniu rezerwacji.",
            }
          : q,
      ),
    },
    {
      id: "flight",
      title: "Lot i zdarzenie",
      questions: [
        { id: "flight_number", label: "Numer lotu", type: "text", placeholder: "np. LO 3923", help: "Znajdziesz go na karcie pokładowej lub w potwierdzeniu rezerwacji." },
        { id: "flight_date", label: "Data lotu (planowana data wylotu)", type: "date" },
        { id: "departure_airport", label: "Lotnisko wylotu", type: "text", placeholder: "np. Warszawa (WAW)" },
        { id: "arrival_airport", label: "Lotnisko docelowe", type: "text", placeholder: "np. Barcelona (BCN)", help: "Przy locie z przesiadką wpisz ostateczny cel podróży z jednej rezerwacji." },
        { id: "booking_reference", label: "Numer rezerwacji (PNR)", type: "text", placeholder: "np. ABC12D", help: "6-znakowy kod z potwierdzenia rezerwacji lub karty pokładowej." },
        {
          id: "incident_type",
          label: "Co się stało?",
          type: "radio",
          options: [
            { value: "delay", label: "Opóźnienie – dotarłem/am do celu co najmniej 3 godziny później" },
            { value: "cancellation", label: "Lot został odwołany" },
            { value: "denied", label: "Odmówiono mi wejścia na pokład (np. overbooking)" },
          ],
        },
        {
          id: "delay_hours",
          label: "O ile godzin później dotarłeś/aś do celu?",
          type: "number",
          placeholder: "np. 4",
          help: "Liczy się opóźnienie przylotu, a nie wylotu – moment otwarcia drzwi samolotu na lotnisku docelowym. Odszkodowanie przysługuje od 3 godzin.",
          validate: { min: 3, max: 96 },
          showIf: { questionId: "incident_type", equals: "delay" },
        },
        {
          id: "cancellation_notice",
          label: "Kiedy dowiedziałeś/aś się o odwołaniu lotu?",
          type: "select",
          options: [
            { value: "lt7", label: "Mniej niż 7 dni przed wylotem" },
            { value: "7to14", label: "Od 7 do 14 dni przed wylotem" },
            { value: "gt14", label: "Ponad 14 dni przed wylotem (odszkodowanie zwykle nie przysługuje)" },
          ],
          help: "Przy informacji przekazanej 7–14 dni wcześniej odszkodowanie nie przysługuje, jeśli przewoźnik zaproponował lot zastępczy o zbliżonych godzinach.",
          showIf: { questionId: "incident_type", equals: "cancellation" },
        },
        {
          id: "distance",
          label: "Odległość lotu",
          type: "select",
          options: [
            { value: "short", label: "Do 1500 km – 250 EUR (np. Warszawa–Londyn, Kraków–Paryż)" },
            { value: "medium", label: "1500–3500 km lub każdy lot w UE powyżej 1500 km – 400 EUR (np. Warszawa–Barcelona, Gdańsk–Teneryfa)" },
            { value: "long", label: "Ponad 3500 km poza UE – 600 EUR (np. Warszawa–Nowy Jork)" },
          ],
          help: "Liczy się odległość w linii prostej (po ortodromie) między lotniskiem wylotu a ostatecznym celem podróży – sprawdzisz ją w kalkulatorze odległości lotniczych (wpisz kody lotnisk).",
        },
        {
          id: "passengers_count",
          label: "Ilu pasażerów z tej rezerwacji składa reklamację (łącznie z Tobą)?",
          type: "number",
          placeholder: "1",
          help: "Odszkodowanie należy się każdemu pasażerowi, także dziecku z własnym miejscem. Niemowlęta podróżujące bezpłatnie zwykle nie są uprawnione.",
          validate: { min: 1, max: 9 },
        },
        {
          id: "co_passengers",
          label: "Imiona i nazwiska współpasażerów (opcjonalnie)",
          type: "textarea",
          required: false,
          placeholder: "Piotr Nowak\nZofia Nowak",
          help: "Każda osoba w nowej linii. Dorośli współpasażerowie powinni podpisać pismo lub udzielić Ci pisemnego upoważnienia; za dzieci działa rodzic.",
        },
      ],
    },
    {
      id: "care",
      title: "Opieka i koszty",
      questions: [
        {
          id: "care_provided",
          label: "Czy linia zapewniła opiekę (posiłki, napoje, hotel)?",
          type: "radio",
          options: [
            { value: "yes", label: "Tak, w pełni" },
            { value: "partial", label: "Częściowo (np. tylko voucher na wodę)" },
            { value: "no", label: "Nie zapewniła" },
          ],
        },
        {
          id: "extra_costs",
          label: "Poniosłem/am dodatkowe koszty (posiłki, hotel, taksówka, nowy bilet)",
          type: "checkbox",
          required: false,
          help: "Zachowaj paragony i faktury – dołącz ich kopie do reklamacji.",
        },
        {
          id: "extra_costs_amount",
          label: "Łączna kwota dodatkowych kosztów (zł)",
          type: "money",
          placeholder: "np. 245,50",
          showIf: { questionId: "extra_costs", equals: "true" },
        },
        {
          id: "extra_costs_description",
          label: "Na co wydano te pieniądze?",
          type: "textarea",
          placeholder: "np. posiłki na lotnisku 120 zł, taksówka do hotelu 125,50 zł",
          showIf: { questionId: "extra_costs", equals: "true" },
        },
      ],
    },
    {
      id: "facts",
      title: "Przebieg zdarzenia i wypłata",
      questions: [
        {
          id: "facts_description",
          label: "Opisz przebieg zdarzenia",
          type: "textarea",
          placeholder:
            "np. Wylot planowo o 6:10, faktycznie o 11:25. Pracownicy przewoźnika podali jako przyczynę usterkę techniczną. Na miejsce dotarliśmy o 15:40 zamiast o 9:35.",
          help: "Podaj planowe i rzeczywiste godziny, przyczynę podaną przez przewoźnika i to, co zaproponowano Ci na lotnisku. Ten opis zostanie zredagowany w piśmie.",
        },
        {
          id: "iban",
          label: "Numer rachunku do wypłaty (IBAN)",
          type: "text",
          placeholder: "PL61 1090 1014 0000 0712 1981 2874",
          help: "Rachunek, na który przewoźnik ma przelać odszkodowanie. Dla rachunku zagranicznego podaj też kod SWIFT/BIC.",
          validate: { maxLength: 60 },
        },
      ],
    },
  ],
  legalBasis: [
    {
      act: "Rozporządzenie (WE) nr 261/2004 Parlamentu Europejskiego i Rady z dnia 11 lutego 2004 r.",
      article: "art. 4, art. 5 i art. 6",
      summary: "Określają prawa pasażerów przy odmowie przyjęcia na pokład, odwołaniu i dużym opóźnieniu lotu.",
      url: "https://eur-lex.europa.eu/legal-content/PL/TXT/?uri=CELEX:32004R0261",
    },
    {
      act: "Rozporządzenie (WE) nr 261/2004 Parlamentu Europejskiego i Rady z dnia 11 lutego 2004 r.",
      article: "art. 7 ust. 1",
      summary: "Odszkodowanie wynosi 250, 400 lub 600 EUR na pasażera – zależnie od odległości lotu.",
      url: "https://eur-lex.europa.eu/legal-content/PL/TXT/?uri=CELEX:32004R0261",
    },
    {
      act: "Rozporządzenie (WE) nr 261/2004 Parlamentu Europejskiego i Rady z dnia 11 lutego 2004 r.",
      article: "art. 8 i art. 9",
      summary: "Prawo do zwrotu ceny biletu lub zmiany trasy oraz do opieki: posiłków, napojów, hotelu i transportu.",
      url: "https://eur-lex.europa.eu/legal-content/PL/TXT/?uri=CELEX:32004R0261",
    },
    {
      act: "Rozporządzenie (WE) nr 261/2004 Parlamentu Europejskiego i Rady z dnia 11 lutego 2004 r.",
      article: "art. 5 ust. 3",
      summary: "Przewoźnik uniknie odszkodowania tylko wtedy, gdy udowodni nadzwyczajne okoliczności, których nie dało się uniknąć.",
      url: "https://eur-lex.europa.eu/legal-content/PL/TXT/?uri=CELEX:32004R0261",
    },
    {
      act: "Wyrok TSUE z dnia 19 listopada 2009 r. (Sturgeon i in.)",
      article: "sprawy połączone C-402/07 i C-432/07",
      summary: "Opóźnienie przylotu o co najmniej 3 godziny daje prawo do odszkodowania jak przy odwołaniu lotu (potwierdzone w sprawach C-581/10 i C-629/10 Nelson).",
      url: "https://eur-lex.europa.eu/legal-content/PL/TXT/?uri=CELEX:62007CJ0402",
    },
  ],
  deadlines: [
    {
      id: "limitation",
      label: "Ostrożny termin na dochodzenie odszkodowania (1 rok od lotu)",
      fromQuestionId: "flight_date",
      years: 1,
      description:
        "Według uchwały Sądu Najwyższego (III CZP 111/16) roszczenia o odszkodowanie z rozporządzenia 261/2004 przedawniają się w Polsce z upływem roku (art. 778 KC). Złóż reklamację jak najszybciej, a jeśli przewoźnik nie zapłaci – wnieś sprawę do Rzecznika Praw Pasażerów Lotniczych lub do sądu przed upływem tego terminu.",
    },
  ],
  instructions: {
    whereToSend:
      "Reklamację kieruj do **przewoźnika, który wykonywał lot** (widnieje na karcie pokładowej jako „operated by”). Większość linii lotniczych przyjmuje wnioski o odszkodowanie przez **formularz reklamacyjny na swojej stronie** (zakładka „Reklamacje”, „Claims” lub „Customer relations”) – wtedy wklej treść pisma lub dołącz je jako plik PDF. Adres pocztowy do reklamacji znajdziesz w ogólnych warunkach przewozu lub w stopce strony przewoźnika; dla polskich spółek możesz sprawdzić adres siedziby w KRS.",
    howToSend:
      "- **Formularz online lub e-mail** – wystarczą, jeśli przewoźnik wskazuje taki kanał w warunkach przewozu. Zachowaj zrzut ekranu lub potwierdzenie z numerem zgłoszenia.\n- **List polecony za potwierdzeniem odbioru** – dobry wybór, gdy przewoźnik nie ma formularza albo nie odpowiada na e-maile.\n\nDołącz kopie: karty pokładowej lub potwierdzenia rezerwacji, rachunków za dodatkowe wydatki oraz upoważnień współpasażerów. Nie wysyłaj oryginałów.",
    afterSending:
      "Przewoźnik powinien odpowiedzieć w rozsądnym terminie – w piśmie wyznaczamy 30 dni. Jeśli **nie odpowie w ciągu 30 dni lub odmówi** wypłaty, możesz bezpłatnie złożyć wniosek do **Rzecznika Praw Pasażerów Lotniczych przy Prezesie Urzędu Lotnictwa Cywilnego** (pozasądowe rozwiązywanie sporów konsumenckich). ULC zajmuje się lotami z lotnisk w Polsce oraz lotami do Polski wykonywanymi przez przewoźników unijnych; przy innych lotach właściwy jest krajowy organ wykonawczy (NEB) państwa wylotu. Możesz też wnieść pozew do sądu – przy kwotach do 5000 EUR także w europejskim postępowaniu w sprawie drobnych roszczeń. Pilnuj terminu 1 roku od lotu.",
    checklist: [
      "Mam numer lotu, numer rezerwacji i kartę pokładową lub potwierdzenie rezerwacji.",
      "Sprawdziłem/am odległość lotu i godzinę faktycznego przylotu (opóźnienie co najmniej 3 godziny).",
      "Współpasażerowie podpisali pismo lub dali mi pisemne upoważnienie.",
      "Dołączam kopie rachunków za posiłki, hotel lub transport.",
      "Numer rachunku (IBAN) jest poprawny i należy do mnie.",
      "Zapisałem/am datę wysłania reklamacji i termin 30 dni na odpowiedź.",
    ],
  },
  seo: {
    title: "Odszkodowanie za opóźniony lot – wzór reklamacji 2026",
    metaDescription:
      "Lot opóźniony o 3 godziny, odwołany lub overbooking? Wygeneruj reklamację do linii lotniczej i odzyskaj do 600 EUR na osobę na podstawie 261/2004.",
    h1: "Odszkodowanie za opóźniony lub odwołany lot – reklamacja do linii lotniczej",
    intro:
      "Jeśli dotarłeś do celu co najmniej 3 godziny później, lot odwołano lub nie wpuszczono Cię na pokład, możesz żądać od przewoźnika 250, 400 lub 600 EUR na osobę. Odpowiedz na kilka pytań – przygotujemy reklamację z wyliczoną kwotą dla wszystkich pasażerów i podstawą prawną. Bez prowizji od odszkodowania.",
    keywords: [
      "odszkodowanie za opóźniony lot",
      "reklamacja lotu wzór",
      "odszkodowanie za odwołany lot",
      "odszkodowanie 261/2004",
      "opóźnienie lotu 3 godziny odszkodowanie",
      "overbooking odszkodowanie",
      "wniosek o odszkodowanie linia lotnicza wzór",
    ],
    guide: [
      {
        heading: "Kiedy należy się odszkodowanie za lot",
        body:
          "Prawa pasażerów lotniczych w Unii Europejskiej określa rozporządzenie (WE) nr 261/2004. Odszkodowanie w stałej kwocie przysługuje w trzech sytuacjach:\n\n- **Opóźnienie** – gdy dotarłeś do miejsca docelowego co najmniej **3 godziny** po planowym czasie przylotu. Tak orzekł Trybunał Sprawiedliwości UE w sprawie Sturgeon (C-402/07 i C-432/07), a potwierdził w sprawie Nelson.\n- **Odwołanie lotu** – chyba że przewoźnik poinformował Cię o nim co najmniej 14 dni przed wylotem albo wcześniej, ale z propozycją lotu zastępczego o zbliżonych godzinach.\n- **Odmowa przyjęcia na pokład** wbrew Twojej woli, np. z powodu overbookingu.\n\nRozporządzenie obejmuje loty z lotnisk w UE (każdym przewoźnikiem) oraz loty do UE wykonywane przez przewoźnika unijnego. Liczy się opóźnienie **przylotu**, a nie wylotu – samolot może wystartować z 3,5-godzinnym opóźnieniem i nadrobić czas w powietrzu.",
      },
      {
        heading: "Ile wynosi odszkodowanie",
        body:
          "Kwota zależy wyłącznie od odległości lotu, a nie od ceny biletu:\n\n- **250 EUR** – loty do 1500 km,\n- **400 EUR** – loty wewnątrz UE powyżej 1500 km oraz pozostałe loty od 1500 do 3500 km,\n- **600 EUR** – pozostałe loty powyżej 3500 km.\n\nOdszkodowanie należy się **każdemu pasażerowi**, także dziecku. Rodzina czteroosobowa opóźniona na trasie Warszawa–Barcelona może więc żądać 4 × 400 EUR = 1600 EUR. Odległość mierzy się w linii prostej między lotniskiem wylotu a celem podróży – sprawdzisz ją w dowolnym kalkulatorze odległości lotniczych. Przy lotach z przesiadką na jednej rezerwacji liczy się odległość do celu końcowego, a opóźnienie – na lotnisku docelowym.\n\nPrzy odwołaniu lotu przewoźnik może obniżyć kwotę o 50 %, jeśli zaoferował lot zastępczy, który dotarł do celu niewiele później niż planowo (w granicach 2–4 godzin, zależnie od dystansu).",
      },
      {
        heading: "Jak złożyć reklamację krok po kroku",
        body:
          "1. **Zbierz dokumenty**: kartę pokładową, potwierdzenie rezerwacji, zrzuty ekranu z informacją o opóźnieniu lub odwołaniu, rachunki za posiłki i hotel.\n2. **Ustal przewoźnika**, który wykonywał lot – to do niego kierujesz reklamację, nawet jeśli bilet kupiłeś u innej linii lub w biurze podróży.\n3. **Wypełnij generator** – policzymy kwotę dla wszystkich pasażerów i dobierzemy podstawę prawną do rodzaju zdarzenia.\n4. **Wyślij reklamację** przez formularz na stronie przewoźnika, e-mailem albo listem poleconym.\n5. **Czekaj na odpowiedź** – w piśmie wyznaczamy 30 dni.\n6. **Przy odmowie lub braku odpowiedzi** złóż bezpłatny wniosek do Rzecznika Praw Pasażerów Lotniczych przy Prezesie ULC albo pozew do sądu.",
      },
      {
        heading: "Terminy – ile masz czasu",
        body:
          "Rozporządzenie nie określa terminu na zgłoszenie roszczenia – decyduje prawo krajowe. W Polsce, zgodnie z uchwałą Sądu Najwyższego (III CZP 111/16), stosuje się roczny termin przedawnienia z art. 778 Kodeksu cywilnego, liczony od dnia lotu. Dlatego **nie zwlekaj** – reklamację najlepiej złożyć w ciągu kilku tygodni, kiedy łatwo jeszcze zebrać dowody. W innych krajach UE terminy bywają dłuższe, ale bezpieczniej trzymać się roku.\n\nPamiętaj, że złożenie reklamacji u przewoźnika nie przerywa biegu przedawnienia. Jeśli rok mija, a sprawa nie jest zakończona, skieruj ją do sądu.",
      },
      {
        heading: "Nadzwyczajne okoliczności – kiedy linia może odmówić",
        body:
          "Przewoźnik nie musi płacić odszkodowania, jeśli **udowodni**, że opóźnienie lub odwołanie wynikło z nadzwyczajnych okoliczności, których nie dało się uniknąć mimo podjęcia wszelkich racjonalnych środków (art. 5 ust. 3). Takimi okolicznościami mogą być np. ekstremalne warunki pogodowe, decyzje kontroli ruchu lotniczego, zderzenie z ptakiem, zagrożenie bezpieczeństwa.\n\nNie są nimi zwykle: **usterka techniczna** samolotu wykryta podczas rutynowej obsługi, brak załogi, opóźnienie poprzedniego lotu tym samym samolotem z przyczyn leżących po stronie linii. Jeśli przewoźnik odpowiada ogólnikowo „warunki pogodowe” lub „przyczyny operacyjne”, poproś o dowody – ciężar dowodu spoczywa na nim.",
      },
      {
        heading: "Co zrobić, gdy przewoźnik odmawia",
        body:
          "Odmowa przewoźnika nie zamyka sprawy. Najpierw przeczytaj uzasadnienie: jeśli linia powołuje się na nadzwyczajne okoliczności, poproś o konkretne dowody – np. raport pogodowy (METAR) z lotniska, decyzję kontroli ruchu lotniczego lub dokumentację techniczną. Sprawdź też w serwisach śledzenia lotów, czy inne samoloty w tym czasie startowały i lądowały normalnie.\n\nNastępnie złóż bezpłatny wniosek do **Rzecznika Praw Pasażerów Lotniczych** przy Prezesie Urzędu Lotnictwa Cywilnego. Rzecznik prowadzi postępowanie polubowne – nie wydaje wiążącego wyroku, ale przewoźnicy często płacą na tym etapie. Alternatywą jest **pozew do sądu** właściwego według miejsca wylotu lub przylotu. Przy kwotach do 5000 EUR i przewoźniku z innego państwa UE możesz skorzystać z europejskiego postępowania w sprawie drobnych roszczeń na prostym formularzu. Koszty sądowe przy takich kwotach są niewielkie, a przegrywający przewoźnik zwraca je wraz z kosztami zastępstwa.",
      },
      {
        heading: "Najczęstsze błędy",
        body:
          "- **Liczenie opóźnienia wylotu** zamiast przylotu.\n- **Reklamacja do złej linii** – przy locie code-share liczy się przewoźnik obsługujący.\n- **Brak współpasażerów w piśmie** – każda osoba ma własne roszczenie; dorośli muszą podpisać pismo lub udzielić upoważnienia.\n- **Przyjęcie vouchera zamiast pieniędzy** – masz prawo do wypłaty pieniężnej; voucher możesz przyjąć tylko za pisemną zgodą.\n- **Brak rachunków** za posiłki i hotel – bez nich trudno odzyskać koszty opieki.\n- **Czekanie z reklamacją** do ostatniej chwili.",
      },
    ],
    faq: [
      {
        question: "Od ilu godzin opóźnienia należy się odszkodowanie?",
        answer:
          "Od 3 godzin opóźnienia przylotu do miejsca docelowego. Liczy się moment otwarcia drzwi samolotu po wylądowaniu, a nie godzina startu ani lądowania.",
      },
      {
        question: "Ile wynosi odszkodowanie za opóźniony lot?",
        answer:
          "250 EUR za loty do 1500 km, 400 EUR za loty w UE powyżej 1500 km i inne loty 1500–3500 km, 600 EUR za pozostałe loty powyżej 3500 km. Kwota przysługuje każdemu pasażerowi.",
      },
      {
        question: "Czy linia może odmówić wypłaty z powodu usterki technicznej?",
        answer:
          "Co do zasady nie. Trybunał Sprawiedliwości UE uznał, że problemy techniczne ujawnione podczas normalnej eksploatacji samolotu nie są nadzwyczajną okolicznością. Wyjątkiem są np. ukryte wady fabryczne ogłoszone przez producenta lub uszkodzenie spowodowane przez osoby trzecie.",
      },
      {
        question: "Czy mogę złożyć reklamację w imieniu rodziny?",
        answer:
          "Tak. W generatorze podaj liczbę pasażerów i ich imiona i nazwiska – kwota zostanie policzona dla wszystkich. Dorośli współpasażerowie powinni podpisać pismo lub udzielić Ci pisemnego upoważnienia, a za dzieci działa rodzic.",
      },
      {
        question: "Ile czasu mam na złożenie wniosku o odszkodowanie?",
        answer:
          "Według Sądu Najwyższego roszczenie przedawnia się w Polsce po roku od lotu. Złóż reklamację jak najszybciej, a w razie odmowy skieruj sprawę do Rzecznika Praw Pasażerów Lotniczych lub do sądu przed upływem roku.",
      },
      {
        question: "Co jeśli linia nie odpowiada na reklamację?",
        answer:
          "Po 30 dniach bez odpowiedzi lub po odmowie możesz bezpłatnie złożyć wniosek do Rzecznika Praw Pasażerów Lotniczych przy Prezesie Urzędu Lotnictwa Cywilnego albo pozwać przewoźnika w sądzie. Dla lotów spoza Polski właściwy może być organ kraju wylotu.",
      },
      {
        question: "Czy oprócz odszkodowania mogę żądać zwrotu za hotel i jedzenie?",
        answer:
          "Tak. Przewoźnik musi zapewnić posiłki, napoje, a w razie potrzeby hotel i transport. Jeśli tego nie zrobił, możesz żądać zwrotu niezbędnych i rozsądnych wydatków – zachowaj rachunki i dołącz je do reklamacji.",
      },
      {
        question: "Czy muszę korzystać z firmy odszkodowawczej?",
        answer:
          "Nie. Reklamację możesz złożyć samodzielnie i zachować całe odszkodowanie. Firmy pośredniczące pobierają zwykle 25–35 % prowizji.",
      },
    ],
  },
  ai: {
    context:
      "Pismo jest reklamacją pasażera lotniczego skierowaną do przewoźnika, z wnioskiem o odszkodowanie za opóźnienie przylotu o co najmniej trzy godziny, odwołanie lotu lub odmowę przyjęcia na pokład, pisaną w pierwszej osobie (ewentualnie także w imieniu współpasażerów). Opis faktów ma chronologicznie przedstawić przebieg zdarzenia: planowe i rzeczywiste godziny, informacje przekazane przez przewoźnika, zapewnioną lub niezapewnioną opiekę oraz poniesione wydatki. Ton urzędowy, rzeczowy i stanowczy, bez emocji, ocen i gróźb; nie wymyślaj godzin, przyczyn ani kwot, których użytkownik nie podał. Nie podawaj kwot odszkodowania, numeru rachunku ani terminu zapłaty – szablon wstawia je sam. Nie przywołuj przepisów, aktów prawnych ani orzeczeń i pisz neutralnie płciowo.",
    factQuestionIds: [
      "flight_number",
      "flight_date",
      "departure_airport",
      "arrival_airport",
      "incident_type",
      "delay_hours",
      "cancellation_notice",
      "care_provided",
      "extra_costs_amount",
      "extra_costs_description",
      "facts_description",
    ],
  },
  render: ({ answers, ai, today }) => {
    const { count, others } = passengers(answers);
    const email = str(answers, "sender_email", "");
    const phone = str(answers, "sender_phone", "");
    const claim = compensationClaimed(answers);

    const onBehalf = others.length
      ? ` oraz – na podstawie udzielonych mi upoważnień – w imieniu współpasażerów objętych tą samą rezerwacją: ${others.join(", ")}`
      : count > 1
        ? " oraz – na podstawie udzielonych mi upoważnień – w imieniu współpasażerów objętych tą samą rezerwacją"
        : "";

    const paragraphs: Paragraph[] = [
      p(
        claim
          ? `Działając we własnym imieniu${onBehalf}, składam reklamację dotyczącą ${flightLabel(answers)} i wnoszę o wypłatę odszkodowania na podstawie rozporządzenia (WE) nr 261/2004.`
          : `Działając we własnym imieniu${onBehalf}, składam reklamację dotyczącą ${flightLabel(answers).replace(/,$/, "").replace(/r\.$/, "r")}.`,
      ),
    ];

    if (ai?.facts) {
      paragraphs.push(...paragraphsFromText(ai.facts));
      if (ai.justification) paragraphs.push(...paragraphsFromText(ai.justification));
    } else {
      paragraphs.push(...factsParagraphs(answers));
    }

    if (ai?.demand) {
      paragraphs.push(...paragraphsFromText(ai.demand));
      paragraphs.push(p("W szczególności wnoszę o:"));
    } else {
      paragraphs.push(p("W związku z powyższym wnoszę o:"));
    }
    paragraphs.push(list(demandItems(answers)));
    if (claim || bool(answers, "extra_costs")) paragraphs.push(
      p(
        `Należność proszę przelać na rachunek bankowy nr ${str(answers, "iban")} (posiadacz rachunku: ${str(answers, "sender_name")}) w terminie 30 dni od dnia doręczenia niniejszej reklamacji. Nie wyrażam zgody na zaspokojenie roszczenia w formie vouchera ani bonu podróżnego.`,
      ),
    );

    paragraphs.push(heading("Podstawa prawna"));
    paragraphs.push(...legalParagraphs(answers));

    paragraphs.push(heading("Termin odpowiedzi"));
    paragraphs.push(
      p(
        "Proszę o pisemną odpowiedź na reklamację w terminie 30 dni od dnia jej doręczenia. W razie odmowy lub braku odpowiedzi w tym terminie skieruję sprawę do Rzecznika Praw Pasażerów Lotniczych przy Prezesie Urzędu Lotnictwa Cywilnego lub na drogę postępowania sądowego.",
      ),
    );

    const attachments = ["kopia karty pokładowej lub potwierdzenia rezerwacji"];
    if (bool(answers, "extra_costs")) attachments.push("kopie rachunków i faktur za dodatkowe wydatki");
    if (others.length || count > 1) attachments.push("upoważnienia współpasażerów do działania w ich imieniu");

    const booking = str(answers, "booking_reference", BLANK);
    return {
      sender: partyFromAnswers(answers, "sender", [
        email ? `e-mail: ${email}` : "",
        phone ? `tel. ${phone}` : "",
      ]),
      recipient: partyFromAnswers(answers, "recipient"),
      place: str(answers, "sender_city"),
      date: formatDatePl(today),
      title: claim ? "REKLAMACJA I WNIOSEK O WYPŁATĘ ODSZKODOWANIA" : "REKLAMACJA",
      subject: `dot. lotu nr ${str(answers, "flight_number")} z dnia ${formatDatePl(dateAnswer(answers, "flight_date"))} na trasie ${str(answers, "departure_airport")} – ${str(answers, "arrival_airport")}, numer rezerwacji: ${booking}`,
      salutation: "Szanowni Państwo,",
      paragraphs,
      closing: "Z poważaniem",
      signatureName: str(answers, "sender_name"),
      attachments,
      previewParagraphCount: 2,
    };
  },
};
