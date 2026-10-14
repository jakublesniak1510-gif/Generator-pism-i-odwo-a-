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
 * Przedsądowe wezwanie do zapłaty.
 * KC: art. 353 § 1, 455, 476, 481 § 1–2, 723 (pożyczka bez terminu zwrotu); KPC: art. 98 § 1, 187 § 1 pkt 3.
 * B2B (obie strony = przedsiębiorcy, faktura/umowa): ustawa z 8 marca 2013 r. o przeciwdziałaniu nadmiernym
 * opóźnieniom w transakcjach handlowych – art. 7 ust. 1 (odsetki), art. 10 ust. 1 (rekompensata 40/70/100 EUR).
 * BIG – ustawa z 9 kwietnia 2010 r.; warunki wpisu (art. 14/15) [DO WERYFIKACJI] – w piśmie ogólne odesłanie do ustawy.
 */

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

function dot(text: string): string {
  return /[.!?…]$/.test(text) ? text : `${text}.`;
}

function userParagraphs(text: string): Paragraph[] {
  return text
    .split(/\n\s*\n/)
    .map((t) => sentence(t))
    .filter(Boolean)
    .map(p);
}

type Basis = "invoice" | "contract" | "loan" | "deposit" | "other";

function basisOf(answers: Answers): Basis {
  const v = str(answers, "debt_basis", "other");
  return v === "invoice" || v === "contract" || v === "loan" || v === "deposit" ? v : "other";
}

const isCompany = (answers: Answers, id: string) => str(answers, id, "") === "company";

/** Transakcja handlowa: obie strony są przedsiębiorcami, a dług wynika z faktury lub umowy (dostawa towarów / usług). */
function isB2B(answers: Answers): boolean {
  const basis = basisOf(answers);
  return isCompany(answers, "creditor_type") && isCompany(answers, "debtor_type") && (basis === "invoice" || basis === "contract");
}

type InterestKind = "none" | "statutory" | "commercial" | "contractual";

function interestKind(answers: Answers): InterestKind {
  if (!bool(answers, "interest")) return "none";
  const v = str(answers, "interest_type", "statutory");
  if (v === "commercial") return isB2B(answers) ? "commercial" : "statutory";
  if (v === "contractual") return "contractual";
  return "statutory";
}

/** Pożyczka bez oznaczonego terminu zwrotu – wezwanie jest jednocześnie wypowiedzeniem (art. 723 KC, 6 tygodni). */
function loanWithoutTerm(answers: Answers): boolean {
  return basisOf(answers) === "loan" && !dateAnswer(answers, "due_date");
}

/** Rekompensata z art. 10 ust. 1 ustawy o przeciwdziałaniu nadmiernym opóźnieniom: 40 / 70 / 100 EUR. */
function compensationEur(amount: number | undefined): number | undefined {
  if (amount === undefined) return undefined;
  if (amount <= 5000) return 40;
  if (amount < 50000) return 70;
  return 100;
}

function compensationClaimed(answers: Answers): boolean {
  return isB2B(answers) && bool(answers, "claim_compensation");
}

function paymentTerm(answers: Answers): string {
  if (loanWithoutTerm(answers)) return "w terminie sześciu tygodni od dnia doręczenia niniejszego pisma";
  const days = str(answers, "payment_days", "7");
  return `w terminie ${days} dni od dnia doręczenia niniejszego wezwania`;
}

function titleOfDebt(answers: Answers): string {
  const doc = str(answers, "debt_document", "");
  switch (basisOf(answers)) {
    case "invoice":
      return `nieuregulowanej należności z faktury${doc ? ` nr ${doc}` : ""}`;
    case "contract":
      return `należności wynikającej z umowy${doc ? ` nr ${doc}` : ""}`;
    case "loan":
      return `zwrotu udzielonej pożyczki${doc ? ` (umowa nr ${doc})` : ""}`;
    case "deposit":
      return `zwrotu kaucji${doc ? ` (umowa nr ${doc})` : ""}`;
    default:
      return `należności opisanej poniżej${doc ? ` (dokument nr ${doc})` : ""}`;
  }
}

function interestText(answers: Answers): string {
  const due = dateAnswer(answers, "due_date");
  const from = due
    ? `od dnia ${formatDatePl(new Date(due.getFullYear(), due.getMonth(), due.getDate() + 1))}`
    : "od dnia następującego po upływie terminu zapłaty wskazanego w niniejszym wezwaniu";
  switch (interestKind(answers)) {
    case "statutory":
      return `odsetki ustawowe za opóźnienie liczone ${from} do dnia zapłaty`;
    case "commercial":
      return `odsetki ustawowe za opóźnienie w transakcjach handlowych liczone ${from} do dnia zapłaty`;
    case "contractual": {
      const rate = num(answers, "interest_rate");
      const rateText = rate !== undefined ? new Intl.NumberFormat("pl-PL", { maximumFractionDigits: 2 }).format(rate) : "______";
      return `odsetki umowne w wysokości ${rateText}% w skali roku liczone ${from} do dnia zapłaty`;
    }
    default:
      return "";
  }
}

