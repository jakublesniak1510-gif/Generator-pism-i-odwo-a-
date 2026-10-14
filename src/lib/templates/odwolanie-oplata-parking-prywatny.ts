import type { LetterTemplate, Paragraph } from "./types";
import {
  bool,
  formatDatePl,
  formatMoneyPl,
  list,
  num,
  p,
  partyFromAnswers,
  paragraphsFromText,
  recipientQuestions,
  senderQuestions,
  str,
} from "./helpers";

/*
 * Odpowiedź na wezwanie do zapłaty „opłaty dodatkowej” za postój na parkingu prywatnym
 * (centrum handlowe, osiedle, parking przy szpitalu itp.). Roszczenie ma charakter cywilnoprawny
 * (umowa zawierana przez wjazd – art. 60 k.c.), a nie administracyjny.
 * Przepisy zweryfikowane: k.c. t.j. Dz. U. z 2026 r. poz. 795; Prawo o ruchu drogowym t.j. Dz. U. z 2024 r. poz. 1251;
 * RODO (UE) 2016/679. Szczegóły: docs/legal-review/odwolanie-oplata-parking-prywatny.md
 */

const KC_FULL = "ustawy z dnia 23 kwietnia 1964 r. – Kodeks cywilny (dalej: „k.c.”)";
const ISAP_KC = "https://isap.sejm.gov.pl/isap.nsf/DocDetails.xsp?id=WDU19640160093";
const EURLEX_RODO = "https://eur-lex.europa.eu/legal-content/PL/TXT/?uri=CELEX:32016R0679";

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

