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
 * Reklamacja i wezwanie do zwrotu proporcjonalnej części kosztów kredytu po wcześniejszej spłacie (tzw. „Lexitor”).
 * Rozgałęzienia:
 *  - `credit_type`: kredyt konsumencki (u.k.k. art. 49 ust. 1, art. 5 pkt 6, art. 52 + wyrok TSUE C-383/18)
 *    albo kredyt hipoteczny (u.k.h. art. 39 ust. 1 – bez powoływania wyroku Lexitor, który dotyczy dyrektywy 2008/48),
 *  - `previous_request`: brak wcześniejszego wniosku / odmowa / zwrot części (odejmujemy kwotę już zwróconą).
 * Kwota zwrotu liczona metodą liniową: koszt × (dni od spłaty do końca umowy ÷ dni od zawarcia do końca umowy).
 * Przepisy zweryfikowane z tekstami jednolitymi: u.k.k. Dz. U. z 2025 r. poz. 1362, u.k.h. Dz. U. z 2025 r. poz. 720,
 * u.r.r. Dz. U. z 2026 r. poz. 823, k.c. Dz. U. z 2026 r. poz. 795; wyrok C-383/18 – EUR-Lex (CELEX 62018CJ0383).
 * Szczegóły: docs/legal-review/zwrot-prowizji-wczesniejsza-splata-kredytu.md
 */

const UKK = "ustawy z dnia 12 maja 2011 r. o kredycie konsumenckim (dalej: „u.k.k.”)";
const UKH =
  "ustawy z dnia 23 marca 2017 r. o kredycie hipotecznym oraz o nadzorze nad pośrednikami kredytu hipotecznego i agentami (dalej: „u.k.h.”)";
const REKL =
  "ustawy z dnia 5 sierpnia 2015 r. o rozpatrywaniu reklamacji przez podmioty rynku finansowego, o Rzeczniku Finansowym i o Funduszu Edukacji Finansowej";
const ISAP_UKK = "https://isap.sejm.gov.pl/isap.nsf/DocDetails.xsp?id=WDU20111260715";
const ISAP_UKH = "https://isap.sejm.gov.pl/isap.nsf/DocDetails.xsp?id=WDU20170000819";
const ISAP_REKL = "https://isap.sejm.gov.pl/isap.nsf/DocDetails.xsp?id=WDU20150001348";
const ISAP_KC = "https://isap.sejm.gov.pl/isap.nsf/DocDetails.xsp?id=WDU19640160093";
const EURLEX_LEXITOR = "https://eur-lex.europa.eu/legal-content/PL/TXT/?uri=CELEX:62018CJ0383";

const DAY_MS = 86_400_000;

function parseIso(value: Answers[string]): Date | undefined {
  if (typeof value !== "string") return undefined;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!m) return undefined;
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
}

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

function daysPl(n: number): string {
  return n === 1 ? "1 dzień" : `${new Intl.NumberFormat("pl-PL").format(n)} dni`;
}

interface CostItem {
  label: string;
  amount: number;
  refund: number;
}

export interface RefundCalculation {
  valid: boolean;
  totalDays: number;
  remainingDays: number;
  items: CostItem[];
  sum: number;
  alreadyRefunded: number;
  due: number;
}

/** Metoda liniowa – proporcja dni niewykorzystanych do dni całego okresu kredytowania. */
export function calculateRefund(answers: Answers): RefundCalculation {
  const contract = parseIso(answers.contract_date);
  const planned = parseIso(answers.planned_end_date);
  const repayment = parseIso(answers.repayment_date);
  const totalDays = contract && planned ? Math.round((planned.getTime() - contract.getTime()) / DAY_MS) : 0;
  const remainingDays = repayment && planned ? Math.round((planned.getTime() - repayment.getTime()) / DAY_MS) : 0;
  const valid = totalDays > 0 && remainingDays > 0 && remainingDays < totalDays;

  const raw: { label: string; amount: number | undefined }[] = [
    { label: "prowizja", amount: num(answers, "commission") },
    { label: "koszt ubezpieczenia", amount: num(answers, "insurance_cost") },
    {
      label: str(answers, "other_costs_label", "") ? `inne koszty (${str(answers, "other_costs_label", "")})` : "inne koszty",
      amount: num(answers, "other_costs"),
    },
  ];
  const items: CostItem[] = raw
    .filter((r): r is { label: string; amount: number } => r.amount !== undefined && r.amount > 0)
    .map((r) => ({
      label: r.label,
      amount: r.amount,
      refund: valid ? roundMoney((r.amount * remainingDays) / totalDays) : 0,
    }));
  const sum = roundMoney(items.reduce((acc, i) => acc + i.refund, 0));
  const alreadyRefunded =
    str(answers, "previous_request", "no") === "partial" ? roundMoney(num(answers, "already_refunded") ?? 0) : 0;
  const due = roundMoney(Math.max(0, sum - alreadyRefunded));
  return { valid, totalDays, remainingDays, items, sum, alreadyRefunded, due };
}

function isMortgage(answers: Answers): boolean {
  return str(answers, "credit_type", "consumer") === "mortgage";
}

