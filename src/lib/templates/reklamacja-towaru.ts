import type { Answers, LetterTemplate, Paragraph } from "./types";
import {
  formatDatePl,
  formatMoneyPl,
  num,
  bool,
  p,
  partyFromAnswers,
  paragraphsFromText,
  recipientQuestions,
  senderQuestions,
  str,
} from "./helpers";

/*
 * Reklamacja towaru niezgodnego z umową.
 * Rozgałęzienie reżimu prawnego:
 *  - konsument (lub JDG na prawach konsumenta) + umowa od 1.01.2023 → ustawa o prawach konsumenta, rozdział 5a,
 *  - umowa zawarta przed 1.01.2023 albo kupujący-przedsiębiorca → rękojmia z Kodeksu cywilnego (art. 556 i n.).
 * Przepisy zweryfikowane z tekstami jednolitymi: u.p.k. Dz. U. z 2026 r. poz. 1244, k.c. Dz. U. z 2026 r. poz. 795.
 * Szczegóły i wątpliwości: docs/legal-review/reklamacja-towaru.md
 */

const UPK = "ustawy z dnia 30 maja 2014 r. o prawach konsumenta";
const KC_FULL = "ustawy z dnia 23 kwietnia 1964 r. – Kodeks cywilny (dalej: „k.c.”)";
const ISAP_UPK = "https://isap.sejm.gov.pl/isap.nsf/DocDetails.xsp?id=WDU20140000827";
const ISAP_KC = "https://isap.sejm.gov.pl/isap.nsf/DocDetails.xsp?id=WDU19640160093";

type BuyerStatus = "consumer" | "jdg" | "business";
type DemandType = "repair" | "replace" | "price_reduction" | "withdrawal";
type DemandBasis = "repeated" | "refused" | "not_done" | "significant";

/** Kończy zdanie kropką (jeśli jej brak), zaczyna wielką literą, usuwa wielokrotne spacje. */
function sentence(text: string): string {
  const t = text.trim().replace(/[ \t]+/g, " ");
  if (!t) return t;
  const capital = t.charAt(0).toUpperCase() + t.slice(1);
  return /[.!?…:]$/.test(capital) ? capital : `${capital}.`;
}

/** Porządkuje interpunkcję: „r..” → „r.”, podwójne spacje, spacje przed znakami interpunkcyjnymi. */
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

/** Dzieli tekst użytkownika na akapity (po znakach nowej linii). */
function userParagraphs(text: string): string[] {
  return text
    .split(/\n+/)
    .map((t) => sentence(t))
    .filter(Boolean);
}

function parseIso(value: Answers[string]): Date | undefined {
  if (typeof value !== "string") return undefined;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!m) return undefined;
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
}

/** true/false gdy obie daty są znane; undefined gdy brak danych */
function withinYears(from: Date | undefined, to: Date | undefined, years: number): boolean | undefined {
  if (!from || !to) return undefined;
  const limit = new Date(from.getTime());
  limit.setUTCFullYear(limit.getUTCFullYear() + years);
  return to.getTime() <= limit.getTime();
}

function attachmentsFromText(text: string): string[] {
  return text
    .split(/[;\n]+/)
    .map((t) => t.trim().replace(/[.;,]+$/, ""))
    .filter(Boolean)
    .map((t) => t.charAt(0).toUpperCase() + t.slice(1));
}

function buyerStatus(answers: Answers): BuyerStatus {
  const v = str(answers, "buyer_status", "consumer");
  return v === "jdg" || v === "business" ? v : "consumer";
}

/** Reżim: u.p.k. (rozdział 5a) albo rękojmia z k.c. */
function regimeOf(answers: Answers): "upk" | "kc" {
  const status = buyerStatus(answers);
  const purchase = str(answers, "purchase_date", "");
  const after2023 = purchase === "" || purchase >= "2023-01-01";
  return status !== "business" && after2023 ? "upk" : "kc";
}

const UPK_BASIS: Record<DemandBasis, { pkt: string; condition: string }> = {
  refused: { pkt: "1", condition: "przedsiębiorca odmówił doprowadzenia towaru do zgodności z umową" },
  not_done: { pkt: "2", condition: "przedsiębiorca nie doprowadził towaru do zgodności z umową" },
  repeated: {
    pkt: "3",
    condition:
      "brak zgodności towaru z umową występuje nadal, mimo że przedsiębiorca próbował doprowadzić towar do zgodności z umową",
  },
  significant: {
    pkt: "4",
    condition:
      "brak zgodności towaru z umową jest na tyle istotny, że uzasadnia obniżenie ceny albo odstąpienie od umowy bez uprzedniego skorzystania z naprawy lub wymiany",
  },
};

