# Legal review – `zwrot-prowizji-wczesniejsza-splata-kredytu`

Plik szablonu: `src/lib/templates/zwrot-prowizji-wczesniejsza-splata-kredytu.ts`
Stan prawny sprawdzony na: 14.10.2026 r. Teksty jednolite pobrane z API Sejmu (ELI) i porównane artykuł po artykule.

Źródła weryfikacji:
- Ustawa z 12.05.2011 r. o kredycie konsumenckim (u.k.k.) – t.j. **Dz. U. z 2025 r. poz. 1362** (stan na 15.09.2025 r.). Kolejna zmiana: Dz. U. z 2026 r. poz. 1206 (ustawa z 31.07.2026 r. o zmianie ustawy – Prawo bankowe oraz niektórych innych ustaw) – zmiany u.k.k. **wchodzą w życie 11.01.2027 r.**, do przeglądu [DO WERYFIKACJI]. Do sprawdzenia także stan wdrożenia dyrektywy (UE) 2023/2225 (CCD2).
- Ustawa z 23.03.2017 r. o kredycie hipotecznym (u.k.h.) – t.j. **Dz. U. z 2025 r. poz. 720**; ustawa obowiązuje od 22.07.2017 r. (data zmian wprowadzonych przez nią w innych ustawach wg ELI).
- Ustawa o rozpatrywaniu reklamacji (u.r.r.) – t.j. **Dz. U. z 2026 r. poz. 823**.
- Kodeks cywilny – t.j. **Dz. U. z 2026 r. poz. 795**.
- Wyrok TSUE z 11.09.2019 r., **C-383/18 Lexitor** – sentencja sprawdzona w EUR-Lex (CELEX 62018CJ0383, wersja PL).

## Rozgałęzienia

| Pole | Warianty | Skutek w piśmie |
|---|---|---|
| `credit_type` | `consumer` / `mortgage` | Konsumencki: art. 49 ust. 1 + art. 5 pkt 6 u.k.k., wyrok C-383/18, art. 52 u.k.k. (z datą upływu 14 dni, jeśli minęła). Hipoteczny: art. 39 ust. 1 u.k.h. (bez wyroku Lexitor, który dotyczy dyrektywy 2008/48/WE, i bez art. 52 u.k.k.). |
| `previous_request` | `no` / `refused` / `partial` | `partial`: odjęcie `already_refunded` od sumy zwrotów; `refused`/`no`: zdanie o braku rozliczenia lub odmowie. |
| daty | `contract_date`, `planned_end_date`, `repayment_date` | Gdy daty są niespójne (spłata nie mieści się w okresie umowy) – pismo podaje wzór bez kwot i wnosi o wyliczenie przez kredytodawcę. |

## Metoda wyliczenia

Metoda liniowa (`calculateRefund`): `zwrot = koszt × (dni od spłaty do planowanego końca ÷ dni od zawarcia do planowanego końca)`, zaokrąglenie do grosza dla każdej pozycji; suma minus kwoty już zwrócone. Przykład kontrolny z poradnika: 3000 zł, 1.03.2023–1.03.2028 (1827 dni), spłata 1.03.2025 (1096 dni) → 1799,67 zł – zgodny z wynikiem funkcji.

## Przepisy cytowane w piśmie i w treściach

