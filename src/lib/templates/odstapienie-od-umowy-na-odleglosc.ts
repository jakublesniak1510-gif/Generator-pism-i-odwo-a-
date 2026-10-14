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
 * Oświadczenie o odstąpieniu od umowy zawartej na odległość lub poza lokalem przedsiębiorstwa.
 * Podstawa: ustawa o prawach konsumenta, art. 27–38 (t.j. Dz. U. z 2026 r. poz. 1244 – zweryfikowano).
 * Szczegóły i wątpliwości: docs/legal-review/odstapienie-od-umowy-na-odleglosc.md
 */

const UPK = "ustawy z dnia 30 maja 2014 r. o prawach konsumenta";
const ISAP_UPK = "https://isap.sejm.gov.pl/isap.nsf/DocDetails.xsp?id=WDU20140000827";
const DAY_MS = 24 * 60 * 60 * 1000;

type Kind = "goods" | "service" | "digital";
type Channel = "online" | "phone" | "off_premises" | "visit" | "trip";

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

function parseIso(value: Answers[string]): Date | undefined {
  if (typeof value !== "string") return undefined;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!m) return undefined;
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
}

function addMonthsUtc(d: Date, months: number): Date {
  const r = new Date(d.getTime());
  const day = r.getUTCDate();
  r.setUTCDate(1);
  r.setUTCMonth(r.getUTCMonth() + months);
  const last = new Date(Date.UTC(r.getUTCFullYear(), r.getUTCMonth() + 1, 0)).getUTCDate();
  r.setUTCDate(Math.min(day, last));
  return r;
}

const KIND_GENITIVE: Record<Kind, string> = {
  goods: "sprzedaży",
  service: "o świadczenie usługi",
  digital: "o dostarczanie treści cyfrowej lub usługi cyfrowej",
};

const CHANNEL_PHRASE: Record<Channel, string> = {
  online: "zawartej na odległość za pośrednictwem internetu",
  phone: "zawartej na odległość za pośrednictwem telefonu",
  off_premises: "zawartej poza lokalem przedsiębiorstwa",
  visit: "zawartej poza lokalem przedsiębiorstwa podczas nieumówionej wizyty przedsiębiorcy w miejscu mojego zamieszkania",
  trip: "zawartej poza lokalem przedsiębiorstwa podczas wycieczki zorganizowanej przez przedsiębiorcę",
};