export const reklamacjaTowaru: LetterTemplate = {
  slug: "reklamacja-towaru",
  name: "Reklamacja towaru",
  category: "konsument",
  shortDescription:
    "Reklamacja wadliwego towaru: naprawa, wymiana, obniżenie ceny lub zwrot pieniędzy – z właściwą podstawą prawną.",
  priceGrosze: 2499,
  icon: "🛒",
  estimatedMinutes: 7,
  sections: [
    {
      id: "sender",
      title: "Twoje dane",
      description: "Dane kupującego – takie, jakie widnieją na dowodzie zakupu lub w zamówieniu.",
      questions: senderQuestions(),
    },
    {
      id: "recipient",
      title: "Sprzedawca",
      description:
        "Reklamację składasz do sprzedawcy, a nie do producenta. Nazwę i adres znajdziesz na paragonie, fakturze, w potwierdzeniu zamówienia lub w regulaminie sklepu.",
      questions: recipientQuestions("Sprzedawca"),
    },
    {
      id: "purchase",
      title: "Zakup i towar",
      questions: [
        {
          id: "buyer_status",
          label: "Jak kupowałeś towar?",
          type: "radio",
          help: "Od tego zależy, które przepisy zastosujemy w piśmie.",
          options: [
            { value: "consumer", label: "Jako osoba prywatna (konsument)" },
            {
              value: "jdg",
              label: "Na swoją jednoosobową firmę, ale zakup nie ma charakteru zawodowego (nie dotyczy mojej branży)",
            },
            { value: "business", label: "Jako przedsiębiorca, w ramach zawodowej działalności firmy" },
          ],
        },
        {
          id: "purchase_date",
          label: "Data zakupu (zawarcia umowy)",
          type: "date",
          help: "Dzień zakupu w sklepie lub złożenia zamówienia. Dla zakupów od 1 stycznia 2023 r. stosujemy nowe przepisy o niezgodności towaru z umową.",
        },
        {
          id: "delivery_date",
          label: "Data wydania (dostarczenia) towaru",
          type: "date",
          help: "Dzień, w którym odebrałeś towar w sklepie lub od kuriera. Od tej daty liczą się 2 lata odpowiedzialności sprzedawcy.",
        },
        {
          id: "product_name",
          label: "Nazwa i model towaru",
          type: "text",
          placeholder: "np. Pralka Bosch WAN28281PL",
        },
        {
          id: "price",
          label: "Cena zapłacona za towar",
          type: "money",
          placeholder: "1499.00",
        },
        {
          id: "receipt_number",
          label: "Numer paragonu, faktury lub zamówienia",
          type: "text",
          required: false,
          placeholder: "np. FV/2026/10/123 albo nr zamówienia 456789",
          help: "Brak paragonu nie przekreśla reklamacji – zakup możesz udowodnić np. wyciągiem z konta.",
        },
      ],
    },
    {
      id: "defect",
      title: "Co się stało",
      description: "Opisz wadę rzeczowo – co nie działa, od kiedy i w jakich okolicznościach.",
      questions: [
        {
          id: "defect_noticed_date",
          label: "Kiedy zauważyłeś wadę?",
          type: "date",
        },
        {
          id: "defect_description",
          label: "Opis wady",
          type: "textarea",
          placeholder:
            "np. Po trzech tygodniach używania pralka przestała odwirowywać pranie, a na wyświetlaczu pojawia się błąd E18. Towar był używany zgodnie z instrukcją.",
          help: "Napisz, na czym polega wada, kiedy i jak się ujawnia oraz że używałeś towaru zgodnie z przeznaczeniem.",
          validate: { maxLength: 2000 },
        },
        {
          id: "previous_complaint",
          label: "Czy ten towar był już reklamowany?",
          type: "radio",
          options: [
            { value: "none", label: "Nie, to pierwsza reklamacja" },
            { value: "repaired", label: "Tak – był naprawiany, ale wada wróciła" },
            { value: "replaced", label: "Tak – został wymieniony, ale nowy egzemplarz też jest wadliwy" },
            { value: "rejected", label: "Tak – sprzedawca odrzucił wcześniejszą reklamację" },
          ],
        },
      ],
    },
    {
      id: "demand",
      title: "Żądanie i załączniki",
      questions: [
        {
          id: "demand_type",
          label: "Czego żądasz?",
          type: "radio",
          help: "Co do zasady najpierw żąda się naprawy lub wymiany. Obniżenie ceny lub zwrot pieniędzy są możliwe od razu, gdy wada jest istotna, albo gdy naprawa/wymiana zawiodła.",
          options: [
            { value: "repair", label: "Naprawy towaru" },
            { value: "replace", label: "Wymiany towaru na nowy" },
            { value: "price_reduction", label: "Obniżenia ceny (zwrotu części pieniędzy)" },
            { value: "withdrawal", label: "Odstąpienia od umowy i zwrotu pieniędzy" },
          ],
        },
        {
          id: "reduction_amount",
          label: "O jaką kwotę obniżyć cenę?",
          type: "money",
          placeholder: "300.00",
          help: "Obniżka powinna odpowiadać temu, o ile wada zmniejsza wartość towaru.",
          showIf: { questionId: "demand_type", equals: "price_reduction" },
        },
        {
          id: "demand_basis",
          label: "Dlaczego żądasz obniżenia ceny lub zwrotu pieniędzy?",
          type: "radio",
          showIf: { questionId: "demand_type", equals: ["price_reduction", "withdrawal"] },
          options: [
            { value: "repeated", label: "Towar był już naprawiany lub wymieniany, a wada nadal występuje" },
            { value: "refused", label: "Sprzedawca odmówił naprawy lub wymiany" },
            { value: "not_done", label: "Sprzedawca nie naprawił ani nie wymienił towaru w rozsądnym czasie" },
            { value: "significant", label: "Wada jest istotna (np. towar w ogóle nie działa lub jest niebezpieczny)" },
          ],
        },
        {
          id: "bank_account",
          label: "Numer rachunku do zwrotu pieniędzy (opcjonalnie)",
          type: "text",
          required: false,
          placeholder: "PL 00 0000 0000 0000 0000 0000 0000",
          help: "Sprzedawca powinien zwrócić pieniądze tą samą metodą, którą płaciłeś. Podaj rachunek, jeśli płaciłeś gotówką albo wolisz przelew.",
          showIf: { questionId: "demand_type", equals: ["price_reduction", "withdrawal"] },
          validate: { maxLength: 40 },
        },
        {
          id: "att_receipt",
          label: "Załączam kopię paragonu lub faktury",
          type: "checkbox",
          required: false,
        },
        {
          id: "att_photos",
          label: "Załączam zdjęcia wady",
          type: "checkbox",
          required: false,
        },
        {
          id: "att_correspondence",
          label: "Załączam dotychczasową korespondencję ze sprzedawcą",
          type: "checkbox",
          required: false,
        },
        {
          id: "other_attachments",
          label: "Inne załączniki (opcjonalnie)",
          type: "text",
          required: false,
          placeholder: "np. protokół z poprzedniej naprawy; wyciąg z konta",
          help: "Kilka pozycji oddziel średnikami.",
        },
        {
          id: "send_date",
          label: "Kiedy wyślesz reklamację? (opcjonalnie)",
          type: "date",
          required: false,
          help: "Podaj, a policzymy orientacyjnie, do kiedy sprzedawca powinien odpowiedzieć.",
        },
      ],
    },
  ],
  legalBasis: [
    {
      act: "Ustawa z dnia 30 maja 2014 r. o prawach konsumenta",
      article: "art. 43b–43c",
      summary:
        "Sprzedawca odpowiada za brak zgodności towaru z umową ujawniony w ciągu 2 lat od dostarczenia; przez ten czas domniemywa się, że wada istniała już przy wydaniu.",
      url: ISAP_UPK,
    },
    {
      act: "Ustawa z dnia 30 maja 2014 r. o prawach konsumenta",
      article: "art. 43d ust. 1 i 4",
      summary:
        "Konsument może żądać naprawy lub wymiany – na koszt sprzedawcy, w rozsądnym czasie i bez nadmiernych niedogodności.",
      url: ISAP_UPK,
    },
    {
      act: "Ustawa z dnia 30 maja 2014 r. o prawach konsumenta",
      article: "art. 43e",
      summary:
        "Obniżenie ceny lub odstąpienie od umowy, gdy naprawa/wymiana zawiodła albo wada jest istotna; zwrot pieniędzy w 14 dni.",
      url: ISAP_UPK,
    },
    {
      act: "Ustawa z dnia 30 maja 2014 r. o prawach konsumenta",
      article: "art. 7a",
      summary:
        "Sprzedawca ma 14 dni na odpowiedź na reklamację konsumenta – milczenie oznacza uznanie reklamacji.",
      url: ISAP_UPK,
    },
    {
      act: "Ustawa z dnia 23 kwietnia 1964 r. – Kodeks cywilny",
      article: "art. 556, 556¹, 560, 561, 561⁵, 568",
      summary:
        "Rękojmia za wady – dla zakupów sprzed 2023 r. i zakupów firmowych: naprawa, wymiana, obniżenie ceny lub odstąpienie; 2 lata od wydania rzeczy.",
      url: ISAP_KC,
    },
  ],
  deadlines: [
    {
      id: "liability_2y",
      label: "Koniec 2-letniej odpowiedzialności sprzedawcy",
      fromQuestionId: "delivery_date",
      years: 2,
      description:
        "Sprzedawca odpowiada za wady (brak zgodności z umową), które ujawnią się w ciągu 2 lat od wydania towaru (art. 43c ust. 1 u.p.k., a dla starszych zakupów art. 568 § 1 k.c.). Wadę zgłoś jak najszybciej po jej zauważeniu.",
    },
    {
      id: "seller_response",
      label: "Orientacyjny termin odpowiedzi sprzedawcy",
      fromQuestionId: "send_date",
      days: 14,
      description:
        "Sprzedawca ma 14 dni na odpowiedź liczone od dnia otrzymania reklamacji (art. 7a u.p.k., dla starszych zakupów art. 561⁵ k.c.). Termin liczony od daty wysłania jest orientacyjny – dolicz czas doręczenia.",
    },
  ],
  instructions: {
    whereToSend: `Reklamację kierujesz do **sprzedawcy** – firmy, od której kupiłeś towar – a nie do producenta czy serwisu. Pełną nazwę i adres siedziby znajdziesz:

- na paragonie lub fakturze (nazwa firmy, NIP, adres),
- w potwierdzeniu zamówienia i w regulaminie sklepu internetowego (zakładka „Regulamin” lub „Kontakt”),
- w KRS (spółki) lub CEIDG (jednoosobowe firmy) – po numerze NIP.

Jeżeli sklep wskazuje osobny adres do reklamacji (np. dział obsługi zwrotów), możesz wysłać pismo właśnie tam.`,
    howToSend: `Najpewniej: **list polecony za potwierdzeniem odbioru** – masz dowód daty doręczenia, od której biegnie 14-dniowy termin na odpowiedź. Zachowaj nadawczy dowód i zwrotkę.

Możesz też złożyć reklamację **osobiście w sklepie** (poproś o potwierdzenie przyjęcia na kopii pisma) albo **e-mailem / przez formularz** sprzedawcy – to także skuteczna forma, jeśli sklep podaje adres do reklamacji. Przy e-mailu dołącz pismo jako PDF i zachowaj wysłaną wiadomość.

Towar dostarcz lub udostępnij sprzedawcy dopiero, gdy o to poprosi – koszt odbioru i odesłania ponosi sprzedawca.`,
    afterSending: `Sprzedawca ma **14 dni** od otrzymania reklamacji na odpowiedź na papierze lub innym trwałym nośniku (np. e-mail). **Brak odpowiedzi w terminie oznacza uznanie reklamacji** – możesz wtedy domagać się spełnienia żądania.

Jeśli sprzedawca odmówi lub zwleka z naprawą:
- skontaktuj się z **miejskim lub powiatowym rzecznikiem konsumentów** (bezpłatna pomoc, może interweniować u sprzedawcy),
- skorzystaj z **Inspekcji Handlowej** (wojewódzki inspektorat – mediacja, stały polubowny sąd konsumencki),
- zadzwoń na infolinię konsumencką **801 440 220 / 222 66 76 76**,
- w ostateczności złóż pozew do sądu rejonowego – w sprawach konsumenckich o niewielkie kwoty opłata sądowa jest niska.`,
    checklist: [
      "Sprawdź, czy od wydania towaru nie minęły 2 lata.",
      "Upewnij się, że dane sprzedawcy są zgodne z paragonem, fakturą lub regulaminem sklepu.",
      "Dołącz kopię dowodu zakupu (oryginał zachowaj u siebie) i zdjęcia wady.",
      "Podpisz pismo i zrób jego kopię lub skan.",
      "Wyślij listem poleconym za potwierdzeniem odbioru albo złóż w sklepie za potwierdzeniem.",
      "Zapisz w kalendarzu datę, w której upływa 14 dni od doręczenia reklamacji.",
    ],
  },
  seo: {
    title: "Reklamacja towaru – wzór pisma 2026 + generator",
    metaDescription:
      "Wzór reklamacji towaru niezgodnego z umową: naprawa, wymiana, obniżenie ceny lub zwrot pieniędzy. Generator z aktualnymi przepisami i terminami.",
    h1: "Reklamacja towaru – wzór pisma z generatorem",
    intro:
      "Kupiłeś wadliwy sprzęt, ubranie albo mebel? Odpowiedz na kilka pytań, a przygotujemy reklamację z właściwą podstawą prawną – dla zakupów od 2023 r. według nowych przepisów o niezgodności towaru z umową, dla starszych według rękojmi. Pismo pobierzesz jako DOCX lub PDF.",
    keywords: [
      "reklamacja towaru",
      "wzór reklamacji towaru",
      "reklamacja towaru pismo",
      "reklamacja niezgodność towaru z umową",
      "reklamacja wzór 2026",
      "jak napisać reklamację",
      "reklamacja zwrot pieniędzy",
      "reklamacja z tytułu rękojmi wzór",
    ],
    guide: [
      {
        heading: "Kiedy przysługuje reklamacja towaru",
        body: `Reklamację możesz złożyć, gdy towar jest **niezgodny z umową** – czyli nie działa tak, jak powinien, nie ma cech podanych w opisie lub reklamie, jest niekompletny, ma wady fizyczne albo nie nadaje się do celu, do którego zwykle używa się takich rzeczy. Nie ma znaczenia, czy kupiłeś go w sklepie stacjonarnym, czy przez internet, ani czy był w promocji.

Od **1 stycznia 2023 r.** zakupy konsumenckie podlegają przepisom rozdziału 5a ustawy o prawach konsumenta (art. 43a–43g). Zastąpiły one dla konsumentów dawną rękojmię z Kodeksu cywilnego. Do umów zawartych wcześniej oraz do zakupów firmowych nadal stosuje się rękojmię (art. 556 i nast. k.c.). Nasz generator sam dobiera właściwe przepisy na podstawie daty zakupu i tego, jak kupowałeś.

Ochrona konsumencka obejmuje także osoby prowadzące jednoosobową działalność, jeśli zakup nie ma dla nich charakteru zawodowego (np. fryzjer kupujący lodówkę do biura). Ważne: reklamacja **nie jest gwarancją**. Gwarancja to dobrowolne zobowiązanie producenta, a odpowiedzialność sprzedawcy wynika z ustawy i nie można jej wyłączyć – możesz wybrać, z której drogi korzystasz.`,
      },
      {
        heading: "Reklamacja krok po kroku",
        body: `1. **Zbierz dowody** – paragon, fakturę, potwierdzenie zamówienia lub wyciąg z konta; zrób zdjęcia lub nagranie wady.
2. **Ustal sprzedawcę** – jego pełną nazwę i adres znajdziesz na dowodzie zakupu albo w regulaminie sklepu internetowego.
3. **Wypełnij generator** – podaj daty zakupu i wydania towaru, opisz wadę i wybierz żądanie. Pismo powstanie z odpowiednimi przepisami.
4. **Wyślij reklamację** – listem poleconym za potwierdzeniem odbioru, e-mailem na adres reklamacyjny albo osobiście w sklepie za potwierdzeniem.
5. **Udostępnij towar** – sprzedawca odbiera go na swój koszt; nie musisz płacić za przesyłkę.
6. **Pilnuj terminu** – sprzedawca ma 14 dni na odpowiedź. Jeśli milczy, reklamacja jest uznana.`,
      },
      {
        heading: "Jakie żądania możesz zgłosić",
        body: `Przepisy przewidują hierarchię uprawnień:

- **Naprawa lub wymiana** – to podstawowe żądania. Sprzedawca może zamiast naprawy wymienić towar (i odwrotnie) tylko wtedy, gdy wybrany przez Ciebie sposób jest niemożliwy albo wymagałby nadmiernych kosztów (art. 43d ust. 2 u.p.k.). Wszystkie koszty – przesyłki, robocizny, części – ponosi sprzedawca.
- **Obniżenie ceny** – możesz zażądać zwrotu części ceny, gdy sprzedawca odmówił naprawy lub wymiany, nie wykonał jej, wada wróciła po naprawie albo jest na tyle istotna, że uzasadnia obniżenie od razu (art. 43e ust. 1). Obniżka ma odpowiadać spadkowi wartości towaru.
- **Odstąpienie od umowy** – w tych samych sytuacjach możesz zwrócić towar i odzyskać całą cenę. Nie jest to możliwe, gdy brak zgodności jest nieistotny, ale ustawa domniemywa, że jest istotny – to sprzedawca musi wykazać, że wada jest błaha.

Przy obniżeniu ceny i odstąpieniu sprzedawca zwraca pieniądze w ciągu **14 dni** – tą samą metodą płatności, chyba że zgodzisz się na inną (np. przelew na podany rachunek).`,
      },
      {
        heading: "Terminy, które musisz znać",
        body: `- **2 lata od wydania towaru** – sprzedawca odpowiada za brak zgodności z umową, który ujawni się w tym czasie (art. 43c ust. 1 u.p.k.; dla starszych zakupów art. 568 § 1 k.c.). Jeśli producent podał dłuższy termin przydatności, odpowiedzialność trwa dłużej.
- **Domniemanie przez 2 lata** – jeśli wada ujawni się w ciągu 2 lat, zakłada się, że istniała już przy wydaniu. To sprzedawca musi udowodnić, że to Ty uszkodziłeś towar. Przy zakupach sprzed 2023 r. domniemanie trwało tylko rok.
- **14 dni na odpowiedź** – liczone od dnia otrzymania reklamacji przez sprzedawcę. Brak odpowiedzi = uznanie reklamacji (art. 7a u.p.k.; dla starszych zakupów konsumenckich art. 561⁵ k.c.).
- **Zgłoszenie bez zwłoki** – przepisy konsumenckie nie przewidują krótkiego terminu na zawiadomienie o wadzie, ale im szybciej zgłosisz problem, tym łatwiej udowodnisz swoje racje. Przedsiębiorcy kupujący w ramach zawodowej działalności muszą zbadać towar i zawiadomić sprzedawcę niezwłocznie (art. 563 k.c.).`,
      },
      {
        heading: "Najczęstsze błędy przy reklamacji",
        body: `- **Odesłanie do producenta lub serwisu** – sprzedawca nie może Cię „odbić” do gwaranta. Reklamację z ustawy rozpatruje sprzedawca.
- **Brak konkretnego żądania** – napisz wprost, czego chcesz: naprawy, wymiany, obniżenia ceny o określoną kwotę albo zwrotu pieniędzy.
- **Brak dowodu doręczenia** – bez potwierdzenia odbioru trudno wykazać, że 14-dniowy termin minął.
- **Oddanie oryginału paragonu** – dołączaj kopie. Paragon nie jest zresztą jedynym dowodem zakupu – wystarczy wyciąg z konta czy e-mail z potwierdzeniem.
- **Godzenie się na „ekspertyzę” na własny koszt** – koszty związane z doprowadzeniem towaru do zgodności z umową ponosi sprzedawca.
- **Zbyt długie zwlekanie** – im później zgłosisz wadę, tym łatwiej sprzedawcy twierdzić, że powstała z Twojej winy.`,
      },
      {
        heading: "Co zrobić, gdy sprzedawca odrzuci reklamację",
        body: `Odmowa nie zamyka sprawy. Poproś o pisemne uzasadnienie i – jeśli sprzedawca powołuje się na ekspertyzę – o jej kopię. Następnie:

- zwróć się do **miejskiego lub powiatowego rzecznika konsumentów** – pomaga bezpłatnie, może wystąpić do sprzedawcy, a nawet wytoczyć powództwo w Twoim imieniu,
- złóż wniosek o **mediację** do wojewódzkiego inspektoratu Inspekcji Handlowej albo skieruj sprawę do **stałego polubownego sądu konsumenckiego**,
- przy zakupach od sprzedawcy z innego kraju UE zwróć się do **Europejskiego Centrum Konsumenckiego**,
- rozważ **niezależną opinię rzeczoznawcy** – przyda się, jeśli sprawa trafi do sądu,
- w ostateczności wnieś **pozew** do sądu rejonowego – przy niewielkich kwotach opłata sądowa jest niska, a pismo z dowodem doręczenia reklamacji będzie ważnym dowodem.

Pamiętaj: jeśli sprzedawca w ogóle nie odpowiedział w ciągu 14 dni, reklamacja jest uznana – w kolejnym piśmie powołaj się na ten fakt i wezwij do spełnienia żądania.`,
      },
    ],
    faq: [
      {
        question: "Czy mogę złożyć reklamację bez paragonu?",
        answer:
          "Tak. Paragon nie jest jedynym dowodem zakupu. Wystarczy wyciąg z konta lub karty, potwierdzenie zamówienia, e-mail ze sklepu albo zeznanie świadka. Sprzedawca nie może odmówić rozpatrzenia reklamacji tylko z powodu braku paragonu.",
      },
      {
        question: "Ile czasu ma sprzedawca na odpowiedź na reklamację?",
        answer:
          "14 dni od dnia otrzymania reklamacji. Jeśli w tym czasie nie odpowie na papierze lub innym trwałym nośniku (np. e-mailem), uważa się, że uznał reklamację (art. 7a ustawy o prawach konsumenta).",
      },
      {
        question: "Czy mogę od razu żądać zwrotu pieniędzy?",
        answer:
          "Tylko w określonych sytuacjach: gdy wada jest na tyle istotna, że uzasadnia odstąpienie bez naprawy, gdy sprzedawca odmówił naprawy lub wymiany albo nie wykonał jej w rozsądnym czasie, lub gdy wada wraca mimo naprawy. W pozostałych przypadkach zacznij od żądania naprawy lub wymiany.",
      },
      {
        question: "Czy sprzedawca może odesłać mnie do serwisu producenta?",
        answer:
          "Nie, jeśli składasz reklamację na podstawie przepisów o niezgodności towaru z umową (lub rękojmi). Odpowiada sprzedawca. Gwarancja producenta to dodatkowa, niezależna ścieżka – to Ty wybierasz, z której korzystasz.",
      },
      {
        question: "Kto płaci za przesłanie reklamowanego towaru?",
        answer:
          "Sprzedawca. Odbiera towar na swój koszt i ponosi koszty naprawy lub wymiany, w tym opłaty pocztowe, transport, robociznę i materiały (art. 43d ust. 4 i 5 ustawy o prawach konsumenta).",
      },
      {
        question: "Kupiłem towar w promocji lub na wyprzedaży – czy mogę go reklamować?",
        answer:
          "Tak. Obniżona cena nie wyłącza odpowiedzialności sprzedawcy. Wyjątek dotyczy wad, o których zostałeś wyraźnie poinformowany przed zakupem i które wyraźnie zaakceptowałeś (np. „przecena – rysa na obudowie”).",
      },
      {
        question: "Co jeśli kupiłem towar przed 2023 rokiem?",
        answer:
          "Stosuje się wtedy rękojmię z Kodeksu cywilnego – również 2 lata od wydania rzeczy i 14 dni na odpowiedź sprzedawcy dla konsumentów, ale domniemanie istnienia wady przy wydaniu trwa tylko rok. Generator sam dobierze te przepisy na podstawie daty zakupu.",
      },
      {
        question: "Czy mogę reklamować towar kupiony na firmę?",
        answer:
          "Tak. Jeśli prowadzisz jednoosobową działalność, a zakup nie ma dla Ciebie charakteru zawodowego, korzystasz z ochrony jak konsument. Przy zakupach typowo firmowych stosuje się rękojmię z Kodeksu cywilnego – trzeba wtedy zbadać towar i zawiadomić o wadzie niezwłocznie.",
      },
    ],
  },
  ai: {
    context:
      "Reklamacja towaru niezgodnego z umową składana przez kupującego (najczęściej konsumenta) do sprzedawcy. Opis faktów ma chronologicznie przedstawić, kiedy towar został kupiony i wydany, kiedy i jak ujawniła się wada, jak się objawia oraz czy towar był używany zgodnie z przeznaczeniem i czy był już reklamowany. Żądanie ma odpowiadać wybranej przez użytkownika opcji (naprawa, wymiana, obniżenie ceny o podaną kwotę albo odstąpienie od umowy i zwrot ceny). Ton rzeczowy, uprzejmy i stanowczy, bez emocji i bez gróźb. Nie powołuj przepisów ani terminów ustawowych – szablon dodaje je sam.",
    factQuestionIds: [
      "product_name",
      "purchase_date",
      "delivery_date",
      "price",
      "defect_noticed_date",
      "defect_description",
      "previous_complaint",
      "demand_type",
      "reduction_amount",
    ],
  },
  render: ({ answers, ai, today }) => {
    const status = buyerStatus(answers);
    const regime = regimeOf(answers);
    const isConsumerLike = status !== "business";
    const demand = str(answers, "demand_type", "repair") as DemandType;
    const basisKey = str(answers, "demand_basis", "") as DemandBasis | "";
    const product = str(answers, "product_name");
    const price = num(answers, "price");
    const reduction = num(answers, "reduction_amount");
    const receipt = str(answers, "receipt_number", "");
    const account = str(answers, "bank_account", "");
    const email = str(answers, "sender_email", "");
    const phone = str(answers, "sender_phone", "");
    const deliveryDate = parseIso(answers.delivery_date);
    const defectDate = parseIso(answers.defect_noticed_date);
    const within2y = withinYears(deliveryDate, defectDate, 2);
    const within1y = withinYears(deliveryDate, defectDate, 1);
    const previous = str(answers, "previous_complaint", "none");

    const paragraphs: Paragraph[] = [];

    // 1. Wstęp
    const asWho =
      status === "consumer"
        ? "Jako konsument jestem"
        : status === "jdg"
          ? "Jako osoba fizyczna prowadząca działalność gospodarczą, dla której umowa nie ma charakteru zawodowego, jestem"
          : "Jestem";
    const receiptPart = receipt ? ` (dowód zakupu nr ${receipt})` : "";
    const complaintKind =
      regime === "upk"
        ? "z powodu jego niezgodności z umową"
        : "z tytułu rękojmi za wady fizyczne rzeczy sprzedanej";
    paragraphs.push(
      p(
        `${asWho} nabywcą towaru „${product}”, zakupionego od Państwa w dniu ${formatDatePl(
          str(answers, "purchase_date", ""),
        )} za cenę ${formatMoneyPl(price)}${receiptPart}. Towar został mi wydany w dniu ${formatDatePl(
          str(answers, "delivery_date", ""),
        )}. Niniejszym składam reklamację tego towaru ${complaintKind}.`,
      ),
    );

    // 2. Stan faktyczny
    if (ai) {
      paragraphs.push(...paragraphsFromText(ai.facts));
      paragraphs.push(...paragraphsFromText(ai.justification));
    } else {
      const defectWord = regime === "upk" ? "Brak zgodności towaru z umową ujawnił się" : "Wada ujawniła się";
      const description = userParagraphs(str(answers, "defect_description"));
      const [first, ...rest] = description;
      paragraphs.push(
        p(`${defectWord} w dniu ${formatDatePl(str(answers, "defect_noticed_date", ""))}. ${first ?? ""}`.trim()),
      );
      rest.forEach((t) => paragraphs.push(p(t)));
      const nonConforming = regime === "upk" ? "niezgodny z umową" : "wadliwy";
      const previousText: Record<string, string> = {
        repaired: `Towar był już wcześniej reklamowany i naprawiany, jednak ${
          regime === "upk" ? "brak zgodności z umową wystąpił" : "wada wystąpiła"
        } ponownie.`,
        replaced: `Towar był już wcześniej wymieniany w ramach reklamacji, jednak również wymieniony egzemplarz jest ${nonConforming}.`,
        rejected: `Wcześniejsze zgłoszenie tej wady nie zostało przez Państwa uwzględnione. Podtrzymuję stanowisko, że towar jest ${nonConforming}.`,
      };
      if (previousText[previous]) paragraphs.push(p(previousText[previous]));
    }

    // 3. Żądanie
    const refundPhrase = account
      ? `przelewem na rachunek bankowy nr ${account} (na taki sposób zwrotu wyrażam zgodę)`
      : "w taki sam sposób, w jaki dokonano zapłaty";
    if (ai?.demand) {
      paragraphs.push(...paragraphsFromText(ai.demand));
    } else {
      const costsSubject = regime === "upk" ? "towaru" : "rzeczy";
      const demandText: Record<DemandType, string> = {
        repair: `W związku z powyższym żądam nieodpłatnej naprawy ${costsSubject} w rozsądnym czasie i bez nadmiernych niedogodności dla mnie. Koszty naprawy, w tym koszty odbioru i ponownego dostarczenia ${costsSubject}, obciążają sprzedawcę.`,
        replace: `W związku z powyższym żądam wymiany ${costsSubject} na nowy egzemplarz, wolny od wad, w rozsądnym czasie i bez nadmiernych niedogodności dla mnie. Koszty wymiany, w tym koszty odbioru wadliwego egzemplarza i dostarczenia nowego, obciążają sprzedawcę.`,
        price_reduction: (() => {
          const newPrice =
            price !== undefined && reduction !== undefined && reduction < price
              ? `, tj. z ${formatMoneyPl(price)} do ${formatMoneyPl(Math.round((price - reduction) * 100) / 100)}`
              : "";
          return `W związku z powyższym oświadczam, że obniżam cenę towaru o kwotę ${formatMoneyPl(
            reduction,
          )}${newPrice}, i wnoszę o zwrot tej kwoty ${refundPhrase}.`;
        })(),
        withdrawal: `W związku z powyższym oświadczam, że odstępuję od umowy sprzedaży towaru, i żądam zwrotu zapłaconej ceny w kwocie ${formatMoneyPl(
          price,
        )} ${refundPhrase}. Towar zwrócę na Państwa koszt – proszę o wskazanie sposobu jego odbioru albo adresu, na który mam go odesłać.`,
      };
      paragraphs.push(p(demandText[demand] ?? demandText.repair));
    }

    // 4. Podstawa prawna – wyłącznie stałe teksty szablonu
    if (regime === "upk") {
      const via = status === "jdg" ? " w związku z art. 7aa ust. 1" : "";
      paragraphs.push(
        p(
          `Zgodnie z art. 43c ust. 1${via} ${UPK} przedsiębiorca ponosi odpowiedzialność za brak zgodności towaru z umową istniejący w chwili jego dostarczenia i ujawniony w ciągu dwóch lat od tej chwili.${
            within2y === false
              ? ""
              : " Domniemywa się przy tym, że brak zgodności, który ujawnił się przed upływem dwóch lat od chwili dostarczenia towaru, istniał w chwili jego dostarczenia, o ile nie zostanie udowodnione inaczej."
          }`,
        ),
      );
      if (demand === "repair" || demand === "replace") {
        paragraphs.push(
          p(
            "Stosownie do art. 43d ust. 1 tej ustawy, jeżeli towar jest niezgodny z umową, konsument może żądać jego naprawy lub wymiany. Przedsiębiorca dokonuje naprawy lub wymiany w rozsądnym czasie od chwili poinformowania go o braku zgodności z umową i bez nadmiernych niedogodności dla konsumenta, a koszty naprawy lub wymiany, w tym w szczególności koszty opłat pocztowych, przewozu, robocizny i materiałów, ponosi przedsiębiorca (art. 43d ust. 4). Przedsiębiorca odbiera od konsumenta towar na swój koszt (art. 43d ust. 5).",
          ),
        );
      } else {
        const basis = UPK_BASIS[basisKey || "significant"];
        const what = demand === "withdrawal" ? "odstąpieniu od umowy" : "obniżeniu ceny";
        const intro = `Zgodnie z art. 43e ust. 1 pkt ${basis.pkt} tej ustawy konsument może złożyć oświadczenie o ${what}, gdy ${basis.condition}, co ma miejsce w niniejszej sprawie.`;
        const tail =
          demand === "withdrawal"
            ? " Domniemywa się, że brak zgodności towaru z umową jest istotny (art. 43e ust. 4). W razie odstąpienia od umowy konsument niezwłocznie zwraca towar przedsiębiorcy na jego koszt, a przedsiębiorca zwraca konsumentowi cenę niezwłocznie, nie później niż w terminie 14 dni od dnia otrzymania towaru lub dowodu jego odesłania (art. 43e ust. 6), przy użyciu takiego samego sposobu zapłaty, jakiego użył konsument, chyba że konsument wyraźnie zgodził się na inny sposób zwrotu (art. 43e ust. 7)."
            : " Obniżona cena musi pozostawać w takiej proporcji do ceny wynikającej z umowy, w jakiej wartość towaru niezgodnego z umową pozostaje do wartości towaru zgodnego z umową (art. 43e ust. 2). Kwoty należne wskutek obniżenia ceny przedsiębiorca zwraca niezwłocznie, nie później niż w terminie 14 dni od dnia otrzymania oświadczenia konsumenta (art. 43e ust. 3).";
        paragraphs.push(p(intro + tail));
      }
      if (status === "consumer") {
        paragraphs.push(
          p(
            "Zgodnie z art. 7a ust. 1 ustawy o prawach konsumenta przedsiębiorca jest obowiązany udzielić odpowiedzi na reklamację konsumenta w terminie 14 dni od dnia jej otrzymania, a w myśl art. 7a ust. 2 tej ustawy brak odpowiedzi w tym terminie oznacza, że przedsiębiorca uznał reklamację. Odpowiedź należy przekazać na papierze lub innym trwałym nośniku (art. 7a ust. 3).",
          ),
        );
      } else {
        paragraphs.push(p("Proszę o udzielenie odpowiedzi na reklamację w terminie 14 dni od dnia jej otrzymania."));
      }
    } else {
      const pre2023 = isConsumerLike;
      const consumerVia = status === "jdg" ? " w związku z art. 556⁴ k.c." : "";
      const intro = pre2023
        ? "Ponieważ umowa sprzedaży została zawarta przed dniem 1 stycznia 2023 r., zastosowanie mają przepisy Kodeksu cywilnego o rękojmi za wady (art. 4 ust. 1 ustawy z dnia 4 listopada 2022 r. o zmianie ustawy o prawach konsumenta, ustawy – Kodeks cywilny oraz ustawy – Prawo prywatne międzynarodowe). "
        : "";
      paragraphs.push(
        p(
          `${intro}Zgodnie z art. 556 ${KC_FULL} sprzedawca jest odpowiedzialny względem kupującego, jeżeli rzecz sprzedana ma wadę (rękojmia). Wada polega na niezgodności rzeczy sprzedanej z umową, w szczególności gdy rzecz nie ma właściwości, które rzecz tego rodzaju powinna mieć ze względu na cel w umowie oznaczony albo wynikający z okoliczności lub przeznaczenia (art. 556¹ § 1 pkt 1 k.c.). Sprzedawca odpowiada z tytułu rękojmi, jeżeli wada fizyczna zostanie stwierdzona przed upływem dwóch lat od dnia wydania rzeczy kupującemu (art. 568 § 1 k.c.).${
            pre2023 && within1y === true
              ? ` Ponieważ wada została stwierdzona przed upływem roku od dnia wydania rzeczy, domniemywa się, że wada lub jej przyczyna istniała w chwili przejścia niebezpieczeństwa na kupującego (art. 556² k.c.${consumerVia}).`
              : ""
          }${status === "business" ? " Niniejsze pismo stanowi zawiadomienie o wadzie, o którym mowa w art. 563 § 1 k.c." : ""}`,
        ),
      );
      if (demand === "repair" || demand === "replace") {
        paragraphs.push(
          p(
            "Stosownie do art. 561 § 1 k.c., jeżeli rzecz sprzedana ma wadę, kupujący może żądać wymiany rzeczy na wolną od wad albo usunięcia wady, a sprzedawca jest obowiązany wymienić rzecz wadliwą na wolną od wad lub usunąć wadę w rozsądnym czasie bez nadmiernych niedogodności dla kupującego (art. 561 § 2 k.c.). Koszty wymiany lub naprawy ponosi sprzedawca (art. 561³ k.c.).",
          ),
        );
      } else {
        const tail =
          demand === "withdrawal"
            ? " Kupujący nie może odstąpić od umowy wyłącznie wtedy, gdy wada jest nieistotna (art. 560 § 4 k.c.), co w niniejszej sprawie nie zachodzi."
            : " Obniżona cena powinna pozostawać w takiej proporcji do ceny wynikającej z umowy, w jakiej wartość rzeczy z wadą pozostaje do wartości rzeczy bez wady (art. 560 § 3 k.c.).";
        paragraphs.push(
          p(
            `Zgodnie z art. 560 § 1 k.c., jeżeli rzecz sprzedana ma wadę, kupujący może złożyć oświadczenie o obniżeniu ceny albo odstąpieniu od umowy, chyba że sprzedawca niezwłocznie i bez nadmiernych niedogodności dla kupującego wymieni rzecz wadliwą na wolną od wad albo wadę usunie. Ograniczenie to nie ma zastosowania, jeżeli rzecz była już wymieniona lub naprawiana przez sprzedawcę albo sprzedawca nie uczynił zadość obowiązkowi wymiany rzeczy na wolną od wad lub usunięcia wady.${tail}`,
          ),
        );
      }
      if (isConsumerLike && demand !== "withdrawal") {
        paragraphs.push(
          p(
            `Zgodnie z art. 561⁵ k.c.${consumerVia}, jeżeli kupujący będący konsumentem zażądał wymiany rzeczy lub usunięcia wady albo złożył oświadczenie o obniżeniu ceny, określając kwotę, o którą cena ma być obniżona, a sprzedawca nie ustosunkował się do tego żądania w terminie czternastu dni, uważa się, że żądanie to uznał za uzasadnione. Proszę zatem o ustosunkowanie się do reklamacji w tym terminie.`,
          ),
        );
      } else {
        paragraphs.push(p("Proszę o ustosunkowanie się do reklamacji w terminie 14 dni od dnia jej otrzymania."));
      }
    }

    // 5. Sposób odpowiedzi
    paragraphs.push(
      p(
        `Odpowiedź proszę przesłać na adres wskazany w nagłówku pisma${
          email ? ` lub na adres e-mail: ${email}` : ""
        }.${phone ? ` W sprawie odbioru towaru proszę o kontakt pod numerem telefonu ${phone}.` : ""}`,
      ),
    );

    const attachments: string[] = [];
    if (bool(answers, "att_receipt")) attachments.push("Kopia dowodu zakupu (paragonu lub faktury)");
    if (bool(answers, "att_photos")) attachments.push("Zdjęcia przedstawiające wadę towaru");
    if (bool(answers, "att_correspondence")) attachments.push("Kopia dotychczasowej korespondencji ze sprzedawcą");
    attachments.push(...attachmentsFromText(str(answers, "other_attachments", "")));

    const extra = [email ? `e-mail: ${email}` : "", phone ? `tel. ${phone}` : ""];

    return {
      sender: partyFromAnswers(answers, "sender", extra),
      recipient: partyFromAnswers(answers, "recipient"),
      place: str(answers, "sender_city"),
      date: formatDatePl(today),
      title: regime === "upk" ? "REKLAMACJA TOWARU NIEZGODNEGO Z UMOWĄ" : "REKLAMACJA Z TYTUŁU RĘKOJMI ZA WADY",
      subject: `Dotyczy: ${product}${receipt ? `, dowód zakupu nr ${receipt}` : ""}`,
      salutation: "Szanowni Państwo,",
      paragraphs: paragraphs.map(tidyParagraph),
      closing: "Z poważaniem",
      signatureName: str(answers, "sender_name"),
      attachments,
      previewParagraphCount: 2,
    };
  },
};