export const odwolanieParkingPrywatny: LetterTemplate = {
  slug: "odwolanie-oplata-parking-prywatny",
  name: "Odwołanie od opłaty za parking prywatny",
  category: "transport",
  shortDescription:
    "Odpowiedź na wezwanie do zapłaty „opłaty dodatkowej” z parkingu galerii lub osiedla – odmowa zapłaty i żądanie dowodów.",
  priceGrosze: 2499,
  icon: "🏬",
  estimatedMinutes: 7,
  sections: [
    {
      id: "sender",
      title: "Twoje dane",
      description: "Dane osoby, do której przyszło wezwanie (zwykle właściciela pojazdu).",
      questions: senderQuestions(),
    },
    {
      id: "recipient",
      title: "Firma, która wystawiła wezwanie",
      description:
        "Nazwę i adres firmy znajdziesz w wezwaniu do zapłaty (często w stopce). Jeśli wezwanie przysłała firma windykacyjna, pismo kieruj do niej – możesz też wysłać kopię do zarządcy parkingu.",
      questions: recipientQuestions("Firma (wierzyciel)"),
    },
    {
      id: "notice",
      title: "Wezwanie do zapłaty",
      questions: [
        {
          id: "notice_number",
          label: "Numer wezwania (sprawy)",
          type: "text",
          placeholder: "np. PP/2026/10/004512",
        },
        {
          id: "notice_date",
          label: "Data wezwania",
          type: "date",
        },
        {
          id: "response_deadline",
          label: "Termin zapłaty lub odpowiedzi wskazany w wezwaniu",
          type: "date",
          required: false,
          help: "Nie jest to termin ustawowy, ale warto odpowiedzieć przed nim, aby firma nie przekazała sprawy do windykacji.",
        },
        {
          id: "amount",
          label: "Żądana kwota",
          type: "money",
          placeholder: "150.00",
        },
        {
          id: "plate",
          label: "Numer rejestracyjny pojazdu",
          type: "text",
          placeholder: "np. KR 12345",
          validate: { maxLength: 12 },
        },
        {
          id: "event_date",
          label: "Data postoju (zdarzenia)",
          type: "date",
        },
        {
          id: "event_place",
          label: "Miejsce – parking",
          type: "text",
          placeholder: "np. parking Galerii Zachód, ul. Długa 1, Kraków",
        },
        {
          id: "was_driver",
          label: "Czy to Ty kierowałeś pojazdem i zostawiłeś go na parkingu?",
          type: "radio",
          help: "Nie masz obowiązku wskazywać prywatnej firmie, kto prowadził samochód.",
          options: [
            { value: "driver", label: "Tak, to ja" },
            { value: "not_driver", label: "Nie, pojazdem kierowała inna osoba" },
            { value: "undisclosed", label: "Wolę tego nie wskazywać" },
          ],
        },
      ],
    },
    {
      id: "facts",
      title: "Co się stało",
      questions: [
        {
          id: "situation_description",
          label: "Opisz sytuację",
          type: "textarea",
          placeholder:
            "np. Zatrzymałem się na parkingu centrum handlowego na ok. 40 minut w czasie zakupów. Przy wjeździe nie było szlabanu ani widocznej tablicy z regulaminem. Po miesiącu otrzymałem pocztą wezwanie do zapłaty 150 zł.",
          help: "Napisz, jak długo trwał postój, czy był szlaban lub biletomat, jakie tablice widziałeś i jak otrzymałeś wezwanie.",
          validate: { maxLength: 2000 },
        },
      ],
    },
    {
      id: "arguments",
      title: "Argumenty i dowody",
      description: "Zaznacz wszystkie argumenty, które pasują do Twojej sytuacji. Każdy z nich zostanie opisany w piśmie wraz z podstawą prawną.",
      questions: [
        {
          id: "arg_no_signage",
          label: "Przy wjeździe nie było czytelnej informacji o odpłatności i regulaminu",
          type: "checkbox",
          required: false,
        },
        {
          id: "arg_not_driver",
          label: "Nie byłem kierującym – właściciel pojazdu nie jest stroną umowy",
          type: "checkbox",
          required: false,
          showIf: { questionId: "was_driver", equals: ["not_driver", "undisclosed"] },
        },
        {
          id: "arg_paid",
          label: "Postój był opłacony albo trwał krócej niż czas bezpłatny",
          type: "checkbox",
          required: false,
        },
        {
          id: "paid_details",
          label: "Szczegóły opłaty lub czasu postoju",
          type: "text",
          placeholder: "np. bilet nr 004512 opłacony w biletomacie o 14:05; postój 50 minut przy 2 h bezpłatnie",
          showIf: { questionId: "arg_paid", equals: "true" },
          validate: { maxLength: 300 },
        },
        {
          id: "arg_excessive",
          label: "Żądana kwota jest rażąco wygórowana",
          type: "checkbox",
          required: false,
        },
        {
          id: "arg_evidence",
          label: "Żądam przedstawienia dowodów (zdjęcia, regulamin, umocowanie firmy) – zalecane",
          type: "checkbox",
          required: false,
        },
        {
          id: "arg_gdpr",
          label: "Żądam informacji, skąd firma ma moje dane osobowe (RODO)",
          type: "checkbox",
          required: false,
        },
        {
          id: "evidence_list",
          label: "Twoje dowody (opcjonalnie)",
          type: "text",
          required: false,
          placeholder: "np. zdjęcie biletu parkingowego; zdjęcia wjazdu na parking; paragon ze sklepu z godziną zakupów",
          help: "Kilka pozycji oddziel średnikami. Zostaną wymienione jako załączniki.",
        },
      ],
    },
  ],
  legalBasis: [
    {
      act: "Ustawa z dnia 23 kwietnia 1964 r. – Kodeks cywilny",
      article: "art. 60, art. 66 § 1, art. 384 § 1–2",
      summary:
        "Umowa parkingowa powstaje przez wjazd tylko wtedy, gdy kierowca mógł poznać jej warunki – regulamin wiąże, jeśli był doręczony lub łatwo dostępny przed wjazdem.",
      url: ISAP_KC,
    },
    {
      act: "Ustawa z dnia 23 kwietnia 1964 r. – Kodeks cywilny",
      article: "art. 6",
      summary: "To firma musi udowodnić, że umowa została zawarta, z kim i na jakich warunkach.",
      url: ISAP_KC,
    },
    {
      act: "Ustawa z dnia 23 kwietnia 1964 r. – Kodeks cywilny",
      article: "art. 483 § 1, art. 484 § 2",
      summary:
        "Kara umowna może dotyczyć tylko zobowiązań niepieniężnych i podlega obniżeniu, gdy jest rażąco wygórowana.",
      url: ISAP_KC,
    },
    {
      act: "Ustawa z dnia 23 kwietnia 1964 r. – Kodeks cywilny",
      article: "art. 385¹ § 1, art. 385³ pkt 17",
      summary:
        "Postanowienia regulaminu nakładające na konsumenta rażąco wygórowaną karę są niedozwolone i go nie wiążą.",
      url: ISAP_KC,
    },
    {
      act: "Rozporządzenie Parlamentu Europejskiego i Rady (UE) 2016/679 (RODO)",
      article: "art. 15 ust. 1 lit. g, ust. 3",
      summary: "Masz prawo dowiedzieć się, skąd firma pozyskała Twoje dane, i otrzymać ich kopię.",
      url: EURLEX_RODO,
    },
  ],
  deadlines: [
    {
      id: "notice_deadline",
      label: "Termin wskazany w wezwaniu",
      fromQuestionId: "response_deadline",
      days: 0,
      description:
        "Termin z wezwania nie wynika z ustawy – to termin wyznaczony przez firmę. Odpowiedz przed nim, aby udokumentować, że kwestionujesz roszczenie, zanim sprawa trafi do windykacji.",
    },
  ],
  instructions: {
    whereToSend: `Pismo wyślij do **firmy wskazanej w wezwaniu** jako wierzyciel (operator parkingu) – nazwa i adres są zwykle w nagłówku lub stopce wezwania. Jeśli wezwanie przyszło od **firmy windykacyjnej** lub kancelarii, wyślij odpowiedź do niej, a kopię możesz przesłać do operatora parkingu.

Dane firmy (pełną nazwę, adres siedziby, reprezentację) sprawdzisz bezpłatnie w **KRS** (wyszukiwarka na stronie Ministerstwa Sprawiedliwości) albo w **CEIDG** – po numerze NIP z wezwania.`,
    howToSend: `Wyślij pismo **listem poleconym za potwierdzeniem odbioru** – to najlepszy dowód, że zakwestionowałeś roszczenie i zażądałeś dokumentów. Jeśli firma wskazuje adres e-mail do reklamacji lub odwołań, możesz dodatkowo wysłać skan pisma e-mailem.

Nie płać „na wszelki wypadek” – zapłata może zostać potraktowana jako uznanie roszczenia. Nie podawaj też prywatnej firmie danych kierującego.`,
    afterSending: `Nie ma ustawowego terminu na odpowiedź firmy na takie pismo. Na żądanie z RODO firma musi jednak odpowiedzieć w ciągu **miesiąca**.

Możliwe scenariusze:
- **firma anuluje wezwanie** – zachowaj korespondencję,
- **firma przysyła dowody** – oceń je; jeśli wynika z nich, że regulamin był czytelnie wywieszony, a postój nieopłacony, rozważ ugodę (np. zapłatę zwykłej stawki),
- **firma milczy lub ponawia wezwania** – nie musisz odpowiadać na każde; roszczenie może dochodzić tylko przed sądem, gdzie musi udowodnić swoje twierdzenia,
- **otrzymasz nakaz zapłaty z sądu** – masz tylko **14 dni na sprzeciw** (w e-sądzie – również 14 dni). Koniecznie go złóż.

Brak odpowiedzi na żądanie RODO zgłoś do **Prezesa UODO**. Praktyki stosowane wobec wielu kierowców możesz zgłosić do **UOKiK** lub rzecznika konsumentów.`,
    checklist: [
      "Przepisz dokładnie numer wezwania, datę, kwotę i numer rejestracyjny.",
      "Zrób zdjęcia wjazdu na parking i tablic informacyjnych (jeśli to możliwe).",
      "Dołącz kopie swoich dowodów (bilet, potwierdzenie płatności, paragon ze sklepu) – oryginały zachowaj.",
      "Nie wskazuj danych osoby kierującej, jeśli nie chcesz – nie masz takiego obowiązku.",
      "Wyślij pismo listem poleconym za potwierdzeniem odbioru przed terminem z wezwania.",
      "Zachowaj kopię pisma i dowód nadania.",
    ],
  },
  seo: {
    title: "Opłata dodatkowa parking prywatny – odwołanie, wzór",
    metaDescription:
      "Dostałeś wezwanie do zapłaty z parkingu galerii lub osiedla? Wzór odpowiedzi: odmowa zapłaty, żądanie dowodów i danych z RODO. Generator pisma.",
    h1: "Odwołanie od opłaty dodatkowej za parking prywatny – wzór pisma",
    intro:
      "Wezwanie do zapłaty z parkingu centrum handlowego, osiedla czy szpitala to nie mandat, tylko roszczenie prywatnej firmy. Możesz je zakwestionować i zażądać dowodów. Wypełnij formularz – przygotujemy odpowiedź z argumentami opartymi na Kodeksie cywilnym i RODO.",
    keywords: [
      "opłata dodatkowa parking prywatny",
      "wezwanie do zapłaty parking galeria",
      "odwołanie od opłaty parkingowej wzór",
      "czy muszę płacić za parking prywatny",
      "kara za parking pod sklepem",
      "parking prywatny opłata dodatkowa odwołanie",
      "wezwanie do zapłaty za parking co robić",
    ],
    guide: [
      {
        heading: "Czym jest „opłata dodatkowa” na parkingu prywatnym",
        body: `Parkingi przy centrach handlowych, marketach, osiedlach czy szpitalach często obsługują prywatne firmy, które rozpoznają tablice rejestracyjne kamerami i wysyłają właścicielom pojazdów wezwania do zapłaty „opłaty dodatkowej” – zwykle od 100 do 300 zł.

To **nie jest mandat ani opłata administracyjna**. Firma nie jest organem władzy, nie może nałożyć kary i nie może prowadzić egzekucji bez wyroku sądu. Jej roszczenie ma charakter **cywilny** – opiera się na twierdzeniu, że wjeżdżając na parking, kierowca zawarł umowę i zaakceptował regulamin (zawarcie umowy przez czynności dorozumiane – art. 60 Kodeksu cywilnego).

Takie roszczenie trzeba jednak **udowodnić**. To firma musi wykazać, że umowa została zawarta, z kim, na jakich warunkach i że została naruszona (art. 6 k.c.).`,
      },
      {
        heading: "Najmocniejsze argumenty",
        body: `- **Brak czytelnego regulaminu i oznakowania.** Regulamin (wzorzec umowy) wiąże kierowcę tylko wtedy, gdy mógł się z nim łatwo zapoznać przed wjazdem (art. 384 k.c.). Mała tablica ukryta za słupem albo regulamin dostępny wyłącznie w internecie mogą nie wystarczyć.
- **Właściciel to nie kierowca.** Umowę zawiera osoba, która wjechała i zaparkowała. Właściciel pojazdu, który nie prowadził auta, nie jest stroną umowy. Obowiązek wskazania kierującego (art. 78 ust. 4 Prawa o ruchu drogowym) istnieje tylko wobec uprawnionego organu, np. policji – nie wobec prywatnej firmy.
- **Opłacony postój lub czas bezpłatny.** Jeśli miałeś bilet albo zmieściłeś się w darmowym czasie (np. 2 godziny dla klientów), roszczenie jest bezzasadne. Zachowaj paragony ze sklepu z godziną zakupów.
- **Rażąco wygórowana kwota.** Kara umowna może dotyczyć wyłącznie zobowiązań niepieniężnych (art. 483 § 1 k.c.), a zapłata za parking jest zobowiązaniem pieniężnym. Ponadto rażąco wygórowana kara podlega obniżeniu (art. 484 § 2 k.c.), a postanowienie regulaminu, które ją przewiduje, może być niedozwolone wobec konsumenta (art. 385¹ i 385³ pkt 17 k.c.).
- **Brak umocowania.** Firma powinna wykazać, że działa w imieniu właściciela terenu i ma prawo pobierać opłaty.`,
      },
      {
        heading: "Jak odpowiedzieć na wezwanie – krok po kroku",
        body: `1. **Nie płać od razu** i nie ignoruj pisma – odpowiedź na piśmie to dowód, że kwestionujesz roszczenie.
2. **Zbierz dowody** – zdjęcia wjazdu i tablic, bilet, potwierdzenie płatności w aplikacji, paragony ze sklepu.
3. **Wypełnij generator** – wybierz argumenty pasujące do Twojej sytuacji.
4. **Wyślij pismo listem poleconym** za potwierdzeniem odbioru – najlepiej przed terminem wskazanym w wezwaniu.
5. **Zażądaj dowodów i informacji z RODO** – firma musi odpowiedzieć na żądanie dostępu do danych w ciągu miesiąca.
6. **Oceń odpowiedź** – jeśli firma przedstawi przekonujące dowody, rozważ negocjacje (np. zapłatę zwykłej stawki za postój).`,
      },
      {
        heading: "Terminy – czy jest termin na odwołanie?",
        body: `W przypadku parkingu prywatnego **nie ma ustawowego terminu na odwołanie** ani obowiązkowej procedury reklamacyjnej. Termin wskazany w wezwaniu to termin wyznaczony przez firmę – jego przekroczenie nie pozbawia Cię prawa do kwestionowania roszczenia, ale warto odpowiedzieć wcześniej, by uniknąć przekazania sprawy do windykacji.

Roszczenia z umowy parkingu – jako roszczenia związane z prowadzeniem działalności gospodarczej – co do zasady przedawniają się po **3 latach**, a termin kończy się z ostatnim dniem roku kalendarzowego (art. 118 k.c.). Po upływie tego terminu nie można domagać się od konsumenta zapłaty (art. 117 § 2¹ k.c.) – sąd uwzględnia przedawnienie z urzędu, ale warto też samodzielnie podnieść ten zarzut.

Jeśli wysłałeś żądanie z RODO, firma ma **miesiąc** na odpowiedź (art. 12 ust. 3 RODO).`,
      },
      {
        heading: "Skąd firma ma moje dane i czy wolno jej je przetwarzać",
        body: `Firmy parkingowe zwykle odczytują numer rejestracyjny z kamer, a następnie ustalają dane właściciela pojazdu – np. na podstawie wniosku do centralnej ewidencji pojazdów lub od podmiotów, które takie dane pozyskały. Masz prawo wiedzieć, **skąd pochodzą Twoje dane**, w jakim celu i na jakiej podstawie są przetwarzane oraz komu zostały przekazane (art. 15 ust. 1 RODO), a także otrzymać ich **kopię** (art. 15 ust. 3).

Jeśli firma nie odpowie w ciągu miesiąca albo przetwarza dane bez podstawy, możesz złożyć skargę do **Prezesa Urzędu Ochrony Danych Osobowych**.`,
      },
      {
        heading: "Najczęstsze błędy i co dalej, jeśli firma nie odpuści",
        body: `- **Zapłata „dla świętego spokoju”** – później trudno odzyskać pieniądze.
- **Wskazanie kierującego** – nie masz takiego obowiązku wobec prywatnej firmy; podanie danych innej osoby przenosi na nią problem.
- **Ignorowanie pism z sądu** – wezwania od firmy możesz zostawić bez dalszej odpowiedzi, ale **nakaz zapłaty z sądu** wymaga sprzeciwu w ciągu 14 dni. Bez sprzeciwu nakaz się uprawomocni.
- **Emocjonalne pismo** – pisz rzeczowo, bez obraźliwych sformułowań.

Jeśli firma skieruje sprawę do sądu, to ona musi udowodnić zawarcie umowy, jej warunki i Twoją odpowiedzialność. W sądzie przydadzą się Twoje zdjęcia, paragony i niniejsza korespondencja. Bezpłatnej pomocy udzielają **rzecznicy konsumentów** oraz punkty nieodpłatnej pomocy prawnej.`,
      },
    ],
    faq: [
      {
        question: "Czy muszę zapłacić opłatę dodatkową za parking pod galerią?",
        answer:
          "Nie automatycznie. To roszczenie cywilne prywatnej firmy, a nie mandat. Firma musi udowodnić, że zawarłeś umowę na warunkach regulaminu i że ją naruszyłeś. Jeśli nie było czytelnego oznakowania albo nie Ty kierowałeś, masz mocne argumenty, aby odmówić zapłaty.",
      },
      {
        question: "Czy muszę wskazać, kto kierował moim samochodem?",
        answer:
          "Nie. Obowiązek wskazania osoby, której powierzyłeś pojazd, istnieje tylko wobec uprawnionego organu (np. policji, straży miejskiej) – art. 78 ust. 4 Prawa o ruchu drogowym. Prywatna firma parkingowa takim organem nie jest.",
      },
      {
        question: "Czy firma parkingowa może wpisać mnie do BIK lub rejestru dłużników?",
        answer:
          "Do BIK – nie, bo nie jest bankiem. Wpis konsumenta do biura informacji gospodarczej (BIG) jest możliwy tylko przy łącznym spełnieniu ustawowych warunków, m.in. gdy zaległość wynosi co najmniej 200 zł, jest wymagalna od co najmniej 30 dni, a od wysłania listem poleconym wezwania z ostrzeżeniem o zamiarze wpisu minął co najmniej miesiąc. Pojedyncza opłata parkingowa często nie spełnia progu kwotowego.",
      },
      {
        question: "Czy firma może ściągnąć pieniądze przez komornika?",
        answer:
          "Tylko na podstawie prawomocnego orzeczenia sądu (np. nakazu zapłaty) zaopatrzonego w klauzulę wykonalności. Dlatego tak ważne jest, aby złożyć sprzeciw od nakazu zapłaty w terminie 14 dni.",
      },
      {
        question: "Co jeśli rzeczywiście przekroczyłem czas bezpłatnego postoju?",
        answer:
          "Nadal możesz kwestionować wysokość opłaty dodatkowej jako rażąco wygórowanej oraz żądać dowodów. Rozsądnym rozwiązaniem bywa propozycja zapłaty zwykłej stawki za faktyczny czas postoju.",
      },
      {
        question: "Ile firma ma czasu na odpowiedź?",
        answer:
          "Na samo pismo – brak ustawowego terminu. Na żądanie informacji o danych osobowych firma musi odpowiedzieć w ciągu miesiąca od jego otrzymania (art. 12 ust. 3 RODO), z możliwością przedłużenia w wyjątkowych sytuacjach.",
      },
      {
        question: "Czy to pismo to to samo co odwołanie od opłaty w strefie płatnego parkowania?",
        answer:
          "Nie. Strefa płatnego parkowania na drodze publicznej to opłata publicznoprawna pobierana przez gminę – obowiązuje tam procedura reklamacyjna z uchwały rady gminy. Dla SPP skorzystaj z naszego osobnego wzoru.",
      },
    ],
  },
  ai: {
    context:
      "Odpowiedź osoby prywatnej (zwykle właściciela pojazdu) na wezwanie do zapłaty „opłaty dodatkowej” wystawione przez prywatną firmę zarządzającą parkingiem. Opis faktów ma rzeczowo przedstawić okoliczności postoju: miejsce, datę, czas trwania, oznakowanie wjazdu, ewentualną płatność i to, czy autor pisma kierował pojazdem – bez przyznawania faktów, których użytkownik nie potwierdził. Jeżeli użytkownik nie był kierującym lub nie chce tego wskazywać, nie ujawniaj, kto kierował. Żądanie to anulowanie wezwania i przedstawienie dowodów. Ton spokojny, stanowczy, bez emocji i bez gróźb. Nie powołuj przepisów – szablon dodaje je sam.",
    factQuestionIds: [
      "notice_number",
      "notice_date",
      "amount",
      "plate",
      "event_date",
      "event_place",
      "was_driver",
      "situation_description",
      "paid_details",
    ],
  },
  render: ({ answers, ai, today }) => {
    const noticeNo = str(answers, "notice_number");
    const noticeDate = formatDatePl(str(answers, "notice_date", ""));
    const eventDate = formatDatePl(str(answers, "event_date", ""));
    const amount = formatMoneyPl(num(answers, "amount"));
    const plate = str(answers, "plate");
    const place = str(answers, "event_place");
    const wasDriver = str(answers, "was_driver", "undisclosed");
    const email = str(answers, "sender_email", "");
    const phone = str(answers, "sender_phone", "");

    const paragraphs: Paragraph[] = [];

    // 1. Wstęp
    paragraphs.push(
      p(
        `W odpowiedzi na Państwa wezwanie do zapłaty nr ${noticeNo} z dnia ${noticeDate}, dotyczące „opłaty dodatkowej” w kwocie ${amount} za postój pojazdu o numerze rejestracyjnym ${plate} w dniu ${eventDate} (miejsce: ${place}), oświadczam, że nie uznaję tego roszczenia ani co do zasady, ani co do wysokości i odmawiam jego zapłaty.`,
      ),
    );

    // 2. Stan faktyczny
    if (ai) {
      paragraphs.push(...paragraphsFromText(ai.facts));
      paragraphs.push(...paragraphsFromText(ai.justification));
    } else {
      const user = userParagraphs(str(answers, "situation_description", ""));
      const driverSentence =
        wasDriver === "not_driver"
          ? "W dniu, którego dotyczy wezwanie, osoba podpisana pod niniejszym pismem nie kierowała pojazdem i nie pozostawiła go na parkingu."
          : "";
      paragraphs.push(
        p(
          [
            "Z treści wezwania wynika, że pojazd miał zostać pozostawiony na parkingu z naruszeniem warunków jego regulaminu.",
            user[0] ?? "",
            driverSentence,
          ]
            .filter(Boolean)
            .join(" "),
        ),
      );
      user.slice(1).forEach((t) => paragraphs.push(p(t)));
    }

    // 3. Stanowisko – argumenty (stałe teksty szablonu)
    const args: string[] = [];
    if (bool(answers, "arg_no_signage")) {
      args.push(
        "Nie doszło do zawarcia umowy, z której wywodzą Państwo roszczenie. Wjazd na parking może stanowić oświadczenie woli zawarcia umowy (art. 60 k.c.) wyłącznie na warunkach, które zostały kierującemu przedstawione przed wjazdem – oferta musi określać istotne postanowienia umowy (art. 66 § 1 k.c.). Regulamin parkingu jako wzorzec umowy wiąże drugą stronę, jeżeli został jej doręczony przed zawarciem umowy, a w umowach zawieranych z konsumentami w drobnych, bieżących sprawach życia codziennego – jeżeli mogła się ona z łatwością dowiedzieć o jego treści (art. 384 § 1 i 2 k.c.). Przy wjeździe na parking nie było czytelnej informacji o odpłatności postoju, o treści regulaminu ani o wysokości „opłaty dodatkowej”.",
      );
    }
    if ((wasDriver === "not_driver" || wasDriver === "undisclosed") && bool(answers, "arg_not_driver")) {
      args.push(
        "Stroną umowy o korzystanie z parkingu – o ile w ogóle doszło do jej zawarcia – może być wyłącznie osoba, która wjechała pojazdem na parking i go na nim pozostawiła, tj. kierujący. Sam fakt bycia właścicielem pojazdu nie czyni mnie stroną tej umowy ani dłużnikiem z jej tytułu. Nie istnieje również podstawa prawna do żądania przez Państwa wskazania osoby kierującej – obowiązek taki, przewidziany w art. 78 ust. 4 ustawy z dnia 20 czerwca 1997 r. – Prawo o ruchu drogowym, istnieje wyłącznie wobec uprawnionego organu, a nie wobec podmiotu prywatnego.",
      );
    }
    if (bool(answers, "arg_paid")) {
      const details = str(answers, "paid_details", "");
      args.push(
        `Postój był opłacony albo mieścił się w czasie bezpłatnego postoju${
          details ? ` (${details.replace(/[.\s]+$/, "")})` : ""
        }. Nie doszło zatem do naruszenia warunków korzystania z parkingu, które mogłoby uzasadniać jakąkolwiek dodatkową należność.`,
      );
    }
    if (bool(answers, "arg_excessive")) {
      args.push(
        "Niezależnie od powyższego żądana kwota jest rażąco wygórowana w stosunku do zwykłej opłaty za postój. Jeżeli „opłata dodatkowa” ma stanowić karę umowną, to po pierwsze kara umowna może zostać zastrzeżona wyłącznie na wypadek niewykonania lub nienależytego wykonania zobowiązania niepieniężnego (art. 483 § 1 k.c.), podczas gdy obowiązek zapłaty za postój ma charakter pieniężny, a po drugie kara rażąco wygórowana podlega zmniejszeniu (art. 484 § 2 k.c.). Ponadto postanowienie wzorca umowy, które nakłada na konsumenta obowiązek zapłaty rażąco wygórowanej kary umownej, jako nieuzgodnione indywidualnie stanowi niedozwolone postanowienie umowne i nie wiąże konsumenta (art. 385¹ § 1 w związku z art. 385³ pkt 17 k.c.).",
      );
    }

    if (args.length > 0) {
      paragraphs.push(p(`Roszczenie jest bezzasadne z następujących powodów, przy czym zgodnie z art. 6 ${KC_FULL} ciężar udowodnienia faktów, z których wywodzą Państwo skutki prawne, spoczywa na Państwu:`));
      paragraphs.push(list(args));
    } else {
      paragraphs.push(
        p(
          `Zgodnie z art. 6 ${KC_FULL} ciężar udowodnienia faktu spoczywa na osobie, która z faktu tego wywodzi skutki prawne – to Państwo muszą wykazać zawarcie umowy, jej warunki, osobę, która ją zawarła, oraz naruszenie jej postanowień.`,
        ),
      );
    }

    // 4. Żądanie dowodów
    if (bool(answers, "arg_evidence")) {
      paragraphs.push(p("W związku z powyższym wzywam do przedstawienia:"));
      paragraphs.push(
        list([
          `regulaminu parkingu w brzmieniu obowiązującym w dniu ${eventDate} wraz z dowodem sposobu jego udostępnienia kierującym przed wjazdem`,
          "dokumentacji fotograficznej oznakowania wjazdu na parking i tablic informacyjnych z tego dnia",
          "zdjęć lub zapisów systemu z oznaczeniem daty i godziny wjazdu i wyjazdu pojazdu",
          "dokumentu potwierdzającego umocowanie Państwa do zawierania umów oraz dochodzenia roszczeń w imieniu właściciela lub zarządcy terenu",
          "szczegółowego wyliczenia żądanej kwoty ze wskazaniem jej podstawy",
        ]),
      );
    }

    // 5. RODO
    if (bool(answers, "arg_gdpr")) {
      paragraphs.push(
        p(
          "Jednocześnie, na podstawie art. 15 ust. 1 i 3 rozporządzenia Parlamentu Europejskiego i Rady (UE) 2016/679 z dnia 27 kwietnia 2016 r. (RODO), żądam informacji, z jakiego źródła pozyskali Państwo moje dane osobowe (art. 15 ust. 1 lit. g), w jakich celach i na jakiej podstawie prawnej są one przetwarzane, komu zostały lub zostaną ujawnione oraz przez jaki okres będą przechowywane, a także przekazania kopii przetwarzanych danych. Zgodnie z art. 12 ust. 3 RODO informacji tych należy udzielić bez zbędnej zwłoki, nie później niż w terminie miesiąca od otrzymania żądania.",
        ),
      );
    }

    // 6. Żądanie końcowe
    if (ai?.demand) {
      paragraphs.push(...paragraphsFromText(ai.demand));
    } else {
      paragraphs.push(
        p(
          `Wobec powyższego wnoszę o anulowanie wezwania do zapłaty nr ${noticeNo} i zaniechanie dalszego dochodzenia roszczenia, w tym przekazywania sprawy podmiotom windykacyjnym.`,
        ),
      );
    }
    paragraphs.push(
      p(
        `Niniejsze pismo nie stanowi uznania roszczenia w jakimkolwiek zakresie. Odpowiedź proszę przesłać na piśmie na adres wskazany w nagłówku${
          email ? ` lub na adres e-mail: ${email}` : ""
        }, w terminie 14 dni od otrzymania niniejszego pisma.`,
      ),
    );

    const attachments = attachmentsFromText(str(answers, "evidence_list", ""));
    const extra = [email ? `e-mail: ${email}` : "", phone ? `tel. ${phone}` : ""];

    return {
      sender: partyFromAnswers(answers, "sender", extra),
      recipient: partyFromAnswers(answers, "recipient"),
      place: str(answers, "sender_city"),
      date: formatDatePl(today),
      title: "ODPOWIEDŹ NA WEZWANIE DO ZAPŁATY",
      subject: `Dotyczy: wezwania nr ${noticeNo} z dnia ${noticeDate} – odmowa zapłaty i wezwanie do przedstawienia dowodów`,
      salutation: "Szanowni Państwo,",
      paragraphs: paragraphs.map(tidyParagraph),
      closing: "Z poważaniem",
      signatureName: str(answers, "sender_name"),
      attachments,
      previewParagraphCount: 2,
    };
  },
};
