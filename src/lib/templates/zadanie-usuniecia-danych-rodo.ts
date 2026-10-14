import type { Answers, LetterTemplate, Paragraph } from "./types";
import {
  bool,
  formatDatePl,
  heading,
  list,
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
 * Pismo do administratora danych osobowych – 4 warianty (`request_type`):
 *  - erasure: żądanie usunięcia danych (art. 17 ust. 1 lit. a–d RODO, art. 17 ust. 3, art. 19),
 *  - objection: sprzeciw wobec marketingu bezpośredniego i profilowania (art. 21 ust. 2–3 RODO),
 *  - access: żądanie dostępu do danych i kopii (art. 15 ust. 1 i 3 RODO),
 *  - withdraw_consent: wycofanie zgody (art. 7 ust. 3 RODO).
 * Termin odpowiedzi: art. 12 ust. 3–5 RODO. Skarga: art. 77 RODO (Prezes UODO).
 * Zgoda na marketing e-mail/SMS/telefon: od 10.11.2024 r. art. 398 ust. 1 i art. 400 Prawa komunikacji
 * elektronicznej (Dz. U. z 2024 r. poz. 1221); art. 10 u.ś.u.d.e. uchylony przez art. 26 pkt 3 ustawy
 * wprowadzającej PKE (Dz. U. z 2024 r. poz. 1222) – sprawdzone w t.j. u.ś.u.d.e. Dz. U. z 2024 r. poz. 1513.
 * RODO: tekst PL z Dz. Urz. UE L 119 z 4.05.2016 (Publications Office / CELEX 32016R0679).
 * Szczegóły: docs/legal-review/zadanie-usuniecia-danych-rodo.md
 */

const RODO_FULL =
  "rozporządzenia Parlamentu Europejskiego i Rady (UE) 2016/679 z dnia 27 kwietnia 2016 r. w sprawie ochrony osób fizycznych w związku z przetwarzaniem danych osobowych i w sprawie swobodnego przepływu takich danych oraz uchylenia dyrektywy 95/46/WE (dalej: „RODO”)";
const EURLEX_RODO = "https://eur-lex.europa.eu/legal-content/PL/TXT/?uri=CELEX:32016R0679";
const ISAP_PKE = "https://isap.sejm.gov.pl/isap.nsf/DocDetails.xsp?id=WDU20240001221";

type RequestType = "erasure" | "objection" | "access" | "withdraw_consent";
type ErasureGround = "consent_withdrawn" | "not_needed" | "objection_marketing" | "unlawful";

function requestTypeOf(answers: Answers): RequestType {
  const v = str(answers, "request_type", "erasure");
  return v === "objection" || v === "access" || v === "withdraw_consent" ? v : "erasure";
}

function erasureGroundOf(answers: Answers): ErasureGround {
  const v = str(answers, "erasure_ground", "not_needed");
  return v === "consent_withdrawn" || v === "objection_marketing" || v === "unlawful" ? v : "not_needed";
}

/** Usuwa końcową kropkę i spacje, chyba że kropka kończy skrót (np. „r.”, „ul.”). */
function trimEndDot(text: string): string {
  return text.trim().replace(/(?<!\b(?:r|nr|ul|tj|np|ok|al|str|poz|ust|art|pkt|godz))\.+$/, "").trim();
}

/** Mała litera na początku (chyba że skrótowiec). */
function lowerFirst(text: string): string {
  return /^\p{Lu}\p{Lu}/u.test(text) ? text : text.charAt(0).toLowerCase() + text.slice(1);
}

const ERASURE_GROUND: Record<ErasureGround, { lit: string; text: string }> = {
  consent_withdrawn: {
    lit: "b",
    text: "Niniejszym wycofuję zgodę na przetwarzanie moich danych osobowych (art. 7 ust. 3 RODO), a według mojej wiedzy nie istnieje inna podstawa prawna ich przetwarzania.",
  },
  not_needed: {
    lit: "a",
    text: "Dane nie są już niezbędne do celów, w których zostały zebrane lub w inny sposób przetwarzane.",
  },
  objection_marketing: {
    lit: "c",
    text: "Jednocześnie, na podstawie art. 21 ust. 2 RODO, wnoszę sprzeciw wobec przetwarzania moich danych osobowych na potrzeby marketingu bezpośredniego, w tym profilowania w zakresie, w jakim jest ono związane z takim marketingiem.",
  },
  unlawful: {
    lit: "d",
    text: "Dane są przetwarzane niezgodnie z prawem – nie została wyrażona zgoda na ich przetwarzanie ani, według mojej wiedzy, nie zachodzi żadna inna przesłanka z art. 6 ust. 1 RODO.",
  },
};

function relationshipParagraph(answers: Answers): string {
  const source = str(answers, "data_source", "unknown");
  const details = trimEndDot(str(answers, "relationship_details", ""));
  const tail = details ? ` (${details})` : "";
  switch (source) {
    case "customer":
      return `Moje dane osobowe przetwarzają Państwo w związku z relacją klienta – obecną lub zakończoną${tail}.`;
    case "account":
      return `Moje dane osobowe zostały Państwu podane w związku z założeniem konta, zapisem na newsletter lub udziałem w akcji promocyjnej${tail}.`;
    default:
      return `Nie łączy mnie z Państwem żadna umowa i nie jest mi znane źródło, z którego pozyskali Państwo moje dane osobowe${tail}.`;
  }
}

function identifierItems(answers: Answers): string[] {
  const items: string[] = [];
  const e = str(answers, "id_email", "");
  const ph = str(answers, "id_phone", "");
  const c = str(answers, "id_customer_number", "");
  const o = str(answers, "id_other", "");
  if (e) items.push(`adres e-mail: ${e}`);
  if (ph) items.push(`numer telefonu: ${ph}`);
  if (c) items.push(`numer klienta, konta lub umowy: ${c}`);
  if (o) items.push(lowerFirst(trimEndDot(o)));
  return items;
}

const ACCESS_ITEMS = [
  "celach przetwarzania (art. 15 ust. 1 lit. a RODO)",
  "kategoriach przetwarzanych danych osobowych (lit. b)",
  "odbiorcach lub kategoriach odbiorców, którym dane zostały lub zostaną ujawnione, w szczególności odbiorcach w państwach trzecich lub organizacjach międzynarodowych (lit. c)",
  "planowanym okresie przechowywania danych, a gdy nie jest to możliwe – kryteriach ustalania tego okresu (lit. d)",
  "źródle danych, jeżeli nie zostały zebrane ode mnie (lit. g)",
  "zautomatyzowanym podejmowaniu decyzji, w tym profilowaniu, oraz zasadach jego dokonywania i przewidywanych konsekwencjach (lit. h)",
];

function variantParagraphs(answers: Answers, type: RequestType): Paragraph[] {
  const out: Paragraph[] = [];
  switch (type) {
    case "erasure": {
      const ground = ERASURE_GROUND[erasureGroundOf(answers)];
      out.push(
        p(
          `Na podstawie art. 17 ust. 1 lit. ${ground.lit} RODO żądam niezwłocznego usunięcia wszystkich dotyczących mnie danych osobowych przetwarzanych przez Państwa. ${ground.text}`,
        ),
      );
      out.push(
        p(
          "Jeżeli w Państwa ocenie część danych musi zostać zachowana na podstawie art. 17 ust. 3 RODO (np. w celu wywiązania się z obowiązku prawnego albo ustalenia, dochodzenia lub obrony roszczeń), proszę o wskazanie zakresu tych danych, podstawy prawnej i okresu ich przechowywania oraz o niewykorzystywanie ich w żadnym innym celu.",
        ),
      );
      if (bool(answers, "notify_recipients")) {
        out.push(
          p(
            "Proszę również o poinformowanie o usunięciu danych każdego odbiorcy, któremu zostały one ujawnione, oraz o wskazanie mi tych odbiorców (art. 19 RODO).",
          ),
        );
      }
      return out;
    }
    case "objection":
      out.push(
        p(
          "Na podstawie art. 21 ust. 2 RODO wnoszę sprzeciw wobec przetwarzania moich danych osobowych na potrzeby marketingu bezpośredniego, w tym profilowania w zakresie, w jakim jest ono związane z takim marketingiem. Zgodnie z art. 21 ust. 3 RODO po wniesieniu takiego sprzeciwu danych osobowych nie wolno już przetwarzać do tych celów. Sprzeciw wobec marketingu bezpośredniego nie wymaga uzasadnienia.",
        ),
      );
      out.push(
        p(
          "Proszę o potwierdzenie, że moje dane zostały wyłączone z wszelkich działań marketingowych, w tym z list mailingowych, kampanii SMS i telefonicznych oraz z profilowania w celach marketingowych.",
        ),
      );
      return out;
    case "access": {
      out.push(
        p(
          "Na podstawie art. 15 ust. 1 RODO żądam potwierdzenia, czy przetwarzają Państwo dotyczące mnie dane osobowe, a jeżeli tak – dostępu do nich oraz informacji o:",
        ),
      );
      out.push(list(ACCESS_ITEMS));
      const electronic = str(answers, "response_form", "email") === "email";
      out.push(
        p(
          `Na podstawie art. 15 ust. 3 RODO proszę o przekazanie kopii moich danych osobowych podlegających przetwarzaniu ${
            electronic ? "w powszechnie stosowanej formie elektronicznej" : "w formie papierowej"
          }. Pierwsza kopia danych jest bezpłatna (art. 15 ust. 3 w zw. z art. 12 ust. 5 RODO).`,
        ),
      );
      return out;
    }
    case "withdraw_consent": {
      const scope = trimEndDot(str(answers, "consent_scope", ""));
      out.push(
        p(
          `Na podstawie art. 7 ust. 3 RODO wycofuję ${
            scope ? `zgodę na przetwarzanie moich danych osobowych w zakresie: ${lowerFirst(scope)}` : "wszelkie udzielone Państwu zgody na przetwarzanie moich danych osobowych"
          }. Wycofanie zgody musi być równie łatwe jak jej wyrażenie i nie wymaga uzasadnienia.`,
        ),
      );
      out.push(
        p(
          "Proszę o zaprzestanie przetwarzania moich danych w celach objętych zgodą, a jeżeli nie istnieje inna podstawa prawna ich przetwarzania – o ich usunięcie (art. 17 ust. 1 lit. b RODO).",
        ),
      );
      return out;
    }
  }
}

export const zadanieUsunieciaDanychRodo: LetterTemplate = {
  slug: "zadanie-usuniecia-danych-rodo",
  name: "Żądanie usunięcia danych osobowych (RODO)",
  category: "dane-osobowe",
  shortDescription:
    "Żądanie usunięcia danych, sprzeciw wobec marketingu, wniosek o kopię danych lub wycofanie zgody – pismo do firmy na podstawie RODO.",
  priceGrosze: 1999,
  icon: "🔒",
  estimatedMinutes: 4,
  sections: [
    {
      id: "sender",
      title: "Twoje dane",
      description: "Dane osoby, której dotyczą dane osobowe. Podaj adres e-mail, jeśli chcesz dostać odpowiedź elektronicznie.",
      questions: senderQuestions(),
    },
    {
      id: "recipient",
      title: "Administrator danych",
      description:
        "Firma, która przetwarza Twoje dane. Jej nazwę, adres i e-mail inspektora ochrony danych (IOD) znajdziesz w polityce prywatności – zwykle w stopce strony lub w regulaminie.",
      questions: [
        ...recipientQuestions("Administrator danych"),
        {
          id: "recipient_iod_email",
          label: "Adres e-mail inspektora ochrony danych lub do spraw RODO (opcjonalnie)",
          type: "email",
          required: false,
          placeholder: "iod@firma.pl",
          help: "Jeśli firma go podaje, wyślij pismo także na ten adres – dopiszemy go w nagłówku.",
        },
      ],
    },
    {
      id: "request",
      title: "Czego żądasz",
      questions: [
        {
          id: "request_type",
          label: "Jakie pismo chcesz wysłać?",
          type: "radio",
          help: "Jeśli firma wysyła Ci reklamy, a nie chcesz usuwać konta – wybierz sprzeciw wobec marketingu.",
          options: [
            { value: "erasure", label: "Żądanie usunięcia moich danych („prawo do bycia zapomnianym”)" },
            { value: "objection", label: "Sprzeciw wobec marketingu i profilowania (bez usuwania konta)" },
            { value: "access", label: "Żądanie informacji, jakie dane firma ma, i ich kopii" },
            { value: "withdraw_consent", label: "Wycofanie zgody na przetwarzanie danych (np. newsletter, zgody marketingowe)" },
          ],
        },
        {
          id: "erasure_ground",
          label: "Dlaczego dane powinny zostać usunięte?",
          type: "radio",
          showIf: { questionId: "request_type", equals: "erasure" },
          help: "Wybierz powód najlepiej pasujący do sytuacji – od niego zależy przepis wskazany w piśmie.",
          options: [
            { value: "not_needed", label: "Nie korzystam już z usług firmy – dane nie są jej potrzebne" },
            { value: "consent_withdrawn", label: "Dane były przetwarzane na podstawie zgody, którą wycofuję" },
            { value: "objection_marketing", label: "Dane służą do marketingu, na który się nie zgadzam" },
            { value: "unlawful", label: "Nie wiem, skąd firma ma moje dane / nigdy nie wyrażono zgody" },
          ],
        },
        {
          id: "consent_scope",
          label: "Jakich zgód dotyczy wycofanie? (opcjonalnie)",
          type: "text",
          required: false,
          showIf: { questionId: "request_type", equals: "withdraw_consent" },
          placeholder: "np. newsletter, zgoda na przekazanie danych partnerom",
          help: "Zostaw puste, aby wycofać wszystkie zgody.",
        },
        {
          id: "stop_contact",
          label: "Żądam też zaprzestania kontaktu marketingowego (e-mail, SMS, telefon)",
          type: "checkbox",
          required: false,
          showIf: { questionId: "request_type", equals: ["erasure", "access", "withdraw_consent"] },
          help: "Pismo cofnie zgodę na reklamy przesyłane e-mailem, SMS-em i telefonicznie (art. 398 Prawa komunikacji elektronicznej). Przy sprzeciwie wobec marketingu dodajemy to automatycznie.",
        },
        {
          id: "notify_recipients",
          label: "Proszę o poinformowanie odbiorców moich danych o ich usunięciu",
          type: "checkbox",
          required: false,
          showIf: { questionId: "request_type", equals: "erasure" },
          help: "Firma ma obowiązek zawiadomić odbiorców (np. partnerów marketingowych) i na żądanie wskazać ich Tobie (art. 19 RODO).",
        },
      ],
    },
    {
      id: "identity",
      title: "Skąd firma ma dane i jak Cię znaleźć",
      description: "Podaj identyfikatory, pod którymi firma może Cię mieć w bazie – wystarczy jeden.",
      questions: [
        {
          id: "data_source",
          label: "Skąd firma ma Twoje dane?",
          type: "radio",
          options: [
            { value: "customer", label: "Relacja klienta – obecna lub zakończona (umowa, zakupy, konto)" },
            { value: "account", label: "Newsletter, konkurs, rejestracja w serwisie" },
            { value: "unknown", label: "Nie wiem – nie było żadnego kontaktu z tą firmą" },
          ],
          help: "Jeśli nie wiesz, skąd firma ma dane, rozważ dodatkowo żądanie dostępu do danych – firma musi wskazać ich źródło.",
        },
        {
          id: "relationship_details",
          label: "Szczegóły (opcjonalnie)",
          type: "text",
          required: false,
          placeholder: "np. umowa na internet zakończona w 2024 r., sklep internetowy, konto w aplikacji",
          help: "Krótko – pomoże firmie odnaleźć Twoje dane.",
        },
        {
          id: "id_email",
          label: "Adres e-mail, którego dotyczą dane (opcjonalnie)",
          type: "email",
          required: false,
          placeholder: "jan@przyklad.pl",
          help: "Adres, na który przychodzą wiadomości od firmy.",
        },
        {
          id: "id_phone",
          label: "Numer telefonu, którego dotyczą dane (opcjonalnie)",
          type: "phone",
          required: false,
          placeholder: "600 000 000",
          help: "Numer, na który firma dzwoni lub wysyła SMS-y.",
        },
        {
          id: "id_customer_number",
          label: "Numer klienta, konta lub umowy (opcjonalnie)",
          type: "text",
          required: false,
          placeholder: "np. 123456789",
        },
        {
          id: "id_other",
          label: "Inne dane identyfikujące (opcjonalnie)",
          type: "text",
          required: false,
          placeholder: "np. login: jan_k, poprzedni adres zamieszkania",
          help: "Nie podawaj numeru PESEL ani dokumentu tożsamości, jeśli firma ich nie zna.",
        },
        {
          id: "facts_context",
          label: "Opisz krótko sytuację (opcjonalnie)",
          type: "textarea",
          required: false,
          placeholder: "np. Od września 2026 r. otrzymuję SMS-y z ofertami pożyczek, choć nie zawierano żadnej umowy z tą firmą.",
          help: "Ten opis trafi do pisma jako kontekst żądania.",
          validate: { maxLength: 1000 },
        },
      ],
    },
    {
      id: "response",
      title: "Odpowiedź",
      questions: [
        {
          id: "response_form",
          label: "Jak chcesz otrzymać odpowiedź?",
          type: "radio",
          options: [
            { value: "email", label: "E-mailem (na adres z sekcji „Twoje dane”)" },
            { value: "letter", label: "Listownie na adres zamieszkania" },
          ],
          help: "Przy odpowiedzi e-mailem podaj adres e-mail w swoich danych.",
        },
        {
          id: "send_date",
          label: "Kiedy wyślesz pismo? (opcjonalnie)",
          type: "date",
          required: false,
          help: "Policzymy, do kiedy firma powinna odpowiedzieć (1 miesiąc).",
        },
      ],
    },
  ],
  legalBasis: [
    {
      act: "Rozporządzenie Parlamentu Europejskiego i Rady (UE) 2016/679 (RODO)",
      article: "art. 12 ust. 3–5",
      summary:
        "Administrator odpowiada bez zbędnej zwłoki, najpóźniej w ciągu miesiąca (w wyjątkowych przypadkach przedłużenie o 2 miesiące); działania są bezpłatne.",
      url: EURLEX_RODO,
    },
    {
      act: "Rozporządzenie Parlamentu Europejskiego i Rady (UE) 2016/679 (RODO)",
      article: "art. 17 i art. 19",
      summary:
        "Prawo do usunięcia danych, m.in. gdy nie są już potrzebne, wycofano zgodę, wniesiono sprzeciw lub dane przetwarzano bezprawnie; zawiadomienie odbiorców.",
      url: EURLEX_RODO,
    },
    {
      act: "Rozporządzenie Parlamentu Europejskiego i Rady (UE) 2016/679 (RODO)",
      article: "art. 21 ust. 2–3",
      summary: "Sprzeciw wobec marketingu bezpośredniego (także profilowania) – po jego wniesieniu dane nie mogą być już używane do marketingu.",
      url: EURLEX_RODO,
    },
    {
      act: "Rozporządzenie Parlamentu Europejskiego i Rady (UE) 2016/679 (RODO)",
      article: "art. 15",
      summary: "Prawo do informacji, czy i jakie dane są przetwarzane, w jakim celu, komu je ujawniono, skąd pochodzą – oraz do bezpłatnej kopii danych.",
      url: EURLEX_RODO,
    },
    {
      act: "Rozporządzenie Parlamentu Europejskiego i Rady (UE) 2016/679 (RODO)",
      article: "art. 7 ust. 3 i art. 77",
      summary: "Zgodę można wycofać w dowolnym momencie; w razie naruszeń przysługuje skarga do organu nadzorczego (Prezesa UODO).",
      url: EURLEX_RODO,
    },
    {
      act: "Ustawa z dnia 12 lipca 2024 r. – Prawo komunikacji elektronicznej",
      article: "art. 398 ust. 1 i art. 400",
      summary:
        "Reklamy e-mailem, SMS-em i przez telefon wymagają uprzedniej zgody; do zgody (i jej cofnięcia) stosuje się przepisy o ochronie danych osobowych.",
      url: ISAP_PKE,
    },
  ],
  deadlines: [
    {
      id: "rodo_response",
      label: "Termin odpowiedzi administratora (1 miesiąc)",
      fromQuestionId: "send_date",
      months: 1,
      description:
        "Administrator udziela informacji o działaniach podjętych w związku z żądaniem bez zbędnej zwłoki, najpóźniej w ciągu miesiąca od otrzymania żądania (art. 12 ust. 3 RODO). Termin liczony od wysłania jest orientacyjny – dolicz czas doręczenia.",
    },
    {
      id: "rodo_extended",
      label: "Najpóźniejszy termin przy przedłużeniu (3 miesiące)",
      fromQuestionId: "send_date",
      months: 3,
      description:
        "Z uwagi na skomplikowany charakter lub liczbę żądań termin można przedłużyć o kolejne 2 miesiące – ale administrator musi poinformować o tym w ciągu pierwszego miesiąca, podając przyczyny (art. 12 ust. 3 RODO).",
    },
  ],
  instructions: {
    whereToSend:
      "Wyślij pismo do **administratora danych** – firmy, która decyduje o przetwarzaniu Twoich danych. Dane kontaktowe znajdziesz w **polityce prywatności** lub klauzuli informacyjnej (art. 13–14 RODO): nazwę i adres firmy oraz – jeśli go wyznaczono – adres e-mail **inspektora ochrony danych (IOD)**. Najlepiej wysłać pismo na adres e-mail IOD lub adres wskazany do realizacji praw z RODO.\n\nJeśli nie znasz administratora (np. dzwoni do Ciebie „call center”), zapytaj w rozmowie, w czyim imieniu dzwonią, i skąd mają numer – albo wyślij najpierw żądanie dostępu do danych.",
    howToSend:
      "Najprościej: **e-mail** z pismem w PDF (podpisanym albo zeskanowanym) na adres IOD lub do spraw danych osobowych – zachowaj wysłaną wiadomość. Możesz też wysłać **list polecony za potwierdzeniem odbioru** na adres siedziby firmy lub skorzystać z formularza w panelu klienta, jeśli firma go udostępnia.\n\nNie dołączaj kopii dowodu osobistego ani numeru PESEL – firma może poprosić o dodatkowe dane tylko wtedy, gdy ma uzasadnione wątpliwości co do Twojej tożsamości (art. 12 ust. 6 RODO), i tylko w niezbędnym zakresie.",
    afterSending:
      "Administrator powinien odpowiedzieć **bez zbędnej zwłoki, najpóźniej w ciągu miesiąca** od otrzymania pisma; termin może przedłużyć o 2 miesiące, ale musi Cię o tym poinformować w pierwszym miesiącu (art. 12 ust. 3 RODO). Realizacja Twoich praw jest **bezpłatna**.\n\nJeśli firma nie odpowie, odmówi bez uzasadnienia albo dalej wysyła reklamy:\n- złóż **skargę do Prezesa Urzędu Ochrony Danych Osobowych** (art. 77 RODO) – jest bezpłatna; formularz i dane adresowe znajdziesz na stronie uodo.gov.pl (skargę można też złożyć elektronicznie, np. przez ePUAP),\n- możesz także dochodzić ochrony przed sądem (art. 79 RODO) oraz odszkodowania za szkodę wynikłą z naruszenia (art. 82 RODO),\n- uciążliwe telefony i SMS-y z reklamami możesz dodatkowo zgłosić do Prezesa UKE lub UOKiK.",
    checklist: [
      "Sprawdź w polityce prywatności dokładną nazwę administratora i adres e-mail IOD.",
      "Podaj co najmniej jeden identyfikator (e-mail, telefon, numer klienta), pod którym firma ma Twoje dane.",
      "Nie dołączaj kopii dowodu osobistego ani numeru PESEL.",
      "Podpisz pismo (albo wyślij skan z podpisem) i zachowaj kopię oraz potwierdzenie wysyłki.",
      "Zapisz w kalendarzu datę upływu miesiąca od doręczenia pisma.",
      "Po terminie bez odpowiedzi – przygotuj skargę do Prezesa UODO.",
    ],
  },
  seo: {
    title: "Żądanie usunięcia danych osobowych – wzór RODO 2026",
    metaDescription:
      "Wzór żądania usunięcia danych (art. 17 RODO), sprzeciwu wobec marketingu, wniosku o kopię danych i wycofania zgody. Generator pisma do firmy.",
    h1: "Żądanie usunięcia danych osobowych (RODO) – wzór i generator",
    intro:
      "Firma wysyła Ci reklamy, choć nie jesteś już klientem, albo nie wiesz, skąd ma Twój numer? Wybierz, czego chcesz – usunięcia danych, sprzeciwu wobec marketingu, informacji o przetwarzanych danych lub wycofania zgody – a przygotujemy pismo z właściwymi przepisami RODO i terminem odpowiedzi.",
    keywords: [
      "żądanie usunięcia danych osobowych wzór",
      "prawo do bycia zapomnianym",
      "art. 17 RODO",
      "sprzeciw wobec marketingu bezpośredniego",
      "wycofanie zgody na przetwarzanie danych wzór",
      "wniosek o dostęp do danych osobowych art. 15 RODO",
      "jak usunąć swoje dane z bazy firmy",
      "skarga do UODO",
    ],
    guide: [
      {
        heading: "Jakie prawa daje Ci RODO",
        body: `Ogólne rozporządzenie o ochronie danych (RODO) daje każdej osobie fizycznej kontrolę nad tym, co firmy robią z jej danymi. Najczęściej wykorzystywane uprawnienia to:

- **prawo do usunięcia danych** („prawo do bycia zapomnianym”, art. 17),
- **prawo sprzeciwu** wobec marketingu bezpośredniego i profilowania (art. 21 ust. 2–3),
- **prawo dostępu** do danych i otrzymania ich kopii (art. 15),
- **prawo do wycofania zgody** w dowolnym momencie (art. 7 ust. 3).

Wszystkie realizujesz, składając pismo do **administratora danych** – firmy, która decyduje o celach i sposobach przetwarzania. Nie musisz używać żadnego formularza, a realizacja żądania jest **bezpłatna** (art. 12 ust. 5). Administrator ma obowiązek ułatwić Ci skorzystanie z praw i odpowiedzieć w ciągu miesiąca.`,
      },
      {
        heading: "Kiedy firma musi usunąć Twoje dane",
        body: `Art. 17 ust. 1 RODO wymienia sytuacje, w których administrator musi usunąć dane bez zbędnej zwłoki. Najważniejsze z nich:

- **dane nie są już potrzebne** do celów, w których je zebrano – np. umowa się zakończyła, a firma trzyma dane „na zapas” (lit. a),
- **wycofano zgodę**, na której opierało się przetwarzanie, i nie ma innej podstawy prawnej (lit. b),
- wniesiono **sprzeciw wobec marketingu bezpośredniego** (lit. c),
- dane są przetwarzane **niezgodnie z prawem** – np. firma nie ma żadnej podstawy, by je mieć (lit. d).

Prawo do usunięcia nie jest jednak bezwzględne. Firma może zachować część danych, jeśli są niezbędne m.in. do **wywiązania się z obowiązku prawnego** (np. przechowywanie faktur przez okres wymagany przepisami podatkowymi) lub **ustalenia, dochodzenia albo obrony roszczeń** (art. 17 ust. 3). Nasze pismo prosi, by w takim przypadku firma wskazała zakres zachowanych danych, podstawę prawną i okres przechowywania.`,
      },
      {
        heading: "Sprzeciw wobec marketingu – najszybszy sposób na koniec reklam",
        body: `Jeśli chcesz dalej korzystać z usług firmy, ale nie chcesz dostawać ofert, nie musisz usuwać konta. Wystarczy **sprzeciw wobec przetwarzania danych na potrzeby marketingu bezpośredniego** (art. 21 ust. 2 RODO). Taki sprzeciw:

- **nie wymaga uzasadnienia**,
- jest **bezwzględny** – po jego wniesieniu danych nie wolno już przetwarzać do celów marketingowych (art. 21 ust. 3),
- obejmuje także **profilowanie** związane z marketingiem (np. dobieranie ofert na podstawie historii zakupów).

Reklamy wysyłane e-mailem, SMS-em i telefonicznie wymagają ponadto Twojej uprzedniej zgody. Od 10 listopada 2024 r. reguluje to art. 398 ustawy – Prawo komunikacji elektronicznej, który zastąpił dawny art. 10 ustawy o świadczeniu usług drogą elektroniczną i art. 172 Prawa telekomunikacyjnego. Do udzielania i cofania tej zgody stosuje się przepisy o ochronie danych osobowych (art. 400 PKE) – możesz ją więc cofnąć w każdej chwili, także w naszym piśmie.`,
      },
      {
        heading: "Dostęp do danych – sprawdź, co firma o Tobie wie",
        body: `Nie wiesz, skąd firma ma Twój numer telefonu? Złóż **żądanie dostępu do danych** (art. 15 RODO). Administrator musi potwierdzić, czy przetwarza Twoje dane, a jeśli tak – udostępnić je i poinformować m.in. o:

- celach przetwarzania i kategoriach danych,
- odbiorcach, którym dane ujawniono (np. partnerzy, firmy windykacyjne),
- okresie przechowywania,
- **źródle danych**, jeśli nie zebrano ich od Ciebie,
- profilowaniu i zautomatyzowanym podejmowaniu decyzji.

Masz też prawo do **kopii danych** – pierwsza jest bezpłatna, a jeśli wysyłasz żądanie e-mailem, kopię otrzymasz w formie elektronicznej (art. 15 ust. 3). Odpowiedź na takie żądanie często pomaga ustalić, kto sprzedał lub udostępnił Twoje dane – i do kogo skierować kolejne pismo.`,
      },
      {
        heading: "Jak wysłać pismo i ile czeka się na odpowiedź",
        body: `1. **Znajdź administratora** – w polityce prywatności znajdziesz jego nazwę, adres i e-mail inspektora ochrony danych (IOD).
2. **Wypełnij generator** – wybierz rodzaj żądania i podaj identyfikatory (e-mail, telefon, numer klienta), aby firma mogła Cię odnaleźć w bazie.
3. **Wyślij pismo** e-mailem na adres IOD (PDF) albo listem poleconym. Zachowaj dowód wysyłki.
4. **Czekaj maksymalnie miesiąc** – tyle ma administrator na odpowiedź (art. 12 ust. 3 RODO). W wyjątkowych przypadkach może przedłużyć termin o 2 miesiące, ale musi Cię o tym zawiadomić w pierwszym miesiącu i podać przyczyny.

Firma może poprosić o dodatkowe informacje tylko przy **uzasadnionych wątpliwościach co do tożsamości** (art. 12 ust. 6). Nie musisz wysyłać skanu dowodu osobistego – to zwykle nadmiarowe.`,
      },
      {
        heading: "Co zrobić, gdy firma nie odpowiada",
        body: `Brak odpowiedzi w ciągu miesiąca, odmowa bez uzasadnienia albo dalsze wysyłanie reklam po sprzeciwie to podstawa do **skargi do Prezesa Urzędu Ochrony Danych Osobowych** (art. 77 RODO). Skarga jest bezpłatna – formularz i dane adresowe znajdziesz na stronie uodo.gov.pl; możesz ją złożyć listownie albo elektronicznie. Dołącz kopię swojego pisma i dowód jego wysłania.

Niezależnie od skargi możesz dochodzić ochrony przed **sądem** (art. 79 RODO), a jeśli naruszenie wyrządziło Ci szkodę majątkową lub niemajątkową – żądać **odszkodowania** od administratora (art. 82 RODO). Przy uporczywym telemarketingu warto też zachować nagrania lub zrzuty ekranu SMS-ów – przydadzą się jako dowód.`,
      },
    ],
    faq: [
      {
        question: "Ile czasu ma firma na usunięcie moich danych?",
        answer:
          "Administrator musi odpowiedzieć bez zbędnej zwłoki, najpóźniej w ciągu miesiąca od otrzymania żądania. W wyjątkowych przypadkach może przedłużyć ten termin o 2 miesiące, informując Cię o tym w pierwszym miesiącu (art. 12 ust. 3 RODO).",
      },
      {
        question: "Czy firma może odmówić usunięcia danych?",
        answer:
          "Tak, w zakresie, w jakim dane są niezbędne np. do wykonania obowiązku prawnego (przechowywanie faktur) albo do ustalenia, dochodzenia lub obrony roszczeń (art. 17 ust. 3 RODO). Powinna jednak wskazać, jakie dane zachowuje, na jakiej podstawie i jak długo.",
      },
      {
        question: "Czy za realizację żądania trzeba zapłacić?",
        answer:
          "Nie. Realizacja praw z RODO jest bezpłatna (art. 12 ust. 5). Opłatę można pobrać tylko przy żądaniach ewidentnie nieuzasadnionych lub nadmiernych, np. powtarzanych uporczywie, albo za kolejne kopie danych.",
      },
      {
        question: "Czym różni się sprzeciw od usunięcia danych?",
        answer:
          "Sprzeciw wobec marketingu (art. 21 ust. 2 RODO) zatrzymuje wyłącznie reklamy i profilowanie – możesz dalej korzystać z usług firmy. Żądanie usunięcia (art. 17) oznacza usunięcie danych w całości, z wyjątkiem tych, które firma musi zachować na podstawie przepisów.",
      },
      {
        question: "Czy muszę wysyłać kopię dowodu osobistego?",
        answer:
          "Nie. Wystarczą dane, które pozwolą firmie odnaleźć Cię w bazie (e-mail, telefon, numer klienta). Dodatkowych informacji firma może żądać tylko przy uzasadnionych wątpliwościach co do tożsamości (art. 12 ust. 6 RODO).",
      },
      {
        question: "Gdzie złożyć skargę, jeśli firma nie odpowiada?",
        answer:
          "Do Prezesa Urzędu Ochrony Danych Osobowych (art. 77 RODO). Skarga jest bezpłatna; formularz znajdziesz na stronie uodo.gov.pl. Dołącz kopię swojego pisma i potwierdzenie jego wysłania.",
      },
      {
        question: "Dzwonią do mnie z ofertami bez mojej zgody – co robić?",
        answer:
          "Zapytaj w rozmowie o nazwę firmy, w której imieniu dzwonią. Następnie wyślij żądanie dostępu do danych (by poznać ich źródło) albo od razu sprzeciw wobec marketingu i żądanie usunięcia. Telemarketing bez uprzedniej zgody narusza art. 398 Prawa komunikacji elektronicznej.",
      },
    ],
  },
  ai: {
    context:
      "Pismo osoby fizycznej do administratora danych osobowych: żądanie usunięcia danych, sprzeciw wobec marketingu bezpośredniego, żądanie dostępu do danych albo wycofanie zgody. Opis faktów ma krótko i rzeczowo przedstawić relację z administratorem (np. była umowa, newsletter, brak jakiegokolwiek kontaktu) oraz okoliczności, które skłoniły do napisania pisma (np. niechciane SMS-y od określonej daty). Nie formułuj żądań prawnych, terminów ani podstaw prawnych – szablon dodaje je sam. Nie dodawaj danych osobowych, których użytkownik nie podał. Ton uprzejmy, rzeczowy i stanowczy; pisz w pierwszej osobie, neutralnie płciowo (bez form typu „zapisałem/zapisałam”).",
    factQuestionIds: ["request_type", "data_source", "relationship_details", "facts_context"],
  },
  render: ({ answers, ai, today }) => {
    const type = requestTypeOf(answers);
    const email = str(answers, "sender_email", "");
    const phone = str(answers, "sender_phone", "");
    const iod = str(answers, "recipient_iod_email", "");
    const responseByEmail = str(answers, "response_form", "email") === "email" && !!email;
    const paragraphs: Paragraph[] = [];

    const intros: Record<RequestType, string> = {
      erasure: "zwracam się z żądaniem usunięcia dotyczących mnie danych osobowych",
      objection: "wnoszę sprzeciw wobec przetwarzania dotyczących mnie danych osobowych na potrzeby marketingu bezpośredniego",
      access: "zwracam się z żądaniem dostępu do dotyczących mnie danych osobowych",
      withdraw_consent: "składam oświadczenie o wycofaniu zgody na przetwarzanie dotyczących mnie danych osobowych",
    };
    paragraphs.push(p(`Działając na podstawie ${RODO_FULL}, jako osoba, której dane dotyczą, ${intros[type]}.`));

    // Stan faktyczny
    if (ai?.facts) {
      paragraphs.push(...paragraphsFromText(ai.facts));
    } else {
      paragraphs.push(p(relationshipParagraph(answers)));
      const context = str(answers, "facts_context", "");
      if (context) userParagraphs(context).forEach((t) => paragraphs.push(p(t)));
    }

    // Identyfikacja
    const ids = identifierItems(answers);
    if (ids.length) {
      paragraphs.push(p("Aby umożliwić odnalezienie moich danych, wskazuję identyfikatory, pod którymi mogą być przez Państwa przetwarzane:"));
      paragraphs.push(list(ids));
    } else {
      paragraphs.push(p("Moje dane identyfikacyjne (imię, nazwisko i adres) zawiera nagłówek niniejszego pisma."));
    }

    // Żądanie
    paragraphs.push(heading("Żądanie"));
    paragraphs.push(...variantParagraphs(answers, type));
    if (ai?.demand) paragraphs.push(...paragraphsFromText(ai.demand));

    if (type === "objection" || bool(answers, "stop_contact")) {
      paragraphs.push(
        p(
          "Jednocześnie cofam wszelkie zgody na kierowanie do mnie informacji handlowych, w tym marketingu bezpośredniego, za pomocą telekomunikacyjnych urządzeń końcowych (poczta elektroniczna, SMS, połączenia telefoniczne) oraz automatycznych systemów wywołujących, o których mowa w art. 398 ust. 1 ustawy z dnia 12 lipca 2024 r. – Prawo komunikacji elektronicznej. Do cofnięcia tej zgody stosuje się odpowiednio przepisy o ochronie danych osobowych (art. 400 tej ustawy), w tym art. 7 ust. 3 RODO. Proszę o zaprzestanie wszelkiego kontaktu ze mną w celach marketingowych.",
        ),
      );
    }

    // Termin i forma odpowiedzi
    paragraphs.push(heading("Termin odpowiedzi"));
    paragraphs.push(
      p(
        "Zgodnie z art. 12 ust. 3 RODO informacji o działaniach podjętych w związku z niniejszym żądaniem należy udzielić bez zbędnej zwłoki, a w każdym razie w terminie miesiąca od jego otrzymania. Termin ten może zostać przedłużony o kolejne dwa miesiące wyłącznie z uwagi na skomplikowany charakter żądania lub liczbę żądań – o przedłużeniu i jego przyczynach należy mnie poinformować w terminie miesiąca. Działania te są wolne od opłat (art. 12 ust. 5 RODO).",
      ),
    );
    paragraphs.push(
      p(
        `${
          responseByEmail
            ? `Odpowiedź proszę przesłać na adres e-mail: ${email}.`
            : "Odpowiedź proszę przesłać listownie na adres wskazany w nagłówku pisma."
        } Dane identyfikacyjne podaję w zakresie niezbędnym do odnalezienia moich danych; w razie uzasadnionych wątpliwości co do mojej tożsamości (art. 12 ust. 6 RODO) proszę o kontakt${
          email ? " na wskazany adres e-mail" : " listowny"
        }. W razie braku odpowiedzi w terminie zastrzegam sobie prawo wniesienia skargi do Prezesa Urzędu Ochrony Danych Osobowych (art. 77 RODO).`,
      ),
    );

    const titles: Record<RequestType, string> = {
      erasure: "ŻĄDANIE USUNIĘCIA DANYCH OSOBOWYCH",
      objection: "SPRZECIW WOBEC PRZETWARZANIA DANYCH OSOBOWYCH W CELACH MARKETINGOWYCH",
      access: "ŻĄDANIE DOSTĘPU DO DANYCH OSOBOWYCH",
      withdraw_consent: "WYCOFANIE ZGODY NA PRZETWARZANIE DANYCH OSOBOWYCH",
    };
    const subjects: Record<RequestType, string> = {
      erasure: "dot. art. 17 RODO",
      objection: "dot. art. 21 ust. 2 RODO",
      access: "dot. art. 15 RODO",
      withdraw_consent: "dot. art. 7 ust. 3 RODO",
    };

    return {
      sender: partyFromAnswers(answers, "sender", [email ? `e-mail: ${email}` : "", phone ? `tel. ${phone}` : ""]),
      recipient: partyFromAnswers(answers, "recipient", [iod ? `inspektor ochrony danych: ${iod}` : ""]),
      place: str(answers, "sender_city"),
      date: formatDatePl(today),
      title: titles[type],
      subject: subjects[type],
      salutation: "Szanowni Państwo,",
      paragraphs: paragraphs.map(tidyParagraph),
      closing: "Z poważaniem",
      signatureName: str(answers, "sender_name"),
      attachments: [],
      previewParagraphCount: 2,
    };
  },
};
