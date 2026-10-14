# PismoGotowe – generator pism i odwołań. Koncepcja po weryfikacji

Data: 14.10.2026. Dokument powstał z propozycji założyciela, przejrzanej i poprawionej przez szefa projektu (Fable 5.1). Wersja robocza do dalszych decyzji.

## 1. Co zostaje bez zmian
- Model „pismo w 2 minuty”: wybór pisma → kwestionariusz → podgląd → płatność → DOCX/PDF + instrukcja wysyłki.
- SEO jako główny kanał: każde pismo = osobna podstrona z poradnikiem i generatorem.
- Podstawy prawne w szablonie, nie w AI.
- Regulamin: narzędzie do tworzenia dokumentów, nie porada prawna.

## 2. Co poprawiłem w pierwotnej liście pism i dlaczego

| Pierwotna propozycja | Decyzja | Powód |
|---|---|---|
| „Reklamacja towaru (rękojmia) i usługi” | **Reklamacja towaru niezgodnego z umową**, z automatycznym wyborem reżimu | Dla konsumentów od 1.01.2023 nie obowiązuje już rękojmia z KC, tylko rozdział 5a ustawy o prawach konsumenta (art. 43a–43g). Pismo powołujące „rękojmię” wygląda nieaktualnie i osłabia pozycję klienta. Reklamacja usług ma zbyt wiele wariantów – odkładam na etap 2. |
| „Odwołanie od opłaty za parkowanie (prywatne parkingi, strefy płatne)” | **Rozbite na dwa pisma** | To dwa zupełnie różne reżimy: parking prywatny = roszczenie cywilne z umowy (argumenty: brak regulaminu, kara umowna, ciężar dowodu); strefa płatnego parkowania = opłata z ustawy o drogach publicznych, reklamacja do zarządu dróg w terminie z regulaminu gminy, egzekucja administracyjna. Jeden wzór nie obsłuży obu, a frazy w Google też są rozdzielne. |
| „Odwołanie od opłaty za jazdę bez biletu” | zostaje, z naciskiem na **7-dniowy tryb umorzenia** (bilet imienny / dokument ulgi) | To najczęstszy wygrywalny przypadek i najmocniejsza fraza. |
| „Wypowiedzenie umowy (telefon, internet, siłownia, najem)” | zostaje jako jedno pismo z wariantami | Uwaga: od 10.11.2024 obowiązuje Prawo komunikacji elektronicznej zamiast Prawa telekomunikacyjnego – stare wzory w internecie cytują nieistniejącą ustawę. To nasza przewaga, ale wymaga weryfikacji numerów artykułów przez prawnika. |
| „Reklamacja lotu i wniosek o odszkodowanie” | zostaje; generator sam liczy kwotę (250/400/600 EUR × liczba pasażerów) | Wysoka wartość dla klienta → łatwo uzasadnić cenę. Konkurencja (firmy „no win no fee”) bierze 25–35 % odszkodowania; my 24,99 zł. To dobry argument marketingowy. |
| „Pismo do spółdzielni lub wspólnoty” | zostaje jako pismo z 3 wariantami (dokumenty / usterka / rozliczenie) | Samo „pismo do spółdzielni” było zbyt ogólne; warianty odpowiadają realnym frazom. |
| „Wezwanie do zapłaty” | zostaje, z wariantem B2B (rekompensata 40 EUR, odsetki w transakcjach handlowych) | Duży wolumen wyszukiwań, prosty szablon. |
| – | **DODANE: Odstąpienie od umowy zawartej na odległość (14 dni)** | Jedna z najczęściej szukanych fraz konsumenckich w Polsce, bardzo prosty szablon, wysoka konwersja (ludzie potrzebują „na już”). |

Łącznie na start: **9 pism**. Pierwsze 3 do kampanii Ads: reklamacja towaru, odstąpienie od umowy, jazda bez biletu (największy wolumen + najprostsze do wygrania).

## 3. Co dodałem do produktu
1. **Tryb bez AI jako domyślny i zawsze działający.** Każdy szablon składa poprawne pismo wyłącznie z odpowiedzi użytkownika. AI (Claude) jedynie redaguje opis stanu faktycznego i żądanie – i tylko gdy klucz API jest skonfigurowany. Jeśli AI nie odpowie lub w tekście pojawi się cokolwiek przypominającego cytowanie przepisu („art.”, „ustaw”, „sygn.”, „wyrok”…), wynik AI jest odrzucany automatycznie. To rozwiązuje ryzyko „AI zmyśla przepisy” na poziomie architektury, nie promptu.
2. **Kalkulator terminów.** Szablon zna reguły (np. 2 lata od wydania towaru, 14 dni od odbioru, 1 rok od lotu, 7 dni od kontroli). Użytkownik widzi konkretną datę i „zostało N dni” – to zwiększa poczucie wartości i pilności (konwersja).
3. **Rozgałęzienia prawne w kwestionariuszu** (konsument/firma, zakup przed/po 2023, rodzaj umowy). Darmowe wzory tego nie mają – to nasza realna przewaga.
4. **Karta „Co dalej” po zakupie**: gdzie wysłać, czy list polecony wystarczy e-mail, ile czasu ma adresat, co zrobić gdy odmówi (rzecznik konsumentów, UOKiK, Rzecznik Praw Pasażerów, UKE, EPU). To treść, którą klienci w praktyce cenią najbardziej.
5. **Dostęp przez link z tokenem, bez zakładania konta** – mniej tarcia, mniej danych do RODO.
6. **Dokumentacja dla prawnika** (`docs/legal-review/`): każdy cytowany przepis z oceną pewności. Prawnik dostaje listę do odhaczenia zamiast czytać kod.

