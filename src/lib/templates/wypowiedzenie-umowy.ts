import type { Answers, LetterTemplate, Paragraph } from "./types";
import {
  bool,
  formatDatePl,
  heading,
  list,
  p,
  paragraphsFromText,
  partyFromAnswers,
  recipientQuestions,
  senderQuestions,
  str,
} from "./helpers";

/*
 * Wypowiedzenie umowy – 4 warianty (`contract_type`):
 *  - telecom: telefon / internet / TV – ustawa z 12 lipca 2024 r. Prawo komunikacji elektronicznej (PKE).
 *    Numery artykułów PKE [DO WERYFIKACJI] – w piśmie wyłącznie ogólne odesłanie do ustawy.
 *  - fitness: siłownia / klub / usługi ciągłe – art. 750 w zw. z art. 746 KC, art. 385¹ KC.
 *  - rental: najem lokalu mieszkalnego przez najemcę – art. 673 § 1–3 KC, art. 688 KC.
 *  - other: inna umowa – art. 365¹ KC (zobowiązania ciągłe bezterminowe).
 * Szczegóły i poziom pewności: docs/legal-review/wypowiedzenie-umowy.md
 */

const BLANK = "____________";

const MONTHS_LOCATIVE = [
  "styczniu", "lutym", "marcu", "kwietniu", "maju", "czerwcu",
  "lipcu", "sierpniu", "wrześniu", "październiku", "listopadzie", "grudniu",
];

/** Data z pola typu date (RRRR-MM-DD) jako lokalna północ – bez przesunięć strefy czasowej. */
function dateAnswer(answers: Answers, id: string): Date | undefined {
  const v = answers[id];
  if (typeof v !== "string") return undefined;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v.trim());
  if (!m) return undefined;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

/** Tekst użytkownika jako zdanie: wielka litera na początku, kropka na końcu, bez podwójnych spacji. */
function sentence(text: string): string {
  const t = text.replace(/\s+/g, " ").trim();
  if (!t) return t;
  const cap = t.charAt(0).toUpperCase() + t.slice(1);
  return /[.!?…]$/.test(cap) ? cap : `${cap}.`;
}

/** Mała litera na początku (chyba że to skrótowiec, np. „UKE”). */
function lowerFirst(text: string): string {
  return /^\p{Lu}\p{Lu}/u.test(text) ? text : text.charAt(0).toLowerCase() + text.slice(1);
}

/** Kończy zdanie kropką, chyba że już się nią kończy (np. „r.”). */
function dot(text: string): string {
  return /[.!?…]$/.test(text) ? text : `${text}.`;
}