function factsParagraphs(answers: Answers): Paragraph[] {
  const amount = formatMoneyPl(num(answers, "principal_amount"));
  const due = dateAnswer(answers, "due_date");
  const dueDate = formatDatePl(due);
  const doc = str(answers, "debt_document", "");
  let first: string;
  switch (basisOf(answers)) {
    case "invoice":
      first = `Z tytułu wykonanego świadczenia wystawiona została faktura${doc ? ` nr ${doc}` : ""}, z której do zapłaty pozostaje kwota ${amount}. Termin płatności upłynął w dniu ${dot(dueDate)}`;
      break;
    case "contract":
      first = `Zgodnie z umową${doc ? ` nr ${doc}` : ""} kwota ${amount} była płatna ${due ? `do dnia ${dot(dueDate)}` : "na warunkach określonych w umowie."}`;
      break;
    case "loan":
      first = `Udzielona została pożyczka, z której do zwrotu pozostaje kwota ${amount}${doc ? ` (umowa nr ${doc})` : ""}. ${due ? `Termin zwrotu pożyczki upłynął w dniu ${dot(dueDate)}` : "Termin zwrotu pożyczki nie został oznaczony."}`;
      break;
    case "deposit":
      first = `Wpłacona została kaucja, z której do zwrotu pozostaje kwota ${amount}${doc ? ` (umowa nr ${doc})` : ""}. ${due ? `Termin zwrotu kaucji upłynął w dniu ${dot(dueDate)}` : "Kaucja podlega zwrotowi."}`;
      break;
    default:
      first = `Do zapłaty pozostaje kwota ${amount}${due ? `, wymagalna od dnia ${dot(dueDate)}` : "."}`;
  }
  const out: Paragraph[] = [p(`${first} Do dnia sporządzenia niniejszego wezwania należność nie została uregulowana.`)];

  const description = str(answers, "facts_description", "");
  if (description) out.push(...userParagraphs(description));

  const prior = str(answers, "prior_reminders", "");
  if (prior) out.push(p(`Dotychczasowe próby polubownego odzyskania należności pozostały bezskuteczne. ${sentence(prior)}`));
  return out;
}

function demandItems(answers: Answers): string[] {
  const amount = num(answers, "principal_amount");
  const items = [`należność główną w kwocie ${formatMoneyPl(amount)}`];
  const interest = interestText(answers);
  if (interest) items.push(interest);
  if (compensationClaimed(answers)) {
    const eur = compensationEur(amount);
    items.push(
      `rekompensatę za koszty odzyskiwania należności w kwocie stanowiącej równowartość ${eur ?? "______"} euro, przeliczonej na złote według średniego kursu euro ogłoszonego przez Narodowy Bank Polski ostatniego dnia roboczego miesiąca poprzedzającego miesiąc, w którym świadczenie stało się wymagalne`,
    );
  }
  return items;
}

function legalParagraphs(answers: Answers): Paragraph[] {
  const out: Paragraph[] = [
    p(
      "Zgodnie z art. 353 § 1 Kodeksu cywilnego zobowiązanie polega na tym, że wierzyciel może żądać od dłużnika świadczenia, a dłużnik powinien świadczenie spełnić. Jeżeli termin spełnienia świadczenia nie jest oznaczony ani nie wynika z właściwości zobowiązania, świadczenie powinno być spełnione niezwłocznie po wezwaniu dłużnika do wykonania (art. 455 Kodeksu cywilnego). Dłużnik, który nie spełnia świadczenia w terminie, dopuszcza się opóźnienia, a jeżeli jest ono następstwem okoliczności, za które ponosi odpowiedzialność – zwłoki (art. 476 Kodeksu cywilnego).",
    ),
  ];
  if (loanWithoutTerm(answers)) {
    out.push(
      p(
        "Termin zwrotu pożyczki nie został oznaczony, dlatego niniejsze pismo stanowi jednocześnie wypowiedzenie umowy pożyczki. Zgodnie z art. 723 Kodeksu cywilnego w takim przypadku pożyczkobiorca obowiązany jest zwrócić pożyczkę w ciągu sześciu tygodni po wypowiedzeniu.",
      ),
    );
  }
  const kind = interestKind(answers);
  if (kind === "statutory" || kind === "contractual") {
    out.push(
      p(
        `Zgodnie z art. 481 § 1 Kodeksu cywilnego, jeżeli dłużnik opóźnia się ze spełnieniem świadczenia pieniężnego, wierzyciel może żądać odsetek za czas opóźnienia, chociażby nie poniósł żadnej szkody i chociażby opóźnienie było następstwem okoliczności, za które dłużnik odpowiedzialności nie ponosi. ${kind === "statutory" ? "Jeżeli stopa odsetek za opóźnienie nie była z góry oznaczona, należą się odsetki ustawowe za opóźnienie (art. 481 § 2 Kodeksu cywilnego)." : "W niniejszej sprawie stopa odsetek za opóźnienie została z góry oznaczona w umowie, wobec czego odsetki należą się w uzgodnionej wysokości, z zastrzeżeniem limitu odsetek maksymalnych (art. 481 § 2¹ Kodeksu cywilnego)."}`,
      ),
    );
  }
  if (kind === "commercial") {
    out.push(
      p(
        "Zgodnie z art. 7 ust. 1 ustawy z dnia 8 marca 2013 r. o przeciwdziałaniu nadmiernym opóźnieniom w transakcjach handlowych w transakcji handlowej wierzycielowi, który spełnił swoje świadczenie i nie otrzymał zapłaty w terminie określonym w umowie, przysługują – bez wezwania – odsetki ustawowe za opóźnienie w transakcjach handlowych.",
      ),
    );
  }
  if (compensationClaimed(answers)) {
    out.push(
      p(
        "Na podstawie art. 10 ust. 1 ustawy z dnia 8 marca 2013 r. o przeciwdziałaniu nadmiernym opóźnieniom w transakcjach handlowych wierzycielowi, któremu przysługują odsetki za opóźnienie w transakcji handlowej, przysługuje ponadto – bez wezwania – rekompensata za koszty odzyskiwania należności w wysokości równowartości 40 euro (gdy wartość świadczenia nie przekracza 5000 zł), 70 euro (gdy jest wyższa niż 5000 zł, ale niższa niż 50 000 zł) albo 100 euro (gdy wynosi co najmniej 50 000 zł).",
      ),
    );
  }
  out.push(
    p(
      "Niniejsze wezwanie stanowi próbę polubownego rozwiązania sporu przed wniesieniem pozwu, o której informacja zamieszczana jest w pozwie zgodnie z art. 187 § 1 pkt 3 Kodeksu postępowania cywilnego.",
    ),
  );
  return out;
}

