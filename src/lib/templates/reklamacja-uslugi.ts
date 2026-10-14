import type { Answers, LetterTemplate, Paragraph } from "./types";
import {
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
 * Reklamacja wadliwie wykonanej usługi. Reżim prawny zależy od rodzaju usługi (`service_type`):
 *  - work (remont, montaż, naprawa – umowa o dzieło): art. 627, 636 § 1 (prace w toku), art. 638 § 1 k.c.
 *    → rękojmia odpowiednio (art. 556 i n., 560, 561, 561³, 561⁵, 568 k.c.); odszkodowanie art. 471 k.c.
 *    Dzieło będące rzeczą ruchomą (np. meble na wymiar) podlega u.p.k. rozdz. 5a (art. 43a ust. 1) –
 *    kierujemy wtedy do szablonu „reklamacja towaru” (help w kwestionariuszu).
 *  - service / course (fryzjer, kosmetyka, sprzątanie, kurs stacjonarny): art. 750, 355, 471, 363 § 1 k.c.
 *  - digital (aplikacja, kurs online, subskrypcja) – konsument/JDG: u.p.k. rozdz. 5b (art. 43k–43o);
 *    przedsiębiorca: jak „service”.
 *  - telecom (telefon, internet, TV): Prawo komunikacji elektronicznej art. 378–379 (30 dni, milczenie = uznanie).
 * Odpowiedź na reklamację konsumenta: art. 7a u.p.k. (14 dni, milczenie = uznanie).
 * Zweryfikowano z t.j.: k.c. Dz. U. z 2026 r. poz. 795, u.p.k. Dz. U. z 2026 r. poz. 1244, PKE Dz. U. z 2024 r. poz. 1221.
 * Szczegóły: docs/legal-review/reklamacja-uslugi.md
 */

const KC_FULL = "ustawy z dnia 23 kwietnia 1964 r. – Kodeks cywilny (dalej: „k.c.”)";
const UPK_FULL = "ustawy z dnia 30 maja 2014 r. o prawach konsumenta (dalej: „u.p.k.”)";
const PKE_FULL = "ustawy z dnia 12 lipca 2024 r. – Prawo komunikacji elektronicznej (dalej: „PKE”)";
const ISAP_KC = "https://isap.sejm.gov.pl/isap.nsf/DocDetails.xsp?id=WDU19640160093";
const ISAP_UPK = "https://isap.sejm.gov.pl/isap.nsf/DocDetails.xsp?id=WDU20140000827";
const ISAP_PKE = "https://isap.sejm.gov.pl/isap.nsf/DocDetails.xsp?id=WDU20240001221";

type ServiceType = "work" | "service" | "course" | "digital" | "telecom";
type Status = "consumer" | "jdg" | "business";
type Regime = "work" | "work_in_progress" | "services" | "digital" | "telecom";

function dateAnswer(answers: Answers, id: string): Date | undefined {
  const v = answers[id];
  if (typeof v !== "string") return undefined;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v.trim());
  if (!m) return undefined;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

function serviceTypeOf(answers: Answers): ServiceType {
  const v = str(answers, "service_type", "work");
  return v === "service" || v === "course" || v === "digital" || v === "telecom" ? v : "work";
}

function statusOf(answers: Answers): Status {
  const v = str(answers, "customer_status", "consumer");
  return v === "jdg" || v === "business" ? v : "consumer";
}

function regimeOf(answers: Answers): Regime {
  const type = serviceTypeOf(answers);
  if (type === "telecom") return "telecom";
  if (type === "work") return str(answers, "work_status", "finished") === "in_progress" ? "work_in_progress" : "work";
  if (type === "digital" && statusOf(answers) !== "business") return "digital";
  return "services";
}

/** Żądanie znormalizowane do jednego klucza niezależnie od wariantu pytania. */
function demandOf(answers: Answers, regime: Regime): string {
  switch (regime) {
    case "work":
      return str(answers, "demand_work", "fix");
    case "services":
      if (serviceTypeOf(answers) === "digital") {
        // przedsiębiorca kupujący usługę cyfrową – mapujemy żądanie na reżim ogólny (art. 471 k.c.)
        const map: Record<string, string> = { fix: "redo", reduce: "reduce", withdraw: "refund" };
        return map[str(answers, "demand_digital", "fix")] ?? "redo";
      }
      return str(answers, "demand_service", "redo");
    case "digital":
      return str(answers, "demand_digital", "fix");
    case "telecom":
      return str(answers, "demand_telecom", "fix_refund");
    default:
      return "fix";
  }
}

function lines(text: string): string[] {
  return text
    .split(/[;\n]+/)
    .map((t) =>
      t
        .replace(/^\s*(?:[-–•*]|\d+[.)])\s*/, "")
        .trim()
        .replace(/[;,]+$/, "")
        // kropka końcowa – usuwamy, chyba że kończy skrót (np. „r.”, „nr.”)
        .replace(/(?<!\b(?:r|nr|ul|tj|np|ok|al|str|poz|ust|art|pkt|godz))\.$/, ""),
    )
    .filter(Boolean)
    .map((t) => t.charAt(0).toUpperCase() + t.slice(1));
}

/** Usuwa końcową kropkę i spacje, chyba że kropka kończy skrót (np. „r.”, „ul.”). */
function trimEndDot(text: string): string {
  return text.trim().replace(/(?<!\b(?:r|nr|ul|tj|np|ok|al|str|poz|ust|art|pkt|godz))\.+$/, "").trim();
}

/** Mała litera na początku (chyba że skrótowiec, np. „CRM”). */
function lowerFirst(text: string): string {
  return /^\p{Lu}\p{Lu}/u.test(text) ? text : text.charAt(0).toLowerCase() + text.slice(1);
}

function amountPhrase(amount: number | undefined, fallback: string): string {
  return amount !== undefined ? `w kwocie ${formatMoneyPl(amount)}` : fallback;
}

function payoutPhrase(account: string): string {
  return account ? `na rachunek bankowy nr ${account}` : "w sposób, w jaki uiszczono wynagrodzenie";
}

