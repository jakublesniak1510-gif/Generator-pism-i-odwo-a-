# Legal review – `odwolanie-oplata-parking-prywatny`

Plik szablonu: `src/lib/templates/odwolanie-oplata-parking-prywatny.ts`
Stan prawny sprawdzony na: 14.10.2026 r.

- Kodeks cywilny (k.c.) – t.j. Dz. U. z 2026 r. poz. 795 (art. 6, 60, 66, 117, 118, 384, 385¹, 385³, 483, 484 porównane z t.j.).
- Prawo o ruchu drogowym (p.r.d.) – t.j. Dz. U. z 2024 r. poz. 1251; sprawdzono, że późniejsze nowelizacje (2025–2026) nie zmieniły art. 78 ust. 4.
- RODO – rozporządzenie (UE) 2016/679 (nie pobierano tekstu w tej sesji – cytowane z wiedzy).
- Ustawa o udostępnianiu informacji gospodarczych i wymianie danych gospodarczych – t.j. Dz. U. z 2025 r. poz. 85 (art. 14 ust. 1 – FAQ).

## Charakter roszczenia

Roszczenie firmy parkingowej jest cywilnoprawne (umowa zawierana w sposób dorozumiany przez wjazd – art. 60 k.c.). Pismo jest odpowiedzią na wezwanie do zapłaty: odmowa zapłaty + żądanie dowodów + (opcjonalnie) żądanie z art. 15 RODO. Brak ustawowej procedury reklamacyjnej i ustawowego terminu – wyjaśnione w poradniku.

## Przepisy cytowane

| Akt | Przepis | Do czego użyty | Pewność |
|---|---|---|---|
| k.c. | art. 6 | ciężar dowodu po stronie firmy – pismo (zawsze) | wysoka |
| k.c. | art. 60 | oświadczenie woli przez zachowanie (wjazd) – pismo (argument „brak oznakowania”) | wysoka |
| k.c. | art. 66 § 1 | oferta musi określać istotne postanowienia – pismo | wysoka |
| k.c. | art. 384 § 1 i 2 | wiązanie wzorcem (regulaminem); wyjątek dla drobnych bieżących spraw życia codziennego – pismo | wysoka co do treści; **[DO WERYFIKACJI]** czy umowa parkingowa to „drobna, bieżąca sprawa życia codziennego” |
| k.c. | art. 483 § 1 | kara umowna tylko dla zobowiązań niepieniężnych – pismo (argument „rażąco wygórowana”) | wysoka co do treści; **[DO WERYFIKACJI]** kwalifikacja „opłaty dodatkowej” jako kary umownej (firmy twierdzą, że to cena za postój bez biletu) |
| k.c. | art. 484 § 2 | miarkowanie rażąco wygórowanej kary – pismo | wysoka |
| k.c. | art. 385¹ § 1, art. 385³ pkt 17 | klauzula niedozwolona – rażąco wygórowana kara umowna – pismo | wysoka (pkt 17 zweryfikowany) |
| k.c. | art. 117 § 2¹, art. 118 | przedawnienie wobec konsumenta, 3 lata dla roszczeń z działalności gospodarczej, koniec roku – poradnik | wysoka co do treści; **[DO WERYFIKACJI]** czy do umowy parkingowej nie stosuje się krótszego terminu szczególnego |
| p.r.d. | art. 78 ust. 4 | obowiązek wskazania kierującego istnieje tylko wobec uprawnionego organu – pismo (argument „nie byłem kierującym”), FAQ | wysoka |
| RODO | art. 15 ust. 1 (w tym lit. g), ust. 3 | prawo dostępu: źródło danych, cele, odbiorcy, okres, kopia – pismo | wysoka (z wiedzy, tekst nie pobierany w sesji) |
| RODO | art. 12 ust. 3 | odpowiedź w terminie miesiąca – pismo, poradnik | wysoka (z wiedzy) |
| u.u.i.g. | art. 14 ust. 1 | warunki wpisu konsumenta do BIG: ≥ 200 zł, wymagalność ≥ 30 dni, wezwanie z ostrzeżeniem listem poleconym, miesiąc – FAQ | wysoka co do pkt 2–3; **[DO WERYFIKACJI]** pkt 1 (nowe brzmienie: „zobowiązanie powstało w związku z określonym stosunkiem prawnym…, art. 187¹ k.p.c.”) – czy umowa parkingowa się kwalifikuje |

## Założenia

1. Argument „nie byłem kierującym” jest dostępny tylko, gdy w pytaniu `was_driver` wybrano „inna osoba” lub „wolę nie wskazywać”. Przy „wolę nie wskazywać” pismo nie twierdzi, że autor nie kierował – mówi tylko, że właściciel nie jest stroną umowy.
2. Pismo zawsze zawiera: odmowę uznania roszczenia, powołanie art. 6 k.c., wniosek o anulowanie wezwania i zastrzeżenie, że pismo nie stanowi uznania roszczenia.
3. Termin w kalkulatorze to wyłącznie termin z wezwania (umowny, nie ustawowy).
4. Prośba o odpowiedź w 14 dni nie jest powiązana z żadnym skutkiem prawnym (brak gróźb).

## [DO WERYFIKACJI] – pytania do prawnika

1. Ocena argumentu z art. 483 § 1 k.c. w świetle aktualnego orzecznictwa sądów rejonowych w sprawach „opłat dodatkowych” na parkingach prywatnych.
2. Czy w argumencie „brak oznakowania” utrzymać powołanie art. 384 § 2 zd. 2 k.c. (drobne sprawy życia codziennego) – może ono działać na korzyść firmy.
3. Czy dodać argument o braku legitymacji czynnej firmy (operator vs właściciel terenu) jako osobny punkt – obecnie jest tylko w żądaniu dowodów (umocowanie).
4. Przedawnienie – 3 lata (art. 118 k.c.) czy termin szczególny (np. dla najmu)? Poradnik mówi „co do zasady 3 lata”.
5. FAQ: sprzeciw od nakazu zapłaty – 14 dni (postępowanie upominawcze / EPU) – do potwierdzenia po nowelizacji k.p.c. z 2025 r. (Dz. U. poz. 1172).
