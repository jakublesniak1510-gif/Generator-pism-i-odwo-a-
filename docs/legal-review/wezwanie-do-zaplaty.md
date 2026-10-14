# Przegląd prawny – `wezwanie-do-zaplaty`

Plik szablonu: `src/lib/templates/wezwanie-do-zaplaty.ts` (eksport `wezwanieDoZaplaty`).
Warianty: wierzyciel `person`/`company`, dłużnik `person`/`company`, podstawa długu `invoice`/`contract`/`loan`/`deposit`/`other`, odsetki `statutory`/`commercial`/`contractual`, opcjonalnie rekompensata (art. 10) i ostrzeżenie o BIG.

## Cytowane przepisy

| Akt | Artykuł | Do czego użyty | Pewność |
|---|---|---|---|
| Kodeks cywilny | art. 353 § 1 | istota zobowiązania – „Podstawa prawna” | wysoka |
| Kodeks cywilny | art. 455 | termin spełnienia świadczenia niezwłocznie po wezwaniu | wysoka |
| Kodeks cywilny | art. 476 | opóźnienie / zwłoka | wysoka |
| Kodeks cywilny | art. 481 § 1 i 2 | odsetki za opóźnienie (ustawowe; stopa z góry oznaczona) | wysoka |
| Kodeks cywilny | art. 481 § 2¹ | limit odsetek maksymalnych przy odsetkach umownych | wysoka |
| Kodeks cywilny | art. 723 | pożyczka bez oznaczonego terminu – zwrot w 6 tygodni po wypowiedzeniu; pismo = wypowiedzenie | wysoka |
| Kodeks cywilny | art. 118, art. 554 | deadline `limitation` (3/6 lat, koniec roku; 2 lata – sprzedaż) | wysoka |
| Kodeks cywilny | art. 123 § 1 | poradnik/FAQ – przerwanie biegu przedawnienia (pozew, uznanie, zawezwanie do próby ugodowej) | wysoka; zawezwanie do próby ugodowej po nowelizacjach [DO WERYFIKACJI] |
| Kodeks cywilny | art. 482 | NIE użyty w piśmie (anatocyzm nie dotyczy wezwania) | – |
| Ustawa z 8.03.2013 r. o przeciwdziałaniu nadmiernym opóźnieniom w transakcjach handlowych (Dz.U. 2013 poz. 403) | art. 7 ust. 1 | odsetki ustawowe za opóźnienie w transakcjach handlowych – tylko B2B (faktura/umowa) | wysoka; początek naliczania „od dnia wymagalności” vs „od dnia następnego” [DO WERYFIKACJI] |
| j.w. | art. 10 ust. 1 pkt 1–3 | rekompensata 40/70/100 EUR (≤ 5000 zł / > 5000 i < 50 000 zł / ≥ 50 000 zł), kurs średni NBP z ostatniego dnia roboczego miesiąca poprzedzającego wymagalność | wysoka |
| j.w. | – | poradnik: stopa ref. NBP + 10 pp (transakcje handlowe), ref. + 5,5 pp (ustawowe za opóźnienie) | wysoka; wyjątek dla podmiotów leczniczych (8 pp) pominięty |
| j.w. / TSUE | – | poradnik/FAQ: rekompensata „od każdej faktury” | [DO WERYFIKACJI] |
| Kodeks postępowania cywilnego | art. 187 § 1 pkt 3 | informacja o próbie polubownego rozwiązania sporu w pozwie | wysoka |
| Kodeks postępowania cywilnego | art. 98 § 1 | zasada zwrotu kosztów procesu przez przegrywającego | wysoka |
| Kodeks postępowania cywilnego | postępowanie nakazowe (art. 485) | poradnik – „faktura zaakceptowana przez dłużnika” | [DO WERYFIKACJI] – właściwy paragraf |
| Ustawa z 9.04.2010 r. o udostępnianiu informacji gospodarczych i wymianie danych gospodarczych | ogólnie (w piśmie bez numeru artykułu) | ostrzeżenie o zamiarze przekazania danych do BIG | wysoka co do aktu |
| j.w. | art. 14 (dłużnik – przedsiębiorca) i art. 15 (konsument) | warunki: umowa z BIG, próg kwotowy (prawdopodobnie 500 zł / 200 zł), wymagalność ≥ 30 dni, miesiąc od wysłania wezwania listem poleconym lub doręczenia do rąk własnych, z firmą i adresem siedziby biura | [DO WERYFIKACJI] – numery, progi, liczenie miesiąca od wysłania |

## Założenia
- Odsetki „w transakcjach handlowych” i rekompensata wyłącznie gdy: wierzyciel = firma, dłużnik = firma, podstawa = faktura lub umowa. W innym przypadku szablon automatycznie stosuje odsetki ustawowe za opóźnienie (cicha korekta wyboru użytkownika).
- Odsetki liczone od dnia następującego po terminie płatności (`due_date` + 1). Bez `due_date` – od dnia następującego po upływie terminu z wezwania.
- Pożyczka bez `due_date` → termin zapłaty 6 tygodni od doręczenia (ignorujemy `payment_days`), pismo stanowi wypowiedzenie umowy pożyczki.
- Nie liczymy kwot odsetek ani rekompensaty w PLN (brak danych kursowych) – wskazujemy rodzaj i datę początkową.
- Zwrot grzecznościowy: „Szanowni Państwo,” tylko gdy dłużnik to firma; przy osobie prywatnej brak zwrotu (nie znamy płci).
- Kwota słownie – nie jest wymagana (zgodnie z założeniami produktu).

## Pytania do prawnika
1. Art. 7 ust. 1 ustawy o przeciwdziałaniu nadmiernym opóźnieniom: od którego dnia naliczać odsetki – dzień wymagalności czy dzień następny?
2. Warunki wpisu do BIG (art. 14/15): aktualne progi kwotowe, liczenie miesiąca od „wysłania” wezwania, wymagana treść ostrzeżenia – czy nasze zdanie jest wystarczające?
3. Czy dopuszczalne jest pozostawienie „cichej” zamiany odsetek handlowych na ustawowe, czy lepiej blokować wybór w formularzu?
4. Czy przy kaucji mieszkaniowej (art. 6 ustawy o ochronie praw lokatorów) dodać osobny akapit o terminie miesiąca od opróżnienia lokalu?
5. Czy w zdaniu o kosztach postępowania (art. 98 § 1 KPC) nie ma ryzyka uznania za nacisk – ton oceniamy jako rzeczowy.
