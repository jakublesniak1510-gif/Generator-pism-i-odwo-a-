import type { Answers, LetterTemplate, Paragraph } from "./types";
import {
  bool,
  formatDatePl,
  formatMoneyPl,
  heading,
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
 * Wezwanie byłego wynajmującego do zwrotu kaucji mieszkaniowej.
 * Warianty najmu (`lease_type`):
 *  - standard: zwykły najem lokalu mieszkalnego – art. 6 ust. 1, 3 (waloryzacja) i 4 (zwrot w miesiąc) u.o.p.l.,
 *  - occasional: najem okazjonalny – art. 19a ust. 4–5 u.o.p.l. (kaucja ≤ 6-krotność czynszu),
 *  - institutional: najem instytucjonalny – art. 19f ust. 4–6 u.o.p.l.
 * Waloryzację (art. 6 ust. 3) liczymy tylko dla najmu „zwykłego” i tylko gdy podano oba czynsze.
 * Potrącenia: art. 675 § 1 k.c. (normalne zużycie), art. 6 k.c. (ciężar dowodu), art. 6c u.o.p.l. (protokół).
 * Odsetki: art. 481 § 1 k.c. od dnia następującego po upływie miesiąca od opróżnienia lokalu.
 * Zweryfikowano z t.j.: u.o.p.l. Dz. U. z 2023 r. poz. 725, k.c. Dz. U. z 2026 r. poz. 795.
 * Szczegóły: docs/legal-review/wezwanie-do-zwrotu-kaucji.md
 */

const UOPL_FULL =
  "ustawy z dnia 21 czerwca 2001 r. o ochronie praw lokatorów, mieszkaniowym zasobie gminy i o zmianie Kodeksu cywilnego (dalej: „u.o.p.l.”)";
const ISAP_UOPL = "https://isap.sejm.gov.pl/isap.nsf/DocDetails.xsp?id=WDU20010710733";
const ISAP_KC = "https://isap.sejm.gov.pl/isap.nsf/DocDetails.xsp?id=WDU19640160093";

type LeaseType = "standard" | "occasional" | "institutional";
type DeductionStatus = "nothing_returned" | "partial" | "announced";

function dateAnswer(answers: Answers, id: string): Date | undefined {
  const v = answers[id];
  if (typeof v !== "string") return undefined;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v.trim());
  if (!m) return undefined;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

/** Termin miesięczny wg art. 112 k.c. (gdy brak dnia – ostatni dzień miesiąca). */
function addMonths(d: Date, months: number): Date {
  const last = new Date(d.getFullYear(), d.getMonth() + months + 1, 0).getDate();
  return new Date(d.getFullYear(), d.getMonth() + months, Math.min(d.getDate(), last));
}

function addDays(d: Date, days: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + days);
}

/** Wielkanoc (algorytm Meeusa/Jonesa/Butchera) – do ustalenia dni wolnych od pracy. */
function easterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

function isDayOff(d: Date): boolean {
  if (d.getDay() === 0 || d.getDay() === 6) return true;
  const md = `${d.getMonth() + 1}-${d.getDate()}`;
  if (["1-1", "1-6", "5-1", "5-3", "8-15", "11-1", "11-11", "12-25", "12-26"].includes(md)) return true;
  if (md === "12-24" && d.getFullYear() >= 2025) return true;
  const easter = easterSunday(d.getFullYear());
  return [1, 60].some((off) => addDays(easter, off).getTime() === d.getTime());
}

