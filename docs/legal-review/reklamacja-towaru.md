# Legal review – `reklamacja-towaru`

Plik szablonu: `src/lib/templates/reklamacja-towaru.ts`
Stan prawny sprawdzony na: 14.10.2026 r. (teksty jednolite pobrane z API Sejmu / ISAP).

- Ustawa o prawach konsumenta (u.p.k.) – t.j. Dz. U. z 2026 r. poz. 1244 (obwieszczenie z 4.09.2026 r.).
- Kodeks cywilny (k.c.) – t.j. Dz. U. z 2026 r. poz. 795.
- Ustawa z 4.11.2022 r. o zmianie u.p.k., k.c. i p.p.m. – Dz. U. z 2022 r. poz. 2337.

## Rozgałęzienie reżimu (logika `regimeOf`)

| Status kupującego | Data zawarcia umowy | Reżim w piśmie |
|---|---|---|
| konsument | od 1.01.2023 | u.p.k. rozdz. 5a + art. 7a |
| JDG – umowa bez charakteru zawodowego | od 1.01.2023 | u.p.k. rozdz. 5a w zw. z art. 7aa ust. 1; **bez** art. 7a ust. 2 (patrz pytania) |
| konsument / JDG | przed 1.01.2023 | k.c. rękojmia (art. 556 i n.) + art. 556², art. 561⁵ (JDG: w zw. z art. 556⁴) |
| przedsiębiorca (zawodowo) | dowolna | k.c. rękojmia, bez przepisów konsumenckich; zawiadomienie z art. 563 § 1 |

Brak daty zakupu → przyjmujemy reżim u.p.k. (najczęstszy przypadek).

## Przepisy cytowane w piśmie i w treściach

| Akt | Przepis | Do czego użyty | Pewność |
|---|---|---|---|
| u.p.k. | art. 7a ust. 1–3 | 14 dni na odpowiedź, milczenie = uznanie, odpowiedź na trwałym nośniku (pismo – konsument) | wysoka (tekst zweryfikowany) |
| u.p.k. | art. 7aa ust. 1 | rozszerzenie rozdz. 4, 5a, 5b na JDG (pismo – JDG) | wysoka co do treści; numer „ust. 1” nadany od 27.11.2025 r. |
| u.p.k. | art. 43b | definicja zgodności towaru z umową (legalBasis, poradnik) | wysoka |
| u.p.k. | art. 43c ust. 1 | 2 lata odpowiedzialności + domniemanie istnienia braku zgodności (pismo) | wysoka |
| u.p.k. | art. 43d ust. 1, 2, 4, 5 | naprawa/wymiana, koszty po stronie przedsiębiorcy, odbiór towaru na jego koszt (pismo) | wysoka |
| u.p.k. | art. 43e ust. 1 pkt 1–4 | przesłanki obniżenia ceny / odstąpienia – mapowanie opcji `demand_basis` → punkt (pismo) | wysoka |
| u.p.k. | art. 43e ust. 2, 3 | proporcja obniżki, zwrot w 14 dni od oświadczenia (pismo) | wysoka |
| u.p.k. | art. 43e ust. 4, 6, 7 | domniemanie istotności, zwrot ceny w 14 dni od otrzymania towaru, sposób zwrotu (pismo) | wysoka |
| ustawa z 4.11.2022 r. (Dz. U. poz. 2337) | art. 4 ust. 1 | do umów sprzed 1.01.2023 stosuje się przepisy dotychczasowe (pismo – reżim k.c.) | wysoka (tekst zweryfikowany) |
| k.c. | art. 556, 556¹ § 1 pkt 1 | rękojmia, definicja wady (pismo – reżim k.c.) | wysoka |
| k.c. | art. 556² | domniemanie 1 rok – tylko konsument, tylko gdy wada stwierdzona < 1 rok od wydania (pismo) | wysoka |
| k.c. | art. 556⁴ | przepisy konsumenckie działu dot. rękojmi stosowane do JDG (pismo) | wysoka co do treści; **[DO WERYFIKACJI]** dla umów sprzed 1.01.2021 (przepis obowiązuje od 1.01.2021) |
| k.c. | art. 560 § 1, 3, 4 | obniżenie ceny / odstąpienie (pismo) | wysoka |
| k.c. | art. 561 § 1–2, art. 561³ | wymiana / usunięcie wady, koszty (pismo) | wysoka |
| k.c. | art. 561⁵ | 14 dni, milczenie = uznanie żądania (konsument; nie obejmuje odstąpienia) (pismo) | wysoka (tekst nadal w t.j. 2026) |
| k.c. | art. 563 § 1 | zawiadomienie o wadzie przy sprzedaży między przedsiębiorcami (pismo – firma, poradnik) | wysoka |
| k.c. | art. 568 § 1 | 2 lata od wydania rzeczy (pismo, deadline) | wysoka |

## Założenia

1. Pismo dla przedsiębiorcy-kupującego (B2B) prosi o odpowiedź w 14 dni, ale nie przypisuje milczeniu skutku prawnego (brak takiego przepisu w B2B).
2. Domniemanie z art. 43c ust. 1 zd. 2 zostaje pominięte tylko wtedy, gdy z dat wynika, że wada ujawniła się po 2 latach; przy braku dat zdanie jest dodawane.
3. Przy obniżeniu ceny i odstąpieniu pismo – jeśli użytkownik podał rachunek – zawiera wyraźną zgodę konsumenta na zwrot przelewem (art. 43e ust. 7).
4. W piśmie dla reżimu k.c. przy odstąpieniu nie powołujemy art. 561⁵ (przepis nie obejmuje oświadczenia o odstąpieniu).
5. Termin „Orientacyjny termin odpowiedzi sprzedawcy” liczony jest od planowanej daty wysłania (14 dni) – to przybliżenie; ustawowo liczy się od otrzymania reklamacji.

## [DO WERYFIKACJI] – pytania do prawnika

1. **JDG a art. 7a u.p.k.** – art. 7aa ust. 1 rozciąga na JDG tylko rozdziały 4, 5a i 5b, a art. 7a jest w rozdziale 1. Przyjęliśmy, że skutek milczenia (art. 7a ust. 2) nie dotyczy JDG – czy to prawidłowe?
2. **JDG – zakupy przed 1.01.2021** – art. 556⁴ k.c. obowiązuje od 1.01.2021 r.; szablon nie rozróżnia zakupów JDG sprzed tej daty. Czy dodać ostrzeżenie / trzecią gałąź?
3. **Brzmienie k.c. „dotychczasowe”** – cytujemy art. 556², 561⁵, 568 według t.j. 2026; prosimy o potwierdzenie, że ich brzmienie na dzień 31.12.2022 r. było tożsame (pod kątem umów sprzed 2023 r.).
4. **art. 43c ust. 1 zd. 2** – w piśmie skracamy wyjątki od domniemania do „o ile nie zostanie udowodnione inaczej” (pomijamy „specyfikę towaru”). Czy to akceptowalne?
5. **Instrukcje** – numery infolinii konsumenckiej (801 440 220 / 222 66 76 76) oraz informacja o stałych polubownych sądach konsumenckich przy WIIH – do potwierdzenia aktualności.
6. Czy w piśmie dla konsumenta warto dodać zdanie o art. 43f (powstrzymanie się z zapłatą ceny) dla zakupów na raty / płatności odroczonej?
