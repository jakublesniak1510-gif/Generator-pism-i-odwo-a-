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
 * Reklamacja (odwołanie) od opłaty dodatkowej za nieuiszczenie opłaty za postój w strefie płatnego parkowania (SPP).
 * Opłata publicznoprawna: ustawa o drogach publicznych (t.j. Dz. U. z 2025 r. poz. 889 – zweryfikowano art. 13, 13b, 13f, 40d).
 * Tryb reklamacji wynika z uchwały rady gminy – pismo odsyła do niej ogólnie.
 * Szczegóły: docs/legal-review/odwolanie-oplata-strefa-parkowania.md
 */

const UDP = "ustawy z dnia 21 marca 1985 r. o drogach publicznych";
const ISAP_UDP = "https://isap.sejm.gov.pl/isap.nsf/DocDetails.xsp?id=WDU19850140060";

type Entitlement = "subscription" | "disabled" | "electric" | "other";

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

/** „ (nr 123)” albo pusty ciąg */
function inParens(text: string): string {
  const t = text.trim().replace(/[.\s]+$/, "");
  return t ? ` (${t})` : "";
}

export const odwolanieStrefaParkowania: LetterTemplate = {
  slug: "odwolanie-oplata-strefa-parkowania",
  name: "Odwołanie od opłaty dodatkowej w strefie płatnego parkowania",
  category: "transport",
  shortDescription:
    "Reklamacja „kartki za wycieraczką” ze strefy płatnego parkowania – gdy opłaciłeś postój, masz abonament lub nie stałeś w strefie.",
  priceGrosze: 2499,
  icon: "🅿️",
  estimatedMinutes: 6,
  sections: [
    {
      id: "sender",
      title: "Twoje dane",
      description: "Dane osoby, do której skierowano zawiadomienie lub wezwanie (zwykle właściciela pojazdu).",
      questions: senderQuestions(),
    },
    {
      id: "recipient",
      title: "Zarząd dróg (jednostka obsługująca strefę)",
      description:
        "Reklamację składa się do jednostki wskazanej w zawiadomieniu – zwykle zarządu dróg miejskich lub zarządu strefy płatnego parkowania. Adres znajdziesz na zawiadomieniu oraz w BIP tej jednostki.",
      questions: recipientQuestions("Zarząd dróg / jednostka"),
    },
    {
      id: "notice",
      title: "Zawiadomienie o opłacie dodatkowej",
      questions: [
        {
          id: "notice_number",
          label: "Numer zawiadomienia (wezwania)",
          type: "text",
          placeholder: "np. SPP/2026/123456",
        },
        {
          id: "notice_date",
          label: "Data wystawienia zawiadomienia",
          type: "date",
        },
        {
          id: "complaint_deadline",
          label: "Do kiedy można złożyć reklamację (termin z zawiadomienia)?",
          type: "date",
          required: false,
          help: "Termin wynika z uchwały rady gminy i zwykle wynosi 7–14 dni. Sprawdź pouczenie na zawiadomieniu lub regulamin strefy w BIP.",
        },
        {
          id: "plate",
          label: "Numer rejestracyjny pojazdu",
          type: "text",
          placeholder: "np. WA 12345",
          validate: { maxLength: 12 },
        },
        {
          id: "event_date",
          label: "Data postoju (kontroli)",
          type: "date",
        },
        {
          id: "event_time",
          label: "Godzina kontroli z zawiadomienia (opcjonalnie)",
          type: "text",
          required: false,
          placeholder: "np. 14:35",
          validate: { maxLength: 20 },
        },
        {
          id: "event_place",
          label: "Miejsce postoju",
          type: "text",
          placeholder: "np. ul. Marszałkowska 10, Warszawa",
        },
        {
          id: "amount",
          label: "Kwota opłaty dodatkowej",
          type: "money",
          placeholder: "250.00",
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
            "np. Opłaciłem postój w aplikacji o 14:10 do 15:10, jednak omyłkowo wpisałem numer rejestracyjny z błędem (WA 1234S zamiast WA 12345). Pojazd stał przy ul. Marszałkowskiej 10 od 14:05 do 15:00.",
          help: "Podaj godziny postoju, sposób płatności i wszystko, co pomoże wyjaśnić sprawę.",
          validate: { maxLength: 2000 },
        },
      ],
    },
    {
      id: "arguments",
      title: "Argumenty i dowody",
      description: "Zaznacz argumenty pasujące do Twojej sytuacji – każdy zostanie opisany w piśmie z podstawą prawną.",
      questions: [
        {
          id: "arg_paid",
          label: "Opłata za postój została wniesiona (bilet, aplikacja, SMS)",
          type: "checkbox",
          required: false,
        },
        {
          id: "payment_details",
          label: "Szczegóły płatności",
          type: "text",
          placeholder: "np. aplikacja mobiParking, transakcja nr 12345678, 14:10–15:10, 4,50 zł",
          showIf: { questionId: "arg_paid", equals: "true" },
          validate: { maxLength: 300 },
        },
        {
          id: "arg_outside",
          label: "Pojazd nie stał w strefie albo stał poza dniami i godzinami jej obowiązywania",
          type: "checkbox",
          required: false,
        },
        {
          id: "arg_entitlement",
          label: "Miałem uprawnienie do postoju bez opłaty (abonament, karta parkingowa, pojazd elektryczny)",
          type: "checkbox",
          required: false,
        },
        {
          id: "entitlement_type",
          label: "Jakie uprawnienie?",
          type: "radio",
          help: "Abonamenty, identyfikatory mieszkańca i zasady dla posiadaczy karty parkingowej określa uchwała rady gminy – sprawdź jej treść. Zwolnienie pojazdów elektrycznych wynika z ustawy.",
          showIf: { questionId: "arg_entitlement", equals: "true" },
          options: [
            { value: "subscription", label: "Abonament lub identyfikator mieszkańca" },
            { value: "disabled", label: "Karta parkingowa osoby niepełnosprawnej" },
            { value: "electric", label: "Pojazd elektryczny (zielona tablica rejestracyjna)" },
            { value: "other", label: "Inne uprawnienie z regulaminu strefy" },
          ],
        },
        {
          id: "entitlement_details",
          label: "Numer abonamentu lub karty (opcjonalnie)",
          type: "text",
          required: false,
          placeholder: "np. abonament mieszkańca nr M/2026/0457 ważny do 31.12.2026",
          showIf: { questionId: "arg_entitlement", equals: "true" },
          validate: { maxLength: 200 },
        },
        {
          id: "arg_defective_notice",
          label: "Zawiadomienie nie zawiera danych pozwalających zweryfikować zarzut",
          type: "checkbox",
          required: false,
        },
        {
          id: "arg_not_driver",
          label: "To nie ja zaparkowałem pojazd w strefie",
          type: "checkbox",
          required: false,
        },
        {
          id: "evidence_list",
          label: "Twoje dowody (opcjonalnie)",
          type: "text",
          required: false,
          placeholder: "np. potwierdzenie transakcji z aplikacji; zdjęcie biletu za szybą; kopia abonamentu",
          help: "Kilka pozycji oddziel średnikami. Zostaną wymienione jako załączniki.",
        },
      ],
    },
  ],
  legalBasis: [
    {
      act: "Ustawa z dnia 21 marca 1985 r. o drogach publicznych",
      article: "art. 13 ust. 1 pkt 1",
      summary: "Opłata za postój w strefie płatnego parkowania obciąża korzystającego z drogi publicznej.",
      url: ISAP_UDP,
    },
    {
      act: "Ustawa z dnia 21 marca 1985 r. o drogach publicznych",
      article: "art. 13b ust. 1, 1a i 4",
      summary:
        "Opłatę pobiera się tylko za postój w strefie, w wyznaczonym miejscu, dniach i godzinach; rada gminy może wprowadzić abonamenty i zerowe stawki.",
      url: ISAP_UDP,
    },
    {
      act: "Ustawa z dnia 21 marca 1985 r. o drogach publicznych",
      article: "art. 13 ust. 3 pkt 1 lit. e",
      summary: "Pojazdy elektryczne są ustawowo zwolnione z opłat za postój w strefie płatnego parkowania.",
      url: ISAP_UDP,
    },
    {
      act: "Ustawa z dnia 21 marca 1985 r. o drogach publicznych",
      article: "art. 13f ust. 1–2",
      summary:
        "Opłatę dodatkową pobiera się wyłącznie za nieuiszczenie opłaty za postój; jej wysokość i sposób pobierania określa uchwała rady gminy.",
      url: ISAP_UDP,
    },
    {
      act: "Ustawa z dnia 21 marca 1985 r. o drogach publicznych",
      article: "art. 40d ust. 2–3",
      summary:
        "Opłata dodatkowa podlega egzekucji administracyjnej i przedawnia się po 5 latach od końca roku, w którym powinna być uiszczona.",
      url: ISAP_UDP,
    },
  ],
  deadlines: [
    {
      id: "complaint_deadline",
      label: "Termin na złożenie reklamacji (z zawiadomienia)",
      fromQuestionId: "complaint_deadline",
      days: 0,
      description:
        "Termin reklamacji nie wynika z ustawy, lecz z uchwały rady gminy w sprawie strefy płatnego parkowania – zwykle 7–14 dni od dnia wystawienia zawiadomienia. Złóż pismo przed tą datą.",
    },
  ],
  instructions: {
    whereToSend: `Reklamację kierujesz do **jednostki, która wystawiła zawiadomienie** – najczęściej jest to zarząd dróg miejskich, zarząd dróg i transportu albo zarząd strefy płatnego parkowania. Adres do reklamacji znajdziesz:

- w pouczeniu na zawiadomieniu (kartce za wycieraczką) lub na wezwaniu przesłanym pocztą,
- w **Biuletynie Informacji Publicznej** zarządu dróg (zakładka „Strefa płatnego parkowania” lub „Reklamacje”),
- w uchwale rady gminy w sprawie strefy płatnego parkowania (regulaminie strefy).`,
    howToSend: `Najbezpieczniej: **list polecony za potwierdzeniem odbioru** albo złożenie pisma **w kancelarii (biurze podawczym)** zarządu dróg – poproś o pieczątkę z datą na kopii.

Wiele miast przyjmuje reklamacje także **e-mailem, przez formularz na stronie albo przez ePUAP**. Sprawdź w regulaminie strefy, jakie formy są dopuszczalne. Przy e-mailu dołącz skan podpisanego pisma i dowody.

Liczy się termin wskazany w zawiadomieniu – nie zwlekaj.`,
    afterSending: `Termin rozpatrzenia reklamacji określa regulamin strefy – zwykle od 14 do 30 dni. Zarząd dróg może uwzględnić reklamację i anulować opłatę albo ją odrzucić.

Jeśli reklamacja zostanie odrzucona, a opłata nie zostanie zapłacona, gmina może wysłać **upomnienie**, a następnie wszcząć **egzekucję administracyjną** (art. 40d ust. 2 ustawy o drogach publicznych). W toku egzekucji możesz wnieść **zarzuty** – np. że obowiązek zapłaty nie istnieje albo się przedawnił.

Bezpłatnej porady udzielają punkty **nieodpłatnej pomocy prawnej**. Jeżeli uważasz, że wadliwa jest sama uchwała rady gminy w sprawie strefy, możesz ją zaskarżyć do **wojewódzkiego sądu administracyjnego** (skargę wnosi się za pośrednictwem rady gminy).`,
    checklist: [
      "Sprawdź termin na reklamację podany w zawiadomieniu.",
      "Przygotuj dowód płatności (potwierdzenie z aplikacji, zdjęcie biletu) lub uprawnienia (abonament, karta).",
      "Zrób zdjęcia miejsca postoju i oznakowania strefy, jeśli to możliwe.",
      "Wpisz dokładnie numer zawiadomienia i numer rejestracyjny pojazdu.",
      "Złóż pismo za potwierdzeniem (list polecony, biuro podawcze lub ePUAP) i zachowaj kopię.",
    ],
  },
  seo: {
    title: "Odwołanie od opłaty dodatkowej SPP – wzór 2026",
    metaDescription:
      "Wzór reklamacji od opłaty dodatkowej w strefie płatnego parkowania: opłacony postój, abonament, pojazd elektryczny, błędy w zawiadomieniu. Generator.",
    h1: "Odwołanie od opłaty dodatkowej w strefie płatnego parkowania",
    intro:
      "Znalazłeś za wycieraczką zawiadomienie o opłacie dodatkowej, choć opłaciłeś postój albo miałeś abonament? Złóż reklamację do zarządu dróg. Wypełnij formularz – przygotujemy pismo z podstawą prawną z ustawy o drogach publicznych i odwołaniem do regulaminu strefy.",
    keywords: [
      "odwołanie od opłaty dodatkowej strefa płatnego parkowania",
      "reklamacja opłaty dodatkowej SPP wzór",
      "opłata dodatkowa za parkowanie odwołanie",
      "kartka za wycieraczką strefa płatnego parkowania",
      "reklamacja ZDM opłata dodatkowa",
      "jak odwołać się od opłaty za parkowanie",
      "opłata dodatkowa SPP przedawnienie",
    ],
    guide: [
      {
        heading: "Czym jest opłata dodatkowa w strefie płatnego parkowania",
        body: `Strefę płatnego parkowania (SPP) na drogach publicznych ustanawia **rada gminy** w uchwale. Zgodnie z art. 13 ust. 1 pkt 1 ustawy o drogach publicznych korzystający z drogi musi zapłacić za postój w strefie – w wyznaczonym miejscu, w określone dni i w określonych godzinach (art. 13b). Jeśli tego nie zrobi, zarząd drogi pobiera **opłatę dodatkową** (art. 13f). Jej wysokość ustala rada gminy, przy czym ustawa ogranicza ją do 10% minimalnego wynagrodzenia.

To **nie jest mandat** ani kara za wykroczenie, tylko opłata publicznoprawna. Nie dostajesz punktów karnych, ale nieuiszczona opłata może zostać ściągnięta w drodze **egzekucji administracyjnej** – bez udziału sądu (art. 40d ust. 2).

Uwaga: zasady SPP dotyczą wyłącznie dróg publicznych. Parkingi przy galeriach, na osiedlach czy przy szpitalach to zwykle parkingi prywatne – tam obowiązują inne reguły i inny wzór pisma.`,
      },
      {
        heading: "Kiedy reklamacja ma szanse",
        body: `- **Opłata została wniesiona** – masz potwierdzenie z aplikacji, bilet z parkomatu lub potwierdzenie SMS. Częsty przypadek to literówka w numerze rejestracyjnym przy płatności w aplikacji – warto to wyjaśnić i dołączyć potwierdzenie transakcji.
- **Postój poza strefą lub poza godzinami** – opłata obowiązuje tylko w granicach strefy i w dniach oraz godzinach określonych w uchwale. Strefa musi być oznakowana.
- **Abonament lub identyfikator mieszkańca** – rada gminy może wprowadzić opłaty abonamentowe, zryczałtowane i zerowe stawki dla niektórych użytkowników (art. 13b ust. 4 pkt 2).
- **Karta parkingowa** – zasady postoju pojazdów oznaczonych kartą parkingową określa uchwała rady gminy; ustawa wymaga wyznaczenia w strefie stanowisk dla takich pojazdów.
- **Pojazd elektryczny** – jest ustawowo zwolniony z opłat za postój w SPP (art. 13 ust. 3 pkt 1 lit. e).
- **Braki w zawiadomieniu** – jeśli nie wiadomo, gdzie i kiedy przeprowadzono kontrolę, zażądaj dokumentacji.
- **To nie Ty zaparkowałeś** – opłata obciąża korzystającego z drogi, czyli osobę, która pozostawiła pojazd w strefie.`,
      },
      {
        heading: "Jak złożyć reklamację – krok po kroku",
        body: `1. **Sprawdź termin** – zwykle 7–14 dni od wystawienia zawiadomienia. Dokładny termin i adres znajdziesz w pouczeniu na zawiadomieniu.
2. **Zbierz dowody** – potwierdzenie płatności, zdjęcie biletu za szybą, kopię abonamentu lub karty, zdjęcia miejsca postoju i oznakowania.
3. **Wypełnij generator** – zaznacz argumenty pasujące do Twojej sytuacji.
4. **Złóż pismo** – listem poleconym, w biurze podawczym zarządu dróg albo elektronicznie (e-mail, formularz, ePUAP), jeśli regulamin to dopuszcza.
5. **Poczekaj na odpowiedź** – nie płać opłaty, jeśli uważasz ją za niezasadną, ale pilnuj korespondencji.
6. **Jeśli reklamacja zostanie odrzucona** – rozważ zapłatę albo dalsze kroki w toku egzekucji.`,
      },
      {
        heading: "Terminy i przedawnienie",
        body: `- **Termin na reklamację** – wynika z uchwały rady gminy (regulaminu strefy), nie z ustawy. Najczęściej wynosi 7 lub 14 dni.
- **Termin na zapłatę** – również określa uchwała. W wielu miastach opłata dodatkowa jest niższa, jeśli zapłacisz ją w krótkim terminie (np. 7 dni) – sprawdź, czy taka obniżka obowiązuje u Ciebie.
- **Przedawnienie** – obowiązek uiszczenia opłaty dodatkowej przedawnia się po **5 latach**, licząc od ostatniego dnia roku kalendarzowego, w którym opłata powinna zostać uiszczona (art. 40d ust. 3). Bieg przedawnienia może zostać przerwany, np. przez czynności egzekucyjne.`,
      },
      {
        heading: "Jakie dowody dołączyć do reklamacji",
        body: `Zarząd dróg rozpatruje reklamację na podstawie dokumentów, dlatego dobrze dobrane dowody są ważniejsze niż długi opis. Przydadzą się:

- **potwierdzenie płatności** – zrzut ekranu z aplikacji z numerem transakcji, strefą, godziną rozpoczęcia i zakończenia postoju oraz numerem rejestracyjnym; przy parkomacie – zdjęcie biletu lub wydruk z wyciągu bankowego, jeśli płaciłeś kartą,
- **dokument uprawnienia** – kopia abonamentu, identyfikatora mieszkańca, karty parkingowej (obie strony) albo dowodu rejestracyjnego pojazdu elektrycznego,
- **zdjęcia miejsca** – oznakowanie (lub jego brak) na początku strefy i przy miejscu postoju, wyznaczenie miejsc postojowych, tablica z godzinami obowiązywania,
- **dokumenty potwierdzające, że nie Ty parkowałeś** – np. potwierdzenie pobytu w innym miejscu w tym czasie.

Dołączaj kopie, a oryginały zachowaj. Jeżeli przy kontroli pojazd miał bilet za szybą, a kontroler go nie zauważył, wspomnij o tym w opisie – zarząd dróg może porównać zdjęcia z kontroli z danymi z parkomatu.`,
      },
      {
        heading: "Najczęstsze błędy",
        body: `- **Ignorowanie zawiadomienia** – brak reakcji prowadzi do upomnienia, a potem egzekucji z kosztami.
- **Reklamacja po terminie** – zarząd dróg może jej nie rozpatrzyć.
- **Brak dowodów** – sam opis nie wystarczy; dołącz potwierdzenie transakcji, kopię abonamentu, zdjęcia.
- **Mylenie SPP z parkingiem prywatnym** – inne przepisy, inna procedura.
- **Emocjonalny ton** – pisz rzeczowo i konkretnie, z numerem zawiadomienia i numerem rejestracyjnym.`,
      },
      {
        heading: "Co jeśli reklamacja zostanie odrzucona",
        body: `Odrzucenie reklamacji nie jest decyzją administracyjną, od której przysługuje odwołanie do SKO. Jeśli nie zapłacisz, gmina wyśle **upomnienie**, a po jego bezskutecznym upływie może wystawić **tytuł wykonawczy** i wszcząć egzekucję administracyjną.

W toku egzekucji możesz złożyć **zarzuty** – np. że obowiązek nie istnieje, został wykonany albo się przedawnił. Jeżeli uważasz, że sama uchwała o strefie jest wadliwa (np. strefa nie była prawidłowo oznakowana lub ustanowiona), możesz złożyć skargę do **wojewódzkiego sądu administracyjnego** za pośrednictwem rady gminy. Bezpłatnej porady udzielają punkty nieodpłatnej pomocy prawnej.`,
      },
    ],
    faq: [
      {
        question: "Ile mam czasu na reklamację opłaty dodatkowej?",
        answer:
          "Termin określa uchwała rady gminy w sprawie strefy płatnego parkowania – najczęściej 7 lub 14 dni od wystawienia zawiadomienia. Sprawdź pouczenie na zawiadomieniu albo regulamin strefy w BIP zarządu dróg.",
      },
      {
        question: "Opłaciłem postój, ale pomyliłem numer rejestracyjny w aplikacji – co zrobić?",
        answer:
          "Złóż reklamację i dołącz potwierdzenie transakcji z aplikacji (godzina, strefa, kwota, wpisany numer). Wyjaśnij omyłkę. Wiele zarządów dróg uwzględnia takie reklamacje, jeśli płatność dotyczyła tego samego miejsca i czasu.",
      },
      {
        question: "Czy pojazd elektryczny płaci za parkowanie w strefie?",
        answer:
          "Nie. Pojazdy elektryczne w rozumieniu ustawy o elektromobilności są zwolnione z opłat za postój w strefie płatnego parkowania (art. 13 ust. 3 pkt 1 lit. e ustawy o drogach publicznych). Zwolnienie nie obejmuje hybryd.",
      },
      {
        question: "Czy z kartą parkingową mogę parkować w strefie za darmo?",
        answer:
          "Zależy od uchwały rady gminy. Ustawa wymaga wyznaczenia w strefie stanowisk dla pojazdów z kartą parkingową, a wiele miast przewiduje dla nich zerową stawkę także poza tymi stanowiskami. Sprawdź regulamin strefy w swoim mieście.",
      },
      {
        question: "Czy opłata dodatkowa to mandat?",
        answer:
          "Nie. To opłata publicznoprawna pobierana przez zarząd drogi. Nie wiążą się z nią punkty karne, ale nieuiszczona opłata może zostać ściągnięta w egzekucji administracyjnej.",
      },
      {
        question: "Kiedy opłata dodatkowa się przedawnia?",
        answer:
          "Po 5 latach, licząc od końca roku kalendarzowego, w którym należało ją uiścić (art. 40d ust. 3 ustawy o drogach publicznych). Czynności egzekucyjne mogą jednak przerwać bieg przedawnienia.",
      },
      {
        question: "Nie ja parkowałem – czy muszę płacić?",
        answer:
          "Opłata obciąża korzystającego z drogi, czyli osobę, która pozostawiła pojazd w strefie. Zarząd dróg zwykle kieruje wezwanie do właściciela pojazdu, dlatego w reklamacji wyjaśnij, że nie Ty zaparkowałeś. Sposób dalszego postępowania (np. wskazanie kierującego) zależy od regulaminu strefy.",
      },
    ],
  },
  ai: {
    context:
      "Reklamacja kierowcy lub właściciela pojazdu od opłaty dodatkowej nałożonej przez gminny zarząd dróg za nieuiszczenie opłaty za postój w strefie płatnego parkowania. Opis faktów ma chronologicznie przedstawić miejsce, datę i godziny postoju, sposób i czas wniesienia opłaty lub posiadane uprawnienie oraz okoliczności kontroli – wyłącznie na podstawie odpowiedzi użytkownika. Żądanie to uwzględnienie reklamacji i anulowanie opłaty dodatkowej. Ton urzędowy, rzeczowy, bez emocji i bez gróźb. Nie powołuj przepisów ani uchwał – szablon dodaje je sam.",
    factQuestionIds: [
      "notice_number",
      "notice_date",
      "plate",
      "event_date",
      "event_time",
      "event_place",
      "amount",
      "situation_description",
      "payment_details",
      "entitlement_type",
      "entitlement_details",
    ],
  },
  render: ({ answers, ai, today }) => {
    const noticeNo = str(answers, "notice_number");
    const noticeDate = formatDatePl(str(answers, "notice_date", ""));
    const eventDate = formatDatePl(str(answers, "event_date", ""));
    const time = str(answers, "event_time", "");
    const amount = formatMoneyPl(num(answers, "amount"));
    const plate = str(answers, "plate");
    const place = str(answers, "event_place");
    const email = str(answers, "sender_email", "");
    const phone = str(answers, "sender_phone", "");
    const deadlineIso = str(answers, "complaint_deadline", "");
    const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(
      today.getDate(),
    ).padStart(2, "0")}`;

    const paragraphs: Paragraph[] = [];

    // 1. Wstęp
    paragraphs.push(
      p(
        `Niniejszym składam reklamację od opłaty dodatkowej w kwocie ${amount}, nałożonej zawiadomieniem nr ${noticeNo} z dnia ${noticeDate} w związku ze stwierdzeniem braku opłaty za postój pojazdu o numerze rejestracyjnym ${plate} w strefie płatnego parkowania w dniu ${eventDate}${
          time ? ` o godz. ${time}` : ""
        } (miejsce: ${place}).${
          deadlineIso && deadlineIso >= todayIso ? " Reklamację składam w terminie wskazanym w zawiadomieniu." : ""
        }`,
      ),
    );

    // 2. Stan faktyczny
    if (ai) {
      paragraphs.push(...paragraphsFromText(ai.facts));
      paragraphs.push(...paragraphsFromText(ai.justification));
    } else {
      const user = userParagraphs(str(answers, "situation_description"));
      paragraphs.push(p(user[0] ?? "____________"));
      user.slice(1).forEach((t) => paragraphs.push(p(t)));
    }

    // 3. Podstawa prawna i argumenty – stałe teksty szablonu
    paragraphs.push(
      p(
        `Zgodnie z art. 13 ust. 1 pkt 1 ${UDP} korzystający z dróg publicznych są obowiązani do ponoszenia opłat za postój pojazdów samochodowych na drogach publicznych w strefie płatnego parkowania, a opłatę dodatkową pobiera się wyłącznie za nieuiszczenie tych opłat (art. 13f ust. 1 tej ustawy). Wysokość opłaty dodatkowej oraz sposób jej pobierania określa rada gminy (art. 13f ust. 2), a niniejszą reklamację składam w trybie przewidzianym w uchwale rady gminy w sprawie strefy płatnego parkowania i w pouczeniu zawartym w zawiadomieniu.`,
      ),
    );

    const args: string[] = [];
    if (bool(answers, "arg_paid")) {
      args.push(
        `Opłata za postój została uiszczona${inParens(
          str(answers, "payment_details", ""),
        )}. Nie zaszła zatem przesłanka pobrania opłaty dodatkowej określona w art. 13f ust. 1 ustawy.`,
      );
    }
    if (bool(answers, "arg_outside")) {
      args.push(
        "Postój nie podlegał obowiązkowi uiszczenia opłaty. Opłatę pobiera się wyłącznie za postój w strefie płatnego parkowania, w wyznaczonym miejscu, w określone dni i w określonych godzinach (art. 13b ust. 1 i 1a ustawy), wskazanych w uchwale rady gminy. Pojazd nie był zaparkowany w miejscu ani w czasie, w którym opłata obowiązywała.",
      );
    }
    if (bool(answers, "arg_entitlement")) {
      const type = str(answers, "entitlement_type", "other") as Entitlement;
      const details = inParens(str(answers, "entitlement_details", ""));
      const texts: Record<Entitlement, string> = {
        subscription: `W dniu postoju pojazd był objęty ważnym abonamentem (identyfikatorem) uprawniającym do postoju w strefie${details}. Możliwość wprowadzenia opłat abonamentowych, zryczałtowanych oraz zerowej stawki opłaty dla niektórych użytkowników drogi przewiduje art. 13b ust. 4 pkt 2 ustawy, a uprawnienie to wynika z uchwały rady gminy w sprawie strefy płatnego parkowania.`,
        disabled: `Pojazd był oznaczony ważną kartą parkingową${details}, co zgodnie z zasadami określonymi w uchwale rady gminy w sprawie strefy płatnego parkowania, podjętej na podstawie art. 13b ust. 4 ustawy, uprawniało do postoju bez obowiązku wnoszenia opłaty.`,
        electric: `Pojazd jest pojazdem elektrycznym w rozumieniu art. 2 pkt 12 ustawy z dnia 11 stycznia 2018 r. o elektromobilności i paliwach alternatywnych${details}. Zgodnie z art. 13 ust. 3 pkt 1 lit. e ${UDP} pojazdy elektryczne są zwolnione z opłat za postój w strefie płatnego parkowania, a zatem nie było podstaw do pobrania opłaty dodatkowej.`,
        other: `W dniu postoju przysługiwało mi uprawnienie do postoju bez obowiązku wnoszenia opłaty${details}, wynikające z uchwały rady gminy w sprawie strefy płatnego parkowania.`,
      };
      args.push(texts[type] ?? texts.other);
    }
    if (bool(answers, "arg_defective_notice")) {
      args.push(
        "Zawiadomienie nie zawiera danych pozwalających zweryfikować zasadność opłaty dodatkowej, w szczególności precyzyjnego oznaczenia miejsca i czasu kontroli oraz sposobu stwierdzenia braku opłaty, co uniemożliwia rzetelne odniesienie się do stawianego zarzutu.",
      );
    }
    if (bool(answers, "arg_not_driver")) {
      args.push(
        `Obowiązek uiszczenia opłaty za postój spoczywa na korzystającym z drogi publicznej (art. 13 ust. 1 ustawy), tj. na osobie, która pozostawiła pojazd w strefie. Osoba podpisana pod niniejszym pismem w dniu ${eventDate} nie kierowała pojazdem i nie pozostawiła go w strefie płatnego parkowania.`,
      );
    }

    if (args.length > 0) {
      paragraphs.push(p("Opłata dodatkowa nie jest należna z następujących powodów:"));
      paragraphs.push(list(args));
    }
    if (args.length === 0 || bool(answers, "arg_defective_notice")) {
      paragraphs.push(
        p(
          "Wnoszę o przedstawienie dokumentacji sporządzonej podczas kontroli, w tym zdjęć pojazdu z widocznym miejscem postoju oraz datą i godziną, a także danych z systemu płatności dotyczących wskazanego numeru rejestracyjnego.",
        ),
      );
    }

    // 4. Żądanie
    if (ai?.demand) {
      paragraphs.push(...paragraphsFromText(ai.demand));
    } else {
      paragraphs.push(
        p(
          `Wobec powyższego wnoszę o uwzględnienie reklamacji i anulowanie opłaty dodatkowej nałożonej zawiadomieniem nr ${noticeNo}, a do czasu rozpatrzenia reklamacji – o wstrzymanie czynności zmierzających do jej przymusowego ściągnięcia.`,
        ),
      );
    }

    // 5. Odpowiedź
    paragraphs.push(
      p(
        `Proszę o pisemne rozpatrzenie reklamacji i przesłanie rozstrzygnięcia na adres wskazany w nagłówku pisma${
          email ? ` lub na adres e-mail: ${email}` : ""
        }.`,
      ),
    );

    const attachments: string[] = ["Kopia zawiadomienia o opłacie dodatkowej"];
    attachments.push(...attachmentsFromText(str(answers, "evidence_list", "")));
    const extra = [email ? `e-mail: ${email}` : "", phone ? `tel. ${phone}` : ""];

    return {
      sender: partyFromAnswers(answers, "sender", extra),
      recipient: partyFromAnswers(answers, "recipient"),
      place: str(answers, "sender_city"),
      date: formatDatePl(today),
      title: "REKLAMACJA OD OPŁATY DODATKOWEJ",
      subject: `Dotyczy: zawiadomienia nr ${noticeNo} z dnia ${noticeDate} – opłata dodatkowa w strefie płatnego parkowania, pojazd ${plate}`,
      salutation: "Szanowni Państwo,",
      paragraphs: paragraphs.map(tidyParagraph),
      closing: "Z poważaniem",
      signatureName: str(answers, "sender_name"),
      attachments,
      previewParagraphCount: 2,
    };
  },
};
