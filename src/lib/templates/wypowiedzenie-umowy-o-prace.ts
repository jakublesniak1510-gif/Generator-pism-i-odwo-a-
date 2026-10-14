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
  sentence,
  str,
  tidyParagraph,
  userParagraphs,
} from "./helpers";

/*
 * Rozwiązanie umowy o pracę z inicjatywy pracownika – 4 tryby (`mode`):
 *  - notice: wypowiedzenie (art. 30 § 1 pkt 2, art. 32, art. 34, art. 36 § 1, art. 30 § 2¹ k.p.),
 *  - notice_shorten: wypowiedzenie + propozycja wcześniejszego terminu (art. 36 § 6 k.p.),
 *  - agreement: wniosek o rozwiązanie za porozumieniem stron (art. 30 § 1 pkt 1 k.p.),
 *  - employer_fault: rozwiązanie bez wypowiedzenia z winy pracodawcy (art. 55 § 1¹ i § 2 k.p.).
 * Generator liczy okres wypowiedzenia z rodzaju umowy i stażu u pracodawcy oraz datę jego upływu
 * (tydzień → sobota, miesiąc → ostatni dzień miesiąca) przy założeniu doręczenia w dniu `submit_date`.
 * Przepisy zweryfikowane z t.j. Kodeksu pracy: Dz. U. z 2026 r. poz. 1245 (stan na 27.08.2026 r.).
 * Szczegóły i wątpliwości: docs/legal-review/wypowiedzenie-umowy-o-prace.md
 */

const KP_FULL = "ustawy z dnia 26 czerwca 1974 r. – Kodeks pracy (dalej: „k.p.”)";
const ISAP_KP = "https://isap.sejm.gov.pl/isap.nsf/DocDetails.xsp?id=WDU19740240141";

type Mode = "notice" | "notice_shorten" | "agreement" | "employer_fault";
type ContractType = "trial" | "fixed" | "indefinite";
type FaultCategory = "unpaid_salary" | "mobbing" | "safety" | "other";

type Notice =
  | { kind: "workdays"; n: number; label: string; basis: string }
  | { kind: "weeks"; n: number; label: string; basis: string }
  | { kind: "months"; n: number; label: string; basis: string };

/* ---------- daty ---------- */

/** Data z pola typu date (RRRR-MM-DD) jako lokalna północ. */
function dateAnswer(answers: Answers, id: string): Date | undefined {
  const v = answers[id];
  if (typeof v !== "string") return undefined;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v.trim());
  if (!m) return undefined;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

function addDays(d: Date, days: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + days);
}

/** Dodaje miesiące; gdy w miesiącu docelowym brak dnia – ostatni dzień miesiąca. */
function addMonths(d: Date, months: number): Date {
  const last = new Date(d.getFullYear(), d.getMonth() + months + 1, 0).getDate();
  return new Date(d.getFullYear(), d.getMonth() + months, Math.min(d.getDate(), last));
}

/** Liczba pełnych miesięcy między datami. */
function fullMonths(from: Date, to: Date): number {
  let m = (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth());
  if (to.getDate() < from.getDate()) m -= 1;
  return Math.max(0, m);
}

/** Niedziela Wielkanocna (algorytm Meeusa/Jonesa/Butchera). */
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

/** Dni wolne od pracy wg ustawy z 18.01.1951 r. o dniach wolnych od pracy (Wigilia od 2025 r.). */
function isPublicHoliday(d: Date): boolean {
  const md = `${d.getMonth() + 1}-${d.getDate()}`;
  const fixed = ["1-1", "1-6", "5-1", "5-3", "8-15", "11-1", "11-11", "12-25", "12-26"];
  if (fixed.includes(md)) return true;
  if (md === "12-24" && d.getFullYear() >= 2025) return true;
  const easter = easterSunday(d.getFullYear());
  const movable = [1, 60].map((off) => addDays(easter, off).getTime()); // poniedziałek wielkanocny, Boże Ciało
  return movable.includes(d.getTime());
}

/** Upływ okresu wypowiedzenia doręczonego w dniu `served` (dzień doręczenia nie jest wliczany). */
function noticeEnd(served: Date, notice: Notice): Date {
  if (notice.kind === "months") {
    // art. 30 § 2¹ k.p. – koniec w ostatnim dniu miesiąca
    return new Date(served.getFullYear(), served.getMonth() + notice.n + 1, 0);
  }
  if (notice.kind === "weeks") {
    // art. 30 § 2¹ k.p. – pełne tygodnie od niedzieli do soboty
    const toSunday = 7 - served.getDay(); // sobota → 1, niedziela → 7
    return addDays(served, toSunday + 7 * notice.n - 1);
  }
  // dni robocze: od poniedziałku do piątku, z pominięciem dni ustawowo wolnych
  let d = served;
  let count = 0;
  while (count < notice.n) {
    d = addDays(d, 1);
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6 && !isPublicHoliday(d)) count += 1;
  }
  return d;
}

/* ---------- język ---------- */

function plural(n: number, one: string, few: string, many: string): string {
  if (n === 1) return one;
  const d = n % 10;
  const t = n % 100;
  return d >= 2 && d <= 4 && (t < 12 || t > 14) ? few : many;
}

function seniorityText(months: number): string {
  const y = Math.floor(months / 12);
  const m = months % 12;
  if (y === 0 && m === 0) return "krócej niż miesiąc";
  const parts: string[] = [];
  if (y > 0) parts.push(`${y} ${plural(y, "rok", "lata", "lat")}`);
  if (m > 0) parts.push(`${m} ${plural(m, "miesiąc", "miesiące", "miesięcy")}`);
  return parts.join(" i ");
}

/* ---------- logika okresu wypowiedzenia ---------- */

function modeOf(answers: Answers): Mode {
  const v = str(answers, "mode", "notice");
  return v === "notice_shorten" || v === "agreement" || v === "employer_fault" ? v : "notice";
}

function contractTypeOf(answers: Answers): ContractType {
  const v = str(answers, "contract_type", "indefinite");
  return v === "trial" || v === "fixed" ? v : "indefinite";
}

const TRIAL_NOTICE: Record<string, Notice> = {
  upto2w: { kind: "workdays", n: 3, label: "3 dni robocze", basis: "art. 34 pkt 1 k.p." },
  over2w: { kind: "weeks", n: 1, label: "1 tydzień", basis: "art. 34 pkt 2 k.p." },
  "3m": { kind: "weeks", n: 2, label: "2 tygodnie", basis: "art. 34 pkt 3 k.p." },
};

const SENIORITY_NOTICE: Notice[] = [
  { kind: "weeks", n: 2, label: "2 tygodnie", basis: "art. 36 § 1 pkt 1 k.p." },
  { kind: "months", n: 1, label: "1 miesiąc", basis: "art. 36 § 1 pkt 2 k.p." },
  { kind: "months", n: 3, label: "3 miesiące", basis: "art. 36 § 1 pkt 3 k.p." },
];
const SENIORITY_THRESHOLDS = [6, 36]; // miesiące: 6 miesięcy, 3 lata

