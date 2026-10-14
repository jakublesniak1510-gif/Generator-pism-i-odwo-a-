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
 * Reklamacja zagubionej, uszkodzonej, niepełnej lub opóźnionej przesyłki.
 * Adresat pisma (`addressee_type`):
 *  - carrier: przewoźnik/operator. Reżim (`regime`):
 *      courier       – firma kurierska / paczkomaty jako operator pocztowy (usługa pocztowa niebędąca powszechną):
 *                      Prawo pocztowe art. 87 ust. 3 i 6, art. 88 ust. 4, art. 91 ust. 1, art. 92 ust. 1 i 3;
 *      post_universal – paczka pocztowa / list polecony Poczty Polskiej (usługa powszechna): art. 88 ust. 1, art. 91;
 *      transport     – przewóz towaru na podstawie listu przewozowego: Prawo przewozowe art. 65, 74, 75, 76, 77, 80–83, 87;
 *      unknown       – ogólne odesłanie do obu ustaw.
 *    Tryb reklamacji: rozporządzenie MAiC z 26.11.2013 r. (t.j. Dz. U. z 2019 r. poz. 474) § 9 ust. 1, § 14;
 *    rozporządzenie MTiB z 24.02.2006 r. (Dz. U. Nr 38, poz. 266 ze zm. Dz. U. z 2017 r. poz. 2406) § 6 ust. 1, § 10.
 *  - shop: konsument kupujący przez internet → do sprzedawcy, art. 548 § 3 k.c. (ryzyko do chwili wydania),
 *    art. 543¹ k.c. (wydanie rzeczy), art. 43b–43e i art. 7a u.p.k. (towar uszkodzony w transporcie).
 * Zweryfikowano z t.j.: Prawo pocztowe Dz. U. z 2026 r. poz. 558, Prawo przewozowe Dz. U. z 2024 r. poz. 1262,
 * k.c. Dz. U. z 2026 r. poz. 795, u.p.k. Dz. U. z 2026 r. poz. 1244.
 * Szczegóły i wątpliwości: docs/legal-review/reklamacja-przesylki-kurierskiej.md
 */

const PPOCZT = "ustawy z dnia 23 listopada 2012 r. – Prawo pocztowe";
const PPRZEW = "ustawy z dnia 15 listopada 1984 r. – Prawo przewozowe";
const ROZP_POCZT = "rozporządzenia Ministra Administracji i Cyfryzacji z dnia 26 listopada 2013 r. w sprawie reklamacji usługi pocztowej";
const ROZP_PRZEW = "rozporządzenia Ministra Transportu i Budownictwa z dnia 24 lutego 2006 r. w sprawie ustalania stanu przesyłek oraz postępowania reklamacyjnego";
const ISAP_PPOCZT = "https://isap.sejm.gov.pl/isap.nsf/DocDetails.xsp?id=WDU20120001529";
const ISAP_PPRZEW = "https://isap.sejm.gov.pl/isap.nsf/DocDetails.xsp?id=WDU19840530272";
const ISAP_ROZP_POCZT = "https://isap.sejm.gov.pl/isap.nsf/DocDetails.xsp?id=WDU20130001468";
const ISAP_KC = "https://isap.sejm.gov.pl/isap.nsf/DocDetails.xsp?id=WDU19640160093";

type Addressee = "carrier" | "shop";
type Regime = "courier" | "post_universal" | "transport" | "unknown";
type Event = "lost" | "damaged" | "missing_part" | "delayed";

function dateAnswer(answers: Answers, id: string): Date | undefined {
  const v = answers[id];
  if (typeof v !== "string") return undefined;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v.trim());
  if (!m) return undefined;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

/** Usuwa końcową kropkę i spacje, chyba że kropka kończy skrót (np. „r.”, „szt.”). */
function trimEndDot(text: string): string {
  return text.trim().replace(/(?<!\b(?:r|nr|ul|tj|np|ok|al|str|poz|szt|kpl|godz))\.+$/, "").trim();
}

function addresseeOf(answers: Answers): Addressee {
  return str(answers, "addressee_type", "carrier") === "shop" ? "shop" : "carrier";
}

function regimeOf(answers: Answers): Regime {
  const v = str(answers, "regime", "unknown");
  return v === "courier" || v === "post_universal" || v === "transport" ? v : "unknown";
}

function eventOf(answers: Answers): Event {
  const v = str(answers, "event", "lost");
  return v === "damaged" || v === "missing_part" || v === "delayed" ? v : "lost";
}

const EVENT_GENITIVE: Record<Event, string> = {
  lost: "utraty (zaginięcia) przesyłki",
  damaged: "uszkodzenia przesyłki",
  missing_part: "ubytku zawartości przesyłki",
  delayed: "opóźnienia w doręczeniu przesyłki",
};

function protocolSentence(answers: Answers, event: Event, regime: Regime | "shop"): string {
  if (event !== "damaged" && event !== "missing_part") return "";
  const v = str(answers, "damage_protocol", "none");
  if (v === "at_delivery") {
    return " Szkodę stwierdzono przy odbiorze przesyłki, co potwierdza sporządzony wówczas protokół szkody (lub pisemne oświadczenie złożone przy odbiorze).";
  }
  if (v === "later_7d") {
    const basis =
      regime === "transport"
        ? " (art. 74 ust. 3 i art. 76 pkt 4 Prawa przewozowego)"
        : regime === "courier" || regime === "post_universal"
          ? " (art. 87 ust. 6 Prawa pocztowego)"
          : "";
    return ` Szkoda nie była widoczna z zewnątrz przy odbiorze – ujawniono ją po otwarciu przesyłki i zgłoszono niezwłocznie, przed upływem 7 dni od dnia odbioru${basis}.`;
  }
  return "";
}

function payout(account: string): string {
  return account ? `na rachunek bankowy nr ${account}` : "przekazem pocztowym na adres wskazany w nagłówku pisma";
}