function legalAndDemand(answers: Answers, regime: Regime): Paragraph[] {
  const out: Paragraph[] = [];
  const demand = demandOf(answers, regime);
  const status = statusOf(answers);
  const amount = num(answers, "claim_amount");
  const price = num(answers, "price");
  const days = str(answers, "fix_deadline", "14");
  const account = str(answers, "bank_account", "");
  const jdgVia = status === "jdg" ? " w zw. z art. 556⁴" : "";

  switch (regime) {
    case "work_in_progress": {
      out.push(heading("Podstawa prawna i żądanie"));
      out.push(
        p(
          `Zgodnie z art. 636 § 1 ${KC_FULL}, jeżeli przyjmujący zamówienie wykonuje dzieło w sposób wadliwy albo sprzeczny z umową, zamawiający może wezwać go do zmiany sposobu wykonania i wyznaczyć mu w tym celu odpowiedni termin, a po bezskutecznym upływie wyznaczonego terminu – odstąpić od umowy albo powierzyć poprawienie lub dalsze wykonanie dzieła innej osobie na koszt i niebezpieczeństwo przyjmującego zamówienie.`,
        ),
      );
      out.push(
        p(
          `W związku z powyższym wzywam do zmiany sposobu wykonywania prac i usunięcia opisanych wad w terminie ${days} dni od dnia doręczenia niniejszego pisma. Po bezskutecznym upływie tego terminu odstąpię od umowy albo powierzę poprawienie lub dalsze wykonanie prac innemu wykonawcy na Państwa koszt i niebezpieczeństwo, zastrzegając sobie również prawo dochodzenia odszkodowania na zasadach ogólnych (art. 471 k.c.).`,
        ),
      );
      return out;
    }
    case "work": {
      out.push(heading("Podstawa prawna"));
      out.push(
        p(
          `Zgodnie z art. 638 § 1 ${KC_FULL} do odpowiedzialności za wady dzieła stosuje się odpowiednio przepisy o rękojmi przy sprzedaży (art. 556 i n. k.c.). Wada polega na niezgodności dzieła z umową, w szczególności gdy nie ma ono właściwości, które powinno mieć ze względu na cel umowy lub jego przeznaczenie (art. 556¹ § 1 pkt 1 k.c.). Wykonawca odpowiada z tytułu rękojmi, jeżeli wada fizyczna zostanie stwierdzona przed upływem dwóch lat od dnia wydania dzieła (art. 568 § 1 w zw. z art. 638 § 1 k.c.).`,
        ),
      );
      out.push(heading("Żądanie"));
      if (demand === "fix" || demand === "redo") {
        out.push(
          p(
            `Na podstawie art. 561 § 1 w zw. z art. 638 § 1 k.c. żądam ${
              demand === "fix" ? "nieodpłatnego usunięcia wad" : "nieodpłatnego ponownego wykonania dzieła w sposób wolny od wad"
            } w terminie ${days} dni od dnia doręczenia niniejszego pisma. Wykonawca jest obowiązany uczynić to w rozsądnym czasie, bez nadmiernych niedogodności dla zamawiającego (art. 561 § 2 k.c.), a koszty, w tym koszty robocizny i materiałów, obciążają wykonawcę (art. 561³ k.c.).`,
          ),
        );
      } else if (demand === "reduce") {
        out.push(
          p(
            `Na podstawie art. 560 § 1 w zw. z art. 638 § 1 k.c. oświadczam, że obniżam wynagrodzenie za wykonane dzieło ${
              amount !== undefined
                ? `o kwotę ${formatMoneyPl(amount)}`
                : "w proporcji, w jakiej wartość dzieła z wadą pozostaje do wartości dzieła bez wady"
            }, i wnoszę o zwrot tej kwoty ${payoutPhrase(
              account,
            )}. Obniżona cena powinna pozostawać w takiej proporcji do wynagrodzenia wynikającego z umowy, w jakiej wartość dzieła z wadą pozostaje do wartości dzieła bez wady (art. 560 § 3 k.c.).`,
          ),
        );
      } else if (demand === "withdraw") {
        out.push(
          p(
            `Na podstawie art. 560 § 1 w zw. z art. 638 § 1 k.c. oświadczam, że odstępuję od umowy, i żądam zwrotu zapłaconego wynagrodzenia ${amountPhrase(
              amount ?? price,
              "w pełnej wysokości",
            )} ${payoutPhrase(
              account,
            )}. Wady dzieła są istotne (art. 560 § 4 k.c.), a wykonawca nie usunął ich niezwłocznie i bez nadmiernych niedogodności dla zamawiającego. Niezależnie od tego zastrzegam prawo dochodzenia naprawienia szkody (art. 566 § 1 k.c.).`,
          ),
        );
      } else {
        out.push(
          p(
            `Zgodnie z art. 471 k.c. dłużnik obowiązany jest do naprawienia szkody wynikłej z niewykonania lub nienależytego wykonania zobowiązania, chyba że jest ono następstwem okoliczności, za które nie ponosi odpowiedzialności. Wobec nienależytego wykonania umowy żądam naprawienia szkody, w szczególności zwrotu kosztów usunięcia wad ${amountPhrase(
              amount,
              "w wysokości wynikającej z załączonych dokumentów",
            )}, ${payoutPhrase(account)}, w terminie ${days} dni od dnia doręczenia niniejszego pisma.`,
          ),
        );
      }
      if (status === "consumer") {
        out.push(
          p(
            "Zgodnie z art. 7a ust. 1 i 2 " +
              UPK_FULL +
              " przedsiębiorca jest obowiązany udzielić odpowiedzi na reklamację konsumenta w terminie 14 dni od dnia jej otrzymania, a brak odpowiedzi w tym terminie oznacza uznanie reklamacji. Odpowiedź należy przekazać na papierze lub innym trwałym nośniku (art. 7a ust. 3 u.p.k.).",
          ),
        );
      } else if (status === "jdg" && (demand === "fix" || demand === "redo" || (demand === "reduce" && amount !== undefined))) {
        out.push(
          p(
            `Umowa nie ma dla mnie charakteru zawodowego. Zgodnie z art. 561⁵${jdgVia} w zw. z art. 638 § 1 k.c., jeżeli wykonawca nie ustosunkuje się do żądania w terminie 14 dni, uważa się, że uznał je za uzasadnione.`,
          ),
        );
      } else {
        out.push(p("Proszę o ustosunkowanie się do reklamacji w terminie 14 dni od dnia jej otrzymania."));
      }
      return out;
    }
    case "services": {
      out.push(heading("Podstawa prawna"));
      out.push(
        p(
          `Zgodnie z art. 750 ${KC_FULL} do umów o świadczenie usług, które nie są uregulowane innymi przepisami, stosuje się odpowiednio przepisy o zleceniu. Usługodawca jest obowiązany wykonać usługę z należytą starannością, którą w zakresie prowadzonej działalności gospodarczej określa się przy uwzględnieniu jej zawodowego charakteru (art. 355 § 1 i 2 k.c.). Zgodnie z art. 471 k.c. dłużnik obowiązany jest do naprawienia szkody wynikłej z niewykonania lub nienależytego wykonania zobowiązania, chyba że jest ono następstwem okoliczności, za które nie ponosi odpowiedzialności. Naprawienie szkody następuje, według wyboru poszkodowanego, przez przywrócenie stanu poprzedniego albo przez zapłatę odpowiedniej sumy pieniężnej (art. 363 § 1 k.c.).`,
        ),
      );
      out.push(heading("Żądanie"));
      const texts: Record<string, string> = {
        redo: `W związku z nienależytym wykonaniem usługi żądam jej nieodpłatnego poprawienia (ponownego wykonania) w terminie ${days} dni od dnia doręczenia niniejszego pisma, w uzgodnionym ze mną terminie wizyty.`,
        reduce: `W związku z nienależytym wykonaniem usługi żądam zwrotu części zapłaconego wynagrodzenia ${amountPhrase(
          amount,
          "odpowiadającej wartości usługi niewykonanej należycie",
        )}, ${payoutPhrase(account)}, w terminie ${days} dni od dnia doręczenia niniejszego pisma.`,
        refund: `Ponieważ usługa została wykonana w sposób, który pozbawia ją dla mnie wartości, żądam zwrotu całego zapłaconego wynagrodzenia ${amountPhrase(
          amount ?? price,
          "",
        )} ${payoutPhrase(account)}, w terminie ${days} dni od dnia doręczenia niniejszego pisma.`,
        damages: `W związku z nienależytym wykonaniem usługi żądam naprawienia wyrządzonej szkody ${amountPhrase(
          amount,
          "w wysokości wynikającej z załączonych dokumentów",
        )}, ${payoutPhrase(account)}, w terminie ${days} dni od dnia doręczenia niniejszego pisma.`,
      };
      out.push(p(texts[demand] ?? texts.redo));
      out.push(
        p(
          status === "consumer"
            ? `Zgodnie z art. 7a ust. 1 i 2 ${UPK_FULL} przedsiębiorca jest obowiązany udzielić odpowiedzi na reklamację konsumenta w terminie 14 dni od dnia jej otrzymania, a brak odpowiedzi w tym terminie oznacza uznanie reklamacji. Odpowiedź należy przekazać na papierze lub innym trwałym nośniku (art. 7a ust. 3 u.p.k.).`
            : "Proszę o ustosunkowanie się do reklamacji w terminie 14 dni od dnia jej otrzymania.",
        ),
      );
      return out;
    }
    case "digital": {
      const via = status === "jdg" ? " w zw. z art. 7aa ust. 1" : "";
      out.push(heading("Podstawa prawna"));
      out.push(
        p(
          `Zgodnie z art. 43l ust. 1 i 3${via} ${UPK_FULL} przedsiębiorca ponosi odpowiedzialność za brak zgodności treści cyfrowej lub usługi cyfrowej z umową – przy dostarczaniu jednorazowym, gdy brak ten istniał w chwili dostarczenia i ujawnił się w ciągu dwóch lat, a przy dostarczaniu w sposób ciągły – gdy wystąpił lub ujawnił się w czasie, w którym zgodnie z umową miały być dostarczane. Treść cyfrowa lub usługa cyfrowa musi być zgodna z umową w szczególności co do opisu, ilości, jakości, kompletności i funkcjonalności (art. 43k ust. 1 u.p.k.).`,
        ),
      );
      out.push(heading("Żądanie"));
      if (demand === "fix") {
        out.push(
          p(
            `Na podstawie art. 43m ust. 1 u.p.k. żądam doprowadzenia treści cyfrowej lub usługi cyfrowej do zgodności z umową w terminie ${days} dni od dnia doręczenia niniejszego pisma. Przedsiębiorca doprowadza je do zgodności z umową w rozsądnym czasie i bez nadmiernych niedogodności dla konsumenta, a koszty ponosi przedsiębiorca (art. 43m ust. 4 u.p.k.).`,
          ),
        );
      } else {
        const what = demand === "withdraw" ? "odstąpieniu od umowy" : "obniżeniu ceny";
        const sum =
          demand === "withdraw"
            ? `i żądam zwrotu zapłaconej ceny ${amountPhrase(amount ?? price, "")}`
            : `o kwotę ${amount !== undefined ? formatMoneyPl(amount) : "proporcjonalną do obniżenia wartości treści lub usługi cyfrowej"} i żądam zwrotu tej kwoty`;
        out.push(
          p(
            `Na podstawie art. 43n ust. 1 u.p.k. składam oświadczenie o ${what} ${sum} ${payoutPhrase(
              account,
            )}. Brak zgodności z umową jest na tyle istotny, że uzasadnia to oświadczenie bez uprzedniego żądania doprowadzenia do zgodności z umową, a ponadto przedsiębiorca nie doprowadził treści lub usługi do zgodności z umową (art. 43n ust. 1 pkt 2 i 4 u.p.k.). ${
              demand === "withdraw" ? "Domniemywa się, że brak zgodności jest istotny (art. 43n ust. 3 u.p.k.). " : ""
            }Przedsiębiorca zwraca cenę niezwłocznie, nie później niż w terminie 14 dni od dnia otrzymania oświadczenia (art. 43o ust. 6 u.p.k.).`,
          ),
        );
      }
      out.push(
        p(
          status === "consumer"
            ? "Zgodnie z art. 7a ust. 1 i 2 u.p.k. przedsiębiorca jest obowiązany udzielić odpowiedzi na reklamację konsumenta w terminie 14 dni od dnia jej otrzymania, a brak odpowiedzi w tym terminie oznacza uznanie reklamacji. Odpowiedź należy przekazać na papierze lub innym trwałym nośniku (art. 7a ust. 3 u.p.k.)."
            : "Proszę o ustosunkowanie się do reklamacji w terminie 14 dni od dnia jej otrzymania.",
        ),
      );
      return out;
    }
    case "telecom": {
      out.push(heading("Podstawa prawna"));
      out.push(
        p(
          `Reklamację składam na podstawie art. 378 ust. 1 pkt 3 ${PKE_FULL}, z tytułu nienależytego wykonania usługi komunikacji elektronicznej. Zgodnie z art. 378 ust. 5 PKE, jeżeli dostawca usług nie rozpatrzy reklamacji w terminie 30 dni od dnia jej złożenia, uważa się, że uznał żądanie określone w reklamacji za uzasadnione; przez rozpatrzenie reklamacji rozumie się wysłanie przed upływem tego terminu odpowiedzi o jej uwzględnieniu lub nieuwzględnieniu wraz z uzasadnieniem.`,
        ),
      );
      out.push(heading("Żądanie"));
      const refundTail = `${amountPhrase(amount, "za okres nienależytego świadczenia usługi")}, ${
        account ? `na rachunek bankowy nr ${account}` : "w formie zaliczenia na poczet przyszłych płatności"
      } (art. 378 ust. 4 pkt 7 i 8 PKE)`;
      const texts: Record<string, string> = {
        fix_refund: `Żądam niezwłocznego przywrócenia prawidłowego świadczenia usługi zgodnie z umową oraz zwrotu (obniżenia) opłat abonamentowych ${refundTail}.`,
        refund: `Żądam zwrotu (obniżenia) opłat abonamentowych ${refundTail}.`,
        compensation: `Żądam wypłaty odszkodowania lub innej należności przewidzianej w umowie lub regulaminie świadczenia usług ${refundTail}.`,
      };
      out.push(p(texts[demand] ?? texts.fix_refund));
      return out;
    }
  }
}