export const wezwanieDoZaplaty: LetterTemplate = {
  slug: "wezwanie-do-zaplaty",
  name: "Wezwanie do zapłaty",
  category: "finanse",
  shortDescription:
    "Przedsądowe wezwanie do zapłaty faktury, zwrotu pożyczki lub kaucji – z odsetkami, rekompensatą 40 EUR dla firm i zapowiedzią sądu.",
  priceGrosze: 2499,
  icon: "💰",
  estimatedMinutes: 6,
  sections: [
    {
      id: "sender",
      title: "Twoje dane (wierzyciel)",
      questions: [
        {
          id: "creditor_type",
          label: "Kto wzywa do zapłaty?",
          type: "radio",
          options: [
            { value: "person", label: "Osoba prywatna" },
            { value: "company", label: "Firma (w tym jednoosobowa działalność gospodarcza)" },
          ],
        },
        ...senderQuestions().map((q) =>
          q.id === "sender_name"
            ? { ...q, label: "Imię i nazwisko lub nazwa firmy", placeholder: "Jan Kowalski lub Kowalski Usługi Remontowe Jan Kowalski" }
            : q,
        ),
        {
          id: "sender_nip",
          label: "NIP firmy",
          type: "text",
          placeholder: "1234567890",
          showIf: { questionId: "creditor_type", equals: "company" },
          validate: { pattern: "^[0-9 -]{10,13}$" },
        },
        {
          id: "sender_representative",
          label: "Osoba podpisująca pismo (opcjonalnie)",
          type: "text",
          required: false,
          placeholder: "np. Jan Kowalski – prezes zarządu",
          help: "Wpisz, jeśli pismo podpisuje inna osoba niż właściciel wskazany w nazwie firmy.",
          showIf: { questionId: "creditor_type", equals: "company" },
        },
      ],
    },
    {
      id: "recipient",
      title: "Dłużnik",
      description: "Dane dłużnika przepisz z faktury, umowy lub rejestru (KRS, CEIDG). Pismo wyślij na adres zamieszkania lub siedziby.",
      questions: [
        {
          id: "debtor_type",
          label: "Kim jest dłużnik?",
          type: "radio",
          options: [
            { value: "person", label: "Osoba prywatna" },
            { value: "company", label: "Firma" },
          ],
          help: "Jeśli obie strony są firmami, przysługują wyższe odsetki w transakcjach handlowych i rekompensata 40/70/100 EUR.",
        },
        ...recipientQuestions("Dłużnik").map((q) =>
          q.id === "recipient_name"
            ? { ...q, label: "Dłużnik – imię i nazwisko lub nazwa firmy", placeholder: "Adam Nowak lub Nowak Sp. z o.o." }
            : q,
        ),
      ],
    },
    {
      id: "debt",
      title: "Dług",
      questions: [
        {
          id: "debt_basis",
          label: "Z czego wynika dług?",
          type: "radio",
          options: [
            { value: "invoice", label: "Niezapłacona faktura" },
            { value: "contract", label: "Umowa (np. o dzieło, zlecenie, sprzedaży)" },
            { value: "loan", label: "Pożyczka" },
            { value: "deposit", label: "Niezwrócona kaucja" },
            { value: "other", label: "Inne (np. niezwrócone pieniądze, nadpłata)" },
          ],
        },
        {
          id: "debt_document",
          label: "Numer faktury lub umowy (opcjonalnie)",
          type: "text",
          required: false,
          placeholder: "np. FV 12/2026",
        },
        {
          id: "due_date",
          label: "Termin płatności (data wymagalności)",
          type: "date",
          required: false,
          help: "Data z faktury lub umowy, do której dłużnik miał zapłacić. Przy pożyczce bez ustalonego terminu zwrotu zostaw puste – pismo będzie jednocześnie wypowiedzeniem pożyczki (6 tygodni na zwrot).",
        },
        {
          id: "principal_amount",
          label: "Kwota główna do zapłaty (zł)",
          type: "money",
          placeholder: "np. 3500,00",
          help: "Bez odsetek – odsetki pismo doliczy osobno. Jeśli dłużnik zapłacił część, wpisz pozostałą kwotę.",
          validate: { min: 0.01 },
        },
        {
          id: "interest",
          label: "Żądam odsetek za opóźnienie",
          type: "checkbox",
          required: false,
          help: "Odsetki należą się od dnia następującego po terminie płatności – nawet jeśli nie poniosłeś szkody.",
        },
        {
          id: "interest_type",
          label: "Jakie odsetki?",
          type: "radio",
          options: [
            { value: "statutory", label: "Ustawowe za opóźnienie (standardowe)" },
            { value: "commercial", label: "Ustawowe za opóźnienie w transakcjach handlowych (obie strony to firmy)" },
            { value: "contractual", label: "Umowne – w wysokości ustalonej w umowie" },
          ],
          showIf: { questionId: "interest", equals: "true" },
        },
        {
          id: "interest_rate",
          label: "Wysokość odsetek umownych (% w skali roku)",
          type: "number",
          placeholder: "np. 12",
          help: "Odsetki umowne nie mogą przekraczać odsetek maksymalnych – nadwyżka się nie należy.",
          validate: { min: 0, max: 100 },
          showIf: { questionId: "interest_type", equals: "contractual" },
        },
        {
          id: "claim_compensation",
          label: "Żądam rekompensaty za koszty odzyskiwania należności (40/70/100 EUR)",
          type: "checkbox",
          required: false,
          help: "Tylko gdy dłużnik też jest firmą, a dług wynika z faktury lub umowy. Kwotę dobierzemy automatycznie.",
          showIf: { questionId: "creditor_type", equals: "company" },
        },
      ],
    },
    {
      id: "payment",
      title: "Termin i opis sprawy",
      questions: [
        {
          id: "payment_days",
          label: "Termin na zapłatę",
          type: "select",
          options: [
            { value: "3", label: "3 dni od doręczenia" },
            { value: "7", label: "7 dni od doręczenia (najczęściej)" },
            { value: "14", label: "14 dni od doręczenia" },
          ],
        },
        {
          id: "bank_account",
          label: "Numer rachunku do wpłaty",
          type: "text",
          placeholder: "PL61 1090 1014 0000 0712 1981 2874",
          validate: { maxLength: 60 },
        },
        {
          id: "facts_description",
          label: "Opisz sprawę",
          type: "textarea",
          placeholder:
            "np. W marcu 2026 r. wykonałem remont łazienki w mieszkaniu dłużnika. Prace odebrano bez zastrzeżeń 28 marca 2026 r. Dłużnik zapłacił zaliczkę 1000 zł, pozostałej kwoty nie uregulował.",
          help: "Co zostało wykonane lub przekazane, kiedy, czy dłużnik zgłaszał zastrzeżenia. Ten opis zostanie zredagowany w piśmie.",
        },
        {
          id: "prior_reminders",
          label: "Wcześniejsze upomnienia (opcjonalnie)",
          type: "textarea",
          required: false,
          placeholder: "np. 10 kwietnia 2026 r. wysłałem e-mail z przypomnieniem, 20 kwietnia rozmawialiśmy telefonicznie – dłużnik obiecał zapłatę do końca miesiąca.",
        },
        {
          id: "big_warning",
          label: "Uprzedź o możliwości wpisu do biura informacji gospodarczej (BIG)",
          type: "checkbox",
          required: false,
          help: "Wpis jest możliwy tylko, jeśli masz umowę z danym BIG, a dług spełnia ustawowe warunki (m.in. minimalna kwota i 30 dni zaległości). Wezwanie wyślij wtedy listem poleconym.",
        },
        {
          id: "big_name",
          label: "Nazwa i adres siedziby biura informacji gospodarczej",
          type: "text",
          placeholder: "nazwa biura, ulica, kod pocztowy, miejscowość",
          help: "Ustawa wymaga podania w wezwaniu nazwy (firmy) i adresu siedziby biura – znajdziesz je na stronie BIG, z którym masz umowę.",
          showIf: { questionId: "big_warning", equals: "true" },
        },
      ],
    },
  ],
  legalBasis: [
    {
      act: "Ustawa z dnia 23 kwietnia 1964 r. – Kodeks cywilny",
      article: "art. 353 § 1, art. 455 i art. 476",
      summary: "Dłużnik musi spełnić świadczenie w terminie, a gdy terminu nie ustalono – niezwłocznie po wezwaniu; inaczej popada w opóźnienie.",
      url: "https://isap.sejm.gov.pl/isap.nsf/DocDetails.xsp?id=WDU19640160093",
    },
    {
      act: "Ustawa z dnia 23 kwietnia 1964 r. – Kodeks cywilny",
      article: "art. 481 § 1 i 2",
      summary: "Za opóźnienie w zapłacie należą się odsetki – bez względu na szkodę i winę dłużnika; domyślnie odsetki ustawowe za opóźnienie.",
      url: "https://isap.sejm.gov.pl/isap.nsf/DocDetails.xsp?id=WDU19640160093",
    },
    {
      act: "Ustawa z dnia 8 marca 2013 r. o przeciwdziałaniu nadmiernym opóźnieniom w transakcjach handlowych",
      article: "art. 7 ust. 1",
      summary: "Między firmami należą się – bez wezwania – wyższe odsetki ustawowe za opóźnienie w transakcjach handlowych.",
      url: "https://isap.sejm.gov.pl/isap.nsf/DocDetails.xsp?id=WDU20130000403",
    },
    {
      act: "Ustawa z dnia 8 marca 2013 r. o przeciwdziałaniu nadmiernym opóźnieniom w transakcjach handlowych",
      article: "art. 10 ust. 1",
      summary: "Firma-wierzyciel może żądać rekompensaty 40, 70 lub 100 EUR za koszty odzyskiwania należności – zależnie od kwoty długu.",
      url: "https://isap.sejm.gov.pl/isap.nsf/DocDetails.xsp?id=WDU20130000403",
    },
    {
      act: "Ustawa z dnia 17 listopada 1964 r. – Kodeks postępowania cywilnego",
      article: "art. 187 § 1 pkt 3 i art. 98 § 1",
      summary: "Pozew musi informować o próbie polubownego rozwiązania sporu; przegrywający dłużnik zwraca koszty procesu.",
      url: "https://isap.sejm.gov.pl/isap.nsf/DocDetails.xsp?id=WDU19640430296",
    },
  ],
  deadlines: [
    {
      id: "big_30_days",
      label: "Dług zaległy od 30 dni (warunek wpisu do BIG)",
      fromQuestionId: "due_date",
      days: 30,
      description:
        "Wpis dłużnika do biura informacji gospodarczej jest możliwy m.in. wtedy, gdy świadczenie jest wymagalne od co najmniej 30 dni, a od wysłania wezwania z ostrzeżeniem o wpisie minął co najmniej miesiąc. Szczegółowe warunki (np. minimalną kwotę) sprawdź w regulaminie swojego BIG.",
    },
    {
      id: "limitation",
      label: "Orientacyjne przedawnienie roszczenia firmy (3 lata)",
      fromQuestionId: "due_date",
      years: 3,
      description:
        "Roszczenia związane z działalnością gospodarczą przedawniają się po 3 latach, a pozostałe (np. pożyczka między osobami prywatnymi) – po 6 latach; termin kończy się z ostatnim dniem roku kalendarzowego (art. 118 KC). Roszczenia ze sprzedaży w ramach działalności przedsiębiorstwa sprzedawcy przedawniają się po 2 latach (art. 554 KC). Wezwanie do zapłaty nie przerywa biegu przedawnienia – robi to dopiero np. pozew.",
    },
  ],
  instructions: {
    whereToSend:
      "Wyślij wezwanie na **adres zamieszkania dłużnika** (osoba prywatna) lub **adres siedziby** (firma). Aktualny adres spółki sprawdzisz bezpłatnie w KRS (wyszukiwarka Ministerstwa Sprawiedliwości), a przedsiębiorcy jednoosobowego – w CEIDG. Jeśli w umowie wskazano adres do doręczeń, użyj go. Dodatkowo możesz przesłać skan pisma e-mailem.",
    howToSend:
      "Wyślij wezwanie **listem poleconym za potwierdzeniem odbioru** – termin zapłaty liczy się od doręczenia, a dowód nadania przyda się w sądzie. Jeśli uprzedzasz o wpisie do BIG, list polecony (albo doręczenie do rąk własnych) jest wymogiem ustawowym. E-mail wystarczy jako przypomnienie, ale przy sporze trudniej udowodnić doręczenie. Zachowaj kopię podpisanego pisma.",
    afterSending:
      "Odczekaj termin wskazany w wezwaniu, liczony od doręczenia. Jeśli dłużnik nie odbierze listu, przyjmuje się zwykle, że mógł zapoznać się z pismem najpóźniej z upływem terminu na odbiór awizowanej przesyłki – zachowaj kopertę ze zwrotem. Jeśli dłużnik nie zapłaci ani nie zaproponuje ugody, możesz złożyć **pozew** – przy prostych sprawach najszybciej w **elektronicznym postępowaniu upominawczym (EPU)** przez e-sąd albo w postępowaniu nakazowym na podstawie faktury lub umowy. W pozwie opisz próbę polubownego rozwiązania sporu i dołącz kopię wezwania. Wpis do BIG możliwy jest najwcześniej miesiąc po wysłaniu wezwania z ostrzeżeniem.",
    checklist: [
      "Kwota główna i numer faktury lub umowy są zgodne z dokumentami.",
      "Dane dłużnika (imię i nazwisko lub nazwa, adres) są aktualne – sprawdziłem/am KRS lub CEIDG.",
      "Wpisałem/am poprawny numer rachunku do wpłaty.",
      "Pismo jest podpisane, a kopię zachowuję dla siebie.",
      "Wysyłam list polecony za potwierdzeniem odbioru i zachowuję dowód nadania.",
      "Zapisałem/am w kalendarzu termin zapłaty i termin przedawnienia.",
    ],
  },
  seo: {
    title: "Wezwanie do zapłaty – wzór 2026 + generator pisma",
    metaDescription:
      "Przedsądowe wezwanie do zapłaty faktury, pożyczki lub kaucji. Generator doda odsetki, rekompensatę 40 EUR dla firm i zapowiedź sądu. Gotowe w 5 minut.",
    h1: "Wezwanie do zapłaty – wzór przedsądowego wezwania i generator",
    intro:
      "Dłużnik nie płaci faktury, nie oddaje pożyczki albo kaucji? Przygotuj przedsądowe wezwanie do zapłaty z prawidłowo opisanymi odsetkami, terminem zapłaty i zapowiedzią skierowania sprawy do sądu. Pismo jest też dowodem próby polubownego rozwiązania sporu, którą trzeba wykazać w pozwie.",
    keywords: [
      "wezwanie do zapłaty wzór",
      "przedsądowe wezwanie do zapłaty",
      "ostateczne wezwanie do zapłaty",
      "wezwanie do zapłaty faktury",
      "wezwanie do zwrotu pożyczki",
      "wezwanie do zwrotu kaucji",
      "odsetki za opóźnienie w transakcjach handlowych",
      "rekompensata 40 euro",
    ],
    guide: [
      {
        heading: "Po co wysyłać wezwanie do zapłaty",
        body:
          "Przedsądowe wezwanie do zapłaty to formalne pismo, w którym wierzyciel żąda zapłaty w konkretnym terminie i uprzedza o dalszych krokach. Spełnia kilka funkcji naraz:\n\n- **mobilizuje dłużnika** – wiele spraw kończy się zapłatą po pierwszym oficjalnym piśmie;\n- **stawia dług w stan wymagalności**, jeśli termin zapłaty nie był wcześniej ustalony (art. 455 KC) – od tego momentu biegną odsetki;\n- **dokumentuje próbę polubownego rozwiązania sporu** – pozew musi zawierać informację, czy strony próbowały mediacji lub innego pozasądowego rozwiązania sporu (art. 187 § 1 pkt 3 KPC);\n- **jest warunkiem wpisu do biura informacji gospodarczej**, jeśli zawiera ostrzeżenie o takim zamiarze.\n\nWezwanie nie przerywa biegu przedawnienia – jeśli termin przedawnienia jest bliski, rozważ od razu pozew.",
      },
      {
        heading: "Co musi zawierać skuteczne wezwanie",
        body:
          "1. **Dane wierzyciela i dłużnika** – zgodne z umową, fakturą lub rejestrem.\n2. **Kwotę główną** i jej źródło: numer faktury, umowy, datę pożyczki lub wpłaty kaucji.\n3. **Odsetki** – ustawowe za opóźnienie (osoby prywatne), w transakcjach handlowych (firma–firma) albo umowne, z datą, od której są liczone.\n4. **Termin zapłaty** – najczęściej 7 dni od doręczenia; przy pożyczce bez ustalonego terminu zwrotu – 6 tygodni od wypowiedzenia (art. 723 KC).\n5. **Numer rachunku** do wpłaty.\n6. **Zapowiedź dalszych kroków** – skierowania sprawy do sądu i ewentualnie wpisu do BIG.\n7. **Podpis** wierzyciela lub osoby uprawnionej do reprezentowania firmy.\n\nNie musisz podawać kwoty słownie ani wyliczać odsetek co do grosza – wystarczy wskazać ich rodzaj i datę początkową.",
      },
      {
        heading: "Odsetki i rekompensata – ile możesz doliczyć",
        body:
          "**Odsetki ustawowe za opóźnienie** (art. 481 KC) należą się zawsze, gdy dłużnik nie płaci w terminie – nawet jeśli nie poniosłeś szkody, a opóźnienie nie wynika z winy dłużnika. Ich wysokość to stopa referencyjna NBP powiększona o 5,5 punktu procentowego.\n\nGdy **obie strony są przedsiębiorcami**, a dług wynika z dostawy towarów lub usług, przysługują wyższe **odsetki ustawowe za opóźnienie w transakcjach handlowych** (stopa referencyjna NBP plus 10 punktów procentowych) oraz **rekompensata za koszty odzyskiwania należności**: 40 EUR przy długu do 5000 zł, 70 EUR przy długu powyżej 5000 zł i poniżej 50 000 zł oraz 100 EUR przy długu od 50 000 zł. Rekompensata należy się bez wezwania i bez wykazywania poniesionych kosztów – od każdej niezapłaconej w terminie faktury.\n\n**Odsetki umowne** możesz żądać, jeśli strony je uzgodniły – nie mogą jednak przekraczać odsetek maksymalnych.",
      },
      {
        heading: "Ostrzeżenie o wpisie do BIG",
        body:
          "Wezwanie może zawierać ostrzeżenie o zamiarze przekazania danych dłużnika do **biura informacji gospodarczej** (BIG). Taki wpis utrudnia dłużnikowi uzyskanie kredytu, zakup na raty czy podpisanie umowy z operatorem, dlatego bywa skuteczniejszy niż sama zapowiedź pozwu. Ustawa o udostępnianiu informacji gospodarczych stawia jednak konkretne warunki: wierzyciel musi mieć **umowę z danym biurem**, dług musi być wymagalny od co najmniej 30 dni i przekraczać ustawowy próg kwotowy (inny dla konsumentów i dla firm), a wezwanie trzeba wysłać **listem poleconym** lub doręczyć do rąk własnych, podając **nazwę i adres siedziby biura**. Wpis jest możliwy dopiero po upływie miesiąca od wysłania takiego wezwania. Jeśli nie masz umowy z BIG, nie zaznaczaj tej opcji – puste ostrzeżenie osłabia wiarygodność pisma.",
      },
      {
        heading: "Wezwanie do zapłaty krok po kroku",
        body:
          "1. **Zbierz dokumenty**: fakturę, umowę, potwierdzenie przelewu pożyczki lub kaucji, korespondencję z dłużnikiem.\n2. **Sprawdź dane dłużnika** w KRS lub CEIDG – błędny adres opóźni sprawę.\n3. **Wypełnij generator** – wybierz rodzaj długu, odsetki i termin zapłaty.\n4. **Podpisz i wyślij** wezwanie listem poleconym za potwierdzeniem odbioru; kopię zachowaj.\n5. **Odczekaj termin** liczony od dnia doręczenia. Odpowiadaj na propozycje ugody na piśmie.\n6. **Przy braku zapłaty** złóż pozew – w EPU (e-sąd) albo w zwykłym trybie, dołączając kopię wezwania.",
      },
      {
        heading: "Najczęstsze błędy",
        body:
          "- **Żądanie odsetek w transakcjach handlowych od osoby prywatnej** – należą się tylko między przedsiębiorcami; generator automatycznie użyje wtedy zwykłych odsetek ustawowych.\n- **Zbyt krótki termin przy pożyczce bez ustalonego terminu zwrotu** – kodeks daje dłużnikowi 6 tygodni od wypowiedzenia.\n- **Groźby i nacisk** – pismo ma być stanowcze, ale rzeczowe. Groźby karalne czy nękanie mogą obrócić się przeciwko wierzycielowi.\n- **Brak dowodu doręczenia** – bez potwierdzenia odbioru trudno wykazać, kiedy upłynął termin.\n- **Ostrzeżenie o BIG bez umowy z biurem** – wpisu może dokonać tylko wierzyciel, który zawarł umowę z biurem informacji gospodarczej.\n- **Czekanie do ostatniej chwili** – wezwanie nie przerywa przedawnienia.",
      },
      {
        heading: "Co jeśli dłużnik nie zapłaci",
        body:
          "Jeżeli termin minął bezskutecznie, masz kilka możliwości. Najprostsza to **pozew w elektronicznym postępowaniu upominawczym (EPU)** – składa się go przez internet, opłata sądowa jest niższa niż w zwykłym trybie, a sąd wydaje nakaz zapłaty bez rozprawy. Jeśli dłużnik wniesie sprzeciw, sprawa trafi do zwykłego sądu. Przy fakturze zaakceptowanej przez dłużnika lub dokumencie podpisanym przez niego możesz wnosić o nakaz zapłaty w postępowaniu nakazowym.\n\nPrawomocny nakaz lub wyrok z klauzulą wykonalności przekazujesz komornikowi. Koszty sądowe i zastępstwa procesowego co do zasady ponosi przegrywający dłużnik. Gdy dłużnik deklaruje chęć zapłaty, rozważ **ugodę z harmonogramem spłaty** – najlepiej z uznaniem długu, które przerywa bieg przedawnienia.",
      },
    ],
    faq: [
      {
        question: "Czy przed pozwem trzeba wysłać wezwanie do zapłaty?",
        answer:
          "Nie zawsze jest to formalny wymóg, ale w pozwie trzeba wskazać, czy strony próbowały polubownie rozwiązać spór. Wezwanie jest najprostszym dowodem takiej próby, a przy braku terminu zapłaty dopiero ono czyni dług wymagalnym.",
      },
      {
        question: "Ile dni dać dłużnikowi na zapłatę?",
        answer:
          "Najczęściej 7 dni od doręczenia; 3 dni przy długu już dawno wymagalnym, 14 dni przy relacjach, które chcesz utrzymać. Wyjątek: pożyczka bez ustalonego terminu zwrotu – dłużnik ma 6 tygodni od wypowiedzenia.",
      },
      {
        question: "Jakie odsetki mogę doliczyć?",
        answer:
          "Osoba prywatna – odsetki ustawowe za opóźnienie. Firma wobec firmy – odsetki ustawowe za opóźnienie w transakcjach handlowych. Jeśli strony ustaliły odsetki w umowie – odsetki umowne, nie wyższe niż maksymalne. Odsetki liczy się od dnia następującego po terminie płatności.",
      },
      {
        question: "Czym jest rekompensata 40 euro?",
        answer:
          "To zryczałtowany zwrot kosztów odzyskiwania należności między przedsiębiorcami: 40 EUR przy długu do 5000 zł, 70 EUR do 50 000 zł i 100 EUR od 50 000 zł. Należy się od każdej faktury zapłaconej po terminie, bez wezwania i bez dowodu poniesienia kosztów.",
      },
      {
        question: "Czy mogę wysłać wezwanie do zapłaty e-mailem?",
        answer:
          "Możesz, ale w razie sporu trudniej udowodnić doręczenie. Bezpieczniej wysłać list polecony za potwierdzeniem odbioru. Jeśli uprzedzasz o wpisie do BIG, list polecony lub doręczenie do rąk własnych jest konieczne.",
      },
      {
        question: "Czy wezwanie do zapłaty przerywa przedawnienie?",
        answer:
          "Nie. Bieg przedawnienia przerywa m.in. pozew, wniosek o zawezwanie do próby ugodowej albo uznanie długu przez dłużnika. Jeśli przedawnienie jest blisko, nie czekaj z pozwem.",
      },
      {
        question: "Kiedy mogę wpisać dłużnika do BIG?",
        answer:
          "Gdy masz umowę z biurem informacji gospodarczej, dług jest wymagalny od co najmniej 30 dni, przekracza ustawowy próg kwotowy, a od wysłania wezwania z ostrzeżeniem o wpisie (z nazwą i adresem biura) minął co najmniej miesiąc.",
      },
    ],
  },
  ai: {
    context:
      "Pismo jest przedsądowym wezwaniem do zapłaty kierowanym przez wierzyciela (osobę prywatną lub firmę) do dłużnika, pisanym w pierwszej osobie przez wierzyciela lub osobę działającą w imieniu firmy. Opis faktów ma rzeczowo i chronologicznie przedstawić źródło długu (co zostało wykonane, przekazane lub pożyczone, kiedy i na jakich warunkach), termin płatności oraz dotychczasowe próby odzyskania pieniędzy. Ton urzędowy, stanowczy i spokojny – bez gróźb, epitetów, ocen moralnych i insynuacji wobec dłużnika. Nie podawaj kwot odsetek, rekompensaty, numeru rachunku ani terminu zapłaty – szablon wstawia je sam; nie wymyślaj faktów ani dat, których użytkownik nie podał. Nie przywołuj przepisów, aktów prawnych ani orzeczeń i pisz neutralnie płciowo.",
    factQuestionIds: [
      "creditor_type",
      "debtor_type",
      "debt_basis",
      "debt_document",
      "due_date",
      "principal_amount",
      "facts_description",
      "prior_reminders",
    ],
  },
  render: ({ answers, ai, today }) => {
    const company = isCompany(answers, "creditor_type");
    const name = str(answers, "sender_name");
    const nip = str(answers, "sender_nip", "");
    const email = str(answers, "sender_email", "");
    const phone = str(answers, "sender_phone", "");
    const account = str(answers, "bank_account");
    const amount = formatMoneyPl(num(answers, "principal_amount"));

    const actor = company
      ? `Działając w imieniu wierzyciela – ${name}${nip ? ` (NIP: ${nip})` : ""} – wzywam do zapłaty na jego rzecz`
      : "Działając we własnym imieniu, wzywam do zapłaty na moją rzecz";

    const paragraphs: Paragraph[] = [
      p(
        `${actor} kwoty ${amount} tytułem ${titleOfDebt(answers)}${interestKind(answers) !== "none" ? " wraz z odsetkami" : ""}${compensationClaimed(answers) ? " i rekompensatą za koszty odzyskiwania należności" : ""}, ${paymentTerm(answers)}, na rachunek bankowy nr ${account}.`,
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
      paragraphs.push(p("Na żądaną kwotę składają się:"));
    } else {
      paragraphs.push(p("W związku z powyższym wzywam do zapłaty:"));
    }
    paragraphs.push(list(demandItems(answers)));

    paragraphs.push(heading("Podstawa prawna"));
    paragraphs.push(...legalParagraphs(answers));

    paragraphs.push(heading("Termin zapłaty i dalsze kroki"));
    paragraphs.push(
      p(
        `Wpłaty należy dokonać ${paymentTerm(answers)}. W przypadku bezskutecznego upływu tego terminu sprawa zostanie skierowana na drogę postępowania sądowego bez ponownego wezwania. Wiązać się to będzie z obowiązkiem zwrotu przez dłużnika kosztów postępowania, w tym kosztów sądowych i kosztów zastępstwa procesowego (art. 98 § 1 Kodeksu postępowania cywilnego), a następnie – kosztów ewentualnego postępowania egzekucyjnego.`,
      ),
    );
    if (bool(answers, "big_warning")) {
      paragraphs.push(
        p(
          `Jednocześnie, zgodnie z przepisami ustawy z dnia 9 kwietnia 2010 r. o udostępnianiu informacji gospodarczych i wymianie danych gospodarczych, ostrzegam o zamiarze przekazania informacji o zaległości do biura informacji gospodarczej: ${str(answers, "big_name")}, jeżeli należność nie zostanie zapłacona w terminie miesiąca od dnia wysłania niniejszego wezwania.`,
        ),
      );
    }
    const contact = [email ? `e-mail: ${email}` : "", phone ? `tel. ${phone}` : ""].filter(Boolean).join(", ");
    paragraphs.push(
      p(
        `Proszę o pisemne potwierdzenie zapłaty lub przedstawienie stanowiska w sprawie w wyznaczonym terminie. W razie propozycji polubownego rozwiązania sprawy, w tym rozłożenia należności na raty, proszę o kontakt${contact ? ` (${contact})` : ""}.`,
      ),
    );

    const attachments: string[] = [];
    const basis = basisOf(answers);
    const doc = str(answers, "debt_document", "");
    if (basis === "invoice") attachments.push(`kopia faktury${doc ? ` nr ${doc}` : ""}`);
    if (basis === "contract") attachments.push(`kopia umowy${doc ? ` nr ${doc}` : ""}`);
    if (basis === "loan") attachments.push("kopia umowy pożyczki lub potwierdzenia przekazania środków");
    if (basis === "deposit") attachments.push("kopia umowy i potwierdzenia wpłaty kaucji");

    const subjectByBasis: Record<Basis, string> = {
      invoice: `dot. zapłaty faktury${doc ? ` nr ${doc}` : ""}`,
      contract: `dot. zapłaty należności z umowy${doc ? ` nr ${doc}` : ""}`,
      loan: "dot. zwrotu pożyczki",
      deposit: "dot. zwrotu kaucji",
      other: "dot. zapłaty należności",
    };

    const representative = str(answers, "sender_representative", "");
    return {
      sender: partyFromAnswers(answers, "sender", [
        company && nip ? `NIP: ${nip}` : "",
        email ? `e-mail: ${email}` : "",
        phone ? `tel. ${phone}` : "",
      ]),
      recipient: partyFromAnswers(answers, "recipient"),
      place: str(answers, "sender_city"),
      date: formatDatePl(today),
      title: "PRZEDSĄDOWE WEZWANIE DO ZAPŁATY",
      subject: `${subjectByBasis[basis]} – kwota główna ${amount}`,
      salutation: str(answers, "debtor_type", "") === "company" ? "Szanowni Państwo," : undefined,
      paragraphs,
      closing: "Z poważaniem",
      signatureName: company && representative ? `${representative} (w imieniu: ${name})` : name,
      attachments,
      previewParagraphCount: 2,
    };
  },
};