function carrierLegal(answers: Answers, regime: Regime, event: Event): Paragraph[] {
  const out: Paragraph[] = [];
  const role = str(answers, "role", "sender");
  switch (regime) {
    case "courier":
    case "post_universal": {
      out.push(
        p(
          `Zgodnie z art. 87 ust. 3 ${PPOCZT} operator pocztowy, który zawarł umowę o świadczenie usługi pocztowej z nadawcą, odpowiada za niewykonanie lub nienależyte wykonanie usługi pocztowej, chyba że nastąpiło ono wskutek siły wyższej, z przyczyn występujących po stronie nadawcy lub adresata niewywołanych winą operatora, z powodu naruszenia przez nich przepisów ustawy albo regulaminu lub z powodu właściwości przesyłanej rzeczy – przy czym powołując się na którąkolwiek z tych przyczyn, operator musi przedstawić dowód jej wystąpienia.`,
        ),
      );
      if (regime === "courier") {
        const comp =
          event === "delayed"
            ? "Za opóźnienie w doręczeniu przesyłki w stosunku do gwarantowanego terminu doręczenia przysługuje odszkodowanie w wysokości nieprzekraczającej dwukrotności opłaty za usługę (art. 88 ust. 4 pkt 4 Prawa pocztowego), chyba że regulamin przewiduje korzystniejsze zasady."
            : "Za utratę, ubytek lub uszkodzenie przesyłki niebędącej przesyłką z korespondencją przysługuje odszkodowanie w wysokości nie wyższej niż zwykła wartość utraconych lub uszkodzonych rzeczy, a przy przesyłce z zadeklarowaną wartością – w wysokości żądanej przez nadawcę, nie wyższej niż wartość zadeklarowana (art. 88 ust. 4 pkt 1 i 2 Prawa pocztowego), chyba że regulamin przewiduje korzystniejsze zasady.";
        out.push(p(comp));
      } else {
        out.push(
          p(
            event === "delayed"
              ? "Niewykonaniem usługi powszechnej w zakresie przesyłki rejestrowanej jest w szczególności doręczenie tej przesyłki lub zawiadomienia o próbie jej doręczenia po upływie 14 dni od dnia jej nadania, z wyłączeniem dni ustawowo wolnych od pracy (art. 91 ust. 2 i 3 Prawa pocztowego)."
              : "Z tytułu niewykonania lub nienależytego wykonania usługi powszechnej przysługuje odszkodowanie w wysokości żądanej przez nadawcę, w granicach określonych w art. 88 ust. 1 Prawa pocztowego (w szczególności za utratę paczki pocztowej – do dziesięciokrotności opłaty pobranej za jej nadanie, za utratę przesyłki poleconej – do pięćdziesięciokrotności opłaty za traktowanie przesyłki jako poleconej, a przy przesyłce z zadeklarowaną wartością – do tej wartości).",
          ),
        );
      }
      if (event === "lost" || (regime === "post_universal" && event === "delayed")) {
        out.push(
          p("W przypadku niewykonania usługi pocztowej operator zwraca ponadto w całości pobraną opłatę, niezależnie od należnego odszkodowania (art. 91 ust. 1 Prawa pocztowego)."),
        );
      }
      out.push(
        p(
          `Prawo wniesienia reklamacji przysługuje nadawcy, a adresatowi – gdy przesyłka została mu doręczona albo gdy nadawca zrzekł się na jego rzecz prawa dochodzenia roszczeń (art. 92 ust. 1 Prawa pocztowego).${
            role === "recipient" && bool(answers, "sender_waiver") ? " Oświadczenie nadawcy o zrzeczeniu się tego prawa na moją rzecz załączam." : ""
          } Zgodnie z § 9 ust. 1 ${ROZP_POCZT} operator udziela odpowiedzi na reklamację w terminie nie dłuższym niż 30 dni od dnia jej otrzymania, a nieudzielenie odpowiedzi w tym terminie skutkuje uznaniem reklamacji (§ 14 tego rozporządzenia).`,
        ),
      );
      return out;
    }
    case "transport": {
      out.push(
        p(
          `Zgodnie z art. 65 ust. 1 ${PPRZEW} przewoźnik ponosi odpowiedzialność za utratę, ubytek lub uszkodzenie przesyłki powstałe od przyjęcia jej do przewozu aż do jej wydania oraz za opóźnienie w przewozie przesyłki. Dowód, że szkoda wynikła z okoliczności wyłączających odpowiedzialność, ciąży na przewoźniku (art. 65 ust. 2 Prawa przewozowego).`,
        ),
      );
      const comp: Record<Event, string> = {
        lost: "Odszkodowanie za utratę przesyłki ustala się na podstawie ceny wskazanej w rachunku dostawcy lub sprzedawcy (art. 80 ust. 1 pkt 1 Prawa przewozowego), a przy przesyłce z deklarowaną wartością – w wysokości deklarowanej (art. 80 ust. 3). Niezależnie od tego przewoźnik zwraca w pełnej wysokości przewoźne i inne koszty związane z przewozem (art. 82 pkt 1).",
        missing_part:
          "Odszkodowanie za ubytek przesyłki ustala się na podstawie ceny wskazanej w rachunku dostawcy lub sprzedawcy (art. 80 ust. 1 pkt 1 Prawa przewozowego); przewoźnik zwraca także w odpowiedniej części przewoźne i inne koszty związane z przewozem (art. 82 pkt 2).",
        damaged:
          "W razie uszkodzenia przesyłki odszkodowanie odpowiada procentowemu zmniejszeniu się jej wartości (art. 81 ust. 1 Prawa przewozowego); przewoźnik zwraca też przewoźne i inne koszty związane z przewozem w wysokości odpowiadającej procentowi obniżenia wartości przesyłki (art. 82 pkt 3).",
        delayed:
          "Jeżeli wskutek zwłoki w przewozie powstała szkoda inna niż w przesyłce, przewoźnik jest obowiązany zapłacić odszkodowanie do wysokości podwójnej kwoty przewoźnego (art. 83 ust. 1 Prawa przewozowego).",
      };
      out.push(p(comp[event]));
      out.push(
        p(
          `Roszczenia z umowy przewozu przesyłki przysługują nadawcy lub odbiorcy – zależnie od tego, któremu z nich przysługuje prawo rozporządzania przesyłką (art. 75 ust. 3 pkt 2 Prawa przewozowego). Zgodnie z § 6 ust. 1 ${ROZP_PRZEW} odpowiedzi na reklamację udziela się w terminie 30 dni od dnia jej wpływu do przewoźnika, a nieudzielenie odpowiedzi w tym terminie skutkuje uwzględnieniem reklamacji (§ 10 tego rozporządzenia). Kwoty odszkodowań podlegają oprocentowaniu w wysokości ustawowej od dnia wniesienia reklamacji (art. 87 Prawa przewozowego).`,
        ),
      );
      return out;
    }
    default: {
      out.push(
        p(
          `Niezależnie od tego, czy usługa została wykonana jako usługa pocztowa, czy jako przewóz przesyłki, przewoźnik odpowiada za niewykonanie lub nienależyte wykonanie umowy, w tym za utratę, ubytek lub uszkodzenie przesyłki od jej przyjęcia do doręczenia oraz za opóźnienie w doręczeniu, a ciężar wykazania okoliczności wyłączających odpowiedzialność spoczywa na nim (art. 87 ust. 3 ${PPOCZT}; art. 65 ${PPRZEW}).`,
        ),
      );
      out.push(
        p(
          "Zgodnie z przepisami wykonawczymi do obu ustaw odpowiedź na reklamację powinna zostać udzielona w terminie 30 dni od dnia jej otrzymania, a brak odpowiedzi w tym terminie oznacza uznanie (uwzględnienie) reklamacji.",
        ),
      );
      return out;
    }
  }
}