interface NoticeCalc {
  notice: Notice;
  served?: Date;
  end?: Date;
  /** staż w pełnych miesiącach w dniu doręczenia (umowy terminowe i bezterminowe) */
  seniorityMonths?: number;
  /** próg stażu osiągnięty w trakcie okresu wypowiedzenia – stosujemy dłuższy okres */
  extendedBy?: "6m" | "3y";
  /** umowa na czas określony kończy się przed upływem okresu wypowiedzenia */
  fixedEndsFirst?: Date;
}

function computeNotice(answers: Answers): NoticeCalc {
  const type = contractTypeOf(answers);
  const served = dateAnswer(answers, "submit_date");

  if (type === "trial") {
    const notice = TRIAL_NOTICE[str(answers, "trial_length", "3m")] ?? TRIAL_NOTICE["3m"];
    return { notice, served, end: served ? noticeEnd(served, notice) : undefined };
  }

  const start = dateAnswer(answers, "employment_start");
  if (!served || !start) {
    // brak dat – wariant najczęstszy (1 miesiąc), bez wyliczania dnia rozwiązania
    return { notice: SENIORITY_NOTICE[1], served };
  }
  const months = fullMonths(start, served);
  let tier = months >= SENIORITY_THRESHOLDS[1] ? 2 : months >= SENIORITY_THRESHOLDS[0] ? 1 : 0;
  let end = noticeEnd(served, SENIORITY_NOTICE[tier]);
  let extendedBy: NoticeCalc["extendedBy"];
  // Próg stażu osiągnięty w trakcie biegu wypowiedzenia → dłuższy okres (patrz legal-review, [DO WERYFIKACJI]).
  while (tier < 2 && addMonths(start, SENIORITY_THRESHOLDS[tier]).getTime() <= end.getTime()) {
    extendedBy = tier === 0 ? "6m" : "3y";
    tier += 1;
    end = noticeEnd(served, SENIORITY_NOTICE[tier]);
  }
  const calc: NoticeCalc = { notice: SENIORITY_NOTICE[tier], served, end, seniorityMonths: months, extendedBy };
  const fixedEnd = dateAnswer(answers, "fixed_end_date");
  if (type === "fixed" && fixedEnd && fixedEnd.getTime() < end.getTime()) calc.fixedEndsFirst = fixedEnd;
  return calc;
}

/* ---------- fragmenty pisma ---------- */

/** Mała litera na początku (chyba że to skrótowiec, np. „IT”). */
function lowerFirst(text: string): string {
  return /^\p{Lu}\p{Lu}/u.test(text) ? text : text.charAt(0).toLowerCase() + text.slice(1);
}

/** Opis umowy w bierniku („umowę … zawartą”) albo dopełniaczu („umowy … zawartej”). */
function contractDescription(answers: Answers, grammaticalCase: "acc" | "gen" = "acc"): string {
  const type = contractTypeOf(answers);
  const number = str(answers, "contract_number", "");
  const date = formatDatePl(dateAnswer(answers, "contract_date"));
  const kind =
    type === "trial"
      ? "na okres próbny"
      : type === "fixed"
        ? `na czas określony${dateAnswer(answers, "fixed_end_date") ? ` do dnia ${formatDatePl(dateAnswer(answers, "fixed_end_date"))}` : ""}`
        : "na czas nieokreślony";
  const noun = grammaticalCase === "acc" ? "umowę o pracę zawartą" : "umowy o pracę zawartej";
  return `${noun} w dniu ${date}${number ? ` (nr ${number})` : ""} ${kind}, na podstawie której zajmuję stanowisko: ${str(answers, "position")}`;
}

function noticeParagraphs(answers: Answers, calc: NoticeCalc): Paragraph[] {
  const out: Paragraph[] = [];
  const type = contractTypeOf(answers);
  const { notice, served, end } = calc;
  const start = dateAnswer(answers, "employment_start");

  let seniority = "";
  if (type !== "trial" && start && calc.seniorityMonths !== undefined) {
    seniority = `Okres mojego zatrudnienia u Państwa, liczony od dnia ${formatDatePl(start)}, wynosi w dniu złożenia wypowiedzenia ${seniorityText(
      calc.seniorityMonths,
    )}. `;
    if (calc.extendedBy) {
      seniority += `W okresie wypowiedzenia okres zatrudnienia osiągnie ${calc.extendedBy === "6m" ? "6 miesięcy" : "3 lata"}, wobec czego stosuję dłuższy okres wypowiedzenia. `;
    }
  } else if (type === "trial") {
    seniority = "Umowa została zawarta na okres próbny. ";
  }

  const ruleSentence =
    notice.kind === "workdays"
      ? ""
      : " Zgodnie z art. 30 § 2¹ k.p. okres wypowiedzenia umowy o pracę obejmujący tydzień lub miesiąc albo ich wielokrotność kończy się odpowiednio w sobotę lub w ostatnim dniu miesiąca.";

  const endSentence =
    served && end
      ? ` Przy doręczeniu niniejszego pisma w dniu ${formatDatePl(served)} okres wypowiedzenia upłynie w dniu ${formatDatePl(
          end,
        )} i z tym dniem umowa o pracę ulegnie rozwiązaniu (art. 32 § 2 k.p.).`
      : " Umowa o pracę ulegnie rozwiązaniu z upływem okresu wypowiedzenia liczonego od dnia doręczenia niniejszego pisma (art. 32 § 2 k.p.).";

  out.push(
    p(
      `${seniority}Okres wypowiedzenia wynosi zatem ${notice.label} (${notice.basis}).${ruleSentence}${endSentence} Gdyby z przepisów prawa pracy lub z umowy wynikał inny okres wypowiedzenia, umowa ulegnie rozwiązaniu z upływem okresu właściwego.`,
    ),
  );

  if (type === "trial") {
    out.push(
      p(
        "Jeżeli okres próbny upłynie przed końcem okresu wypowiedzenia, umowa rozwiąże się z upływem okresu próbnego (art. 30 § 2 k.p.).",
      ),
    );
  }
  if (calc.fixedEndsFirst) {
    out.push(
      p(
        `Ponieważ umowa została zawarta na czas określony do dnia ${formatDatePl(
          calc.fixedEndsFirst,
        )}, rozwiąże się ona z upływem tego dnia, tj. przed upływem okresu wypowiedzenia (art. 30 § 1 pkt 4 k.p.).`,
      ),
    );
  }
  return out;
}

