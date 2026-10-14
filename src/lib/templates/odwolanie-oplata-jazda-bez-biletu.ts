import type { Answers, LetterTemplate, Paragraph } from "./types";
import {
  bool,
  formatDatePl,
  formatMoneyPl,
  num,
  p,
  partyFromAnswers,
  paragraphsFromText,
  recipientQuestions,
  senderQuestions,
  str,
} from "./helpers";

/*
 * Reklamacja wezwania do zapłaty opłaty dodatkowej za przejazd bez ważnego biletu
 * (komunikacja miejska, kolej, autobus) albo wniosek o rozłożenie należności na raty.
 * Podstawa: Prawo przewozowe (t.j. Dz. U. z 2024 r. poz. 1262 – zweryfikowano art. 33a, 75, 77)
 * i rozporządzenie MTiB z 24.02.2006 r. (Dz. U. Nr 38, poz. 266, zm. Dz. U. z 2017 r. poz. 2406 – zweryfikowano § 6, 7, 9, 10).
 * Szczegóły: docs/legal-review/odwolanie-oplata-jazda-bez-biletu.md
 */

const PP = "ustawy z dnia 15 listopada 1984 r. – Prawo przewozowe";
const ROZP =
  "rozporządzenia Ministra Transportu i Budownictwa z dnia 24 lutego 2006 r. w sprawie ustalania stanu przesyłek oraz postępowania reklamacyjnego";
const ISAP_PP = "https://isap.sejm.gov.pl/isap.nsf/DocDetails.xsp?id=WDU19840530272";
const ISAP_ROZP = "https://isap.sejm.gov.pl/isap.nsf/DocDetails.xsp?id=WDU20060380266";
const DAY_MS = 24 * 60 * 60 * 1000;

type MainArgument =
  | "valid_ticket"
  | "discount"
  | "app_or_machine"
  | "controller_no_id"
  | "notice_errors"
  | "not_me"
  | "installments_only";

const MAIN_ARGUMENTS: MainArgument[] = [
  "valid_ticket",
  "discount",
  "app_or_machine",
  "controller_no_id",
  "notice_errors",
  "not_me",
  "installments_only",
];

function sentence(text: string): string {
  const t = text.trim().replace(/[ \t]+/g, " ");
  if (!t) return t;
  const capital = t.charAt(0).toUpperCase() + t.slice(1);
  return /[.!?…:]$/.test(capital) ? capital : `${capital}.`;
}

function userParagraphs(text: string): string[] {
  return text
    .split(/\n+/)
    .map((t) => sentence(t))
    .filter(Boolean);
}

function tidy(text: string): string {
  return text
    .replace(/\.{2,}/g, (m) => (m.length === 2 ? "." : m))
    .replace(/[ \t]{2,}/g, " ")
    .replace(/ +([,.;:])/g, "$1")
    .trim();
}

function tidyParagraph(par: Paragraph): Paragraph {
  if (par.type === "list") return { type: "list", items: par.items.map(tidy) };
  return { ...par, text: tidy(par.text) };
}

function attachmentsFromText(text: string): string[] {
  return text
    .split(/[;\n]+/)
    .map((t) => t.trim().replace(/[.;,]+$/, ""))
    .filter(Boolean)
    .map((t) => t.charAt(0).toUpperCase() + t.slice(1));
}

function inParens(text: string): string {
  const t = text.trim().replace(/[.\s]+$/, "");
  return t ? ` (${t})` : "";
}

function parseIso(value: Answers[string]): Date | undefined {
  if (typeof value !== "string") return undefined;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!m) return undefined;
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
}

/** „3 miesięcznych rat” / „2 miesięczne raty” / „5 miesięcznych rat” */
function installmentsPhrase(n: number | undefined): string {
  if (!n || n < 2) return "miesięczne raty";
  const lastTwo = n % 100;
  const last = n % 10;
  const few = last >= 2 && last <= 4 && (lastTwo < 12 || lastTwo > 14);
  return few ? `${n} miesięczne raty` : `${n} miesięcznych rat`;
}

