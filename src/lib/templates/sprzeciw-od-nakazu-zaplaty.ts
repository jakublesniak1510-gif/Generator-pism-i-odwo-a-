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
  tidyParagraph,
  userParagraphs,
} from "./helpers";

/*
 * Sprzeciw od nakazu zapłaty (postępowanie upominawcze, w tym EPU) albo zarzuty od nakazu zapłaty (postępowanie nakazowe).
 * Rozgałęzienia:
 *  - `order_type`: epu (art. 505²⁸–505³⁹ k.p.c.: bez dowodów w załącznikach, umorzenie po sprzeciwie, bez wniosku o koszty),
 *    upominawczy (art. 505 k.p.c.), nakazowy (art. 493 k.p.c. – zarzuty, fakty i dowody; opłata 3/4, konsument max 750 zł),
 *  - zakres zaskarżenia (całość / część – art. 480³ § 2 k.p.c.),
 *  - zarzuty merytoryczne (checkboxy): przedawnienie (art. 117 § 2¹, art. 118 k.c.), legitymacja (art. 509, 513 k.c.),
 *    nieudowodnienie (art. 6 k.c., art. 232 k.p.c.), spłata, brak umowy, zawyżone odsetki/klauzule (art. 481 § 2¹, art. 385¹ k.c.).
 * Termin: 2 tygodnie (upominawcze/EPU) albo miesiąc (nakazowe) od doręczenia – art. 480² § 2 pkt 1 i 3 k.p.c.
 * Przepisy zweryfikowane z tekstami jednolitymi: k.p.c. Dz. U. z 2026 r. poz. 468, k.c. Dz. U. z 2026 r. poz. 795,
 * u.k.s.c. Dz. U. z 2025 r. poz. 1228. Szczegóły: docs/legal-review/sprzeciw-od-nakazu-zaplaty.md
 */

const KPC = "ustawy z dnia 17 listopada 1964 r. – Kodeks postępowania cywilnego (dalej: „k.p.c.”)";
const KC = "ustawy z dnia 23 kwietnia 1964 r. – Kodeks cywilny (dalej: „k.c.”)";
const ISAP_KPC = "https://isap.sejm.gov.pl/isap.nsf/DocDetails.xsp?id=WDU19640430296";
const ISAP_KC = "https://isap.sejm.gov.pl/isap.nsf/DocDetails.xsp?id=WDU19640160093";
const ISAP_UKSC = "https://isap.sejm.gov.pl/isap.nsf/DocDetails.xsp?id=WDU20051671398";

type OrderType = "epu" | "upominawczy" | "nakazowy";

function orderType(answers: Answers): OrderType {
  const v = str(answers, "order_type", "upominawczy");
  return v === "epu" || v === "nakazowy" ? v : "upominawczy";
}

function parseIso(value: Answers[string]): Date | undefined {
  if (typeof value !== "string") return undefined;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!m) return undefined;
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
}

function lines(text: string): string[] {
  return text
    .split(/\r?\n|;/)
    .map((l) => l.replace(/^\s*(?:[-–•*]\s*|\d+[.)]\s+)/, "").replace(/\s+/g, " ").trim())
    .map(trimEnd)
    .filter(Boolean);
}