/** Art. 115 k.c.: termin przypadający na sobotę lub dzień wolny upływa następnego dnia roboczego. */
function shiftToWorkday(d: Date): Date {
  let out = d;
  while (isDayOff(out)) out = addDays(out, 1);
  return out;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function formatNumberPl(n: number): string {
  return new Intl.NumberFormat("pl-PL", { maximumFractionDigits: 2 }).format(n);
}

function leaseTypeOf(answers: Answers): LeaseType {
  const v = str(answers, "lease_type", "standard");
  return v === "occasional" || v === "institutional" ? v : "standard";
}

function deductionStatusOf(answers: Answers): DeductionStatus {
  const v = str(answers, "deduction_status", "nothing_returned");
  return v === "partial" || v === "announced" ? v : "nothing_returned";
}

interface Amounts {
  deposit?: number;
  /** krotność czynszu przyjęta przy pobraniu kaucji */
  multiple?: number;
  /** kwota zwaloryzowana (art. 6 ust. 3) – przed porównaniem z kaucją pobraną */
  valorized?: number;
  /** kwota należna do zwrotu przed odjęciem kwoty już zwróconej */
  due?: number;
  returned: number;
  /** kwota, do której zapłaty wzywamy */
  claim?: number;
}

function computeAmounts(answers: Answers): Amounts {
  const deposit = num(answers, "deposit_amount");
  const status = deductionStatusOf(answers);
  const returned = status === "partial" ? (num(answers, "returned_amount") ?? 0) : 0;
  const out: Amounts = { deposit, returned };
  if (deposit === undefined) return out;
  let due = deposit;
  const rentPay = num(answers, "rent_at_payment");
  const rentNow = num(answers, "rent_at_return");
  if (leaseTypeOf(answers) === "standard" && rentPay && rentNow && rentPay > 0) {
    out.multiple = round2(deposit / rentPay);
    out.valorized = round2((deposit / rentPay) * rentNow);
    due = Math.max(out.valorized, deposit);
  }
  out.due = round2(due);
  out.claim = round2(Math.max(0, due - returned));
  return out;
}

const RETURN_RULE: Record<LeaseType, string> = {
  standard: `Zgodnie z art. 6 ust. 4 ${UOPL_FULL} kaucja podlega zwrotowi w ciągu miesiąca od dnia opróżnienia lokalu, po potrąceniu należności wynajmującego z tytułu najmu lokalu.`,
  occasional: `Zgodnie z art. 19a ust. 5 ${UOPL_FULL} kaucja wpłacona przy zawarciu umowy najmu okazjonalnego lokalu podlega zwrotowi w ciągu miesiąca od dnia opróżnienia lokalu, po potrąceniu należności właściciela z tytułu najmu okazjonalnego lokalu oraz ewentualnych kosztów egzekucji obowiązku opróżnienia lokalu (art. 19a ust. 4 u.o.p.l.).`,
  institutional: `Zgodnie z art. 19f ust. 6 ${UOPL_FULL} kaucja wpłacona przy zawarciu umowy najmu instytucjonalnego lokalu podlega zwrotowi w ciągu miesiąca od dnia opróżnienia lokalu, po potrąceniu należności właściciela z tytułu najmu oraz ewentualnych kosztów egzekucji obowiązku opróżnienia lokalu (art. 19f ust. 4 u.o.p.l.).`,
};

export const wezwanieDoZwrotuKaucji: LetterTemplate = {
  slug: "wezwanie-do-zwrotu-kaucji",
  name: "Wezwanie do zwrotu kaucji za mieszkanie",
  category: "mieszkanie",
  shortDescription:
    "Wezwij byłego wynajmującego do zwrotu kaucji – z waloryzacją, odsetkami i zakwestionowaniem potrąceń za normalne zużycie.",
  priceGrosze: 2499,
  icon: "🔑",
  estimatedMinutes: 6,
  sections: [
    {
      id: "sender",
      title: "Twoje dane",
      description: "Dane najemcy – takie jak w umowie najmu. Podaj aktualny adres do korespondencji.",
      questions: senderQuestions(),
    },
    {
      id: "recipient",
      title: "Wynajmujący",
      description:
        "Dane wynajmującego z umowy najmu (osoba prywatna lub firma). Jeśli wynajmujący podał nowy adres, użyj nowego; w przeciwnym razie – adresu z umowy.",
      questions: recipientQuestions("Wynajmujący"),
    },
    {
      id: "lease",
      title: "Najem i zwrot mieszkania",
      questions: [
        {
          id: "rental_address",
          label: "Adres wynajmowanego mieszkania",
          type: "text",
          placeholder: "ul. Lipowa 5 m. 12, 00-001 Warszawa",
        },
        {
          id: "lease_type",
          label: "Rodzaj umowy najmu",
          type: "radio",
          help: "Najem okazjonalny ma oświadczenie notarialne najemcy o poddaniu się egzekucji; najem instytucjonalny zawiera firma zajmująca się zawodowo wynajmem. W razie wątpliwości wybierz „zwykły”.",
          options: [
            { value: "standard", label: "Zwykły najem mieszkania" },
            { value: "occasional", label: "Najem okazjonalny (z aktem notarialnym)" },
            { value: "institutional", label: "Najem instytucjonalny (wynajmujący to firma prowadząca wynajem zawodowo)" },
          ],
        },
        {
          id: "contract_date",
          label: "Data zawarcia umowy najmu",
          type: "date",
          help: "Data z umowy. Jeśli zawierano kolejne aneksy – data pierwotnej umowy.",
        },
        {
          id: "lease_end_date",
          label: "Data zakończenia najmu",
          type: "date",
          help: "Dzień, w którym umowa wygasła lub została rozwiązana (np. po wypowiedzeniu).",
        },
        {
          id: "vacate_date",
          label: "Data opróżnienia i wydania mieszkania (oddania kluczy)",
          type: "date",
          help: "Od tego dnia wynajmujący ma 1 miesiąc na zwrot kaucji.",
        },
        {
          id: "handover_protocol",
          label: "Czy przy oddaniu mieszkania spisano protokół zdawczo-odbiorczy?",
          type: "radio",
          options: [
            { value: "clean", label: "Tak – bez zastrzeżeń co do stanu mieszkania" },
            { value: "remarks", label: "Tak – z uwagami wynajmującego" },
            { value: "none", label: "Nie spisano protokołu" },
          ],
          help: "Protokół jest najlepszym dowodem stanu mieszkania. Jeśli go nie ma, przydadzą się zdjęcia lub film z dnia wyprowadzki.",
        },
        {
          id: "all_paid",
          label: "Na dzień wyprowadzki nie mam zaległości w czynszu i opłatach",
          type: "checkbox",
          required: false,
          help: "Zaznacz tylko, jeśli wszystkie rachunki (także za media) są rozliczone.",
        },
      ],
    },
    {
      id: "deposit",
      title: "Kaucja i potrącenia",
      questions: [
        {
          id: "deposit_amount",
          label: "Wysokość wpłaconej kaucji",
          type: "money",
          placeholder: "3000.00",
          help: "Kwota z umowy lub z potwierdzenia przelewu.",
        },
        {
          id: "rent_at_payment",
          label: "Miesięczny czynsz w dniu wpłaty kaucji (opcjonalnie)",
          type: "money",
          required: false,
          placeholder: "2500.00",
          showIf: { questionId: "lease_type", equals: "standard" },
          help: "Sam czynsz najmu, bez opłat za media. Służy do waloryzacji kaucji (art. 6 ust. 3 ustawy o ochronie praw lokatorów).",
        },
        {
          id: "rent_at_return",
          label: "Miesięczny czynsz za to mieszkanie obecnie (opcjonalnie)",
          type: "money",
          required: false,
          placeholder: "2800.00",
          showIf: { questionId: "lease_type", equals: "standard" },
          help: "Czynsz obowiązujący w dniu zwrotu kaucji, np. ostatni czynsz albo stawka z nowego ogłoszenia. Jeśli wzrósł, kaucja podlega zwrotowi w wyższej kwocie. Zostaw puste, jeśli nie wiesz.",
        },
        {
          id: "deduction_status",
          label: "Co stało się z kaucją?",
          type: "radio",
          options: [
            { value: "nothing_returned", label: "Wynajmujący nic nie zwrócił" },
            { value: "partial", label: "Wynajmujący zwrócił tylko część (resztę potrącił)" },
            { value: "announced", label: "Wynajmujący zapowiada potrącenia albo zwleka z rozliczeniem" },
          ],
          help: "Jeśli wynajmujący przelał część kaucji, wybierz drugą opcję – pismo obejmie tylko brakującą kwotę.",
        },
        {
          id: "returned_amount",
          label: "Ile już zwrócono?",
          type: "money",
          placeholder: "1200.00",
          showIf: { questionId: "deduction_status", equals: "partial" },
          help: "Pismo wezwie do zapłaty pozostałej części.",
        },
        {
          id: "deduction_reason",
          label: "Co wynajmujący potrącił lub chce potrącić i z jakiego powodu? (opcjonalnie)",
          type: "textarea",
          required: false,
          showIf: { questionId: "deduction_status", equals: ["partial", "announced"] },
          placeholder: "np. 1800 zł za malowanie ścian i wymianę wykładziny w pokoju",
          validate: { maxLength: 1200 },
          help: "Przepisz uzasadnienie wynajmującego – pismo się do niego odniesie.",
        },
        {
          id: "dispute_wear",
          label: "Kwestionuję potrącenia – to normalne zużycie mieszkania albo kwoty nie są udokumentowane",
          type: "checkbox",
          required: false,
          showIf: { questionId: "deduction_status", equals: ["partial", "announced"] },
          help: "Najemca nie odpowiada za zużycie będące skutkiem prawidłowego używania (art. 675 § 1 k.c.).",
        },
      ],
    },
    {
      id: "demand",
      title: "Wezwanie do zapłaty",
      questions: [
        {
          id: "bank_account",
          label: "Numer rachunku do zwrotu kaucji",
          type: "text",
          placeholder: "PL 00 0000 0000 0000 0000 0000 0000",
          validate: { maxLength: 40 },
          help: "Rachunek, na który wynajmujący ma przelać pieniądze.",
        },
        {
          id: "payment_days",
          label: "Termin zapłaty w wezwaniu",
          type: "select",
          options: [
            { value: "7", label: "7 dni od doręczenia wezwania" },
            { value: "14", label: "14 dni od doręczenia wezwania" },
          ],
          help: "7 dni to standardowy termin w wezwaniach do zapłaty.",
        },
        {
          id: "previous_demands",
          label: "Czy wcześniej upominano się o zwrot kaucji?",
          type: "radio",
          options: [
            { value: "none", label: "Nie, to pierwsze wezwanie" },
            { value: "informal", label: "Tak – telefonicznie, SMS-em lub e-mailem" },
            { value: "written", label: "Tak – pisemnie" },
          ],
          help: "Wcześniejsze wezwania nie są wymagane, ale wzmacniają Twoją pozycję w sądzie.",
        },
        {
          id: "previous_demand_date",
          label: "Kiedy ostatnio upominano się o zwrot? (opcjonalnie)",
          type: "date",
          required: false,
          showIf: { questionId: "previous_demands", equals: ["informal", "written"] },
          help: "Data ostatniej wiadomości lub pisma.",
        },
        {
          id: "att_proof",
          label: "Mam potwierdzenie wpłaty kaucji (przelew, pokwitowanie lub zapis w umowie) – dołączę kopię",
          type: "checkbox",
          required: false,
        },
      ],
    },
  ],
  legalBasis: [
    {
      act: "Ustawa z dnia 21 czerwca 2001 r. o ochronie praw lokatorów, mieszkaniowym zasobie gminy i o zmianie Kodeksu cywilnego",
      article: "art. 6 ust. 1 i 4",
      summary:
        "Kaucja (maks. 12-krotność czynszu) podlega zwrotowi w ciągu miesiąca od opróżnienia lokalu – po potrąceniu wyłącznie należności z tytułu najmu.",
      url: ISAP_UOPL,
    },
    {
      act: "Ustawa z dnia 21 czerwca 2001 r. o ochronie praw lokatorów, mieszkaniowym zasobie gminy i o zmianie Kodeksu cywilnego",
      article: "art. 6 ust. 3",
      summary:
        "Waloryzacja: zwraca się iloczyn obecnego czynszu i krotności przyjętej przy pobraniu kaucji, ale nie mniej niż kaucję pobraną.",
      url: ISAP_UOPL,
    },
    {
      act: "Ustawa z dnia 21 czerwca 2001 r. o ochronie praw lokatorów, mieszkaniowym zasobie gminy i o zmianie Kodeksu cywilnego",
      article: "art. 19a ust. 4–5 i art. 19f ust. 4–6",
      summary: "Najem okazjonalny i instytucjonalny: kaucja maks. 6-krotność czynszu, zwrot w ciągu miesiąca od opróżnienia lokalu.",
      url: ISAP_UOPL,
    },
    {
      act: "Ustawa z dnia 23 kwietnia 1964 r. – Kodeks cywilny",
      article: "art. 675 § 1 i 3",
      summary:
        "Najemca zwraca lokal w stanie niepogorszonym, ale nie odpowiada za zużycie wynikające z prawidłowego używania.",
      url: ISAP_KC,
    },
    {
      act: "Ustawa z dnia 23 kwietnia 1964 r. – Kodeks cywilny",
      article: "art. 6 i art. 481 § 1",
      summary:
        "Wynajmujący musi udowodnić potrącane należności; za opóźnienie w zwrocie kaucji należą się odsetki ustawowe za opóźnienie.",
      url: ISAP_KC,
    },
  ],
  deadlines: [
    {
      id: "deposit_return",
      label: "Ustawowy termin zwrotu kaucji",
      fromQuestionId: "vacate_date",
      months: 1,
      description:
        "Wynajmujący powinien zwrócić kaucję w ciągu miesiąca od dnia opróżnienia lokalu (art. 6 ust. 4, art. 19a ust. 5, art. 19f ust. 6 ustawy o ochronie praw lokatorów). Jeśli ostatni dzień przypada na sobotę lub dzień wolny, termin upływa w najbliższy dzień roboczy (art. 115 k.c.). Od następnego dnia możesz żądać odsetek ustawowych za opóźnienie.",
    },
    {
      id: "landlord_damage_claims",
      label: "Przedawnienie roszczeń wynajmującego o uszkodzenia lokalu",
      fromQuestionId: "vacate_date",
      years: 1,
      description:
        "Roszczenia wynajmującego o naprawienie szkody z powodu uszkodzenia lub pogorszenia lokalu przedawniają się z upływem roku od dnia zwrotu rzeczy (art. 677 k.c.). Twoje roszczenie o zwrot kaucji przedawnia się co do zasady po 6 latach (art. 118 k.c.).",
    },
  ],
  instructions: {
    whereToSend:
      "Wyślij wezwanie do **wynajmującego** – na adres wskazany w umowie najmu albo na nowy adres, jeśli wynajmujący Ci go przekazał (strony najmu mają obowiązek informować się o zmianie adresu – art. 6g ustawy o ochronie praw lokatorów). Jeśli wynajmującym jest firma, sprawdź aktualny adres siedziby w KRS lub CEIDG. Gdy mieszkaniem zarządzało biuro nieruchomości, wyślij pismo do właściciela, a kopię do pośrednika.",
    howToSend:
      "Najlepiej **listem poleconym za potwierdzeniem odbioru** – data doręczenia wyznacza początek terminu zapłaty, a zwrotka będzie dowodem w sądzie. Dodatkowo możesz przesłać skan pisma e-mailem lub komunikatorem, którym kontaktowaliście się w czasie najmu – przyspieszy to reakcję, ale nie zastępuje listu.\n\nZachowaj kopię pisma, dowód nadania, umowę najmu, protokół zdawczo-odbiorczy, potwierdzenie wpłaty kaucji oraz zdjęcia mieszkania z dnia wyprowadzki.",
    afterSending:
      "Jeśli wynajmujący zapłaci – sprawdź, czy kwota obejmuje odsetki. Jeśli przedstawi rozliczenie potrąceń, poproś o dowody (faktury, kosztorysy, zdjęcia) i porównaj je z protokołem.\n\nGdy termin z wezwania minie bez zapłaty:\n- możesz złożyć **pozew o zapłatę** do sądu rejonowego właściwego dla miejsca zamieszkania (siedziby) wynajmującego – przy kwotach do 20 000 zł sprawa toczy się w postępowaniu uproszczonym; możesz też skorzystać z elektronicznego postępowania upominawczego (e-sąd). Opłata od pozwu przy kwocie do 500 zł wynosi 30 zł, do 1500 zł – 100 zł, do 4000 zł – 200 zł,\n- rozważ **mediację** – często kończy spór szybciej niż proces,\n- przy najmie od firmy możesz zwrócić się o pomoc do **miejskiego lub powiatowego rzecznika konsumentów**.\n\nRoszczenia wynajmującego o uszkodzenia mieszkania przedawniają się po roku od zwrotu lokalu (art. 677 k.c.).",
    checklist: [
      "Sprawdź, czy od opróżnienia mieszkania minął już 1 miesiąc (wcześniej wynajmujący nie jest w opóźnieniu).",
      "Przygotuj umowę najmu, potwierdzenie wpłaty kaucji i protokół zdawczo-odbiorczy lub zdjęcia mieszkania.",
      "Upewnij się, że numer rachunku i kwota w piśmie są poprawne.",
      "Podpisz pismo i zrób jego kopię.",
      "Wyślij list polecony za potwierdzeniem odbioru i zachowaj dowód nadania.",
      "Zapisz w kalendarzu datę upływu terminu zapłaty wskazanego w wezwaniu.",
    ],
  },
  seo: {
    title: "Zwrot kaucji za mieszkanie – wezwanie, wzór 2026",
    metaDescription:
      "Wynajmujący nie oddaje kaucji? Wygeneruj wezwanie do zwrotu kaucji z waloryzacją, odsetkami i zakwestionowaniem potrąceń za normalne zużycie.",
    h1: "Wezwanie do zwrotu kaucji za mieszkanie – wzór i generator",
    intro:
      "Wyprowadzka za Tobą, a wynajmujący zwleka ze zwrotem kaucji albo potrącił z niej koszty malowania? Odpowiedz na kilka pytań – przygotujemy wezwanie do zapłaty z właściwą podstawą prawną, wyliczeniem kwoty (także zwaloryzowanej) i odsetkami. Pismo pobierzesz w formacie DOCX lub PDF.",
    keywords: [
      "zwrot kaucji za mieszkanie",
      "wezwanie do zwrotu kaucji wzór",
      "wynajmujący nie oddaje kaucji",
      "termin zwrotu kaucji za mieszkanie",
      "waloryzacja kaucji",
      "potrącenie z kaucji za malowanie",
      "kaucja najem okazjonalny zwrot",
      "pozew o zwrot kaucji",
    ],
    guide: [
      {
        heading: "Kiedy wynajmujący musi oddać kaucję",
        body: `Kaucja zabezpiecza **należności wynajmującego z tytułu najmu** istniejące w dniu opróżnienia lokalu – np. zaległy czynsz, nieopłacone media albo koszt naprawy szkód wyrządzonych przez najemcę. Nie jest dodatkowym wynagrodzeniem wynajmującego ani „opłatą za zużycie mieszkania”.

Zgodnie z art. 6 ust. 4 ustawy o ochronie praw lokatorów kaucja podlega zwrotowi **w ciągu miesiąca od dnia opróżnienia lokalu**, po potrąceniu należności z tytułu najmu. Taki sam miesięczny termin obowiązuje przy najmie okazjonalnym (art. 19a ust. 5) i instytucjonalnym (art. 19f ust. 6). Liczy się dzień faktycznego opróżnienia i wydania mieszkania (oddania kluczy), a nie dzień, w którym formalnie skończyła się umowa.

Jeśli wynajmujący nie odda pieniędzy w tym terminie, od następnego dnia jest w opóźnieniu i możesz żądać **odsetek ustawowych za opóźnienie** (art. 481 § 1 k.c.) – nie musi go już dodatkowo wzywać, bo termin wynika z ustawy.`,
      },
      {
        heading: "Ile wynosi kaucja i czym jest waloryzacja",
        body: `Przy zwykłym najmie kaucja nie może przekroczyć **12-krotności miesięcznego czynszu** z dnia zawarcia umowy (art. 6 ust. 1). Przy najmie okazjonalnym i instytucjonalnym limit wynosi **6-krotność czynszu**.

Ustawa przewiduje też **waloryzację kaucji** (art. 6 ust. 3): zwraca się kwotę równą iloczynowi czynszu obowiązującego w dniu zwrotu i krotności czynszu przyjętej przy pobraniu kaucji – ale nie mniej niż kaucja pobrana. Przykład: kaucja 5000 zł przy czynszu 2500 zł to 2-krotność czynszu. Jeśli w dniu zwrotu czynsz za to mieszkanie wynosi 2800 zł, kaucja do zwrotu to 5600 zł.

Przepis o waloryzacji dotyczy zwykłego najmu mieszkania; w praktyce wielu wynajmujących zwraca kwotę nominalną. Jeśli znasz aktualny czynsz, generator policzy kwotę zwaloryzowaną i wpisze ją do wezwania. Jeśli nie znasz – wezwanie obejmie kwotę wpłaconą. Przy najmie okazjonalnym i instytucjonalnym żądamy zwrotu kwoty wpłaconej.`,
      },
      {
        heading: "Co wynajmujący może potrącić z kaucji",
        body: `Wynajmujący może potrącić wyłącznie **należności z tytułu najmu** – np.:
- zaległy czynsz i opłaty eksploatacyjne,
- niezapłacone rachunki za media rozliczane po wyprowadzce,
- koszt naprawy **uszkodzeń**, za które odpowiada najemca (np. zbita szyba, zniszczony blat, dziury po nieuzgodnionym montażu).

Nie może natomiast obciążyć najemcy **zużyciem wynikającym z prawidłowego używania** (art. 675 § 1 k.c.): przetarciem paneli w ciągu kilku lat, wyblakłymi ścianami, drobnymi śladami po meblach, naturalnym starzeniem się sprzętów. To ryzyko właściciela, który pobierał czynsz.

Uwaga na malowanie: przepisy przewidują, że drobne nakłady, w tym malowanie ścian, obciążają najemcę lokalu (art. 662 § 2 i art. 681 k.c.), a ustawa o ochronie praw lokatorów przewiduje obowiązek odnowienia lokalu po zakończeniu najmu (art. 6e), który strony mogą jednak ułożyć inaczej w umowie (art. 6f). Sprawdź więc umowę: jeśli nie przewiduje malowania i oddałeś mieszkanie w stanie odpowiadającym normalnemu zużyciu, możesz kwestionować obciążenie. Każde potrącenie wynajmujący musi **udowodnić** (art. 6 k.c.) – fakturą, kosztorysem, zdjęciami.`,
      },
      {
        heading: "Protokół zdawczo-odbiorczy i dowody",
        body: `Najważniejszym dowodem w sporze o kaucję jest **protokół** – sporządzony przy wydaniu mieszkania najemcy oraz przy jego zwrocie. Ustawa przewiduje, że protokół ze stanu technicznego lokalu przy jego wydaniu stanowi podstawę rozliczeń przy zwrocie (art. 6c). Domniemywa się też, że rzecz została wydana najemcy w stanie dobrym (art. 675 § 3 k.c.) – dlatego brak protokołu początkowego działa zwykle na korzyść wynajmującego, a brak protokołu końcowego utrudnia mu wykazanie szkód.

Jeśli protokołu nie spisano, zbierz inne dowody:
- zdjęcia i nagrania z dnia wprowadzenia się i wyprowadzki (z datą),
- korespondencję z wynajmującym (SMS-y, e-maile o usterkach zgłaszanych w czasie najmu),
- zeznania osób obecnych przy oddaniu kluczy,
- potwierdzenia zapłaty czynszu i rachunków.

Zachowaj też potwierdzenie wpłaty kaucji – przelew albo zapis w umowie, że kaucję przyjęto.`,
      },
      {
        heading: "Wezwanie do zwrotu kaucji krok po kroku",
        body: `1. **Odczekaj miesiąc** od dnia opróżnienia lokalu – wcześniej wynajmujący nie jest jeszcze w opóźnieniu (możesz wysłać pismo wcześniej, ale wtedy wezwie ono do zwrotu w terminie ustawowym).
2. **Wypełnij generator** – podaj daty, kwotę kaucji, czynsz (do waloryzacji) i opisz potrącenia, jeśli je zastosowano.
3. **Sprawdź kwotę** – pismo wylicza należność, odejmuje kwoty już zwrócone i dolicza odsetki od właściwego dnia.
4. **Wyślij list polecony za potwierdzeniem odbioru** i zachowaj dowód nadania.
5. **Czekaj na zapłatę** w terminie z wezwania (7 lub 14 dni od doręczenia).
6. **Gdy pieniądze nie wpłyną** – złóż pozew o zapłatę. Wezwanie z dowodem doręczenia pokazuje sądowi, że próbowano rozwiązać sprawę polubownie.`,
      },
      {
        heading: "Co jeśli wynajmujący nadal nie płaci",
        body: `Sprawę o zwrot kaucji rozpoznaje **sąd rejonowy** – co do zasady właściwy dla miejsca zamieszkania (siedziby) wynajmującego. Przy kwotach do 20 000 zł sprawa toczy się w **postępowaniu uproszczonym** (art. 505¹ k.p.c.); pozew można też złożyć w elektronicznym postępowaniu upominawczym (e-sąd).

Opłata od pozwu zależy od kwoty: do 500 zł – 30 zł, od 500 do 1500 zł – 100 zł, od 1500 do 4000 zł – 200 zł, od 4000 do 7500 zł – 400 zł. Jeśli wygrasz, sąd zasądzi od wynajmującego zwrot kosztów.

Pamiętaj, że roszczenia wynajmującego o naprawienie szkód w lokalu przedawniają się **po roku od zwrotu mieszkania** (art. 677 k.c.). Twoje roszczenie o zwrot kaucji przedawnia się co do zasady po 6 latach, ale nie warto zwlekać – im później, tym trudniej o dowody.`,
      },
    ],
    faq: [
      {
        question: "Ile czasu ma wynajmujący na zwrot kaucji?",
        answer:
          "Miesiąc od dnia opróżnienia lokalu (art. 6 ust. 4 ustawy o ochronie praw lokatorów; przy najmie okazjonalnym art. 19a ust. 5, przy instytucjonalnym art. 19f ust. 6). Po tym terminie należą się odsetki ustawowe za opóźnienie.",
      },
      {
        question: "Czy wynajmujący może zatrzymać kaucję za malowanie mieszkania?",
        answer:
          "Zależy od umowy i stanu lokalu. Drobne nakłady, w tym malowanie, co do zasady obciążają najemcę (art. 681 k.c.), a ustawa o ochronie praw lokatorów przewiduje obowiązek odnowienia lokalu po najmie, który umowa może jednak uregulować inaczej. Wynajmujący nie może natomiast obciążać najemcy zużyciem wynikającym z prawidłowego używania i musi wykazać rzeczywisty koszt.",
      },
      {
        question: "Czy kaucja podlega waloryzacji?",
        answer:
          "Tak, przy zwykłym najmie. Zwraca się iloczyn czynszu z dnia zwrotu i krotności czynszu przyjętej przy pobraniu kaucji, ale nie mniej niż kwotę wpłaconą (art. 6 ust. 3 ustawy o ochronie praw lokatorów). Jeśli czynsz nie wzrósł, zwrotowi podlega kwota wpłacona.",
      },
      {
        question: "Co jeśli nie spisaliśmy protokołu przy wyprowadzce?",
        answer:
          "Kaucja nadal Ci się należy. Brak protokołu utrudnia wynajmującemu wykazanie szkód, bo to on musi udowodnić podstawy potrąceń. Zbierz zdjęcia z dnia wyprowadzki, korespondencję i świadków.",
      },
      {
        question: "Czy mogę zamieszkać ostatni miesiąc „za kaucję”?",
        answer:
          "Nie jest to zalecane. Kaucja zabezpiecza należności istniejące w dniu opróżnienia lokalu, a niezapłacenie czynszu to zaległość, którą wynajmujący może potrącić – ale traci on wtedy zabezpieczenie na ewentualne szkody i może dochodzić ich odrębnie. Bezpieczniej płacić czynsz do końca i żądać zwrotu kaucji.",
      },
      {
        question: "Wynajmujący nie odpowiada – co dalej?",
        answer:
          "Po upływie terminu z wezwania złóż pozew o zapłatę do sądu rejonowego. Przy kwotach do 20 000 zł obowiązuje postępowanie uproszczone, a opłata sądowa jest niska (np. 200 zł przy kwocie od 1500 do 4000 zł). Dowodem będą umowa, potwierdzenie wpłaty kaucji, protokół i wezwanie z potwierdzeniem odbioru.",
      },
      {
        question: "Czy wynajmujący może potrącić z kaucji koszty sprzątania?",
        answer:
          "Tylko jeśli mieszkanie zostało oddane w stanie wymagającym ponadstandardowego sprzątania lub umowa wyraźnie to przewiduje – i tylko w wysokości rzeczywistego, udokumentowanego kosztu. Zwykłe porządki po wyprowadzce mieszczą się w normalnym używaniu lokalu.",
      },
    ],
  },
  ai: {
    context:
      "Wezwanie do zapłaty kierowane przez byłego najemcę mieszkania do wynajmującego, który nie zwrócił kaucji albo zwrócił ją tylko częściowo. Opis faktów ma rzeczowo i chronologicznie przedstawić: zakończenie najmu, opróżnienie i wydanie lokalu, stan lokalu przy zwrocie (protokół), uregulowanie należności, dotychczasowe próby kontaktu oraz – jeśli dotyczy – potrącenia dokonane lub zapowiadane przez wynajmującego i powody, dla których najemca je kwestionuje (np. normalne zużycie, brak dokumentów). Nie wyliczaj kwot, odsetek ani terminów i nie powołuj przepisów – szablon dodaje je sam. Ton spokojny, stanowczy, bez emocji i gróźb; pisz w pierwszej osobie, neutralnie płciowo (bez form typu „oddałem/oddałam”).",
    factQuestionIds: [
      "rental_address",
      "lease_end_date",
      "vacate_date",
      "handover_protocol",
      "all_paid",
      "deduction_status",
      "returned_amount",
      "deduction_reason",
      "dispute_wear",
      "previous_demands",
      "previous_demand_date",
    ],
  },
  render: ({ answers, ai, today }) => {
    const type = leaseTypeOf(answers);
    const status = deductionStatusOf(answers);
    const amounts = computeAmounts(answers);
    const vacate = dateAnswer(answers, "vacate_date");
    const due = vacate ? shiftToWorkday(addMonths(vacate, 1)) : undefined;
    const overdue = !!due && today.getTime() > new Date(due.getFullYear(), due.getMonth(), due.getDate(), 23, 59).getTime();
    const protocol = str(answers, "handover_protocol", "none");
    const email = str(answers, "sender_email", "");
    const phone = str(answers, "sender_phone", "");
    const paragraphs: Paragraph[] = [];

    // 1. Umowa i kaucja
    const contractNoun =
      type === "occasional" ? "umowa najmu okazjonalnego" : type === "institutional" ? "umowa najmu instytucjonalnego" : "umowa najmu";
    paragraphs.push(
      p(
        `W dniu ${formatDatePl(dateAnswer(answers, "contract_date"))} została zawarta ${contractNoun} lokalu mieszkalnego położonego pod adresem: ${str(
          answers,
          "rental_address",
        )} (dalej: „Lokal”), w której jestem stroną jako najemca. Tytułem kaucji zabezpieczającej pokrycie należności z tytułu najmu wpłacono kwotę ${formatMoneyPl(
          amounts.deposit,
        )}.`,
      ),
    );

    // 2. Stan faktyczny
    if (ai?.facts) {
      paragraphs.push(...paragraphsFromText(ai.facts));
      if (ai.justification) paragraphs.push(...paragraphsFromText(ai.justification));
    } else {
      const protocolText: Record<string, string> = {
        clean: ", co potwierdza protokół zdawczo-odbiorczy podpisany bez zastrzeżeń co do stanu Lokalu",
        remarks: ", co potwierdza protokół zdawczo-odbiorczy",
        none: "",
      };
      let handover = `Najem zakończył się w dniu ${formatDatePl(dateAnswer(answers, "lease_end_date"))}, a Lokal został opróżniony i wydany w dniu ${formatDatePl(
        vacate,
      )}${protocolText[protocol] ?? ""}.`;
      if (protocol === "none") {
        handover += " Lokal został zwrócony w stanie niepogorszonym, z uwzględnieniem zużycia wynikającego z prawidłowego używania.";
      }
      if (bool(answers, "all_paid")) {
        handover += " Na dzień opróżnienia Lokalu wszystkie należności z tytułu najmu, w tym czynsz i opłaty za media, zostały uregulowane.";
      }
      paragraphs.push(p(handover));

      const reasonRaw = str(answers, "deduction_reason", "");
      const reason = reasonRaw
        ? userParagraphs(reasonRaw)
            .map((t) => t.replace(/\.$/, ""))
            .join("; ")
        : "";
      if (status === "nothing_returned") {
        paragraphs.push(p(`Do dnia sporządzenia niniejszego pisma kaucja nie została zwrócona${overdue ? ", mimo upływu ustawowego terminu" : ""}.`));
      } else if (status === "partial") {
        paragraphs.push(
          p(
            `Do dnia sporządzenia niniejszego pisma zwrócono jedynie kwotę ${formatMoneyPl(amounts.returned)}, a pozostała część kaucji została zatrzymana${
              reason
                ? `. Jako uzasadnienie potrącenia wskazano: „${reason}”.`
                : " bez przedstawienia rozliczenia i dokumentów potwierdzających potrącane należności."
            }`,
          ),
        );
      } else {
        paragraphs.push(
          p(
            `Kaucja nie została dotychczas rozliczona ani zwrócona${
              reason ? `. Wynajmujący zapowiedział potrącenie z kaucji kwot z następującego tytułu: „${reason}”.` : "."
            }`,
          ),
        );
      }

      const prev = str(answers, "previous_demands", "none");
      const prevDate = dateAnswer(answers, "previous_demand_date");
      if (prev !== "none") {
        paragraphs.push(
          p(
            `Zwrotu kaucji domagano się już wcześniej ${prev === "written" ? "pisemnie" : "w drodze korespondencji i rozmów"}${
              prevDate ? `, ostatnio w dniu ${formatDatePl(prevDate)}` : ""
            } – bezskutecznie.`,
          ),
        );
      }
    }

    // 3. Podstawa prawna
    paragraphs.push(heading("Podstawa prawna"));
    paragraphs.push(
      p(
        `${RETURN_RULE[type]}${
          due ? ` Termin ten ${overdue ? "upłynął" : "upływa"} w dniu ${formatDatePl(due)}.` : ""
        } Kaucja zabezpiecza wyłącznie należności z tytułu najmu przysługujące wynajmującemu w dniu opróżnienia lokalu i nie może być zatrzymana z innych przyczyn.`,
      ),
    );
    if (amounts.multiple !== undefined && amounts.valorized !== undefined && amounts.due !== undefined) {
      const higher = amounts.valorized > (amounts.deposit ?? 0);
      paragraphs.push(
        p(
          `Stosownie do art. 6 ust. 3 u.o.p.l. zwrot zwaloryzowanej kaucji następuje w kwocie równej iloczynowi kwoty miesięcznego czynszu obowiązującego w dniu zwrotu kaucji i krotności czynszu przyjętej przy pobieraniu kaucji, jednak w kwocie nie niższej niż kaucja pobrana. Kaucja w kwocie ${formatMoneyPl(
            amounts.deposit,
          )} odpowiadała ${formatNumberPl(amounts.multiple)}-krotności czynszu wynoszącego w dniu jej wpłaty ${formatMoneyPl(
            num(answers, "rent_at_payment"),
          )}. ${
            higher
              ? `Przy obecnym czynszu w wysokości ${formatMoneyPl(num(answers, "rent_at_return"))} kaucja do zwrotu wynosi ${formatMoneyPl(amounts.due)}.`
              : `Ponieważ czynsz nie wzrósł, zwrotowi podlega kwota nie niższa niż kaucja pobrana, tj. ${formatMoneyPl(amounts.due)}.`
          }`,
        ),
      );
    }
    if (status !== "nothing_returned" && bool(answers, "dispute_wear")) {
      paragraphs.push(
        p(
          `Kwestionuję ${status === "partial" ? "dokonane" : "zapowiadane"} potrącenia. Zgodnie z art. 675 § 1 Kodeksu cywilnego najemca nie ponosi odpowiedzialności za zużycie rzeczy będące następstwem jej prawidłowego używania. Podstawą rozliczeń przy zwrocie lokalu jest protokół określający jego stan techniczny (art. 6c u.o.p.l.), a w myśl art. 6 Kodeksu cywilnego ciężar udowodnienia istnienia i wysokości należności, które miałyby zostać potrącone z kaucji, spoczywa na wynajmującym. Do chwili obecnej nie przedstawiono dowodów (faktur, kosztorysów, dokumentacji zdjęciowej) potwierdzających, że potrącane kwoty dotyczą szkód, za które odpowiada najemca, a nie normalnego zużycia Lokalu.`,
        ),
      );
    }

    // 4. Żądanie
    paragraphs.push(heading("Wezwanie do zapłaty"));
    const days = str(answers, "payment_days", "7");
    const interestFrom = due ? addDays(due, 1) : undefined;
    const what =
      status === "partial"
        ? "pozostałej części kaucji"
        : amounts.valorized !== undefined && amounts.due !== undefined && amounts.due > (amounts.deposit ?? 0)
          ? "zwaloryzowanej kaucji"
          : "kaucji";
    const account = str(answers, "bank_account");
    if (ai?.demand) paragraphs.push(...paragraphsFromText(ai.demand));
    paragraphs.push(
      p(
        overdue
          ? `W związku z powyższym wzywam do zapłaty kwoty ${formatMoneyPl(amounts.claim)} tytułem zwrotu ${what} wraz z odsetkami ustawowymi za opóźnienie liczonymi od dnia ${formatDatePl(
              interestFrom,
            )} do dnia zapłaty (art. 481 § 1 k.c.) – w terminie ${days} dni od dnia doręczenia niniejszego wezwania, na rachunek bankowy nr ${account}.`
          : `W związku z powyższym wzywam do zwrotu kwoty ${formatMoneyPl(amounts.claim)} tytułem ${what} w ustawowym terminie${
              due ? `, tj. najpóźniej do dnia ${formatDatePl(due)}` : ""
            }, na rachunek bankowy nr ${account}. W razie opóźnienia będą mi przysługiwać odsetki ustawowe za opóźnienie${
              interestFrom ? ` od dnia ${formatDatePl(interestFrom)}` : ""
            } (art. 481 § 1 k.c.).`,
      ),
    );
    paragraphs.push(
      p(
        `Brak zapłaty w wyznaczonym terminie spowoduje skierowanie sprawy na drogę postępowania sądowego bez dalszego wzywania, co narazi Wynajmującego na obowiązek zwrotu kosztów postępowania.${
          email || phone
            ? ` W sprawie rozliczenia pozostaję do dyspozycji${email ? ` pod adresem e-mail: ${email}` : ""}${email && phone ? " oraz" : ""}${
                phone ? ` pod numerem telefonu ${phone}` : ""
              }.`
            : ""
        }`,
      ),
    );

    const attachments = ["Kopia umowy najmu"];
    if (protocol !== "none") attachments.push("Kopia protokołu zdawczo-odbiorczego");
    if (bool(answers, "att_proof")) attachments.push("Kopia potwierdzenia wpłaty kaucji");
    if (str(answers, "previous_demands", "none") === "written") attachments.push("Kopia wcześniejszego wezwania");

    return {
      sender: partyFromAnswers(answers, "sender", [email ? `e-mail: ${email}` : "", phone ? `tel. ${phone}` : ""]),
      recipient: partyFromAnswers(answers, "recipient"),
      place: str(answers, "sender_city"),
      date: formatDatePl(today),
      title: "WEZWANIE DO ZWROTU KAUCJI",
      subject: `dot. zwrotu kaucji – najem lokalu: ${str(answers, "rental_address").replace(/\.$/, "")}`,
      paragraphs: paragraphs.map(tidyParagraph),
      closing: "Z poważaniem",
      signatureName: str(answers, "sender_name"),
      attachments,
      previewParagraphCount: 2,
    };
  },
};
