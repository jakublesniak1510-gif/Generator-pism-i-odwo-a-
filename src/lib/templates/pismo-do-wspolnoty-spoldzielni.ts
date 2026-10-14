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
} from "./helpers";

/*
 * Pismo do wspólnoty mieszkaniowej / spółdzielni mieszkaniowej – 3 warianty (`letter_kind`):
 *  - documents: wniosek o udostępnienie dokumentów (u.w.l. art. 27, art. 29 ust. 3; u.s.m. art. 8¹ ust. 1; Prawo spółdzielcze),
 *  - defect: zgłoszenie usterki w części wspólnej (u.w.l. art. 14 pkt 1, art. 21 ust. 1, art. 22; u.s.m. art. 4; Prawo budowlane art. 61 pkt 1),
 *  - settlement: zastrzeżenia do rozliczenia mediów / opłat (u.w.l. art. 12 ust. 2, art. 29 ust. 3; u.s.m. art. 4, art. 8¹).
 * Numery: art. 18 § 2 pkt 3 Prawa spółdzielczego, art. 4 ust. 6⁴/ust. 7 u.s.m., art. 4 ust. 1¹ u.s.m. – [DO WERYFIKACJI],
 * w piśmie wyłącznie ogólne odesłanie do ustawy. Szczegóły: docs/legal-review/pismo-do-wspolnoty-spoldzielni.md
 *
 * UWAGA (filtr AI): guard odrzuca tekst AI zawierający „uchwał” – lista dokumentów (często z uchwałami)
 * jest zawsze wstawiana deterministycznie i nie trafia do promptu AI.
 */

const UWL = "ustawy z dnia 24 czerwca 1994 r. o własności lokali";
const USM = "ustawy z dnia 15 grudnia 2000 r. o spółdzielniach mieszkaniowych";

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

function lines(text: string | undefined): string[] {
  if (!text) return [];
  return text
    .split(/\r?\n|;/)
    .map((l) => l.replace(/^\s*(?:[-–•*]|\d+[.)])\s*/, "").replace(/\s+/g, " ").replace(/[,;]$/, "").trim())
    .filter(Boolean);
}

type Kind = "documents" | "defect" | "settlement";

function kindOf(answers: Answers): Kind {
  const v = str(answers, "letter_kind", "documents");
  return v === "defect" || v === "settlement" ? v : "documents";
}

const isCoop = (answers: Answers) => str(answers, "entity_type", "") === "cooperative";
const isTenant = (answers: Answers) => str(answers, "legal_title", "") === "tenant";

function titleNoun(answers: Answers): string {
  switch (str(answers, "legal_title", "")) {
    case "coop_ownership":
      return "osoba, której przysługuje spółdzielcze własnościowe prawo do lokalu";
    case "coop_tenant":
      return "osoba, której przysługuje spółdzielcze lokatorskie prawo do lokalu";
    case "tenant":
      return "najemca lokalu";
    default:
      return "właściciel lokalu";
  }
}

/** „rozliczenie wody za 2025 r.” → „wody za 2025 r.” (unikamy „rozliczenia: rozliczenie …”). */
function settlementPeriod(answers: Answers): string {
  return str(answers, "settlement_period").replace(/^rozliczeni[ea]\s+/i, "");
}

function responseDays(answers: Answers): string {
  return str(answers, "response_days", "14");
}

function introParagraph(answers: Answers, kind: Kind): Paragraph {
  const who = `Jako ${titleNoun(answers)} położonego pod adresem: ${str(answers, "unit_address")},`;
  const entityGen = isCoop(answers) ? "Spółdzielni" : "wspólnoty mieszkaniowej";
  switch (kind) {
    case "documents":
      return p(`${who} zwracam się z ${isTenant(answers) ? "prośbą" : "wnioskiem"} o udostępnienie następujących dokumentów ${entityGen}:`);
    case "defect":
      return p(
        `${who} zgłaszam usterkę w ${isCoop(answers) ? "nieruchomości zarządzanej przez Spółdzielnię" : "części wspólnej nieruchomości"} i wzywam do jej usunięcia.`,
      );
    default: {
      const received = dateAnswer(answers, "settlement_received_date");
      return p(
        `${who} zgłaszam zastrzeżenia do rozliczenia ${settlementPeriod(answers)}${received ? `, doręczonego mi w dniu ${formatDatePl(received)},` : ""} i wnoszę o jego wyjaśnienie oraz korektę.`,
      );
    }
  }
}

