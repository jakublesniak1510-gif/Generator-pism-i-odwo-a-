import type { GuideArticle } from "./types";

export const terminy: GuideArticle = {
  slug: "jak-liczyc-terminy",
  title: "Jak liczyć terminy w pismach: dni kalendarzowe, robocze i doręczenie",
  metaDescription:
    "Od kiedy liczyć 14 dni, co gdy termin kończy się w sobotę lub święto, czym jest doręczenie zastępcze. Zasady liczenia terminów z Kodeksu cywilnego.",
  excerpt:
    "14 dni na reklamację, 2 tygodnie na sprzeciw, miesiąc wypowiedzenia – od kiedy to liczyć i co, gdy ostatni dzień wypada w sobotę? Zasady z Kodeksu cywilnego z przykładami.",
  updatedAt: "2026-10-14",
  relatedTemplates: [
    "sprzeciw-od-nakazu-zaplaty",
    "odstapienie-od-umowy-na-odleglosc",
    "reklamacja-towaru",
    "wezwanie-do-zaplaty",
    "odwolanie-od-decyzji-ubezpieczyciela",
  ],
  // [DO WERYFIKACJI] „14-dniowe terminy” w przykładach (odstąpienie – art. 27 u.p.k., odpowiedź na reklamację – art. 7a u.p.k.).
  // [DO WERYFIKACJI] „Od 2025 r. dniem wolnym jest także Wigilia” – ustawa o dniach wolnych od pracy po nowelizacji.
  // [DO WERYFIKACJI] „termin na reklamację w banku liczony w dniach roboczych” – ustawa o rozpatrywaniu reklamacji
  //   przez podmioty rynku finansowego / ustawa o usługach płatniczych; podano tylko ogólnie, bez liczby dni.
  // [DO WERYFIKACJI] „sprzeciw od nakazu zapłaty – 2 tygodnie od doręczenia” – art. 505 § 1 k.p.c.
  // [DO WERYFIKACJI] doręczenie zastępcze – art. 139 § 1 k.p.c., art. 44 k.p.a. (14 dni od pierwszego awizo).
  body: `
Termin to w pismach rzecz najważniejsza. Spóźniony sprzeciw od nakazu zapłaty zostanie odrzucony, a reklamacja, na którą firma nie odpowie w terminie, może zostać uznana. Dobra wiadomość: zasady liczenia terminów są proste, a większość z nich znajdziesz w kilku przepisach Kodeksu cywilnego (art. 110–116).

## Terminy w dniach: nie licz dnia zdarzenia

Jeżeli termin jest oznaczony w dniach, kończy się z upływem ostatniego dnia (art. 111 § 1 k.c.). Gdy początkiem terminu jest jakieś zdarzenie – np. odbiór paczki, doręczenie pisma, wydanie towaru – **dnia, w którym to zdarzenie nastąpiło, nie wliczasz** (art. 111 § 2 k.c.).

**Przykład:** kurier doręczył Ci towar kupiony przez internet w poniedziałek 5 października. Masz 14 dni na odstąpienie od umowy. Dzień 1 to wtorek 6 października, a dzień 14 – poniedziałek 19 października. Termin upływa o północy z 19 na 20 października.

## Terminy w tygodniach, miesiącach i latach

Termin oznaczony w tygodniach, miesiącach lub latach kończy się z upływem dnia, który **nazwą lub datą odpowiada** początkowemu dniowi terminu. Jeśli takiego dnia w ostatnim miesiącu nie ma, termin kończy się ostatniego dnia tego miesiąca (art. 112 k.c.).

**Przykłady:**

- Nakaz zapłaty doręczono Ci w środę – dwutygodniowy termin na sprzeciw upływa w środę za dwa tygodnie.
- Termin miesięczny liczony od 15 marca upływa 15 kwietnia.
- Termin miesięczny liczony od 31 stycznia upływa 28 lutego (albo 29 lutego w roku przestępnym), bo 31 lutego nie istnieje.

Gdy ciągłość terminu nie jest wymagana, miesiąc liczy się jako 30 dni, a rok jako 365 dni (art. 114 k.c.). W pismach, które przygotowujesz, rzadko ma to znaczenie – zwykle chodzi o terminy ciągłe.

## Koniec terminu w sobotę, niedzielę lub święto

Jeżeli koniec terminu do wykonania czynności przypada na dzień ustawowo wolny od pracy lub na **sobotę**, termin upływa następnego dnia, który nie jest dniem wolnym ani sobotą (art. 115 k.c.). Podobną zasadę mają procedury sądowa i administracyjna.

**Przykład:** czternasty dzień terminu wypada w sobotę 24 października. Termin przesuwa się na poniedziałek 26 października.

Dni ustawowo wolne to niedziele i święta z ustawy o dniach wolnych od pracy – m.in. 1 i 6 stycznia, Wielkanoc z poniedziałkiem, 1 i 3 maja, Boże Ciało, 15 sierpnia, 1 i 11 listopada oraz 25 i 26 grudnia. Od 2025 r. dniem wolnym jest także Wigilia (24 grudnia).

## Dni kalendarzowe a dni robocze

Jeśli przepis lub umowa mówi po prostu o „dniach”, chodzi o **dni kalendarzowe** – liczysz każdy dzień, także weekendy i święta. Tylko ostatni dzień podlega przesunięciu, jeśli wypada w dzień wolny lub sobotę.

**Dni robocze** pojawiają się rzadziej – np. w niektórych terminach na rozpatrzenie reklamacji przez banki i instytucje płatnicze. Wtedy pomijasz soboty, niedziele i święta. Zawsze sprawdź dokładne brzmienie przepisu lub regulaminu: „14 dni” i „14 dni roboczych” to w praktyce różnica nawet tygodnia.

## Wysłanie czy doręczenie – co się liczy?

To pytanie, które najczęściej decyduje o tym, czy zdążyłeś.

- **Liczy się wysłanie**, gdy przepis tak stanowi. Przykład: przy odstąpieniu od umowy zawartej na odległość wystarczy wysłać oświadczenie przed upływem 14 dni. Pismo do sądu lub urzędu nadane w placówce operatora wyznaczonego też jest złożone w dniu nadania.
- **Liczy się doręczenie**, gdy chodzi o oświadczenie woli, które ma wywołać skutek u adresata – np. wypowiedzenie umowy. Skutek następuje, gdy pismo dotarło do adresata tak, że mógł zapoznać się z jego treścią (art. 61 k.c.).

W razie wątpliwości **wysyłaj wcześniej**. Kilka dni zapasu kosztuje mniej niż spór o to, czy termin został zachowany.

## Doręczenie zastępcze, czyli awizo

Gdy sąd lub urząd wysyła Ci pismo, a Ciebie nie ma w domu, listonosz zostawia awizo. Jeśli nie odbierzesz przesyłki, po 14 dniach od pierwszego awizowania pismo uważa się za doręczone – to tzw. **doręczenie zastępcze**. Od tego dnia biegną terminy, np. na sprzeciw od nakazu zapłaty, nawet jeśli koperty nigdy nie otworzyłeś.

Dlatego jeśli wyjeżdżasz na dłużej, ustaw przekierowanie poczty albo upoważnij kogoś do odbioru. A gdy termin minął bez Twojej winy, sprawdź możliwość złożenia wniosku o przywrócenie terminu – zwykle trzeba to zrobić szybko, w ciągu kilku dni od ustania przeszkody.

## Jak nie przegapić terminu

1. Zapisz **datę zdarzenia**, od którego biegnie termin (odbiór towaru, doręczenie pisma) – najlepiej z dowodem.
2. Policz termin według zasad powyżej i wpisz go do kalendarza z przypomnieniem kilka dni wcześniej.
3. Sprawdź, czy ostatni dzień nie wypada w sobotę lub święto.
4. Ustal, czy liczy się wysłanie, czy doręczenie – i dobierz do tego sposób wysyłki ([poradnik o liście poleconym](/poradniki/list-polecony-za-potwierdzeniem-odbioru)).

Przy pismach przygotowanych w PismoGotowe wyliczamy najważniejsze terminy automatycznie na podstawie dat z formularza – zobaczysz je przy gotowym dokumencie.
`,
};
