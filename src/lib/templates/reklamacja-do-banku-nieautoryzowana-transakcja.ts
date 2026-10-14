import type { Answers, LetterTemplate, Paragraph } from "./types";
import {
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
 * Reklamacja do banku – nieautoryzowana transakcja płatnicza (karta, przelew, BLIK).
 * Rozgałęzienia:
 *  - `transaction_type` – opis instrumentu płatniczego,
 *  - `cause` – kradzież/utrata (art. 46 ust. 2: max 50 EUR), oszustwo (phishing, „na pracownika banku”, zdalny pulpit) –
 *    akapit przeciwko zarzutowi rażącego niedbalstwa (art. 45 ust. 2, art. 46 ust. 3), nieznana przyczyna,
 *  - `confirmed_in_app` – potwierdzenie operacji w aplikacji pod wpływem manipulacji (brak zgody z art. 40 ust. 1),
 *  - `bank_response` – pierwsza reklamacja albo ponowna reklamacja po odmowie.
 * Przepisy zweryfikowane z tekstami jednolitymi: u.u.p. Dz. U. z 2026 r. poz. 623, u.r.r. Dz. U. z 2026 r. poz. 823.
 * Szczegóły: docs/legal-review/reklamacja-do-banku-nieautoryzowana-transakcja.md
 */

const UUP = "ustawy z dnia 19 sierpnia 2011 r. o usługach płatniczych (dalej: „u.u.p.”)";
const REKL =
  "ustawy z dnia 5 sierpnia 2015 r. o rozpatrywaniu reklamacji przez podmioty rynku finansowego, o Rzeczniku Finansowym i o Funduszu Edukacji Finansowej";
const ISAP_UUP = "https://isap.sejm.gov.pl/isap.nsf/DocDetails.xsp?id=WDU20111991175";
const ISAP_REKL = "https://isap.sejm.gov.pl/isap.nsf/DocDetails.xsp?id=WDU20150001348";

type Cause = "card_lost" | "phishing" | "vishing" | "remote_access" | "unknown";
const FRAUD_CAUSES: Cause[] = ["phishing", "vishing", "remote_access"];

function causeOf(answers: Answers): Cause {
  const v = str(answers, "cause", "unknown");
  return (["card_lost", "phishing", "vishing", "remote_access"] as string[]).includes(v) ? (v as Cause) : "unknown";
}

function parseIso(value: Answers[string]): Date | undefined {
  if (typeof value !== "string") return undefined;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!m) return undefined;
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
}

function daysBetween(from: Date | undefined, to: Date | undefined): number | undefined {
  if (!from || !to) return undefined;
  return Math.round((to.getTime() - from.getTime()) / 86_400_000);
}