export const reklamacjaUslugi: LetterTemplate = {
  slug: "reklamacja-uslugi",
  name: "Reklamacja usługi",
  category: "konsument",
  shortDescription:
    "Reklamacja źle wykonanego remontu, naprawy, usługi fryzjerskiej, kursu, aplikacji lub internetu – z podstawą prawną dobraną do rodzaju usługi.",
  priceGrosze: 2499,
  icon: "🛠️",
  estimatedMinutes: 7,
  sections: [
    {
      id: "sender",
      title: "Twoje dane",
      description: "Dane klienta – takie, jak w umowie, na fakturze lub w koncie klienta.",
      questions: senderQuestions(),
    },
    {
      id: "recipient",
      title: "Wykonawca",
      description:
        "Firma, z którą zawarto umowę. Pełną nazwę i adres znajdziesz w umowie, na fakturze lub paragonie, w regulaminie albo w CEIDG/KRS (po numerze NIP).",
      questions: recipientQuestions("Wykonawca"),
    },
    {
      id: "contract",
      title: "Umowa i usługa",
      questions: [
        {
          id: "service_type",
          label: "Jakiej usługi dotyczy reklamacja?",
          type: "radio",
          help: "Od tego zależą przepisy w piśmie. Jeśli zamówiono rzecz wykonaną na wymiar (np. meble, ubranie szyte na miarę), skorzystaj z generatora „Reklamacja towaru”.",
          options: [
            { value: "work", label: "Remont, montaż, naprawa lub inna praca o konkretnym rezultacie (np. łazienka, naprawa auta, instalacja)" },
            { value: "service", label: "Usługa bieżąca lub „na osobie” (np. fryzjer, kosmetyczka, sprzątanie, przegląd, serwis)" },
            { value: "course", label: "Kurs, szkolenie, szkoła językowa (zajęcia stacjonarne)" },
            { value: "digital", label: "Usługa lub treść cyfrowa (aplikacja, kurs online, subskrypcja, program)" },
            { value: "telecom", label: "Telefon, internet lub telewizja (reklamacja do operatora)" },
          ],
        },
        {
          id: "customer_status",
          label: "Kto zawarł umowę?",
          type: "radio",
          help: "Konsumentom przysługują dodatkowe uprawnienia, m.in. 14 dni na odpowiedź pod rygorem uznania reklamacji.",
          options: [
            { value: "consumer", label: "Osoba prywatna (konsument)" },
            { value: "jdg", label: "Jednoosobowa firma – ale usługa nie ma związku z moją branżą" },
            { value: "business", label: "Firma – w ramach zawodowej działalności" },
          ],
        },
        {
          id: "contract_date",
          label: "Data zawarcia umowy (zamówienia)",
          type: "date",
          help: "Dzień podpisania umowy, złożenia zamówienia lub umówienia usługi.",
        },
        {
          id: "contract_number",
          label: "Numer umowy, zamówienia lub klienta (opcjonalnie)",
          type: "text",
          required: false,
          placeholder: "np. 45/2026, nr klienta 123456, nr telefonu 600 000 000",
          help: "U operatora podaj numer telefonu, numer klienta albo adres instalacji – reklamacja musi je zawierać.",
        },
        {
          id: "service_description",
          label: "Co było przedmiotem usługi?",
          type: "textarea",
          placeholder: "np. remont łazienki: skucie płytek, położenie nowych płytek, montaż kabiny prysznicowej",
          help: "Krótko i konkretnie – tak, jak w umowie lub ofercie.",
          validate: { maxLength: 600 },
        },
        {
          id: "price",
          label: "Wynagrodzenie (cena usługi)",
          type: "money",
          placeholder: "8500.00",
          help: "Kwota zapłacona lub umówiona. Przy abonamencie – miesięczna opłata.",
        },
        {
          id: "performance_date",
          label: "Kiedy usługa została wykonana (odebrana)?",
          type: "date",
          help: "Dzień zakończenia prac lub wykonania usługi. Jeśli prace trwają – data ostatnich prac. Przy abonamencie – początek problemów.",
        },
        {
          id: "work_status",
          label: "Czy prace zostały zakończone?",
          type: "radio",
          showIf: { questionId: "service_type", equals: "work" },
          help: "Gdy prace trwają, pismo wezwie do zmiany sposobu wykonania pod rygorem odstąpienia lub zlecenia poprawek innej firmie (art. 636 k.c.).",
          options: [
            { value: "finished", label: "Tak – prace zakończono i odebrano" },
            { value: "in_progress", label: "Nie – prace trwają, ale są wykonywane wadliwie" },
          ],
        },
      ],
    },
    {
      id: "defects",
      title: "Wady i dowody",
      description: "Opisz rzeczowo, co jest nie tak – bez ocen i emocji.",
      questions: [
        {
          id: "defects",
          label: "Na czym polegają wady?",
          type: "textarea",
          placeholder:
            "np. Fugi między płytkami pękają, a przy brodziku przecieka woda na sufit sąsiada. Płytki przy drzwiach są krzywo ułożone (różnica poziomów ok. 4 mm).",
          help: "Każdą wadę w osobnej linii. Podaj, kiedy ją zauważono i jak się przejawia.",
          validate: { maxLength: 2000 },
        },
        {
          id: "oral_report_date",
          label: "Kiedy zgłoszono wady ustnie lub telefonicznie? (opcjonalnie)",
          type: "date",
          required: false,
          help: "Jeśli wcześniej zgłaszano problem, wpisz datę – pismo to odnotuje.",
        },
        {
          id: "telecom_period",
          label: "Reklamowany okres",
          type: "text",
          showIf: { questionId: "service_type", equals: "telecom" },
          placeholder: "np. od 3 do 21 września 2026 r.",
          help: "Okres, w którym usługa nie działała lub działała źle. Reklamację składa się w ciągu 12 miesięcy.",
        },
        {
          id: "evidence",
          label: "Dowody i załączniki (opcjonalnie)",
          type: "textarea",
          required: false,
          placeholder: "zdjęcia wad\nkopia umowy\nopinia rzeczoznawcy z 10.10.2026 r.",
          help: "Każdy dowód w nowej linii – trafi do listy załączników.",
          validate: { maxLength: 600 },
        },
      ],
    },
    {
      id: "demand",
      title: "Twoje żądanie",
      questions: [
        {
          id: "demand_work",
          label: "Czego żądasz od wykonawcy?",
          type: "radio",
          showIf: { questionId: "work_status", equals: "finished" },
          help: "Najczęściej zaczyna się od usunięcia wad. Odstąpienie od umowy jest możliwe tylko przy wadzie istotnej.",
          options: [
            { value: "fix", label: "Usunięcia wad (naprawy)" },
            { value: "redo", label: "Ponownego wykonania pracy" },
            { value: "reduce", label: "Obniżenia wynagrodzenia" },
            { value: "withdraw", label: "Odstąpienia od umowy i zwrotu wynagrodzenia" },
            { value: "damages", label: "Zwrotu kosztów naprawy przez inną firmę (odszkodowania)" },
          ],
        },
        {
          id: "demand_service",
          label: "Czego żądasz od usługodawcy?",
          type: "radio",
          showIf: { questionId: "service_type", equals: ["service", "course"] },
          options: [
            { value: "redo", label: "Bezpłatnej poprawki lub ponownego wykonania usługi" },
            { value: "reduce", label: "Zwrotu części zapłaty" },
            { value: "refund", label: "Zwrotu całej zapłaty" },
            { value: "damages", label: "Odszkodowania (np. za zniszczone rzeczy, koszty leczenia)" },
          ],
          help: "Przy usłudze wykonanej źle możesz żądać naprawienia szkody – w naturze (poprawka) albo w pieniądzu.",
        },
        {
          id: "demand_digital",
          label: "Czego żądasz od dostawcy?",
          type: "radio",
          showIf: { questionId: "service_type", equals: "digital" },
          help: "Najpierw zwykle żąda się doprowadzenia do zgodności z umową (naprawy). Obniżenie ceny lub odstąpienie – gdy naprawa zawiodła albo wada jest istotna.",
          options: [
            { value: "fix", label: "Naprawy – doprowadzenia do zgodności z umową" },
            { value: "reduce", label: "Obniżenia ceny" },
            { value: "withdraw", label: "Odstąpienia od umowy i zwrotu ceny" },
          ],
        },
        {
          id: "demand_telecom",
          label: "Czego żądasz od operatora?",
          type: "radio",
          showIf: { questionId: "service_type", equals: "telecom" },
          options: [
            { value: "fix_refund", label: "Przywrócenia prawidłowej usługi i zwrotu opłat za czas awarii" },
            { value: "refund", label: "Zwrotu (obniżenia) opłat za czas awarii" },
            { value: "compensation", label: "Odszkodowania lub kary przewidzianej w umowie lub regulaminie" },
          ],
          help: "Kwotę zwrotu możesz policzyć proporcjonalnie: opłata miesięczna ÷ liczba dni × dni bez usługi.",
        },
        {
          id: "claim_amount",
          label: "Kwota, której żądasz (opcjonalnie)",
          type: "money",
          required: false,
          placeholder: "1200.00",
          help: "Wpisz przy obniżeniu wynagrodzenia, zwrocie lub odszkodowaniu. Przy odstąpieniu od umowy – jeśli puste, żądamy zwrotu całej ceny.",
        },
        {
          id: "fix_deadline",
          label: "Termin na spełnienie żądania",
          type: "select",
          showIf: { questionId: "service_type", equals: ["work", "service", "course", "digital"] },
          options: [
            { value: "7", label: "7 dni" },
            { value: "14", label: "14 dni" },
            { value: "30", label: "30 dni" },
          ],
          help: "Termin powinien być realny – przy remontach zwykle 14–30 dni.",
        },
        {
          id: "bank_account",
          label: "Numer rachunku do zwrotu pieniędzy (opcjonalnie)",
          type: "text",
          required: false,
          placeholder: "PL 00 0000 0000 0000 0000 0000 0000",
          validate: { maxLength: 40 },
          help: "Potrzebny, jeśli żądasz zwrotu pieniędzy lub odszkodowania.",
        },
        {
          id: "send_date",
          label: "Kiedy wyślesz reklamację? (opcjonalnie)",
          type: "date",
          required: false,
          help: "Policzymy orientacyjnie, do kiedy wykonawca powinien odpowiedzieć.",
        },
      ],
    },
  ],
  legalBasis: [
    {
      act: "Ustawa z dnia 23 kwietnia 1964 r. – Kodeks cywilny",
      article: "art. 627, art. 636 § 1, art. 638 § 1",
      summary:
        "Remont, montaż czy naprawa to zwykle umowa o dzieło: przy wadach stosuje się rękojmię, a gdy prace trwają – można wezwać do zmiany sposobu wykonania.",
      url: ISAP_KC,
    },
    {
      act: "Ustawa z dnia 23 kwietnia 1964 r. – Kodeks cywilny",
      article: "art. 560, 561, 561³, 568 § 1 w zw. z art. 638 § 1",
      summary:
        "Rękojmia za wady dzieła: usunięcie wad lub ponowne wykonanie na koszt wykonawcy, obniżenie wynagrodzenia albo odstąpienie od umowy; 2 lata od wydania dzieła.",
      url: ISAP_KC,
    },
    {
      act: "Ustawa z dnia 23 kwietnia 1964 r. – Kodeks cywilny",
      article: "art. 750, art. 355, art. 471",
      summary:
        "Usługodawca musi działać z zawodową starannością i naprawić szkodę wynikłą z nienależytego wykonania usługi.",
      url: ISAP_KC,
    },
    {
      act: "Ustawa z dnia 30 maja 2014 r. o prawach konsumenta",
      article: "art. 7a oraz art. 43k–43o",
      summary:
        "Konsument dostaje odpowiedź na reklamację w 14 dni (milczenie = uznanie); przy treściach i usługach cyfrowych – naprawa, obniżenie ceny lub odstąpienie.",
      url: ISAP_UPK,
    },
    {
      act: "Ustawa z dnia 12 lipca 2024 r. – Prawo komunikacji elektronicznej",
      article: "art. 378 i 379",
      summary:
        "Reklamacja usługi telekomunikacyjnej w ciągu 12 miesięcy; operator ma 30 dni na odpowiedź, a brak odpowiedzi oznacza uznanie reklamacji.",
      url: ISAP_PKE,
    },
  ],
  deadlines: [
    {
      id: "liability_2y",
      label: "Koniec 2-letniej odpowiedzialności za wady (dzieło, treść cyfrowa)",
      fromQuestionId: "performance_date",
      years: 2,
      description:
        "Wykonawca dzieła odpowiada za wady stwierdzone przed upływem 2 lat od wydania dzieła (art. 568 § 1 w zw. z art. 638 § 1 k.c.); dostawca treści cyfrowej – za brak zgodności ujawniony w ciągu 2 lat od dostarczenia (art. 43l ust. 1 u.p.k.). Nie dotyczy usług telekomunikacyjnych – tam reklamację składa się w ciągu 12 miesięcy.",
    },
    {
      id: "response_14",
      label: "Orientacyjny termin odpowiedzi na reklamację (14 dni)",
      fromQuestionId: "send_date",
      days: 14,
      description:
        "Przedsiębiorca ma 14 dni od otrzymania reklamacji konsumenta na odpowiedź; brak odpowiedzi oznacza uznanie reklamacji (art. 7a u.p.k.). Termin liczony od wysłania jest orientacyjny – dolicz czas doręczenia.",
    },
    {
      id: "response_telecom_30",
      label: "Termin odpowiedzi operatora (30 dni)",
      fromQuestionId: "send_date",
      days: 30,
      description:
        "Dotyczy tylko reklamacji usług telekomunikacyjnych: operator ma 30 dni od złożenia reklamacji na jej rozpatrzenie; po tym terminie żądanie uważa się za uznane (art. 378 ust. 5 PKE).",
    },
  ],
  instructions: {
    whereToSend:
      "Reklamację kierujesz do **wykonawcy lub usługodawcy**, z którym zawarto umowę – na adres siedziby z umowy, faktury lub regulaminu (dane firmy sprawdzisz w CEIDG lub KRS po numerze NIP). Jeśli firma wskazuje osobny adres do reklamacji (np. dział obsługi klienta), wyślij pismo tam.\n\nReklamację **usługi telekomunikacyjnej** złożysz pisemnie, ustnie do protokołu w salonie, telefonicznie albo na adres e-mail wskazany w umowie (art. 378 ust. 3 PKE). Reklamację **usługi cyfrowej** wyślij na adres e-mail lub przez formularz wskazany w regulaminie.",
    howToSend:
      "Najpewniej: **list polecony za potwierdzeniem odbioru** – data doręczenia rozpoczyna bieg terminu na odpowiedź. Możesz też złożyć pismo osobiście (poproś o potwierdzenie na kopii) albo wysłać je e-mailem jako PDF na adres do reklamacji – zachowaj wysłaną wiadomość.\n\nDołącz kopie dowodów: umowy lub faktury, zdjęć wad, korespondencji, ewentualnej opinii rzeczoznawcy. Oryginały zachowaj u siebie. Nie usuwaj wad na własną rękę, zanim wykonawca nie odniesie się do reklamacji (chyba że grozi szkoda) – udokumentuj stan zdjęciami.",
    afterSending:
      "Przedsiębiorca powinien odpowiedzieć konsumentowi w **14 dni** – brak odpowiedzi oznacza uznanie reklamacji (art. 7a u.p.k.). Operator telekomunikacyjny ma **30 dni** (art. 378 ust. 5 PKE).\n\nJeśli reklamacja zostanie odrzucona:\n- skontaktuj się z **miejskim lub powiatowym rzecznikiem konsumentów** – bezpłatna pomoc i interwencja,\n- w sporze z operatorem złóż wniosek o **pozasądowe rozwiązanie sporu do Prezesa UKE** (art. 383 PKE),\n- przy remontach rozważ **opinię niezależnego rzeczoznawcy** – będzie kluczowym dowodem w sądzie,\n- w ostateczności złóż **pozew** do sądu rejonowego; przy kwotach do 20 000 zł sprawa toczy się w postępowaniu uproszczonym.",
    checklist: [
      "Sprawdź, czy nie minęły 2 lata od odbioru prac (dzieło, treść cyfrowa) lub 12 miesięcy od awarii (telekomunikacja).",
      "Zrób zdjęcia lub nagrania wad z datą i zachowaj korespondencję z wykonawcą.",
      "Upewnij się, że dane wykonawcy i numer umowy są poprawne.",
      "Wpisz konkretne żądanie i realny termin jego wykonania.",
      "Podpisz pismo, zrób kopię i wyślij listem poleconym za potwierdzeniem odbioru.",
      "Zapisz w kalendarzu termin odpowiedzi (14 dni, u operatora 30 dni).",
    ],
  },
  seo: {
    title: "Reklamacja usługi – wzór pisma 2026 + generator",
    metaDescription:
      "Reklamacja źle wykonanego remontu, naprawy, usługi fryzjerskiej, kursu, aplikacji lub internetu. Wzór z przepisami dobranymi do rodzaju usługi.",
    h1: "Reklamacja usługi – wzór pisma z generatorem",
    intro:
      "Remont przecieka, fryzjer zniszczył włosy, a kurs online nie działa? Odpowiedz na kilka pytań – dobierzemy właściwe przepisy (umowa o dzieło, umowa o świadczenie usług, treści cyfrowe albo Prawo komunikacji elektronicznej) i przygotujemy reklamację z konkretnym żądaniem i terminem. Pismo pobierzesz w DOCX lub PDF.",
    keywords: [
      "reklamacja usługi wzór",
      "reklamacja remontu",
      "reklamacja usługi fryzjerskiej",
      "reklamacja usługi telekomunikacyjnej",
      "rękojmia umowa o dzieło",
      "reklamacja źle wykonanej usługi",
      "reklamacja kursu online",
      "jak napisać reklamację usługi",
    ],
    guide: [
      {
        heading: "Reklamacja usługi – jakie przepisy mają zastosowanie",
        body: `Inaczej niż przy zakupie towaru, przy usługach nie ma jednego „trybu reklamacyjnego”. Przepisy zależą od tego, **co było przedmiotem umowy**:

- **Umowa o dzieło** (art. 627 k.c.) – gdy wykonawca miał osiągnąć konkretny, sprawdzalny rezultat: remont łazienki, montaż kuchni, naprawa samochodu, uszycie zasłon. Za wady dzieła odpowiada się tak jak przy rękojmi za wady rzeczy sprzedanej (art. 638 § 1 k.c.).
- **Umowa o świadczenie usług** (art. 750 k.c.) – gdy liczy się staranne działanie: sprzątanie, opieka, konsultacje, zajęcia. Usługodawca odpowiada za nienależyte wykonanie umowy na zasadach ogólnych (art. 471 k.c.).
- **Treści i usługi cyfrowe** – aplikacje, kursy online, subskrypcje, gry, oprogramowanie. Konsumenta chronią przepisy rozdziału 5b ustawy o prawach konsumenta (art. 43h–43q).
- **Usługi telekomunikacyjne** – telefon, internet, telewizja. Od 10 listopada 2024 r. reklamacje reguluje Prawo komunikacji elektronicznej (art. 378 i n.).

Jeśli zamówiono rzecz ruchomą wykonaną na zamówienie (meble na wymiar, garnitur szyty na miarę), stosuje się przepisy o niezgodności towaru z umową – skorzystaj wtedy z generatora reklamacji towaru.`,
      },
      {
        heading: "Remont, montaż, naprawa – rękojmia za wady dzieła",
        body: `Jeżeli wykonane prace mają wady, możesz – odpowiednio do przepisów o rękojmi – żądać:

1. **Usunięcia wad** albo **ponownego wykonania pracy** (art. 561 k.c.) – na koszt wykonawcy, w rozsądnym czasie i bez nadmiernych niedogodności dla Ciebie. Koszty robocizny, materiałów, demontażu i ponownego montażu ponosi wykonawca (art. 561³ k.c.).
2. **Obniżenia wynagrodzenia** – proporcjonalnie do tego, o ile wada zmniejsza wartość dzieła (art. 560 § 3 k.c.).
3. **Odstąpienia od umowy** i zwrotu wynagrodzenia – tylko przy wadzie istotnej (art. 560 § 4 k.c.).

Wykonawca odpowiada za wady stwierdzone **w ciągu 2 lat od odbioru** prac (art. 568 § 1 k.c.). Oprócz rękojmi możesz domagać się **odszkodowania** (art. 471 k.c.), np. zwrotu kosztów usunięcia wad przez inną firmę albo naprawy szkód u sąsiada.

**Prace jeszcze trwają?** Nie czekaj do odbioru. Art. 636 § 1 k.c. pozwala wezwać wykonawcę do zmiany sposobu wykonania i wyznaczyć mu termin. Jeśli go nie dotrzyma, możesz odstąpić od umowy albo zlecić poprawki innej firmie na jego koszt. Generator przygotuje takie wezwanie, jeśli zaznaczysz, że prace są w toku.`,
      },
      {
        heading: "Fryzjer, kosmetyczka, sprzątanie, kurs – nienależyte wykonanie usługi",
        body: `Przy usługach, które polegają na starannym działaniu, podstawą reklamacji jest **odpowiedzialność za nienależyte wykonanie umowy** (art. 471 k.c.). Usługodawca prowadzący firmę musi działać z **zawodową starannością** (art. 355 § 2 k.c.) – oceniana jest ona według standardów danej branży.

Możesz żądać naprawienia szkody **w naturze** – np. bezpłatnej poprawki koloryzacji, ponownego sprzątania – albo **w pieniądzu**: zwrotu części lub całości zapłaty, kosztów leczenia, wartości zniszczonych rzeczy (art. 363 § 1 k.c.). Wybór należy do Ciebie, chyba że przywrócenie stanu poprzedniego jest niemożliwe lub nadmiernie kosztowne.

Kluczowe są dowody: zdjęcia przed i po, opinia lekarza lub innego specjalisty, świadkowie, a przy kursach – program zajęć, lista nieodbytych lekcji, korespondencja. Konsumentowi przedsiębiorca musi odpowiedzieć na reklamację w **14 dni** – inaczej uważa się ją za uznaną (art. 7a ustawy o prawach konsumenta).`,
      },
      {
        heading: "Aplikacje, kursy online i subskrypcje",
        body: `Jeśli kupiłeś dostęp do aplikacji, kursu online, programu czy serwisu streamingowego, a usługa nie działa lub nie ma obiecanych funkcji, korzystasz z przepisów o **treściach i usługach cyfrowych** (art. 43k–43o u.p.k.). Przedsiębiorca odpowiada za brak zgodności z umową ujawniony w ciągu 2 lat od dostarczenia, a przy subskrypcji – przez cały czas jej trwania (art. 43l).

Najpierw możesz żądać **doprowadzenia do zgodności z umową** – na koszt przedsiębiorcy i w rozsądnym czasie (art. 43m). **Obniżenie ceny** albo **odstąpienie od umowy** są możliwe, gdy naprawa jest niemożliwa, zawiodła, przedsiębiorca jej odmówił albo wada jest na tyle istotna, że uzasadnia to od razu (art. 43n). Pieniądze należy zwrócić w ciągu 14 dni od otrzymania oświadczenia (art. 43o ust. 6). Te uprawnienia przysługują także osobie prowadzącej jednoosobową firmę, jeśli umowa nie ma dla niej charakteru zawodowego.`,
      },
      {
        heading: "Internet, telefon, telewizja – reklamacja do operatora",
        body: `Reklamację usługi telekomunikacyjnej (np. przerwa w dostępie do internetu, niska prędkość, błędna faktura) składasz w ciągu **12 miesięcy** od końca okresu rozliczeniowego, w którym zakończyła się przerwa, albo od dnia nienależytego wykonania usługi (art. 378 ust. 2 PKE). Możesz ją złożyć pisemnie, ustnie do protokołu, telefonicznie lub e-mailem na adres z umowy.

Reklamacja powinna zawierać m.in. reklamowany okres, numer telefonu lub klienta (albo adres instalacji), opis okoliczności i – jeśli żądasz pieniędzy – kwotę oraz numer rachunku lub wniosek o zaliczenie jej na poczet przyszłych płatności (art. 378 ust. 4 PKE). Operator ma **30 dni** na rozpatrzenie reklamacji; jeśli nie odpowie, uważa się, że uznał Twoje żądanie (art. 378 ust. 5). Po odrzuceniu reklamacji możesz iść do sądu albo złożyć wniosek o polubowne rozwiązanie sporu do Prezesa UKE.`,
      },
      {
        heading: "Jak napisać skuteczną reklamację",
        body: `- **Opisz wady konkretnie** – co, gdzie, od kiedy, w jakich okolicznościach. Unikaj ocen („fuszerka”), podawaj fakty i wymiary.
- **Sformułuj jedno jasne żądanie** – usunięcie wad, obniżenie o określoną kwotę, zwrot pieniędzy – i wyznacz realny termin.
- **Dołącz dowody** – zdjęcia, nagrania, umowę, faktury, opinię rzeczoznawcy.
- **Zachowaj dowód doręczenia** – od niego liczy się termin na odpowiedź.
- **Nie zlecaj poprawek innej firmie przed reakcją wykonawcy** – chyba że wezwałeś go wcześniej i wyznaczony termin minął albo grozi poważna szkoda (np. zalanie).

Jeśli wykonawca odmówi, pomoc oferują miejscy i powiatowi rzecznicy konsumentów oraz wojewódzkie inspektoraty Inspekcji Handlowej (mediacje, stałe polubowne sądy konsumenckie).`,
      },
    ],
    faq: [
      {
        question: "Ile czasu ma firma na odpowiedź na reklamację usługi?",
        answer:
          "Przedsiębiorca ma 14 dni od otrzymania reklamacji konsumenta; brak odpowiedzi oznacza jej uznanie (art. 7a ustawy o prawach konsumenta). Operator telekomunikacyjny ma 30 dni (art. 378 ust. 5 Prawa komunikacji elektronicznej).",
      },
      {
        question: "Jak długo mogę reklamować remont?",
        answer:
          "Wykonawca odpowiada z tytułu rękojmi za wady stwierdzone w ciągu 2 lat od odbioru prac (art. 568 § 1 w zw. z art. 638 § 1 k.c.). Reklamację zgłoś jak najszybciej po zauważeniu wady i zabezpiecz dowody.",
      },
      {
        question: "Czy mogę zlecić poprawki innej firmie na koszt wykonawcy?",
        answer:
          "Gdy prace trwają – tak, po bezskutecznym upływie terminu wyznaczonego w wezwaniu do zmiany sposobu wykonania (art. 636 § 1 k.c.). Po odbiorze możesz żądać zwrotu kosztów usunięcia wad jako odszkodowania (art. 471 k.c.), ale najpierw daj wykonawcy szansę naprawy.",
      },
      {
        question: "Fryzjer zniszczył mi włosy – czego mogę żądać?",
        answer:
          "Bezpłatnej poprawki, zwrotu części lub całości ceny, a jeśli doszło do uszczerbku na zdrowiu – zwrotu kosztów leczenia i zadośćuczynienia. Zrób zdjęcia, zachowaj paragon i ewentualną dokumentację medyczną.",
      },
      {
        question: "Czy reklamacja musi być na piśmie?",
        answer:
          "Nie zawsze, ale pisemna reklamacja (lub e-mail) daje dowód treści żądania i daty doręczenia. Przy usługach telekomunikacyjnych dopuszczalna jest też reklamacja ustna do protokołu lub telefoniczna.",
      },
      {
        question: "Kurs online nie działa – czy mogę odzyskać pieniądze?",
        answer:
          "Tak, jeśli przedsiębiorca nie naprawi usługi w rozsądnym czasie, odmówi naprawy albo wada jest istotna – możesz złożyć oświadczenie o obniżeniu ceny lub odstąpieniu od umowy (art. 43n ustawy o prawach konsumenta). Zwrot powinien nastąpić w ciągu 14 dni.",
      },
      {
        question: "Wykonawca nie odpowiada – co dalej?",
        answer:
          "Jeśli jesteś konsumentem i minęło 14 dni od doręczenia reklamacji, reklamację uważa się za uznaną – wyślij wezwanie do spełnienia żądania. Pomoc oferuje miejski lub powiatowy rzecznik konsumentów; w ostateczności możesz złożyć pozew.",
      },
    ],
  },
  ai: {
    context:
      "Reklamacja wadliwie wykonanej usługi składana przez klienta (najczęściej konsumenta) do wykonawcy: remontu, montażu lub naprawy (umowa o dzieło), usługi bieżącej (fryzjer, kosmetyczka, sprzątanie), kursu, treści lub usługi cyfrowej albo usługi telekomunikacyjnej. Opis faktów ma chronologicznie przedstawić: co zamówiono i kiedy, kiedy usługa została wykonana, jakie konkretnie wady stwierdzono (z datami, miejscami, wymiarami), czy i kiedy zgłaszano je wcześniej oraz jakie są dowody. Nie formułuj żądania prawnego, terminów ustawowych ani podstaw prawnych – szablon dodaje je sam w zależności od wariantu. Ton rzeczowy, uprzejmy i stanowczy, bez emocji, ocen i gróźb; pisz w pierwszej osobie i neutralnie płciowo (bez form typu „zamówiłem/zamówiłam”).",
    factQuestionIds: [
      "service_type",
      "service_description",
      "contract_date",
      "performance_date",
      "work_status",
      "defects",
      "oral_report_date",
      "telecom_period",
      "evidence",
    ],
  },
  render: ({ answers, ai, today }) => {
    const type = serviceTypeOf(answers);
    const status = statusOf(answers);
    const regime = regimeOf(answers);
    const email = str(answers, "sender_email", "");
    const phone = str(answers, "sender_phone", "");
    const number = str(answers, "contract_number", "");
    const price = num(answers, "price");
    const contractDate = formatDatePl(dateAnswer(answers, "contract_date"));
    const performance = formatDatePl(dateAnswer(answers, "performance_date"));
    const paragraphs: Paragraph[] = [];

    // 1. Umowa
    const statusSentence =
      status === "consumer"
        ? " Umowę zawarto jako konsument."
        : status === "jdg"
          ? " Umowa jest bezpośrednio związana z prowadzoną przeze mnie działalnością gospodarczą, ale nie ma dla mnie charakteru zawodowego."
          : "";
    const description = lowerFirst(trimEndDot(str(answers, "service_description")));
    if (type === "telecom") {
      paragraphs.push(
        p(
          `Na podstawie umowy o świadczenie usług komunikacji elektronicznej zawartej w dniu ${contractDate}${
            number ? ` (numer, którego dotyczy reklamacja: ${number})` : ""
          }, obejmującej: ${description}, z opłatą w wysokości ${formatMoneyPl(price)}, składam reklamację usługi za okres: ${str(
            answers,
            "telecom_period",
          )}.${statusSentence}`,
        ),
      );
    } else {
      const done =
        regime === "work_in_progress"
          ? `Prace są w toku – ostatnie prace wykonano w dniu ${performance}.`
          : `Usługa została wykonana (odebrana) w dniu ${performance}.`;
      paragraphs.push(
        p(
          `W dniu ${contractDate} zawarto z Państwem umowę${number ? ` (${number})` : ""}, której przedmiotem było: ${description} (dalej: „Usługa”), za wynagrodzeniem w kwocie ${formatMoneyPl(
            price,
          )}.${statusSentence} ${done} ${
            regime === "work_in_progress"
              ? "Niniejszym zgłaszam, że prace są wykonywane wadliwie."
              : "Niniejszym składam reklamację Usługi z powodu jej wadliwego wykonania."
          }`,
        ),
      );
    }

    // 2. Stan faktyczny
    if (ai?.facts) {
      paragraphs.push(...paragraphsFromText(ai.facts));
      if (ai.justification) paragraphs.push(...paragraphsFromText(ai.justification));
    } else {
      const defects = userParagraphs(str(answers, "defects"));
      paragraphs.push(p(type === "telecom" ? "Usługa była świadczona nienależycie:" : "Stwierdzono następujące wady:"));
      defects.forEach((t) => paragraphs.push(p(t)));
      const oral = dateAnswer(answers, "oral_report_date");
      if (oral) {
        paragraphs.push(
          p(`Wady zostały zgłoszone ${type === "telecom" ? "operatorowi" : "wykonawcy"} już w dniu ${formatDatePl(oral)}, jednak nie zostały usunięte.`),
        );
      }
    }

    // 3. Podstawa prawna i żądanie
    if (ai?.demand) paragraphs.push(...paragraphsFromText(ai.demand));
    paragraphs.push(...legalAndDemand(answers, regime));

    // 4. Odpowiedź
    paragraphs.push(
      p(
        `Odpowiedź na ${regime === "work_in_progress" ? "niniejsze pismo" : "reklamację"} proszę przesłać na adres wskazany w nagłówku pisma${
          email ? ` lub na adres e-mail: ${email}` : ""
        }.${phone && type !== "digital" && type !== "telecom" ? ` W sprawie oględzin lub terminu poprawek proszę o kontakt pod numerem telefonu ${phone}.` : ""}`,
      ),
    );

    const titles: Record<Regime, string> = {
      work: "REKLAMACJA WADLIWIE WYKONANEJ USŁUGI (WAD DZIEŁA)",
      work_in_progress: "WEZWANIE DO ZMIANY SPOSOBU WYKONANIA PRAC",
      services: "REKLAMACJA USŁUGI",
      digital: "REKLAMACJA TREŚCI CYFROWEJ LUB USŁUGI CYFROWEJ",
      telecom: "REKLAMACJA USŁUGI KOMUNIKACJI ELEKTRONICZNEJ",
    };

    return {
      sender: partyFromAnswers(answers, "sender", [email ? `e-mail: ${email}` : "", phone ? `tel. ${phone}` : ""]),
      recipient: partyFromAnswers(answers, "recipient"),
      place: str(answers, "sender_city"),
      date: formatDatePl(today),
      title: titles[regime],
      subject: `dot. umowy z dnia ${contractDate}${number ? ` (${number})` : ""}`,
      salutation: "Szanowni Państwo,",
      paragraphs: paragraphs.map(tidyParagraph),
      closing: "Z poważaniem",
      signatureName: str(answers, "sender_name"),
      attachments: lines(str(answers, "evidence", "")),
      previewParagraphCount: 2,
    };
  },
};