/** Usuwa końcowe „;” i „,” oraz kropkę – z wyjątkiem kropki skrótu (np. „r.”, „nr.”, „zł.”). */
function trimEnd(text: string): string {
  const t = text.trim().replace(/[;,]+$/, "");
  if (/(?:^|[\s(])(?:r|nr|ul|pkt|ust|art|zł|tel|ok|godz|im|tj|np|in)\.$/i.test(t)) return t;
  return t.replace(/\.+$/, "");
}

function serviceDate(answers: Answers): string {
  return orderType(answers) === "nakazowy" ? str(answers, "service_date_n", "") : str(answers, "service_date", "");
}

/**
 * Koniec 3-letniego terminu przedawnienia (art. 118 k.c.: koniec roku kalendarzowego).
 * Liczymy tylko dla wymagalności od 9.07.2018 r. (dla wcześniejszych – przepisy przejściowe, nie przesądzamy).
 */
function prescriptionEnd(due: Date | undefined): Date | undefined {
  if (!due) return undefined;
  if (due.getTime() < Date.UTC(2018, 6, 9)) return undefined;
  return new Date(Date.UTC(due.getUTCFullYear() + 3, 11, 31));
}

const ORDER_PHRASE: Record<OrderType, string> = {
  epu: "wydanego w elektronicznym postępowaniu upominawczym",
  upominawczy: "wydanego w postępowaniu upominawczym",
  nakazowy: "wydanego w postępowaniu nakazowym",
};

function scopeText(answers: Answers): string {
  if (str(answers, "scope", "whole") === "part") {
    return `w części, tj. co do kwoty ${formatMoneyPl(num(answers, "contested_amount"))} należności głównej wraz z odsetkami i kosztami przypadającymi od tej kwoty`;
  }
  return "w całości";
}

function objectionParagraphs(answers: Answers, today: Date): Paragraph[] {
  const out: Paragraph[] = [];

  if (bool(answers, "obj_prescription")) {
    const due = parseIso(answers.due_date);
    const end = prescriptionEnd(due);
    const todayUtc = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
    const expired = end !== undefined && end.getTime() < todayUtc;
    out.push(heading("Zarzut przedawnienia"));
    out.push(
      p(
        `Podnoszę zarzut przedawnienia roszczenia.${
          due ? ` Roszczenie stało się wymagalne w dniu ${formatDatePl(str(answers, "due_date", ""))}.` : ""
        } Zgodnie z art. 118 ${KC} termin przedawnienia roszczeń związanych z prowadzeniem działalności gospodarczej oraz roszczeń o świadczenia okresowe wynosi trzy lata, a koniec terminu przedawnienia przypada na ostatni dzień roku kalendarzowego.${
          expired && end ? ` Termin ten upłynął z dniem ${formatDatePl(new Date(end.getUTCFullYear(), 11, 31))}.` : ""
        } Zgodnie z art. 117 § 2¹ k.c. po upływie terminu przedawnienia nie można domagać się zaspokojenia roszczenia przysługującego przeciwko konsumentowi. Przelew wierzytelności nie powoduje rozpoczęcia biegu przedawnienia na nowo – nabywca nabywa wierzytelność w takim stanie, w jakim przysługiwała zbywcy.`,
      ),
    );
  }

  if (bool(answers, "obj_standing")) {
    out.push(heading("Brak legitymacji czynnej powoda"));
    out.push(
      p(
        "Kwestionuję legitymację czynną powoda. Strona pozwana nie zawierała z powodem żadnej umowy. Powód nie wykazał, że skutecznie nabył dochodzoną wierzytelność od pierwotnego wierzyciela w drodze przelewu (art. 509 k.c.), w szczególności nie przedstawił umowy przelewu wierzytelności wraz z dokumentem pozwalającym zidentyfikować sporną wierzytelność jako jej przedmiot ani dowodu umocowania osób, które podpisały umowę w imieniu jej stron. Wydruki, zestawienia i oświadczenia sporządzone przez samego powoda nie dowodzą nabycia wierzytelności. Niezależnie od tego stronie pozwanej przysługują przeciwko nabywcy wszelkie zarzuty, które miała przeciwko zbywcy w chwili powzięcia wiadomości o przelewie (art. 513 § 1 k.c.).",
      ),
    );
  }

  if (bool(answers, "obj_no_contract")) {
    out.push(heading("Brak stosunku zobowiązaniowego"));
    out.push(
      p(
        "Strona pozwana nie zawierała umowy, z której powód wywodzi roszczenie, ani nie otrzymała świadczenia (towaru, usługi lub środków pieniężnych), za które dochodzona jest zapłata. Okoliczności te powinny zostać wykazane przez powoda.",
      ),
    );
  }

  if (bool(answers, "obj_unproven")) {
    out.push(heading("Nieudowodnienie roszczenia"));
    out.push(
      p(
        "Powód nie udowodnił roszczenia ani co do zasady, ani co do wysokości. Nie przedstawił umowy, z której wywodzi roszczenie, dokumentów potwierdzających wydanie świadczenia ani wyliczenia dochodzonej kwoty, które pozwalałoby zweryfikować jej poszczególne składniki. Zgodnie z art. 6 k.c. ciężar udowodnienia faktu spoczywa na osobie, która z faktu tego wywodzi skutki prawne, a strony są obowiązane wskazywać dowody dla stwierdzenia faktów, z których wywodzą skutki prawne (art. 232 k.p.c.).",
      ),
    );
  }

  if (bool(answers, "obj_paid")) {
    const details = str(answers, "paid_details", "");
    out.push(heading("Spełnienie świadczenia"));
    out.push(
      p(
        `Dochodzona należność została zapłacona${
          details ? `: ${trimEnd(details)}` : ""
        }. W tym zakresie roszczenie wygasło wskutek spełnienia świadczenia.`,
      ),
    );
  }

  if (bool(answers, "obj_costs")) {
    out.push(heading("Zawyżone odsetki, opłaty i koszty"));
    out.push(
      p(
        "Z ostrożności procesowej kwestionuję wysokość dochodzonych odsetek, opłat i kosztów dodatkowych. Maksymalna wysokość odsetek za opóźnienie nie może w stosunku rocznym przekraczać dwukrotności wysokości odsetek ustawowych za opóźnienie (art. 481 § 2¹ k.c.). Postanowienia umowy zawieranej z konsumentem nieuzgodnione indywidualnie nie wiążą go, jeżeli kształtują jego prawa i obowiązki w sposób sprzeczny z dobrymi obyczajami, rażąco naruszając jego interesy (art. 385¹ § 1 k.c.) – dotyczy to w szczególności rażąco wygórowanych opłat, prowizji i kar umownych naliczanych przez wierzyciela.",
      ),
    );
  }

  return out;
}

export const sprzeciwOdNakazuZaplaty: LetterTemplate = {
  slug: "sprzeciw-od-nakazu-zaplaty",
  name: "Sprzeciw od nakazu zapłaty",
  category: "finanse",
  shortDescription:
    "Sprzeciw od nakazu zapłaty z e-sądu (EPU) lub sądu rejonowego, a także zarzuty od nakazu w postępowaniu nakazowym – z wyborem zarzutów.",
  priceGrosze: 2999,
  icon: "⚖️",
  estimatedMinutes: 10,
  sections: [
    {
      id: "sender",
      title: "Twoje dane (strona pozwana)",
      description: "Dane osoby wskazanej w nakazie jako pozwany. Adres podaj aktualny – na niego sąd będzie wysyłał korespondencję.",
      questions: senderQuestions(),
    },
    {
      id: "recipient",
      title: "Sąd",
      description:
        "Sprzeciw wnosisz do sądu, który wydał nakaz – nazwę wydziału i adres przepisz z nakazu. Nakaz z e-sądu wydaje Sąd Rejonowy Lublin-Zachód w Lublinie, VI Wydział Cywilny.",
      questions: recipientQuestions("Sąd"),
    },
    {
      id: "order",
      title: "Nakaz zapłaty",
      description:
        "Uwaga: termin na sprzeciw liczy się od dnia doręczenia nakazu i jest bardzo krótki. Nie odkładaj wysłania pisma.",
      questions: [
        {
          id: "order_type",
          label: "Jaki nakaz otrzymano?",
          type: "radio",
          help: "Sprawdź nagłówek i pouczenie w nakazie. Sygnatura z „Nc-e” oznacza e-sąd. Jeśli pouczenie mówi o „zarzutach”, to postępowanie nakazowe.",
          options: [
            { value: "epu", label: "Nakaz z e-sądu – elektroniczne postępowanie upominawcze (sygnatura „Nc-e”)" },
            { value: "upominawczy", label: "Nakaz w postępowaniu upominawczym z sądu rejonowego lub okręgowego (pouczenie o sprzeciwie)" },
            { value: "nakazowy", label: "Nakaz w postępowaniu nakazowym (pouczenie o zarzutach, np. z weksla)" },
          ],
        },
        {
          id: "case_number",
          label: "Sygnatura akt",
          type: "text",
          placeholder: "np. VI Nc-e 1234567/26 albo I Nc 456/26",
          help: "Przepisz dokładnie z nakazu – bez niej sąd nie przypisze pisma do sprawy.",
          validate: { maxLength: 60 },
        },
        {
          id: "service_date",
          label: "Data doręczenia nakazu",
          type: "date",
          showIf: { questionId: "order_type", equals: ["epu", "upominawczy"] },
          help: "Dzień odebrania listu z sądu (lub doręczenia przez komornika). Jeśli list nie został odebrany z poczty, ustal datę doręczenia w sądzie – przy doręczeniu zastępczym zasady są złożone.",
        },
        {
          id: "service_date_n",
          label: "Data doręczenia nakazu",
          type: "date",
          showIf: { questionId: "order_type", equals: "nakazowy" },
          help: "Dzień odebrania listu z sądu (lub doręczenia przez komornika).",
        },
        {
          id: "plaintiff",
          label: "Powód – nazwa i adres (jak w nakazie)",
          type: "text",
          placeholder: "np. Fundusz Sekurytyzacyjny XYZ NSFIZ, ul. Przykładowa 1, 00-001 Warszawa",
          help: "Często to fundusz lub firma windykacyjna, która kupiła dług od banku, operatora albo sklepu.",
          validate: { maxLength: 200 },
        },
        {
          id: "amount",
          label: "Kwota należności głównej z nakazu",
          type: "money",
          placeholder: "2450.00",
          help: "Kwota, którą nakaz każe zapłacić (bez odsetek i kosztów).",
        },
        {
          id: "scope",
          label: "Czy zaskarżasz cały nakaz?",
          type: "radio",
          help: "Najczęściej zaskarża się nakaz w całości. W części – gdy np. część długu jest bezsporna.",
          options: [
            { value: "whole", label: "Tak, w całości" },
            { value: "part", label: "Nie, tylko w części" },
          ],
        },
        {
          id: "contested_amount",
          label: "Jaką kwotę zaskarżasz?",
          type: "money",
          placeholder: "1200.00",
          showIf: { questionId: "scope", equals: "part" },
          help: "Kwota należności głównej, którą kwestionujesz.",
        },
      ],
    },
    {
      id: "objections",
      title: "Zarzuty",
      description:
        "Zaznacz wszystkie zarzuty, które pasują do Twojej sprawy – każdy dodamy z uzasadnieniem. Zarzuty, których nie podniesiesz teraz, później mogą zostać pominięte.",
      questions: [
        {
          id: "debt_origin",
          label: "Z czego ma wynikać dług według powoda?",
          type: "text",
          placeholder: "np. umowa pożyczki nr 123/2019 z firmą X; abonament telefoniczny w sieci Y",
          help: "Przepisz z nakazu lub pozwu.",
          validate: { maxLength: 200 },
        },
        {
          id: "obj_prescription",
          label: "Przedawnienie – dług jest stary (zwykle ponad 3 lata od terminu płatności)",
          type: "checkbox",
          required: false,
          help: "Roszczenia firm wobec konsumentów przedawniają się zwykle po 3 latach, z końcem roku kalendarzowego.",
        },
        {
          id: "due_date",
          label: "Kiedy dług stał się wymagalny? (opcjonalnie)",
          type: "date",
          required: false,
          showIf: { questionId: "obj_prescription", equals: "true" },
          help: "Np. termin płatności ostatniej faktury albo data wypowiedzenia umowy pożyczki. Uwaga: wpłata lub uznanie długu mogły przerwać bieg przedawnienia.",
        },
        {
          id: "obj_standing",
          label: "Powód to firma windykacyjna / fundusz i nie wykazał, że kupił dług",
          type: "checkbox",
          required: false,
        },
        {
          id: "obj_unproven",
          label: "Powód nie udowodnił roszczenia (brak umowy, dokumentów, wyliczenia)",
          type: "checkbox",
          required: false,
        },
        {
          id: "obj_paid",
          label: "Dług został spłacony w całości lub w części",
          type: "checkbox",
          required: false,
        },
        {
          id: "paid_details",
          label: "Kiedy i ile zapłacono?",
          type: "text",
          placeholder: "np. 1500 zł przelewem 12.03.2024 r. na rachunek firmy X",
          showIf: { questionId: "obj_paid", equals: "true" },
          validate: { maxLength: 200 },
        },
        {
          id: "obj_no_contract",
          label: "Nie było takiej umowy albo nie otrzymano towaru lub usługi",
          type: "checkbox",
          required: false,
        },
        {
          id: "obj_costs",
          label: "Zawyżone odsetki, opłaty lub kary umowne (niedozwolone postanowienia)",
          type: "checkbox",
          required: false,
        },
        {
          id: "description",
          label: "Twoje stanowisko – opis sprawy",
          type: "textarea",
          placeholder:
            "np. Umowę z operatorem rozwiązano w 2019 r., a wszystkie faktury zostały opłacone. Po rozwiązaniu umowy nie otrzymano żadnego wezwania do zapłaty.",
          help: "Fakty, które przemawiają przeciwko roszczeniu, chronologicznie. Każdą myśl w osobnej linii.",
          validate: { maxLength: 2000 },
        },
        {
          id: "evidence",
          label: "Dowody (opcjonalnie)",
          type: "textarea",
          required: false,
          placeholder: "potwierdzenie przelewu z 12.03.2024 r.\nwypowiedzenie umowy z 5.01.2019 r.\nkorespondencja z operatorem",
          help: "Każdy dowód w osobnej linii. Przy zarzutach w postępowaniu nakazowym wskazanie dowodów jest obowiązkowe. Przy nakazie z e-sądu dowodów nie dołącza się do sprzeciwu – wymienimy je tylko w treści.",
          validate: { maxLength: 1000 },
        },
        {
          id: "fee_waiver",
          label: "Wnoszę o zwolnienie od kosztów sądowych",
          type: "checkbox",
          required: false,
          help: "Gdy nie stać Cię na koszty (np. opłatę od zarzutów). Do wniosku trzeba dołączyć oświadczenie o stanie rodzinnym, majątku i dochodach na urzędowym formularzu.",
        },
      ],
    },
  ],
  legalBasis: [
    {
      act: "Ustawa z dnia 17 listopada 1964 r. – Kodeks postępowania cywilnego",
      article: "art. 480² § 1–2, art. 480³",
      summary:
        "Na sprzeciw od nakazu w postępowaniu upominawczym masz 2 tygodnie od doręczenia, na zarzuty w postępowaniu nakazowym – miesiąc; w piśmie wskazujesz zakres zaskarżenia i zarzuty.",
      url: ISAP_KPC,
    },
    {
      act: "Ustawa z dnia 17 listopada 1964 r. – Kodeks postępowania cywilnego",
      article: "art. 505, art. 505³⁵–505³⁷",
      summary:
        "Sprzeciw powoduje utratę mocy nakazu w zaskarżonej części; w e-sądzie postępowanie zostaje umorzone, a powód może wnieść zwykły pozew w ciągu 3 miesięcy.",
      url: ISAP_KPC,
    },
    {
      act: "Ustawa z dnia 17 listopada 1964 r. – Kodeks postępowania cywilnego",
      article: "art. 493, art. 168–169",
      summary:
        "Zarzuty od nakazu w postępowaniu nakazowym muszą zawierać fakty i dowody; spóźniony termin można przywrócić tylko na wniosek złożony w tydzień od ustania przyczyny, jeśli uchybienie nie było zawinione.",
      url: ISAP_KPC,
    },
    {
      act: "Ustawa z dnia 23 kwietnia 1964 r. – Kodeks cywilny",
      article: "art. 117 § 2¹, art. 118",
      summary:
        "Po upływie przedawnienia nie można żądać zapłaty od konsumenta; roszczenia firm przedawniają się zwykle po 3 latach, z końcem roku kalendarzowego.",
      url: ISAP_KC,
    },
    {
      act: "Ustawa z dnia 23 kwietnia 1964 r. – Kodeks cywilny",
      article: "art. 6, art. 509, art. 513 § 1",
      summary:
        "To powód musi udowodnić roszczenie i nabycie długu; wobec firmy, która kupiła dług, zachowujesz wszystkie zarzuty przysługujące wobec pierwotnego wierzyciela.",
      url: ISAP_KC,
    },
    {
      act: "Ustawa z dnia 28 lipca 2005 r. o kosztach sądowych w sprawach cywilnych",
      article: "art. 19 ust. 4, art. 102",
      summary:
        "Od zarzutów w postępowaniu nakazowym pobiera się 3/4 opłaty (konsument – najwyżej 750 zł); można wnioskować o zwolnienie od kosztów.",
      url: ISAP_UKSC,
    },
  ],
  deadlines: [
    {
      id: "objection_2w",
      label: "Termin na sprzeciw od nakazu (postępowanie upominawcze i e-sąd)",
      fromQuestionId: "service_date",
      days: 14,
      description:
        "Sprzeciw trzeba wnieść w ciągu 2 tygodni od doręczenia nakazu (art. 480² § 2 pkt 1 k.p.c.). Jeśli ostatni dzień wypada w sobotę lub święto, termin upływa w najbliższym dniu roboczym. Liczy się data nadania w placówce Poczty Polskiej (operatora wyznaczonego) albo złożenia w sądzie. Po terminie nakaz się uprawomocni i może trafić do komornika. Spóźniony termin można przywrócić tylko na wniosek, jeśli uchybienie nie było zawinione.",
    },
    {
      id: "pleas_1m",
      label: "Termin na zarzuty od nakazu (postępowanie nakazowe)",
      fromQuestionId: "service_date_n",
      months: 1,
      description:
        "W postępowaniu nakazowym zarzuty wnosi się w ciągu miesiąca od doręczenia nakazu (art. 480² § 2 pkt 3 k.p.c.). Termin oznaczony w otrzymanym nakazie jest wiążący – sprawdź pouczenie. Pamiętaj o opłacie od zarzutów (3/4 opłaty od pozwu, konsument najwyżej 750 zł) albo wniosku o zwolnienie od kosztów.",
    },
  ],
  instructions: {
    whereToSend: `Sprzeciw (zarzuty) wnosisz do **sądu, który wydał nakaz** – nazwę sądu, wydział i adres przepisz z nakazu. Zawsze wpisz **sygnaturę akt**.

- **Nakaz z e-sądu (EPU)**: Sąd Rejonowy Lublin-Zachód w Lublinie, VI Wydział Cywilny – adres do korespondencji sprawdź w pouczeniu dołączonym do nakazu. Sprzeciw możesz wnieść **na papierze** (listownie lub w biurze podawczym) albo elektronicznie przez portal e-sądu. Jeśli wybierzesz drogę elektroniczną, dalsze pisma w tej sprawie musisz wnosić tak samo.
- **Nakaz w postępowaniu upominawczym lub nakazowym**: do wydziału sądu wskazanego w nakazie.`,
    howToSend: `**Najbezpieczniej: list polecony w placówce Poczty Polskiej** (operatora wyznaczonego) – data nadania jest datą wniesienia pisma do sądu. Zachowaj dowód nadania. Możesz też złożyć pismo osobiście w biurze podawczym sądu – poproś o pieczątkę z datą na swojej kopii.

**Wymogi formalne**:
- **własnoręczny podpis** na piśmie (pismo bez podpisu sąd wezwie do uzupełnienia, co wydłuża sprawę),
- **odpis pisma dla powoda** (dodatkowy egzemplarz) – a przy zarzutach i sprzeciwie poza e-sądem także **odpisy załączników** dla powoda,
- w **postępowaniu nakazowym** – **opłata od zarzutów** (3/4 opłaty od pozwu, dla konsumenta najwyżej 750 zł) albo **wniosek o zwolnienie od kosztów** z oświadczeniem o stanie rodzinnym, majątku i dochodach na **urzędowym formularzu**.

Uwaga: **nadanie listu w firmie kurierskiej lub u innego operatora niż Poczta Polska** nie jest równoznaczne z wniesieniem pisma – liczy się dopiero data wpływu do sądu.`,
    afterSending: `**Upominawczy (zwykły)**: nakaz traci moc w zaskarżonej części, a sprawa toczy się dalej przed sądem – możesz dostać wezwanie do złożenia dalszych pism lub zawiadomienie o rozprawie. Odbieraj korespondencję z sądu i pilnuj terminów.

**E-sąd (EPU)**: po skutecznym sprzeciwie sąd umarza postępowanie. Powód może w ciągu 3 miesięcy wnieść zwykły pozew – dostaniesz go wtedy z innego sądu, z nowym terminem na odpowiedź. Przygotuj dowody już teraz.

**Nakazowy**: sąd rozpozna zarzuty i wyda wyrok – utrzyma nakaz w mocy albo go uchyli. Nakaz nadal jest tytułem zabezpieczenia.

**Kiedy iść do prawnika?** Gdy kwota jest wysoka, gdy chodzi o weksel, gdy nakaz doręczono „zastępczo” i termin mógł już minąć albo gdy nie wiesz, czy dług się przedawnił. Bezpłatną pomoc prawną uzyskasz w punktach nieodpłatnej pomocy prawnej w starostwie lub urzędzie miasta.`,
    checklist: [
      "Sprawdź datę doręczenia nakazu i policz termin – 2 tygodnie (upominawczy, e-sąd) albo miesiąc (nakazowy).",
      "Przepisz dokładnie sygnaturę akt, nazwę sądu i dane powoda z nakazu.",
      "Zaznacz wszystkie pasujące zarzuty – później mogą zostać pominięte.",
      "Podpisz pismo własnoręcznie i przygotuj odpis dla powoda (oraz odpisy załączników, poza e-sądem).",
      "Przy zarzutach w postępowaniu nakazowym dołącz dowód opłaty albo wniosek o zwolnienie z oświadczeniem majątkowym.",
      "Nadaj list polecony w placówce Poczty Polskiej i zachowaj dowód nadania.",
    ],
  },
  seo: {
    title: "Sprzeciw od nakazu zapłaty – wzór 2026 (EPU)",
    metaDescription:
      "Wzór sprzeciwu od nakazu zapłaty z e-sądu (EPU) i sądu rejonowego oraz zarzutów od nakazu. Przedawnienie, cesja, spłata – generator z terminami.",
    h1: "Sprzeciw od nakazu zapłaty – wzór pisma z generatorem",
    intro:
      "Przyszedł nakaz zapłaty z e-sądu albo sądu rejonowego, a dług jest nienależny lub przedawniony? Czasu jest mało. Odpowiedz na kilka pytań, wybierz zarzuty – przedawnienie, brak dowodu cesji, spłatę – a przygotujemy sprzeciw (lub zarzuty od nakazu) z właściwymi przepisami i wnioskami. Pismo pobierzesz jako DOCX lub PDF.",
    keywords: [
      "sprzeciw od nakazu zapłaty",
      "sprzeciw od nakazu zapłaty wzór",
      "sprzeciw od nakazu zapłaty epu",
      "sprzeciw od nakazu zapłaty przedawnienie",
      "nakaz zapłaty e-sąd co robić",
      "zarzuty od nakazu zapłaty",
      "sprzeciw od nakazu zapłaty termin",
      "sprzeciw od nakazu zapłaty windykacja",
    ],
    guide: [
      {
        heading: "Najważniejsze: termin – 2 tygodnie od doręczenia",
        body: `**Na sprzeciw od nakazu zapłaty wydanego w postępowaniu upominawczym – także w e-sądzie (EPU) – masz tylko 2 tygodnie od doręczenia nakazu** (art. 480² § 2 pkt 1 k.p.c.). W postępowaniu nakazowym termin na zarzuty wynosi miesiąc (art. 480² § 2 pkt 3). Termin oznaczony w otrzymanym nakazie jest wiążący – przeczytaj pouczenie.

Jeśli termin minie, **nakaz się uprawomocni i ma skutki prawomocnego wyroku** (art. 480² § 4). Wierzyciel może wtedy uzyskać klauzulę wykonalności i skierować sprawę do komornika. Spóźnionego terminu **nie przywraca się automatycznie** – trzeba złożyć wniosek o przywrócenie terminu w ciągu tygodnia od ustania przyczyny i uprawdopodobnić, że uchybienie nie było zawinione (art. 168–169), np. z powodu szpitala. Sam wyjazd czy zapomnienie zwykle nie wystarczą.

Liczy się data **nadania listu w placówce Poczty Polskiej** albo złożenia pisma w sądzie (art. 165 § 2). Jeśli ostatni dzień wypada w sobotę lub święto, termin przesuwa się na następny dzień roboczy.`,
      },
      {
        heading: "Jaki to nakaz: e-sąd, upominawczy czy nakazowy",
        body: `- **E-sąd (EPU)** – nakaz wydaje Sąd Rejonowy Lublin-Zachód w Lublinie, VI Wydział Cywilny; sygnatura zawiera „Nc-e”. Sprzeciw można wnieść **na papierze** albo przez portal e-sądu. Do sprzeciwu **nie dołącza się dowodów** (art. 505³⁵). Po wniesieniu sprzeciwu sąd **umarza postępowanie** (art. 505³⁶), a powód może w ciągu 3 miesięcy złożyć zwykły pozew (art. 505³⁷ § 2). W EPU można dochodzić tylko roszczeń wymagalnych w ciągu 3 lat przed wniesieniem pozwu.
- **Postępowanie upominawcze w zwykłym sądzie** – sprzeciw powoduje, że nakaz traci moc w zaskarżonej części (art. 505 § 2), a sprawa toczy się dalej. Wniesienie sprzeciwu jest co do zasady bez opłaty.
- **Postępowanie nakazowe** (np. z weksla) – wnosi się **zarzuty**, w których trzeba podać fakty i dowody (art. 493 § 2). Od zarzutów pobiera się **3/4 opłaty od pozwu**, przy czym konsument zapłaci najwyżej 750 zł (art. 19 ust. 4 ustawy o kosztach sądowych).`,
      },
      {
        heading: "Jakie zarzuty możesz podnieść",
        body: `- **Przedawnienie** – roszczenia związane z działalnością gospodarczą (banki, firmy pożyczkowe, operatorzy, sklepy) przedawniają się zwykle po **3 latach**, a koniec terminu przypada na **ostatni dzień roku kalendarzowego** (art. 118 k.c.). Po upływie przedawnienia nie można żądać zapłaty od konsumenta (art. 117 § 2¹ k.c.). Uwaga: wpłata, ugoda lub pisemne uznanie długu mogą przerwać bieg przedawnienia.
- **Brak legitymacji powoda** – fundusz lub firma windykacyjna musi udowodnić, że kupiła **ten konkretny dług** (umowa przelewu z załącznikiem identyfikującym wierzytelność). Wobec nabywcy zachowujesz wszystkie zarzuty, które przysługiwały Ci wobec pierwotnego wierzyciela (art. 513 § 1 k.c.).
- **Nieudowodnienie roszczenia** – ciężar dowodu spoczywa na powodzie (art. 6 k.c., art. 232 k.p.c.). Brak umowy, faktur czy wyliczenia to poważny problem dla wierzyciela.
- **Spłata** – całości lub części długu; dołącz lub wskaż potwierdzenia przelewów.
- **Brak umowy lub świadczenia** – np. umowę zawarł ktoś inny na Twoje dane albo nie dostarczono towaru.
- **Zawyżone odsetki i opłaty** – odsetki za opóźnienie nie mogą przekraczać odsetek maksymalnych (art. 481 § 2¹ k.c.), a niedozwolone postanowienia umowne nie wiążą konsumenta (art. 385¹ k.c.).`,
      },
      {
        heading: "Jak napisać sprzeciw – elementy pisma",
        body: `Sprzeciw to pismo procesowe, więc musi spełniać wymogi formalne (art. 126 k.p.c.). Generator dodaje je automatycznie:

1. **oznaczenie sądu** i **sygnaturę akt**,
2. **strony** – powód i strona pozwana z adresami,
3. **nazwę pisma** – „Sprzeciw od nakazu zapłaty” albo „Zarzuty od nakazu zapłaty”,
4. **zakres zaskarżenia** – w całości albo w części (art. 480³ § 2),
5. **wnioski** – o oddalenie powództwa, zobowiązanie powoda do przedstawienia dokumentów, zasądzenie kosztów, ewentualnie zwolnienie od kosztów,
6. **uzasadnienie** – zarzuty, fakty i dowody,
7. **podpis** i **listę załączników**, w tym **odpis dla powoda**.

Zarzuty formalne (np. niewłaściwość sądu) trzeba zgłosić od razu, pod rygorem ich utraty (art. 480³ § 2). Twierdzenia i dowody podawaj jak najwcześniej – spóźnione mogą zostać pominięte.`,
      },
      {
        heading: "Najczęstsze błędy",
        body: `- **Ignorowanie nakazu** – przekonanie, że nieodebrany list „nie obowiązuje”, to mit. Nieodebrany list może zostać uznany za doręczony, a w e-sądzie – jeśli adres zgadza się z rejestrem PESEL (art. 505³⁴ § 1).
- **Spóźnienie** – nawet o jeden dzień. Policz termin od doręczenia i nie zostawiaj wysyłki na ostatni dzień.
- **Wysyłka kurierem** – liczy się dopiero data wpływu do sądu, a nie nadania.
- **Brak podpisu i odpisu dla powoda** – sąd wezwie do uzupełnienia braków, a nieuzupełnione pismo odrzuci (art. 480³ § 3).
- **Zapłata „na wszelki wypadek” części długu** – może zostać uznana za uznanie długu i przerwać bieg przedawnienia.
- **Ogólnikowe pismo** – samo „nie zgadzam się” to w postępowaniu nakazowym za mało. Wskaż fakty i dowody.`,
      },
      {
        heading: "Co dalej po wniesieniu sprzeciwu",
        body: `Po wniesieniu sprzeciwu w zwykłym postępowaniu upominawczym sprawa trafia do „normalnego” trybu: sąd może wyznaczyć rozprawę, zarządzić wymianę pism albo skierować strony do mediacji. W e-sądzie postępowanie zostaje umorzone, a jeśli powód złoży nowy pozew, dostaniesz go z sądu właściwego dla Twojego miejsca zamieszkania – wtedy trzeba będzie złożyć odpowiedź na pozew z dowodami.

Odbieraj korespondencję z sądu, aktualizuj adres i pilnuj terminów. Przy wysokich kwotach, wekslach, sprawach z wieloma wierzytelnościami albo gdy nie wiesz, czy dług się przedawnił, skorzystaj z pomocy adwokata lub radcy prawnego – bezpłatne porady oferują punkty nieodpłatnej pomocy prawnej w powiatach i miastach.`,
      },
    ],
    faq: [
      {
        question: "Ile mam czasu na sprzeciw od nakazu zapłaty?",
        answer:
          "Od nakazu w postępowaniu upominawczym, także z e-sądu, 2 tygodnie od doręczenia. Od nakazu w postępowaniu nakazowym (zarzuty) – miesiąc. Termin oznaczony w nakazie jest wiążący. Liczy się data nadania w placówce Poczty Polskiej albo złożenia w sądzie.",
      },
      {
        question: "Czy sprzeciw od nakazu zapłaty jest płatny?",
        answer:
          "Sprzeciw w postępowaniu upominawczym, w tym w e-sądzie, co do zasady nie wymaga opłaty. Od zarzutów w postępowaniu nakazowym pobiera się 3/4 opłaty od pozwu, przy czym konsument zapłaci najwyżej 750 zł. Można wnioskować o zwolnienie od kosztów.",
      },
      {
        question: "Czy sprzeciw z e-sądu można wysłać na papierze?",
        answer:
          "Tak. Sprzeciw od nakazu z elektronicznego postępowania upominawczego można wnieść na papierze do Sądu Rejonowego Lublin-Zachód w Lublinie (VI Wydział Cywilny) albo przez portal e-sądu. Jeśli wybierzesz drogę elektroniczną, dalsze pisma w tej sprawie musisz wnosić tak samo.",
      },
      {
        question: "Co się stanie, jeśli nie wniosę sprzeciwu?",
        answer:
          "Po upływie terminu nakaz zapłaty ma skutki prawomocnego wyroku. Wierzyciel może uzyskać klauzulę wykonalności i skierować sprawę do komornika – z odsetkami i kosztami. Spóźniony termin można przywrócić tylko na wniosek, jeśli uchybienie nie było zawinione.",
      },
      {
        question: "Czy przedawnienie działa automatycznie?",
        answer:
          "Wobec konsumenta po upływie terminu przedawnienia nie można żądać zaspokojenia roszczenia (art. 117 § 2¹ k.c.). Mimo to warto wyraźnie podnieść zarzut przedawnienia w sprzeciwie i wskazać daty – sąd musi mieć dane, by to ocenić.",
      },
      {
        question: "Firma windykacyjna kupiła mój dług – czy może mnie pozwać?",
        answer:
          "Może, ale musi udowodnić, że skutecznie nabyła właśnie ten dług – umową przelewu z dokumentem identyfikującym wierzytelność. Wobec nabywcy masz te same zarzuty, co wobec pierwotnego wierzyciela, w tym zarzut przedawnienia.",
      },
      {
        question: "Czy muszę dołączyć dowody do sprzeciwu?",
        answer:
          "W e-sądzie dowodów nie dołącza się do sprzeciwu – wystarczy je wymienić. W postępowaniu nakazowym zarzuty muszą zawierać fakty i dowody. W zwykłym postępowaniu upominawczym warto od razu wskazać i dołączyć dowody, bo spóźnione twierdzenia mogą zostać pominięte.",
      },
      {
        question: "Kiedy warto iść do prawnika?",
        answer:
          "Gdy kwota jest wysoka, gdy nakaz wydano na podstawie weksla, gdy termin mógł już minąć (np. przy doręczeniu zastępczym) albo gdy nie wiesz, jak policzyć przedawnienie. Bezpłatną pomoc uzyskasz w punktach nieodpłatnej pomocy prawnej.",
      },
    ],
  },
  ai: {
    context:
      "Sprzeciw od nakazu zapłaty (lub zarzuty od nakazu w postępowaniu nakazowym) wnoszony przez osobę fizyczną – stronę pozwaną. Opis faktów ma rzeczowo i chronologicznie przedstawić stanowisko strony pozwanej wobec roszczenia: skąd według powoda wynika dług, czy strona pozwana zawierała umowę z powodem lub pierwotnym wierzycielem, czy i kiedy dokonywała wpłat, kiedy dług miał stać się wymagalny, czy otrzymywała wezwania lub zawiadomienie o przelewie, jakie ma dowody. Pisz w stylu pisma procesowego, w pierwszej osobie lub w trzeciej osobie („strona pozwana”), w czasie teraźniejszym lub stronie biernej, bez form zależnych od płci. Niczego nie dodawaj ponad odpowiedzi użytkownika. Żądanie: oddalenie powództwa w zakresie zaskarżenia. Nie powołuj przepisów, terminów ani orzeczeń – szablon dodaje je sam.",
    factQuestionIds: [
      "order_type",
      "amount",
      "scope",
      "contested_amount",
      "debt_origin",
      "obj_prescription",
      "due_date",
      "obj_standing",
      "obj_unproven",
      "obj_paid",
      "paid_details",
      "obj_no_contract",
      "obj_costs",
      "description",
      "evidence",
    ],
  },
  render: ({ answers, ai, today }) => {
    const type = orderType(answers);
    const isPleas = type === "nakazowy";
    const pleaWord = isPleas ? "zarzuty" : "sprzeciw";
    const email = str(answers, "sender_email", "");
    const phone = str(answers, "sender_phone", "");
    const caseNo = str(answers, "case_number");
    const sender = partyFromAnswers(answers, "sender");
    const partial = str(answers, "scope", "whole") === "part";
    const contested = partial ? num(answers, "contested_amount") : num(answers, "amount");
    const evidence = lines(str(answers, "evidence", ""));
    const waiver = bool(answers, "fee_waiver");

    const paragraphs: Paragraph[] = [
      p(
        `Powód: ${str(answers, "plaintiff")}. Strona pozwana: ${sender.name}, ${sender.addressLines.join(
          ", ",
        )}. Wartość przedmiotu zaskarżenia: ${formatMoneyPl(contested)}.`,
      ),
      p(
        `Działając jako strona pozwana, wnoszę ${pleaWord} od nakazu zapłaty ${ORDER_PHRASE[type]} w sprawie o sygn. akt ${caseNo}, doręczonego w dniu ${formatDatePl(
          serviceDate(answers),
        )}, i zaskarżam ten nakaz ${scopeText(answers)}.`,
      ),
    ];

    const requests: string[] = [];
    const zakres = partial ? "w zaskarżonej części" : "w całości";
    if (isPleas) {
      requests.push(`uchylenie nakazu zapłaty ${zakres} i oddalenie powództwa ${partial ? "w tym zakresie" : "w całości"}`);
    } else {
      requests.push(`oddalenie powództwa ${zakres}`);
    }
    if (bool(answers, "obj_standing") || bool(answers, "obj_unproven") || bool(answers, "obj_no_contract")) {
      requests.push(
        `zobowiązanie powoda do przedłożenia dokumentów, z których wywodzi roszczenie – w szczególności umowy zawartej ze stroną pozwaną i szczegółowego wyliczenia dochodzonej kwoty${
          bool(answers, "obj_standing")
            ? ", a także umowy przelewu wierzytelności wraz z załącznikiem identyfikującym dochodzoną wierzytelność oraz dokumentów potwierdzających umocowanie osób, które tę umowę podpisały"
            : ""
        } – oraz doręczenie stronie pozwanej odpisów tych dokumentów`,
      );
    }
    if (type !== "epu" && evidence.length) requests.push("przeprowadzenie dowodów wskazanych w uzasadnieniu");
    if (type !== "epu") requests.push("zasądzenie od powoda na rzecz strony pozwanej zwrotu kosztów procesu");
    if (waiver) {
      requests.push(
        isPleas
          ? "zwolnienie strony pozwanej od opłaty od zarzutów oraz od kosztów sądowych w całości – oświadczenie o stanie rodzinnym, majątku, dochodach i źródłach utrzymania załączam"
          : "zwolnienie strony pozwanej od kosztów sądowych w całości – oświadczenie o stanie rodzinnym, majątku, dochodach i źródłach utrzymania załączam",
      );
    }
    paragraphs.push(p("Wnoszę o:"));
    paragraphs.push(list(requests));

    paragraphs.push(heading("Uzasadnienie"));
    paragraphs.push(
      p(
        `Powód dochodzi od strony pozwanej zapłaty kwoty ${formatMoneyPl(num(answers, "amount"))}. Jako podstawę roszczenia wskazuje: ${trimEnd(
          str(answers, "debt_origin"),
        )}. Roszczenie to kwestionuję${
          partial ? " w zaskarżonej części" : " co do zasady i co do wysokości"
        }. Zaprzeczam wszelkim twierdzeniom powoda, których wyraźnie nie przyznaję.`,
      ),
    );

    if (ai?.facts) {
      paragraphs.push(...paragraphsFromText(ai.facts));
      paragraphs.push(...paragraphsFromText(ai.justification));
    } else {
      userParagraphs(str(answers, "description", "")).forEach((t) => paragraphs.push(p(t)));
    }

    paragraphs.push(...objectionParagraphs(answers, today));

    if (evidence.length) {
      paragraphs.push(heading("Dowody"));
      paragraphs.push(
        p(
          type === "epu"
            ? "Na poparcie powyższych twierdzeń wskazuję następujące dowody, które zostaną przedstawione w dalszym postępowaniu (zgodnie z art. 505³⁵ k.p.c. do sprzeciwu w elektronicznym postępowaniu upominawczym nie dołącza się dowodów):"
            : "Na poparcie powyższych twierdzeń wnoszę o przeprowadzenie dowodów z następujących dokumentów, załączonych do niniejszego pisma:",
        ),
      );
      paragraphs.push(list(evidence));
    }

    // Wnioski procesowe są stałe (lista „Wnoszę o”), dlatego `ai.demand` nie jest tu wstawiane.
    paragraphs.push(heading("Podstawa prawna"));
    if (isPleas) {
      paragraphs.push(
        p(
          `Zarzuty wnoszę na podstawie art. 493 § 1 ${KPC}, w terminie określonym w art. 480² § 2 pkt 3 k.p.c. Zgodnie z art. 480³ § 2 i art. 493 § 2 k.p.c. wskazuję zakres zaskarżenia oraz fakty i dowody, na których opieram swoje stanowisko.`,
        ),
      );
    } else {
      paragraphs.push(
        p(
          `Sprzeciw wnoszę na podstawie art. 505 § 1 ${KPC}, w terminie określonym w art. 480² § 2 pkt 1 k.p.c. Zgodnie z art. 505 § 2 k.p.c. nakaz zapłaty traci moc w części zaskarżonej sprzeciwem.${
            type === "epu"
              ? " W elektronicznym postępowaniu upominawczym w przypadku wniesienia sprzeciwu sąd umarza postępowanie w zakresie, w którym nakaz zapłaty utracił moc (art. 505³⁶ k.p.c.)."
              : ""
          }`,
        ),
      );
    }
    paragraphs.push(
      p(
        `Mając powyższe na uwadze, wnoszę jak na wstępie.${
          email || phone
            ? ` Dane kontaktowe strony pozwanej: ${[email ? `e-mail: ${email}` : "", phone ? `tel. ${phone}` : ""]
                .filter(Boolean)
                .join(", ")}.`
            : ""
        }`,
      ),
    );

    const attachments: string[] = [`Odpis ${isPleas ? "zarzutów" : "sprzeciwu"} dla powoda`];
    if (type !== "epu") {
      evidence.forEach((e) => attachments.push(`Kopia dowodu: ${e}`));
      if (evidence.length) attachments.push("Odpisy załączników dla powoda");
    }
    if (waiver) attachments.push("Oświadczenie o stanie rodzinnym, majątku, dochodach i źródłach utrzymania");
    if (isPleas && !waiver) attachments.push("Dowód uiszczenia opłaty od zarzutów");

    return {
      sender: { ...sender, extra: [email ? `e-mail: ${email}` : "", phone ? `tel. ${phone}` : ""].filter(Boolean) },
      recipient: partyFromAnswers(answers, "recipient"),
      place: str(answers, "sender_city"),
      date: formatDatePl(today),
      title: isPleas ? "ZARZUTY OD NAKAZU ZAPŁATY" : "SPRZECIW OD NAKAZU ZAPŁATY",
      subject: `Sygn. akt: ${caseNo}`,
      paragraphs: paragraphs.map(tidyParagraph),
      closing: "Strona pozwana",
      signatureName: str(answers, "sender_name"),
      attachments,
      previewParagraphCount: 2,
    };
  },
};
