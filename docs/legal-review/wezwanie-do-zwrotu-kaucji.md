# Legal review – `wezwanie-do-zwrotu-kaucji`

Plik szablonu: `src/lib/templates/wezwanie-do-zwrotu-kaucji.ts` (eksport `wezwanieDoZwrotuKaucji`).
Stan prawny sprawdzony na: 14.10.2026 r. – teksty pobrane z API Sejmu (ELI).

Źródła (Dz. U. – rok/poz.):
- Ustawa z 21.06.2001 r. o ochronie praw lokatorów, mieszkaniowym zasobie gminy i o zmianie Kodeksu cywilnego (u.o.p.l.) – t.j. **Dz. U. z 2023 r. poz. 725** (w API brak późniejszych aktów zmieniających).
- Kodeks cywilny – t.j. **Dz. U. z 2026 r. poz. 795**.
- Ustawa o dniach wolnych od pracy – t.j. **Dz. U. z 2025 r. poz. 296** (art. 115 k.c. – przesunięcie terminu).
- Ustawa o kosztach sądowych w sprawach cywilnych – t.j. **Dz. U. z 2025 r. poz. 1228** (art. 13 ust. 1 – opłaty w instrukcjach i poradniku).
- Kodeks postępowania cywilnego – t.j. **Dz. U. z 2026 r. poz. 468** (art. 505¹ § 1 – postępowanie uproszczone do 20 000 zł).

**Uwaga do briefu:** w briefie numeracja ustępów art. 6 była odwrócona. Zgodnie z t.j.: **ust. 3 – waloryzacja**, **ust. 4 – zwrot w ciągu miesiąca od opróżnienia lokalu**. W szablonie użyto numeracji z tekstu jednolitego.

## Warianty (`lease_type`)

| Wartość | Przepis o zwrocie | Limit kaucji | Waloryzacja |
|---|---|---|---|
| `standard` | art. 6 ust. 4 u.o.p.l. | 12× czynsz (art. 6 ust. 1) | tak – art. 6 ust. 3 (gdy podano oba czynsze) |
| `occasional` | art. 19a ust. 5 (potrącenia: ust. 4) | 6× czynsz (art. 19a ust. 4) | nie liczymy – patrz pytania |
| `institutional` | art. 19f ust. 6 (potrącenia: ust. 4) | 6× czynsz (art. 19f ust. 5) | nie liczymy – patrz pytania |

## Przepisy cytowane

| Akt | Przepis | Do czego użyty | Pewność |
|---|---|---|---|
| u.o.p.l. | art. 6 ust. 1 | kaucja ≤ 12× czynsz; zabezpiecza należności z tytułu najmu w dniu opróżnienia lokalu | wysoka |
| u.o.p.l. | art. 6 ust. 3 | waloryzacja: iloczyn czynszu z dnia zwrotu i krotności, nie mniej niż kaucja pobrana (pismo – wyliczenie) | wysoka |
| u.o.p.l. | art. 6 ust. 4 | zwrot w ciągu miesiąca od opróżnienia lokalu po potrąceniu należności (pismo) | wysoka |
| u.o.p.l. | art. 6c | protokół stanu technicznego – podstawa rozliczeń przy zwrocie (pismo – spór o potrącenia) | wysoka |
| u.o.p.l. | art. 6e, 6f, 6g | obowiązek odnowienia lokalu; możliwość odmiennej umowy; obowiązek informowania o zmianie adresu (poradnik, instrukcje) | wysoka |
| u.o.p.l. | art. 19a ust. 4–5 | najem okazjonalny: ≤ 6×, zwrot w miesiąc | wysoka |
| u.o.p.l. | art. 19f ust. 4–6 | najem instytucjonalny: ≤ 6×, zwrot w miesiąc | wysoka |
| k.c. | art. 6 | ciężar dowodu potrąceń na wynajmującym (pismo) | wysoka |
| k.c. | art. 112, art. 115 | koniec terminu miesięcznego; przesunięcie z soboty / dnia wolnego (algorytm `due`) | wysoka |
| k.c. | art. 481 § 1 | odsetki ustawowe za opóźnienie od dnia po upływie terminu (pismo) | wysoka |
| k.c. | art. 662 § 2, art. 681 | drobne nakłady (w tym malowanie) obciążają najemcę (poradnik, FAQ) | wysoka |
| k.c. | art. 675 § 1 i 3 | zwrot w stanie niepogorszonym; normalne zużycie; domniemanie wydania w stanie dobrym (pismo, poradnik) | wysoka |
| k.c. | art. 677 | roczne przedawnienie roszczeń wynajmującego o uszkodzenia (deadline, poradnik) | wysoka |
| k.c. | art. 118 | 6-letnie przedawnienie roszczenia o zwrot kaucji (deadline – opis) | średnia (kwalifikacja roszczenia – patrz pytania) |
| k.p.c. | art. 505¹ § 1 | postępowanie uproszczone ≤ 20 000 zł | wysoka |
| u.k.s.c. | art. 13 ust. 1 | opłaty stałe 30/100/200/400 zł | wysoka |