function calculationParagraphs(answers: Answers, calc: RefundCalculation): Paragraph[] {
  if (!calc.valid) {
    return [
      p(
        "Kwota zwrotu powinna zostać ustalona metodą liniową, tj. proporcjonalnie do okresu, o który skrócono czas obowiązywania umowy: kwota zwrotu = koszt × (liczba dni od dnia spłaty do dnia zakończenia umowy według harmonogramu ÷ liczba dni od dnia zawarcia umowy do dnia zakończenia umowy według harmonogramu). Wnoszę o dokonanie takiego wyliczenia i zwrot wynikającej z niego kwoty.",
      ),
    ];
  }
  const ratio = calc.remainingDays / calc.totalDays;
  const pct = new Intl.NumberFormat("pl-PL", { maximumFractionDigits: 2 }).format(ratio * 100);
  const out: Paragraph[] = [
    p(
      "Kwotę zwrotu wyliczono metodą liniową, proporcjonalnie do okresu, o który skrócono czas obowiązywania umowy, według wzoru: kwota zwrotu = koszt × (liczba dni od dnia spłaty do dnia zakończenia umowy według harmonogramu ÷ liczba dni od dnia zawarcia umowy do dnia zakończenia umowy według harmonogramu).",
    ),
    p(
      `Okres kredytowania według umowy: ${daysPl(calc.totalDays)} (od ${formatDatePl(
        str(answers, "contract_date", ""),
      )} do ${formatDatePl(str(answers, "planned_end_date", ""))}). Okres, o który skrócono umowę: ${daysPl(
        calc.remainingDays,
      )} (od ${formatDatePl(str(answers, "repayment_date", ""))} do ${formatDatePl(
        str(answers, "planned_end_date", ""),
      )}). Współczynnik zwrotu: ${calc.remainingDays}/${calc.totalDays} = ${pct}%.`,
    ),
    list(
      calc.items.map(
        (i) =>
          `${i.label}: ${formatMoneyPl(i.amount)} × ${calc.remainingDays}/${calc.totalDays} = ${formatMoneyPl(i.refund)}`,
      ),
    ),
  ];
  if (calc.alreadyRefunded > 0) {
    out.push(
      p(
        `Łącznie: ${formatMoneyPl(calc.sum)}. Po odjęciu kwoty ${formatMoneyPl(
          calc.alreadyRefunded,
        )} zwróconej już przez Państwa do zwrotu pozostaje ${formatMoneyPl(calc.due)}.`,
      ),
    );
  } else {
    out.push(p(`Łącznie do zwrotu: ${formatMoneyPl(calc.due)}.`));
  }
  return out;
}

function legalParagraphs(answers: Answers, today: Date): Paragraph[] {
  const out: Paragraph[] = [];
  if (isMortgage(answers)) {
    out.push(
      p(
        `Zgodnie z art. 39 ust. 1 ${UKH} w przypadku spłaty całości kredytu hipotecznego przed terminem określonym w umowie całkowity koszt kredytu hipotecznego ulega obniżeniu o odsetki i inne koszty kredytu hipotecznego przypadające za okres, o który skrócono obowiązywanie tej umowy, chociażby konsument poniósł je przed tą spłatą. Z brzmienia przepisu („chociażby konsument poniósł je przed tą spłatą”) wynika, że obniżenie obejmuje także koszty pobrane z góry, w tym prowizję – w części przypadającej na okres, o który skrócono umowę.`,
      ),
    );
  } else {
    out.push(
      p(
        `Zgodnie z art. 49 ust. 1 ${UKK} w przypadku spłaty całości kredytu przed terminem określonym w umowie całkowity koszt kredytu ulega obniżeniu o te koszty, które dotyczą okresu, o który skrócono czas obowiązywania umowy, chociażby konsument poniósł je przed tą spłatą. Całkowity koszt kredytu obejmuje wszelkie koszty, które konsument jest zobowiązany ponieść w związku z umową o kredyt, w szczególności odsetki, opłaty, prowizje, a także koszty usług dodatkowych, w tym ubezpieczeń, jeżeli ich poniesienie jest niezbędne do uzyskania kredytu lub do uzyskania go na oferowanych warunkach (art. 5 pkt 6 u.k.k.).`,
      ),
    );
    out.push(
      p(
        "Trybunał Sprawiedliwości Unii Europejskiej w wyroku z dnia 11 września 2019 r. w sprawie C-383/18 (Lexitor) orzekł, że art. 16 ust. 1 dyrektywy 2008/48/WE, wdrożony do polskiego porządku prawnego art. 49 u.k.k., należy interpretować w ten sposób, że prawo konsumenta do obniżki całkowitego kosztu kredytu w przypadku wcześniejszej spłaty kredytu obejmuje wszystkie koszty, które zostały nałożone na konsumenta. Obniżenie dotyczy zatem również prowizji i innych opłat pobranych jednorazowo, niezależnie od tego, czy zależą od czasu trwania umowy.",
      ),
    );
    const repayment = parseIso(answers.repayment_date);
    let lateText = "";
    if (repayment) {
      const settlementDeadline = new Date(repayment.getTime() + 14 * DAY_MS);
      const todayUtc = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
      if (settlementDeadline.getTime() < todayUtc) {
        lateText = ` Termin ten upłynął w dniu ${formatDatePl(
          new Date(settlementDeadline.getUTCFullYear(), settlementDeadline.getUTCMonth(), settlementDeadline.getUTCDate()),
        )}.`;
      }
    }
    out.push(
      p(
        `Zgodnie z art. 52 u.k.k. kredytodawca jest zobowiązany do rozliczenia z konsumentem kredytu w terminie 14 dni od dnia dokonania wcześniejszej spłaty kredytu w całości.${lateText}`,
      ),
    );
  }
  out.push(
    p(
      `Niniejsze pismo stanowi reklamację w rozumieniu art. 2 pkt 2 ${REKL}. Zgodnie z art. 6 tej ustawy odpowiedzi należy udzielić bez zbędnej zwłoki, nie później niż w terminie 30 dni od dnia otrzymania reklamacji (w szczególnie skomplikowanych przypadkach – nie później niż w terminie 60 dni, po spełnieniu wymogów z art. 7 tej ustawy), a w przypadku niedotrzymania tego terminu reklamację uważa się za rozpatrzoną zgodnie z wolą klienta (art. 8 tej ustawy).`,
    ),
  );
  return out;
}