export const odstapienieOdUmowyNaOdleglosc: LetterTemplate = {
  slug: "odstapienie-od-umowy-na-odleglosc",
  name: "Odstąpienie od umowy zawartej na odległość",
  category: "konsument",
  shortDescription:
    "Zwrot zakupu ze sklepu internetowego, z telefonu lub z pokazu w 14 dni – bez podawania przyczyny.",
  priceGrosze: 2499,
  icon: "📦",
  estimatedMinutes: 5,
  sections: [
    {
      id: "sender",
      title: "Twoje dane",
      description: "Podaj dane, których użyłeś przy zamówieniu – ułatwi to sprzedawcy jego odnalezienie.",
      questions: senderQuestions(),
    },
    {
      id: "recipient",
      title: "Sprzedawca lub usługodawca",
      description:
        "Dane firmy znajdziesz w regulaminie sklepu, w potwierdzeniu zamówienia, na fakturze albo w umowie podpisanej na pokazie.",
      questions: recipientQuestions("Sprzedawca / usługodawca"),
    },
    {
      id: "contract",
      title: "Umowa i zamówienie",
      questions: [
        {
          id: "contract_kind",
          label: "Czego dotyczy umowa?",
          type: "radio",
          options: [
            { value: "goods", label: "Zakupu rzeczy (towaru)" },
            { value: "service", label: "Usługi (np. abonament, kurs, naprawa, umowa z operatorem)" },
            { value: "digital", label: "Treści lub usługi cyfrowej (np. e-book, aplikacja, subskrypcja online)" },
          ],
        },
        {
          id: "contract_channel",
          label: "Jak zawarłeś umowę?",
          type: "radio",
          help: "Przy nieumówionej wizycie w domu lub na wycieczce masz 30 dni zamiast 14.",
          options: [
            { value: "online", label: "Przez internet (sklep internetowy, aplikacja, e-mail)" },
            { value: "phone", label: "Przez telefon" },
            { value: "off_premises", label: "Poza siedzibą firmy – np. na pokazie, targach, w umówionym miejscu" },
            { value: "visit", label: "Podczas nieumówionej wizyty przedstawiciela w moim domu" },
            { value: "trip", label: "Podczas wycieczki zorganizowanej przez sprzedawcę" },
          ],
        },
        {
          id: "order_date",
          label: "Data złożenia zamówienia (zawarcia umowy)",
          type: "date",
          showIf: { questionId: "contract_kind", equals: "goods" },
        },
        {
          id: "contract_date",
          label: "Data zawarcia umowy",
          type: "date",
          help: "Przy usługach i treściach cyfrowych 14 dni liczy się od dnia zawarcia umowy.",
          showIf: { questionId: "contract_kind", equals: ["service", "digital"] },
        },
        {
          id: "received_date",
          label: "Data otrzymania towaru",
          type: "date",
          help: "Dzień, w którym Ty (lub wskazana przez Ciebie osoba – ale nie kurier) odebrałeś przesyłkę. Przy kilku paczkach – data odbioru ostatniej.",
          showIf: { questionId: "contract_kind", equals: "goods" },
        },
        {
          id: "order_number",
          label: "Numer zamówienia lub umowy",
          type: "text",
          required: false,
          placeholder: "np. 2026/10/123456",
        },
        {
          id: "items",
          label: "Co zamówiłeś?",
          type: "text",
          placeholder: "np. słuchawki Sony WH-1000XM6, kolor czarny, 1 szt.",
          validate: { maxLength: 300 },
        },
        {
          id: "amount",
          label: "Łączna zapłacona kwota (z kosztami dostawy)",
          type: "money",
          placeholder: "1299.00",
          help: "Wpisz 0, jeśli jeszcze nic nie zapłaciłeś (np. przy usłudze płatnej z góry co miesiąc).",
        },
        {
          id: "informed",
          label: "Czy sprzedawca poinformował Cię o prawie odstąpienia od umowy?",
          type: "radio",
          help: "Informacja powinna być w regulaminie, umowie lub w e-mailu potwierdzającym zamówienie. Brak pouczenia wydłuża termin o 12 miesięcy.",
          options: [
            { value: "yes", label: "Tak" },
            { value: "no", label: "Nie" },
            { value: "unsure", label: "Nie wiem" },
          ],
        },
      ],
    },
    {
      id: "facts",
      title: "Okoliczności (opcjonalnie)",
      description: "Odstąpienie nie wymaga podania przyczyny. Wypełnij, jeśli chcesz coś dodać – np. o problemach z kontaktem.",
      questions: [
        {
          id: "circumstances",
          label: "Dodatkowe informacje",
          type: "textarea",
          required: false,
          placeholder:
            "np. Przesyłkę odebrałem 3 października. Formularz zwrotu na stronie sklepu nie działał, dlatego wysyłam oświadczenie pisemnie.",
          help: "Nie musisz uzasadniać decyzji. Podaj tylko fakty istotne dla zwrotu.",
          validate: { maxLength: 1500 },
        },
      ],
    },
    {
      id: "refund",
      title: "Zwrot pieniędzy i towaru",
      questions: [
        {
          id: "refund_method",
          label: "Jak chcesz otrzymać zwrot pieniędzy?",
          type: "radio",
          help: "Co do zasady sprzedawca zwraca pieniądze tą samą metodą, którą płaciłeś.",
          options: [
            { value: "same", label: "Tą samą metodą, którą płaciłem" },
            { value: "bank", label: "Przelewem na wskazany rachunek bankowy" },
          ],
        },
        {
          id: "bank_account",
          label: "Numer rachunku bankowego",
          type: "text",
          placeholder: "PL 00 0000 0000 0000 0000 0000 0000",
          showIf: { questionId: "refund_method", equals: "bank" },
          validate: { maxLength: 40 },
        },
        {
          id: "goods_return",
          label: "Jak zwrócisz towar?",
          type: "radio",
          showIf: { questionId: "contract_kind", equals: "goods" },
          options: [
            { value: "with_letter", label: "Odsyłam towar razem z tym oświadczeniem" },
            { value: "later", label: "Odeślę towar osobno, najpóźniej w ciągu 14 dni" },
            {
              value: "pickup",
              label: "Towar jest duży i nie da się go wysłać pocztą – proszę o odbiór (umowa zawarta poza siedzibą firmy)",
            },
          ],
        },
        {
          id: "att_order",
          label: "Załączam potwierdzenie zamówienia lub umowę",
          type: "checkbox",
          required: false,
        },
        {
          id: "att_payment",
          label: "Załączam dowód zapłaty",
          type: "checkbox",
          required: false,
        },
      ],
    },
  ],
  legalBasis: [
    {
      act: "Ustawa z dnia 30 maja 2014 r. o prawach konsumenta",
      article: "art. 27",
      summary:
        "Konsument może odstąpić od umowy zawartej na odległość lub poza lokalem w 14 dni bez podania przyczyny; po nieumówionej wizycie lub wycieczce – w 30 dni.",
      url: ISAP_UPK,
    },
    {
      act: "Ustawa z dnia 30 maja 2014 r. o prawach konsumenta",
      article: "art. 28–29",
      summary:
        "Termin liczy się od objęcia towaru w posiadanie (usługi – od zawarcia umowy); bez pouczenia o prawie odstąpienia wydłuża się o 12 miesięcy.",
      url: ISAP_UPK,
    },
    {
      act: "Ustawa z dnia 30 maja 2014 r. o prawach konsumenta",
      article: "art. 30–31",
      summary:
        "Oświadczenie można złożyć w dowolnej formie; wystarczy wysłać je przed upływem terminu. Umowę uważa się za niezawartą.",
      url: ISAP_UPK,
    },
    {
      act: "Ustawa z dnia 30 maja 2014 r. o prawach konsumenta",
      article: "art. 32 i 34",
      summary:
        "Sprzedawca zwraca wszystkie płatności (z kosztem najtańszej dostawy) w 14 dni; konsument odsyła towar w 14 dni od odstąpienia.",
      url: ISAP_UPK,
    },
    {
      act: "Ustawa z dnia 30 maja 2014 r. o prawach konsumenta",
      article: "art. 38",
      summary:
        "Wyjątki – np. towary na zamówienie, szybko psujące się, rozpakowane produkty higieniczne, w pełni wykonane usługi.",
      url: ISAP_UPK,
    },
  ],
  deadlines: [
    {
      id: "withdrawal_goods",
      label: "Termin na odstąpienie – zakup towaru",
      fromQuestionId: "received_date",
      days: 14,
      description:
        "14 dni od dnia, w którym otrzymałeś towar (art. 27 ust. 1 i art. 28 pkt 1 ustawy o prawach konsumenta). Przy nieumówionej wizycie w domu lub wycieczce termin wynosi 30 dni. Wystarczy wysłać oświadczenie przed upływem terminu.",
    },
    {
      id: "withdrawal_service",
      label: "Termin na odstąpienie – usługa lub treść cyfrowa",
      fromQuestionId: "contract_date",
      days: 14,
      description:
        "Dla usług i treści cyfrowych 14 dni liczy się od dnia zawarcia umowy (art. 28 pkt 2). Przy nieumówionej wizycie w domu lub wycieczce termin wynosi 30 dni. Wystarczy wysłać oświadczenie przed upływem terminu.",
    },
    {
      id: "withdrawal_no_info",
      label: "Termin, jeśli nie pouczono Cię o prawie odstąpienia (towar)",
      fromQuestionId: "received_date",
      months: 12,
      days: 14,
      description:
        "Jeżeli sprzedawca nie poinformował Cię o prawie odstąpienia, prawo to wygasa dopiero 12 miesięcy po upływie podstawowego terminu (art. 29 ust. 1).",
    },
  ],
  instructions: {
    whereToSend: `Oświadczenie wysyłasz do **przedsiębiorcy, z którym zawarłeś umowę** – sklepu internetowego, usługodawcy albo firmy organizującej pokaz. Adres i e-mail znajdziesz:

- w regulaminie sklepu (zwykle w dziale „Zwroty” lub „Odstąpienie od umowy”) i w potwierdzeniu zamówienia,
- na fakturze lub w umowie podpisanej na pokazie,
- w KRS lub CEIDG – po numerze NIP firmy.

Jeżeli regulamin wskazuje osobny adres do zwrotów, możesz wysłać oświadczenie właśnie tam.`,
    howToSend: `Ustawa nie wymaga szczególnej formy – oświadczenie może być wysłane **e-mailem**, przez **formularz na stronie sklepu** albo **listem**. Ważne jest, aby wysłać je **przed upływem terminu** i zachować dowód wysłania.

- **E-mail** – w zupełności wystarcza przy zakupach internetowych. Dołącz pismo jako PDF i zachowaj wysłaną wiadomość.
- **List polecony za potwierdzeniem odbioru** – najlepszy przy umowach z pokazów i od nierzetelnych firm; liczy się data nadania.

Towar odeślij najpóźniej 14 dni po złożeniu oświadczenia – dobrze zapakowany, z dowodem nadania.`,
    afterSending: `Sprzedawca ma **14 dni od otrzymania oświadczenia** na zwrot wszystkich płatności, w tym kosztu najtańszej oferowanej dostawy. Może jednak wstrzymać zwrot do chwili otrzymania towaru lub dowodu jego odesłania.

Jeśli pieniądze nie wrócą:
- wyślij **ponaglenie** z kopią oświadczenia i dowodem odesłania towaru,
- przy płatności kartą zgłoś w banku procedurę **chargeback**,
- skontaktuj się z **miejskim lub powiatowym rzecznikiem konsumentów** albo **Inspekcją Handlową**,
- przy sklepach z innych krajów UE – z **Europejskim Centrum Konsumenckim**,
- w ostateczności złóż pozew do sądu rejonowego – Twoje oświadczenie i dowód odesłania towaru będą kluczowymi dowodami.`,
    checklist: [
      "Sprawdź, czy nie minęło 14 dni od otrzymania towaru (usługi – od zawarcia umowy).",
      "Upewnij się, że towar nie należy do wyjątków z art. 38 (np. rzecz na zamówienie, rozpakowana bielizna).",
      "Wpisz numer zamówienia i dokładną kwotę – przyspieszy to zwrot.",
      "Wyślij oświadczenie e-mailem lub listem i zachowaj dowód wysłania.",
      "Odeślij towar w ciągu 14 dni i zachowaj potwierdzenie nadania przesyłki.",
    ],
  },
  seo: {
    title: "Odstąpienie od umowy – wzór 2026 + generator",
    metaDescription:
      "Wzór oświadczenia o odstąpieniu od umowy zawartej przez internet, telefon lub na pokazie. 14 dni na zwrot bez podania przyczyny – generator pisma.",
    h1: "Odstąpienie od umowy zawartej na odległość – wzór oświadczenia",
    intro:
      "Zamówiłeś coś w sklepie internetowym, przez telefon albo podpisałeś umowę na pokazie i chcesz się wycofać? Masz na to 14 dni bez podawania przyczyny. Wypełnij krótki formularz – przygotujemy oświadczenie o odstąpieniu od umowy z właściwymi przepisami i terminami.",
    keywords: [
      "odstąpienie od umowy wzór",
      "oświadczenie o odstąpieniu od umowy",
      "odstąpienie od umowy zawartej na odległość",
      "zwrot towaru sklep internetowy 14 dni",
      "formularz odstąpienia od umowy",
      "odstąpienie od umowy zawartej poza lokalem",
      "zwrot zakupu przez internet",
    ],
    guide: [
      {
        heading: "Kiedy możesz odstąpić od umowy bez podania przyczyny",
        body: `Prawo odstąpienia przysługuje **konsumentowi**, który zawarł umowę **na odległość** (sklep internetowy, zamówienie telefoniczne, e-mail, aplikacja) albo **poza lokalem przedsiębiorstwa** (pokaz, targi, prezentacja w hotelu, wizyta przedstawiciela w domu). Podstawą jest art. 27 ustawy o prawach konsumenta.

Nie musisz uzasadniać decyzji – wystarczy, że zmieniłeś zdanie. Nie ponosisz też kosztów, poza wyjątkami: bezpośrednim kosztem odesłania towaru (jeśli sprzedawca o tym poinformował), dopłatą za droższy niż najtańszy sposób dostawy oraz zapłatą za usługę wykonaną na Twoje wyraźne żądanie przed upływem terminu.

Te same uprawnienia ma osoba prowadząca jednoosobową działalność, jeśli umowa nie ma dla niej charakteru zawodowego. Odstąpienie nie dotyczy natomiast zakupów w sklepie stacjonarnym – tam zwrot zależy wyłącznie od dobrej woli sprzedawcy.`,
      },
      {
        heading: "Terminy – 14 dni, 30 dni i 12 miesięcy",
        body: `- **14 dni** – podstawowy termin (art. 27 ust. 1).
- **30 dni** – gdy umowę zawarto podczas **nieumówionej wizyty** przedsiębiorcy w Twoim domu albo podczas **wycieczki** (art. 27 ust. 2).
- **Od kiedy liczyć** – przy zakupie rzeczy od dnia, w którym objąłeś towar w posiadanie (przy kilku paczkach – od odbioru ostatniej); przy usługach i treściach cyfrowych – od dnia zawarcia umowy (art. 28).
- **12 miesięcy więcej** – jeśli sprzedawca nie poinformował Cię o prawie odstąpienia, prawo to wygasa dopiero rok po upływie podstawowego terminu (art. 29).

Najważniejsze: **wystarczy wysłać oświadczenie przed upływem terminu** (art. 30 ust. 2). Nie ma znaczenia, kiedy dotrze do sprzedawcy.`,
      },
      {
        heading: "Jak odstąpić od umowy – krok po kroku",
        body: `1. **Sprawdź termin** – policz 14 dni od odbioru paczki (lub od zawarcia umowy o usługę).
2. **Przygotuj dane** – numer zamówienia, datę, kwotę i dane sprzedawcy z regulaminu lub potwierdzenia.
3. **Wypełnij generator** – przygotujemy oświadczenie z właściwymi przepisami. Możesz też użyć ustawowego formularza, ale nie jest on obowiązkowy.
4. **Wyślij oświadczenie** – e-mailem, przez formularz na stronie lub listem. Zachowaj dowód wysłania.
5. **Odeślij towar** – najpóźniej 14 dni od złożenia oświadczenia (art. 34 ust. 1). Zapakuj go starannie i zachowaj potwierdzenie nadania.
6. **Czekaj na zwrot** – sprzedawca ma 14 dni od otrzymania oświadczenia, ale może wstrzymać się do chwili otrzymania towaru lub dowodu jego odesłania.`,
      },
      {
        heading: "Zwrot pieniędzy i koszty przesyłki",
        body: `Sprzedawca musi zwrócić **wszystkie płatności, w tym koszt dostawy do Ciebie** – w wysokości najtańszego zwykłego sposobu dostawy, jaki oferował (art. 32 i 33). Jeśli wybrałeś droższego kuriera, różnicę ponosisz Ty.

Zwrot następuje **tą samą metodą płatności**, chyba że wyraźnie zgodzisz się na inną, bezpłatną dla Ciebie – np. przelew na wskazane konto. Sprzedawca nie może narzucić Ci bonu ani vouchera.

Koszt odesłania towaru ponosisz Ty, jeśli sprzedawca poinformował Cię o tym przed zawarciem umowy. Wiele sklepów oferuje jednak darmowe zwroty – sprawdź regulamin. Odpowiadasz za zmniejszenie wartości towaru, jeśli używałeś go w sposób wykraczający poza konieczny do sprawdzenia jego cech i działania (art. 34 ust. 4) – tak jak przy oglądaniu produktu w sklepie.`,
      },
      {
        heading: "Usługi i treści cyfrowe – na co uważać",
        body: `Przy umowach o usługi (np. internet, telefon, kurs, siłownia) termin 14 dni biegnie **od dnia zawarcia umowy**. Jeżeli na Twoje wyraźne żądanie usługodawca zaczął świadczyć usługę przed upływem tego terminu, po odstąpieniu zapłacisz tylko za część wykonaną do chwili odstąpienia – proporcjonalnie do ceny (art. 35). Gdy usługa została **w pełni wykonana** za Twoją zgodą i wiedziałeś, że tracisz prawo odstąpienia, wycofać się już nie można.

Przy **treściach cyfrowych** (e-booki, gry, kursy online do pobrania) sprzedawca często prosi o zgodę na natychmiastowe udostępnienie. Jeśli ją wyraziłeś i otrzymałeś potwierdzenie, prawo odstąpienia wygasa. Brak takiej zgody lub potwierdzenia oznacza, że możesz odstąpić – i nie płacisz za dostarczone treści (art. 36).`,
      },
      {
        heading: "Kiedy prawo odstąpienia nie przysługuje",
        body: `Art. 38 ustawy wymienia wyjątki. Najczęstsze z nich to:

- towary wykonane **według Twojej specyfikacji** lub spersonalizowane (np. mebel na wymiar, grawer),
- towary **szybko psujące się** lub z krótkim terminem przydatności,
- produkty w **zapieczętowanym opakowaniu**, których ze względów higienicznych nie można zwrócić po otwarciu (np. kosmetyki, bielizna),
- **nagrania i programy** w zapieczętowanym opakowaniu, jeśli je otworzyłeś,
- **prasa** (poza prenumeratą),
- usługi **w pełni wykonane** za Twoją wyraźną zgodą, gdy wiedziałeś, że stracisz prawo odstąpienia,
- **treści cyfrowe** (np. e-book do pobrania), jeśli zgodziłeś się na rozpoczęcie dostarczania przed upływem terminu i otrzymałeś potwierdzenie,
- usługi z **oznaczoną datą** – np. noclegi, bilety na koncerty, wynajem auta, catering na konkretny dzień.

Uwaga: przy nieumówionej wizycie w domu i wycieczce część wyjątków (m.in. dotyczących usług i towarów na zamówienie) nie ma zastosowania (art. 38 ust. 2).`,
      },
      {
        heading: "Najczęstsze błędy i co zrobić, gdy sprzedawca nie oddaje pieniędzy",
        body: `- **Odesłanie paczki bez oświadczenia** – sam zwrot towaru nie zawsze jest uznawany za odstąpienie. Wyślij wyraźne oświadczenie.
- **Brak dowodu wysłania** – zachowaj e-mail lub potwierdzenie nadania listu i paczki.
- **Zgoda na bon zamiast pieniędzy** – nie musisz jej wyrażać.
- **Używanie towaru ponad potrzebę** – sprzedawca może potrącić kwotę odpowiadającą zmniejszeniu wartości.

Jeżeli sprzedawca nie zwraca pieniędzy w 14 dni, wyślij ponaglenie, a przy płatności kartą rozważ **chargeback** w banku. Pomoc znajdziesz u **rzecznika konsumentów**, w **Inspekcji Handlowej** i – przy sklepach z innych krajów UE – w **Europejskim Centrum Konsumenckim**.`,
      },
    ],
    faq: [
      {
        question: "Czy muszę podać przyczynę odstąpienia od umowy?",
        answer:
          "Nie. Prawo odstąpienia od umowy zawartej na odległość lub poza lokalem przysługuje bez podawania przyczyny. Sprzedawca nie może uzależniać zwrotu od wyjaśnień.",
      },
      {
        question: "Od kiedy liczy się 14 dni na odstąpienie?",
        answer:
          "Przy zakupie towaru – od dnia, w którym Ty lub wskazana przez Ciebie osoba (inna niż kurier) odebrała przesyłkę; przy kilku paczkach – od odbioru ostatniej. Przy usługach i treściach cyfrowych – od dnia zawarcia umowy.",
      },
      {
        question: "Czy wystarczy wysłać e-mail?",
        answer:
          "Tak. Ustawa nie wymaga formy pisemnej. Oświadczenie przesłane e-mailem lub przez formularz na stronie jest skuteczne. Ważne, aby wysłać je przed upływem terminu i zachować dowód.",
      },
      {
        question: "Kto płaci za odesłanie towaru?",
        answer:
          "Zwykle konsument – ale tylko wtedy, gdy sprzedawca poinformował o tym przed zawarciem umowy. Jeśli tego nie zrobił albo zadeklarował darmowe zwroty, koszt ponosi sprzedawca.",
      },
      {
        question: "W jakim terminie sprzedawca musi oddać pieniądze?",
        answer:
          "Niezwłocznie, nie później niż w 14 dni od otrzymania oświadczenia o odstąpieniu. Może jednak wstrzymać zwrot do chwili otrzymania towaru albo dowodu jego odesłania – dlatego warto od razu przesłać potwierdzenie nadania paczki.",
      },
      {
        question: "Co jeśli sprzedawca nie poinformował mnie o prawie odstąpienia?",
        answer:
          "Termin wydłuża się – prawo odstąpienia wygasa dopiero 12 miesięcy po upływie podstawowych 14 dni. Jeśli sprzedawca poinformuje Cię w tym czasie, masz 14 dni od otrzymania informacji.",
      },
      {
        question: "Czy mogę odstąpić od umowy podpisanej na pokazie?",
        answer:
          "Tak. Umowa zawarta na pokazie to umowa zawarta poza lokalem przedsiębiorstwa – masz co najmniej 14 dni na odstąpienie, a jeśli umowę zawarto podczas wycieczki lub nieumówionej wizyty w domu – 30 dni.",
      },
      {
        question: "Czy mogę zwrócić rozpakowany towar?",
        answer:
          "Tak, możesz go rozpakować i sprawdzić tak, jak w sklepie. Wyjątek dotyczy produktów w zapieczętowanym opakowaniu, których ze względów higienicznych nie można zwrócić po otwarciu, oraz otwartych nagrań i programów.",
      },
    ],
  },
  ai: {
    context:
      "Oświadczenie konsumenta o odstąpieniu od umowy zawartej na odległość (internet, telefon) lub poza lokalem przedsiębiorstwa (pokaz, wizyta w domu). Konsument nie musi podawać przyczyny – opis faktów ma jedynie wskazać, jaką umowę i kiedy zawarto, kiedy otrzymano towar oraz istotne okoliczności podane przez użytkownika (np. problemy z kontaktem lub z formularzem zwrotu). Żądanie to zwrot wszystkich płatności we wskazany sposób. Ton krótki, rzeczowy i stanowczy. Nie powołuj przepisów ani terminów ustawowych – szablon dodaje je sam.",
    factQuestionIds: [
      "contract_kind",
      "contract_channel",
      "order_date",
      "contract_date",
      "received_date",
      "items",
      "amount",
      "informed",
      "circumstances",
      "refund_method",
    ],
  },
  render: ({ answers, ai, today }) => {
    const kind = (["goods", "service", "digital"].includes(str(answers, "contract_kind", ""))
      ? str(answers, "contract_kind", "")
      : "goods") as Kind;
    const channelRaw = str(answers, "contract_channel", "online");
    const channel = (Object.keys(CHANNEL_PHRASE).includes(channelRaw) ? channelRaw : "online") as Channel;
    const longTerm = channel === "visit" || channel === "trip";
    const offPremises = channel !== "online" && channel !== "phone";
    const termDays = longTerm ? 30 : 14;
    const order = str(answers, "order_number", "");
    const amount = num(answers, "amount");
    const informed = str(answers, "informed", "unsure");
    const email = str(answers, "sender_email", "");
    const phone = str(answers, "sender_phone", "");
    const account = str(answers, "bank_account", "");
    const refundBank = str(answers, "refund_method", "same") === "bank" && account !== "";
    // brak kwoty (pole puste) traktujemy jak płatność do uzupełnienia; 0 zł = nic jeszcze nie zapłacono
    const paid = amount === undefined || amount > 0;
    const contractDateId = kind === "goods" ? "order_date" : "contract_date";

    const paragraphs: Paragraph[] = [];

    // 1. Oświadczenie (wstęp)
    paragraphs.push(
      p(
        `Działając jako konsument, niniejszym oświadczam, że odstępuję od umowy ${KIND_GENITIVE[kind]} ${
          CHANNEL_PHRASE[channel]
        }${order ? `, nr zamówienia (umowy) ${order}` : ""}. Przedmiot umowy: ${str(answers, "items")}.${
          paid ? ` Łączna kwota zapłacona z tytułu umowy: ${formatMoneyPl(amount)}.` : ""
        }`,
      ),
    );

    // 2. Stan faktyczny
    if (ai) {
      paragraphs.push(...paragraphsFromText(ai.facts));
      paragraphs.push(...paragraphsFromText(ai.justification));
    } else {
      const facts: string[] = [`Umowa została zawarta w dniu ${formatDatePl(str(answers, contractDateId, ""))}`];
      if (kind === "goods") {
        facts[0] += `, a towar został mi dostarczony w dniu ${formatDatePl(str(answers, "received_date", ""))}.`;
      } else {
        facts[0] += ".";
      }
      if (informed === "no") facts.push("Przedsiębiorca nie poinformował mnie o prawie odstąpienia od umowy.");
      const user = userParagraphs(str(answers, "circumstances", ""));
      paragraphs.push(p([...facts, user[0] ?? ""].join(" ")));
      user.slice(1).forEach((t) => paragraphs.push(p(t)));
    }

    // 3. Żądanie
    const refundPhrase = refundBank
      ? `przelewem na rachunek bankowy nr ${account}`
      : "przy użyciu takiego samego sposobu zapłaty, jakiego użyto przy zakupie";
    if (ai?.demand) {
      paragraphs.push(...paragraphsFromText(ai.demand));
    } else if (paid) {
      paragraphs.push(
        p(
          `W związku z powyższym wnoszę o zwrot wszystkich dokonanych płatności w kwocie ${formatMoneyPl(amount)}${
            kind === "goods" ? ", w tym kosztów dostarczenia towaru" : ""
          }, ${refundPhrase}.`,
        ),
      );
    } else {
      paragraphs.push(
        p(
          "W związku z powyższym wnoszę o potwierdzenie, że umowa została uznana za niezawartą, oraz o zaniechanie naliczania jakichkolwiek opłat z jej tytułu.",
        ),
      );
    }

    // 4. Podstawa prawna i termin
    let basis = `Zgodnie z art. 27 ust. 1 ${UPK} konsument, który zawarł umowę na odległość lub poza lokalem przedsiębiorstwa, może w terminie 14 dni odstąpić od niej bez podawania przyczyny i bez ponoszenia kosztów, z wyjątkiem kosztów określonych w art. 33, art. 34 ust. 2 i art. 35 tej ustawy.`;
    if (longTerm) {
      basis +=
        " Jeżeli umowę zawarto poza lokalem przedsiębiorstwa podczas nieumówionej wizyty przedsiębiorcy w miejscu zamieszkania lub zwykłego pobytu konsumenta albo wycieczki, termin do odstąpienia od umowy wynosi 30 dni (art. 27 ust. 2).";
    }
    basis +=
      kind === "goods"
        ? " Bieg terminu rozpoczyna się od objęcia towaru w posiadanie przez konsumenta (art. 28 pkt 1)."
        : " Bieg terminu rozpoczyna się od dnia zawarcia umowy (art. 28 pkt 2).";
    basis +=
      " Do zachowania terminu wystarczy wysłanie oświadczenia przed jego upływem (art. 30 ust. 2), a w razie odstąpienia umowę uważa się za niezawartą (art. 31 ust. 1).";

    const start = parseIso(kind === "goods" ? answers.received_date : answers[contractDateId]);
    const todayUtc = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
    if (start) {
      const deadline = start.getTime() + termDays * DAY_MS;
      const extended = addMonthsUtc(new Date(deadline), 12).getTime();
      if (todayUtc <= deadline) {
        basis += ` Niniejsze oświadczenie składam przed upływem ${termDays}-dniowego terminu.`;
      } else if (informed === "no" && todayUtc <= extended) {
        basis += ` Ponieważ przedsiębiorca nie poinformował mnie o prawie odstąpienia od umowy, prawo to wygasa dopiero po upływie 12 miesięcy od dnia upływu terminu podstawowego (art. 29 ust. 1), a niniejsze oświadczenie składam przed upływem tego okresu.`;
      }
    }
    paragraphs.push(p(basis));

    const refundLaw = `Zgodnie z art. 32 ust. 1 ustawy przedsiębiorca ma obowiązek niezwłocznie, nie później niż w terminie 14 dni od dnia otrzymania oświadczenia konsumenta o odstąpieniu od umowy, zwrócić konsumentowi wszystkie dokonane przez niego płatności${
      kind === "goods" ? ", w tym koszty dostarczenia towaru" : ""
    }. Zwrotu dokonuje się przy użyciu takiego samego sposobu zapłaty, jakiego użył konsument, chyba że konsument wyraźnie zgodził się na inny sposób zwrotu, który nie wiąże się dla niego z żadnymi kosztami (art. 32 ust. 2).${
      refundBank
        ? ` Niniejszym wyrażam zgodę na zwrot płatności przelewem na rachunek bankowy nr ${account} – ten sposób zwrotu nie wiąże się dla mnie z żadnymi kosztami.`
        : ""
    }`;
    if (paid) paragraphs.push(p(refundLaw));

    // 5. Zwrot towaru / zaprzestanie korzystania
    if (kind === "goods") {
      const ret = str(answers, "goods_return", "later");
      if (ret === "with_letter") {
        paragraphs.push(
          p(
            "Towar odsyłam na Państwa adres wraz z niniejszym oświadczeniem, a zatem z zachowaniem terminu określonego w art. 34 ust. 1 ustawy.",
          ),
        );
      } else if (ret === "pickup" && offPremises) {
        paragraphs.push(
          p(
            "Umowa została zawarta poza lokalem przedsiębiorstwa, a towar dostarczono do miejsca mojego zamieszkania. Ze względu na charakter towaru nie można go odesłać w zwykły sposób pocztą, dlatego zgodnie z art. 34 ust. 3 ustawy proszę o jego odebranie na Państwa koszt. W celu ustalenia terminu odbioru proszę o kontakt.",
          ),
        );
      } else if (ret === "pickup") {
        paragraphs.push(
          p(
            "Ze względu na gabaryty towaru proszę o wskazanie sposobu jego zwrotu lub o zaproponowanie odbioru. Towar pozostaje do Państwa dyspozycji i zostanie zwrócony niezwłocznie, nie później niż w terminie 14 dni od dnia odstąpienia od umowy (art. 34 ust. 1 ustawy).",
          ),
        );
      } else {
        paragraphs.push(
          p(
            "Towar zostanie odesłany niezwłocznie, nie później niż w terminie 14 dni od dnia odstąpienia od umowy, zgodnie z art. 34 ust. 1 ustawy.",
          ),
        );
      }
    } else if (kind === "digital") {
      paragraphs.push(
        p(
          "Od dnia złożenia niniejszego oświadczenia zaprzestaję korzystania z treści cyfrowej lub usługi cyfrowej i nie udostępniam jej osobom trzecim (art. 34 ust. 1a ustawy).",
        ),
      );
    }

    // 6. Potwierdzenie
    paragraphs.push(
      p(
        `Proszę o niezwłoczne potwierdzenie otrzymania niniejszego oświadczenia${
          paid ? " oraz o informację o terminie zwrotu płatności" : ""
        } – na adres wskazany w nagłówku pisma${
          email ? ` lub na adres e-mail: ${email}` : ""
        }.`,
      ),
    );

    const attachments: string[] = [];
    if (bool(answers, "att_order")) attachments.push("Kopia potwierdzenia zamówienia (umowy)");
    if (bool(answers, "att_payment")) attachments.push("Kopia dowodu zapłaty");

    const extra = [email ? `e-mail: ${email}` : "", phone ? `tel. ${phone}` : ""];

    return {
      sender: partyFromAnswers(answers, "sender", extra),
      recipient: partyFromAnswers(answers, "recipient"),
      place: str(answers, "sender_city"),
      date: formatDatePl(today),
      title: "OŚWIADCZENIE O ODSTĄPIENIU OD UMOWY",
      subject: `Dotyczy: umowy ${offPremises ? "zawartej poza lokalem przedsiębiorstwa" : "zawartej na odległość"}${
        order ? `, zamówienie nr ${order}` : ""
      }`,
      salutation: "Szanowni Państwo,",
      paragraphs: paragraphs.map(tidyParagraph),
      closing: "Z poważaniem",
      signatureName: str(answers, "sender_name"),
      attachments,
      previewParagraphCount: 2,
    };
  },
};