| Akt | Przepis | Do czego użyty | Pewność |
|---|---|---|---|
| u.k.k. | art. 3 ust. 1 | zakres (do 255 550 zł) – tylko w kontekście, nie cytowany w piśmie | wysoka |
| u.k.k. | art. 5 pkt 6 | definicja całkowitego kosztu kredytu (prowizje, opłaty, ubezpieczenia niezbędne do uzyskania kredytu) | wysoka |
| u.k.k. | art. 48 | prawo do wcześniejszej spłaty (poradnik) | wysoka |
| u.k.k. | art. 49 ust. 1 i 2 | obniżenie kosztów „chociażby konsument poniósł je przed tą spłatą”; spłata częściowa | wysoka (brzmienie zweryfikowane); **data wprowadzenia zwrotu „chociażby…” nieustalona** – patrz pytanie 2 |
| u.k.k. | art. 52 | rozliczenie w 14 dni od całkowitej spłaty | wysoka |
| u.k.h. | art. 39 ust. 1 i 2 | obniżenie odsetek i innych kosztów „przypadających za okres…”, „chociażby konsument poniósł je przed tą spłatą” | wysoka co do treści; **zakres dla kosztów jednorazowych – sporny** (pytanie 3) |
| u.r.r. | art. 2 pkt 2, art. 6–8 | pismo jako reklamacja; 30/60 dni; fikcja uwzględnienia | wysoka |
| k.c. | art. 118 | przedawnienie 6 lat, koniec roku kalendarzowego (termin, FAQ, poradnik) | wysoka |
| k.c. | art. 481 § 1 | odsetki za opóźnienie (zastrzeżenie w piśmie) | wysoka |
| TSUE | C-383/18 Lexitor, 11.09.2019 | obniżka obejmuje wszystkie koszty nałożone na konsumenta | wysoka (EUR-Lex) |

## Założenia

1. Generator liczy zwrot wyłącznie przy **całkowitej** wcześniejszej spłacie. Spłata częściowa – tylko informacja w poradniku/FAQ.
2. Okres kredytowania liczony od daty zawarcia umowy (nie od daty wypłaty) – najczęstsza praktyka; do potwierdzenia.
3. Ubezpieczenie liczone jak prowizja (liniowo) – jeżeli zwrot składki realizuje ubezpieczyciel, użytkownik podaje go jako „już zwrócone”.
4. Termin przedawnienia w kalkulatorze: 6 lat od dnia spłaty bez przesunięcia na koniec roku (wartość ostrożna); opis wyjaśnia koniec roku i przepisy przejściowe dla spłat sprzed 9.07.2018 r.
5. Pismo nie cytuje uchwały SN z 12.12.2019 r., **III CZP 45/19** (nie udało się zweryfikować jej treści – sn.pl blokuje pobieranie, baza SAOS jej nie zawiera). W poradniku jest jedynie zdanie, że zwrot przysługuje także przy spłatach sprzed wyroku TSUE – bez sygnatury.

## [DO WERYFIKACJI] – pytania do prawnika

1. **III CZP 45/19** – potwierdzić sygnaturę, datę (12.12.2019 r.) i tezę; jeśli zgodne – czy dodać ją do pisma obok wyroku C-383/18.
2. **Art. 49 ust. 1 u.k.k. – zwrot „chociażby konsument poniósł je przed tą spłatą”** – od kiedy obowiązuje to brzmienie i czy przy umowach starszych pismo powinno opierać się wyłącznie na wykładni prounijnej (C-383/18)? (W aktach zmieniających z lat 2021–2023 nie znaleźliśmy tej zmiany; możliwe, że wprowadziła ją u.k.h. z 2017 r.)
3. **Kredyt hipoteczny** – czy art. 39 u.k.h. obejmuje prowizję pobraną jednorazowo, w świetle wyroku TSUE z 9.02.2023 r., C-555/21 (UniCredit Bank Austria) dotyczącego dyrektywy 2014/17/UE (koszty niezależne od czasu trwania umowy) – **wyroku nie zweryfikowaliśmy** (EUR-Lex nie zwrócił treści). Czy dla umów hipotecznych sprzed 22.07.2017 r. dodać ostrzeżenie lub zablokować wariant?
4. **Przedawnienie** – potwierdzić 6-letni termin (art. 118 k.c.) dla roszczenia konsumenta o zwrot części kosztów oraz początek biegu (dzień spłaty / 14 dni po spłacie / wezwanie – art. 455 k.c.). Kwestia przepisów przejściowych z ustawy z 13.04.2018 r. (spłaty sprzed 9.07.2018 r.).
5. **Metoda liniowa vs actuarialna** – czy w piśmie dodać zastrzeżenie, że konsument przyjmuje metodę liniową jako proporcjonalną w rozumieniu art. 49, a bank może przedstawić inną kalkulację?
6. **Zmiany u.k.k. od 11.01.2027 r.** (Dz. U. z 2026 r. poz. 1206) i ewentualna nowa ustawa wdrażająca CCD2 – sprawdzić, czy nie zmieniają art. 49/52 lub numeracji.