export const odwolanieJazdaBezBiletu: LetterTemplate = {
  slug: "odwolanie-oplata-jazda-bez-biletu",
  name: "Odwołanie od opłaty za jazdę bez biletu",
  category: "transport",
  shortDescription:
    "Reklamacja wezwania do zapłaty od kontrolera biletów – gdy miałeś bilet lub ulgę, zawiódł kasownik albo to nie Ty jechałeś.",
  priceGrosze: 2499,
  icon: "🎫",
  estimatedMinutes: 6,
  sections: [
    {
      id: "sender",
      title: "Twoje dane",
      description: "Podaj dane, które widnieją na wezwaniu do zapłaty.",
      questions: senderQuestions(),
    },
    {
      id: "recipient",
      title: "Przewoźnik lub organizator transportu",
      description:
        "Adres jednostki przyjmującej reklamacje znajdziesz w pouczeniu na wezwaniu do zapłaty. W komunikacji miejskiej jest to często zarząd transportu miejskiego, a nie sam przewoźnik.",
      questions: recipientQuestions("Przewoźnik / organizator"),
    },
    {
      id: "notice",
      title: "Wezwanie do zapłaty",
      questions: [
        {
          id: "notice_number",
          label: "Numer (seria) wezwania do zapłaty",
          type: "text",
          placeholder: "np. ZTM/K/2026/123456",
        },
        {
          id: "control_date",
          label: "Data kontroli (przejazdu)",
          type: "date",
          help: "Od tej daty liczy się 7 dni na okazanie biletu lub dokumentu ulgi.",
        },
        {
          id: "route",
          label: "Linia, kurs lub relacja",
          type: "text",
          placeholder: "np. tramwaj linii 17, przystanek Rondo ONZ; pociąg nr 12345 Kraków – Tarnów",
        },
        {
          id: "fee_amount",
          label: "Opłata dodatkowa z wezwania",
          type: "money",
          placeholder: "266.00",
        },
        {
          id: "fare_amount",
          label: "Należność za przejazd (cena biletu) z wezwania",
          type: "money",
          required: false,
          placeholder: "4.40",
        },
      ],
    },
    {
      id: "facts",
      title: "Co się stało",
      questions: [
        {
          id: "situation_description",
          label: "Opisz przebieg kontroli",
          type: "textarea",
          placeholder:
            "np. Mam imienny bilet miesięczny ważny od 1 do 31 października, ale w dniu kontroli zostawiłem kartę miejską w domu. Kontroler wystawił wezwanie do zapłaty. Następnego dnia sprawdziłem, że bilet był aktywny.",
          help: "Napisz, co się wydarzyło, jakie dokumenty miałeś i co powiedział kontroler. Trzymaj się faktów.",
          validate: { maxLength: 2000 },
        },
      ],
    },
    {
      id: "arguments",
      title: "Argument, żądanie i załączniki",
      questions: [
        {
          id: "main_argument",
          label: "Na czym opierasz reklamację?",
          type: "radio",
          options: [
            { value: "valid_ticket", label: "Miałem ważny bilet (np. okresowy, imienny), ale nie przy sobie" },
            { value: "discount", label: "Miałem prawo do ulgi lub bezpłatnego przejazdu, ale nie miałem dokumentu" },
            { value: "app_or_machine", label: "Bilet kupiony w aplikacji / awaria kasownika lub biletomatu" },
            { value: "controller_no_id", label: "Kontroler nie okazał identyfikatora" },
            { value: "notice_errors", label: "Wezwanie zawiera błędy lub braki" },
            { value: "not_me", label: "To nie ja byłem kontrolowany – ktoś podał moje dane" },
            { value: "installments_only", label: "Nie kwestionuję opłaty – chcę tylko rozłożyć ją na raty" },
          ],
        },
        {
          id: "document_details",
          label: "Dane biletu, dokumentu ulgi lub transakcji",
          type: "text",
          placeholder: "np. bilet miesięczny imienny nr 123456 na karcie miejskiej, ważny 1–31.10.2026",
          help: "Podaj numer, rodzaj i okres ważności dokumentu albo numer i godzinę transakcji w aplikacji.",
          showIf: { questionId: "main_argument", equals: ["valid_ticket", "discount", "app_or_machine"] },
          validate: { maxLength: 300 },
        },
        {
          id: "installments",
          label: "Czy wnosisz o rozłożenie należności na raty?",
          type: "radio",
          help: "Przy reklamacji możesz z ostrożności poprosić o raty na wypadek jej odrzucenia. Przewoźnik nie ma obowiązku się zgodzić.",
          options: [
            { value: "no", label: "Nie" },
            { value: "yes", label: "Tak" },
          ],
        },
        {
          id: "installments_count",
          label: "Na ile miesięcznych rat?",
          type: "number",
          placeholder: "3",
          showIf: { questionId: "installments", equals: "yes" },
          validate: { min: 2, max: 12 },
        },
        {
          id: "att_notice",
          label: "Załączam kopię wezwania do zapłaty",
          type: "checkbox",
          required: false,
        },
        {
          id: "att_document",
          label: "Załączam kopię biletu, dokumentu ulgi lub potwierdzenia transakcji",
          type: "checkbox",
          required: false,
        },
        {
          id: "evidence_list",
          label: "Inne dowody (opcjonalnie)",
          type: "text",
          required: false,
          placeholder: "np. zgłoszenie awarii kasownika do przewoźnika; zaświadczenie z pracy o miejscu pobytu",
          help: "Kilka pozycji oddziel średnikami.",
        },
      ],
    },
  ],
  legalBasis: [
    {
      act: "Ustawa z dnia 15 listopada 1984 r. – Prawo przewozowe",
      article: "art. 33a ust. 1–3",
      summary:
        "Kontroler musi legitymować się widocznym identyfikatorem; przy braku biletu pobiera należność i opłatę dodatkową albo wystawia wezwanie do zapłaty.",
      url: ISAP_PP,
    },
    {
      act: "Ustawa z dnia 15 listopada 1984 r. – Prawo przewozowe",
      article: "art. 33a ust. 4–5",
      summary:
        "Okazanie w ciągu 7 dni od przewozu ważnego biletu lub dokumentu ulgi prowadzi do umorzenia należności – za opłatą manipulacyjną.",
      url: ISAP_PP,
    },
    {
      act: "Rozporządzenie Ministra Transportu i Budownictwa z dnia 24 lutego 2006 r. w sprawie ustalania stanu przesyłek oraz postępowania reklamacyjnego",
      article: "§ 6 ust. 1, § 9 ust. 1, § 10",
      summary:
        "Reklamację wezwania składa się w 3 miesiące; przewoźnik odpowiada w 30 dni, a brak odpowiedzi oznacza uwzględnienie reklamacji.",
      url: ISAP_ROZP,
    },
    {
      act: "Ustawa z dnia 15 listopada 1984 r. – Prawo przewozowe",
      article: "art. 75 ust. 1–2",
      summary:
        "Przewoźnik może dochodzić należności w sądzie dopiero po bezskutecznym wezwaniu do zapłaty.",
      url: ISAP_PP,
    },
    {
      act: "Ustawa z dnia 15 listopada 1984 r. – Prawo przewozowe",
      article: "art. 77 ust. 1 i 4",
      summary:
        "Roszczenia z prawa przewozowego przedawniają się z upływem roku; bieg przedawnienia zawiesza się na czas reklamacji.",
      url: ISAP_PP,
    },
  ],
  deadlines: [
    {
      id: "document_7days",
      label: "Termin na okazanie biletu lub dokumentu ulgi",
      fromQuestionId: "control_date",
      days: 7,
      description:
        "Jeśli miałeś ważny bilet lub uprawnienie do ulgi, ale nie przy sobie, udokumentuj to przewoźnikowi nie później niż w terminie 7 dni od dnia przewozu – wtedy opłata dodatkowa ulega umorzeniu za opłatą manipulacyjną (art. 33a ust. 4 i 5 Prawa przewozowego). Regulamin przewoźnika może przewidywać korzystniejsze zasady.",
    },
    {
      id: "complaint_3months",
      label: "Termin na reklamację wezwania do zapłaty",
      fromQuestionId: "control_date",
      months: 3,
      description:
        "Reklamację dotyczącą wezwania do zapłaty składa się nie później niż w terminie 3 miesięcy od dnia otrzymania wezwania (§ 9 ust. 1 rozporządzenia z 24 lutego 2006 r.). Jeśli wezwanie dostałeś pocztą, termin liczy się od jego doręczenia. Pamiętaj też o terminie zapłaty z wezwania.",
    },
  ],
  instructions: {
    whereToSend: `Reklamację składasz w jednostce wskazanej w **pouczeniu na wezwaniu do zapłaty** – przepisy wymagają, aby wezwanie zawierało adres jednostki przyjmującej reklamacje oraz dopuszczalne formy ich składania. W komunikacji miejskiej jest to zwykle **zarząd transportu miejskiego** (organizator), a na kolei – **dział reklamacji przewoźnika**.

Jeżeli zgubiłeś wezwanie, adres znajdziesz na stronie internetowej przewoźnika lub organizatora (zakładka „Opłaty dodatkowe” lub „Reklamacje”) albo w regulaminie przewozu.`,
    howToSend: `Reklamację możesz złożyć:
- **pisemnie** – listem poleconym za potwierdzeniem odbioru albo osobiście w punkcie obsługi (poproś o potwierdzenie przyjęcia na kopii),
- **ustnie do protokołu** – jeśli przewoźnik przewiduje taką formę,
- **elektronicznie** – e-mailem lub przez formularz, jeśli przewoźnik wskazał taki kanał.

Jeżeli chcesz skorzystać z umorzenia po okazaniu biletu lub dokumentu ulgi, zrób to jak najszybciej – **w ciągu 7 dni od przejazdu**. Wiele przewoźników przyjmuje dokumenty osobiście w punkcie obsługi pasażera.`,
    afterSending: `Przewoźnik ma **30 dni od wpływu reklamacji** na odpowiedź. **Brak odpowiedzi w tym terminie oznacza uwzględnienie reklamacji** (§ 10 rozporządzenia). Do odpowiedzi odmownej przewoźnik powinien dołączyć uzasadnienie z podstawą prawną i pouczenie o możliwości odwołania.

Jeśli reklamacja zostanie odrzucona:
- złóż **odwołanie do przewoźnika** – może on zmienić rozstrzygnięcie w ciągu 14 dni,
- przy przewozach kolejowych zwróć się do **Rzecznika Praw Pasażerów Kolei** przy Prezesie UTK,
- w komunikacji miejskiej skontaktuj się z **miejskim rzecznikiem konsumentów**,
- jeśli przewoźnik pozwie Cię do sądu – pilnuj terminów; od nakazu zapłaty przysługuje **sprzeciw w 14 dni**.`,
    checklist: [
      "Sprawdź datę kontroli – na okazanie biletu lub dokumentu ulgi masz 7 dni.",
      "Dołącz kopię wezwania i kopię biletu, dokumentu ulgi lub potwierdzenia transakcji.",
      "Upewnij się, że numer wezwania i dane osobowe są wpisane dokładnie tak jak na wezwaniu.",
      "Złóż reklamację w jednostce wskazanej w pouczeniu – za potwierdzeniem odbioru.",
      "Zapisz w kalendarzu 30 dni na odpowiedź przewoźnika.",
    ],
  },
  seo: {
    title: "Odwołanie od mandatu za brak biletu – wzór 2026",
    metaDescription:
      "Wzór reklamacji opłaty dodatkowej za jazdę bez biletu (ZTM, MPK, PKP). Bilet w domu, ulga, awaria kasownika, raty. Generator pisma z przepisami.",
    h1: "Odwołanie od opłaty dodatkowej za jazdę bez biletu – wzór reklamacji",
    intro:
      "Dostałeś od kontrolera wezwanie do zapłaty, choć miałeś bilet okresowy w domu, prawo do ulgi albo kasownik nie działał? Złóż reklamację – przewoźnik ma 30 dni na odpowiedź, a jego milczenie oznacza uwzględnienie reklamacji. Wypełnij formularz, a przygotujemy pismo z właściwymi przepisami.",
    keywords: [
      "odwołanie od mandatu za brak biletu",
      "reklamacja opłaty dodatkowej wzór",
      "jazda bez biletu odwołanie",
      "zapomniałem biletu miesięcznego co zrobić",
      "anulowanie opłaty dodatkowej ZTM",
      "reklamacja wezwania do zapłaty PKP",
      "opłata dodatkowa brak legitymacji",
      "rozłożenie mandatu za bilet na raty",
    ],
    guide: [
      {
        heading: "Opłata dodatkowa to nie mandat",
        body: `Potocznie mówi się o „mandacie za jazdę bez biletu”, ale z prawnego punktu widzenia to **opłata dodatkowa**, czyli cywilnoprawne roszczenie przewoźnika wynikające z umowy przewozu. Zgodnie z art. 33a ust. 3 Prawa przewozowego, gdy kontroler stwierdzi brak odpowiedniego dokumentu przewozu, pobiera należność za przejazd i opłatę dodatkową albo wystawia **wezwanie do zapłaty**. Sposób ustalania wysokości opłat dodatkowych i opłaty manipulacyjnej określa rozporządzenie ministra, a w gminnym, powiatowym i wojewódzkim regularnym przewozie osób – odpowiednio rada gminy, rada powiatu albo sejmik województwa (art. 34a). Dlatego w komunikacji miejskiej stawki znajdziesz w uchwale rady miasta, a na kolei – w regulaminie przewoźnika. Opłata za brak biletu jest zwykle wyższa niż za brak dokumentu uprawniającego do ulgi.

Skoro to roszczenie cywilne, przysługuje Ci **reklamacja** na zasadach z rozporządzenia z 24 lutego 2006 r. w sprawie ustalania stanu przesyłek oraz postępowania reklamacyjnego. Przewoźnik nie może samodzielnie ściągnąć pieniędzy – potrzebuje wyroku lub nakazu zapłaty sądu.`,
      },
      {
        heading: "Zapomniałeś biletu lub legitymacji? Masz 7 dni",
        body: `Jeżeli miałeś **ważny bilet**, ale nie miałeś go przy sobie, albo przysługiwała Ci **ulga lub przejazd bezpłatny**, ale nie miałeś dokumentu (legitymacji studenckiej, szkolnej, emeryta), możesz doprowadzić do umorzenia opłaty. Należność i opłata dodatkowa podlegają umorzeniu, jeśli **nie później niż w terminie 7 dni od dnia przewozu** udokumentujesz swoje uprawnienie (art. 33a ust. 4 i 5 Prawa przewozowego). Przewoźnik pobiera wtedy jedynie **opłatę manipulacyjną** – zwykle kilkanaście lub kilkadziesiąt złotych.

W praktyce regulaminy przewoźników ograniczają tę możliwość do **biletów imiennych** (np. miesięcznego na karcie miejskiej), bo przy bilecie na okaziciela nie da się wykazać, że należał do Ciebie. Nie zwlekaj – po upływie 7 dni ta droga się zamyka i pozostaje zwykła reklamacja.`,
      },
      {
        heading: "Reklamacja krok po kroku",
        body: `1. **Sprawdź wezwanie** – numer, datę, linię, kwoty i Twoje dane.
2. **Zbierz dowody** – kopię biletu, legitymacji, potwierdzenie transakcji z aplikacji, zdjęcie niedziałającego kasownika, zgłoszenie awarii.
3. **Wypełnij generator** – wybierz argument i opisz przebieg kontroli.
4. **Złóż reklamację** w jednostce wskazanej w pouczeniu na wezwaniu – pisemnie, ustnie do protokołu albo elektronicznie, jeśli przewoźnik przewiduje taką formę. Masz na to **3 miesiące** od otrzymania wezwania (§ 9 ust. 1 rozporządzenia).
5. **Czekaj na odpowiedź** – przewoźnik ma **30 dni** od wpływu reklamacji (§ 6 ust. 1). Jeśli nie odpowie, reklamacja jest **uwzględniona** (§ 10).
6. **Przy odmowie** – złóż odwołanie do przewoźnika; może on zmienić rozstrzygnięcie w ciągu 14 dni (§ 11).`,
      },
      {
        heading: "Kontrola biletów – prawa i obowiązki",
        body: `Kontroler musi **legitymować się identyfikatorem umieszczonym w widocznym miejscu** (art. 33a ust. 1). Identyfikator powinien zawierać m.in. nazwę przewoźnika, numer identyfikacyjny i zdjęcie kontrolującego, zakres upoważnienia i okres ważności (art. 33a ust. 2). Masz prawo poprosić o jego okazanie i zapisać numer kontrolera.

Jeśli odmówisz zapłaty na miejscu, kontroler może zażądać **dokumentu tożsamości**, a gdy go nie okażesz – ująć Cię i przekazać policji lub innym organom porządkowym (art. 33a ust. 7). Dlatego nie warto uciekać ani odmawiać podania danych – spór lepiej rozstrzygnąć w reklamacji.

Wezwanie do zapłaty powinno zawierać m.in. datę i relację przejazdu, miejsce kontroli, wysokość należności z podziałem na opłatę za przejazd i opłatę dodatkową, termin zapłaty, pouczenie o reklamacji oraz dane Twojego dokumentu tożsamości (§ 7 ust. 2 rozporządzenia).`,
      },
      {
        heading: "Przedawnienie i raty",
        body: `Roszczenia dochodzone na podstawie Prawa przewozowego **przedawniają się z upływem roku** (art. 77 ust. 1). W przypadku zapłaty należności bieg przedawnienia liczy się od dnia, w którym zapłata powinna była nastąpić (art. 77 ust. 3 pkt 4), a na czas rozpatrywania reklamacji ulega zawieszeniu (art. 77 ust. 4). Po upływie przedawnienia przewoźnik nie może skutecznie domagać się zapłaty od konsumenta.

Jeżeli nie kwestionujesz opłaty, ale nie możesz zapłacić całości od razu, możesz złożyć **wniosek o rozłożenie na raty**. Przewoźnik nie ma obowiązku się zgodzić, ale wielu organizatorów transportu przewiduje taką możliwość w regulaminach windykacji. Sprawdź też, czy regulamin przewiduje **obniżoną opłatę** przy szybkiej zapłacie (art. 33a ust. 6).`,
      },
      {
        heading: "Najczęstsze błędy i co jeśli reklamacja zostanie odrzucona",
        body: `- **Przegapienie 7 dni** na okazanie biletu imiennego lub dokumentu ulgi.
- **Podanie cudzych danych** podczas kontroli – to poważne naruszenie prawa; jeśli ktoś podał Twoje dane, zgłoś to na policję i dołącz zgłoszenie do reklamacji.
- **Brak dowodów** – zrzut ekranu z aplikacji z godziną zakupu biletu jest kluczowy przy argumentach technicznych.
- **Ignorowanie wezwań** – sprawa może trafić do firmy windykacyjnej, a potem do sądu; od nakazu zapłaty przysługuje sprzeciw w 14 dni.

Po odrzuceniu reklamacji złóż odwołanie do przewoźnika. Przy przewozach kolejowych możesz zwrócić się do **Rzecznika Praw Pasażerów Kolei** (pozasądowe rozwiązywanie sporów), a w komunikacji miejskiej – do **rzecznika konsumentów**. W sądzie to przewoźnik musi wykazać zasadność swojego roszczenia.`,
      },
    ],
    faq: [
      {
        question: "Zapomniałem biletu miesięcznego – czy muszę płacić opłatę dodatkową?",
        answer:
          "Nie, jeśli bilet był imienny i ważny, a Ty udokumentujesz to przewoźnikowi w ciągu 7 dni od przejazdu. Opłata dodatkowa zostanie umorzona – zapłacisz jedynie opłatę manipulacyjną określoną w regulaminie przewoźnika.",
      },
      {
        question: "Ile czasu ma przewoźnik na odpowiedź na reklamację?",
        answer:
          "30 dni od dnia wpływu reklamacji (§ 6 ust. 1 rozporządzenia z 24 lutego 2006 r.). Jeśli nie odpowie w tym terminie, reklamację uważa się za uwzględnioną (§ 10).",
      },
      {
        question: "Do kiedy mogę złożyć reklamację wezwania do zapłaty?",
        answer:
          "Nie później niż w terminie 3 miesięcy od dnia otrzymania wezwania (§ 9 ust. 1 rozporządzenia). Jeśli powołujesz się na bilet lub ulgę, których nie miałeś przy sobie, pamiętaj o krótszym, 7-dniowym terminie na ich okazanie.",
      },
      {
        question: "Kupiłem bilet w aplikacji tuż przed kontrolą – czy to się liczy?",
        answer:
          "Zależy od regulaminu – zwykle bilet musi być kupiony i aktywny przed wejściem do pojazdu albo niezwłocznie po wejściu. Jeśli zakup był możliwy dopiero z opóźnieniem z przyczyn technicznych (awaria aplikacji, brak zasięgu, niedziałający kasownik), złóż reklamację i dołącz potwierdzenie transakcji z godziną.",
      },
      {
        question: "Kontroler nie pokazał identyfikatora – czy wezwanie jest nieważne?",
        answer:
          "Kontroler musi legitymować się identyfikatorem w widocznym miejscu (art. 33a ust. 1 Prawa przewozowego). Brak identyfikatora to argument w reklamacji, ale sam w sobie nie zawsze prowadzi do anulowania opłaty – najlepiej połączyć go z innymi okolicznościami.",
      },
      {
        question: "Ktoś podał moje dane podczas kontroli – co robić?",
        answer:
          "Złóż reklamację, wskazując, że nie odbywałeś przejazdu, i zażądaj protokołu kontroli z danymi dokumentu tożsamości, na podstawie którego ustalono tożsamość podróżnego. Zgłoś też sprawę na policję i dołącz potwierdzenie zgłoszenia.",
      },
      {
        question: "Czy opłata za jazdę bez biletu się przedawnia?",
        answer:
          "Tak. Roszczenia z Prawa przewozowego przedawniają się z upływem roku (art. 77 ust. 1). Bieg przedawnienia zawiesza się na czas rozpatrywania reklamacji.",
      },
      {
        question: "Czy mogę rozłożyć opłatę dodatkową na raty?",
        answer:
          "Możesz o to wnieść – w naszym generatorze wybierz opcję wniosku o raty albo dodaj ją z ostrożności do reklamacji. Przewoźnik nie ma obowiązku się zgodzić, ale często to robi.",
      },
    ],
  },
  ai: {
    context:
      "Reklamacja pasażera od wezwania do zapłaty opłaty dodatkowej wystawionego przez kontrolera biletów w komunikacji miejskiej, kolejowej lub autobusowej (albo wniosek o rozłożenie należności na raty). Opis faktów ma chronologicznie przedstawić datę i miejsce kontroli, linię lub relację, posiadany dokument przewozu lub uprawnienie do ulgi oraz przebieg kontroli – wyłącznie na podstawie odpowiedzi użytkownika, bez przypisywania kontrolerowi zachowań, których użytkownik nie opisał. Żądanie odpowiada wybranemu argumentowi: umorzenie lub anulowanie wezwania albo rozłożenie należności na raty. Ton rzeczowy, uprzejmy i stanowczy, bez emocji. Nie powołuj przepisów ani terminów – szablon dodaje je sam.",
    factQuestionIds: [
      "notice_number",
      "control_date",
      "route",
      "fee_amount",
      "fare_amount",
      "situation_description",
      "main_argument",
      "document_details",
      "installments_count",
    ],
  },
  render: ({ answers, ai, today }) => {
    const mainRaw = str(answers, "main_argument", "");
    const main = (MAIN_ARGUMENTS as string[]).includes(mainRaw) ? (mainRaw as MainArgument) : "valid_ticket";
    const onlyInstallments = main === "installments_only";
    const wantsInstallments = onlyInstallments || str(answers, "installments", "no") === "yes";
    const rates = installmentsPhrase(num(answers, "installments_count"));
    const noticeNo = str(answers, "notice_number");
    const controlDate = formatDatePl(str(answers, "control_date", ""));
    const route = str(answers, "route");
    const fee = num(answers, "fee_amount");
    const fare = num(answers, "fare_amount");
    const details = inParens(str(answers, "document_details", ""));
    const email = str(answers, "sender_email", "");
    const phone = str(answers, "sender_phone", "");
    const control = parseIso(answers.control_date);
    const todayUtc = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
    const daysSinceControl = control ? Math.round((todayUtc - control.getTime()) / DAY_MS) : undefined;

    const amounts = `opłatę dodatkową w kwocie ${formatMoneyPl(fee)}${
      fare !== undefined && fare > 0 ? ` oraz należność za przejazd w kwocie ${formatMoneyPl(fare)}` : ""
    }`;

    const paragraphs: Paragraph[] = [];
    let rozpCited = false;
    const rozp = () => {
      if (rozpCited) return "rozporządzenia";
      rozpCited = true;
      return ROZP;
    };

    // 1. Wstęp
    if (onlyInstallments) {
      paragraphs.push(
        p(
          `Zwracam się z wnioskiem o rozłożenie na raty należności objętych wezwaniem do zapłaty nr ${noticeNo}, wystawionym w dniu ${controlDate} podczas kontroli dokumentów przewozu (${route}). Wezwanie obejmuje ${amounts}.`,
        ),
      );
    } else {
      paragraphs.push(
        p(
          `Niniejszym składam reklamację od wezwania do zapłaty nr ${noticeNo}, wystawionego w dniu ${controlDate} podczas kontroli dokumentów przewozu (${route}). Wezwanie obejmuje ${amounts}.`,
        ),
      );
    }

    // 2. Stan faktyczny
    if (ai) {
      paragraphs.push(...paragraphsFromText(ai.facts));
      paragraphs.push(...paragraphsFromText(ai.justification));
    } else {
      const user = userParagraphs(str(answers, "situation_description"));
      const lead =
        main === "not_me"
          ? "Osoba podpisana pod niniejszym pismem nie odbywała przejazdu objętego wezwaniem i nie była kontrolowana."
          : "";
      paragraphs.push(p([lead, user[0] ?? ""].filter(Boolean).join(" ")));
      user.slice(1).forEach((t) => paragraphs.push(p(t)));
    }

    // 3. Uzasadnienie prawne – stałe teksty szablonu
    const within7 = daysSinceControl !== undefined && daysSinceControl >= 0 && daysSinceControl <= 7;
    const within7Text = within7
      ? " Niniejszą reklamację wraz z kopią dokumentu składam przed upływem tego terminu."
      : "";
    switch (main) {
      case "valid_ticket":
        paragraphs.push(
          p(
            `W dniu przejazdu przysługiwał mi ważny dokument przewozu${details}, który nie został okazany podczas kontroli wyłącznie z tego powodu, że nie znajdował się przy mnie. Zgodnie z art. 33a ust. 5 w związku z ust. 4 zdanie drugie ${PP} w razie posiadania przez podróżnego ważnego dokumentu przewozu, którego nie miał podczas przejazdu, należność za przewóz i opłata dodatkowa – po uiszczeniu opłaty manipulacyjnej odpowiadającej kosztom poniesionym przez przewoźnika – podlegają w przypadku wezwania do zapłaty umorzeniu, jeżeli podróżny udokumentuje to nie później niż w terminie 7 dni od dnia przewozu.${within7Text}`,
          ),
        );
        break;
      case "discount":
        paragraphs.push(
          p(
            `W dniu przejazdu przysługiwało mi uprawnienie do przejazdu ulgowego lub bezpłatnego${details}, którego dokument nie został okazany podczas kontroli wyłącznie z tego powodu, że nie znajdował się przy mnie. Zgodnie z art. 33a ust. 4 zdanie drugie ${PP} należność za przewóz i opłata dodatkowa, po uiszczeniu opłaty manipulacyjnej odpowiadającej kosztom poniesionym przez przewoźnika lub organizatora publicznego transportu zbiorowego, podlegają w przypadku wezwania do zapłaty umorzeniu, jeżeli podróżny nie później niż w terminie 7 dni od dnia przewozu udokumentuje uprawnienia do bezpłatnego lub ulgowego przejazdu.${within7Text}`,
          ),
        );
        break;
      case "app_or_machine":
        paragraphs.push(
          p(
            `Dokument przewozu został nabyty${details}, a ewentualne opóźnienie jego aktywacji lub brak możliwości skasowania biletu wynikały z przyczyn technicznych, niezależnych od podróżnego. Zgodnie z art. 33a ust. 3 ${PP} opłatę dodatkową pobiera się w razie stwierdzenia braku odpowiedniego dokumentu przewozu. W niniejszej sprawie brak skasowanego lub aktywnego biletu w chwili kontroli nie wynikał z okoliczności, za które odpowiada podróżny, wobec czego obciążenie mnie opłatą dodatkową nie jest uzasadnione.`,
          ),
        );
        break;
      case "controller_no_id":
        paragraphs.push(
          p(
            `Kontrola została przeprowadzona z naruszeniem art. 33a ust. 1 ${PP}, zgodnie z którym przewoźnik lub organizator publicznego transportu zbiorowego albo osoba przez niego upoważniona może dokonywać kontroli dokumentów przewozu, legitymując się identyfikatorem umieszczonym w widocznym miejscu. Identyfikator ten powinien zawierać w szczególności nazwę przewoźnika lub organizatora, numer identyfikacyjny i zdjęcie kontrolującego, zakres upoważnienia oraz okres ważności (art. 33a ust. 2). Kontrolujący nie legitymował się takim identyfikatorem, a zatem nie wykazał uprawnienia do przeprowadzenia kontroli i wystawienia wezwania do zapłaty.`,
          ),
        );
        break;
      case "notice_errors":
        paragraphs.push(
          p(
            `Wezwanie do zapłaty nie spełnia wymogów określonych w § 7 ust. 2 ${rozp()}, który wymienia dane, jakie powinno zawierać wezwanie do zapłaty z tytułu przewozu osób – w szczególności datę i relację przejazdu, miejsce ujawnienia braku dokumentu przewozu, tytuł i wysokość roszczenia z wyszczególnieniem opłaty za przejazd i opłaty dodatkowej, termin uregulowania należności oraz rodzaj, serię i numer dokumentu tożsamości podróżnego. Opisane wyżej błędy i braki wezwania uniemożliwiają uznanie roszczenia za wykazane.`,
          ),
        );
        break;
      case "not_me":
        paragraphs.push(
          p(
            `Dane osobowe wskazane w wezwaniu zostały najprawdopodobniej podane przez inną osobę. Wnoszę o przedstawienie kopii protokołu kontroli, w tym rodzaju, serii i numeru dokumentu tożsamości, na podstawie którego ustalono tożsamość podróżnego (§ 7 ust. 2 pkt 9 ${rozp()}), oraz o wskazanie numeru identyfikacyjnego kontrolującego.`,
          ),
        );
        break;
      case "installments_only":
        break;
    }

    // 4. Żądanie
    if (ai?.demand) {
      paragraphs.push(...paragraphsFromText(ai.demand));
    } else if (onlyInstallments) {
      paragraphs.push(
        p(
          `Nie kwestionując zasadności wezwania, ze względu na moją sytuację materialną wnoszę o rozłożenie należności na ${rates} oraz o umożliwienie zapłaty opłaty dodatkowej w obniżonej wysokości, jeżeli przewiduje ją regulamin przewozu lub taryfa. Zobowiązuję się do terminowego regulowania rat zgodnie z harmonogramem, który Państwo wskażą.`,
        ),
      );
    } else if (main === "valid_ticket" || main === "discount") {
      paragraphs.push(
        p(
          `W związku z powyższym wnoszę o umorzenie opłaty dodatkowej i należności za przewóz objętych wezwaniem nr ${noticeNo}, z zastrzeżeniem pobrania opłaty manipulacyjnej, oraz o wskazanie jej wysokości i sposobu zapłaty.`,
        ),
      );
    } else {
      paragraphs.push(
        p(`W związku z powyższym wnoszę o uwzględnienie reklamacji i anulowanie wezwania do zapłaty nr ${noticeNo} w całości.`),
      );
    }
    if (wantsInstallments && !onlyInstallments) {
      paragraphs.push(
        p(`Na wypadek nieuwzględnienia reklamacji wnoszę z ostrożności o rozłożenie należności na ${rates}.`),
      );
    }

    // 5. Termin odpowiedzi i skutek milczenia
    if (onlyInstallments) {
      paragraphs.push(
        p(
          `Proszę o odpowiedź na adres wskazany w nagłówku pisma${email ? ` lub na adres e-mail: ${email}` : ""}.`,
        ),
      );
    } else {
      paragraphs.push(
        p(
          `Zgodnie z § 6 ust. 1 ${rozp()} odpowiedzi na reklamację udziela się w terminie 30 dni od dnia jej wpływu do przewoźnika, a zgodnie z § 10 tego rozporządzenia nieudzielenie odpowiedzi w wymaganym terminie skutkuje uwzględnieniem reklamacji. Do czasu rozpatrzenia reklamacji wnoszę o wstrzymanie czynności windykacyjnych.`,
        ),
      );
      paragraphs.push(
        p(
          `Odpowiedź proszę przesłać na adres wskazany w nagłówku pisma${
            email ? ` lub na adres e-mail: ${email}` : ""
          }.`,
        ),
      );
    }

    const attachments: string[] = [];
    if (bool(answers, "att_notice")) attachments.push("Kopia wezwania do zapłaty");
    if (bool(answers, "att_document"))
      attachments.push("Kopia dokumentu przewozu, dokumentu uprawniającego do ulgi lub potwierdzenia transakcji");
    attachments.push(...attachmentsFromText(str(answers, "evidence_list", "")));
    const extra = [email ? `e-mail: ${email}` : "", phone ? `tel. ${phone}` : ""];

    return {
      sender: partyFromAnswers(answers, "sender", extra),
      recipient: partyFromAnswers(answers, "recipient"),
      place: str(answers, "sender_city"),
      date: formatDatePl(today),
      title: onlyInstallments ? "WNIOSEK O ROZŁOŻENIE NALEŻNOŚCI NA RATY" : "REKLAMACJA WEZWANIA DO ZAPŁATY",
      subject: `Dotyczy: wezwania do zapłaty nr ${noticeNo} z dnia ${controlDate} – opłata dodatkowa za przejazd bez ważnego dokumentu przewozu`,
      salutation: "Szanowni Państwo,",
      paragraphs: paragraphs.map(tidyParagraph),
      closing: "Z poważaniem",
      signatureName: str(answers, "sender_name"),
      attachments,
      previewParagraphCount: 2,
    };
  },
};