const FAULT_SENTENCE: Record<FaultCategory, string> = {
  unpaid_salary:
    "Pracodawca nie wypłaca mi w terminie należnego wynagrodzenia za pracę, naruszając podstawowy obowiązek terminowego i prawidłowego wypłacania wynagrodzenia (art. 94 pkt 5 k.p.), które powinno być wypłacane co najmniej raz w miesiącu, nie później niż w ciągu pierwszych 10 dni następnego miesiąca kalendarzowego (art. 85 § 1 i 2 k.p.).",
  mobbing:
    "Pracodawca narusza podstawowy obowiązek szanowania godności i innych dóbr osobistych pracownika (art. 11¹ k.p.) oraz obowiązek przeciwdziałania mobbingowi (art. 94³ § 1 k.p.).",
  safety:
    "Pracodawca narusza podstawowy obowiązek zapewnienia bezpiecznych i higienicznych warunków pracy (art. 94 pkt 4 i art. 207 § 1 k.p.), co zagraża mojemu zdrowiu.",
  other: "Pracodawca dopuścił się ciężkiego naruszenia podstawowych obowiązków wobec mnie jako pracownika.",
};

function faultCategoryOf(answers: Answers): FaultCategory {
  const v = str(answers, "fault_category", "other");
  return v === "unpaid_salary" || v === "mobbing" || v === "safety" ? v : "other";
}

function compensationText(answers: Answers, calc: NoticeCalc): string {
  const type = contractTypeOf(answers);
  if (type === "fixed") {
    return `odszkodowania w wysokości wynagrodzenia za czas, do którego umowa miała trwać, nie więcej jednak niż za okres wypowiedzenia, który w moim przypadku wynosi ${calc.notice.label} (art. 55 § 1¹ zd. 2 k.p.)`;
  }
  return `odszkodowania w wysokości wynagrodzenia za okres wypowiedzenia, który w moim przypadku wynosi ${calc.notice.label} (art. 55 § 1¹ zd. 1 k.p.)`;
}

function requestItems(answers: Answers, mode: Mode): string[] {
  const items: string[] = [];
  const employeeNotice = mode === "notice" || mode === "notice_shorten";
  if (employeeNotice && bool(answers, "request_leave")) {
    items.push(
      "udzielenie mi przysługującego, niewykorzystanego urlopu wypoczynkowego w okresie wypowiedzenia (art. 167¹ k.p.)",
    );
  }
  if (employeeNotice && bool(answers, "request_release")) {
    items.push(
      "rozważenie zwolnienia mnie z obowiązku świadczenia pracy do upływu okresu wypowiedzenia, z zachowaniem prawa do wynagrodzenia (art. 36² k.p.)",
    );
  }
  if (bool(answers, "request_certificate")) {
    items.push(
      mode === "employer_fault"
        ? "wydanie świadectwa pracy w dniu rozwiązania stosunku pracy, ze wskazaniem, że umowa o pracę została rozwiązana przez pracownika bez wypowiedzenia na podstawie art. 55 § 1¹ k.p. (art. 97 § 1 i 2 k.p.)"
        : "wydanie świadectwa pracy w dniu rozwiązania stosunku pracy (art. 97 § 1 k.p.)",
    );
  }
  if (bool(answers, "request_equivalent")) {
    items.push(
      "wypłatę ekwiwalentu pieniężnego za urlop wypoczynkowy niewykorzystany do dnia rozwiązania umowy (art. 171 § 1 k.p.), w terminie wynikającym z art. 171 § 4 i 5 k.p.",
    );
  }
  return items;
}

/* ---------- szablon ---------- */