function shopParagraphs(answers: Answers, event: Event): Paragraph[] {
  const out: Paragraph[] = [];
  const demand = str(answers, "shop_demand", "deliver");
  const account = str(answers, "bank_account", "");
  const value = num(answers, "value");
  out.push(heading("Podstawa prawna"));
  out.push(
    p(
      "Zgodnie z art. 548 § 3 ustawy z dnia 23 kwietnia 1964 r. – Kodeks cywilny (dalej: „k.c.”), jeżeli rzecz sprzedana ma zostać przesłana przez sprzedawcę kupującemu będącemu konsumentem, niebezpieczeństwo przypadkowej utraty lub uszkodzenia rzeczy przechodzi na kupującego dopiero z chwilą jej wydania kupującemu, a postanowienia mniej korzystne dla kupującego są nieważne. Ryzyko utraty lub uszkodzenia towaru w transporcie obciąża zatem Państwa jako sprzedawcę; ewentualne roszczenia wobec przewoźnika przysługują Państwu jako nadawcy.",
    ),
  );
  out.push(heading("Żądanie"));
  if (event === "delayed") {
    out.push(
      p(
        "Zgodnie z art. 543¹ § 1 k.c. sprzedawca jest obowiązany wydać rzecz konsumentowi niezwłocznie, nie później niż w terminie trzydziestu dni od dnia zawarcia umowy, chyba że umowa stanowi inaczej. Towar został wydany z opóźnieniem. Wnoszę o wyjaśnienie przyczyn opóźnienia oraz o naprawienie szkody wynikłej z opóźnienia, w tym zwrot zapłaconych kosztów dostawy (art. 471 k.c.).",
      ),
    );
  } else if (event === "lost") {
    if (demand === "refund") {
      out.push(
        p(
          `Zgodnie z art. 543¹ § 1 k.c. sprzedawca jest obowiązany wydać rzecz konsumentowi niezwłocznie, nie później niż w terminie trzydziestu dni od dnia zawarcia umowy, chyba że umowa stanowi inaczej. Na podstawie art. 543¹ § 2 k.c. wyznaczam dodatkowy termin 7 dni od dnia doręczenia niniejszego pisma na wydanie towaru. Po jego bezskutecznym upływie będę uprawniony do odstąpienia od umowy i żądania zwrotu zapłaconej ceny ${
            value !== undefined ? `w kwocie ${formatMoneyPl(value)} ` : ""
          }${payout(account)}.`,
        ),
      );
    } else {
      out.push(
        p(
          "Zgodnie z art. 543¹ § 1 k.c. sprzedawca jest obowiązany wydać rzecz konsumentowi niezwłocznie, nie później niż w terminie trzydziestu dni od dnia zawarcia umowy, chyba że umowa stanowi inaczej. W związku z tym wzywam do dostarczenia zamówionego towaru – na Państwa koszt – w terminie 7 dni od dnia doręczenia niniejszego pisma. Na podstawie art. 543¹ § 2 k.c. wyznaczam ten termin jako dodatkowy; po jego bezskutecznym upływie będę uprawniony do odstąpienia od umowy.",
        ),
      );
    }
  } else {
    out.push(
      p(
        "Towar uszkodzony w transporcie albo dostarczony w niepełnym stanie jest niezgodny z umową w rozumieniu art. 43b ustawy z dnia 30 maja 2014 r. o prawach konsumenta (dalej: „u.p.k.”).",
      ),
    );
    out.push(
      p(
        demand === "refund"
          ? `Na podstawie art. 43e ust. 1 pkt 4 u.p.k. oświadczam, że odstępuję od umowy, ponieważ brak zgodności towaru z umową jest istotny, i żądam zwrotu zapłaconej ceny${
              value !== undefined ? ` w kwocie ${formatMoneyPl(value)}` : ""
            } ${payout(
              account,
            )}. Towar zwrócę na Państwa koszt – proszę o wskazanie sposobu jego odbioru. Przedsiębiorca zwraca cenę niezwłocznie, nie później niż w terminie 14 dni od dnia otrzymania towaru lub dowodu jego odesłania (art. 43e ust. 6 u.p.k.).`
          : "Na podstawie art. 43d ust. 1 u.p.k. żądam wymiany towaru na wolny od wad (albo – przy ubytku – dostarczenia brakującej części zamówienia) na Państwa koszt, w rozsądnym czasie i bez nadmiernych niedogodności dla mnie. Uszkodzony towar udostępnię do odbioru na Państwa koszt.",
      ),
    );
  }
  const upk = event === "damaged" || event === "missing_part" ? "u.p.k." : "ustawy z dnia 30 maja 2014 r. o prawach konsumenta";
  out.push(
    p(
      `Zgodnie z art. 7a ust. 1 i 2 ${upk} przedsiębiorca jest obowiązany udzielić odpowiedzi na reklamację konsumenta w terminie 14 dni od dnia jej otrzymania, a brak odpowiedzi w tym terminie oznacza uznanie reklamacji.`,
    ),
  );
  return out;
}