## Założenia

1. Odsetki liczone od dnia następującego po upływie miesiąca od opróżnienia lokalu (termin ustawowy – bez potrzeby wezwania z art. 455 k.c.); termin przesuwany zgodnie z art. 115 k.c.
2. Gdy w dniu sporządzenia pisma (`today`) termin ustawowy jeszcze nie upłynął, pismo wzywa do zwrotu „w ustawowym terminie, tj. do dnia …” zamiast terminu 7/14 dni.
3. „Czynsz” do waloryzacji = sam czynsz najmu (help w kwestionariuszu); jeżeli czynsz z dnia zwrotu jest niższy – zwracamy kwotę pobraną.
4. Przy częściowym zwrocie kwota żądania = należność (ew. zwaloryzowana) − kwota zwrócona.
5. Pismo nie twierdzi, że najemca nie musi malować lokalu – w akapicie spornym powołuje art. 675 § 1 k.c. i ciężar dowodu; w poradniku uczciwie opisujemy art. 6e/6f u.o.p.l. i art. 681 k.c.

## [DO WERYFIKACJI] – pytania do prawnika

1. **Waloryzacja przy najmie okazjonalnym i instytucjonalnym** – art. 19a i 19f nie odsyłają do art. 6 ust. 3. Przyjęliśmy brak waloryzacji (żądamy kwoty nominalnej). Czy to prawidłowe?
2. **Art. 6 ust. 3 a umowy z osobami prywatnymi** – czy waloryzacja wg „czynszu z dnia zwrotu” ma zastosowanie, gdy lokal nie jest ponownie wynajmowany (brak „czynszu obowiązującego w dniu zwrotu”)? Przyjęliśmy, że użytkownik podaje ostatni lub rynkowy czynsz – czy dopuszczalne?
3. **Art. 6e ust. 1 u.o.p.l. (obowiązek odnowienia lokalu)** vs. art. 675 § 1 k.c. – czy akapit kwestionujący potrącenia za malowanie jest wystarczająco bezpieczny, skoro art. 6f pozwala odmiennie umówić się tylko w zakresie art. 6a–6e (umowa milcząca → art. 6e stosuje się)?
4. **Przedawnienie roszczenia o zwrot kaucji** – przyjęliśmy termin ogólny 6 lat (art. 118 k.c.); część orzecznictwa stosuje art. 677 k.c. do rozliczeń najmu – prosimy o potwierdzenie.
5. **Termin 7/14 dni po upływie terminu ustawowego** – czy w piśmie nie lepiej żądać zapłaty „niezwłocznie” (odsetki biegną i tak), a termin 7 dni podać tylko jako termin przed skierowaniem sprawy do sądu? Obecne sformułowanie łączy jedno i drugie.
