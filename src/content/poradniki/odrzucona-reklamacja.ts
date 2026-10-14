import type { GuideArticle } from "./types";

export const odrzuconaReklamacja: GuideArticle = {
  slug: "sprzedawca-odrzucil-reklamacje",
  title: "Co zrobić, gdy sprzedawca odrzucił reklamację",
  metaDescription:
    "Reklamacja odrzucona? Ścieżka krok po kroku: ponowne pismo, rzecznik konsumentów, Inspekcja Handlowa, UOKiK, e-sąd i pozew w postępowaniu uproszczonym.",
  excerpt:
    "Odmowa sprzedawcy nie zamyka sprawy. Pokazujemy kolejne kroki – od ponownego pisma, przez bezpłatną pomoc rzecznika konsumentów i Inspekcji Handlowej, po sąd.",
  updatedAt: "2026-10-14",
  relatedTemplates: ["reklamacja-towaru", "reklamacja-uslugi", "reklamacja-przesylki-kurierskiej", "wezwanie-do-zaplaty"],
  // [DO WERYFIKACJI] „Sprzedawca ma 14 dni na odpowiedź… inaczej reklamację uznaje się za uzasadnioną” – art. 7a ust. 1 i 2 u.p.k.
  // [DO WERYFIKACJI] „odpowiada za brak zgodności ujawniony w ciągu 2 lat od wydania” i domniemanie – art. 43c u.p.k.
  // [DO WERYFIKACJI] uprawnienia rzecznika konsumentów (art. 42 ustawy o ochronie konkurencji i konsumentów).
  // [DO WERYFIKACJI] numer infolinii konsumenckiej – sprawdzić aktualny na prawakonsumenta.uokik.gov.pl (celowo nie podano).
  // [DO WERYFIKACJI] postępowanie uproszczone do 20 000 zł (art. 505^1 k.p.c.); wysokość opłat sądowych – ustawa o kosztach
  //   sądowych w sprawach cywilnych (celowo bez kwot).
  body: `
Odmowa uznania reklamacji to nie koniec sprawy. Sprzedawcy często odrzucają reklamacje „na wszelki wypadek” – licząc, że klient się zniechęci. Jeżeli wiesz, że towar był wadliwy, masz kilka bezpłatnych lub tanich ścieżek dochodzenia swoich praw. Poniżej opisujemy je w kolejności, w jakiej zwykle warto z nich korzystać.

## Krok 0: sprawdź, czy sprzedawca odpowiedział w terminie

Jeżeli kupiłeś towar jako konsument, sprzedawca ma **14 dni** na odpowiedź na reklamację. Jeśli w tym czasie nie zajął stanowiska, reklamację uważa się za uznaną. Wtedy nie musisz dyskutować o odmowie – wystarczy pismo, w którym powołujesz się na upływ terminu i żądasz realizacji swojego żądania. Dlatego tak ważny jest dowód, kiedy reklamacja dotarła do sprzedawcy.

## Krok 1: przeczytaj uzasadnienie odmowy

Zobacz, czym sprzedawca uzasadnia odmowę. Najczęstsze powody to:

- „uszkodzenie mechaniczne” lub „nieprawidłowe użytkowanie”,
- „wada nie została stwierdzona”,
- „upłynął termin reklamacji”,
- odesłanie do gwarancji producenta.

Pamiętaj, że sprzedawca odpowiada wobec konsumenta za brak zgodności towaru z umową ujawniony w ciągu **2 lat** od wydania towaru, a w tym czasie domniemywa się, że wada istniała już w chwili wydania. To sprzedawca musi wykazać, że jest inaczej. Odesłanie do gwarancji nie zwalnia go z odpowiedzialności – gwarancja to dodatkowe uprawnienie, a nie zamiennik.

## Krok 2: ponowne pismo z dowodami

Napisz do sprzedawcy ponownie. Odnieś się konkretnie do argumentów z odmowy i dołącz dowody: zdjęcia, nagrania, opinię niezależnego serwisu albo rzeczoznawcy. Wyraźnie powtórz swoje żądanie (naprawa, wymiana, obniżenie ceny lub odstąpienie od umowy) i wyznacz termin na odpowiedź, np. 14 dni. Zaznacz, że w razie braku porozumienia zwrócisz się o pomoc do rzecznika konsumentów.

Taki list często wystarcza – wiele firm zmienia stanowisko, gdy widzi, że klient zna swoje prawa i ma dowody.

## Krok 3: miejski lub powiatowy rzecznik konsumentów

Rzecznik konsumentów działa przy starostwie powiatowym lub urzędzie miasta i pomaga **bezpłatnie**. Może:

- udzielić porady i ocenić Twoje szanse,
- wystąpić do przedsiębiorcy w Twojej sprawie – pismo z urzędu ma zwykle większą siłę niż list od klienta,
- w niektórych sprawach wytoczyć powództwo na Twoją rzecz albo przyłączyć się do postępowania.

Właściwy jest zwykle rzecznik w miejscu Twojego zamieszkania. Przygotuj kopię umowy lub paragonu, reklamacji, odpowiedzi sprzedawcy i dowodów.

## Krok 4: Inspekcja Handlowa – polubowne rozwiązanie sporu

Wojewódzkie inspektoraty Inspekcji Handlowej prowadzą **pozasądowe postępowania** w sporach konsumenckich (mediacje) i działają przy nich stałe polubowne sądy konsumenckie. Udział jest dobrowolny dla obu stron – firma może odmówić. Jeśli jednak się zgodzi, sprawa zwykle kończy się szybciej i taniej niż w sądzie.

## Krok 5: UOKiK – kiedy problem dotyczy wielu klientów

Urząd Ochrony Konkurencji i Konsumentów **nie rozstrzyga indywidualnych sporów** – nie odzyska Twoich pieniędzy. Warto jednak zgłosić sprawę, jeśli firma stosuje praktykę wobec wielu klientów (np. systemowo odrzuca reklamacje z tym samym uzasadnieniem albo ma niedozwolone zapisy w regulaminie). Przy UOKiK działa też infolinia konsumencka, na której uzyskasz bezpłatną poradę.

## Krok 6: sąd – e-sąd albo pozew w postępowaniu uproszczonym

Jeśli polubowne drogi zawiodły, zostaje sąd. Nie bój się tego etapu – w sprawach konsumenckich o niewielkie kwoty jest prostszy, niż się wydaje.

- **Postępowanie uproszczone** obejmuje sprawy o wartości do 20 000 zł. Pozew składasz na urzędowym formularzu, a opłata sądowa jest stała i zależy od wartości sporu.
- **Elektroniczne postępowanie upominawcze (e-sąd)** sprawdza się, gdy domagasz się zapłaty konkretnej kwoty (np. zwrotu ceny po odstąpieniu od umowy). Pozew składasz przez internet, a opłata jest niższa niż w zwykłym postępowaniu.

Przed pozwem wyślij sprzedawcy **wezwanie do zapłaty** z ostatecznym terminem. To dowód, że próbowałeś załatwić sprawę polubownie, i element, który sąd bierze pod uwagę.

## Ścieżka w skrócie

1. Sprawdź, czy sprzedawca odpowiedział w ciągu 14 dni.
2. Odpowiedz na odmowę pismem z dowodami.
3. Poproś o pomoc rzecznika konsumentów.
4. Zaproponuj mediację w Inspekcji Handlowej.
5. Zgłoś praktykę do UOKiK, jeśli dotyczy wielu klientów.
6. Wyślij wezwanie do zapłaty, a potem – w razie potrzeby – złóż pozew.

Na każdym etapie zachowuj kopie pism i dowody wysyłki. W sporze z firmą wygrywa zwykle ten, kto ma lepszą dokumentację.
`,
};
