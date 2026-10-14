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
 * Odwołanie (reklamacja) od decyzji ubezpieczyciela.
 * Rozgałęzienia:
 *  - rodzaj ubezpieczenia (`insurance_type`): OC sprawcy (k.c. art. 822 + u.u.o. art. 14, 19, 36 + uchwały SN),
 *    AC i ubezpieczenie mienia (k.c. art. 805, 817, 385 § 2), życie/NNW (k.c. art. 805 § 2 pkt 2, art. 6, 385 § 2),
 *  - rodzaj decyzji (`decision_type`): odmowa albo zaniżenie (dopłata = kwota żądana − kwota przyznana),
 *  - przedmiot sporu przy pojazdach (`vehicle_issue`) i przy życiu/NNW (`life_issue`).
 * Zawsze: reklamacja w rozumieniu ustawy o rozpatrywaniu reklamacji (art. 2 pkt 2, art. 6–8).
 * Przepisy zweryfikowane z tekstami jednolitymi: u.r.r. Dz. U. z 2026 r. poz. 823, u.u.o. Dz. U. z 2026 r. poz. 783,
 * k.c. Dz. U. z 2026 r. poz. 795, u.d.u.r. Dz. U. z 2025 r. poz. 1526. Uchwały SN III CZP 32/03, III CZP 5/11,
 * III CZP 80/11 – teza sprawdzona w bazie SAOS. Szczegóły: docs/legal-review/odwolanie-od-decyzji-ubezpieczyciela.md
 */

const REKL =
  "ustawy z dnia 5 sierpnia 2015 r. o rozpatrywaniu reklamacji przez podmioty rynku finansowego, o Rzeczniku Finansowym i o Funduszu Edukacji Finansowej";
const UUO =
  "ustawy z dnia 22 maja 2003 r. o ubezpieczeniach obowiązkowych, Ubezpieczeniowym Funduszu Gwarancyjnym i Polskim Biurze Ubezpieczycieli Komunikacyjnych (dalej: „u.u.o.”)";
const UDU = "ustawy z dnia 11 września 2015 r. o działalności ubezpieczeniowej i reasekuracyjnej";
const KC = "ustawy z dnia 23 kwietnia 1964 r. – Kodeks cywilny (dalej: „k.c.”)";

const ISAP_REKL = "https://isap.sejm.gov.pl/isap.nsf/DocDetails.xsp?id=WDU20150001348";
const ISAP_UUO = "https://isap.sejm.gov.pl/isap.nsf/DocDetails.xsp?id=WDU20031241152";
const ISAP_KC = "https://isap.sejm.gov.pl/isap.nsf/DocDetails.xsp?id=WDU19640160093";

type InsuranceType = "oc" | "ac" | "property" | "life";
type DecisionType = "refusal" | "underpaid";

function insuranceType(answers: Answers): InsuranceType {
  const v = str(answers, "insurance_type", "oc");
  return v === "ac" || v === "property" || v === "life" ? v : "oc";
}

function decisionType(answers: Answers): DecisionType {
  return str(answers, "decision_type", "underpaid") === "refusal" ? "refusal" : "underpaid";
}

function isVehicle(type: InsuranceType): boolean {
  return type === "oc" || type === "ac";
}