## 4. Ceny – rekomendacja
| Produkt | Cena | Uwagi |
|---|---|---|
| Pojedyncze pismo | **24,99 zł** | środek widełek 19–29; cena „poniżej 25” psychologicznie. Testować 19,99 vs 29,99 w Ads po 2–3 tygodniach. |
| Pakiet 5 pism | 59 zł | etap 2 (wymaga kont lub kodów). |
| Pismo + sprawdzenie przez prawnika | 129 zł | etap 2, po podpisaniu umowy z kancelarią; marża dla nas 40–60 zł. |
| Odszkodowanie lotnicze – upsell | 49 zł | pismo + instrukcja do Rzecznika Praw Pasażerów; alternatywa dla prowizji 25 % u pośredników. Do testu. |

Koszt AI na pismo (Claude Opus 5.5, ok. 2 tys. tokenów wejścia z cache + 600 wyjścia): ok. 0,02–0,05 zł. Stripe: 1,9 % + 1 zł (BLIK/P24 podobnie). Marża brutto na piśmie ok. 22 zł.

Rachunek z propozycji (3 000 wejść × 3 % × 25 zł = 2 250 zł) jest realistyczny dla miesiąca 4–6 po starcie. Konwersja 3 % wymaga ruchu z fraz transakcyjnych („wzór”, „jak napisać”), nie informacyjnych.

## 5. Ryzyka – uzupełnienie
- **Weryfikacja prawna przed startem jest obowiązkowa.** Lista do sprawdzenia w `docs/legal-review/`. Szczególnie: numery ustępów art. 33a Prawa przewozowego, terminy z regulaminów SPP, artykuły Prawa komunikacji elektronicznej.
- **Odpowiedzialność**: regulamin ogranicza odpowiedzialność do ceny pisma; dokument wymaga sprawdzenia przez użytkownika; sprawy sporne powyżej np. 5 000 zł kierujemy do kancelarii (baner).
- **RODO**: dane z kwestionariusza = dane osobowe (często też dane osób trzecich). Retencja 90 dni, potem automatyczne usuwanie. Anthropic i Stripe jako podmioty przetwarzające – do umów powierzenia. Nie wysyłamy do AI danych adresowych – tylko opis sprawy (zaimplementowane: do modelu trafiają wyłącznie pytania z `factQuestionIds`).
- **Zmiany prawa**: każdy szablon ma pole `legalBasis` w jednym miejscu; aktualizacja = jedna zmiana w pliku. Kwartalny przegląd w kalendarzu.
- **Google i „thin content”**: poradniki muszą mieć min. 700 słów własnej treści, FAQ i dane strukturalne – zaimplementowane w szablonach.

## 6. Jak zdobyć klientów – uzupełnienie
- SEO: 9 podstron z poradnikami + FAQ (JSON-LD) + sitemap. Następne 10 pism dodawać po 1–2 tygodniowo wg Keyword Planner.
- Google Ads: 3 kampanie na frazy z intencją „wzór”, budżet testowy 30 zł/dzień przez 2 tygodnie; śledzić koszt pozyskania (cel < 12 zł).
- Partnerstwa: rzecznicy konsumentów i fora (Wykop, grupy FB „oszukani przez…”) – darmowe poradniki z linkiem.
- Kancelaria: oferujemy ruch w zamian za audyt szablonów (barter) + prowizję od „sprawdzenia przez prawnika”.

## 7. Plan 3–4 tygodnie (aktualizacja)
- [x] Tydzień 1: wybór 9 pism, architektura, MVP serwisu (ten commit).
- [ ] Tydzień 1–2: audyt prawny szablonów (`docs/legal-review/`), poprawki.
- [ ] Tydzień 2: domena, hosting (Vercel/Railway/VPS), Stripe (BLIK, P24, karty), dane firmy w regulaminie, klucz Anthropic, Google Search Console.
- [ ] Tydzień 3: Google Ads na 3 pisma, Analytics z celami (podgląd → płatność).
- [ ] Tydzień 4: analiza konwersji, test ceny, kolejne pisma (reklamacja usługi, sprzeciw od nakazu zapłaty, wniosek o raty, RODO – żądanie usunięcia danych).

## 8. Decyzje do podjęcia przez założyciela
1. Nazwa i domena (robocza: „PismoGotowe”).
2. Forma prawna sprzedaży (JDG / spółka) – potrzebna do regulaminu i Stripe.
3. Kancelaria do audytu – barter czy stawka godzinowa (szacunek: 6–10 godzin na 9 szablonów).
4. Czy włączamy AI od startu (koszt pomijalny, ale wymaga umowy powierzenia danych), czy startujemy w trybie czystego szablonu.