export const reklamacjaPrzesylkiKurierskiej: LetterTemplate = {
  slug: "reklamacja-przesylki-kurierskiej",
  name: "Reklamacja przesyłki kurierskiej",
  category: "transport",
  shortDescription:
    "Reklamacja zagubionej, uszkodzonej lub spóźnionej paczki do kuriera, Poczty Polskiej albo – przy zakupach online – do sklepu.",
  priceGrosze: 2499,
  icon: "📦",
  estimatedMinutes: 6,
  sections: [
    {
      id: "sender",
      title: "Twoje dane",
      description: "Dane nadawcy albo odbiorcy przesyłki – takie, jak na liście przewozowym lub w zamówieniu.",
      questions: senderQuestions(),
    },
    {
      id: "recipient",
      title: "Przewoźnik lub sklep",
      description:
        "Firma kurierska, Poczta Polska albo – jeśli paczkę wysyłał sklep internetowy – sprzedawca. Adres do reklamacji znajdziesz w regulaminie przewoźnika, na liście przewozowym albo w regulaminie sklepu.",
      questions: [
        {
          id: "addressee_type",
          label: "Do kogo kierujesz pismo?",
          type: "radio",
          help: "Jeśli paczkę wysyłał sklep internetowy, a Ty kupowałeś jako konsument, za zagubienie lub uszkodzenie w transporcie odpowiada sklep (art. 548 § 3 k.c.) – reklamuj u sprzedawcy, nie u kuriera.",
          options: [
            { value: "carrier", label: "Do przewoźnika (kuriera, paczkomatów, Poczty Polskiej) – sam nadawałem/am lub odbierałem/am paczkę" },
            { value: "shop", label: "Do sklepu internetowego – zamówiony towar nie dotarł albo dotarł uszkodzony" },
          ],
        },
        {
          id: "regime",
          label: "Jaką usługą wysłano przesyłkę?",
          type: "radio",
          showIf: { questionId: "addressee_type", equals: "carrier" },
          help: "Sprawdź regulamin przewoźnika: większość firm kurierskich działa jako operatorzy pocztowi (Prawo pocztowe), a przewóz towarów na liście przewozowym (np. palety) podlega Prawu przewozowemu.",
          options: [
            { value: "courier", label: "Firma kurierska lub paczkomat (np. InPost, DPD, DHL, GLS, UPS, Pocztex)" },
            { value: "post_universal", label: "Zwykła paczka pocztowa lub list polecony Poczty Polskiej" },
            { value: "transport", label: "Przewóz towaru na liście przewozowym (firma transportowa, przesyłka paletowa)" },
            { value: "unknown", label: "Nie wiem" },
          ],
        },
        {
          id: "role",
          label: "Kim jesteś w tej przesyłce?",
          type: "radio",
          showIf: { questionId: "addressee_type", equals: "carrier" },
          help: "Przy zaginięciu przesyłki reklamację u operatora pocztowego składa co do zasady nadawca. Adresat może reklamować paczkę, która została mu doręczona, albo gdy nadawca zrzekł się roszczeń na jego rzecz.",
          options: [
            { value: "sender", label: "Nadawca" },
            { value: "recipient", label: "Odbiorca (adresat)" },
          ],
        },
        {
          id: "sender_waiver",
          label: "Mam oświadczenie nadawcy o zrzeczeniu się roszczeń na moją rzecz",
          type: "checkbox",
          required: false,
          showIf: { questionId: "role", equals: "recipient" },
          help: "Dołącz je do reklamacji – bez niego operator może uznać, że reklamację złożyła osoba nieuprawniona.",
        },
        ...recipientQuestions("Przewoźnik lub sklep"),
      ],
    },
    {
      id: "parcel",
      title: "Przesyłka",
      questions: [
        {
          id: "tracking_number",
          label: "Numer przesyłki (listu przewozowego)",
          type: "text",
          placeholder: "np. 6800012345678",
          help: "Znajdziesz go na potwierdzeniu nadania, w e-mailu od sklepu lub w aplikacji przewoźnika.",
        },
        {
          id: "parcel_send_date",
          label: "Data nadania przesyłki",
          type: "date",
          help: "Od tej daty liczy się 12-miesięczny termin na reklamację u operatora pocztowego.",
        },
        {
          id: "contents",
          label: "Co było w przesyłce?",
          type: "text",
          placeholder: "np. smartfon Samsung Galaxy A56, 1 szt.",
        },
        {
          id: "value",
          label: "Wartość zawartości (cena towaru)",
          type: "money",
          placeholder: "1499.00",
          help: "Według faktury lub paragonu. Jeśli przesyłka miała zadeklarowaną wartość, odszkodowanie zwykle jest do niej ograniczone.",
        },
        {
          id: "value_proof",
          label: "Dowód wartości lub numer zamówienia (opcjonalnie)",
          type: "text",
          required: false,
          placeholder: "np. faktura FV/2026/10/15, zamówienie nr 456789",
          help: "Przy reklamacji do sklepu wpisz numer zamówienia.",
        },
        {
          id: "shipping_cost",
          label: "Opłata za przesyłkę (opcjonalnie)",
          type: "money",
          required: false,
          placeholder: "18.99",
          showIf: { questionId: "addressee_type", equals: "carrier" },
          help: "Przy utracie przesyłki operator zwraca też opłatę za usługę.",
        },
      ],
    },
    {
      id: "event",
      title: "Co się stało",
      questions: [
        {
          id: "event",
          label: "Na czym polega problem?",
          type: "radio",
          options: [
            { value: "lost", label: "Przesyłka zaginęła (nie dotarła)" },
            { value: "damaged", label: "Przesyłka dotarła uszkodzona" },
            { value: "missing_part", label: "Brakuje części zawartości" },
            { value: "delayed", label: "Przesyłka dotarła z dużym opóźnieniem" },
          ],
          help: "Zagubienie u kuriera zgłasza się zwykle po terminie, po którym regulamin uznaje paczkę za utraconą.",
        },
        {
          id: "delivery_date",
          label: "Data doręczenia (odbioru) przesyłki",
          type: "date",
          showIf: { questionId: "event", equals: ["damaged", "missing_part", "delayed"] },
          help: "Szkody niewidoczne z zewnątrz trzeba zgłosić w ciągu 7 dni od odbioru.",
        },
        {
          id: "damage_protocol",
          label: "Czy szkodę zgłoszono przy odbiorze?",
          type: "radio",
          showIf: { questionId: "event", equals: ["damaged", "missing_part"] },
          help: "Odbiór paczki bez zastrzeżeń może utrudnić dochodzenie roszczeń – chyba że szkoda nie była widoczna z zewnątrz i zgłosisz ją w ciągu 7 dni.",
          options: [
            { value: "at_delivery", label: "Tak – spisano protokół szkody przy odbiorze (lub złożono pisemne oświadczenie)" },
            { value: "later_7d", label: "Szkoda nie była widoczna z zewnątrz – zgłaszam ją w ciągu 7 dni od odbioru" },
            { value: "none", label: "Nie – paczkę odebrano bez zastrzeżeń" },
          ],
        },
        {
          id: "damage_description",
          label: "Opisz, co się stało",
          type: "textarea",
          placeholder:
            "np. Od 10 października 2026 r. status przesyłki w systemie śledzenia nie zmienia się („w sortowni”). Infolinia przyjęła zgłoszenie nr 12345, ale paczka nie została odnaleziona.",
          help: "Fakty i daty: statusy w systemie śledzenia, zgłoszenia na infolinii, wygląd opakowania, zakres uszkodzeń.",
          validate: { maxLength: 2000 },
        },
      ],
    },
    {
      id: "demand",
      title: "Żądanie",
      questions: [
        {
          id: "claim_amount",
          label: "Kwota odszkodowania, której żądasz",
          type: "money",
          showIf: { questionId: "addressee_type", equals: "carrier" },
          placeholder: "1499.00",
          help: "Przy utracie – zwykle wartość zawartości; przy uszkodzeniu – koszt naprawy lub utrata wartości; przy opóźnieniu – poniesiona szkoda (limit: zwykle 2-krotność opłaty).",
        },
        {
          id: "shop_demand",
          label: "Czego żądasz od sklepu?",
          type: "radio",
          showIf: { questionId: "addressee_type", equals: "shop" },
          options: [
            { value: "deliver", label: "Dostarczenia towaru (przy uszkodzeniu – wymiany na nowy)" },
            { value: "refund", label: "Zwrotu pieniędzy" },
          ],
          help: "Przy zaginięciu sklep dostaje dodatkowy termin na dostarczenie towaru – po jego upływie możesz odstąpić od umowy.",
        },
        {
          id: "bank_account",
          label: "Numer rachunku do wypłaty (opcjonalnie)",
          type: "text",
          required: false,
          placeholder: "PL 00 0000 0000 0000 0000 0000 0000",
          validate: { maxLength: 40 },
          help: "Podaj, jeśli żądasz odszkodowania lub zwrotu pieniędzy – przyspieszy wypłatę.",
        },
        {
          id: "complaint_date",
          label: "Kiedy wyślesz reklamację? (opcjonalnie)",
          type: "date",
          required: false,
          help: "Policzymy termin na odpowiedź (30 dni u przewoźnika, 14 dni w sklepie).",
        },
      ],
    },
  ],
  legalBasis: [
    {
      act: "Ustawa z dnia 23 listopada 2012 r. – Prawo pocztowe",
      article: "art. 87 ust. 3 i 6, art. 88, art. 91–93",
      summary:
        "Operator pocztowy (także firma kurierska) odpowiada za utratę, ubytek, uszkodzenie i opóźnienie przesyłki; reklamację składa się w ciągu 12 miesięcy od nadania.",
      url: ISAP_PPOCZT,
    },
    {
      act: "Rozporządzenie Ministra Administracji i Cyfryzacji z dnia 26 listopada 2013 r. w sprawie reklamacji usługi pocztowej",
      article: "§ 9 ust. 1 i § 14",
      summary: "Operator pocztowy ma 30 dni na odpowiedź na reklamację; brak odpowiedzi w terminie oznacza uznanie reklamacji.",
      url: ISAP_ROZP_POCZT,
    },
    {
      act: "Ustawa z dnia 15 listopada 1984 r. – Prawo przewozowe",
      article: "art. 65, 74–77, 80–83",
      summary:
        "Przewoźnik odpowiada za przesyłkę od przyjęcia do wydania; szkody niewidoczne zgłasza się w 7 dni; odszkodowanie do wartości z faktury plus zwrot przewoźnego.",
      url: ISAP_PPRZEW,
    },
    {
      act: "Rozporządzenie Ministra Transportu i Budownictwa z dnia 24 lutego 2006 r. w sprawie ustalania stanu przesyłek oraz postępowania reklamacyjnego",
      article: "§ 6 ust. 1 i § 10",
      summary: "Przewoźnik ma 30 dni na odpowiedź na reklamację; brak odpowiedzi oznacza uwzględnienie reklamacji.",
      url: "https://isap.sejm.gov.pl/isap.nsf/DocDetails.xsp?id=WDU20060380266",
    },
    {
      act: "Ustawa z dnia 23 kwietnia 1964 r. – Kodeks cywilny",
      article: "art. 548 § 3 i art. 543¹",
      summary:
        "Przy zakupie przez konsumenta ryzyko utraty lub uszkodzenia towaru w transporcie ponosi sprzedawca aż do wydania towaru kupującemu.",
      url: ISAP_KC,
    },
  ],
  deadlines: [
    {
      id: "hidden_damage_7d",
      label: "Zgłoszenie szkody niewidocznej z zewnątrz (7 dni od odbioru)",
      fromQuestionId: "delivery_date",
      days: 7,
      description:
        "Ubytek lub uszkodzenie, których nie dało się zauważyć przy odbiorze, trzeba zgłosić najpóźniej w ciągu 7 dni od odbioru przesyłki (art. 87 ust. 6 Prawa pocztowego; art. 74 ust. 3 i art. 76 pkt 4 Prawa przewozowego). Inaczej przyjęcie przesyłki bez zastrzeżeń może spowodować wygaśnięcie roszczeń.",
    },
    {
      id: "claim_12m",
      label: "Ostateczny termin na reklamację u operatora pocztowego (12 miesięcy od nadania)",
      fromQuestionId: "parcel_send_date",
      months: 12,
      description:
        "Reklamację usługi pocztowej (w tym kurierskiej) można wnieść najpóźniej w ciągu 12 miesięcy od dnia nadania przesyłki; w tym samym terminie przedawniają się roszczenia (art. 92 ust. 3 i art. 93 ust. 2 Prawa pocztowego). W przewozie na podstawie Prawa przewozowego roszczenia przedawniają się z upływem roku, liczonego m.in. od dnia wydania przesyłki (art. 77).",
    },
    {
      id: "response_30",
      label: "Termin odpowiedzi przewoźnika (30 dni)",
      fromQuestionId: "complaint_date",
      days: 30,
      description:
        "Operator pocztowy i przewoźnik mają 30 dni od otrzymania reklamacji na odpowiedź; brak odpowiedzi oznacza uznanie reklamacji. Sklep internetowy odpowiada konsumentowi w 14 dni (art. 7a ustawy o prawach konsumenta). Termin liczony od wysłania jest orientacyjny.",
    },
  ],
  instructions: {
    whereToSend:
      "**Przewoźnik:** adres do reklamacji (często osobny dział lub formularz online) znajdziesz w **regulaminie świadczenia usług** przewoźnika. Operator pocztowy musi też przyjąć reklamację w każdej swojej placówce (art. 92 ust. 2 Prawa pocztowego). Reklamację do Poczty Polskiej złożysz w urzędzie pocztowym lub elektronicznie.\n\n**Sklep internetowy:** wyślij pismo na adres do reklamacji z regulaminu sklepu lub na adres siedziby sprzedawcy. To sklep – jako nadawca – załatwia sprawę z kurierem.",
    howToSend:
      "Najpewniej: **list polecony za potwierdzeniem odbioru** albo złożenie reklamacji w placówce przewoźnika za potwierdzeniem. Większość firm kurierskich przyjmuje też reklamacje **przez formularz lub e-mail** – wtedy dołącz to pismo jako PDF i zachowaj potwierdzenie wpływu.\n\nDołącz kopie: potwierdzenia nadania lub listu przewozowego, faktury lub paragonu (dowód wartości), protokołu szkody, zdjęć opakowania i zawartości. **Zachowaj uszkodzone opakowanie** – przewoźnik może zażądać jego okazania.",
    afterSending:
      "Operator pocztowy i przewoźnik mają **30 dni** na odpowiedź – brak odpowiedzi oznacza uznanie reklamacji. Sklep odpowiada konsumentowi w **14 dni**.\n\nJeśli reklamacja zostanie odrzucona:\n- od decyzji operatora pocztowego możesz złożyć **odwołanie w ciągu 14 dni** od doręczenia odpowiedzi (§ 11 rozporządzenia w sprawie reklamacji usługi pocztowej),\n- spór z operatorem pocztowym możesz skierować do **pozasądowego rozwiązania przed Prezesem UKE** (art. 95 Prawa pocztowego),\n- w sporze ze sklepem pomoże **miejski lub powiatowy rzecznik konsumentów**,\n- w ostateczności złóż **pozew** – roszczenia wobec operatora pocztowego przedawniają się po 12 miesiącach od nadania, a z Prawa przewozowego – po roku.",
    checklist: [
      "Sprawdź w regulaminie przewoźnika, po ilu dniach paczkę uznaje się za zaginioną i jaki jest adres do reklamacji.",
      "Przy uszkodzeniu: zrób zdjęcia opakowania i zawartości, zachowaj karton i wypełniacze.",
      "Szkodę niewidoczną z zewnątrz zgłoś najpóźniej w 7 dni od odbioru.",
      "Przygotuj dowód wartości (faktura, paragon) i numer przesyłki.",
      "Jeśli kupowałeś w sklepie internetowym jako konsument – reklamuj u sprzedawcy, nie u kuriera.",
      "Wyślij reklamację za potwierdzeniem i zapisz termin odpowiedzi (30 dni, sklep – 14 dni).",
    ],
  },
  seo: {
    title: "Reklamacja przesyłki kurierskiej – wzór 2026 + generator",
    metaDescription:
      "Zagubiona lub uszkodzona paczka? Wzór reklamacji do kuriera, Poczty Polskiej albo sklepu – z odszkodowaniem, terminami i właściwymi przepisami.",
    h1: "Reklamacja przesyłki kurierskiej – wzór pisma i generator",
    intro:
      "Paczka zaginęła, dotarła rozbita albo bez części zawartości? Odpowiedz na kilka pytań – podpowiemy, czy reklamować u kuriera, na poczcie czy w sklepie, i przygotujemy pismo z żądaniem odszkodowania oraz właściwą podstawą prawną (Prawo pocztowe, Prawo przewozowe lub Kodeks cywilny).",
    keywords: [
      "reklamacja przesyłki kurierskiej wzór",
      "zagubiona paczka reklamacja",
      "uszkodzona przesyłka kurierska",
      "reklamacja paczki InPost",
      "reklamacja przesyłki Poczta Polska",
      "odszkodowanie za zgubioną paczkę",
      "protokół szkody kurier",
      "kto odpowiada za uszkodzenie paczki sklep czy kurier",
    ],
    guide: [
      {
        heading: "Sklep czy kurier – kto odpowiada za paczkę",
        body: `To najważniejsze pytanie przed napisaniem reklamacji. Jeśli **kupiłeś towar w sklepie internetowym jako konsument**, a sklep wysłał go kurierem, za zaginięcie lub uszkodzenie w transporcie odpowiada **sprzedawca**. Zgodnie z art. 548 § 3 k.c. ryzyko przypadkowej utraty lub uszkodzenia rzeczy przechodzi na konsumenta dopiero z chwilą **wydania mu towaru**. Postanowienia regulaminu sklepu przerzucające to ryzyko na klienta są nieważne.

W praktyce oznacza to, że nie musisz walczyć z firmą kurierską – składasz reklamację do sklepu, który:
- musi dostarczyć towar (art. 543¹ k.c.) albo – po bezskutecznym upływie dodatkowego terminu – liczyć się z Twoim odstąpieniem od umowy,
- odpowiada za towar uszkodzony w transporcie tak jak za każdy towar niezgodny z umową (wymiana, zwrot pieniędzy),
- sam dochodzi odszkodowania od przewoźnika jako nadawca.

Wyjątek: jeśli to Ty wybrałeś przewoźnika spoza oferty sklepu, a sklep nie miał wpływu na ten wybór, wydaniem jest już powierzenie paczki przewoźnikowi. Reklamację **bezpośrednio do przewoźnika** składasz przede wszystkim wtedy, gdy sam nadawałeś paczkę (np. sprzedaż na portalu ogłoszeniowym, wysyłka prezentu) albo kupujesz jako firma.`,
      },
      {
        heading: "Prawo pocztowe czy Prawo przewozowe",
        body: `Odpowiedzialność przewoźnika zależy od tego, jaką usługę wykonywał:

- **Firmy kurierskie i paczkomaty** (np. InPost, DPD, DHL, GLS, UPS, Pocztex) działają zwykle jako **operatorzy pocztowi**, a przesyłka kurierska jest przesyłką pocztową w rozumieniu Prawa pocztowego. Stosuje się wtedy art. 87–95 tej ustawy oraz rozporządzenie w sprawie reklamacji usługi pocztowej.
- **Poczta Polska** świadczy też **usługę powszechną** (zwykła paczka pocztowa, list polecony) – tu odszkodowania są ustawowo ograniczone, np. za utratę paczki do 10-krotności opłaty za jej nadanie, chyba że zadeklarowano wartość.
- **Przewóz towaru na podstawie listu przewozowego** (firmy transportowe, palety) podlega **Prawu przewozowemu**: przewoźnik odpowiada za przesyłkę od przyjęcia do wydania (art. 65), a odszkodowanie ustala się według ceny z faktury (art. 80).

Jeśli nie wiesz, który reżim obowiązuje, sprawdź regulamin przewoźnika (zwykle wskazuje podstawę prawną). Generator w wariancie „nie wiem” powoła się ogólnie na obie ustawy.`,
      },
      {
        heading: "Zaginiona paczka – kiedy i jak reklamować",
        body: `Zanim złożysz reklamację, sprawdź status w systemie śledzenia i zgłoś problem na infolinii – zanotuj numer zgłoszenia. Regulaminy firm kurierskich określają, po ilu dniach od nadania paczkę uznaje się za **utraconą** – dopiero wtedy przyjmują reklamację z tego tytułu (§ 6 ust. 2 pkt 2 rozporządzenia w sprawie reklamacji usługi pocztowej). W usłudze powszechnej Poczty Polskiej reklamację utraty można zgłosić po upływie 14 dni od nadania.

Kto może reklamować? U operatora pocztowego prawo to ma **nadawca**, a adresat – gdy paczka została mu doręczona albo gdy nadawca zrzekł się roszczeń na jego rzecz (art. 92 ust. 1 Prawa pocztowego). W Prawie przewozowym roszczenia przysługują nadawcy lub odbiorcy, zależnie od tego, kto ma prawo rozporządzania przesyłką (art. 75 ust. 3).

Przy utracie możesz żądać odszkodowania do wysokości **zwykłej wartości** zawartości (przy przesyłce z zadeklarowaną wartością – do tej wartości) oraz **zwrotu opłaty za przesyłkę** (art. 88 ust. 4 i art. 91 ust. 1 Prawa pocztowego; w przewozie – art. 80 i 82 Prawa przewozowego).`,
      },
      {
        heading: "Uszkodzona przesyłka – protokół i 7 dni",
        body: `Przy odbiorze obejrzyj opakowanie. Jeśli jest zgniecione, rozdarte lub mokre, poproś kuriera o **spisanie protokołu szkody** albo złóż pisemne oświadczenie o uszkodzeniu – najlepiej przed podpisaniem odbioru. Zrób zdjęcia opakowania z etykietą i zawartości.

Gdy szkoda nie była widoczna z zewnątrz (np. pęknięty ekran w nienaruszonym kartonie), masz **7 dni od odbioru** na zgłoszenie jej przewoźnikowi (art. 87 ust. 6 Prawa pocztowego; art. 74 ust. 3 i art. 76 pkt 4 Prawa przewozowego). Po tym terminie przyjęcie przesyłki bez zastrzeżeń może skutkować wygaśnięciem roszczeń. Trzeba też wykazać, że szkoda powstała w czasie przewozu – dlatego ważne są zdjęcia i zachowanie opakowania.

Odszkodowanie za uszkodzenie odpowiada **zmniejszeniu wartości** rzeczy (np. koszt naprawy), nie więcej niż jej wartość. W Prawie przewozowym przewoźnik zwraca też proporcjonalną część przewoźnego (art. 81–82).`,
      },
      {
        heading: "Terminy i odpowiedź przewoźnika",
        body: `- **7 dni** od odbioru – na zgłoszenie szkody niewidocznej z zewnątrz.
- **12 miesięcy od nadania** – na reklamację u operatora pocztowego (art. 92 ust. 3 Prawa pocztowego); w tym samym terminie przedawniają się roszczenia (art. 93 ust. 2).
- **1 rok** – przedawnienie roszczeń z Prawa przewozowego (art. 77), a dla roszczeń z samej zwłoki bez szkody w przesyłce – 2 miesiące od wydania.
- **30 dni** – tyle ma operator pocztowy lub przewoźnik na odpowiedź. Brak odpowiedzi oznacza uznanie reklamacji (§ 14 rozporządzenia w sprawie reklamacji usługi pocztowej; § 10 rozporządzenia w sprawie postępowania reklamacyjnego w przewozie).
- **14 dni** – tyle ma sklep na odpowiedź na reklamację konsumenta (art. 7a ustawy o prawach konsumenta).

Odszkodowanie uznane przez operatora pocztowego powinno zostać wypłacone w ciągu 30 dni od uznania reklamacji; po tym terminie należą się odsetki ustawowe za opóźnienie (art. 88 ust. 5 Prawa pocztowego).`,
      },
      {
        heading: "Co jeśli reklamacja zostanie odrzucona",
        body: `Od odmowy operatora pocztowego możesz wnieść **odwołanie** w ciągu 14 dni od doręczenia odpowiedzi – operator ma 30 dni na jego rozpatrzenie. Po wyczerpaniu drogi reklamacyjnej możesz skorzystać z **postępowania polubownego przed Prezesem UKE** (art. 95 Prawa pocztowego) – bezpłatnego i dostępnego także dla nadawców niebędących konsumentami – albo złożyć **pozew** do sądu.

W sporze ze sklepem pomogą **rzecznicy konsumentów** i Inspekcja Handlowa. Dobrze udokumentowana reklamacja – z numerem przesyłki, dowodem wartości, zdjęciami i protokołem – to podstawa skutecznego dochodzenia pieniędzy na każdym etapie.`,
      },
    ],
    faq: [
      {
        question: "Kupiłem towar w sklepie internetowym i paczka zaginęła – do kogo reklamacja?",
        answer:
          "Do sklepu. Przy zakupie przez konsumenta ryzyko utraty towaru w transporcie ponosi sprzedawca aż do wydania towaru (art. 548 § 3 k.c.). Sklep musi dostarczyć towar albo – po bezskutecznym upływie dodatkowego terminu – liczyć się z odstąpieniem od umowy i zwrotem pieniędzy.",
      },
      {
        question: "Ile czasu ma kurier na odpowiedź na reklamację?",
        answer:
          "30 dni od otrzymania reklamacji. Jeśli nie odpowie w tym terminie, reklamację uważa się za uznaną (§ 14 rozporządzenia w sprawie reklamacji usługi pocztowej; w przewozie – § 10 rozporządzenia z 24 lutego 2006 r.).",
      },
      {
        question: "Odebrałem paczkę bez zastrzeżeń, a w środku towar jest rozbity – co teraz?",
        answer:
          "Jeśli uszkodzenia nie było widać z zewnątrz, zgłoś je przewoźnikowi najpóźniej w ciągu 7 dni od odbioru i udokumentuj zdjęciami, zachowując opakowanie. Jeśli kupowałeś w sklepie internetowym – złóż reklamację u sprzedawcy.",
      },
      {
        question: "Jakie odszkodowanie dostanę za zgubioną paczkę?",
        answer:
          "U firmy kurierskiej – do zwykłej wartości zawartości (lub do zadeklarowanej wartości) plus zwrot opłaty za przesyłkę. W usłudze powszechnej Poczty Polskiej obowiązują limity, np. do 10-krotności opłaty za paczkę bez zadeklarowanej wartości. Regulamin przewoźnika może przewidywać korzystniejsze zasady.",
      },
      {
        question: "Czy odbiorca może złożyć reklamację?",
        answer:
          "U operatora pocztowego adresat może reklamować przesyłkę, która została mu doręczona (np. uszkodzoną), a przy zaginięciu – gdy nadawca zrzeknie się na jego rzecz roszczeń. W przewozie na podstawie Prawa przewozowego roszczenia przysługują nadawcy lub odbiorcy, zależnie od prawa rozporządzania przesyłką.",
      },
      {
        question: "Ile mam czasu na reklamację zagubionej paczki?",
        answer:
          "U operatora pocztowego – 12 miesięcy od nadania (art. 92 ust. 3 Prawa pocztowego). Reklamację utraty składa się jednak dopiero po terminie, po którym regulamin uznaje przesyłkę za utraconą, a w usłudze powszechnej Poczty Polskiej – po 14 dniach od nadania.",
      },
      {
        question: "Co to jest protokół szkody?",
        answer:
          "Dokument spisywany przez przewoźnika (np. kuriera przy doręczeniu), w którym ustala się stan przesyłki i rodzaj uszkodzeń. Jest kluczowym dowodem w reklamacji. Jeśli kurier odmawia spisania protokołu, złóż pisemne oświadczenie o uszkodzeniu i zrób zdjęcia.",
      },
    ],
  },
  ai: {
    context:
      "Reklamacja przesyłki (paczki kurierskiej, pocztowej lub przewożonej na liście przewozowym) składana przez nadawcę lub odbiorcę do przewoźnika albo – przez konsumenta – do sklepu internetowego, który wysłał towar. Opis faktów ma chronologicznie i konkretnie przedstawić: kiedy i jak nadano przesyłkę, co zawierała, co się stało (zaginięcie, uszkodzenie, ubytek, opóźnienie), statusy w systemie śledzenia, zgłoszenia na infolinii, stan opakowania i zawartości przy odbiorze oraz to, czy spisano protokół szkody. Nie formułuj żądań, kwot odszkodowania, terminów ustawowych ani podstaw prawnych – szablon dodaje je sam. Ton rzeczowy, uprzejmy i stanowczy; pisz w pierwszej osobie, neutralnie płciowo (bez form typu „nadałem/nadałam”).",
    factQuestionIds: [
      "addressee_type",
      "role",
      "tracking_number",
      "parcel_send_date",
      "contents",
      "event",
      "delivery_date",
      "damage_protocol",
      "damage_description",
    ],
  },
  render: ({ answers, ai, today }) => {
    const addressee = addresseeOf(answers);
    const regime = regimeOf(answers);
    const event = eventOf(answers);
    const role = str(answers, "role", "sender");
    const email = str(answers, "sender_email", "");
    const phone = str(answers, "sender_phone", "");
    const tracking = str(answers, "tracking_number");
    const sendDate = formatDatePl(dateAnswer(answers, "parcel_send_date"));
    const delivery = dateAnswer(answers, "delivery_date");
    const value = num(answers, "value");
    const proof = trimEndDot(str(answers, "value_proof", ""));
    const contents = trimEndDot(str(answers, "contents"));
    const account = str(answers, "bank_account", "");
    const paragraphs: Paragraph[] = [];

    // 1. Wstęp
    if (addressee === "shop") {
      paragraphs.push(
        p(
          `Zawarto z Państwem umowę sprzedaży towaru: ${contents}, za cenę ${formatMoneyPl(value)}${
            proof ? ` (${proof})` : ""
          }. Umowę zawarto jako konsument. Towar został nadany do mnie przesyłką nr ${tracking} w dniu ${sendDate}.`,
        ),
      );
    } else {
      const who = role === "recipient" ? "odbiorca (adresat)" : "nadawca";
      paragraphs.push(
        p(
          `Jako ${who} przesyłki nr ${tracking}, nadanej w dniu ${sendDate}, zawierającej: ${contents}, o wartości ${formatMoneyPl(value)}${
            proof ? ` (dowód wartości: ${proof})` : ""
          }, składam reklamację z tytułu ${EVENT_GENITIVE[event]}.`,
        ),
      );
    }

    // 2. Stan faktyczny
    if (ai?.facts) {
      paragraphs.push(...paragraphsFromText(ai.facts));
    } else {
      const lead: Record<Event, string> = {
        lost: "Do dnia sporządzenia niniejszego pisma przesyłka nie została doręczona.",
        damaged: `Przesyłka została doręczona w dniu ${formatDatePl(delivery)} w stanie uszkodzonym.`,
        missing_part: `Przesyłka została doręczona w dniu ${formatDatePl(delivery)} z ubytkiem zawartości.`,
        delayed: `Przesyłka została doręczona dopiero w dniu ${formatDatePl(delivery)}, z opóźnieniem w stosunku do terminu doręczenia.`,
      };
      paragraphs.push(p(`${lead[event]}${protocolSentence(answers, event, addressee === "shop" ? "shop" : regime)}`));
      userParagraphs(str(answers, "damage_description")).forEach((t) => paragraphs.push(p(t)));
    }

    // 3. Podstawa prawna i żądanie
    if (addressee === "shop") {
      paragraphs.push(...shopParagraphs(answers, event));
      if (ai?.demand) paragraphs.push(...paragraphsFromText(ai.demand));
    } else {
      paragraphs.push(heading("Podstawa prawna"));
      paragraphs.push(...carrierLegal(answers, regime, event));
      paragraphs.push(heading("Żądanie"));
      if (ai?.demand) paragraphs.push(...paragraphsFromText(ai.demand));
      const claim = num(answers, "claim_amount");
      const shipping = num(answers, "shipping_cost");
      const refundFee =
        shipping !== undefined && (event === "lost" || regime === "transport")
          ? ` oraz zwrotu opłaty za przesyłkę${regime === "transport" && event !== "lost" ? " w odpowiedniej części" : ` w kwocie ${formatMoneyPl(shipping)}`}`
          : "";
      paragraphs.push(
        p(
          `W związku z powyższym żądam wypłaty odszkodowania w kwocie ${formatMoneyPl(claim)}${refundFee} ${payout(account)}.${
            regime === "transport" ? " Żądam również odsetek ustawowych od dnia wniesienia reklamacji (art. 87 ust. 2 pkt 2 Prawa przewozowego)." : ""
          }`,
        ),
      );
    }

    // 4. Odpowiedź
    paragraphs.push(
      p(
        `Odpowiedź na reklamację proszę przesłać na adres wskazany w nagłówku pisma${email ? ` lub na adres e-mail: ${email}` : ""}.${
          phone ? ` W sprawie oględzin przesyłki lub opakowania proszę o kontakt pod numerem telefonu ${phone}.` : ""
        }`,
      ),
    );

    const attachments: string[] = [];
    if (addressee === "carrier") attachments.push("Kopia potwierdzenia nadania przesyłki lub listu przewozowego");
    attachments.push(addressee === "shop" ? "Kopia potwierdzenia zamówienia i zapłaty" : "Kopia dowodu wartości zawartości (faktury lub paragonu)");
    if ((event === "damaged" || event === "missing_part") && str(answers, "damage_protocol", "none") === "at_delivery") {
      attachments.push("Kopia protokołu szkody");
    }
    if (event === "damaged" || event === "missing_part") attachments.push("Zdjęcia opakowania i zawartości przesyłki");
    if (addressee === "carrier" && role === "recipient" && bool(answers, "sender_waiver")) {
      attachments.push("Oświadczenie nadawcy o zrzeczeniu się prawa dochodzenia roszczeń");
    }

    const titles: Record<Event, string> = {
      lost: addressee === "shop" ? "REKLAMACJA – NIEDOSTARCZENIE ZAMÓWIONEGO TOWARU" : "REKLAMACJA – UTRATA PRZESYŁKI",
      damaged: addressee === "shop" ? "REKLAMACJA TOWARU USZKODZONEGO W TRANSPORCIE" : "REKLAMACJA – USZKODZENIE PRZESYŁKI",
      missing_part: addressee === "shop" ? "REKLAMACJA – NIEKOMPLETNA DOSTAWA TOWARU" : "REKLAMACJA – UBYTEK ZAWARTOŚCI PRZESYŁKI",
      delayed: addressee === "shop" ? "REKLAMACJA – OPÓŹNIENIE W DOSTARCZENIU TOWARU" : "REKLAMACJA – OPÓŹNIENIE W DORĘCZENIU PRZESYŁKI",
    };

    return {
      sender: partyFromAnswers(answers, "sender", [email ? `e-mail: ${email}` : "", phone ? `tel. ${phone}` : ""]),
      recipient: partyFromAnswers(answers, "recipient"),
      place: str(answers, "sender_city"),
      date: formatDatePl(today),
      title: titles[event],
      subject: `dot. przesyłki nr ${tracking} z dnia ${sendDate}`,
      salutation: "Szanowni Państwo,",
      paragraphs: paragraphs.map(tidyParagraph),
      closing: "Z poważaniem",
      signatureName: str(answers, "sender_name"),
      attachments,
      previewParagraphCount: 2,
    };
  },
};