export const wypowiedzenieUmowyOPrace: LetterTemplate = {
  slug: "wypowiedzenie-umowy-o-prace",
  name: "Wypowiedzenie umowy o pracę przez pracownika",
  category: "praca",
  shortDescription:
    "Wypowiedzenie umowy o pracę z wyliczonym okresem wypowiedzenia i datą rozwiązania, wniosek o porozumienie stron albo rozwiązanie z winy pracodawcy.",
  priceGrosze: 2499,
  icon: "💼",
  estimatedMinutes: 6,
  sections: [
    {
      id: "sender",
      title: "Twoje dane",
      description: "Dane pracownika – takie, jakie widnieją w umowie o pracę.",
      questions: senderQuestions(),
    },
    {
      id: "recipient",
      title: "Pracodawca",
      description:
        "Pełna nazwa i adres pracodawcy z umowy o pracę (dla spółek – adres siedziby z KRS). Pismo możesz też złożyć osobiście w kadrach.",
      questions: recipientQuestions("Pracodawca"),
    },
    {
      id: "employment",
      title: "Umowa o pracę",
      description: "Na tej podstawie policzymy okres wypowiedzenia i dzień rozwiązania umowy.",
      questions: [
        {
          id: "position",
          label: "Stanowisko",
          type: "text",
          placeholder: "np. specjalista ds. sprzedaży",
          help: "Wpisz nazwę stanowiska z umowy o pracę.",
        },
        {
          id: "contract_date",
          label: "Data zawarcia obecnej umowy o pracę",
          type: "date",
          help: "Data z nagłówka umowy (albo aneksu, jeśli zmieniał rodzaj umowy).",
        },
        {
          id: "contract_number",
          label: "Numer umowy (opcjonalnie)",
          type: "text",
          required: false,
          placeholder: "np. 12/2024",
          help: "Jeśli umowa nie ma numeru – zostaw puste.",
        },
        {
          id: "contract_type",
          label: "Rodzaj umowy",
          type: "radio",
          help: "Rodzaj umowy decyduje o długości okresu wypowiedzenia.",
          options: [
            { value: "indefinite", label: "Na czas nieokreślony" },
            { value: "fixed", label: "Na czas określony" },
            { value: "trial", label: "Na okres próbny" },
          ],
        },
        {
          id: "trial_length",
          label: "Na jaki okres zawarto umowę na okres próbny?",
          type: "select",
          showIf: { questionId: "contract_type", equals: "trial" },
          options: [
            { value: "upto2w", label: "Nie dłużej niż 2 tygodnie" },
            { value: "over2w", label: "Dłużej niż 2 tygodnie, ale krócej niż 3 miesiące" },
            { value: "3m", label: "3 miesiące" },
          ],
          help: "Okres wypowiedzenia umowy na okres próbny to 3 dni robocze, 1 tydzień albo 2 tygodnie.",
        },
        {
          id: "fixed_end_date",
          label: "Do kiedy obowiązuje umowa na czas określony?",
          type: "date",
          required: false,
          showIf: { questionId: "contract_type", equals: "fixed" },
          help: "Jeśli umowa skończy się przed upływem okresu wypowiedzenia, rozwiąże się w dniu, na który została zawarta.",
        },
        {
          id: "employment_start",
          label: "Od kiedy pracujesz u tego pracodawcy?",
          type: "date",
          showIf: { questionId: "contract_type", equals: ["fixed", "indefinite"] },
          help: "Data rozpoczęcia pracy u tego pracodawcy – licząc wszystkie kolejne umowy o pracę, także na okres próbny. Od 2026 r. (u pracodawców prywatnych od 1 maja 2026 r.) do okresu zatrudnienia u danego pracodawcy wlicza się też udokumentowane okresy zlecenia lub działalności gospodarczej wykonywanej na jego rzecz (art. 302¹ § 8 k.p.) – wtedy wpisz datę początku tej współpracy, jeśli masz zaświadczenie z ZUS.",
        },
      ],
    },
    {
      id: "mode",
      title: "Sposób rozwiązania umowy",
      questions: [
        {
          id: "mode",
          label: "Jak chcesz rozwiązać umowę?",
          type: "radio",
          help: "Wypowiedzenie nie wymaga zgody pracodawcy. Porozumienie stron – tak. Rozwiązanie bez wypowiedzenia jest możliwe tylko przy ciężkim naruszeniu obowiązków przez pracodawcę.",
          options: [
            { value: "notice", label: "Wypowiedzenie z zachowaniem okresu wypowiedzenia" },
            {
              value: "notice_shorten",
              label: "Wypowiedzenie + propozycja wcześniejszego terminu rozwiązania (skrócenie okresu za zgodą pracodawcy)",
            },
            { value: "agreement", label: "Wniosek o rozwiązanie umowy za porozumieniem stron" },
            {
              value: "employer_fault",
              label: "Rozwiązanie bez wypowiedzenia z winy pracodawcy (np. niewypłacanie wynagrodzenia, mobbing)",
            },
          ],
        },
        {
          id: "submit_date",
          label: "Kiedy złożysz (doręczysz) pismo pracodawcy?",
          type: "date",
          help: "Okres wypowiedzenia liczy się od dnia doręczenia pisma. Przy wysyłce pocztą dolicz czas doręczenia – najbezpieczniej złożyć pismo osobiście za potwierdzeniem na kopii.",
        },
        {
          id: "requested_end_date",
          label: "Z jakim dniem umowa ma się rozwiązać?",
          type: "date",
          showIf: { questionId: "mode", equals: ["notice_shorten", "agreement"] },
          help: "Proponowana data – pracodawca musi się na nią zgodzić.",
        },
        {
          id: "reason_optional",
          label: "Powód rozwiązania umowy (opcjonalnie)",
          type: "textarea",
          required: false,
          showIf: { questionId: "mode", equals: ["notice", "notice_shorten", "agreement"] },
          placeholder: "np. zmiana miejsca zamieszkania",
          help: "Pracownik nie musi podawać przyczyny wypowiedzenia. Zostaw puste, jeśli nie chcesz jej wskazywać.",
          validate: { maxLength: 600 },
        },
        {
          id: "fault_category",
          label: "Na czym polega naruszenie obowiązków przez pracodawcę?",
          type: "radio",
          showIf: { questionId: "mode", equals: "employer_fault" },
          help: "Naruszenie musi być ciężkie i dotyczyć podstawowych obowiązków pracodawcy – drobne uchybienia nie wystarczą.",
          options: [
            { value: "unpaid_salary", label: "Nie wypłaca wynagrodzenia (lub jego części) albo wypłaca je z dużym opóźnieniem" },
            { value: "mobbing", label: "Mobbing, dyskryminacja, naruszanie godności" },
            { value: "safety", label: "Naruszanie przepisów BHP zagrażające zdrowiu lub życiu" },
            { value: "other", label: "Inne ciężkie naruszenie podstawowych obowiązków" },
          ],
        },
        {
          id: "fault_description",
          label: "Opisz naruszenie – konkretnie, z datami",
          type: "textarea",
          showIf: { questionId: "mode", equals: "employer_fault" },
          placeholder:
            "np. Wynagrodzenie za lipiec i sierpień 2026 r. nie zostało wypłacone mimo dwukrotnego pisemnego wezwania z 12 września 2026 r.",
          help: "Przyczyna musi być wskazana w piśmie (art. 55 § 2 k.p.). Podaj fakty, daty, kwoty i dowody (wyciągi z konta, e-maile, świadków).",
          validate: { maxLength: 2000 },
        },
        {
          id: "fault_last_date",
          label: "Kiedy ostatnio doszło do naruszenia (albo kiedy się o nim dowiedziano)?",
          type: "date",
          showIf: { questionId: "mode", equals: "employer_fault" },
          help: "Na rozwiązanie umowy w tym trybie jest tylko 1 miesiąc od dowiedzenia się o naruszeniu. Przy naruszeniu trwającym (np. kolejna niewypłacona pensja) wpisz datę ostatniego zdarzenia.",
        },
        {
          id: "unpaid_amount",
          label: "Kwota zaległego wynagrodzenia (opcjonalnie)",
          type: "money",
          required: false,
          placeholder: "8400.00",
          showIf: { questionId: "fault_category", equals: "unpaid_salary" },
          help: "Kwota brutto zaległego wynagrodzenia – pismo wezwie także do jej wypłaty.",
        },
      ],
    },
    {
      id: "requests",
      title: "Dodatkowe wnioski",
      questions: [
        {
          id: "request_leave",
          label: "Wnoszę o udzielenie zaległego urlopu w okresie wypowiedzenia",
          type: "checkbox",
          required: false,
          showIf: { questionId: "mode", equals: ["notice", "notice_shorten"] },
          help: "Wykorzystanie urlopu w okresie wypowiedzenia zastępuje wypłatę ekwiwalentu.",
        },
        {
          id: "request_release",
          label: "Proszę o zwolnienie z obowiązku świadczenia pracy w okresie wypowiedzenia",
          type: "checkbox",
          required: false,
          showIf: { questionId: "mode", equals: ["notice", "notice_shorten"] },
          help: "Decyzja należy do pracodawcy; w okresie zwolnienia zachowujesz prawo do wynagrodzenia.",
        },
        {
          id: "request_certificate",
          label: "Proszę o wydanie świadectwa pracy w dniu rozwiązania umowy",
          type: "checkbox",
          required: false,
        },
        {
          id: "request_equivalent",
          label: "Proszę o wypłatę ekwiwalentu za niewykorzystany urlop",
          type: "checkbox",
          required: false,
        },
      ],
    },
  ],
  legalBasis: [
    {
      act: "Ustawa z dnia 26 czerwca 1974 r. – Kodeks pracy",
      article: "art. 30 § 1 i 3, art. 32",
      summary:
        "Umowa o pracę rozwiązuje się m.in. za porozumieniem stron, za wypowiedzeniem lub bez wypowiedzenia; oświadczenie o wypowiedzeniu musi mieć formę pisemną.",
      url: ISAP_KP,
    },
    {
      act: "Ustawa z dnia 26 czerwca 1974 r. – Kodeks pracy",
      article: "art. 34 i art. 36 § 1",
      summary:
        "Okres wypowiedzenia: przy okresie próbnym 3 dni robocze, 1 albo 2 tygodnie; przy pozostałych umowach 2 tygodnie, 1 miesiąc lub 3 miesiące – zależnie od stażu u pracodawcy.",
      url: ISAP_KP,
    },
    {
      act: "Ustawa z dnia 26 czerwca 1974 r. – Kodeks pracy",
      article: "art. 30 § 2¹",
      summary: "Okres wypowiedzenia liczony w tygodniach kończy się w sobotę, a liczony w miesiącach – w ostatnim dniu miesiąca.",
      url: ISAP_KP,
    },
    {
      act: "Ustawa z dnia 26 czerwca 1974 r. – Kodeks pracy",
      article: "art. 36 § 6, art. 36², art. 167¹",
      summary:
        "Strony mogą ustalić wcześniejszy termin rozwiązania umowy; pracodawca może zwolnić z obowiązku świadczenia pracy albo udzielić urlopu w okresie wypowiedzenia.",
      url: ISAP_KP,
    },
    {
      act: "Ustawa z dnia 26 czerwca 1974 r. – Kodeks pracy",
      article: "art. 55 § 1¹–3",
      summary:
        "Przy ciężkim naruszeniu podstawowych obowiązków przez pracodawcę pracownik może rozwiązać umowę bez wypowiedzenia (w ciągu miesiąca) i żądać odszkodowania.",
      url: ISAP_KP,
    },
    {
      act: "Ustawa z dnia 26 czerwca 1974 r. – Kodeks pracy",
      article: "art. 97 § 1 i art. 171 § 1",
      summary: "Świadectwo pracy wydaje się w dniu ustania stosunku pracy; za niewykorzystany urlop przysługuje ekwiwalent pieniężny.",
      url: ISAP_KP,
    },
  ],
  deadlines: [
    {
      id: "notice_end_estimate",
      label: "Orientacyjny koniec okresu wypowiedzenia (wariant 1-miesięczny)",
      fromQuestionId: "submit_date",
      months: 1,
      description:
        "Termin pokazuje upływ 1 miesiąca od planowanej daty doręczenia. Okres miesięczny kończy się jednak zawsze w ostatnim dniu miesiąca, a tygodniowy – w sobotę (art. 30 § 2¹ k.p.). Dokładną datę rozwiązania umowy – z uwzględnieniem stażu i rodzaju umowy – wylicza pismo.",
    },
    {
      id: "fault_termination_limit",
      label: "Ostatni dzień na rozwiązanie umowy z winy pracodawcy",
      fromQuestionId: "fault_last_date",
      months: 1,
      description:
        "Oświadczenie o rozwiązaniu umowy bez wypowiedzenia trzeba złożyć przed upływem 1 miesiąca od uzyskania wiadomości o okoliczności uzasadniającej rozwiązanie (art. 55 § 2 zd. 2 w zw. z art. 52 § 2 k.p.). Liczy się doręczenie pisma pracodawcy, nie wysłanie.",
    },
  ],
  instructions: {
    whereToSend:
      "Pismo kierujesz do **pracodawcy** – na adres siedziby wskazany w umowie o pracę (spółki: adres z KRS). W praktyce najprościej złożyć je **osobiście w dziale kadr lub u przełożonego** uprawnionego do przyjmowania pism. Jeśli pracodawca ma kilka oddziałów, złóż pismo tam, gdzie prowadzone są Twoje akta osobowe.",
    howToSend:
      "Najpewniej: wydrukuj **dwa egzemplarze**, podpisz oba odręcznie i złóż jeden w kadrach – na drugim poproś o datę i podpis osoby przyjmującej. To dzień doręczenia, od którego liczy się okres wypowiedzenia.\n\nMożesz też wysłać pismo **listem poleconym za potwierdzeniem odbioru** – wtedy okres liczy się od dnia odbioru przez pracodawcę (albo od dnia, w którym mógł on odebrać awizowany list). Pismo opatrzone **kwalifikowanym podpisem elektronicznym** wysłane e-mailem także spełnia wymóg formy pisemnej; zwykły e-mail lub SMS – nie.",
    afterSending:
      "Przy **wypowiedzeniu** zgoda pracodawcy nie jest potrzebna – umowa rozwiąże się z upływem okresu wypowiedzenia. Propozycję wcześniejszego terminu (art. 36 § 6 k.p.) albo **porozumienie stron** pracodawca może przyjąć lub odrzucić – poproś o odpowiedź na piśmie.\n\nW dniu rozwiązania umowy pracodawca powinien wydać **świadectwo pracy** i rozliczyć wynagrodzenie oraz **ekwiwalent za urlop**. Jeśli tego nie zrobi:\n- zgłoś sprawę do **Państwowej Inspekcji Pracy** (skarga jest bezpłatna),\n- złóż pozew do **sądu pracy** (o wydanie świadectwa pracy, zapłatę wynagrodzenia, odszkodowanie) – pracownik wnoszący powództwo nie ma obowiązku uiszczania kosztów sądowych (art. 96 ust. 1 pkt 4 ustawy o kosztach sądowych w sprawach cywilnych; wyjątek dotyczy apelacji przy wartości sporu ponad 50 000 zł).\n\nPo rozwiązaniu umowy **bez wypowiedzenia z winy pracodawcy** pracodawca może kwestionować przyczynę – zachowaj dowody (wyciągi z konta, korespondencję, zeznania świadków).",
    checklist: [
      "Sprawdź datę rozpoczęcia pracy u pracodawcy i rodzaj umowy – od nich zależy okres wypowiedzenia.",
      "Upewnij się, że dane pracodawcy i stanowisko są zgodne z umową o pracę.",
      "Podpisz pismo odręcznie i przygotuj drugi egzemplarz na potwierdzenie odbioru.",
      "Przy rozwiązaniu z winy pracodawcy: sprawdź, czy nie minął 1 miesiąc od ostatniego naruszenia, i zbierz dowody.",
      "Zapisz w kalendarzu dzień rozwiązania umowy i dopilnuj odbioru świadectwa pracy.",
      "Zachowaj kopię pisma z datą przyjęcia albo dowód nadania i zwrotkę.",
    ],
  },
  seo: {
    title: "Wypowiedzenie umowy o pracę – wzór 2026 + kalkulator",
    metaDescription:
      "Wzór wypowiedzenia umowy o pracę przez pracownika z wyliczonym okresem wypowiedzenia i datą rozwiązania. Także porozumienie stron i art. 55 § 1¹ KP.",
    h1: "Wypowiedzenie umowy o pracę przez pracownika – wzór i generator",
    intro:
      "Odpowiedz na kilka pytań o umowę i staż, a policzymy okres wypowiedzenia oraz dzień, w którym umowa się rozwiąże. Przygotujemy wypowiedzenie, wniosek o rozwiązanie za porozumieniem stron albo oświadczenie o rozwiązaniu umowy bez wypowiedzenia z winy pracodawcy – gotowe do podpisu w DOCX lub PDF.",
    keywords: [
      "wypowiedzenie umowy o pracę przez pracownika",
      "wypowiedzenie umowy o pracę wzór",
      "okres wypowiedzenia umowy o pracę",
      "rozwiązanie umowy za porozumieniem stron wzór",
      "wypowiedzenie umowy na czas określony przez pracownika",
      "rozwiązanie umowy bez wypowiedzenia z winy pracodawcy",
      "art. 55 § 1¹ kodeksu pracy",
      "kalkulator okresu wypowiedzenia",
    ],
    guide: [
      {
        heading: "Trzy sposoby zakończenia pracy z inicjatywy pracownika",
        body: `Kodeks pracy przewiduje kilka trybów rozwiązania umowy o pracę (art. 30 § 1 k.p.). Pracownik, który chce odejść, ma do wyboru:

- **Wypowiedzenie** – jednostronne oświadczenie, które nie wymaga zgody pracodawcy ani podawania przyczyny. Umowa rozwiązuje się z upływem okresu wypowiedzenia (art. 32 k.p.).
- **Porozumienie stron** – umowa kończy się w dniu, na który obie strony się zgodzą, nawet następnego dnia. Pracodawca nie musi jednak przyjąć Twojej propozycji.
- **Rozwiązanie bez wypowiedzenia z winy pracodawcy** (art. 55 § 1¹ k.p.) – gdy pracodawca ciężko narusza podstawowe obowiązki wobec Ciebie, np. nie płaci pensji. Umowa kończy się z dniem doręczenia oświadczenia, a Tobie przysługuje odszkodowanie.

Każde z tych oświadczeń powinno mieć **formę pisemną** (art. 30 § 3 k.p.). Wypowiedzenie złożone ustnie albo SMS-em jest wadliwe i może prowadzić do sporu o dzień rozwiązania umowy.`,
      },
      {
        heading: "Jak długi jest okres wypowiedzenia",
        body: `Długość okresu wypowiedzenia zależy od rodzaju umowy i od tego, jak długo pracujesz u danego pracodawcy:

| Umowa | Staż u pracodawcy | Okres wypowiedzenia |
|---|---|---|
| na okres próbny do 2 tygodni | – | 3 dni robocze |
| na okres próbny dłuższy niż 2 tygodnie | – | 1 tydzień |
| na okres próbny 3 miesiące | – | 2 tygodnie |
| na czas określony lub nieokreślony | krócej niż 6 miesięcy | 2 tygodnie |
| na czas określony lub nieokreślony | co najmniej 6 miesięcy | 1 miesiąc |
| na czas określony lub nieokreślony | co najmniej 3 lata | 3 miesiące |

Do stażu liczy się cały okres pracy u tego samego pracodawcy – wszystkie kolejne umowy, także na okres próbny, a przy przejęciu zakładu – także pracę u poprzedniego pracodawcy (art. 36 § 1¹ k.p.). Od 1 stycznia 2026 r. (u pracodawców spoza sektora finansów publicznych – od 1 maja 2026 r.) do okresu zatrudnienia u danego pracodawcy wlicza się również m.in. udokumentowane okresy zlecenia lub działalności gospodarczej, jeśli w ich ramach praca była świadczona na rzecz tego samego pracodawcy (art. 302¹ § 8 k.p.; potwierdza je zaświadczenie z ZUS). Umowa może przewidywać dłuższy okres tylko w szczególnych przypadkach, np. przy odpowiedzialności materialnej (art. 36 § 5 k.p.).`,
      },
      {
        heading: "Kiedy kończy się okres wypowiedzenia",
        body: `Okres wypowiedzenia liczy się **od dnia następującego po doręczeniu pisma** pracodawcy. Okres liczony w tygodniach kończy się zawsze w **sobotę**, a liczony w miesiącach – w **ostatnim dniu miesiąca** (art. 30 § 2¹ k.p.).

Przykłady:
- staż 2 lata, wypowiedzenie doręczone 14 października – okres 1 miesiąc biegnie od 1 listopada i kończy się **30 listopada**,
- staż 4 miesiące, wypowiedzenie doręczone w środę 14 października – okres 2 tygodnie biegnie od niedzieli 18 października i kończy się w sobotę **31 października**,
- staż 5 lat, wypowiedzenie doręczone 2 marca – okres 3 miesiące kończy się **30 czerwca**.

Dlatego warto złożyć wypowiedzenie **przed końcem miesiąca**: pismo doręczone 31 października i 1 listopada to różnica całego miesiąca pracy. Nasz generator liczy tę datę automatycznie i wpisuje ją do pisma, a dodatkowo zastrzega, że w razie innego okresu wynikającego z przepisów umowa rozwiąże się z upływem okresu właściwego.`,
      },
      {
        heading: "Jak skrócić okres wypowiedzenia",
        body: `Nowa praca od 1. dnia miesiąca, a wypowiedzenie kończy się później? Masz trzy możliwości:

1. **Wypowiedzenie z propozycją wcześniejszego terminu** (art. 36 § 6 k.p.) – składasz zwykłe wypowiedzenie i jednocześnie proponujesz wcześniejszy dzień rozwiązania. Jeśli pracodawca się nie zgodzi, umowa i tak rozwiąże się z upływem okresu wypowiedzenia – nic nie ryzykujesz.
2. **Porozumienie stron** – wnioskujesz o rozwiązanie umowy w konkretnym dniu. Uwaga: jeśli pracodawca odmówi, a Ty nie złożysz wypowiedzenia, umowa trwa dalej.
3. **Zwolnienie z obowiązku świadczenia pracy** (art. 36² k.p.) lub **urlop** w okresie wypowiedzenia (art. 167¹ k.p.) – umowa trwa do końca okresu wypowiedzenia, ale nie musisz przychodzić do pracy. O zwolnieniu decyduje pracodawca; w tym czasie zachowujesz wynagrodzenie.

Pamiętaj, że w okresie wypowiedzenia nadal jesteś pracownikiem – podjęcie pracy u nowego pracodawcy przed rozwiązaniem umowy jest możliwe tylko wtedy, gdy nie koliduje z obowiązkami u dotychczasowego (np. podczas zwolnienia z obowiązku świadczenia pracy) i nie narusza zakazu konkurencji.`,
      },
      {
        heading: "Rozwiązanie umowy bez wypowiedzenia z winy pracodawcy",
        body: `Art. 55 § 1¹ k.p. pozwala pracownikowi natychmiast rozwiązać umowę, gdy pracodawca **ciężko naruszył podstawowe obowiązki** wobec niego. Najczęstsze przykłady to: niewypłacanie wynagrodzenia lub jego istotnej części, uporczywe opóźnienia wypłat, mobbing i dyskryminacja, poważne naruszenia przepisów BHP.

Trzeba spełnić warunki formalne:
- oświadczenie **na piśmie z podaniem przyczyny** (art. 55 § 2 k.p.) – opisz konkretne fakty, daty i kwoty,
- złożenie oświadczenia w ciągu **1 miesiąca** od dowiedzenia się o naruszeniu – przy naruszeniach trwających (np. kolejne niewypłacone pensje) termin liczy się zwykle od ostatniego zdarzenia.

Przysługuje Ci **odszkodowanie** w wysokości wynagrodzenia za okres wypowiedzenia, a przy umowie na czas określony – za czas, do którego umowa miała trwać, nie więcej niż za okres wypowiedzenia. Rozwiązanie w tym trybie wywołuje skutki takie jak wypowiedzenie przez pracodawcę (art. 55 § 3 k.p.) – ma to znaczenie m.in. dla prawa do zasiłku dla bezrobotnych. Jeśli pracodawca uzna, że przyczyna była nieuzasadniona, może dochodzić od Ciebie odszkodowania w sądzie – dlatego zabezpiecz dowody przed złożeniem oświadczenia.`,
      },
      {
        heading: "Świadectwo pracy, ekwiwalent i rozliczenie",
        body: `W dniu rozwiązania umowy pracodawca musi wydać **świadectwo pracy** (art. 97 § 1 k.p.) – nie może uzależniać tego od rozliczenia się pracownika (np. zwrotu laptopa). W świadectwie wpisuje się m.in. tryb rozwiązania umowy, więc sprawdź, czy jest zgodny z Twoim pismem. Na sprostowanie świadectwa masz 14 dni od jego otrzymania.

Za urlop, którego nie wykorzystasz do końca pracy, przysługuje **ekwiwalent pieniężny** (art. 171 § 1 k.p.), wypłacany w terminie wypłaty wynagrodzenia, a gdy ten termin przypada przed dniem rozwiązania umowy – w ciągu 10 dni od rozwiązania (art. 171 § 4 i 5 k.p.). Pracodawca może jednak udzielić Ci urlopu w okresie wypowiedzenia – wtedy musisz go wykorzystać.

Jeśli pracodawca nie wyda świadectwa albo nie wypłaci pieniędzy, złóż skargę do Państwowej Inspekcji Pracy lub pozew do sądu pracy.`,
      },
    ],
    faq: [
      {
        question: "Czy muszę podawać przyczynę wypowiedzenia umowy o pracę?",
        answer:
          "Nie. Pracownik wypowiada umowę bez podawania przyczyny. Obowiązek wskazania przyczyny dotyczy pracodawcy oraz rozwiązania umowy bez wypowiedzenia – także przez pracownika z winy pracodawcy (art. 55 § 2 k.p.).",
      },
      {
        question: "Od kiedy liczy się okres wypowiedzenia?",
        answer:
          "Od dnia następującego po doręczeniu pisma pracodawcy. Okres tygodniowy kończy się w sobotę, a miesięczny – w ostatnim dniu miesiąca. Wypowiedzenie doręczone 31 października przy miesięcznym okresie rozwiąże umowę 30 listopada, a doręczone 1 listopada – dopiero 31 grudnia.",
      },
      {
        question: "Czy pracodawca może nie przyjąć wypowiedzenia?",
        answer:
          "Wypowiedzenie jest skuteczne z chwilą, gdy dotarło do pracodawcy w taki sposób, że mógł zapoznać się z jego treścią – jego zgoda nie jest potrzebna. Jeśli kadry odmawiają przyjęcia pisma, wyślij je listem poleconym za potwierdzeniem odbioru.",
      },
      {
        question: "Czy mogę wypowiedzieć umowę na czas określony?",
        answer:
          "Tak. Od 2016 r. umowę na czas określony można wypowiedzieć tak jak umowę na czas nieokreślony – z okresem wypowiedzenia zależnym od stażu (2 tygodnie, 1 miesiąc albo 3 miesiące). Jeśli umowa wygaśnie wcześniej, rozwiąże się w dniu, na który została zawarta.",
      },
      {
        question: "Czy mogę skrócić okres wypowiedzenia?",
        answer:
          "Tylko za zgodą pracodawcy (art. 36 § 6 k.p.). Najbezpieczniej złożyć wypowiedzenie i jednocześnie zaproponować wcześniejszy termin – jeśli pracodawca się nie zgodzi, umowa i tak rozwiąże się z upływem okresu wypowiedzenia.",
      },
      {
        question: "Czy po wypowiedzeniu przysługuje mi zasiłek dla bezrobotnych?",
        answer:
          "Według ustawy z dnia 20 marca 2025 r. o rynku pracy i służbach zatrudnienia zasiłek nie przysługuje osobie, która sama wypowiedziała umowę o pracę – chyba że z powodu zmiany miejsca zamieszkania albo w trybie art. 55 § 1 lub § 1¹ k.p. (art. 219 ust. 1 pkt 1). Po porozumieniu stron zasiłek przysługuje co do zasady dopiero po 90 dniach od rejestracji (art. 220). Szczegóły potwierdź w powiatowym urzędzie pracy.",
      },
      {
        question: "Co jeśli pracodawca nie płaci mi wynagrodzenia?",
        answer:
          "To typowy przykład ciężkiego naruszenia podstawowych obowiązków pracodawcy. Możesz rozwiązać umowę bez wypowiedzenia w ciągu miesiąca od ostatniego naruszenia i żądać odszkodowania za okres wypowiedzenia oraz zaległego wynagrodzenia. Zachowaj wyciągi z konta i korespondencję.",
      },
      {
        question: "Czy wypowiedzenie wysłane e-mailem jest ważne?",
        answer:
          "Zwykły e-mail nie spełnia wymogu formy pisemnej z art. 30 § 3 k.p. Formę pisemną zachowasz, podpisując pismo odręcznie albo kwalifikowanym podpisem elektronicznym. Najprościej złożyć wydrukowane pismo w kadrach za potwierdzeniem na kopii.",
      },
    ],
  },
  ai: {
    context:
      "Pismo pracownika do pracodawcy dotyczące rozwiązania umowy o pracę: wypowiedzenie, wniosek o rozwiązanie za porozumieniem stron albo oświadczenie o rozwiązaniu umowy bez wypowiedzenia z powodu ciężkiego naruszenia przez pracodawcę podstawowych obowiązków. Opis faktów ma rzeczowo, chronologicznie i konkretnie (daty, kwoty, zdarzenia) przedstawić okoliczności podane przez użytkownika – w trybie rozwiązania z winy pracodawcy jest to przyczyna rozwiązania umowy, którą musi zawierać pismo. Nie podawaj okresu wypowiedzenia, dat rozwiązania umowy ani podstaw prawnych – szablon wylicza je i wstawia sam. W żądaniu nie powtarzaj wniosków o świadectwo pracy, ekwiwalent, urlop ani zwolnienie z obowiązku świadczenia pracy – szablon dodaje je osobno. Ton urzędowy, spokojny, bez emocji i gróźb; pisz w pierwszej osobie i neutralnie płciowo (bez form typu „zostałem/zostałam”).",
    factQuestionIds: [
      "mode",
      "position",
      "contract_type",
      "reason_optional",
      "fault_category",
      "fault_description",
      "fault_last_date",
      "unpaid_amount",
    ],
  },
  render: ({ answers, ai, today }) => {
    const mode = modeOf(answers);
    const calc = computeNotice(answers);
    const email = str(answers, "sender_email", "");
    const phone = str(answers, "sender_phone", "");
    const reason = str(answers, "reason_optional", "");
    const requested = dateAnswer(answers, "requested_end_date");
    const paragraphs: Paragraph[] = [];

    if (mode === "notice" || mode === "notice_shorten") {
      paragraphs.push(
        p(
          `Działając na podstawie art. 30 § 1 pkt 2 i art. 32 § 1 ${KP_FULL}, niniejszym wypowiadam ${contractDescription(answers)}.`,
        ),
      );
      paragraphs.push(...noticeParagraphs(answers, calc));
      if (ai?.facts) {
        paragraphs.push(...paragraphsFromText(ai.facts));
      } else if (reason) {
        paragraphs.push(
          p(
            `Wypowiedzenie przez pracownika nie wymaga uzasadnienia; informacyjnie wskazuję jego przyczynę: ${lowerFirst(sentence(reason))}`,
          ),
        );
      }
      if (mode === "notice_shorten") {
        paragraphs.push(
          p(
            `Jednocześnie, na podstawie art. 36 § 6 k.p., proponuję ustalenie wcześniejszego terminu rozwiązania umowy o pracę – na dzień ${formatDatePl(
              requested,
            )}. Ustalenie takie nie zmienia trybu rozwiązania umowy (rozwiązanie za wypowiedzeniem dokonanym przez pracownika). Proszę o pisemne stanowisko w tej sprawie; w razie braku zgody umowa ulegnie rozwiązaniu z upływem okresu wypowiedzenia.`,
          ),
        );
      }
    } else if (mode === "agreement") {
      paragraphs.push(
        p(
          `Działając na podstawie art. 30 § 1 pkt 1 ${KP_FULL}, zwracam się z wnioskiem o rozwiązanie na mocy porozumienia stron, z dniem ${formatDatePl(
            requested,
          )}, ${contractDescription(answers, "gen")}.`,
        ),
      );
      if (ai?.facts) {
        paragraphs.push(...paragraphsFromText(ai.facts));
      } else if (reason) {
        paragraphs.push(p(`Wniosek uzasadniam następująco: ${lowerFirst(sentence(reason))}`));
      }
      paragraphs.push(
        p(
          "Rozwiązanie umowy na mocy porozumienia stron wymaga zgodnych oświadczeń obu stron. Proszę o pisemne ustosunkowanie się do wniosku w terminie 7 dni od dnia jego doręczenia, a w razie akceptacji – o przygotowanie porozumienia w formie pisemnej do podpisu.",
        ),
      );
    } else {
      paragraphs.push(
        p(
          `Działając na podstawie art. 55 § 1¹ ${KP_FULL}, oświadczam, że rozwiązuję bez wypowiedzenia ${contractDescription(
            answers,
          )}, z powodu ciężkiego naruszenia przez Pracodawcę podstawowych obowiązków wobec pracownika. Rozwiązanie umowy następuje z dniem doręczenia niniejszego oświadczenia.`,
        ),
      );
      paragraphs.push(heading("Przyczyna rozwiązania umowy"));
      paragraphs.push(p(FAULT_SENTENCE[faultCategoryOf(answers)]));
      if (ai?.facts) {
        paragraphs.push(...paragraphsFromText(ai.facts));
        if (ai.justification) paragraphs.push(...paragraphsFromText(ai.justification));
      } else {
        userParagraphs(str(answers, "fault_description")).forEach((t) => paragraphs.push(p(t)));
      }
      const last = dateAnswer(answers, "fault_last_date");
      const served = dateAnswer(answers, "submit_date");
      if (last) {
        const inTime = !served || served.getTime() <= addMonths(last, 1).getTime();
        paragraphs.push(
          p(
            `Ostatnie z opisanych naruszeń miało miejsce w dniu ${formatDatePl(last)}.${
              inTime
                ? " Niniejsze oświadczenie składam przed upływem 1 miesiąca od uzyskania wiadomości o okolicznościach uzasadniających rozwiązanie umowy (art. 55 § 2 zd. 2 w zw. z art. 52 § 2 k.p.)."
                : ""
            }`,
          ),
        );
      }
      paragraphs.push(heading("Roszczenia"));
      const unpaid = num(answers, "unpaid_amount");
      const claims = [`zapłatę ${compensationText(answers, calc)}`];
      if (faultCategoryOf(answers) === "unpaid_salary") {
        claims.push(
          unpaid !== undefined
            ? `wypłatę zaległego wynagrodzenia za pracę w kwocie ${formatMoneyPl(unpaid)} brutto wraz z odsetkami ustawowymi za opóźnienie`
            : "wypłatę całego zaległego wynagrodzenia za pracę wraz z odsetkami ustawowymi za opóźnienie",
        );
      }
      paragraphs.push(p("W związku z rozwiązaniem umowy wnoszę o:"));
      paragraphs.push(list(claims));
      paragraphs.push(
        p(
          "Zgodnie z art. 55 § 3 k.p. rozwiązanie umowy o pracę z tej przyczyny pociąga za sobą skutki, jakie przepisy prawa wiążą z rozwiązaniem umowy przez pracodawcę za wypowiedzeniem.",
        ),
      );
      if (ai?.demand) paragraphs.push(...paragraphsFromText(ai.demand));
    }

    const items = requestItems(answers, mode);
    if (items.length) {
      paragraphs.push(p(mode === "employer_fault" ? "Ponadto wnoszę o:" : "Jednocześnie proszę o:"));
      paragraphs.push(list(items));
    }

    if (mode !== "employer_fault" && ai?.demand) {
      paragraphs.push(...paragraphsFromText(ai.demand));
    }

    paragraphs.push(
      p(
        `Proszę o potwierdzenie otrzymania niniejszego pisma${
          email ? `, a korespondencję w tej sprawie proszę kierować na adres wskazany w nagłówku lub na adres e-mail: ${email}` : ""
        }.`,
      ),
    );

    const titles: Record<Mode, string> = {
      notice: "WYPOWIEDZENIE UMOWY O PRACĘ",
      notice_shorten: "WYPOWIEDZENIE UMOWY O PRACĘ",
      agreement: "WNIOSEK O ROZWIĄZANIE UMOWY O PRACĘ NA MOCY POROZUMIENIA STRON",
      employer_fault: "OŚWIADCZENIE O ROZWIĄZANIU UMOWY O PRACĘ BEZ WYPOWIEDZENIA",
    };
    const subjects: Record<Mode, string> = {
      notice: "dot. wypowiedzenia umowy o pracę przez pracownika",
      notice_shorten: "dot. wypowiedzenia umowy o pracę i propozycji wcześniejszego terminu rozwiązania",
      agreement: "dot. rozwiązania umowy o pracę na mocy porozumienia stron",
      employer_fault: "dot. rozwiązania umowy o pracę z winy pracodawcy (art. 55 § 1¹ k.p.)",
    };

    return {
      sender: partyFromAnswers(answers, "sender", [email ? `e-mail: ${email}` : "", phone ? `tel. ${phone}` : ""]),
      recipient: partyFromAnswers(answers, "recipient"),
      place: str(answers, "sender_city"),
      date: formatDatePl(today),
      title: titles[mode],
      subject: subjects[mode],
      paragraphs: paragraphs.map(tidyParagraph),
      closing: "Z poważaniem",
      signatureName: str(answers, "sender_name"),
      attachments: [],
      previewParagraphCount: 2,
    };
  },
};