/** Usuwa końcowe „;” i „,” oraz kropkę – z wyjątkiem kropki skrótu (np. „r.”, „nr.”, „zł.”). */
function trimEnd(text: string): string {
  const t = text.trim().replace(/[;,]+$/, "");
  if (/(?:^|[\s(])(?:r|nr|ul|pkt|ust|art|zł|tel|ok|godz|im|tj|np|in)\.$/i.test(t)) return t;
  return t.replace(/\.+$/, "");
}

function attachmentsFromText(text: string): string[] {
  return text
    .split(/[;\n]+/)
    .map(trimEnd)
    .filter(Boolean)
    .map((t) => t.charAt(0).toUpperCase() + t.slice(1));
}

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

/** „odszkodowania” przy ubezpieczeniach majątkowych i OC, „świadczenia” przy życiu/NNW */
function benefitWord(type: InsuranceType, form: "gen" | "acc"): string {
  if (type === "life") return form === "gen" ? "świadczenia" : "świadczenie";
  return form === "gen" ? "odszkodowania" : "odszkodowanie";
}

const INSURANCE_LABEL: Record<InsuranceType, string> = {
  oc: "z obowiązkowego ubezpieczenia odpowiedzialności cywilnej posiadacza pojazdu mechanicznego (OC) sprawcy szkody",
  ac: "z umowy ubezpieczenia autocasco (AC)",
  property: "z umowy ubezpieczenia mienia",
  life: "z umowy ubezpieczenia na życie lub od następstw nieszczęśliwych wypadków (NNW)",
};

function introParagraph(answers: Answers): Paragraph {
  const type = insuranceType(answers);
  const decision = decisionType(answers);
  const granted = num(answers, "granted_amount");
  const policy = str(answers, "policy_number", "");
  const role =
    type === "oc"
      ? "Jako osoba poszkodowana, dochodząca roszczeń bezpośrednio od Państwa jako ubezpieczyciela odpowiedzialności cywilnej sprawcy szkody,"
      : `Jako osoba uprawniona z umowy ubezpieczenia${policy ? ` (polisa nr ${policy})` : ""}`;
  const decisionText =
    decision === "refusal"
      ? `Decyzją tą odmówili Państwo wypłaty ${benefitWord(type, "gen")}`
      : `Decyzją tą przyznali Państwo ${benefitWord(type, "acc")} w kwocie ${formatMoneyPl(granted)}`;
  const scope =
    decision === "refusal" ? "w całości" : `w zakresie wysokości przyznanego ${benefitWord(type, "gen")}`;
  return p(
    `${role} składam reklamację w rozumieniu art. 2 pkt 2 ${REKL} – odwołanie od decyzji z dnia ${formatDatePl(
      str(answers, "decision_date", ""),
    )} w sprawie szkody nr ${str(answers, "claim_number")} ${INSURANCE_LABEL[type]}. ${decisionText}. Decyzję kwestionuję ${scope}.`,
  );
}

function factsParagraphs(answers: Answers): Paragraph[] {
  const type = insuranceType(answers);
  const out: Paragraph[] = [];
  const vehicle = str(answers, "vehicle", "");
  const eventDate = formatDatePl(str(answers, "event_date", ""));

  let first: string;
  if (type === "oc") {
    first = `W dniu ${eventDate} doszło do zdarzenia drogowego, w wyniku którego uszkodzeniu uległ pojazd ${
      vehicle || "____________"
    }. Sprawca zdarzenia był ubezpieczony u Państwa w zakresie obowiązkowego ubezpieczenia OC.`;
  } else if (type === "ac") {
    first = `W dniu ${eventDate} doszło do zdarzenia objętego ochroną z umowy ubezpieczenia autocasco, w wyniku którego uszkodzeniu uległ pojazd ${
      vehicle || "____________"
    }.`;
  } else if (type === "property") {
    first = `W dniu ${eventDate} doszło do zdarzenia objętego ochroną z umowy ubezpieczenia mienia, w wyniku którego powstała szkoda w ubezpieczonym mieniu.`;
  } else {
    first = `W dniu ${eventDate} doszło do zdarzenia objętego ochroną z umowy ubezpieczenia.`;
  }
  const registered = type === "life" ? "Roszczenie zostało zgłoszone i zarejestrowane" : "Szkoda została zgłoszona i zarejestrowana";
  out.push(p(`${first} ${registered} pod numerem ${str(answers, "claim_number")}.`));

  const reasoning = userParagraphs(str(answers, "insurer_reasoning", ""));
  if (reasoning.length) {
    out.push(p(`W uzasadnieniu decyzji wskazali Państwo: ${reasoning.join(" ")}`));
  }

  const disagreement = userParagraphs(str(answers, "disagreement", ""));
  if (disagreement.length) {
    const [firstLine, ...rest] = disagreement;
    out.push(p(`Nie zgadzam się z tym stanowiskiem. ${firstLine}`));
    rest.forEach((t) => out.push(p(t)));
  }

  const evidence = str(answers, "own_evidence", "none");
  const expert = str(answers, "expert_name", "");
  const claimed = formatMoneyPl(num(answers, "claimed_amount"));
  if (evidence === "expert") {
    out.push(
      p(
        `Na poparcie swojego stanowiska przedstawiam niezależny kosztorys (opinię)${
          expert ? ` sporządzony przez: ${expert}` : ""
        }, z którego wynika wysokość szkody uzasadniająca żądanie w kwocie ${claimed}.`,
      ),
    );
  } else if (evidence === "invoice") {
    out.push(
      p(
        `Rzeczywisty koszt usunięcia szkody potwierdza załączona faktura${
          expert ? ` wystawiona przez: ${expert}` : ""
        }, która uzasadnia żądanie w kwocie ${claimed}.`,
      ),
    );
  }
  return out;
}

function demandParagraphs(answers: Answers): Paragraph[] {
  const type = insuranceType(answers);
  const decision = decisionType(answers);
  const claimed = num(answers, "claimed_amount");
  const granted = num(answers, "granted_amount");
  const iban = str(answers, "iban", "");
  const items: string[] = [];

  if (decision === "refusal") {
    items.push(
      `zmianę decyzji, uznanie odpowiedzialności za szkodę nr ${str(answers, "claim_number")} i wypłatę ${benefitWord(
        type,
        "gen",
      )} w kwocie ${formatMoneyPl(claimed)}`,
    );
  } else if (claimed !== undefined && granted !== undefined && claimed > granted) {
    items.push(
      `ponowne ustalenie wysokości ${benefitWord(type, "gen")} i dopłatę kwoty ${formatMoneyPl(
        roundMoney(claimed - granted),
      )}, stanowiącej różnicę między należną kwotą ${formatMoneyPl(claimed)} a kwotą dotychczas przyznaną ${formatMoneyPl(granted)}`,
    );
  } else {
    items.push(`ponowne ustalenie wysokości ${benefitWord(type, "gen")} i jego dopłatę do łącznej kwoty ${formatMoneyPl(claimed)}`);
  }

  if (type === "life" && str(answers, "life_issue", "") === "percent") {
    items.push(
      "ponowne ustalenie stopnia uszczerbku na zdrowiu z uwzględnieniem całości przedłożonej dokumentacji medycznej, a w razie potrzeby – skierowanie na badanie przez innego lekarza orzecznika lub komisję lekarską",
    );
  }
  if (bool(answers, "request_files")) {
    items.push(
      `udostępnienie mi – na podstawie art. 29 ust. 6 i 7 ${UDU} – w postaci elektronicznej informacji i dokumentów zgromadzonych w celu ustalenia odpowiedzialności i wysokości ${benefitWord(
        type,
        "gen",
      )}, w szczególności kalkulacji (kosztorysu), dokumentacji zdjęciowej, opinii rzeczoznawców lub lekarzy orzeczników`,
    );
  }

  const payment = iban
    ? `Należność proszę przelać na rachunek bankowy nr ${iban} (posiadacz rachunku: ${str(answers, "sender_name")}).`
    : "Należność proszę przelać na rachunek bankowy wskazany w zgłoszeniu szkody.";

  return [p("W związku z powyższym wnoszę o:"), list(items), p(payment)];
}

function legalParagraphs(answers: Answers): Paragraph[] {
  const type = insuranceType(answers);
  const vehicleIssue = str(answers, "vehicle_issue", "");
  const lifeIssue = str(answers, "life_issue", "");
  const out: Paragraph[] = [];

  if (type === "oc") {
    out.push(
      p(
        `Zgodnie z art. 822 § 1 i 4 ${KC} oraz art. 19 ust. 1 ${UUO} osoba uprawniona do odszkodowania może dochodzić roszczenia bezpośrednio od ubezpieczyciela odpowiedzialności cywilnej sprawcy. Odszkodowanie ustala się i wypłaca w granicach odpowiedzialności cywilnej posiadacza lub kierującego pojazdem mechanicznym, do wysokości sumy gwarancyjnej (art. 36 ust. 1 u.u.o.). Zakres odpowiedzialności zakładu ubezpieczeń odpowiada zatem zakresowi odpowiedzialności sprawcy szkody.`,
      ),
    );
    out.push(
      p(
        "Zgodnie z art. 361 § 2 k.c. naprawienie szkody obejmuje straty, które poszkodowany poniósł, oraz korzyści, które mógłby osiągnąć, gdyby mu szkody nie wyrządzono. Naprawienie szkody powinno nastąpić według wyboru poszkodowanego (art. 363 § 1 k.c.), a jeżeli ma nastąpić w pieniądzu, wysokość odszkodowania ustala się według cen z daty ustalenia odszkodowania (art. 363 § 2 k.c.). Odszkodowanie z ubezpieczenia OC ma więc w pełni wyrównać uszczerbek w majątku poszkodowanego.",
      ),
    );
    if (vehicleIssue === "repair_costs" || vehicleIssue === "") {
      out.push(
        p(
          "W uchwale z dnia 13 czerwca 2003 r., III CZP 32/03, Sąd Najwyższy przyjął, że odszkodowanie przysługujące od ubezpieczyciela odpowiedzialności cywilnej za uszkodzenie pojazdu mechanicznego obejmuje niezbędne i ekonomicznie uzasadnione koszty naprawy pojazdu, ustalone według cen występujących na lokalnym rynku. Z kolei w uchwale składu siedmiu sędziów z dnia 12 kwietnia 2012 r., III CZP 80/11, Sąd Najwyższy przyjął, że zakład ubezpieczeń zobowiązany jest na żądanie poszkodowanego do wypłaty odszkodowania obejmującego celowe i ekonomicznie uzasadnione koszty nowych części i materiałów służących do naprawy pojazdu, a odszkodowanie może ulec obniżeniu jedynie wtedy, gdy ubezpieczyciel wykaże, że prowadzi to do wzrostu wartości pojazdu. Zastosowanie w kalkulacji zamienników, stawek za roboczogodzinę niższych od stawek rynkowych lub potrąceń amortyzacyjnych bez wykazania wzrostu wartości pojazdu prowadzi do odszkodowania niepełnego.",
        ),
      );
    } else if (vehicleIssue === "rental") {
      out.push(
        p(
          "W uchwale składu siedmiu sędziów z dnia 17 listopada 2011 r., III CZP 5/11, Sąd Najwyższy przyjął, że odpowiedzialność ubezpieczyciela z tytułu obowiązkowego ubezpieczenia OC posiadaczy pojazdów mechanicznych za uszkodzenie albo zniszczenie pojazdu niesłużącego do prowadzenia działalności gospodarczej obejmuje celowe i ekonomicznie uzasadnione wydatki na najem pojazdu zastępczego i nie jest uzależniona od niemożności korzystania przez poszkodowanego z komunikacji zbiorowej.",
        ),
      );
    } else if (vehicleIssue === "total_loss") {
      out.push(
        p(
          "W przypadku szkody całkowitej odszkodowanie powinno odpowiadać różnicy między rynkową wartością pojazdu sprzed szkody a rzeczywistą wartością jego pozostałości, ustalonymi według realnych cen rynkowych. Zaniżenie wartości pojazdu sprzed szkody albo zawyżenie wartości pozostałości prowadzi do odszkodowania niepełnego, sprzecznego z art. 361 § 2 i art. 363 k.c.",
        ),
      );
    }
    out.push(
      p(
        "Zgodnie z art. 14 ust. 1 i 2 u.u.o. zakład ubezpieczeń wypłaca odszkodowanie w terminie 30 dni od dnia złożenia zawiadomienia o szkodzie, a bezsporną część odszkodowania – w każdym przypadku w tym terminie. Jeżeli odszkodowanie nie przysługuje lub przysługuje w innej wysokości niż określona w zgłoszonym roszczeniu, zakład ubezpieczeń wskazuje na piśmie okoliczności oraz podstawę prawną uzasadniającą całkowitą lub częściową odmowę wypłaty, a także przyczyny, dla których odmówił wiarygodności okolicznościom dowodowym podniesionym przez osobę zgłaszającą roszczenie (art. 14 ust. 3 u.u.o.).",
      ),
    );
  } else {
    const kind =
      type === "life"
        ? "przy ubezpieczeniu osobowym świadczenie polega na zapłacie umówionej sumy pieniężnej, renty lub innego świadczenia w razie zajścia przewidzianego w umowie wypadku w życiu osoby ubezpieczonej (art. 805 § 2 pkt 2 k.c.)"
        : "przy ubezpieczeniu majątkowym świadczenie polega na zapłacie określonego odszkodowania za szkodę powstałą wskutek przewidzianego w umowie wypadku (art. 805 § 2 pkt 1 k.c.)";
    out.push(
      p(
        `Zgodnie z art. 805 § 1 ${KC} przez umowę ubezpieczenia ubezpieczyciel zobowiązuje się spełnić określone świadczenie w razie zajścia przewidzianego w umowie wypadku, przy czym ${kind}. Zakres tego obowiązku wyznaczają umowa i ogólne warunki ubezpieczenia, które – jako wzorzec umowy – powinny być sformułowane jednoznacznie i w sposób zrozumiały, a postanowienia niejednoznaczne tłumaczy się na korzyść konsumenta (art. 385 § 2 k.c.).`,
      ),
    );
    if (type === "ac" && (vehicleIssue === "repair_costs" || vehicleIssue === "total_loss")) {
      out.push(
        p(
          "Wysokość odszkodowania należy ustalić zgodnie z wariantem rozliczenia przewidzianym w umowie. Wszelkie potrącenia (w szczególności amortyzacja części, zastosowanie zamienników lub obniżonych stawek za roboczogodzinę) są dopuszczalne wyłącznie w zakresie, w jakim wprost przewiduje je umowa lub ogólne warunki ubezpieczenia. Proszę o wskazanie konkretnych postanowień, na których oparto dokonane potrącenia.",
        ),
      );
    }
    if (type === "life" && lifeIssue === "exclusion") {
      out.push(
        p(
          "Jeżeli ubezpieczyciel powołuje się na wyłączenie odpowiedzialności, to na nim spoczywa ciężar udowodnienia okoliczności, z których wywodzi ten skutek prawny (art. 6 k.c.). Wyłączenia odpowiedzialności, jako wyjątki od ochrony ubezpieczeniowej, nie mogą być wykładane rozszerzająco, a ich niejednoznaczne brzmienie należy tłumaczyć na korzyść konsumenta (art. 385 § 2 k.c.). Postanowienia nieuzgodnione indywidualnie, kształtujące prawa i obowiązki konsumenta w sposób sprzeczny z dobrymi obyczajami i rażąco naruszające jego interesy, nie wiążą go (art. 385¹ § 1 k.c.).",
        ),
      );
    }
    out.push(
      p(
        "Zgodnie z art. 817 § 1 i 2 k.c. ubezpieczyciel obowiązany jest spełnić świadczenie w terminie 30 dni od daty otrzymania zawiadomienia o wypadku, a jeżeli wyjaśnienie okoliczności koniecznych do ustalenia odpowiedzialności albo wysokości świadczenia w tym terminie okazało się niemożliwe – w ciągu 14 dni od dnia, w którym przy zachowaniu należytej staranności wyjaśnienie tych okoliczności było możliwe. Bezsporną część świadczenia ubezpieczyciel powinien spełnić w terminie 30 dni.",
      ),
    );
  }

  out.push(
    p(
      `Zgodnie z art. 6 ${REKL} odpowiedzi na reklamację należy udzielić bez zbędnej zwłoki, nie później niż w terminie 30 dni od dnia jej otrzymania. Jedynie w szczególnie skomplikowanych przypadkach termin ten może zostać przedłużony do 60 dni, po przekazaniu informacji, o której mowa w art. 7 tej ustawy. W przypadku niedotrzymania tych terminów reklamację uważa się za rozpatrzoną zgodnie z wolą klienta (art. 8 tej ustawy).`,
    ),
  );
  return out;
}

export const odwolanieOdDecyzjiUbezpieczyciela: LetterTemplate = {
  slug: "odwolanie-od-decyzji-ubezpieczyciela",
  name: "Odwołanie od decyzji ubezpieczyciela",
  category: "finanse",
  shortDescription:
    "Odwołanie (reklamacja) od odmowy lub zaniżonego odszkodowania z OC sprawcy, AC, ubezpieczenia mieszkania albo polisy na życie i NNW.",
  priceGrosze: 2499,
  icon: "🛡️",
  estimatedMinutes: 8,
  sections: [
    {
      id: "sender",
      title: "Twoje dane",
      description: "Dane osoby, która zgłosiła szkodę – takie same jak w zgłoszeniu i w decyzji ubezpieczyciela.",
      questions: senderQuestions(),
    },
    {
      id: "recipient",
      title: "Ubezpieczyciel",
      description:
        "Nazwę i adres do korespondencji znajdziesz w nagłówku decyzji. Przy szkodzie z OC sprawcy odwołanie kierujesz do ubezpieczyciela sprawcy, a nie do swojego.",
      questions: recipientQuestions("Ubezpieczyciel"),
    },
    {
      id: "claim",
      title: "Szkoda i decyzja",
      questions: [
        {
          id: "insurance_type",
          label: "Z jakiego ubezpieczenia była wypłata?",
          type: "radio",
          help: "Od tego zależą przepisy, na które powołamy się w piśmie.",
          options: [
            { value: "oc", label: "Z OC sprawcy (szkoda komunikacyjna spowodowana przez inną osobę)" },
            { value: "ac", label: "Z mojego autocasco (AC)" },
            { value: "property", label: "Z ubezpieczenia mieszkania, domu lub innego mienia" },
            { value: "life", label: "Z ubezpieczenia na życie lub NNW (np. uszczerbek na zdrowiu)" },
          ],
        },
        {
          id: "claim_number",
          label: "Numer szkody",
          type: "text",
          placeholder: "np. PL2026123456-01",
          help: "Znajdziesz go w decyzji i w każdym piśmie od ubezpieczyciela.",
          validate: { maxLength: 60 },
        },
        {
          id: "policy_number",
          label: "Numer polisy (opcjonalnie)",
          type: "text",
          required: false,
          placeholder: "np. 920012345678",
          help: "Przy OC sprawcy to numer polisy sprawcy – podaj, jeśli go znasz.",
          validate: { maxLength: 60 },
        },
        {
          id: "event_date",
          label: "Data zdarzenia (wypadku, kolizji, zalania itp.)",
          type: "date",
          help: "Od tej daty ostrożnie policzymy termin przedawnienia.",
        },
        {
          id: "decision_date",
          label: "Data decyzji ubezpieczyciela",
          type: "date",
          help: "Data widniejąca na piśmie z decyzją albo data e-maila z decyzją.",
        },
        {
          id: "decision_type",
          label: "Co zdecydował ubezpieczyciel?",
          type: "radio",
          help: "Przy zaniżeniu policzymy w piśmie kwotę dopłaty.",
          options: [
            { value: "refusal", label: "Odmówił wypłaty w całości" },
            { value: "underpaid", label: "Wypłacił, ale za mało (zaniżone odszkodowanie lub świadczenie)" },
          ],
        },
        {
          id: "granted_amount",
          label: "Kwota przyznana przez ubezpieczyciela",
          type: "money",
          placeholder: "4200.00",
          help: "Łączna kwota z decyzji (lub suma dotychczasowych wypłat).",
          showIf: { questionId: "decision_type", equals: "underpaid" },
        },
        {
          id: "claimed_amount",
          label: "Jakiej łącznej kwoty się domagasz?",
          type: "money",
          placeholder: "9850.00",
          help: "Pełna kwota, która Twoim zdaniem się należy (np. według kosztorysu rzeczoznawcy lub faktury). Dopłatę policzymy sami.",
        },
        {
          id: "vehicle",
          label: "Pojazd – marka, model i numer rejestracyjny",
          type: "text",
          placeholder: "np. Toyota Corolla, WA 12345",
          showIf: { questionId: "insurance_type", equals: ["oc", "ac"] },
          validate: { maxLength: 120 },
        },
      ],
    },
    {
      id: "dispute",
      title: "Dlaczego się nie zgadzasz",
      description: "Napisz rzeczowo, co ubezpieczyciel pominął lub policzył źle. Konkretne kwoty i pozycje kosztorysu są najmocniejszym argumentem.",
      questions: [
        {
          id: "vehicle_issue",
          label: "Czego głównie dotyczy spór?",
          type: "radio",
          help: "Wybierz najważniejszy problem – dobierzemy do niego argumenty i orzecznictwo. Pozostałe opisz niżej.",
          showIf: { questionId: "insurance_type", equals: ["oc", "ac"] },
          options: [
            {
              value: "repair_costs",
              label: "Zaniżony kosztorys naprawy (zamienniki, niskie stawki za roboczogodzinę, amortyzacja części)",
            },
            { value: "total_loss", label: "Szkoda całkowita – zaniżona wartość auta lub zawyżona wartość wraku" },
            { value: "rental", label: "Odmowa zwrotu kosztów najmu auta zastępczego" },
            { value: "other", label: "Inny powód (np. odmowa uznania odpowiedzialności)" },
          ],
        },
        {
          id: "life_issue",
          label: "Czego głównie dotyczy spór?",
          type: "radio",
          help: "Wybierz najważniejszy problem – pozostałe opisz niżej.",
          showIf: { questionId: "insurance_type", equals: "life" },
          options: [
            { value: "percent", label: "Zaniżony procent uszczerbku na zdrowiu" },
            { value: "exclusion", label: "Ubezpieczyciel powołuje się na wyłączenie odpowiedzialności z OWU" },
            { value: "other", label: "Inny powód" },
          ],
        },
        {
          id: "insurer_reasoning",
          label: "Jak ubezpieczyciel uzasadnił decyzję?",
          type: "textarea",
          placeholder:
            "np. w kalkulacji przyjęto ceny części zamiennych jakości Q oraz stawkę 90 zł za roboczogodzinę; potrącono 30% amortyzacji części",
          required: false,
          help: "Streść najważniejsze argumenty z decyzji – własnymi słowami lub cytatem. Jeśli decyzja nie ma uzasadnienia, zostaw puste.",
          validate: { maxLength: 1500 },
        },
        {
          id: "disagreement",
          label: "Dlaczego się z tym nie zgadzasz?",
          type: "textarea",
          placeholder:
            "np. Auto ma 4 lata i było serwisowane w ASO, naprawiano je wyłącznie na częściach oryginalnych. Stawka za roboczogodzinę w warsztatach w mojej okolicy wynosi 160–200 zł. Kosztorys rzeczoznawcy wskazuje koszt naprawy 9850 zł.",
          help: "Każdy argument w osobnej linii. Podaj fakty i liczby, bez emocji.",
          validate: { maxLength: 2000 },
        },
        {
          id: "own_evidence",
          label: "Czy masz własny kosztorys, opinię lub fakturę?",
          type: "radio",
          help: "Niezależna wycena to najmocniejszy dowód w sporze z ubezpieczycielem.",
          options: [
            { value: "expert", label: "Tak – kosztorys lub opinię niezależnego rzeczoznawcy albo warsztatu" },
            { value: "invoice", label: "Tak – fakturę za wykonaną naprawę" },
            { value: "none", label: "Nie" },
          ],
        },
        {
          id: "expert_name",
          label: "Kto sporządził kosztorys, opinię lub fakturę? (opcjonalnie)",
          type: "text",
          required: false,
          placeholder: "np. rzeczoznawca samochodowy mgr inż. Jan Nowak / Warsztat AutoSerwis",
          showIf: { questionId: "own_evidence", equals: ["expert", "invoice"] },
          validate: { maxLength: 150 },
        },
      ],
    },
    {
      id: "demand",
      title: "Wypłata i załączniki",
      questions: [
        {
          id: "iban",
          label: "Numer rachunku do wypłaty (opcjonalnie)",
          type: "text",
          required: false,
          placeholder: "PL 00 0000 0000 0000 0000 0000 0000",
          help: "Jeśli zostawisz puste, poprosimy o wypłatę na rachunek ze zgłoszenia szkody.",
          validate: { maxLength: 40 },
        },
        {
          id: "request_files",
          label: "Chcę też zażądać udostępnienia akt szkody (kalkulacji, zdjęć, opinii)",
          type: "checkbox",
          required: false,
          help: "Ubezpieczyciel musi je udostępnić – także elektronicznie. Przydadzą się, jeśli sprawa trafi do Rzecznika Finansowego lub sądu.",
        },
        {
          id: "att_decision",
          label: "Załączam kopię decyzji ubezpieczyciela",
          type: "checkbox",
          required: false,
        },
        {
          id: "other_attachments",
          label: "Inne załączniki (opcjonalnie)",
          type: "text",
          required: false,
          placeholder: "np. zdjęcia uszkodzeń; dokumentacja medyczna; umowa najmu auta zastępczego",
          help: "Kilka pozycji oddziel średnikami.",
        },
        {
          id: "send_date",
          label: "Kiedy wyślesz odwołanie? (opcjonalnie)",
          type: "date",
          required: false,
          help: "Policzymy orientacyjnie, do kiedy ubezpieczyciel powinien odpowiedzieć.",
        },
      ],
    },
  ],
  legalBasis: [
    {
      act: "Ustawa z dnia 5 sierpnia 2015 r. o rozpatrywaniu reklamacji przez podmioty rynku finansowego, o Rzeczniku Finansowym i o Funduszu Edukacji Finansowej",
      article: "art. 2 pkt 2, art. 3, art. 6–8",
      summary:
        "Odwołanie od decyzji jest reklamacją: ubezpieczyciel ma 30 dni na odpowiedź (wyjątkowo 60), a jeśli nie odpowie w terminie, reklamację uważa się za rozpatrzoną zgodnie z Twoją wolą.",
      url: ISAP_REKL,
    },
    {
      act: "Ustawa z dnia 5 sierpnia 2015 r. o rozpatrywaniu reklamacji przez podmioty rynku finansowego, o Rzeczniku Finansowym i o Funduszu Edukacji Finansowej",
      article: "art. 17 ust. 1, art. 36–38",
      summary:
        "Po nieuwzględnieniu reklamacji możesz złożyć wniosek o interwencję do Rzecznika Finansowego (bezpłatnie) albo wszcząć postępowanie polubowne (opłata 50 zł).",
      url: ISAP_REKL,
    },
    {
      act: "Ustawa z dnia 22 maja 2003 r. o ubezpieczeniach obowiązkowych, Ubezpieczeniowym Funduszu Gwarancyjnym i Polskim Biurze Ubezpieczycieli Komunikacyjnych",
      article: "art. 14, art. 19 ust. 1, art. 36 ust. 1",
      summary:
        "Ubezpieczyciel OC sprawcy płaci w 30 dni (najpóźniej 90), uzasadnia odmowę na piśmie i odpowiada w granicach odpowiedzialności sprawcy – czyli za całą szkodę.",
      url: ISAP_UUO,
    },
    {
      act: "Ustawa z dnia 23 kwietnia 1964 r. – Kodeks cywilny",
      article: "art. 361 § 2, art. 363 § 1 i 2",
      summary:
        "Zasada pełnego odszkodowania: naprawienie szkody obejmuje rzeczywiste straty według cen z daty ustalenia odszkodowania.",
      url: ISAP_KC,
    },
    {
      act: "Ustawa z dnia 23 kwietnia 1964 r. – Kodeks cywilny",
      article: "art. 805, art. 817, art. 822",
      summary:
        "Ubezpieczyciel spełnia świadczenie w 30 dni od zgłoszenia (bezsporną część zawsze w tym terminie); z OC sprawcy możesz żądać zapłaty bezpośrednio od ubezpieczyciela.",
      url: ISAP_KC,
    },
    {
      act: "Ustawa z dnia 23 kwietnia 1964 r. – Kodeks cywilny",
      article: "art. 819 § 1, 3 i 4",
      summary:
        "Roszczenia z umowy ubezpieczenia przedawniają się po 3 latach; zgłoszenie szkody przerywa bieg przedawnienia, który biegnie na nowo od otrzymania decyzji.",
      url: ISAP_KC,
    },
  ],
  deadlines: [
    {
      id: "insurer_response",
      label: "Orientacyjny termin odpowiedzi ubezpieczyciela",
      fromQuestionId: "send_date",
      days: 30,
      description:
        "Ubezpieczyciel ma 30 dni od otrzymania odwołania na odpowiedź (art. 6 ustawy o rozpatrywaniu reklamacji). W szczególnie skomplikowanych sprawach może przedłużyć termin do 60 dni, ale musi Cię o tym poinformować i podać przyczynę. Brak odpowiedzi w terminie oznacza uznanie reklamacji (art. 8). Termin liczony od daty wysłania jest orientacyjny – dolicz czas doręczenia.",
    },
    {
      id: "limitation",
      label: "Ostrożny termin przedawnienia roszczenia",
      fromQuestionId: "event_date",
      years: 3,
      description:
        "Uproszczenie: 3 lata od zdarzenia to najwcześniejszy możliwy koniec przedawnienia. Roszczenia z umowy ubezpieczenia (AC, mienie, życie/NNW) przedawniają się po 3 latach (art. 819 § 1 k.c.), a z OC sprawcy – jak roszczenia wobec sprawcy, zwykle 3 lata od dowiedzenia się o szkodzie i sprawcy (art. 819 § 3, art. 442¹ k.c.). Zgłoszenie szkody przerywa bieg przedawnienia, który zaczyna się na nowo od otrzymania decyzji (art. 819 § 4 k.c.), więc faktycznie termin jest zwykle dłuższy – ale nie zwlekaj z pozwem do ostatniej chwili.",
    },
  ],
  instructions: {
    whereToSend: `Odwołanie wysyłasz do **ubezpieczyciela, który wydał decyzję** – na adres do korespondencji podany w nagłówku decyzji lub na stronie internetowej (zakładka „Reklamacje”).

- Przy szkodzie z **OC sprawcy** – do ubezpieczyciela sprawcy (nie do swojego).
- Przy **AC, ubezpieczeniu mieszkania, życia lub NNW** – do swojego ubezpieczyciela; numer polisy znajdziesz na polisie lub w aplikacji.
- Jeśli sprawę prowadzi agent ubezpieczeniowy, pismo złożone agentowi na piśmie także jest skuteczne, ale bezpieczniej wysłać je bezpośrednio do centrali.`,
    howToSend: `Reklamację możesz złożyć **na piśmie** – listem (najlepiej **poleconym za potwierdzeniem odbioru**) albo osobiście w placówce ubezpieczyciela (poproś o potwierdzenie przyjęcia na kopii) – a także **elektronicznie**: przez formularz reklamacyjny, w aplikacji lub e-mailem na adres podany przez ubezpieczyciela, albo na jego adres do doręczeń elektronicznych (e-Doręczenia).

Przy wysyłce elektronicznej dołącz podpisane pismo jako PDF i zachowaj potwierdzenie wysłania. Załączniki (kosztorys, faktury, zdjęcia) wysyłaj w kopii – oryginały zachowaj u siebie.`,
    afterSending: `Ubezpieczyciel ma **30 dni** od otrzymania reklamacji na odpowiedź, a w szczególnie skomplikowanych sprawach – maksymalnie **60 dni** (musi wtedy wyjaśnić przyczynę opóźnienia). **Brak odpowiedzi w terminie oznacza, że reklamację uznano za rozpatrzoną zgodnie z Twoją wolą** – możesz wtedy domagać się zapłaty, a w razie zwłoki skierować sprawę do Rzecznika Finansowego.

Jeśli ubezpieczyciel podtrzyma decyzję:
- złóż **wniosek o interwencję do Rzecznika Finansowego** – bezpłatnie, przez formularz na stronie rf.gov.pl,
- albo wnioskuj o **postępowanie polubowne przed Rzecznikiem Finansowym** (opłata 50 zł) – udział ubezpieczyciela jest obowiązkowy,
- rozważ **pozew do sądu** – sprawę z OC komunikacyjnego możesz wytoczyć przed sądem właściwym dla Twojego miejsca zamieszkania; przy kwotach do 20 000 zł sprawa toczy się w postępowaniu uproszczonym,
- przy dużych szkodach osobowych skonsultuj się z adwokatem lub radcą prawnym.`,
    checklist: [
      "Sprawdź numer szkody i datę decyzji – muszą zgadzać się z pismem ubezpieczyciela.",
      "Upewnij się, że kwota żądana wynika z kosztorysu, faktury lub dokumentacji, którą dołączasz.",
      "Dołącz kopię decyzji, kosztorysu lub opinii, zdjęcia i inne dowody (oryginały zachowaj).",
      "Podpisz pismo i zrób jego kopię lub skan.",
      "Wyślij listem poleconym za potwierdzeniem odbioru albo przez formularz reklamacyjny – zachowaj potwierdzenie.",
      "Zapisz w kalendarzu datę, w której mija 30 dni od doręczenia odwołania.",
    ],
  },
  seo: {
    title: "Odwołanie od decyzji ubezpieczyciela – wzór 2026",
    metaDescription:
      "Wzór odwołania od decyzji ubezpieczyciela: zaniżone odszkodowanie z OC lub AC, odmowa wypłaty, kosztorys. Generator z aktualnymi przepisami i terminami.",
    h1: "Odwołanie od decyzji ubezpieczyciela – wzór pisma z generatorem",
    intro:
      "Ubezpieczyciel zaniżył odszkodowanie z OC sprawcy, odrzucił szkodę z AC albo przyznał za niski procent uszczerbku? Odpowiedz na kilka pytań, a przygotujemy odwołanie (reklamację) z przepisami dobranymi do rodzaju ubezpieczenia i wyliczoną kwotą dopłaty. Pismo pobierzesz jako DOCX lub PDF.",
    keywords: [
      "odwołanie od decyzji ubezpieczyciela",
      "odwołanie od decyzji ubezpieczyciela wzór",
      "zaniżone odszkodowanie z oc",
      "odwołanie od kosztorysu ubezpieczyciela",
      "reklamacja do ubezpieczyciela wzór",
      "odmowa wypłaty odszkodowania odwołanie",
      "odwołanie od decyzji pzu wzór",
    ],
    guide: [
      {
        heading: "Kiedy warto odwołać się od decyzji ubezpieczyciela",
        body: `Decyzja ubezpieczyciela nie jest ostateczna. Możesz ją zakwestionować zawsze, gdy uważasz, że **odszkodowanie zostało zaniżone** albo **odmowa wypłaty jest niezasadna**. Najczęstsze sytuacje to:

- **zaniżony kosztorys naprawy auta z OC sprawcy** – części zamienne zamiast oryginalnych, stawka za roboczogodzinę wyraźnie niższa niż w warsztatach w Twojej okolicy, potrącenie „amortyzacji”,
- **szkoda całkowita** – ubezpieczyciel zaniżył wartość auta sprzed wypadku albo zawyżył wartość wraku,
- **odmowa zwrotu kosztów auta zastępczego** – choć przysługuje ono także osobom prywatnym,
- **AC, ubezpieczenie mieszkania** – odmowa z powołaniem na wyłączenie w ogólnych warunkach ubezpieczenia (OWU) albo potrącenia, których umowa nie przewiduje,
- **ubezpieczenie na życie i NNW** – zbyt niski procent uszczerbku na zdrowiu lub odmowa z powodu rzekomej choroby sprzed zawarcia umowy.

Odwołanie od decyzji to w świetle prawa **reklamacja** w rozumieniu ustawy o rozpatrywaniu reklamacji przez podmioty rynku finansowego. Dzięki temu obowiązują ustawowe terminy odpowiedzi, a brak odpowiedzi działa na Twoją korzyść.`,
      },
      {
        heading: "Odwołanie krok po kroku",
        body: `1. **Zażądaj akt szkody** – ubezpieczyciel musi udostępnić kalkulację, zdjęcia i opinie, także w formie elektronicznej (art. 29 ust. 6 i 7 ustawy o działalności ubezpieczeniowej). Bez nich trudno wykazać, gdzie tkwi błąd.
2. **Zdobądź własną wycenę** – kosztorys niezależnego rzeczoznawcy lub warsztatu, fakturę za naprawę, opinię lekarza specjalisty. To najmocniejszy dowód.
3. **Wypełnij generator** – wskaż rodzaj ubezpieczenia, numer szkody, kwotę przyznaną i żądaną. Generator sam policzy dopłatę i dobierze przepisy.
4. **Wyślij odwołanie** – listem poleconym za potwierdzeniem odbioru lub przez formularz reklamacyjny ubezpieczyciela.
5. **Pilnuj terminu** – ubezpieczyciel ma 30 dni na odpowiedź (wyjątkowo 60). Jeśli milczy, reklamację uważa się za uwzględnioną.`,
      },
      {
        heading: "Zaniżone odszkodowanie z OC sprawcy – co mówi prawo",
        body: `Ubezpieczyciel sprawcy odpowiada **w takim samym zakresie jak sprawca** (art. 36 ust. 1 ustawy o ubezpieczeniach obowiązkowych), a sprawca musi naprawić szkodę w pełni – pokryć rzeczywiste straty według aktualnych cen (art. 361 § 2 i art. 363 k.c.).

Sąd Najwyższy kilkakrotnie potwierdzał, co to oznacza w praktyce:

- odszkodowanie obejmuje **niezbędne i ekonomicznie uzasadnione koszty naprawy według cen na lokalnym rynku** (uchwała z 13 czerwca 2003 r., III CZP 32/03),
- poszkodowany może żądać kosztów **nowych części i materiałów**; obniżenie odszkodowania jest możliwe tylko wtedy, gdy ubezpieczyciel **wykaże**, że naprawa podniosła wartość auta (uchwała 7 sędziów z 12 kwietnia 2012 r., III CZP 80/11) – automatyczna „amortyzacja” jest więc wątpliwa,
- odszkodowanie obejmuje celowe i ekonomicznie uzasadnione **koszty najmu auta zastępczego**, także gdy poszkodowany mógłby jeździć komunikacją miejską (uchwała 7 sędziów z 17 listopada 2011 r., III CZP 5/11).

Przy AC jest inaczej: wysokość odszkodowania wyznacza umowa i OWU (np. wariant serwisowy albo kosztorysowy). Potrącenia są dopuszczalne tylko wtedy, gdy przewiduje je umowa, a niejasne zapisy OWU tłumaczy się na korzyść konsumenta (art. 385 § 2 k.c.).`,
      },
      {
        heading: "Terminy: 30 dni na wypłatę i odpowiedź, 3 lata na roszczenie",
        body: `- **30 dni na wypłatę** od zgłoszenia szkody (art. 817 k.c., art. 14 ustawy o ubezpieczeniach obowiązkowych). Gdy wyjaśnienie okoliczności jest trudne – 14 dni od ich wyjaśnienia, a przy OC najpóźniej 90 dni. **Bezsporną część** ubezpieczyciel musi wypłacić w 30 dni.
- **30 dni na odpowiedź na reklamację** od jej otrzymania (art. 6 ustawy o rozpatrywaniu reklamacji). W szczególnie skomplikowanych sprawach maksymalnie 60 dni – ale ubezpieczyciel musi Cię o tym uprzedzić i wyjaśnić przyczynę.
- **Milczenie = uznanie**. Jeśli ubezpieczyciel nie odpowie w terminie, reklamację uważa się za rozpatrzoną zgodnie z Twoją wolą (art. 8).
- **Przedawnienie**: roszczenia z umowy ubezpieczenia przedawniają się po 3 latach (art. 819 § 1 k.c.), z OC sprawcy – tak jak roszczenie wobec sprawcy (art. 819 § 3 k.c.). Zgłoszenie szkody przerywa bieg przedawnienia; biegnie ono na nowo od otrzymania decyzji (art. 819 § 4 k.c.).`,
      },
      {
        heading: "Najczęstsze błędy przy odwołaniu",
        body: `- **Ogólnikowość** – „nie zgadzam się z decyzją” to za mało. Wskaż konkretne pozycje kosztorysu, stawki, ceny części, procent uszczerbku.
- **Brak kwoty** – napisz, ile się należy i ile wynosi dopłata. Generator liczy to automatycznie.
- **Brak dowodów** – dołącz własny kosztorys, fakturę, zdjęcia, dokumentację medyczną. Ubezpieczyciel nie ma obowiązku szukać ich za Ciebie.
- **Podpisanie ugody lub „oświadczenia o zrzeczeniu się roszczeń”** w zamian za szybką wypłatę – to może zamknąć drogę do dalszych żądań. Czytaj uważnie każdy dokument od ubezpieczyciela.
- **Odwołanie do niewłaściwej firmy** – przy OC sprawcy piszesz do ubezpieczyciela sprawcy.
- **Czekanie latami** – im później, tym trudniej o dowody, a przedawnienie biegnie.`,
      },
      {
        heading: "Co zrobić, gdy ubezpieczyciel podtrzyma decyzję",
        body: `Po negatywnej odpowiedzi na reklamację masz kilka dróg:

- **Rzecznik Finansowy – wniosek o interwencję**: bezpłatny, składany przez formularz na stronie rf.gov.pl. Warunek: wcześniej musisz przejść postępowanie reklamacyjne – dlatego to odwołanie jest ważne.
- **Postępowanie polubowne przed Rzecznikiem Finansowym**: opłata 50 zł, udział ubezpieczyciela jest obowiązkowy, a Rzecznik może przedstawić propozycję rozwiązania sporu.
- **Miejski lub powiatowy rzecznik konsumentów** – bezpłatna pomoc dla konsumentów.
- **Pozew do sądu** – sprawy z OC komunikacyjnego możesz wytoczyć przed sądem miejsca swojego zamieszkania lub miejsca zdarzenia. W sądzie zwykle powołuje się biegłego, który niezależnie wyceni szkodę.

Przy poważnych szkodach osobowych (uszczerbek na zdrowiu, śmierć bliskiej osoby) warto skonsultować się z adwokatem lub radcą prawnym – kwoty zadośćuczynienia bywają wtedy wielokrotnie wyższe od zaproponowanych.`,
      },
    ],
    faq: [
      {
        question: "Ile czasu ma ubezpieczyciel na odpowiedź na odwołanie?",
        answer:
          "30 dni od otrzymania reklamacji. W szczególnie skomplikowanych sprawach może przedłużyć termin do 60 dni, ale musi Cię o tym poinformować, wyjaśnić przyczynę i wskazać nowy termin. Brak odpowiedzi w terminie oznacza, że reklamację uważa się za rozpatrzoną zgodnie z Twoją wolą.",
      },
      {
        question: "Czy ubezpieczyciel z OC sprawcy może potrącić amortyzację części?",
        answer:
          "Co do zasady nie powinien robić tego automatycznie. Sąd Najwyższy przyjął, że poszkodowany może żądać kosztów nowych części, a odszkodowanie można obniżyć tylko wtedy, gdy ubezpieczyciel wykaże, że naprawa zwiększyła wartość auta (uchwała III CZP 80/11). Przy AC decydują zapisy umowy i OWU.",
      },
      {
        question: "Czy muszę naprawić auto, żeby dostać pełne odszkodowanie?",
        answer:
          "Przy OC sprawcy możesz rozliczyć szkodę kosztorysowo, bez naprawy – odszkodowanie ma odpowiadać niezbędnym kosztom naprawy według cen rynkowych. Jeśli jednak naprawisz auto, faktura jest bardzo mocnym dowodem rzeczywistego kosztu.",
      },
      {
        question: "Czy osobie prywatnej należy się auto zastępcze z OC sprawcy?",
        answer:
          "Tak. Sąd Najwyższy przyjął, że celowe i ekonomicznie uzasadnione koszty najmu pojazdu zastępczego są objęte odpowiedzialnością ubezpieczyciela OC także wtedy, gdy auto nie służy do działalności gospodarczej i poszkodowany mógłby korzystać z komunikacji zbiorowej (uchwała III CZP 5/11).",
      },
      {
        question: "Czy mogę odwołać się e-mailem?",
        answer:
          "Tak. Reklamację można złożyć na piśmie – papierowo lub elektronicznie (np. przez formularz, e-mail na adres wskazany przez ubezpieczyciela albo na adres do doręczeń elektronicznych) – a także ustnie. Najlepiej mieć dowód wysłania i datę doręczenia, bo od niej liczy się 30 dni na odpowiedź.",
      },
      {
        question: "Ile kosztuje skarga do Rzecznika Finansowego?",
        answer:
          "Wniosek o interwencję Rzecznika Finansowego jest bezpłatny. Za wszczęcie postępowania polubownego przed Rzecznikiem pobierana jest opłata 50 zł (Rzecznik może z niej zwolnić w szczególnie uzasadnionych przypadkach). Warunkiem jest wcześniejsze złożenie reklamacji do ubezpieczyciela.",
      },
      {
        question: "Do kiedy mogę dochodzić dopłaty odszkodowania?",
        answer:
          "Roszczenia z umowy ubezpieczenia przedawniają się po 3 latach, a z OC sprawcy – tak jak roszczenie wobec sprawcy (zwykle 3 lata od dowiedzenia się o szkodzie i sprawcy). Zgłoszenie szkody przerywa bieg przedawnienia, który zaczyna się na nowo od otrzymania decyzji. Nie warto jednak zwlekać.",
      },
    ],
  },
  ai: {
    context:
      "Odwołanie (reklamacja) od decyzji zakładu ubezpieczeń składane przez osobę fizyczną – poszkodowanego z OC sprawcy albo uprawnionego z umowy AC, ubezpieczenia mienia, na życie lub NNW. Opis faktów ma chronologicznie przedstawić zdarzenie, zgłoszenie szkody, treść decyzji (odmowa albo zaniżona kwota) i jej uzasadnienie, a następnie rzeczowo wyjaśnić, dlaczego decyzja jest błędna – z konkretnymi kwotami, pozycjami kosztorysu, stawkami lub okolicznościami medycznymi podanymi przez użytkownika. Żądanie ma odpowiadać danym: wypłata pełnej kwoty przy odmowie albo dopłata różnicy między kwotą żądaną a przyznaną. Pisz w pierwszej osobie, w czasie teraźniejszym lub stronie biernej, bez form zależnych od płci (np. „szkoda została zgłoszona”, a nie „zgłosiłem”). Ton rzeczowy i stanowczy, bez emocji. Nie powołuj przepisów, uchwał ani terminów ustawowych – szablon dodaje je sam.",
    factQuestionIds: [
      "insurance_type",
      "event_date",
      "decision_date",
      "decision_type",
      "granted_amount",
      "claimed_amount",
      "vehicle_issue",
      "life_issue",
      "insurer_reasoning",
      "disagreement",
      "own_evidence",
    ],
  },
  render: ({ answers, ai, today }) => {
    const type = insuranceType(answers);
    const email = str(answers, "sender_email", "");
    const phone = str(answers, "sender_phone", "");
    const vehicle = str(answers, "vehicle", "");
    const policy = str(answers, "policy_number", "");

    const paragraphs: Paragraph[] = [introParagraph(answers)];

    if (ai?.facts) {
      paragraphs.push(...paragraphsFromText(ai.facts));
      paragraphs.push(...paragraphsFromText(ai.justification));
    } else {
      paragraphs.push(...factsParagraphs(answers));
    }

    if (ai?.demand) {
      paragraphs.push(...paragraphsFromText(ai.demand));
      paragraphs.push(...demandParagraphs(answers).map((par, i) => (i === 0 ? p("W szczególności wnoszę o:") : par)));
    } else {
      paragraphs.push(...demandParagraphs(answers));
    }

    paragraphs.push(heading("Uzasadnienie prawne"));
    paragraphs.push(...legalParagraphs(answers));

    paragraphs.push(
      p(
        `Proszę o odpowiedź na piśmie na adres wskazany w nagłówku${
          email ? ` lub na adres e-mail: ${email}` : ""
        }. W razie nieuwzględnienia reklamacji skieruję sprawę do Rzecznika Finansowego lub na drogę postępowania sądowego.`,
      ),
    );

    const attachments: string[] = [];
    if (bool(answers, "att_decision")) attachments.push("Kopia decyzji ubezpieczyciela");
    const evidence = str(answers, "own_evidence", "none");
    if (evidence === "expert") attachments.push("Kopia kosztorysu (opinii) rzeczoznawcy");
    if (evidence === "invoice") attachments.push("Kopia faktury za naprawę");
    attachments.push(...attachmentsFromText(str(answers, "other_attachments", "")));

    const subjectParts = [`Dotyczy: szkoda nr ${str(answers, "claim_number")}`];
    if (policy) subjectParts.push(`polisa nr ${policy}`);
    if (isVehicle(type) && vehicle) subjectParts.push(`pojazd ${vehicle}`);

    return {
      sender: partyFromAnswers(answers, "sender", [email ? `e-mail: ${email}` : "", phone ? `tel. ${phone}` : ""]),
      recipient: partyFromAnswers(answers, "recipient"),
      place: str(answers, "sender_city"),
      date: formatDatePl(today),
      title: "ODWOŁANIE OD DECYZJI UBEZPIECZYCIELA (REKLAMACJA)",
      subject: subjectParts.join(", "),
      salutation: "Szanowni Państwo,",
      paragraphs: paragraphs.map(tidyParagraph),
      closing: "Z poważaniem",
      signatureName: str(answers, "sender_name"),
      attachments,
      previewParagraphCount: 2,
    };
  },
};