/** true, gdy zgłoszenie nastąpiło przed upływem 13 miesięcy od obciążenia rachunku */
function within13Months(debit: Date | undefined, report: Date | undefined): boolean | undefined {
  if (!debit || !report) return undefined;
  const limit = new Date(debit.getTime());
  limit.setUTCMonth(limit.getUTCMonth() + 13);
  return report.getTime() <= limit.getTime();
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

const INSTRUMENT: Record<string, string> = {
  card: "kartą płatniczą",
  transfer: "w formie przelewów z rachunku za pośrednictwem bankowości elektronicznej",
  blik: "przy użyciu kodów BLIK",
};

const CAUSE_TEXT: Record<Cause, string> = {
  card_lost: "Do transakcji doszło po utracie (kradzieży) instrumentu płatniczego.",
  phishing:
    "Do transakcji doszło w wyniku oszustwa: dane dostępowe zostały wyłudzone za pośrednictwem fałszywej strony internetowej lub wiadomości (SMS, e-mail, komunikator), która podszywała się pod zaufany podmiot.",
  vishing:
    "Do transakcji doszło w wyniku oszustwa: osoba podszywająca się w rozmowie telefonicznej pod pracownika banku lub innej instytucji (np. Policji) wprowadziła mnie w błąd co do bezpieczeństwa środków na rachunku.",
  remote_access:
    "Do transakcji doszło w wyniku oszustwa: pod wpływem manipulacji osoby podszywającej się pod pracownika banku lub innej instytucji na moim urządzeniu zostało zainstalowane oprogramowanie umożliwiające zdalny dostęp, które sprawcy wykorzystali do wykonania transakcji.",
  unknown:
    "Karty, telefonu ani danych dostępowych do bankowości elektronicznej nie udostępniano osobom trzecim. Sposób, w jaki sprawcy uzyskali dostęp do rachunku, nie jest mi znany.",
};

function factsParagraphs(answers: Answers): Paragraph[] {
  const cause = causeOf(answers);
  const out: Paragraph[] = [];
  const reportNo = str(answers, "bank_report_number", "");
  const noticed = parseIso(answers.noticed_date);
  const reported = parseIso(answers.bank_report_date);
  const delay = daysBetween(noticed, reported);

  out.push(p(CAUSE_TEXT[cause]));
  if (FRAUD_CAUSES.includes(cause)) {
    const confirmed = str(answers, "confirmed_in_app", "");
    if (confirmed === "yes_misled") {
      out.push(
        p(
          "Potwierdzenie operacji w aplikacji mobilnej lub kodem nastąpiło wyłącznie wskutek wprowadzenia w błąd przez sprawców, bez świadomości, że dotyczy ono przekazania środków na rzecz osób trzecich.",
        ),
      );
    } else if (confirmed === "no") {
      out.push(p("Transakcje nie były przeze mnie potwierdzane w aplikacji mobilnej, kodem SMS ani w żaden inny sposób."));
    }
  }

  userParagraphs(str(answers, "description", "")).forEach((t) => out.push(p(t)));

  const reportSentence = `Nieautoryzowane transakcje zostały przeze mnie zauważone w dniu ${formatDatePl(
    str(answers, "noticed_date", ""),
  )} i zgłoszone bankowi${delay !== undefined && delay <= 1 ? " niezwłocznie," : ""} w dniu ${formatDatePl(
    str(answers, "bank_report_date", ""),
  )}${reportNo ? ` (numer zgłoszenia: ${reportNo})` : ""}.`;
  out.push(p(reportSentence));

  const police = str(answers, "police_report", "no");
  const policeDetails = str(answers, "police_details", "");
  if (police === "yes") {
    out.push(p(`Sprawa została zgłoszona Policji${policeDetails ? ` (${trimEnd(policeDetails)})` : ""}.`));
  } else if (police === "planned") {
    out.push(p("Sprawa zostanie niezwłocznie zgłoszona Policji."));
  }

  if (str(answers, "bank_response", "none") === "refused") {
    const reason = userParagraphs(str(answers, "bank_refusal_reason", ""));
    out.push(
      p(
        `W odpowiedzi z dnia ${formatDatePl(str(answers, "refusal_date", ""))} bank odmówił zwrotu środków${
          reason.length ? `, wskazując: ${reason.join(" ")}` : "."
        }`,
      ),
    );
    out.push(p("Nie zgadzam się z tym stanowiskiem i wnoszę o ponowne rozpatrzenie sprawy z przyczyn wskazanych poniżej."));
  }
  return out;
}

function legalParagraphs(answers: Answers): Paragraph[] {
  const cause = causeOf(answers);
  const confirmed = str(answers, "confirmed_in_app", "");
  const debit = parseIso(answers.first_debit_date);
  const reported = parseIso(answers.bank_report_date);
  const in13 = within13Months(debit, reported);
  const out: Paragraph[] = [];

  out.push(
    p(
      `Zgodnie z art. 40 ust. 1 ${UUP} transakcję płatniczą uważa się za autoryzowaną, jeżeli płatnik wyraził zgodę na jej wykonanie w sposób przewidziany w umowie z dostawcą. Wskazane transakcje nie zostały przeze mnie zlecone, a zgoda na ich wykonanie nie została udzielona – są to zatem nieautoryzowane transakcje płatnicze.${
        FRAUD_CAUSES.includes(cause) && confirmed === "yes_misled"
          ? " Potwierdzenie operacji uzyskane przez sprawców podstępem, bez wiedzy o rzeczywistej treści transakcji (odbiorcy i kwocie), nie stanowi zgody na wykonanie tych transakcji."
          : ""
      }`,
    ),
  );

  out.push(
    p(
      `Stosownie do art. 44 ust. 1 i 2 u.u.p. użytkownik niezwłocznie powiadamia dostawcę o stwierdzonych nieautoryzowanych transakcjach, a roszczenia z tego tytułu wygasają, jeżeli powiadomienie nie nastąpi w terminie 13 miesięcy od dnia obciążenia rachunku.${
        in13 === false ? "" : " Zgłoszenie zostało dokonane w tym terminie."
      }`,
    ),
  );

  out.push(
    p(
      "Zgodnie z art. 45 ust. 1 u.u.p. na dostawcy użytkownika spoczywa ciężar udowodnienia, że transakcja płatnicza została autoryzowana i prawidłowo zapisana w systemie oraz że nie miała na nią wpływu awaria techniczna ani inna usterka. Wykazanie zarejestrowanego użycia instrumentu płatniczego nie jest wystarczające do udowodnienia, że transakcja została autoryzowana przez użytkownika ani że płatnik umyślnie albo wskutek rażącego niedbalstwa naruszył obowiązki określone w art. 42 u.u.p. – ciężar udowodnienia tych okoliczności spoczywa na dostawcy (art. 45 ust. 2 u.u.p.).",
    ),
  );

  out.push(
    p(
      "Zgodnie z art. 46 ust. 1 u.u.p. w przypadku wystąpienia nieautoryzowanej transakcji płatniczej dostawca płatnika niezwłocznie, nie później jednak niż do końca dnia roboczego następującego po dniu otrzymania stosownego zgłoszenia, zwraca płatnikowi kwotę nieautoryzowanej transakcji i przywraca obciążony rachunek do stanu, jaki istniałby, gdyby transakcja nie miała miejsca, z datą waluty nie późniejszą od daty obciążenia. Jedynym wyjątkiem jest sytuacja, w której dostawca ma uzasadnione i należycie udokumentowane podstawy, aby podejrzewać oszustwo, i poinformuje o tym w formie pisemnej organy powołane do ścigania przestępstw.",
    ),
  );

  if (cause === "card_lost") {
    out.push(
      p(
        "Za nieautoryzowane transakcje będące skutkiem posłużenia się utraconym albo skradzionym instrumentem płatniczym płatnik odpowiada jedynie do wysokości równowartości 50 euro (art. 46 ust. 2 u.u.p.), a w pełnej wysokości – wyłącznie wtedy, gdy doprowadził do nich umyślnie albo w wyniku umyślnego lub rażąco niedbałego naruszenia obowiązków z art. 42 u.u.p. (art. 46 ust. 3 u.u.p.), czego w niniejszej sprawie nie było. Po dokonaniu zgłoszenia płatnik nie odpowiada za nieautoryzowane transakcje, chyba że doprowadził do nich umyślnie (art. 46 ust. 4 u.u.p.).",
      ),
    );
  } else {
    out.push(
      p(
        `Płatnik odpowiada za nieautoryzowane transakcje w pełnej wysokości wyłącznie wtedy, gdy doprowadził do nich umyślnie albo w wyniku umyślnego lub będącego skutkiem rażącego niedbalstwa naruszenia obowiązków określonych w art. 42 u.u.p. (art. 46 ust. 3 u.u.p.).${
          FRAUD_CAUSES.includes(cause)
            ? " Stanowczo sprzeciwiam się ewentualnemu zarzutowi rażącego niedbalstwa. Rażące niedbalstwo to kwalifikowana postać winy, polegająca na naruszeniu elementarnych zasad ostrożności. Nie można go przypisać osobie, która padła ofiarą profesjonalnie przygotowanego oszustwa, w którym sprawcy wykorzystali techniki socjotechniczne i podszywali się pod zaufane instytucje. Wykazanie rażącego niedbalstwa obciąża bank (art. 45 ust. 2 u.u.p.)."
            : ""
        } Po dokonaniu zgłoszenia płatnik nie odpowiada za nieautoryzowane transakcje, chyba że doprowadził do nich umyślnie (art. 46 ust. 4 u.u.p.).`,
      ),
    );
  }

  out.push(
    p(
      "Ponadto, jeżeli przy którejkolwiek z kwestionowanych transakcji bank nie wymagał silnego uwierzytelnienia użytkownika, płatnik nie ponosi odpowiedzialności za te transakcje, chyba że działał umyślnie (art. 46 ust. 4a u.u.p.).",
    ),
  );

  out.push(
    p(
      `Zgodnie z art. 15a ust. 2 i 3 u.u.p. odpowiedzi na reklamację udziela się w terminie 15 dni roboczych od dnia jej otrzymania, a w szczególnie skomplikowanych przypadkach – w terminie nie dłuższym niż 35 dni roboczych, po wyjaśnieniu przyczyny opóźnienia. Zgodnie z art. 8 ${REKL} w przypadku niedotrzymania terminu odpowiedzi reklamację uważa się za rozpatrzoną zgodnie z wolą klienta.`,
    ),
  );
  return out;
}

export const reklamacjaDoBanku: LetterTemplate = {
  slug: "reklamacja-do-banku-nieautoryzowana-transakcja",
  name: "Reklamacja do banku – nieautoryzowana transakcja",
  category: "finanse",
  shortDescription:
    "Żądanie zwrotu pieniędzy po kradzieży karty, phishingu, oszustwie „na pracownika banku” lub nieautoryzowanym BLIK-u.",
  priceGrosze: 2499,
  icon: "🏦",
  estimatedMinutes: 8,
  sections: [
    {
      id: "sender",
      title: "Twoje dane",
      description: "Dane posiadacza rachunku lub karty – takie, jak w umowie z bankiem.",
      questions: senderQuestions(),
    },
    {
      id: "recipient",
      title: "Bank",
      description:
        "Adres do reklamacji znajdziesz na stronie banku (zakładka „Reklamacje”) lub w regulaminie rachunku. Możesz też użyć adresu siedziby banku.",
      questions: recipientQuestions("Bank"),
    },
    {
      id: "transactions",
      title: "Rachunek i transakcje",
      questions: [
        {
          id: "transaction_type",
          label: "Jakich transakcji dotyczy reklamacja?",
          type: "radio",
          help: "Jeśli było kilka rodzajów, wybierz ten, który dotyczy największej kwoty, a resztę wypisz w liście transakcji.",
          options: [
            { value: "card", label: "Płatności lub wypłaty kartą" },
            { value: "transfer", label: "Przelewy z bankowości internetowej lub aplikacji" },
            { value: "blik", label: "Transakcje BLIK (płatności, wypłaty, przelewy na telefon)" },
          ],
        },
        {
          id: "account_last4",
          label: "Ostatnie 4 cyfry numeru rachunku lub karty",
          type: "text",
          placeholder: "1234",
          help: "Wystarczą ostatnie cyfry – nie podawaj pełnego numeru karty.",
          validate: { pattern: "^\\d{4}$", maxLength: 4 },
        },
        {
          id: "transactions",
          label: "Lista kwestionowanych transakcji",
          type: "textarea",
          placeholder: "12.10.2026, 2 500,00 zł, przelew na rachunek PL…\n12.10.2026, 1 000,00 zł, wypłata BLIK z bankomatu",
          help: "Każda transakcja w osobnej linii: data, kwota, odbiorca lub miejsce. Dane znajdziesz w historii rachunku.",
          validate: { maxLength: 2000 },
        },
        {
          id: "total_amount",
          label: "Łączna kwota nieautoryzowanych transakcji",
          type: "money",
          placeholder: "3500.00",
        },
        {
          id: "first_debit_date",
          label: "Data obciążenia rachunku (pierwszej transakcji)",
          type: "date",
          help: "Od tej daty liczy się 13 miesięcy na zgłoszenie – po tym terminie roszczenia wygasają.",
        },
        {
          id: "noticed_date",
          label: "Kiedy zauważono transakcje?",
          type: "date",
          help: "Np. dzień, w którym przyszło powiadomienie z banku albo sprawdzono historię rachunku.",
        },
      ],
    },
    {
      id: "circumstances",
      title: "Jak do tego doszło",
      description: "Opisz fakty rzeczowo. Bycie ofiarą oszustwa nie oznacza automatycznie „rażącego niedbalstwa” – to bank musi je udowodnić.",
      questions: [
        {
          id: "cause",
          label: "Co się stało?",
          type: "radio",
          options: [
            { value: "card_lost", label: "Karta lub telefon zostały zgubione albo skradzione" },
            { value: "phishing", label: "Dane zostały wyłudzone przez fałszywą stronę, SMS lub e-mail (phishing)" },
            { value: "vishing", label: "Telefon od rzekomego pracownika banku, Policji lub innej instytucji" },
            { value: "remote_access", label: "Na prośbę oszustów zainstalowano aplikację do zdalnego dostępu" },
            { value: "unknown", label: "Nie wiem – nikomu nie udostępniano danych ani karty" },
          ],
          help: "Od odpowiedzi zależy, jakie argumenty prawne znajdą się w piśmie.",
        },
        {
          id: "confirmed_in_app",
          label: "Czy transakcje zostały potwierdzone w aplikacji lub kodem SMS?",
          type: "radio",
          showIf: { questionId: "cause", equals: ["phishing", "vishing", "remote_access"] },
          options: [
            { value: "no", label: "Nie" },
            { value: "yes_misled", label: "Tak, ale pod wpływem oszustów – bez wiedzy, że chodzi o przelew dla obcej osoby" },
            { value: "unknown", label: "Nie wiem" },
          ],
          help: "Odpowiedz zgodnie z prawdą – bank zna historię logowań i potwierdzeń.",
        },
        {
          id: "description",
          label: "Opis zdarzenia",
          type: "textarea",
          placeholder:
            "np. 12.10.2026 r. około 14:00 zadzwoniła osoba przedstawiająca się jako pracownik działu bezpieczeństwa banku. Numer wyświetlał się jako infolinia banku. Rozmówca twierdził, że trwa atak na rachunek…",
          help: "Chronologicznie: co się wydarzyło, kiedy, kto się kontaktował, jakie dane podano. Każdą myśl w osobnej linii.",
          validate: { maxLength: 2000 },
        },
        {
          id: "police_report",
          label: "Czy sprawa została zgłoszona Policji?",
          type: "radio",
          help: "Zgłoszenie na Policji nie jest warunkiem zwrotu, ale wzmacnia reklamację.",
          options: [
            { value: "yes", label: "Tak" },
            { value: "planned", label: "Jeszcze nie, ale zostanie zgłoszona" },
            { value: "no", label: "Nie" },
          ],
        },
        {
          id: "police_details",
          label: "Jednostka Policji, data i numer sprawy (opcjonalnie)",
          type: "text",
          required: false,
          placeholder: "np. KRP Warszawa I, 13.10.2026 r., RSD-1234/26",
          showIf: { questionId: "police_report", equals: "yes" },
          validate: { maxLength: 150 },
        },
      ],
    },
    {
      id: "bank",
      title: "Zgłoszenie w banku",
      questions: [
        {
          id: "bank_report_date",
          label: "Data zgłoszenia transakcji w banku",
          type: "date",
          help: "Dzień, w którym zgłoszono sprawę na infolinii, w oddziale lub w aplikacji (np. przy blokadzie karty). Jeśli to pismo jest pierwszym zgłoszeniem – data jego wysłania.",
        },
        {
          id: "bank_report_number",
          label: "Numer zgłoszenia lub reklamacji (opcjonalnie)",
          type: "text",
          required: false,
          placeholder: "np. REK/2026/10/12345",
          validate: { maxLength: 60 },
        },
        {
          id: "bank_response",
          label: "Czy bank już odpowiedział?",
          type: "radio",
          help: "Jeśli bank odmówił, przygotujemy ponowną reklamację (odwołanie) z odpowiedzią na jego argumenty.",
          options: [
            { value: "none", label: "Nie – to pierwsza reklamacja albo bank jeszcze nie odpowiedział" },
            { value: "refused", label: "Tak – bank odmówił zwrotu" },
          ],
        },
        {
          id: "refusal_date",
          label: "Data odpowiedzi banku",
          type: "date",
          help: "Data pisma lub wiadomości, w której bank odmówił zwrotu.",
          showIf: { questionId: "bank_response", equals: "refused" },
        },
        {
          id: "bank_refusal_reason",
          label: "Jak bank uzasadnił odmowę?",
          type: "textarea",
          required: false,
          placeholder: "np. transakcje zostały prawidłowo uwierzytelnione w aplikacji mobilnej, a klient dopuścił się rażącego niedbalstwa",
          showIf: { questionId: "bank_response", equals: "refused" },
          validate: { maxLength: 1500 },
        },
        {
          id: "other_attachments",
          label: "Załączniki (opcjonalnie)",
          type: "text",
          required: false,
          placeholder: "np. wyciąg z historii rachunku; potwierdzenie zgłoszenia na Policji; zrzuty ekranu SMS-ów",
          help: "Kilka pozycji oddziel średnikami.",
        },
        {
          id: "send_date",
          label: "Kiedy wyślesz reklamację? (opcjonalnie)",
          type: "date",
          required: false,
          help: "Policzymy orientacyjnie, do kiedy bank powinien odpowiedzieć.",
        },
      ],
    },
  ],
  legalBasis: [
    {
      act: "Ustawa z dnia 19 sierpnia 2011 r. o usługach płatniczych",
      article: "art. 40 ust. 1, art. 45",
      summary:
        "Transakcja jest autoryzowana tylko wtedy, gdy wyrażono na nią zgodę; to bank musi udowodnić autoryzację, a samo użycie karty, aplikacji czy kodu nie wystarcza.",
      url: ISAP_UUP,
    },
    {
      act: "Ustawa z dnia 19 sierpnia 2011 r. o usługach płatniczych",
      article: "art. 46 ust. 1",
      summary:
        "Bank zwraca kwotę nieautoryzowanej transakcji najpóźniej do końca następnego dnia roboczego po zgłoszeniu (D+1).",
      url: ISAP_UUP,
    },
    {
      act: "Ustawa z dnia 19 sierpnia 2011 r. o usługach płatniczych",
      article: "art. 46 ust. 2–4a",
      summary:
        "Przy kradzieży lub utracie karty odpowiadasz najwyżej do 50 euro, w pełni – tylko przy winie umyślnej lub rażącym niedbalstwie; po zgłoszeniu nie odpowiadasz wcale.",
      url: ISAP_UUP,
    },
    {
      act: "Ustawa z dnia 19 sierpnia 2011 r. o usługach płatniczych",
      article: "art. 42, art. 44",
      summary:
        "Zgłoś nieautoryzowaną transakcję niezwłocznie – najpóźniej w ciągu 13 miesięcy od obciążenia rachunku, inaczej roszczenia wygasają.",
      url: ISAP_UUP,
    },
    {
      act: "Ustawa z dnia 19 sierpnia 2011 r. o usługach płatniczych",
      article: "art. 15a",
      summary: "Bank odpowiada na reklamację w 15 dni roboczych, a w skomplikowanych sprawach najpóźniej w 35 dni roboczych.",
      url: ISAP_UUP,
    },
    {
      act: "Ustawa z dnia 5 sierpnia 2015 r. o rozpatrywaniu reklamacji przez podmioty rynku finansowego, o Rzeczniku Finansowym i o Funduszu Edukacji Finansowej",
      article: "art. 8, art. 17, art. 36–38",
      summary:
        "Brak odpowiedzi w terminie oznacza uznanie reklamacji; po odmowie możesz złożyć wniosek do Rzecznika Finansowego.",
      url: ISAP_REKL,
    },
  ],
  deadlines: [
    {
      id: "report_13m",
      label: "Ostateczny termin zgłoszenia nieautoryzowanej transakcji",
      fromQuestionId: "first_debit_date",
      months: 13,
      description:
        "Jeśli nie zgłosisz nieautoryzowanej transakcji w ciągu 13 miesięcy od obciążenia rachunku, Twoje roszczenia wobec banku wygasają (art. 44 ust. 2 u.u.p.). Zgłoszenia trzeba jednak dokonać niezwłocznie po zauważeniu transakcji.",
    },
    {
      id: "refund_d1",
      label: "Zwrot pieniędzy przez bank (D+1)",
      fromQuestionId: "bank_report_date",
      days: 1,
      description:
        "Bank powinien zwrócić kwotę nieautoryzowanej transakcji do końca dnia roboczego następującego po dniu zgłoszenia (art. 46 ust. 1 u.u.p.). Jeśli zgłoszenie było w piątek lub przed świętem, termin przesuwa się na najbliższy dzień roboczy. Wyjątek: bank może wstrzymać zwrot, gdy ma udokumentowane podejrzenie oszustwa ze strony klienta i pisemnie zawiadomi organy ścigania.",
    },
    {
      id: "bank_answer",
      label: "Orientacyjny termin odpowiedzi banku na reklamację",
      fromQuestionId: "send_date",
      days: 21,
      description:
        "Bank ma 15 dni roboczych od otrzymania reklamacji (art. 15a ust. 2 u.u.p.) – zwykle ok. 3 tygodni; w szczególnie skomplikowanych sprawach najwyżej 35 dni roboczych. Data jest orientacyjna: dolicz czas doręczenia i święta.",
    },
  ],
  instructions: {
    whereToSend: `Reklamację składasz do **banku (dostawcy usług płatniczych), który prowadzi Twój rachunek lub wydał kartę** – nie do banku odbiorcy przelewu.

- Adres i formularz reklamacyjny znajdziesz na stronie banku (zakładka „Reklamacje”) i w regulaminie rachunku.
- Możesz złożyć reklamację w każdej placówce obsługującej klientów, przez bankowość elektroniczną, listownie albo na adres do doręczeń elektronicznych banku.
- **Zanim wyślesz pismo**: natychmiast zablokuj kartę i dostęp do bankowości (infolinia, aplikacja) – po zgłoszeniu nie odpowiadasz za kolejne transakcje.`,
    howToSend: `Najszybciej: **przez bankowość internetową lub aplikację** (formularz reklamacji – wklej treść pisma albo dołącz PDF) albo **w oddziale** – poproś o potwierdzenie przyjęcia z datą.

Możesz też wysłać pismo **listem poleconym za potwierdzeniem odbioru**. Zachowaj dowód nadania – od daty otrzymania reklamacji liczy się termin odpowiedzi.

Dołącz kopie dokumentów: historię rachunku z zaznaczonymi transakcjami, potwierdzenie zgłoszenia na Policji, zrzuty ekranu wiadomości od oszustów.`,
    afterSending: `Bank ma **15 dni roboczych** na odpowiedź (w skomplikowanych sprawach najwyżej **35 dni roboczych** – musi wtedy wyjaśnić przyczynę opóźnienia). Kwotę nieautoryzowanej transakcji powinien zwrócić **do końca następnego dnia roboczego po zgłoszeniu**, chyba że ma udokumentowane podejrzenie oszustwa z Twojej strony i zawiadomi o tym organy ścigania.

Jeśli bank odmówi:
- złóż **wniosek do Rzecznika Finansowego** (interwencja bezpłatna, postępowanie polubowne – 50 zł) przez formularz na rf.gov.pl,
- możesz skorzystać z **Arbitra Bankowego przy Związku Banków Polskich** (pozasądowe rozwiązywanie sporów konsumenckich z bankami – sprawdź aktualne warunki i limity na stronie ZBP),
- złóż **skargę do Komisji Nadzoru Finansowego** na działanie banku,
- rozważ **pozew do sądu** – w sprawie o zwrot pieniędzy to bank musi udowodnić autoryzację transakcji.`,
    checklist: [
      "Zablokuj kartę i dostęp do bankowości, zanim zajmiesz się pismem.",
      "Wypisz wszystkie kwestionowane transakcje z datami i kwotami (z historii rachunku).",
      "Zgłoś sprawę na Policji i zachowaj potwierdzenie z numerem sprawy.",
      "Sprawdź, czy od obciążenia rachunku nie minęło 13 miesięcy.",
      "Podpisz reklamację i zachowaj potwierdzenie jej złożenia z datą.",
      "Zanotuj datę, w której mija 15 dni roboczych na odpowiedź banku.",
    ],
  },
  seo: {
    title: "Reklamacja do banku – nieautoryzowana transakcja wzór",
    metaDescription:
      "Wzór reklamacji nieautoryzowanej transakcji: kradzież karty, phishing, oszustwo na BLIK. Zwrot D+1, ciężar dowodu na banku. Generator pisma.",
    h1: "Reklamacja nieautoryzowanej transakcji – wzór pisma do banku",
    intro:
      "Ktoś wyczyścił Ci konto po kradzieży karty, fałszywym SMS-ie albo telefonie od „pracownika banku”? Odpowiedz na kilka pytań, a przygotujemy reklamację z żądaniem zwrotu pieniędzy, przepisami ustawy o usługach płatniczych i odpowiedzią na zarzut rażącego niedbalstwa. Pismo pobierzesz jako DOCX lub PDF.",
    keywords: [
      "nieautoryzowana transakcja reklamacja",
      "reklamacja do banku wzór",
      "zwrot pieniędzy oszustwo bank",
      "kradzież karty zwrot pieniędzy",
      "oszustwo blik zwrot pieniędzy",
      "rażące niedbalstwo bank",
      "phishing bank zwrot środków",
    ],
    guide: [
      {
        heading: "Kiedy bank musi oddać pieniądze",
        body: `Nieautoryzowana transakcja to taka, na którą **nie wyrażono zgody** w sposób przewidziany w umowie z bankiem (art. 40 ust. 1 ustawy o usługach płatniczych). Chodzi m.in. o płatności skradzioną kartą, przelewy wykonane przez oszustów po przejęciu dostępu do bankowości, wypłaty BLIK, których nikt z rodziny nie zlecał.

Zasada jest prosta i korzystna dla klienta: **bank zwraca pieniądze niezwłocznie – najpóźniej do końca następnego dnia roboczego po zgłoszeniu** (art. 46 ust. 1). Odmówić natychmiastowego zwrotu może tylko wtedy, gdy ma udokumentowane podejrzenie oszustwa ze strony klienta i pisemnie zawiadomi o tym prokuraturę lub Policję.

Co ważne, to **bank musi udowodnić**, że transakcja była autoryzowana, a samo zarejestrowanie użycia karty, aplikacji czy kodu BLIK **nie wystarcza** (art. 45 ust. 2). Bank musi też udowodnić, że klient działał umyślnie lub z rażącym niedbalstwem.`,
      },
      {
        heading: "Co zrobić krok po kroku",
        body: `1. **Zablokuj kartę i dostęp do bankowości** – przez infolinię lub aplikację. Od chwili zgłoszenia nie odpowiadasz za kolejne transakcje (art. 46 ust. 4).
2. **Zgłoś nieautoryzowane transakcje w banku** – telefonicznie, w aplikacji lub w oddziale. Zapisz numer zgłoszenia i godzinę.
3. **Zawiadom Policję** – to nie warunek zwrotu, ale numer sprawy wzmacnia Twoją pozycję i pomaga w odzyskaniu pieniędzy od odbiorcy.
4. **Złóż pisemną reklamację** – nasz generator wpisze w nią żądanie zwrotu D+1, przypomnienie o ciężarze dowodu i sprzeciw wobec zarzutu rażącego niedbalstwa.
5. **Zbierz dowody** – historię rachunku, zrzuty ekranu SMS-ów i stron, billing połączeń.
6. **Pilnuj terminów** – bank ma 15 dni roboczych na odpowiedź.`,
      },
      {
        heading: "Phishing, BLIK, „na pracownika banku” – czy to rażące niedbalstwo?",
        body: `Banki często odmawiają zwrotu, twierdząc, że klient dopuścił się **rażącego niedbalstwa** – bo kliknął w link, podał kod BLIK albo zainstalował aplikację do zdalnego pulpitu. Tymczasem:

- rażące niedbalstwo to **kwalifikowana postać winy** – naruszenie elementarnych zasad ostrożności, a nie każda nieostrożność,
- oszustwa „na pracownika banku” czy „na policjanta” są przygotowane profesjonalnie: fałszywy numer infolinii na wyświetlaczu, znajomość danych klienta, presja czasu,
- **ciężar dowodu rażącego niedbalstwa spoczywa na banku** (art. 45 ust. 2), a nie na kliencie,
- jeśli bank nie stosował **silnego uwierzytelniania**, klient nie odpowiada za transakcję, chyba że działał umyślnie (art. 46 ust. 4a).

Przy kradzieży lub zgubieniu karty odpowiadasz co najwyżej do równowartości **50 euro** (art. 46 ust. 2), a nie za całą kwotę. Opisz zdarzenie zgodnie z prawdą – bank zna logi, a niespójności osłabiają reklamację.`,
      },
      {
        heading: "Terminy: D+1, 15 dni roboczych, 13 miesięcy",
        body: `- **Niezwłocznie** – nieautoryzowaną transakcję zgłaszasz od razu po jej zauważeniu (art. 44 ust. 1 i art. 42 ust. 1 pkt 2).
- **13 miesięcy** od obciążenia rachunku – po tym terminie roszczenia wobec banku wygasają (art. 44 ust. 2).
- **D+1** – bank zwraca kwotę do końca następnego dnia roboczego po zgłoszeniu (art. 46 ust. 1), z datą waluty z dnia obciążenia, czyli tak, jakby transakcji nie było.
- **15 dni roboczych** na odpowiedź na reklamację dotyczącą usług płatniczych (art. 15a ust. 2), a w skomplikowanych sprawach najwyżej 35 dni roboczych.
- Ustawa o rozpatrywaniu reklamacji przewiduje, że niedotrzymanie terminu odpowiedzi oznacza rozpatrzenie reklamacji zgodnie z wolą klienta (art. 8).`,
      },
      {
        heading: "Co zrobić, gdy bank odmówi zwrotu",
        body: `Odmowa banku nie kończy sprawy. Masz kilka dróg, z których większość jest bezpłatna:

- **Rzecznik Finansowy** – wniosek o interwencję jest bezpłatny, a postępowanie polubowne kosztuje 50 zł. Warunek: wcześniej złożona reklamacja w banku. Rzecznik regularnie zajmuje się sprawami oszustw „na pracownika banku”.
- **Arbiter Bankowy przy ZBP** – pozasądowe rozstrzyganie sporów konsumentów z bankami; sprawdź aktualne warunki i limity kwotowe na stronie Związku Banków Polskich.
- **Komisja Nadzoru Finansowego** – skarga na działanie banku (nie rozstrzyga sporu o pieniądze, ale bank musi się wytłumaczyć).
- **Miejski lub powiatowy rzecznik konsumentów** – bezpłatna pomoc, może wystąpić do banku w Twoim imieniu.
- **Sąd** – w procesie o zwrot pieniędzy bank musi wykazać autoryzację i Twoje rażące niedbalstwo. Przy kwotach do 20 000 zł sprawa toczy się w postępowaniu uproszczonym.`,
      },
      {
        heading: "Najczęstsze błędy",
        body: `- **Zwlekanie ze zgłoszeniem** – każda godzina to ryzyko kolejnych transakcji i argument dla banku. Zgłaszaj od razu, nawet w nocy (infolinia).
- **Brak pisemnej reklamacji** – rozmowa na infolinii to za mało, gdy bank nie oddaje pieniędzy. Złóż reklamację na piśmie lub w aplikacji i zachowaj potwierdzenie.
- **Przyznawanie się do „niedbalstwa”** – opisuj fakty, nie oceniaj własnego zachowania. Ocena należy do banku, który musi ją udowodnić.
- **Podawanie pełnego numeru karty w piśmie** – wystarczą ostatnie cyfry.
- **Godzenie się na „ugodę” na część kwoty** bez sprawdzenia, czy należy się całość.`,
      },
    ],
    faq: [
      {
        question: "W jakim terminie bank musi oddać pieniądze za nieautoryzowaną transakcję?",
        answer:
          "Niezwłocznie, nie później niż do końca dnia roboczego następującego po dniu zgłoszenia (art. 46 ust. 1 ustawy o usługach płatniczych). Wyjątek: bank ma uzasadnione i udokumentowane podejrzenie oszustwa ze strony klienta i pisemnie zawiadamia o tym organy ścigania.",
      },
      {
        question: "Czy bank może odmówić zwrotu, bo transakcja została potwierdzona w aplikacji?",
        answer:
          "Samo zarejestrowanie użycia instrumentu płatniczego (aplikacji, kodu, karty) nie wystarcza do udowodnienia autoryzacji ani rażącego niedbalstwa (art. 45 ust. 2). Jeśli potwierdzenie zostało wyłudzone podstępem, bez wiedzy, że chodzi o przelew dla oszustów, warto to wyraźnie opisać w reklamacji.",
      },
      {
        question: "Ile maksymalnie stracę po kradzieży karty?",
        answer:
          "Za transakcje wykonane skradzioną lub zgubioną kartą przed zgłoszeniem odpowiadasz do równowartości 50 euro. W pełnej wysokości – tylko przy działaniu umyślnym lub rażącym niedbalstwie, co musi udowodnić bank. Po zgłoszeniu nie odpowiadasz wcale.",
      },
      {
        question: "Ile czasu mam na zgłoszenie nieautoryzowanej transakcji?",
        answer:
          "Zgłoszenia trzeba dokonać niezwłocznie, a ostateczna granica to 13 miesięcy od dnia obciążenia rachunku. Po tym terminie roszczenia wobec banku wygasają (art. 44 ust. 2 ustawy o usługach płatniczych).",
      },
      {
        question: "Ile czasu ma bank na odpowiedź na reklamację?",
        answer:
          "15 dni roboczych od otrzymania reklamacji, a w szczególnie skomplikowanych sprawach najwyżej 35 dni roboczych – bank musi wtedy wyjaśnić przyczynę opóźnienia i podać przewidywany termin.",
      },
      {
        question: "Czy muszę zgłosić sprawę na Policję, żeby bank oddał pieniądze?",
        answer:
          "Przepisy nie uzależniają zwrotu od zawiadomienia Policji. Zgłoszenie jest jednak zalecane – dokumentuje przestępstwo, może pomóc zablokować środki u odbiorcy i wzmacnia Twoją wiarygodność w sporze z bankiem.",
      },
      {
        question: "Co zrobić, gdy bank odrzuci reklamację?",
        answer:
          "Złóż wniosek do Rzecznika Finansowego (interwencja jest bezpłatna), rozważ Arbitra Bankowego przy ZBP albo pozew do sądu. W sądzie to bank musi udowodnić, że transakcja była autoryzowana albo że klient działał umyślnie lub z rażącym niedbalstwem.",
      },
    ],
  },
  ai: {
    context:
      "Reklamacja konsumenta do banku w sprawie nieautoryzowanych transakcji płatniczych (karta, przelew w bankowości elektronicznej, BLIK). Opis faktów ma chronologicznie przedstawić: jak doszło do zdarzenia (kradzież lub utrata karty, wyłudzenie danych przez fałszywą stronę lub SMS, telefon od osoby podszywającej się pod bank lub Policję, zdalny pulpit), jakie transakcje zostały wykonane, kiedy je zauważono, kiedy zgłoszono bankowi i Policji oraz – jeśli bank już odmówił – czym uzasadnił odmowę. Podkreślaj fakty świadczące o działaniu w dobrej wierze i o profesjonalnym charakterze oszustwa, ale niczego nie dodawaj ani nie zmieniaj względem odpowiedzi użytkownika. Żądanie: zwrot łącznej kwoty i przywrócenie rachunku do stanu sprzed transakcji. Pisz w pierwszej osobie, w czasie teraźniejszym lub stronie biernej, bez form zależnych od płci. Nie powołuj przepisów ani terminów – szablon dodaje je sam.",
    factQuestionIds: [
      "transaction_type",
      "transactions",
      "total_amount",
      "first_debit_date",
      "noticed_date",
      "cause",
      "confirmed_in_app",
      "description",
      "police_report",
      "bank_report_date",
      "bank_response",
      "refusal_date",
      "bank_refusal_reason",
    ],
  },
  render: ({ answers, ai, today }) => {
    const email = str(answers, "sender_email", "");
    const phone = str(answers, "sender_phone", "");
    const last4 = str(answers, "account_last4", "____");
    const type = str(answers, "transaction_type", "transfer");
    const refused = str(answers, "bank_response", "none") === "refused";
    const total = num(answers, "total_amount");
    const reportNo = str(answers, "bank_report_number", "");
    const txLines = lines(str(answers, "transactions", ""));

    const paragraphs: Paragraph[] = [
      p(
        `${refused ? "Ponownie składam reklamację" : "Składam reklamację"} dotyczącą rachunku (karty) o numerze kończącym się cyframi ${last4} i zgłaszam nieautoryzowane transakcje płatnicze wykonane ${INSTRUMENT[type] ?? INSTRUMENT.transfer} na łączną kwotę ${formatMoneyPl(
          total,
        )}. Żądam zwrotu tej kwoty.`,
      ),
      p("Kwestionowane transakcje:"),
      list(txLines.length ? txLines : ["____________"]),
    ];

    if (ai?.facts) {
      paragraphs.push(...paragraphsFromText(ai.facts));
      paragraphs.push(...paragraphsFromText(ai.justification));
    } else {
      paragraphs.push(...factsParagraphs(answers));
    }

    if (ai?.demand) paragraphs.push(...paragraphsFromText(ai.demand));
    paragraphs.push(p(ai?.demand ? "W szczególności wnoszę o:" : "W związku z powyższym wnoszę o:"));
    paragraphs.push(
      list([
        `niezwłoczny zwrot kwoty ${formatMoneyPl(
          total,
        )} poprzez przywrócenie obciążonego rachunku do stanu, jaki istniałby, gdyby nieautoryzowane transakcje nie miały miejsca, z datą waluty nie późniejszą niż data obciążenia rachunku`,
        "przedstawienie informacji, na których bank opiera ewentualne stanowisko o autoryzacji transakcji – w szczególności daty i godziny transakcji, sposobu i wyniku uwierzytelnienia (w tym czy zastosowano silne uwierzytelnienie), identyfikatora urządzenia i adresu IP oraz danych odbiorcy",
        "przekazanie potwierdzenia dokonania zgłoszenia nieautoryzowanych transakcji (art. 43 ust. 1 pkt 4 u.u.p.)",
      ]),
    );

    paragraphs.push(heading("Uzasadnienie prawne"));
    paragraphs.push(...legalParagraphs(answers));

    paragraphs.push(
      p(
        `Odpowiedź proszę przesłać na adres wskazany w nagłówku${
          email ? ` lub na adres e-mail: ${email}` : ""
        }. W razie nieuwzględnienia reklamacji skieruję sprawę do Rzecznika Finansowego oraz rozważę dochodzenie roszczeń na drodze sądowej.`,
      ),
    );

    const attachments = str(answers, "other_attachments", "")
      .split(/[;\n]+/)
      .map(trimEnd)
      .filter(Boolean)
      .map((t) => t.charAt(0).toUpperCase() + t.slice(1));

    return {
      sender: partyFromAnswers(answers, "sender", [email ? `e-mail: ${email}` : "", phone ? `tel. ${phone}` : ""]),
      recipient: partyFromAnswers(answers, "recipient"),
      place: str(answers, "sender_city"),
      date: formatDatePl(today),
      title: refused
        ? "PONOWNA REKLAMACJA – NIEAUTORYZOWANE TRANSAKCJE PŁATNICZE"
        : "REKLAMACJA – NIEAUTORYZOWANE TRANSAKCJE PŁATNICZE",
      subject: `Dotyczy: rachunek (karta) nr …${last4}${reportNo ? `, zgłoszenie nr ${reportNo}` : ""}`,
      salutation: "Szanowni Państwo,",
      paragraphs: paragraphs.map(tidyParagraph),
      closing: "Z poważaniem",
      signatureName: str(answers, "sender_name"),
      attachments,
      previewParagraphCount: 3,
    };
  },
};
