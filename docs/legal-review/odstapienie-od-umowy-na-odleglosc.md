# Legal review – `odstapienie-od-umowy-na-odleglosc`

Plik szablonu: `src/lib/templates/odstapienie-od-umowy-na-odleglosc.ts`
Stan prawny sprawdzony na: 14.10.2026 r. – ustawa o prawach konsumenta (u.p.k.), t.j. Dz. U. z 2026 r. poz. 1244 (tekst art. 27–38 porównany z t.j.).

## Przepisy cytowane

| Akt | Przepis | Do czego użyty | Pewność |
|---|---|---|---|
| u.p.k. | art. 27 ust. 1 | 14 dni na odstąpienie bez podania przyczyny i bez kosztów (poza art. 33, 34 ust. 2, 35) – pismo | wysoka |
| u.p.k. | art. 27 ust. 2 | 30 dni przy nieumówionej wizycie w miejscu zamieszkania/pobytu albo wycieczce – pismo (opcje `visit`, `trip`) | wysoka |
| u.p.k. | art. 28 pkt 1 i 2 | początek biegu terminu: towar – objęcie w posiadanie; inne umowy – zawarcie umowy – pismo | wysoka |
| u.p.k. | art. 29 ust. 1–2 | wydłużenie o 12 miesięcy przy braku pouczenia – pismo (gdy termin podstawowy minął, a `informed = no`) | wysoka |
| u.p.k. | art. 30 ust. 1–2 | dowolna forma oświadczenia, wystarczy wysłanie przed upływem terminu – pismo, poradnik | wysoka |
| u.p.k. | art. 31 ust. 1 | umowę uważa się za niezawartą – pismo | wysoka |
| u.p.k. | art. 32 ust. 1–3 | zwrot płatności w 14 dni, ten sam sposób zapłaty, prawo wstrzymania zwrotu – pismo, instrukcje | wysoka |
| u.p.k. | art. 33 | zwrot tylko najtańszego zwykłego sposobu dostawy – poradnik | wysoka |
| u.p.k. | art. 34 ust. 1, 1a, 2, 3, 4 | zwrot towaru w 14 dni, zaprzestanie korzystania z treści cyfrowych, koszty zwrotu, odbiór przy umowie poza lokalem, zmniejszenie wartości – pismo, poradnik | wysoka |
| u.p.k. | art. 35, 36 | zapłata za usługę wykonaną na żądanie konsumenta; brak kosztów treści cyfrowych – poradnik | wysoka |
| u.p.k. | art. 38 ust. 1–2 | wyłączenia prawa odstąpienia – poradnik (bez numerów punktów) | wysoka |

## Założenia

1. Pytanie o datę zawarcia umowy jest rozdzielone: `order_date` (towar) i `contract_date` (usługa / treść cyfrowa) – dzięki temu kalkulator terminów nie pokazuje mylącego terminu „od zawarcia umowy” przy zakupie towaru.
2. Zdanie „Niniejsze oświadczenie składam przed upływem X-dniowego terminu” dodawane jest wyłącznie, gdy wynika to z dat (data pisma ≤ początek biegu + 14/30 dni). Gdy termin minął, a użytkownik zaznaczył brak pouczenia – pismo powołuje art. 29 ust. 1. W pozostałych przypadkach pismo nie zawiera twierdzenia o terminowości.
3. Kwota 0 zł (np. usługa jeszcze nieopłacona) → pismo nie żąda zwrotu, tylko potwierdzenia, że umowa jest niezawarta i zaniechania naliczania opłat.
4. Opcja „odbiór towaru” daje powołanie art. 34 ust. 3 tylko przy umowach zawartych poza lokalem; przy umowie na odległość pismo prosi o wskazanie sposobu zwrotu bez powoływania przepisu.
5. Reguła terminu „bez pouczenia” liczy 12 miesięcy + 14 dni od otrzymania towaru (dla przypadku 30-dniowego jest to przybliżenie – opisane w `description`).

## [DO WERYFIKACJI] – pytania do prawnika

1. **art. 28 pkt 1** – szablon nie obsługuje wariantów lit. a–b (dostawy częściowe, dostawy regularne); informacja jest tylko w pomocy do pytania („data odbioru ostatniej paczki”). Czy to wystarczy?
2. **Umowy o usługi rozpoczęte przed upływem terminu (art. 35)** – pismo nie zawiera oświadczenia co do zapłaty za część wykonaną. Czy dodać opcjonalne pytanie?
3. **Umowy z operatorami telekomunikacyjnymi** – czy w piśmie warto odwołać się do przepisów szczególnych (Prawo komunikacji elektronicznej) w zakresie zwrotu urządzeń / ulg? (Obecnie brak.)
4. **Instrukcje** – informacja o procedurze chargeback i Europejskim Centrum Konsumenckim ma charakter praktyczny; do akceptacji.