/** Elementy listy z pola textarea (każdy w nowej linii lub po średniku). */
function lines(text: string | undefined): string[] {
  if (!text) return [];
  return text
    .split(/\r?\n|;/)
    .map((l) => l.replace(/^\s*(?:[-–•*]|\d+[.)])\s*/, "").replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

type ContractType = "telecom" | "fitness" | "rental" | "other";

function contractType(answers: Answers): ContractType {
  const v = str(answers, "contract_type", "other");
  return v === "telecom" || v === "fitness" || v === "rental" ? v : "other";
}

/** "umowę o świadczenie usług (karnet open)" – przedmiot wypowiedzenia w bierniku. */
function contractNounAcc(answers: Answers, type: ContractType): string {
  const service = str(answers, "service_description", "");
  const svc = service ? ` (${service})` : "";
  switch (type) {
    case "telecom":
      return `umowę o świadczenie usług komunikacji elektronicznej${svc}`;
    case "fitness":
      return `umowę o świadczenie usług${svc}`;
    case "rental":
      return `umowę najmu lokalu mieszkalnego położonego pod adresem: ${str(answers, "rental_address")},`;
    default:
      return `umowę${svc}`;
  }
}

/** Ostatni dzień miesiąca przesuniętego o `months` względem `base`. */
function endOfMonth(base: Date, months: number): Date {
  return new Date(base.getFullYear(), base.getMonth() + months + 1, 0);
}

/** Klauzula skutku wypowiedzenia – zawsze z „bezpiecznikiem” na wypadek błędnie wskazanego terminu. */
function effectClause(answers: Answers, type: ContractType): string {
  const endDate = dateAnswer(answers, "end_date");
  const notice = str(answers, "notice_period", "none");
  const reason = str(answers, "reason", "none");
  const fallback = "a jeżeli z umowy lub przepisów prawa wynika późniejszy termin rozwiązania – z upływem najbliższego dopuszczalnego terminu";

  if (endDate) {
    return `ze skutkiem na dzień ${formatDatePl(endDate)}, ${fallback}`;
  }
  if (type === "fitness" && reason === "important") {
    return "z ważnych powodów, ze skutkiem natychmiastowym, tj. z dniem doręczenia niniejszego pisma, a gdyby rozwiązanie umowy w tym trybie okazało się niedopuszczalne – z zachowaniem okresu wypowiedzenia przewidzianego w umowie";
  }
  switch (notice) {
    case "1m":
      return "z zachowaniem jednomiesięcznego okresu wypowiedzenia przewidzianego w umowie, liczonego od dnia doręczenia niniejszego pisma";
    case "3m":
      return "z zachowaniem trzymiesięcznego okresu wypowiedzenia przewidzianego w umowie, liczonego od dnia doręczenia niniejszego pisma";
    case "other":
      return `z zachowaniem okresu wypowiedzenia przewidzianego w umowie (${str(answers, "notice_period_other")}), liczonego od dnia doręczenia niniejszego pisma`;
  }
  // brak okresu wypowiedzenia w umowie
  switch (type) {
    case "rental":
      return "z zachowaniem ustawowego okresu wypowiedzenia, tj. na trzy miesiące naprzód na koniec miesiąca kalendarzowego";
    case "telecom":
      return "z zachowaniem okresu wypowiedzenia wynikającego z regulaminu świadczenia usług, a w razie jego braku – ze skutkiem na koniec bieżącego okresu rozliczeniowego";
    default:
      return "ze skutkiem niezwłocznym, a jeżeli z umowy lub przepisów prawa wynika termin wypowiedzenia – z jego zachowaniem";
  }
}

function isFixedTerm(answers: Answers): boolean {
  return str(answers, "fixed_term", "") === "fixed";
}

/** Czy okres, na jaki zawarto umowę, upłynął przed planowaną wysyłką pisma. */
function fixedTermExpired(answers: Answers): boolean {
  const end = dateAnswer(answers, "fixed_term_end");
  const send = dateAnswer(answers, "send_date");
  return isFixedTerm(answers) && !!end && !!send && end.getTime() < send.getTime();
}

function introParagraph(answers: Answers, type: ContractType): Paragraph {
  const date = formatDatePl(dateAnswer(answers, "contract_date"));
  const number = str(answers, "contract_number", "");
  const numberPart = number ? ` (numer umowy / klienta: ${number})` : "";
  return p(
    `Działając we własnym imieniu, niniejszym wypowiadam ${contractNounAcc(answers, type)} zawartą z Państwem w dniu ${date}${numberPart}, ${effectClause(answers, type)}.`,
  );
}

function factsParagraphs(answers: Answers, type: ContractType): Paragraph[] {
  const out: Paragraph[] = [];
  const fixedEnd = dateAnswer(answers, "fixed_term_end");
  let termSentence: string;
  if (!isFixedTerm(answers)) {
    termSentence = "Umowa została zawarta na czas nieokreślony.";
  } else if (fixedTermExpired(answers)) {
    termSentence = `Umowa została zawarta na czas określony do dnia ${dot(formatDatePl(fixedEnd))} Okres ten upłynął, wobec czego umowa obowiązuje obecnie na czas nieokreślony.`;
  } else {
    termSentence = dot(`Umowa została zawarta na czas określony${fixedEnd ? ` do dnia ${formatDatePl(fixedEnd)}` : ""}`);
  }

  const reason = str(answers, "reason", "none");
  const description = str(answers, "reason_description", "");
  let reasonSentence = "";
  if (reason === "important") {
    reasonSentence = ` Wypowiedzenie uzasadniają następujące okoliczności${description ? `: ${lowerFirst(sentence(description))}` : "."}`;
  } else if (reason === "terms_change") {
    reasonSentence = ` Wypowiedzenie składam w związku ze zmianą warunków umowy zaproponowaną przez Państwa. ${description ? sentence(description) : ""}`;
  } else if (type !== "rental" || !isFixedTerm(answers)) {
    reasonSentence = " Złożenie wypowiedzenia nie wymaga podawania jego przyczyny.";
  }

  // Najem – informacja o ustawowym terminie przy braku terminu umownego (szacunek przy doręczeniu w miesiącu wysyłki).
  let rentalSentence = "";
  const send = dateAnswer(answers, "send_date");
  if (
    type === "rental" &&
    !isFixedTerm(answers) &&
    str(answers, "notice_period", "none") === "none" &&
    !dateAnswer(answers, "end_date") &&
    send
  ) {
    rentalSentence = ` Przy doręczeniu niniejszego pisma w ${MONTHS_LOCATIVE[send.getMonth()]} ${send.getFullYear()} r. umowa ulegnie rozwiązaniu z dniem ${dot(formatDatePl(endOfMonth(send, 3)))}`;
  }

  out.push(p(`${termSentence}${reasonSentence}${rentalSentence}`.replace(/\s+/g, " ").trim()));
  return out;
}

function demandItems(answers: Answers, type: ContractType): string[] {
  const items: string[] = [];
  const email = str(answers, "sender_email", BLANK);
  items.push(
    bool(answers, "confirm_email")
      ? `potwierdzenie przyjęcia wypowiedzenia ze wskazaniem dnia rozwiązania umowy, przesłane na adres e-mail: ${email}`
      : "pisemne potwierdzenie przyjęcia wypowiedzenia ze wskazaniem dnia rozwiązania umowy",
  );
  if (type === "telecom" && isFixedTerm(answers) && !fixedTermExpired(answers)) {
    items.push(
      str(answers, "reason", "none") === "terms_change"
        ? "potwierdzenie, że w związku z wypowiedzeniem nie naliczają Państwo żadnych opłat ani roszczeń z tytułu przyznanej ulgi"
        : "wskazanie, czy w związku z wypowiedzeniem naliczają Państwo jakiekolwiek należności (w tym z tytułu przyznanej ulgi), wraz z ich wysokością i sposobem wyliczenia",
    );
  }
  if (type === "rental") {
    items.push("ustalenie terminu zwrotu lokalu i sporządzenia protokołu zdawczo-odbiorczego");
    items.push("zwrot kaucji zabezpieczającej, po rozliczeniu ewentualnych należności, na rachunek bankowy, który wskażę w protokole zdawczo-odbiorczym");
  } else {
    items.push("zaprzestanie naliczania opłat za okres po dniu rozwiązania umowy, w tym wyłączenie płatności cyklicznych i poleceń zapłaty związanych z umową");
  }
  if (type === "telecom" && bool(answers, "return_equipment")) {
    items.push("wskazanie sposobu, miejsca i terminu zwrotu udostępnionego mi sprzętu (np. routera, dekodera) – deklaruję gotowość jego zwrotu niezwłocznie po otrzymaniu tej informacji");
  }
  return items;
}

function legalParagraphs(answers: Answers, type: ContractType): Paragraph[] {
  const fixed = isFixedTerm(answers) && !fixedTermExpired(answers);
  switch (type) {
    case "telecom": {
      // [DO WERYFIKACJI] konkretne artykuły PKE (forma wypowiedzenia, potwierdzenie, zmiana warunków, ulga).
      const out = [
        p(
          "Oświadczenie składam na podstawie postanowień umowy oraz przepisów ustawy z dnia 12 lipca 2024 r. – Prawo komunikacji elektronicznej, która od 10 listopada 2024 r. zastąpiła ustawę – Prawo telekomunikacyjne. Przepisy tej ustawy umożliwiają konsumentowi złożenie oświadczenia o wypowiedzeniu umowy co najmniej w tej samej formie, w jakiej umowa została zawarta, a dostawcę usług zobowiązują do potwierdzenia przyjęcia takiego oświadczenia.",
        ),
      ];
      if (str(answers, "reason", "none") === "terms_change") {
        out.push(
          p(
            "Zgodnie z przepisami ustawy – Prawo komunikacji elektronicznej zmiana warunków umowy przez dostawcę usług uprawnia konsumenta do wypowiedzenia umowy bez ponoszenia z tego tytułu kosztów, w tym bez obowiązku zwrotu przyznanej ulgi, chyba że zmiana jest wyłącznie korzystna dla abonenta, ma charakter czysto administracyjny bez negatywnego wpływu na abonenta albo wynika bezpośrednio z przepisów prawa.",
          ),
        );
      }
      return out;
    }
    case "fitness":
      return [
        p(
          "Zgodnie z art. 750 Kodeksu cywilnego do umów o świadczenie usług, które nie są uregulowane innymi przepisami, stosuje się odpowiednio przepisy o zleceniu. Na podstawie art. 746 § 1 Kodeksu cywilnego usługobiorca może wypowiedzieć umowę w każdym czasie, a w myśl art. 746 § 3 Kodeksu cywilnego nie można zrzec się z góry uprawnienia do wypowiedzenia umowy z ważnych powodów.",
        ),
        p(
          "Postanowienia umowy lub regulaminu, które wyłączają lub ograniczają to uprawnienie albo uzależniają rezygnację od zapłaty rażąco wygórowanej kwoty, mogą stanowić niedozwolone postanowienia umowne w rozumieniu art. 385¹ § 1 Kodeksu cywilnego, które nie wiążą konsumenta.",
        ),
      ];
    case "rental": {
      const out = fixed
        ? [
            p(
              "Zgodnie z art. 673 § 3 Kodeksu cywilnego najem zawarty na czas oznaczony może zostać wypowiedziany przez każdą ze stron w wypadkach określonych w umowie. Wypowiedzenia dokonuję w oparciu o postanowienia umowy przewidujące takie uprawnienie.",
            ),
          ]
        : [
            p(
              "Zgodnie z art. 673 § 1 Kodeksu cywilnego najemca może wypowiedzieć najem zawarty na czas nieoznaczony z zachowaniem terminów umownych, a w ich braku – terminów ustawowych. Stosownie do art. 688 Kodeksu cywilnego, jeżeli czas trwania najmu lokalu nie jest oznaczony, a czynsz jest płatny miesięcznie, wypowiedzenie może nastąpić najpóźniej na trzy miesiące naprzód na koniec miesiąca kalendarzowego.",
            ),
          ];
      out.push(
        p(
          "Zgodnie z przepisami ustawy z dnia 21 czerwca 2001 r. o ochronie praw lokatorów, mieszkaniowym zasobie gminy i o zmianie Kodeksu cywilnego kaucja zabezpieczająca podlega zwrotowi w ciągu miesiąca od dnia opróżnienia lokalu, po potrąceniu należności wynajmującego z tytułu najmu.",
        ),
      );
      return out;
    }
    default:
      return fixed
        ? [p("Wypowiedzenia dokonuję na podstawie postanowień umowy przewidujących prawo jej wypowiedzenia przed upływem okresu, na który została zawarta.")]
        : [
            p(
              "Zgodnie z art. 365¹ Kodeksu cywilnego zobowiązanie o charakterze ciągłym, nieoznaczone co do czasu, wygasa po wypowiedzeniu przez dłużnika lub wierzyciela z zachowaniem terminów umownych, ustawowych lub zwyczajowych, a w razie braku takich terminów – niezwłocznie po wypowiedzeniu.",
            ),
          ];
  }
}

export const wypowiedzenieUmowy: LetterTemplate = {
  slug: "wypowiedzenie-umowy",
  name: "Wypowiedzenie umowy",
  category: "umowy",
  shortDescription:
    "Wypowiedz umowę z operatorem, siłownią, wynajmującym lub inną firmą – z właściwym okresem wypowiedzenia i podstawą prawną.",
  priceGrosze: 2499,
  icon: "✂️",
  estimatedMinutes: 5,
  sections: [
    { id: "sender", title: "Twoje dane", questions: senderQuestions() },
    {
      id: "recipient",
      title: "Druga strona umowy",
      description: "Dane firmy lub osoby, z którą masz umowę – przepisz je z umowy, faktury lub regulaminu.",
      questions: recipientQuestions("Druga strona umowy (operator, klub, wynajmujący)"),
    },
    {
      id: "contract",
      title: "Umowa i terminy",
      questions: [
        {
          id: "contract_type",
          label: "Jaką umowę wypowiadasz?",
          type: "radio",
          options: [
            { value: "telecom", label: "Telefon, internet lub telewizja (umowa z operatorem)" },
            { value: "fitness", label: "Siłownia, klub fitness lub inna usługa świadczona na bieżąco" },
            { value: "rental", label: "Najem mieszkania – jestem najemcą" },
            { value: "other", label: "Inna umowa (np. ochrona, serwis, prenumerata)" },
          ],
        },
        {
          id: "service_description",
          label: "Czego dotyczy umowa?",
          type: "text",
          required: false,
          placeholder: "np. internet światłowodowy, abonament nr 600 000 000, karnet open",
          help: "Krótko nazwij usługę – pomoże to firmie szybko odnaleźć Twoją umowę.",
          showIf: { questionId: "contract_type", equals: ["telecom", "fitness", "other"] },
        },
        {
          id: "rental_address",
          label: "Adres wynajmowanego mieszkania",
          type: "text",
          placeholder: "ul. Lipowa 5 m. 12, 00-001 Warszawa",
          showIf: { questionId: "contract_type", equals: "rental" },
        },
        {
          id: "contract_number",
          label: "Numer umowy lub numer klienta",
          type: "text",
          required: false,
          placeholder: "np. UM/2024/123456 lub nr klienta 987654",
          help: "Znajdziesz go na pierwszej stronie umowy, na fakturze lub w aplikacji klienta.",
        },
        {
          id: "contract_date",
          label: "Data zawarcia umowy",
          type: "date",
          help: "Jeśli nie pamiętasz dokładnie – wpisz datę z umowy lub pierwszej faktury.",
        },
        {
          id: "fixed_term",
          label: "Na jaki czas zawarto umowę?",
          type: "radio",
          options: [
            { value: "indefinite", label: "Na czas nieokreślony" },
            { value: "fixed", label: "Na czas określony (np. 24 miesiące, do konkretnej daty)" },
          ],
          help: "Najem na czas określony można wypowiedzieć tylko w przypadkach przewidzianych w umowie – sprawdź jej postanowienia.",
        },
        {
          id: "fixed_term_end",
          label: "Do kiedy obowiązuje umowa?",
          type: "date",
          required: false,
          help: "Jeśli ta data już minęła, umowa z operatorem zwykle trwa dalej na czas nieokreślony – pismo to uwzględni.",
          showIf: { questionId: "fixed_term", equals: "fixed" },
        },
        {
          id: "notice_period",
          label: "Okres wypowiedzenia przewidziany w umowie",
          type: "select",
          options: [
            { value: "none", label: "Umowa go nie określa / nie wiem" },
            { value: "1m", label: "1 miesiąc" },
            { value: "3m", label: "3 miesiące" },
            { value: "other", label: "Inny" },
          ],
          help: "Szukaj w umowie lub regulaminie hasła „wypowiedzenie”. Przy najmie bez zapisu w umowie obowiązują 3 miesiące na koniec miesiąca.",
        },
        {
          id: "notice_period_other",
          label: "Jaki okres wypowiedzenia przewiduje umowa?",
          type: "text",
          placeholder: "np. 30 dni ze skutkiem na koniec okresu rozliczeniowego",
          showIf: { questionId: "notice_period", equals: "other" },
        },
        {
          id: "end_date",
          label: "Z jakim dniem umowa ma się rozwiązać? (opcjonalnie)",
          type: "date",
          required: false,
          help: "Zostaw puste, aby rozwiązać umowę z zachowaniem okresu wypowiedzenia – to najbezpieczniejsze. Wpisz datę tylko wtedy, gdy jest zgodna z umową.",
        },
        {
          id: "send_date",
          label: "Kiedy planujesz wysłać lub złożyć wypowiedzenie?",
          type: "date",
          help: "Okres wypowiedzenia liczy się od dnia doręczenia pisma, a nie od dnia nadania – list polecony idzie zwykle 2–5 dni.",
        },
      ],
    },
    {
      id: "reason",
      title: "Powód wypowiedzenia",
      description: "Podanie powodu zwykle nie jest konieczne, ale przy ważnych powodach lub zmianie warunków umowy wzmacnia Twoją pozycję.",
      questions: [
        {
          id: "reason",
          label: "Czy podajesz powód wypowiedzenia?",
          type: "radio",
          options: [
            { value: "none", label: "Nie – wypowiadam bez podawania przyczyny" },
            { value: "important", label: "Tak – ważny powód (np. przeprowadzka, choroba, usługa nie jest należycie świadczona)" },
            { value: "terms_change", label: "Tak – firma zmieniła warunki umowy lub cennik" },
          ],
        },
        {
          id: "reason_description",
          label: "Opisz powód wypowiedzenia",
          type: "textarea",
          placeholder:
            "np. Od 1 września 2026 r. przeprowadzam się do Gdańska, gdzie klub nie ma placówek. Lekarz zalecił mi zaprzestanie treningów – zaświadczenie w załączeniu.",
          help: "Pisz konkretnie: co się stało, od kiedy, jakie masz dowody. Ten opis zostanie zredagowany w treści pisma.",
          showIf: { questionId: "reason", equals: ["important", "terms_change"] },
        },
      ],
    },
    {
      id: "extras",
      title: "Dodatkowe żądania i załączniki",
      questions: [
        {
          id: "return_equipment",
          label: "Mam sprzęt operatora do zwrotu (router, dekoder, modem)",
          type: "checkbox",
          required: false,
          help: "Pismo poprosi operatora o wskazanie sposobu zwrotu – zachowaj potwierdzenie oddania sprzętu.",
          showIf: { questionId: "contract_type", equals: "telecom" },
        },
        {
          id: "confirm_email",
          label: "Poproś o potwierdzenie przyjęcia wypowiedzenia na e-mail",
          type: "checkbox",
          required: false,
          help: "Użyjemy adresu e-mail podanego w sekcji „Twoje dane”.",
        },
        {
          id: "marketing_withdrawal",
          label: "Cofam zgody marketingowe i sprzeciwiam się marketingowi bezpośredniemu",
          type: "checkbox",
          required: false,
          help: "Po zakończeniu umowy firma nie powinna już wysyłać Ci ofert ani dzwonić z promocjami.",
        },
        {
          id: "attachments_list",
          label: "Załączniki (opcjonalnie)",
          type: "textarea",
          required: false,
          placeholder: "kopia umowy\nzaświadczenie lekarskie",
          help: "Każdy załącznik w nowej linii. Wypowiedzenie nie wymaga załączników.",
        },
      ],
    },
  ],
  legalBasis: [
    {
      act: "Ustawa z dnia 23 kwietnia 1964 r. – Kodeks cywilny",
      article: "art. 365¹",
      summary: "Bezterminową umowę o charakterze ciągłym można wypowiedzieć z zachowaniem terminów umownych, ustawowych lub zwyczajowych, a w ich braku – niezwłocznie.",
      url: "https://isap.sejm.gov.pl/isap.nsf/DocDetails.xsp?id=WDU19640160093",
    },
    {
      act: "Ustawa z dnia 23 kwietnia 1964 r. – Kodeks cywilny",
      article: "art. 746 § 1 i 3 w zw. z art. 750",
      summary: "Umowę o świadczenie usług (np. z siłownią) można wypowiedzieć w każdym czasie; nie można z góry zrzec się prawa wypowiedzenia z ważnych powodów.",
      url: "https://isap.sejm.gov.pl/isap.nsf/DocDetails.xsp?id=WDU19640160093",
    },
    {
      act: "Ustawa z dnia 23 kwietnia 1964 r. – Kodeks cywilny",
      article: "art. 385¹ § 1",
      summary: "Postanowienia umowy z konsumentem kształtujące jego prawa w sposób rażąco niekorzystny (np. blokada rezygnacji) nie wiążą konsumenta.",
      url: "https://isap.sejm.gov.pl/isap.nsf/DocDetails.xsp?id=WDU19640160093",
    },
    {
      act: "Ustawa z dnia 23 kwietnia 1964 r. – Kodeks cywilny",
      article: "art. 673 § 1–3 i art. 688",
      summary: "Najemca mieszkania na czas nieokreślony z czynszem miesięcznym może wypowiedzieć najem na 3 miesiące naprzód na koniec miesiąca; najem na czas określony – w przypadkach z umowy.",
      url: "https://isap.sejm.gov.pl/isap.nsf/DocDetails.xsp?id=WDU19640160093",
    },
    {
      act: "Ustawa z dnia 12 lipca 2024 r. – Prawo komunikacji elektronicznej",
      article: "przepisy o umowach o świadczenie usług komunikacji elektronicznej",
      summary: "Od 10 listopada 2024 r. regulują m.in. wypowiadanie umów z operatorami telefonii, internetu i telewizji (zastąpiły Prawo telekomunikacyjne).",
      url: "https://isap.sejm.gov.pl/isap.nsf/DocDetails.xsp?id=WDU20240001221",
    },
  ],
  deadlines: [
    {
      id: "notice_1m",
      label: "Koniec 1-miesięcznego okresu wypowiedzenia (najwcześniej)",
      fromQuestionId: "send_date",
      months: 1,
      description:
        "Okres wypowiedzenia biegnie od dnia doręczenia pisma, a nie od dnia nadania – faktyczny koniec przypadnie zwykle kilka dni później. Jeśli umowa przewiduje wypowiedzenie „na koniec miesiąca” lub „okresu rozliczeniowego”, umowa rozwiąże się z końcem tego okresu.",
    },
    {
      id: "notice_3m",
      label: "Koniec 3-miesięcznego okresu wypowiedzenia (najwcześniej)",
      fromQuestionId: "send_date",
      months: 3,
      description:
        "Dotyczy umów z 3-miesięcznym okresem wypowiedzenia, w tym najmu mieszkania na czas nieokreślony z czynszem płatnym miesięcznie (art. 688 KC) – wtedy najem kończy się z ostatnim dniem miesiąca kalendarzowego, np. pismo doręczone w październiku rozwiązuje najem z końcem stycznia.",
    },
  ],
  instructions: {
    whereToSend:
      "Wyślij wypowiedzenie na **adres korespondencyjny drugiej strony wskazany w umowie** lub w regulaminie. Operatorzy i sieci fitness często podają osobny adres do korespondencji (np. skrytkę pocztową) – sprawdź stopkę faktury, regulamin lub zakładkę „Kontakt” na stronie. Adres siedziby spółki znajdziesz też bezpłatnie w KRS (wyszukiwarka na stronie Ministerstwa Sprawiedliwości) lub w CEIDG. Wynajmującemu będącemu osobą prywatną wyślij pismo na adres z umowy najmu.",
    howToSend:
      "Najbezpieczniej: **list polecony za potwierdzeniem odbioru** – liczy się data doręczenia, a potwierdzenie jest dowodem w razie sporu. Możesz też złożyć pismo osobiście (w salonie, recepcji klubu) i poprosić o potwierdzenie przyjęcia na kopii.\n\nU operatora telekomunikacyjnego wypowiedzenie można złożyć co najmniej w tej formie, w jakiej zawarto umowę – jeśli umowa była zawarta przez internet, zwykle wystarczy formularz w panelu klienta lub e-mail; zachowaj potwierdzenie. E-mail wystarczy też wtedy, gdy umowa lub regulamin wprost dopuszcza tę formę. Umowę najmu wypowiadaj na piśmie, jeśli tak stanowi umowa – w razie wątpliwości wybierz list polecony.",
    afterSending:
      "Firma powinna potwierdzić przyjęcie wypowiedzenia – w piśmie prosimy o odpowiedź w ciągu 14 dni. Jeśli nie odpowie, a nadal pobiera opłaty po dniu rozwiązania umowy, złóż **reklamację** dotyczącą tych opłat. W sporze z operatorem możesz skorzystać z bezpłatnego postępowania polubownego przed Prezesem UKE, a w sporze z siłownią lub inną firmą – z pomocy **miejskiego lub powiatowego rzecznika konsumentów**. Przy najmie umów się z wynajmującym na zwrot lokalu i spisz protokół zdawczo-odbiorczy ze stanem liczników – od dnia opróżnienia lokalu biegnie miesięczny termin na zwrot kaucji.",
    checklist: [
      "Sprawdziłem/am w umowie okres wypowiedzenia i wymaganą formę wypowiedzenia.",
      "Pismo zawiera numer umowy lub numer klienta oraz moje dane zgodne z umową.",
      "Pismo jest podpisane odręcznie (lub wysyłam je w formie przewidzianej w umowie).",
      "Wysyłam list polecony za potwierdzeniem odbioru i zachowuję dowód nadania.",
      "Zapisałem/am w kalendarzu datę rozwiązania umowy i odwołałem/am płatności cykliczne po tej dacie.",
      "Mam plan zwrotu sprzętu operatora lub kluczy do mieszkania (protokół zdawczo-odbiorczy).",
    ],
  },
  seo: {
    title: "Wypowiedzenie umowy – wzór 2026 + generator pisma",
    metaDescription:
      "Wypowiedzenie umowy z operatorem, siłownią lub najmu mieszkania. Odpowiedz na kilka pytań i pobierz gotowe pismo z okresem wypowiedzenia i przepisami.",
    h1: "Wypowiedzenie umowy – wzór pisma i generator online",
    intro:
      "Chcesz zrezygnować z internetu, karnetu na siłownię albo wyprowadzić się z wynajmowanego mieszkania? Odpowiedz na kilka pytań, a przygotujemy wypowiedzenie z właściwym okresem wypowiedzenia, podstawą prawną i prośbą o potwierdzenie. Pismo pobierzesz w formacie DOCX lub PDF.",
    keywords: [
      "wypowiedzenie umowy wzór",
      "wypowiedzenie umowy z siłownią",
      "wypowiedzenie umowy najmu przez najemcę",
      "wypowiedzenie umowy internet wzór",
      "wypowiedzenie umowy z operatorem",
      "okres wypowiedzenia umowy najmu",
      "rezygnacja z karnetu na siłownię",
      "jak wypowiedzieć umowę",
    ],
    guide: [
      {
        heading: "Kiedy możesz wypowiedzieć umowę",
        body:
          "Wypowiedzenie to jednostronne oświadczenie, które kończy umowę po upływie okresu wypowiedzenia – druga strona nie musi się na nie zgadzać. Zasady zależą od rodzaju umowy:\n\n- **Umowy na czas nieokreślony** (np. abonament bez zobowiązania, najem bezterminowy) możesz wypowiedzieć zawsze – wystarczy zachować okres wypowiedzenia z umowy, a jeśli go nie ma, z przepisów. Gdy brakuje i jednego, i drugiego, zobowiązanie ciągłe wygasa niezwłocznie po wypowiedzeniu (art. 365¹ KC).\n- **Umowy z siłownią i podobne usługi** są umowami o świadczenie usług, do których stosuje się przepisy o zleceniu (art. 750 KC). Pozwalają one wypowiedzieć umowę w każdym czasie, a prawa do wypowiedzenia z ważnych powodów nie można się zrzec (art. 746 KC).\n- **Najem mieszkania na czas określony** możesz wypowiedzieć tylko w przypadkach wskazanych w umowie (art. 673 § 3 KC) – przed podpisaniem pisma sprawdź, czy umowa takie przypadki przewiduje.\n- **Umowy z operatorem** (telefon, internet, telewizja) od 10 listopada 2024 r. reguluje ustawa – Prawo komunikacji elektronicznej. Umowę bezterminową wypowiesz w każdej chwili, a przy umowie na czas określony operator może żądać zwrotu części ulgi.",
      },
      {
        heading: "Wypowiedzenie umowy krok po kroku",
        body:
          "1. **Znajdź umowę i regulamin.** Sprawdź numer umowy, okres wypowiedzenia, wymaganą formę i adres do korespondencji.\n2. **Ustal, kiedy umowa ma się skończyć.** Jeśli nie masz pewności co do daty, wybierz w generatorze rozwiązanie „z zachowaniem okresu wypowiedzenia” – pismo zawiera zastrzeżenie, że w razie błędu umowa rozwiąże się w najbliższym dopuszczalnym terminie.\n3. **Zdecyduj, czy podajesz powód.** Zwykle nie musisz. Warto go podać, gdy powołujesz się na ważne powody (np. przeprowadzkę, chorobę) albo na zmianę warunków umowy przez operatora.\n4. **Wygeneruj i podpisz pismo.** Wydrukuj je w dwóch egzemplarzach – jeden zostaje u Ciebie.\n5. **Wyślij listem poleconym za potwierdzeniem odbioru** albo złóż osobiście i poproś o potwierdzenie na kopii.\n6. **Pilnuj rozliczenia.** Odwołaj stałe zlecenia, zwróć sprzęt operatora, a przy najmie spisz protokół zdawczo-odbiorczy.",
      },
      {
        heading: "Okres wypowiedzenia – jak go policzyć",
        body:
          "Okres wypowiedzenia liczy się **od dnia doręczenia pisma** drugiej stronie, a nie od dnia, w którym je napisałeś lub nadałeś. Jeśli umowa przewiduje wypowiedzenie „na koniec miesiąca kalendarzowego”, umowa skończy się ostatniego dnia miesiąca, w którym upłynie okres wypowiedzenia.\n\nPrzykład: najem mieszkania na czas nieokreślony, czynsz płatny co miesiąc, brak zapisów w umowie. Obowiązuje wtedy termin z art. 688 KC – trzy miesiące naprzód na koniec miesiąca. Wypowiedzenie doręczone 20 października rozwiąże najem 31 stycznia. Jeśli list dotrze dopiero 2 listopada, najem skończy się 28 lutego – dlatego nie zwlekaj z wysyłką pod koniec miesiąca.\n\nU operatora telekomunikacyjnego okres wypowiedzenia jest zwykle krótki (często do końca okresu rozliczeniowego lub do miesiąca). W klubach fitness regulaminy przewidują najczęściej 1 miesiąc – postanowienie wydłużające go nadmiernie może być niedozwolone.",
      },
      {
        heading: "Umowa na czas określony – na co uważać",
        body:
          "Przy umowach z operatorem zawartych na czas określony z ulgą (tańszy telefon, niższy abonament) wcześniejsze wypowiedzenie może oznaczać obowiązek zwrotu części ulgi – proporcjonalnie do okresu, jaki pozostał do końca umowy. Jeśli jednak operator zmienia warunki umowy lub cennik, co do zasady możesz wypowiedzieć umowę bez takich kosztów. Po upływie okresu, na jaki zawarto umowę, zwykle przechodzi ona na czas nieokreślony i można ją wypowiedzieć bez kar.\n\nW siłowniach karnety „na 12 miesięcy bez możliwości rezygnacji” nie pozbawiają Cię prawa do wypowiedzenia z ważnych powodów. Klub może żądać wynagrodzenia za okres, w którym z usług korzystałeś, ale opłata za rezygnację nie może być rażąco wygórowana. Najem na czas określony bez zapisów o wypowiedzeniu można zakończyć zasadniczo tylko za porozumieniem stron – wtedy zamiast wypowiedzenia zaproponuj wynajmującemu porozumienie rozwiązujące.",
      },
      {
        heading: "Najczęstsze błędy",
        body:
          "- **Brak numeru umowy lub danych niezgodnych z umową** – firma może mieć kłopot z identyfikacją i opóźnić rozwiązanie umowy.\n- **Wysłanie wypowiedzenia na zły adres** (np. na adres salonu zamiast adresu korespondencyjnego) – liczy się doręczenie do właściwej strony.\n- **Wpisanie zbyt wczesnej daty rozwiązania** bez zastrzeżenia – nasze pismo zawiera klauzulę „najbliższego dopuszczalnego terminu”, która chroni przed tym błędem.\n- **Brak podpisu** – wypowiedzenie w formie papierowej podpisz odręcznie.\n- **Brak dowodu wysyłki** – bez potwierdzenia odbioru trudno udowodnić, kiedy pismo dotarło.\n- **Pozostawienie płatności cyklicznej** – wyłącz ją dopiero po dniu rozwiązania umowy, aby nie powstała zaległość.",
      },
      {
        heading: "Co jeśli firma nie przyjmuje wypowiedzenia",
        body:
          "Wypowiedzenie jest skuteczne z chwilą, gdy dotarło do drugiej strony tak, że mogła zapoznać się z jego treścią – zgoda firmy nie jest potrzebna. Jeśli firma nie potwierdza rozwiązania umowy, dalej wystawia faktury albo żąda wysokiej opłaty za rezygnację:\n\n1. Złóż **reklamację** faktury lub opłaty i powołaj się na doręczone wypowiedzenie (zachowaj potwierdzenie odbioru).\n2. Skontaktuj się z **miejskim lub powiatowym rzecznikiem konsumentów** – pomoc jest bezpłatna.\n3. W sporze z operatorem złóż wniosek o polubowne rozwiązanie sporu do **Prezesa UKE**.\n4. Nie ignoruj wezwań windykacyjnych – odpowiedz na nie na piśmie, załączając kopię wypowiedzenia.",
      },
    ],
    faq: [
      {
        question: "Czy muszę podać powód wypowiedzenia umowy?",
        answer:
          "Zwykle nie. Umowę na czas nieokreślony można wypowiedzieć bez podawania przyczyny. Powód warto wskazać, gdy wypowiadasz umowę z siłownią z ważnych powodów (np. choroba, przeprowadzka) albo umowę z operatorem w związku ze zmianą warunków – wtedy możesz uniknąć opłat.",
      },
      {
        question: "Od kiedy liczy się okres wypowiedzenia?",
        answer:
          "Od dnia doręczenia wypowiedzenia drugiej stronie. Jeśli umowa przewiduje wypowiedzenie na koniec miesiąca, umowa skończy się z ostatnim dniem miesiąca, w którym upłynie okres wypowiedzenia.",
      },
      {
        question: "Czy mogę wypowiedzieć umowę z operatorem mailem?",
        answer:
          "Tak, jeśli umowa była zawarta przez internet lub regulamin dopuszcza taką formę – konsument może wypowiedzieć umowę co najmniej w formie, w jakiej ją zawarł. Najpewniejszy dowód daje jednak list polecony za potwierdzeniem odbioru.",
      },
      {
        question: "Ile wynosi okres wypowiedzenia najmu mieszkania?",
        answer:
          "Przy najmie na czas nieokreślony obowiązuje termin z umowy. Jeśli umowa go nie określa, a czynsz płacisz co miesiąc – trzy miesiące naprzód na koniec miesiąca kalendarzowego (art. 688 KC). Najem na czas określony wypowiesz tylko w przypadkach przewidzianych w umowie.",
      },
      {
        question: "Czy siłownia może zablokować rezygnację z karnetu na 12 miesięcy?",
        answer:
          "Nie całkowicie. Do umowy z klubem stosuje się przepisy o zleceniu – nie można z góry zrzec się prawa do wypowiedzenia z ważnych powodów. Klub może rozliczyć okres, w którym korzystałeś z usług, ale rażąco wygórowana opłata za rezygnację może być klauzulą niedozwoloną.",
      },
      {
        question: "Czy operator może żądać kary za wcześniejsze wypowiedzenie?",
        answer:
          "Przy umowie na czas określony z ulgą operator może żądać zwrotu części ulgi, proporcjonalnie do okresu pozostałego do końca umowy. Jeśli wypowiadasz umowę z powodu zmiany warunków przez operatora albo po upływie okresu, na jaki ją zawarto, co do zasady nie powinien naliczać takich kosztów.",
      },
      {
        question: "Co zrobić, jeśli nie dostałem potwierdzenia wypowiedzenia?",
        answer:
          "Wypowiedzenie jest skuteczne po doręczeniu, nawet bez potwierdzenia. Zachowaj dowód nadania i potwierdzenie odbioru. Jeśli firma dalej nalicza opłaty, złóż reklamację i dołącz kopię wypowiedzenia, a w razie potrzeby zwróć się do rzecznika konsumentów.",
      },
    ],
  },
  ai: {
    context:
      "Pismo jest jednostronnym oświadczeniem konsumenta o wypowiedzeniu umowy (z operatorem telekomunikacyjnym, klubem fitness lub innym usługodawcą albo umowy najmu mieszkania przez najemcę), pisanym w pierwszej osobie przez osobę wypowiadającą. Opis faktów ma krótko i rzeczowo przedstawić umowę oraz – jeśli podano – powód wypowiedzenia, w tonie urzędowym, spokojnym, bez emocji, ocen i gróźb. Nie formułuj samego oświadczenia o wypowiedzeniu, dat skutku ani okresów wypowiedzenia – szablon wstawia je sam. W żądaniu nie powtarzaj prośby o potwierdzenie wypowiedzenia, zwrotu sprzętu, kaucji ani cofnięcia zgód marketingowych, bo szablon dodaje je osobno. Nie przywołuj przepisów, nazw aktów prawnych ani orzeczeń i pisz neutralnie płciowo (bez form typu „zawarłem/zawarłam”).",
    factQuestionIds: [
      "contract_type",
      "service_description",
      "contract_date",
      "fixed_term",
      "fixed_term_end",
      "reason",
      "reason_description",
    ],
  },
  render: ({ answers, ai, today }) => {
    const type = contractType(answers);
    const email = str(answers, "sender_email", "");
    const phone = str(answers, "sender_phone", "");
    const number = str(answers, "contract_number", "");
    const contractDate = formatDatePl(dateAnswer(answers, "contract_date"));

    const paragraphs: Paragraph[] = [introParagraph(answers, type)];

    // Stan faktyczny
    if (ai?.facts) {
      paragraphs.push(...paragraphsFromText(ai.facts));
      if (ai.justification) paragraphs.push(...paragraphsFromText(ai.justification));
    } else {
      paragraphs.push(...factsParagraphs(answers, type));
    }

    // Żądanie
    if (ai?.demand) {
      paragraphs.push(...paragraphsFromText(ai.demand));
      paragraphs.push(p("Jednocześnie proszę o:"));
    } else {
      paragraphs.push(p("W związku z powyższym proszę o:"));
    }
    paragraphs.push(list(demandItems(answers, type)));

    if (bool(answers, "marketing_withdrawal")) {
      paragraphs.push(
        p(
          "Jednocześnie, na podstawie art. 7 ust. 3 rozporządzenia Parlamentu Europejskiego i Rady (UE) 2016/679 z dnia 27 kwietnia 2016 r. (RODO), cofam wszelkie udzielone Państwu zgody na przetwarzanie moich danych osobowych w celach marketingowych, w tym zgody na przesyłanie informacji handlowych oraz na kontakt telefoniczny i elektroniczny w tych celach, a na podstawie art. 21 ust. 2 RODO wnoszę sprzeciw wobec przetwarzania moich danych na potrzeby marketingu bezpośredniego.",
        ),
      );
    }

    // Podstawa prawna – zawsze ze stałych tekstów szablonu
    paragraphs.push(heading("Podstawa prawna"));
    paragraphs.push(...legalParagraphs(answers, type));

    // Termin i konsekwencje
    paragraphs.push(heading("Termin odpowiedzi"));
    paragraphs.push(
      p(
        `Proszę o przesłanie potwierdzenia ${bool(answers, "confirm_email") ? "na wskazany adres e-mail" : "na piśmie na adres wskazany powyżej"} w terminie 14 dni od dnia doręczenia niniejszego pisma. Nie wyrażam zgody na obciążanie mnie opłatami za okres po dniu rozwiązania umowy – ewentualne obciążenia będę kwestionować z wykorzystaniem przysługujących mi środków prawnych.`,
      ),
    );

    const attachments = lines(str(answers, "attachments_list", ""));

    return {
      sender: partyFromAnswers(answers, "sender", [
        email ? `e-mail: ${email}` : "",
        phone ? `tel. ${phone}` : "",
      ]),
      recipient: partyFromAnswers(answers, "recipient"),
      place: str(answers, "sender_city"),
      date: formatDatePl(today),
      title:
        type === "rental"
          ? "WYPOWIEDZENIE UMOWY NAJMU LOKALU MIESZKALNEGO"
          : type === "telecom" || type === "fitness"
            ? "WYPOWIEDZENIE UMOWY O ŚWIADCZENIE USŁUG"
            : "WYPOWIEDZENIE UMOWY",
      subject: number
        ? `dot. umowy nr ${number} z dnia ${contractDate}`
        : `dot. umowy z dnia ${contractDate}`,
      salutation: "Szanowni Państwo,",
      paragraphs,
      closing: "Z poważaniem",
      signatureName: str(answers, "sender_name"),
      attachments,
      previewParagraphCount: 2,
    };
  },
};