export const zwrotProwizjiKredyt: LetterTemplate = {
  slug: "zwrot-prowizji-wczesniejsza-splata-kredytu",
  name: "Zwrot prowizji po wcześniejszej spłacie kredytu",
  category: "finanse",
  shortDescription:
    "Wezwanie banku lub firmy pożyczkowej do zwrotu części prowizji i ubezpieczenia po wcześniejszej spłacie kredytu – z wyliczoną kwotą.",
  priceGrosze: 2499,
  icon: "💸",
  estimatedMinutes: 7,
  sections: [
    {
      id: "sender",
      title: "Twoje dane",
      description: "Dane kredytobiorcy – takie, jak w umowie kredytu.",
      questions: senderQuestions(),
    },
    {
      id: "recipient",
      title: "Bank lub firma pożyczkowa",
      description:
        "Kredytodawca wskazany w umowie. Jeśli bank lub firma zmieniła nazwę albo została przejęta, wpisz aktualne dane następcy (sprawdzisz je w KRS).",
      questions: recipientQuestions("Kredytodawca"),
    },
    {
      id: "contract",
      title: "Umowa kredytu",
      questions: [
        {
          id: "credit_type",
          label: "Jaki to był kredyt?",
          type: "radio",
          help: "Kredyt gotówkowy, ratalny, samochodowy, pożyczka i karta kredytowa to kredyty konsumenckie. Hipoteczny ma osobne przepisy.",
          options: [
            { value: "consumer", label: "Kredyt konsumencki (gotówkowy, ratalny, samochodowy, pożyczka)" },
            { value: "mortgage", label: "Kredyt hipoteczny (zabezpieczony hipoteką)" },
          ],
        },
        {
          id: "contract_number",
          label: "Numer umowy",
          type: "text",
          placeholder: "np. KG/2023/123456",
          validate: { maxLength: 60 },
        },
        {
          id: "contract_date",
          label: "Data zawarcia umowy",
          type: "date",
          help: "Data z umowy. Od niej liczymy cały okres kredytowania.",
        },
        {
          id: "planned_end_date",
          label: "Data ostatniej raty według harmonogramu",
          type: "date",
          help: "Znajdziesz ją w harmonogramie spłat lub w umowie (okres kredytowania).",
        },
        {
          id: "repayment_date",
          label: "Data całkowitej wcześniejszej spłaty",
          type: "date",
          help: "Dzień, w którym spłacono cały kredyt (np. data przelewu lub zaświadczenia o spłacie).",
        },
        {
          id: "loan_amount",
          label: "Kwota kredytu z umowy",
          type: "money",
          placeholder: "30000.00",
          help: "Całkowita kwota kredytu (bez prowizji i ubezpieczenia), jeśli umowa ją wyodrębnia.",
        },
      ],
    },
    {
      id: "costs",
      title: "Koszty do rozliczenia",
      description:
        "Wpisz koszty pobrane jednorazowo lub z góry. Odsetek nie wpisuj – po spłacie bank ich nie nalicza. Kwotę zwrotu wyliczymy sami.",
      questions: [
        {
          id: "commission",
          label: "Prowizja za udzielenie kredytu",
          type: "money",
          placeholder: "3000.00",
          help: "Wpisz 0, jeśli prowizji nie było, a żądasz zwrotu np. tylko ubezpieczenia.",
        },
        {
          id: "insurance_cost",
          label: "Koszt ubezpieczenia pobranego z góry (opcjonalnie)",
          type: "money",
          required: false,
          placeholder: "1500.00",
          help: "Jednorazowa składka, jeśli ubezpieczenie było warunkiem kredytu lub jego warunków. Jeśli ubezpieczyciel już zwrócił część – wpisz pełną kwotę, a zwrot podaj niżej.",
        },
        {
          id: "other_costs",
          label: "Inne opłaty pobrane z góry (opcjonalnie)",
          type: "money",
          required: false,
          placeholder: "250.00",
          help: "Np. opłata przygotowawcza lub administracyjna.",
        },
        {
          id: "other_costs_label",
          label: "Czego dotyczą inne opłaty? (opcjonalnie)",
          type: "text",
          required: false,
          placeholder: "np. opłata przygotowawcza",
          validate: { maxLength: 80 },
        },
        {
          id: "previous_request",
          label: "Czy kredytodawca już rozliczył te koszty?",
          type: "radio",
          help: "Jeśli zwrócił część kosztów, odejmiemy tę kwotę od wyliczenia.",
          options: [
            { value: "no", label: "Nie – nic nie zwrócił i nie było wcześniejszego wniosku" },
            { value: "refused", label: "Odmówił zwrotu" },
            { value: "partial", label: "Zwrócił część (np. tylko odsetki lub część ubezpieczenia)" },
          ],
        },
        {
          id: "already_refunded",
          label: "Ile już zwrócono z tytułu tych kosztów?",
          type: "money",
          placeholder: "500.00",
          help: "Suma zwrotów prowizji, ubezpieczenia i opłat wpisanych wyżej (bez odsetek).",
          showIf: { questionId: "previous_request", equals: "partial" },
        },
        {
          id: "notes",
          label: "Dodatkowe informacje (opcjonalnie)",
          type: "textarea",
          required: false,
          placeholder: "np. Bank w piśmie z 5.09.2026 r. odmówił zwrotu prowizji, wskazując, że jest ona opłatą jednorazową niezależną od okresu kredytowania.",
          help: "Np. treść odpowiedzi banku lub okoliczności spłaty. Każdą informację w osobnej linii.",
          validate: { maxLength: 1500 },
        },
      ],
    },
    {
      id: "refund",
      title: "Zwrot i załączniki",
      questions: [
        {
          id: "iban",
          label: "Numer rachunku do zwrotu",
          type: "text",
          placeholder: "PL 00 0000 0000 0000 0000 0000 0000",
          validate: { maxLength: 40 },
        },
        {
          id: "att_contract",
          label: "Załączam kopię umowy kredytu (z harmonogramem)",
          type: "checkbox",
          required: false,
        },
        {
          id: "att_repayment",
          label: "Załączam potwierdzenie spłaty kredytu (zaświadczenie lub potwierdzenie przelewu)",
          type: "checkbox",
          required: false,
        },
        {
          id: "send_date",
          label: "Kiedy wyślesz pismo? (opcjonalnie)",
          type: "date",
          required: false,
          help: "Policzymy orientacyjnie, do kiedy kredytodawca powinien odpowiedzieć.",
        },
      ],
    },
  ],
  legalBasis: [
    {
      act: "Ustawa z dnia 12 maja 2011 r. o kredycie konsumenckim",
      article: "art. 49 ust. 1 i 2, art. 5 pkt 6",
      summary:
        "Przy wcześniejszej spłacie całkowity koszt kredytu – w tym prowizja i ubezpieczenie – maleje o koszty przypadające na okres, o który skrócono umowę, nawet jeśli zapłacono je z góry.",
      url: ISAP_UKK,
    },
    {
      act: "Ustawa z dnia 12 maja 2011 r. o kredycie konsumenckim",
      article: "art. 52",
      summary: "Kredytodawca rozlicza kredyt w ciągu 14 dni od całkowitej wcześniejszej spłaty.",
      url: ISAP_UKK,
    },
    {
      act: "Wyrok TSUE z dnia 11 września 2019 r., C-383/18 (Lexitor)",
      article: "art. 16 ust. 1 dyrektywy 2008/48/WE",
      summary: "Obniżka kosztu kredytu przy wcześniejszej spłacie obejmuje wszystkie koszty nałożone na konsumenta.",
      url: EURLEX_LEXITOR,
    },
    {
      act: "Ustawa z dnia 23 marca 2017 r. o kredycie hipotecznym oraz o nadzorze nad pośrednikami kredytu hipotecznego i agentami",
      article: "art. 39",
      summary:
        "Przy kredycie hipotecznym koszt kredytu maleje o odsetki i inne koszty przypadające za okres, o który skrócono umowę.",
      url: ISAP_UKH,
    },
    {
      act: "Ustawa z dnia 5 sierpnia 2015 r. o rozpatrywaniu reklamacji przez podmioty rynku finansowego, o Rzeczniku Finansowym i o Funduszu Edukacji Finansowej",
      article: "art. 6–8",
      summary: "Bank lub firma pożyczkowa ma 30 dni na odpowiedź na reklamację; milczenie oznacza jej uwzględnienie.",
      url: ISAP_REKL,
    },
    {
      act: "Ustawa z dnia 23 kwietnia 1964 r. – Kodeks cywilny",
      article: "art. 118, art. 481 § 1",
      summary:
        "Roszczenie o zwrot przedawnia się co do zasady po 6 latach (koniec roku kalendarzowego); za opóźnienie w zapłacie należą się odsetki ustawowe.",
      url: ISAP_KC,
    },
  ],
  deadlines: [
    {
      id: "settlement_14d",
      label: "Termin rozliczenia kredytu konsumenckiego (14 dni)",
      fromQuestionId: "repayment_date",
      days: 14,
      description:
        "Kredytodawca powinien rozliczyć kredyt konsumencki w ciągu 14 dni od całkowitej wcześniejszej spłaty (art. 52 ustawy o kredycie konsumenckim). Jeśli tego nie zrobił albo pominął prowizję i inne koszty pobrane z góry – wyślij reklamację.",
    },
    {
      id: "lender_response",
      label: "Orientacyjny termin odpowiedzi na reklamację",
      fromQuestionId: "send_date",
      days: 30,
      description:
        "Bank lub firma pożyczkowa ma 30 dni od otrzymania reklamacji na odpowiedź (art. 6 ustawy o rozpatrywaniu reklamacji), wyjątkowo 60 dni. Brak odpowiedzi w terminie oznacza uwzględnienie reklamacji. Data liczona od wysłania jest orientacyjna – dolicz czas doręczenia.",
    },
    {
      id: "limitation_6y",
      label: "Ostrożny termin przedawnienia roszczenia",
      fromQuestionId: "repayment_date",
      years: 6,
      description:
        "Roszczenie konsumenta o zwrot części kosztów kredytu przedawnia się co do zasady po 6 latach (art. 118 k.c.), a koniec terminu przypada na ostatni dzień roku kalendarzowego – data powyżej jest więc ostrożnym, najwcześniejszym szacunkiem. Dla spłat sprzed 9 lipca 2018 r. obowiązują przepisy przejściowe – w razie wątpliwości skonsultuj się z prawnikiem.",
    },
  ],
  instructions: {
    whereToSend: `Pismo wysyłasz do **kredytodawcy, z którym zawarto umowę** – banku, SKOK-u albo firmy pożyczkowej. Adres do reklamacji znajdziesz w umowie, w regulaminie lub na stronie internetowej (zakładka „Reklamacje”).

- Jeśli kredyt był udzielony w sklepie (raty), kredytodawcą jest bank lub firma wskazana w umowie, a nie sklep.
- Jeśli kredytodawca zmienił nazwę lub został przejęty, wyślij pismo do następcy prawnego (sprawdzisz w KRS).
- Jeśli wierzytelność sprzedano firmie windykacyjnej przed spłatą, skonsultuj, do kogo skierować roszczenie.`,
    howToSend: `Najlepiej **listem poleconym za potwierdzeniem odbioru** albo **przez bankowość internetową / formularz reklamacyjny** (dołącz podpisane pismo jako PDF). Możesz też złożyć pismo w oddziale – poproś o potwierdzenie przyjęcia z datą.

Dołącz kopie: umowy z harmonogramem i potwierdzenia spłaty (zaświadczenie banku albo potwierdzenie przelewu). Oryginały zachowaj u siebie.`,
    afterSending: `Kredytodawca ma **30 dni** na odpowiedź na reklamację (w szczególnie skomplikowanych sprawach – 60 dni, po uprzednim poinformowaniu Cię o przyczynie). **Brak odpowiedzi w terminie oznacza uwzględnienie reklamacji.**

Jeśli kredytodawca odmówi lub zwróci za mało:
- złóż **wniosek do Rzecznika Finansowego** (interwencja bezpłatna, postępowanie polubowne – 50 zł),
- przy kredycie bankowym możesz skorzystać z **Arbitra Bankowego przy ZBP**,
- skontaktuj się z **miejskim lub powiatowym rzecznikiem konsumentów**,
- rozważ **pozew do sądu rejonowego** – przy kwotach do 20 000 zł sprawa toczy się w postępowaniu uproszczonym, a opłata sądowa jest stała i niska przy niewielkich kwotach.`,
    checklist: [
      "Sprawdź w umowie datę zawarcia i datę ostatniej raty z harmonogramu.",
      "Ustal dokładną datę całkowitej spłaty (zaświadczenie lub potwierdzenie przelewu).",
      "Sprawdź w umowie kwotę prowizji, ubezpieczenia i innych opłat pobranych z góry.",
      "Podaj numer rachunku do zwrotu i podpisz pismo.",
      "Wyślij listem poleconym lub przez formularz reklamacyjny i zachowaj potwierdzenie.",
      "Zapisz datę, w której mija 30 dni na odpowiedź.",
    ],
  },
  seo: {
    title: "Zwrot prowizji po wcześniejszej spłacie kredytu – wzór",
    metaDescription:
      "Wzór wezwania do zwrotu prowizji po wcześniejszej spłacie kredytu (Lexitor). Generator sam wylicza kwotę zwrotu metodą liniową. Pobierz DOCX lub PDF.",
    h1: "Zwrot prowizji po wcześniejszej spłacie kredytu – wzór z kalkulatorem",
    intro:
      "Kredyt został spłacony przed terminem, a bank nie oddał części prowizji ani ubezpieczenia? Podaj daty i koszty z umowy – generator wyliczy kwotę zwrotu metodą liniową i przygotuje reklamację z wezwaniem do zapłaty, z aktualnymi przepisami. Pismo pobierzesz jako DOCX lub PDF.",
    keywords: [
      "zwrot prowizji wcześniejsza spłata kredytu",
      "zwrot prowizji kredyt wzór",
      "lexitor wzór pisma",
      "zwrot kosztów kredytu po wcześniejszej spłacie",
      "zwrot prowizji kalkulator",
      "wcześniejsza spłata kredytu zwrot ubezpieczenia",
      "sankcja lexitor zwrot prowizji",
    ],
    guide: [
      {
        heading: "Czy po wcześniejszej spłacie kredytu należy się zwrot prowizji?",
        body: `Tak. Jeśli spłacasz kredyt konsumencki przed terminem, **całkowity koszt kredytu maleje o koszty przypadające na okres, o który skrócono umowę** – nawet jeśli zostały zapłacone z góry (art. 49 ust. 1 ustawy o kredycie konsumenckim). Dotyczy to nie tylko odsetek, ale też **prowizji, opłat przygotowawczych i ubezpieczenia**, jeśli było warunkiem udzielenia kredytu lub jego warunków.

Przełomem był wyrok TSUE z 11 września 2019 r. w sprawie **C-383/18 (Lexitor)**: prawo do obniżki obejmuje **wszystkie koszty nałożone na konsumenta**. Wcześniej banki zwracały tylko koszty „zależne od czasu trwania umowy”. Dziś brzmienie art. 49 wprost przesądza, że zwrot należy się także za koszty poniesione przed spłatą.

Zwrot przysługuje również wtedy, gdy kredyt został spłacony **przed wyrokiem TSUE** – o ile roszczenie się nie przedawniło.`,
      },
      {
        heading: "Jak obliczyć kwotę zwrotu – metoda liniowa",
        body: `Najczęściej stosuje się **metodę liniową** (proporcjonalną do liczby dni):

**kwota zwrotu = koszt × (dni od spłaty do końca umowy ÷ dni całego okresu kredytowania)**

Przykład: prowizja 3000 zł, umowa zawarta 1 marca 2023 r. na 5 lat (koniec 1 marca 2028 r. – 1827 dni), spłata 1 marca 2025 r. Do końca umowy zostało 1096 dni. Zwrot: 3000 zł × 1096/1827 ≈ 1799,67 zł.

Generator robi to wyliczenie za Ciebie i pokazuje je w piśmie – z liczbą dni, współczynnikiem i kwotą dla każdego kosztu (prowizja, ubezpieczenie, inne opłaty). Jeśli kredytodawca zwrócił już część, odejmiemy ją.

Banki czasem stosują **metodę „ratalną” (actuarialną)**, która daje niższe kwoty. W przepisach nie ma wskazanej jednej metody, ale metoda liniowa jest najprostsza i najczęściej przyjmowana w sporach konsumenckich.`,
      },
      {
        heading: "Krok po kroku",
        body: `1. **Znajdź umowę i harmonogram** – potrzebujesz daty zawarcia umowy, daty ostatniej raty i kwot prowizji, ubezpieczenia, opłat.
2. **Ustal datę spłaty** – z zaświadczenia o spłacie lub potwierdzenia przelewu.
3. **Sprawdź, co już zwrócono** – banki często oddają tylko część ubezpieczenia lub odsetki.
4. **Wypełnij generator** – wyliczymy kwotę i przygotujemy reklamację z wezwaniem do zapłaty w 14 dni.
5. **Wyślij pismo** listem poleconym lub przez formularz reklamacyjny.
6. **Czekaj maksymalnie 30 dni** na odpowiedź – brak odpowiedzi oznacza uwzględnienie reklamacji.

Zachowaj kopię pisma, potwierdzenie nadania i całą korespondencję z kredytodawcą. Jeśli bank przyśle własne wyliczenie, porównaj je z naszym: sprawdź, czy uwzględnił wszystkie koszty pobrane z góry, czy przyjął właściwe daty i czy nie pominął opłat ukrytych w kwocie kredytu (np. prowizji doliczonej do kapitału).`,
      },
      {
        heading: "Kredyt hipoteczny i inne szczególne przypadki",
        body: `- **Kredyt hipoteczny** – podstawą jest art. 39 ustawy o kredycie hipotecznym: przy wcześniejszej spłacie koszt maleje o odsetki i inne koszty przypadające za okres, o który skrócono umowę. Ustawa obowiązuje od 22 lipca 2017 r.; przy starszych umowach i przy kosztach jednorazowych sytuacja prawna jest mniej jednoznaczna niż przy kredycie konsumenckim, a wyrok Lexitor dotyczył kredytów konsumenckich. Przy wysokich kwotach warto skonsultować się z prawnikiem.
- **Częściowa wcześniejsza spłata** – zwrot też przysługuje (art. 49 ust. 2), ale wyliczenie jest bardziej złożone. Ten generator liczy zwrot przy spłacie całości.
- **Kredyt refinansowany** (spłacony nowym kredytem w tym samym lub innym banku) – to także wcześniejsza spłata.
- **Ubezpieczenie** – jeśli składkę zwrócił ubezpieczyciel, a nie bank, uwzględnij tę kwotę jako już zwróconą.`,
      },
      {
        heading: "Terminy i przedawnienie",
        body: `- **14 dni** – kredytodawca powinien rozliczyć kredyt w ciągu 14 dni od całkowitej wcześniejszej spłaty (art. 52 ustawy o kredycie konsumenckim).
- **30 dni** – na odpowiedź na reklamację (art. 6 ustawy o rozpatrywaniu reklamacji), wyjątkowo 60 dni. Milczenie oznacza uwzględnienie reklamacji (art. 8).
- **6 lat** – roszczenie konsumenta o zwrot przedawnia się co do zasady po 6 latach, a koniec terminu przypada na ostatni dzień roku kalendarzowego (art. 118 k.c.). Przy spłatach sprzed 9 lipca 2018 r. obowiązują przepisy przejściowe – mogą działać na Twoją korzyść, ale warto je sprawdzić.

Nie czekaj jednak do końca terminu – im szybciej wyślesz pismo, tym łatwiej o dokumenty i tym szybciej odzyskasz pieniądze.`,
      },
      {
        heading: "Co zrobić, gdy bank odmówi",
        body: `- **Rzecznik Finansowy** – wniosek o interwencję jest bezpłatny, a postępowanie polubowne kosztuje 50 zł. Rzecznik od lat wspiera konsumentów w sprawach zwrotu kosztów po wcześniejszej spłacie.
- **Arbiter Bankowy przy ZBP** – dla sporów z bankami (sprawdź aktualne limity kwotowe).
- **Rzecznik konsumentów** w Twoim mieście lub powiecie – bezpłatna pomoc i interwencja.
- **Sąd** – sprawy o zwrot prowizji są zwykle proste dowodowo: umowa, harmonogram i potwierdzenie spłaty. Do kwoty 20 000 zł obowiązuje postępowanie uproszczone.
- **Cesja roszczenia** – niektóre firmy odkupują roszczenia za część kwoty. Porównaj ofertę z kwotą, którą możesz odzyskać samodzielnie.`,
      },
    ],
    faq: [
      {
        question: "Czy zwrot prowizji należy się także za kredyt spłacony kilka lat temu?",
        answer:
          "Tak, jeśli roszczenie się nie przedawniło. Roszczenie konsumenta przedawnia się co do zasady po 6 latach, z końcem roku kalendarzowego. Prawo do zwrotu dotyczy także kredytów spłaconych przed wyrokiem TSUE w sprawie Lexitor z 11 września 2019 r.",
      },
      {
        question: "Jak obliczyć zwrot prowizji?",
        answer:
          "Najprościej metodą liniową: prowizja × (liczba dni od spłaty do końca umowy ÷ liczba dni całego okresu umowy). Generator robi to automatycznie dla prowizji, ubezpieczenia i innych opłat i pokazuje wyliczenie w piśmie.",
      },
      {
        question: "Czy zwrot obejmuje ubezpieczenie kredytu?",
        answer:
          "Tak, jeżeli ubezpieczenie było warunkiem udzielenia kredytu lub uzyskania go na oferowanych warunkach – wtedy jego koszt wchodzi w całkowity koszt kredytu (art. 5 pkt 6 ustawy o kredycie konsumenckim). Uwzględnij kwotę, którą ubezpieczyciel już zwrócił.",
      },
      {
        question: "Ile czasu ma bank na odpowiedź?",
        answer:
          "30 dni od otrzymania reklamacji, a w szczególnie skomplikowanych sprawach maksymalnie 60 dni – bank musi wtedy wyjaśnić przyczynę opóźnienia. Jeśli nie odpowie w terminie, reklamację uważa się za rozpatrzoną zgodnie z Twoją wolą.",
      },
      {
        question: "Czy to dotyczy też firm pożyczkowych i rat w sklepie?",
        answer:
          "Tak. Ustawa o kredycie konsumenckim obejmuje pożyczki z firm pożyczkowych, kredyty ratalne i gotówkowe. Pismo kierujesz do kredytodawcy wskazanego w umowie – przy ratach w sklepie jest nim bank lub firma finansująca, a nie sam sklep.",
      },
      {
        question: "A jeśli spłacono tylko część kredytu?",
        answer:
          "Przy częściowej wcześniejszej spłacie zwrot też przysługuje (art. 49 ust. 2), ale wyliczenie jest bardziej złożone i zależy od harmonogramu. Ten generator liczy zwrot przy spłacie całości kredytu.",
      },
      {
        question: "Czy przy kredycie hipotecznym też odzyskam prowizję?",
        answer:
          "Ustawa o kredycie hipotecznym (art. 39) przewiduje obniżenie odsetek i innych kosztów przypadających za okres, o który skrócono umowę. Przy kosztach jednorazowych i umowach sprzed 22 lipca 2017 r. sytuacja jest mniej jednoznaczna – przy wysokich kwotach warto skonsultować sprawę z prawnikiem.",
      },
    ],
  },
  ai: {
    context:
      "Reklamacja i wezwanie konsumenta do kredytodawcy o zwrot proporcjonalnej części prowizji, ubezpieczenia i innych kosztów kredytu po całkowitej wcześniejszej spłacie. Opis faktów ma krótko przedstawić umowę (rodzaj kredytu, data zawarcia, kwota, przewidziany okres), datę całkowitej spłaty, poniesione koszty oraz dotychczasowe stanowisko kredytodawcy (brak rozliczenia, odmowa lub zwrot części). Wyliczenie kwoty, wzór i podstawy prawne dodaje szablon – nie licz kwot samodzielnie i nie podawaj wyniku obliczeń. Żądanie: zwrot kwoty wyliczonej w piśmie na wskazany rachunek. Pisz w pierwszej osobie, w czasie teraźniejszym lub stronie biernej, bez form zależnych od płci. Nie powołuj przepisów ani orzeczeń.",
    factQuestionIds: [
      "credit_type",
      "contract_date",
      "planned_end_date",
      "repayment_date",
      "loan_amount",
      "commission",
      "insurance_cost",
      "other_costs",
      "other_costs_label",
      "previous_request",
      "already_refunded",
      "notes",
    ],
  },
  render: ({ answers, ai, today }) => {
    const email = str(answers, "sender_email", "");
    const phone = str(answers, "sender_phone", "");
    const mortgage = isMortgage(answers);
    const calc = calculateRefund(answers);
    const contractNo = str(answers, "contract_number");
    const creditWord = mortgage ? "kredytu hipotecznego" : "kredytu konsumenckiego";
    const previous = str(answers, "previous_request", "no");

    const paragraphs: Paragraph[] = [
      p(
        `Na podstawie umowy ${creditWord} nr ${contractNo}, zawartej w dniu ${formatDatePl(
          str(answers, "contract_date", ""),
        )}, udzielono mi kredytu w kwocie ${formatMoneyPl(num(answers, "loan_amount"))}. Zgodnie z umową ostatnia rata miała zostać zapłacona w dniu ${formatDatePl(
          str(answers, "planned_end_date", ""),
        )}. Kredyt został spłacony w całości przed terminem, w dniu ${formatDatePl(str(answers, "repayment_date", ""))}.`,
      ),
      p(
        calc.valid && calc.due > 0
          ? `W związku z wcześniejszą spłatą składam reklamację i wzywam do zwrotu kwoty ${formatMoneyPl(
              calc.due,
            )}, stanowiącej proporcjonalną część kosztów kredytu przypadającą na okres, o który skrócono czas obowiązywania umowy (wyliczenie poniżej).`
          : "W związku z wcześniejszą spłatą składam reklamację i wzywam do zwrotu proporcjonalnej części kosztów kredytu (prowizji, opłat i kosztu ubezpieczenia) przypadającej na okres, o który skrócono czas obowiązywania umowy.",
      ),
    ];

    if (ai?.facts) {
      paragraphs.push(...paragraphsFromText(ai.facts));
      paragraphs.push(...paragraphsFromText(ai.justification));
    } else {
      if (previous === "refused") {
        paragraphs.push(p("Dotychczas kredytodawca odmówił zwrotu tych kosztów. Stanowisko to jest niezgodne z przepisami wskazanymi poniżej."));
      } else if (previous === "no") {
        paragraphs.push(p("Do dnia sporządzenia niniejszego pisma koszty te nie zostały rozliczone."));
      }
      userParagraphs(str(answers, "notes", "")).forEach((t) => paragraphs.push(p(t)));
    }

    paragraphs.push(heading("Wyliczenie kwoty zwrotu"));
    paragraphs.push(...calculationParagraphs(answers, calc));

    if (ai?.demand) paragraphs.push(...paragraphsFromText(ai.demand));
    const iban = str(answers, "iban");
    paragraphs.push(
      p(
        `${ai?.demand ? "W szczególności wzywam" : "Wzywam"} do zapłaty kwoty ${
          calc.valid ? formatMoneyPl(calc.due) : "wynikającej z powyższego wyliczenia"
        } na rachunek bankowy nr ${iban} (posiadacz rachunku: ${str(
          answers,
          "sender_name",
        )}) w terminie 14 dni od dnia doręczenia niniejszego pisma. W razie bezskutecznego upływu tego terminu skieruję sprawę do Rzecznika Finansowego lub na drogę postępowania sądowego, z żądaniem zapłaty także odsetek ustawowych za opóźnienie (art. 481 § 1 k.c.).`,
      ),
    );

    paragraphs.push(heading("Uzasadnienie prawne"));
    paragraphs.push(...legalParagraphs(answers, today));

    paragraphs.push(
      p(`Odpowiedź proszę przesłać na adres wskazany w nagłówku${email ? ` lub na adres e-mail: ${email}` : ""}.`),
    );

    const attachments: string[] = [];
    if (bool(answers, "att_contract")) attachments.push("Kopia umowy kredytu wraz z harmonogramem spłat");
    if (bool(answers, "att_repayment")) attachments.push("Kopia potwierdzenia całkowitej spłaty kredytu");

    return {
      sender: partyFromAnswers(answers, "sender", [email ? `e-mail: ${email}` : "", phone ? `tel. ${phone}` : ""]),
      recipient: partyFromAnswers(answers, "recipient"),
      place: str(answers, "sender_city"),
      date: formatDatePl(today),
      title: "REKLAMACJA I WEZWANIE DO ZWROTU KOSZTÓW KREDYTU PO WCZEŚNIEJSZEJ SPŁACIE",
      subject: `Dotyczy: umowa ${creditWord} nr ${contractNo} z dnia ${formatDatePl(str(answers, "contract_date", ""))}`,
      salutation: "Szanowni Państwo,",
      paragraphs: paragraphs.map(tidyParagraph),
      closing: "Z poważaniem",
      signatureName: str(answers, "sender_name"),
      attachments,
      previewParagraphCount: 2,
    };
  },
};