function factsParagraphs(answers: Answers, kind: Kind): Paragraph[] {
  const description = str(answers, "facts_description", "");
  const extra = description ? userParagraphs(description) : [];
  if (kind === "documents") {
    if (isTenant(answers)) {
      return [
        p(
          "Zapoznanie się z tymi dokumentami jest mi potrzebne do weryfikacji opłat i świadczeń związanych z zajmowanym przeze mnie lokalem, dlatego proszę o ich udostępnienie co najmniej w tym zakresie.",
        ),
        ...extra,
      ];
    }
    return extra.length
      ? extra
      : [
          p(
            "Zapoznanie się z tymi dokumentami jest mi niezbędne do oceny sposobu zarządzania nieruchomością oraz wydatkowania środków pochodzących z wnoszonych przeze mnie opłat.",
          ),
        ];
  }
  if (kind === "defect") {
    const since = dateAnswer(answers, "defect_since");
    const prior = str(answers, "defect_previous_reports", "");
    const parts = [sentence(str(answers, "defect_description"))];
    if (since) parts.push(`Problem występuje od dnia ${dot(formatDatePl(since))}`);
    if (prior) {
      const priorText = prior.replace(/\s+/g, " ").replace(/[;,]$/, "").replace(/(?<! r)\.$/, "");
      parts.push(`Usterka była już wcześniej zgłaszana (${priorText.charAt(0).toLowerCase()}${priorText.slice(1)}), jednak nie została usunięta.`);
    }
    return [p(parts.join(" ")), ...extra];
  }
  const amount = num(answers, "disputed_amount");
  const parts: string[] = [];
  if (amount !== undefined) parts.push(`Kwestionuję wynikającą z rozliczenia kwotę ${formatMoneyPl(amount)}.`);
  parts.push(sentence(str(answers, "settlement_objections")));
  return [p(parts.join(" ")), ...extra];
}

function documentsForm(answers: Answers): string {
  switch (str(answers, "access_form", "copies")) {
    case "email":
      return `w formie skanów przesłanych na adres e-mail: ${str(answers, "sender_email")}`;
    case "inspection":
      return "poprzez umożliwienie wglądu w dokumenty w siedzibie zarządu (zarządcy) w uzgodnionym terminie, z możliwością sporządzenia ich fotokopii";
    default:
      return "w formie kopii przekazanych na adres wskazany powyżej";
  }
}

function demandParagraphs(answers: Answers, kind: Kind): Paragraph[] {
  const days = responseDays(answers);
  if (kind === "documents") {
    const form = str(answers, "access_form", "copies");
    return [
      p(
        `W związku z powyższym proszę o udostępnienie wskazanych dokumentów ${documentsForm(answers)}, w terminie ${days} dni od dnia doręczenia niniejszego wniosku.${form === "inspection" ? " Proszę o wskazanie proponowanego terminu i miejsca wglądu." : " Deklaruję pokrycie uzasadnionych kosztów sporządzenia kopii, o ile zostaną mi one uprzednio wskazane."}`,
      ),
    ];
  }
  if (kind === "defect") {
    return [
      p("W związku z powyższym wzywam do:"),
      list([
        "niezwłocznego zabezpieczenia miejsca usterki, jeżeli stwarza ona zagrożenie dla bezpieczeństwa mieszkańców lub ich mienia",
        `usunięcia usterki w terminie ${days} dni od dnia doręczenia niniejszego pisma`,
        "poinformowania mnie na piśmie o podjętych działaniach oraz planowanym terminie naprawy",
      ]),
    ];
  }
  const amount = num(answers, "disputed_amount");
  return [
    p("W związku z powyższym wnoszę o:"),
    list([
      "szczegółowe wyjaśnienie sposobu wyliczenia kwestionowanych pozycji rozliczenia, ze wskazaniem przyjętych stawek, odczytów urządzeń pomiarowych i zasad podziału kosztów",
      "udostępnienie faktur dostawców mediów oraz pozostałych dokumentów stanowiących podstawę rozliczenia",
      "dokonanie korekty rozliczenia w zakresie, w jakim okaże się ono nieprawidłowe",
      `wstrzymanie dochodzenia kwestionowanej należności${amount !== undefined ? ` w kwocie ${formatMoneyPl(amount)}` : ""} do czasu rozpatrzenia niniejszych zastrzeżeń`,
    ]),
  ];
}

function legalParagraphs(answers: Answers, kind: Kind): Paragraph[] {
  const coop = isCoop(answers);
  const out: Paragraph[] = [];
  if (kind === "documents") {
    if (isTenant(answers)) {
      // Najemca nie ma ustawowego prawa kontroli zarządu – bez sekcji „Podstawa prawna” (prośba).
      return out;
    } else if (coop) {
      out.push(
        p(
          `Zgodnie z art. 8¹ ust. 1 ${USM} członek spółdzielni ma prawo otrzymania odpisu statutu i regulaminów, kopii uchwał organów spółdzielni i protokołów obrad tych organów, protokołów lustracji, rocznych sprawozdań finansowych oraz faktur i umów zawieranych przez spółdzielnię z osobami trzecimi. Uprawnienia członka do zapoznawania się z dokumentami spółdzielni przewidują również przepisy ustawy z dnia 16 września 1982 r. – Prawo spółdzielcze.`,
        ),
      );
    } else {
      out.push(
        p(
          `Zgodnie z art. 27 ${UWL} każdy właściciel lokalu ma prawo i obowiązek współdziałania w zarządzie nieruchomością wspólną, a na podstawie art. 29 ust. 3 tej ustawy właściciele lokali sprawują kontrolę działalności zarządu. Uprawnienie to obejmuje prawo zapoznania się z dokumentami dotyczącymi zarządu nieruchomością wspólną, w tym z uchwałami, umowami, fakturami i rozliczeniami.`,
        ),
      );
    }
    return out;
  }
  if (kind === "defect") {
    out.push(
      coop
        ? p(
            `Spółdzielnia zarządza nieruchomością, a koszty jej eksploatacji i utrzymania pokrywane są z opłat wnoszonych przez osoby uprawnione do lokali, zgodnie z art. 4 ${USM}. Na Spółdzielni ciąży zatem obowiązek bieżącej konserwacji i usuwania usterek w częściach nieruchomości służących wszystkim mieszkańcom.`,
          )
        : p(
            `Zgodnie z art. 21 ust. 1 ${UWL} zarząd kieruje sprawami wspólnoty mieszkaniowej, a czynności zwykłego zarządu – do których należą bieżąca konserwacja i usuwanie usterek w częściach wspólnych nieruchomości – podejmuje samodzielnie (art. 22 tej ustawy). Wydatki na remonty i bieżącą konserwację stanowią koszty zarządu nieruchomością wspólną (art. 14 pkt 1 tej ustawy).`,
          ),
    );
    out.push(
      p(
        "Ponadto zgodnie z art. 61 pkt 1 w związku z art. 5 ust. 2 ustawy z dnia 7 lipca 1994 r. – Prawo budowlane właściciel lub zarządca obiektu budowlanego jest obowiązany utrzymywać obiekt w należytym stanie technicznym i estetycznym, nie dopuszczając do nadmiernego pogorszenia jego właściwości użytkowych i sprawności technicznej.",
      ),
    );
    return out;
  }
  out.push(
    coop
      ? p(
          `Zgodnie z przepisami ${USM} osoby uprawnione do lokali uczestniczą w pokrywaniu kosztów eksploatacji i utrzymania nieruchomości oraz kosztów dostawy mediów (art. 4 tej ustawy), a zmiana wysokości opłat wymaga uzasadnienia na piśmie. Na podstawie art. 8¹ ust. 1 tej ustawy członek spółdzielni ma prawo otrzymania kopii faktur i umów zawieranych przez spółdzielnię z osobami trzecimi, w tym z dostawcami mediów.`,
        )
      : p(
          `Zgodnie z art. 12 ust. 2 ${UWL} właściciele lokali ponoszą wydatki i ciężary związane z utrzymaniem nieruchomości wspólnej w stosunku do swoich udziałów, w części niepokrytej pożytkami i innymi przychodami. Na podstawie art. 27 i art. 29 ust. 3 tej ustawy właściciel lokalu ma prawo kontroli działalności zarządu, w tym prawo zapoznania się z dokumentami stanowiącymi podstawę rozliczeń, takimi jak faktury dostawców mediów i odczyty urządzeń pomiarowych.`,
        ),
  );
  return out;
}

function closingParagraph(answers: Answers, kind: Kind): Paragraph {
  const days = responseDays(answers);
  const coop = isCoop(answers);
  const base = `Proszę o pisemną odpowiedź w terminie ${days} dni od dnia doręczenia niniejszego pisma.`;
  if (kind === "defect") {
    return p(
      `${base} W razie bezskutecznego upływu tego terminu zastrzegam sobie prawo zawiadomienia powiatowego inspektora nadzoru budowlanego o stanie technicznym budynku oraz dochodzenia naprawienia ewentualnej szkody.`,
    );
  }
  return p(
    `${base} W razie odmowy lub braku odpowiedzi ${coop ? "zwrócę się do rady nadzorczej Spółdzielni, a w dalszej kolejności rozważę dochodzenie swoich praw na drodze sądowej" : "przedstawię sprawę na najbliższym zebraniu właścicieli lokali, a w dalszej kolejności rozważę dochodzenie swoich praw na drodze sądowej"}.`,
  );
}

export const pismoDoWspolnoty: LetterTemplate = {
  slug: "pismo-do-wspolnoty-spoldzielni",
  name: "Pismo do wspólnoty lub spółdzielni",
  category: "mieszkanie",
  shortDescription:
    "Wniosek o dokumenty, zgłoszenie usterki w części wspólnej lub zastrzeżenia do rozliczenia mediów – do zarządu wspólnoty albo spółdzielni.",
  priceGrosze: 2499,
  icon: "🏢",
  estimatedMinutes: 6,
  sections: [
    { id: "sender", title: "Twoje dane", questions: senderQuestions() },
    {
      id: "recipient",
      title: "Adresat",
      description: "Wspólnotę reprezentuje zarząd albo zarządca, któremu powierzono zarząd; spółdzielnię – zarząd spółdzielni.",
      questions: recipientQuestions("Adresat").map((q) =>
        q.id === "recipient_name"
          ? {
              ...q,
              label: "Adresat – zarząd wspólnoty, zarządca lub spółdzielnia",
              placeholder: "np. Zarząd Wspólnoty Mieszkaniowej ul. Lipowa 5 w Krakowie",
              help: "Nazwę i adres znajdziesz na tablicy ogłoszeń w budynku, w rozliczeniu opłat lub na stronie zarządcy; adres spółdzielni – także w KRS.",
            }
          : q,
      ),
    },
    {
      id: "case",
      title: "Lokal i rodzaj pisma",
      questions: [
        {
          id: "entity_type",
          label: "Do kogo piszesz?",
          type: "radio",
          options: [
            { value: "community", label: "Wspólnota mieszkaniowa (zarząd lub zarządca)" },
            { value: "cooperative", label: "Spółdzielnia mieszkaniowa" },
          ],
        },
        {
          id: "letter_kind",
          label: "Czego dotyczy pismo?",
          type: "radio",
          options: [
            { value: "documents", label: "Chcę otrzymać dokumenty (uchwały, umowy, faktury, rozliczenia)" },
            { value: "defect", label: "Zgłaszam usterkę w części wspólnej (dach, klatka, winda, piwnica, instalacje)" },
            { value: "settlement", label: "Kwestionuję rozliczenie mediów lub opłat" },
          ],
        },
        {
          id: "unit_address",
          label: "Adres Twojego lokalu",
          type: "text",
          placeholder: "ul. Lipowa 5 m. 12, 30-001 Kraków",
        },
        {
          id: "legal_title",
          label: "Jaki masz tytuł do lokalu?",
          type: "select",
          options: [
            { value: "owner", label: "Jestem właścicielem (odrębna własność lokalu)" },
            { value: "coop_ownership", label: "Spółdzielcze własnościowe prawo do lokalu" },
            { value: "coop_tenant", label: "Spółdzielcze lokatorskie prawo do lokalu" },
            { value: "tenant", label: "Jestem najemcą" },
          ],
          help: "Ustawowe prawo kontroli zarządu wspólnoty mają właściciele lokali; najemca może zgłosić usterkę, a wniosek o dokumenty ma wtedy charakter prośby.",
        },
      ],
    },
    {
      id: "details",
      title: "Szczegóły sprawy",
      questions: [
        {
          id: "documents_list",
          label: "Jakie dokumenty chcesz otrzymać?",
          type: "textarea",
          placeholder:
            "uchwały podjęte w 2025 r.\numowa z firmą sprzątającą\nfaktury za wywóz odpadów za 2025 r.\nsprawozdanie zarządu za 2025 r.",
          help: "Każdy dokument w nowej linii. Im dokładniej je opiszesz (rok, rodzaj, kontrahent), tym trudniej odmówić.",
          showIf: { questionId: "letter_kind", equals: "documents" },
        },
        {
          id: "access_form",
          label: "W jakiej formie mają być udostępnione?",
          type: "select",
          options: [
            { value: "copies", label: "Kopie papierowe na mój adres" },
            { value: "email", label: "Skany na mój adres e-mail" },
            { value: "inspection", label: "Wgląd w siedzibie zarządu (z możliwością zrobienia zdjęć)" },
          ],
          help: "Przy skanach podaj e-mail w sekcji „Twoje dane”. Zarząd może żądać zwrotu kosztów kserowania.",
          showIf: { questionId: "letter_kind", equals: "documents" },
        },
        {
          id: "defect_description",
          label: "Opisz usterkę i miejsce, w którym występuje",
          type: "textarea",
          placeholder:
            "np. Przecieka dach nad klatką schodową B – po każdym deszczu woda kapie na korytarz 4. piętra i zawilgaca ścianę mojego mieszkania.",
          help: "Napisz, gdzie dokładnie, jak się objawia i jakie szkody powoduje. Zrób zdjęcia i dołącz je do pisma.",
          showIf: { questionId: "letter_kind", equals: "defect" },
        },
        {
          id: "defect_since",
          label: "Od kiedy występuje usterka? (opcjonalnie)",
          type: "date",
          required: false,
          showIf: { questionId: "letter_kind", equals: "defect" },
        },
        {
          id: "defect_previous_reports",
          label: "Czy zgłaszałeś/aś ją wcześniej? Kiedy i jak? (opcjonalnie)",
          type: "textarea",
          required: false,
          placeholder: "np. telefonicznie do administratora 3 marca 2026 r. i e-mailem 20 marca 2026 r.",
          showIf: { questionId: "letter_kind", equals: "defect" },
        },
        {
          id: "settlement_period",
          label: "Którego rozliczenia dotyczą zastrzeżenia?",
          type: "text",
          placeholder: "np. zimnej wody i c.o. za 2025 r.",
          showIf: { questionId: "letter_kind", equals: "settlement" },
        },
        {
          id: "settlement_received_date",
          label: "Kiedy otrzymałeś/aś rozliczenie? (opcjonalnie)",
          type: "date",
          required: false,
          help: "Regulaminy rozliczeń często dają 14 lub 30 dni na zgłoszenie zastrzeżeń – policzymy termin.",
          showIf: { questionId: "letter_kind", equals: "settlement" },
        },
        {
          id: "disputed_amount",
          label: "Kwestionowana kwota (opcjonalnie)",
          type: "money",
          required: false,
          placeholder: "np. 846,20",
          showIf: { questionId: "letter_kind", equals: "settlement" },
        },
        {
          id: "settlement_objections",
          label: "Co konkretnie kwestionujesz?",
          type: "textarea",
          placeholder:
            "np. Rozliczenie przyjmuje zużycie 48 m³ wody, podczas gdy z odczytów wodomierzy z 31 grudnia 2025 r. wynika 31 m³. Nie wyjaśniono, skąd wzięła się różnica.",
          help: "Wskaż pozycje, liczby i dlaczego uważasz je za błędne (np. odczyt, stawka, metraż, liczba osób).",
          showIf: { questionId: "letter_kind", equals: "settlement" },
        },
      ],
    },
    {
      id: "demand",
      title: "Termin, uzasadnienie i załączniki",
      questions: [
        {
          id: "response_days",
          label: "Termin na odpowiedź",
          type: "select",
          options: [
            { value: "7", label: "7 dni (pilne usterki)" },
            { value: "14", label: "14 dni (najczęściej)" },
            { value: "30", label: "30 dni" },
          ],
          help: "Przepisy nie określają terminu odpowiedzi zarządu – wyznacz rozsądny, adekwatny do sprawy.",
        },
        {
          id: "facts_description",
          label: "Dodatkowe informacje (opcjonalnie)",
          type: "textarea",
          required: false,
          placeholder: "np. Na zebraniu 12 marca 2026 r. zarząd obiecał przedstawić te dokumenty, ale do dziś tego nie zrobił.",
          help: "Okoliczności, które warto opisać: wcześniejsza korespondencja, obietnice zarządu, skutki problemu.",
        },
        {
          id: "attachments_list",
          label: "Załączniki (opcjonalnie)",
          type: "textarea",
          required: false,
          placeholder: "zdjęcia usterki (4 szt.)\nkopia rozliczenia",
          help: "Każdy załącznik w nowej linii.",
        },
      ],
    },
  ],
  legalBasis: [
    {
      act: "Ustawa z dnia 24 czerwca 1994 r. o własności lokali",
      article: "art. 27 i art. 29 ust. 3",
      summary: "Właściciel lokalu współdziała w zarządzie nieruchomością wspólną i kontroluje działalność zarządu – w tym może zapoznać się z dokumentami.",
      url: "https://isap.sejm.gov.pl/isap.nsf/DocDetails.xsp?id=WDU19940850388",
    },
    {
      act: "Ustawa z dnia 24 czerwca 1994 r. o własności lokali",
      article: "art. 14 pkt 1, art. 21 ust. 1 i art. 22",
      summary: "Zarząd wspólnoty prowadzi jej sprawy i samodzielnie dokonuje czynności zwykłego zarządu, w tym bieżącej konserwacji części wspólnych.",
      url: "https://isap.sejm.gov.pl/isap.nsf/DocDetails.xsp?id=WDU19940850388",
    },
    {
      act: "Ustawa z dnia 15 grudnia 2000 r. o spółdzielniach mieszkaniowych",
      article: "art. 8¹ ust. 1",
      summary: "Członek spółdzielni może otrzymać kopie statutu, regulaminów, uchwał, protokołów, sprawozdań finansowych oraz faktur i umów spółdzielni.",
      url: "https://isap.sejm.gov.pl/isap.nsf/DocDetails.xsp?id=WDU20010040027",
    },
    {
      act: "Ustawa z dnia 15 grudnia 2000 r. o spółdzielniach mieszkaniowych",
      article: "art. 4",
      summary: "Określa zasady ponoszenia opłat za eksploatację i utrzymanie nieruchomości oraz za media w spółdzielni.",
      url: "https://isap.sejm.gov.pl/isap.nsf/DocDetails.xsp?id=WDU20010040027",
    },
    {
      act: "Ustawa z dnia 7 lipca 1994 r. – Prawo budowlane",
      article: "art. 61 pkt 1 w zw. z art. 5 ust. 2",
      summary: "Właściciel lub zarządca budynku musi utrzymywać go w należytym stanie technicznym i estetycznym.",
      url: "https://isap.sejm.gov.pl/isap.nsf/DocDetails.xsp?id=WDU19940890414",
    },
  ],
  deadlines: [
    {
      id: "settlement_complaint",
      label: "Typowy termin na zastrzeżenia do rozliczenia (14 dni)",
      fromQuestionId: "settlement_received_date",
      days: 14,
      description:
        "Ustawy nie określają terminu na zakwestionowanie rozliczenia mediów, ale regulaminy rozliczeń wspólnot i spółdzielni często przewidują 14 lub 30 dni od doręczenia rozliczenia. Sprawdź regulamin – zastrzeżenia złożone po terminie i tak warto wysłać, ale mogą zostać rozpatrzone mniej przychylnie.",
    },
  ],
  instructions: {
    whereToSend:
      "Pismo do **wspólnoty** kieruj do jej zarządu – na adres zarządcy lub administratora wskazany na tablicy ogłoszeń, w rozliczeniu opłat albo w uchwale o powierzeniu zarządu. Pismo do **spółdzielni** kieruj do zarządu spółdzielni na adres jej siedziby (sprawdzisz go w KRS lub na stronie spółdzielni). Zgłoszenie usterki możesz złożyć także w administracji osiedla, ale zawsze adresuj je do zarządu.",
    howToSend:
      "Najpewniej: **złóż pismo osobiście w biurze zarządcy lub spółdzielni** i poproś o potwierdzenie wpływu na kopii (data i pieczęć) albo wyślij je **listem poleconym za potwierdzeniem odbioru**. E-mail wystarczy, jeśli zarządca lub spółdzielnia podaje oficjalny adres do korespondencji – zachowaj wysłaną wiadomość i ewentualne potwierdzenie odczytu. Pilne awarie (zalanie, brak ogrzewania, zagrożenie dla życia) zgłaszaj najpierw telefonicznie na numer pogotowia technicznego, a pismo wyślij jako potwierdzenie.",
    afterSending:
      "Przepisy nie określają terminu odpowiedzi – obowiązuje termin wyznaczony w piśmie. Jeśli zarząd **wspólnoty** nie odpowie, możesz poruszyć sprawę na zebraniu właścicieli, zebrać podpisy innych właścicieli albo wystąpić do sądu z powództwem (np. o udostępnienie dokumentów); uchwałę naruszającą prawo lub Twoje interesy możesz zaskarżyć w ciągu 6 tygodni. W **spółdzielni** zwróć się do rady nadzorczej, a w dalszej kolejności do sądu. Przy zaniedbaniach technicznych zawiadom **powiatowego inspektora nadzoru budowlanego**, a przy sporze o opłaty możesz skorzystać z pomocy rzecznika konsumentów lub prawnika.",
    checklist: [
      "Adresat to zarząd wspólnoty, zarządca lub zarząd spółdzielni – z aktualnym adresem.",
      "Podałem/am dokładny adres lokalu i swój tytuł prawny do lokalu.",
      "Dokumenty, usterkę lub kwestionowane pozycje opisałem/am konkretnie (rok, miejsce, kwoty).",
      "Dołączam zdjęcia usterki lub kopię kwestionowanego rozliczenia.",
      "Podpisałem/am pismo i zachowuję kopię z potwierdzeniem wpływu lub nadania.",
      "Zapisałem/am w kalendarzu termin odpowiedzi.",
    ],
  },
  seo: {
    title: "Pismo do wspólnoty mieszkaniowej – wzór 2026 + generator",
    metaDescription:
      "Wniosek o dokumenty, zgłoszenie usterki lub reklamacja rozliczenia wody i ogrzewania – gotowe pismo do wspólnoty lub spółdzielni z podstawą prawną.",
    h1: "Pismo do wspólnoty mieszkaniowej lub spółdzielni – wzór i generator",
    intro:
      "Zarząd nie pokazuje uchwał i faktur, przecieka dach albo rozliczenie wody wygląda podejrzanie? Odpowiedz na kilka pytań, a przygotujemy pismo do zarządu wspólnoty lub spółdzielni z konkretnym żądaniem, terminem i przepisami, na które możesz się powołać.",
    keywords: [
      "pismo do wspólnoty mieszkaniowej wzór",
      "pismo do spółdzielni mieszkaniowej wzór",
      "wniosek o udostępnienie dokumentów wspólnoty",
      "prawo wglądu w dokumenty wspólnoty",
      "zgłoszenie usterki do administracji wzór",
      "reklamacja rozliczenia wody spółdzielnia",
      "odwołanie od rozliczenia ciepła wzór",
    ],
    guide: [
      {
        heading: "Kiedy warto napisać do wspólnoty lub spółdzielni",
        body:
          "Rozmowa z administratorem bywa skuteczna, ale tylko pismo daje dowód, że sprawa została zgłoszona i kiedy. Pisemne wystąpienie przyda się zwłaszcza w trzech sytuacjach:\n\n- **chcesz zobaczyć dokumenty** – uchwały, umowy z firmami, faktury, sprawozdania finansowe, rozliczenia funduszu remontowego;\n- **w części wspólnej jest usterka** – przeciekający dach, niedziałająca winda, zawilgocona piwnica, uszkodzone instalacje, a zarząd zwleka z naprawą;\n- **nie zgadzasz się z rozliczeniem** wody, ogrzewania lub innych opłat – np. zużycie nie zgadza się z odczytami, przyjęto zły metraż lub liczbę osób.\n\nPismo jest też podstawą dalszych kroków: skargi na zebraniu, zawiadomienia nadzoru budowlanego czy sprawy sądowej.\n\nPamiętaj, że zarząd wspólnoty i zarząd spółdzielni działają w imieniu wszystkich mieszkańców i rozliczają się z pieniędzy, które wpłacasz co miesiąc w zaliczkach i opłatach. Masz więc prawo wiedzieć, na co są wydawane, i oczekiwać, że budynek będzie utrzymany w należytym stanie. Dobrze przygotowane pismo – spokojne, konkretne, z terminem – zwykle wystarcza, by sprawa ruszyła z miejsca, a jednocześnie pokazuje, że znasz swoje prawa.",
      },
      {
        heading: "Wspólnota a spółdzielnia – jakie masz prawa",
        body:
          "**Wspólnota mieszkaniowa** działa na podstawie ustawy o własności lokali. Każdy właściciel lokalu ma prawo i obowiązek współdziałania w zarządzie nieruchomością wspólną (art. 27), a właściciele kontrolują działalność zarządu (art. 29 ust. 3). Z tych przepisów wynika prawo wglądu w dokumenty wspólnoty: uchwały, umowy, faktury i rozliczenia.\n\n**Spółdzielnia mieszkaniowa** podlega ustawie o spółdzielniach mieszkaniowych i Prawu spółdzielczemu. Członek spółdzielni ma prawo otrzymać odpis statutu i regulaminów oraz kopie uchwał, protokołów obrad organów, protokołów lustracji, rocznych sprawozdań finansowych, a także faktur i umów zawieranych przez spółdzielnię (art. 8¹ ust. 1 u.s.m.). Za kopie – poza statutem i regulaminami – spółdzielnia może pobrać opłatę odpowiadającą kosztom ich sporządzenia.\n\n**Najemca** nie jest członkiem wspólnoty ani spółdzielni – usterki zgłasza zwykle przez wynajmującego, ale może też pisać bezpośrednio do zarządcy budynku.",
      },
      {
        heading: "Jak napisać skuteczne pismo krok po kroku",
        body:
          "1. **Ustal adresata** – zarząd wspólnoty (lub zarządcę) albo zarząd spółdzielni.\n2. **Opisz sprawę konkretnie** – wymień dokumenty z datami i rodzajem, wskaż dokładne miejsce usterki, podaj kwestionowane kwoty i odczyty liczników.\n3. **Sformułuj żądanie** – czego oczekujesz: kopii, naprawy, korekty rozliczenia.\n4. **Wyznacz termin** – zwykle 14 dni; przy pilnych usterkach 7 dni.\n5. **Dołącz dowody** – zdjęcia, kopię rozliczenia, wcześniejszą korespondencję.\n6. **Złóż pismo za potwierdzeniem** – osobiście z pieczęcią wpływu na kopii albo listem poleconym.",
      },
      {
        heading: "Zgłoszenie usterki – na co zwrócić uwagę",
        body:
          "Za części wspólne budynku – dach, elewację, klatki schodowe, piwnice, piony instalacyjne, windy – odpowiada wspólnota lub spółdzielnia. Bieżąca konserwacja to czynność zwykłego zarządu, którą zarząd wspólnoty wykonuje bez zgody właścicieli, a koszty pokrywa z zaliczek na koszty zarządu. Prawo budowlane nakłada na właściciela lub zarządcę budynku obowiązek utrzymywania go w należytym stanie technicznym.\n\nW piśmie opisz, gdzie dokładnie jest usterka, od kiedy występuje i jakie szkody powoduje (np. zawilgocenie ściany w Twoim mieszkaniu). Jeśli zgłaszałeś ją wcześniej telefonicznie, podaj daty. Zrób zdjęcia – najlepiej z datą. Jeśli usterka zagraża bezpieczeństwu, a zarząd nie reaguje, możesz zawiadomić **powiatowego inspektora nadzoru budowlanego**, który może nakazać naprawę.",
      },
      {
        heading: "Rozliczenie mediów – jak je zakwestionować",
        body:
          "Najpierw porównaj rozliczenie z własnymi odczytami wodomierzy i podzielników ciepła, metrażem lokalu i liczbą zgłoszonych osób. Sprawdź regulamin rozliczeń – określa zasady podziału kosztów i często termin na zgłoszenie zastrzeżeń (zwykle 14 lub 30 dni od doręczenia rozliczenia).\n\nW piśmie wskaż konkretne pozycje i liczby, zażądaj wyjaśnienia sposobu wyliczenia oraz wglądu w faktury dostawców i protokoły odczytów. W spółdzielni zmiana wysokości opłat wymaga pisemnego uzasadnienia. Do czasu wyjaśnienia sprawy rozważ zapłatę bezspornej części należności, aby nie narazić się na odsetki – sporną kwotę możesz zapłacić z zastrzeżeniem zwrotu.\n\nNajczęstsze źródła błędów w rozliczeniach to: pomyłka przy odczycie lub przepisaniu stanu licznika, rozliczenie ryczałtem mimo działającego wodomierza, zawyżona liczba osób, błędny metraż oraz nieprawidłowy podział tzw. różnicy między wodomierzem głównym a sumą wodomierzy w lokalach. Jeśli podejrzewasz, że wodomierz lub podzielnik działa wadliwie, możesz zażądać jego sprawdzenia.",
      },
      {
        heading: "Najczęstsze błędy i co jeśli zarząd nie odpowiada",
        body:
          "- **Pismo bez konkretów** („proszę o wszystkie dokumenty”) – łatwo je zbyć; wymień dokumenty z nazwy i okresu.\n- **Brak dowodu złożenia** – zawsze miej kopię z pieczęcią wpływu lub potwierdzenie nadania.\n- **Emocjonalny ton** – zarząd chętniej reaguje na rzeczowe pismo niż na oskarżenia.\n- **Przegapienie terminu na zaskarżenie uchwały** – wynosi 6 tygodni od jej podjęcia na zebraniu albo od powiadomienia o uchwale podjętej w trybie indywidualnego zbierania głosów.\n\nJeśli zarząd milczy, poruszaj sprawę na zebraniu właścicieli lub walnym zgromadzeniu, zbierz poparcie sąsiadów, zwróć się do rady nadzorczej spółdzielni, a w ostateczności – do sądu lub nadzoru budowlanego.",
      },
    ],
    faq: [
      {
        question: "Czy wspólnota musi pokazać mi faktury i umowy?",
        answer:
          "Tak, jeśli jesteś właścicielem lokalu. Ustawa o własności lokali daje właścicielom prawo kontroli działalności zarządu (art. 29 ust. 3), a w praktyce i orzecznictwie obejmuje ono wgląd w uchwały, umowy, faktury i rozliczenia dotyczące nieruchomości wspólnej.",
      },
      {
        question: "Czy spółdzielnia może odmówić wydania kopii uchwał?",
        answer:
          "Członek spółdzielni ma ustawowe prawo otrzymać kopie uchwał organów spółdzielni, protokołów ich obrad, sprawozdań finansowych oraz faktur i umów z kontrahentami. Spółdzielnia może pobrać opłatę za kopie (poza statutem i regulaminami), ale nie może bezpodstawnie odmówić.",
      },
      {
        question: "Ile zarząd ma czasu na odpowiedź?",
        answer:
          "Przepisy nie określają takiego terminu. Dlatego warto wyznaczyć go w piśmie – zwykle 14 dni, a przy pilnych usterkach 7 dni. Brak odpowiedzi w rozsądnym terminie jest argumentem w dalszym postępowaniu.",
      },
      {
        question: "Kto odpowiada za przeciekający dach lub zepsutą windę?",
        answer:
          "Za części wspólne budynku odpowiada wspólnota mieszkaniowa (przez zarząd) lub spółdzielnia. Koszty napraw pokrywa się z zaliczek na koszty zarządu lub funduszu remontowego. Jeśli zarząd nie reaguje, możesz zawiadomić powiatowego inspektora nadzoru budowlanego.",
      },
      {
        question: "Jak zakwestionować rozliczenie wody lub ogrzewania?",
        answer:
          "Złóż pisemne zastrzeżenia, wskazując konkretne pozycje i liczby (odczyty, metraż, stawki), i zażądaj wyjaśnień oraz wglądu w faktury dostawców. Sprawdź w regulaminie rozliczeń termin na reklamację – zwykle 14 lub 30 dni.",
      },
      {
        question: "Czy najemca może napisać do wspólnoty?",
        answer:
          "Tak, zwłaszcza w sprawie usterek w częściach wspólnych. Najemca nie ma jednak ustawowego prawa kontroli zarządu wspólnoty – w sprawach dokumentów i rozliczeń lepiej działać przez właściciela mieszkania.",
      },
      {
        question: "Czy mogę wysłać pismo do zarządcy e-mailem?",
        answer:
          "Możesz, jeśli zarządca podaje oficjalny adres e-mail. Dla celów dowodowych bezpieczniej złożyć pismo osobiście z potwierdzeniem wpływu albo wysłać listem poleconym za potwierdzeniem odbioru.",
      },
    ],
  },
  ai: {
    context:
      "Pismo jest wystąpieniem mieszkańca (właściciela lokalu, osoby z prawem spółdzielczym lub najemcy) do zarządu wspólnoty mieszkaniowej, zarządcy albo spółdzielni mieszkaniowej: wnioskiem o udostępnienie dokumentów, zgłoszeniem usterki w części wspólnej albo zastrzeżeniami do rozliczenia mediów lub opłat, pisanym w pierwszej osobie. Opis faktów ma rzeczowo przedstawić problem: miejsce i objawy usterki, od kiedy występuje i jak była zgłaszana, albo konkretne kwestionowane pozycje rozliczenia i liczby; ton urzędowy, uprzejmy i stanowczy, bez oskarżeń, emocji i gróźb. Nie wymieniaj listy żądanych dokumentów, terminu odpowiedzi ani formy udostępnienia – szablon wstawia je sam. Nie używaj słowa „uchwała” w żadnej odmianie (pisz np. „decyzja właścicieli” lub „dokument zarządu”), nie przywołuj przepisów, aktów prawnych ani orzeczeń i pisz neutralnie płciowo.",
    factQuestionIds: [
      "entity_type",
      "letter_kind",
      "legal_title",
      "defect_description",
      "defect_since",
      "defect_previous_reports",
      "settlement_period",
      "disputed_amount",
      "settlement_objections",
      "facts_description",
    ],
  },
  render: ({ answers, ai, today }) => {
    const kind = kindOf(answers);
    const email = str(answers, "sender_email", "");
    const phone = str(answers, "sender_phone", "");

    const paragraphs: Paragraph[] = [introParagraph(answers, kind)];
    if (kind === "documents") {
      const docs = lines(str(answers, "documents_list", ""));
      paragraphs.push(list(docs.length ? docs : ["____________"]));
    }

    if (ai?.facts) {
      paragraphs.push(...paragraphsFromText(ai.facts));
      if (ai.justification) paragraphs.push(...paragraphsFromText(ai.justification));
    } else {
      paragraphs.push(...factsParagraphs(answers, kind));
    }

    if (ai?.demand) {
      paragraphs.push(...paragraphsFromText(ai.demand));
    }
    paragraphs.push(...demandParagraphs(answers, kind));

    const legal = legalParagraphs(answers, kind);
    if (legal.length) {
      paragraphs.push(heading("Podstawa prawna"));
      paragraphs.push(...legal);
    }

    paragraphs.push(heading("Termin odpowiedzi"));
    paragraphs.push(closingParagraph(answers, kind));

    const titles: Record<Kind, string> = {
      documents: isTenant(answers) ? "PROŚBA O UDOSTĘPNIENIE DOKUMENTÓW" : "WNIOSEK O UDOSTĘPNIENIE DOKUMENTÓW",
      defect: "ZGŁOSZENIE USTERKI I WEZWANIE DO JEJ USUNIĘCIA",
      settlement: "ZASTRZEŻENIA DO ROZLICZENIA I WNIOSEK O WYJAŚNIENIA",
    };

    return {
      sender: partyFromAnswers(answers, "sender", [
        email ? `e-mail: ${email}` : "",
        phone ? `tel. ${phone}` : "",
      ]),
      recipient: partyFromAnswers(answers, "recipient"),
      place: str(answers, "sender_city"),
      date: formatDatePl(today),
      title: titles[kind],
      subject: `dot. lokalu: ${str(answers, "unit_address")}${kind === "settlement" ? ` – rozliczenie ${settlementPeriod(answers)}` : ""}`,
      salutation: "Szanowni Państwo,",
      paragraphs,
      closing: "Z poważaniem",
      signatureName: str(answers, "sender_name"),
      attachments: lines(str(answers, "attachments_list", "")),
      previewParagraphCount: 2,
    };
  },
};
