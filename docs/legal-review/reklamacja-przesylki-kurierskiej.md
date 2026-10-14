# Legal review – `reklamacja-przesylki-kurierskiej`

Plik szablonu: `src/lib/templates/reklamacja-przesylki-kurierskiej.ts` (eksport `reklamacjaPrzesylkiKurierskiej`).
Stan prawny sprawdzony na: 14.10.2026 r. – teksty pobrane z API Sejmu (ELI).

Źródła (Dz. U. – rok/poz.):
- Prawo pocztowe – t.j. **Dz. U. z 2026 r. poz. 558** (w API brak późniejszych zmian).
- Rozporządzenie MAiC z 26.11.2013 r. w sprawie reklamacji usługi pocztowej – t.j. **Dz. U. z 2019 r. poz. 474** (status „obowiązujący”).
- Prawo przewozowe – t.j. **Dz. U. z 2024 r. poz. 1262** (akt bazowy Dz. U. z 1984 r. Nr 53, poz. 272).
- Rozporządzenie MTiB z 24.02.2006 r. w sprawie ustalania stanu przesyłek oraz postępowania reklamacyjnego – **Dz. U. z 2006 r. Nr 38, poz. 266**, zm. **Dz. U. z 2017 r. poz. 2406** (nowe § 5–6a, § 9; § 10 bez zmian).
- Kodeks cywilny – t.j. **Dz. U. z 2026 r. poz. 795**; ustawa o prawach konsumenta – t.j. **Dz. U. z 2026 r. poz. 1244**.

## Wyniki weryfikacji punktów z briefu

| Teza z briefu | Wynik |
|---|---|
| art. 75 ust. 3 pkt 2 Pp – nadawca lub odbiorca | **potwierdzone**: lit. a (zwrot należności – kto zapłacił), lit. b (inne roszczenia – kto ma prawo rozporządzania) |
| art. 548 § 3 k.c. – ryzyko do wydania konsumentowi | **potwierdzone** (wraz z wyjątkiem: przewoźnik wybrany przez kupującego bez wpływu sprzedawcy) |
| art. 74 Pp – protokół; 7 dni na ubytki niewidoczne | **potwierdzone**: art. 74 ust. 1–4 i ust. 3 (7 dni), skutek – art. 76 pkt 4 |
| art. 77 Pp – przedawnienie 1 rok | **potwierdzone** (ust. 1); zwłoka bez szkody – 2 miesiące (ust. 2); początek biegu – ust. 3 |
| art. 80–82 Pp – wartość, przewoźne | **potwierdzone**; ponadto art. 83 (zwłoka – do 2× przewoźnego), art. 87 (odsetki od dnia reklamacji) |
| rozp. MTiB 2006 – 30 dni, § 10 milczenie = uwzględnienie | **potwierdzone**: § 6 ust. 1 (30 dni od wpływu – brzmienie z 2017 r.), § 10 „skutkuje uwzględnieniem reklamacji”; § 6 dotyczy terminu, nie formy |
| Prawo pocztowe art. 87–92, 30 dni, art. 92 | **częściowo inaczej**: art. 92 reguluje **kto** może reklamować (nadawca / adresat) i termin 12 mies. (ust. 3); **30 dni** na odpowiedź i **milczenie = uznanie** wynikają z rozporządzenia: **§ 9 ust. 1 i § 14**; przedawnienie 12 mies. od nadania – art. 93 ust. 2 |
| „kurier = Prawo przewozowe” | **do korekty**: przesyłka kurierska jest przesyłką pocztową (art. 3 pkt 19 Ppoczt.); firmy kurierskie wpisane do rejestru operatorów pocztowych podlegają Prawu pocztowemu. Prawo przewozowe – przewóz towarów na liście przewozowym (art. 2 ust. 2 pkt 2 Ppoczt. wyłącza „przewóz rzeczy innych niż korespondencja, wykonywany na podstawie odrębnych przepisów”). Stąd warianty `courier` / `post_universal` / `transport` / `unknown`. |

## Przepisy cytowane

| Akt | Przepis | Do czego | Pewność |
|---|---|---|---|
| Ppoczt. | art. 3 pkt 19 | definicja przesyłki kurierskiej (poradnik) | wysoka |
| Ppoczt. | art. 87 ust. 3 | odpowiedzialność operatora, przesłanki egzoneracyjne, ciężar dowodu (pismo) | wysoka |
| Ppoczt. | art. 87 ust. 6 | wygaśnięcie roszczeń przy przyjęciu bez zastrzeżeń; 7 dni na szkody niewidoczne (pismo, deadline) | wysoka |
| Ppoczt. | art. 88 ust. 1 | limity w usłudze powszechnej (10× / 50× opłaty, wartość zadeklarowana) | wysoka |
| Ppoczt. | art. 88 ust. 4 pkt 1, 2, 4 | usługi niepowszechne: zwykła wartość, wartość zadeklarowana, opóźnienie – do 2× opłaty | wysoka |
| Ppoczt. | art. 88 ust. 5 | odsetki po 30 dniach od uznania reklamacji (poradnik) | wysoka |
| Ppoczt. | art. 91 ust. 1–3 | zwrot opłaty przy niewykonaniu; niewykonanie = doręczenie po 14 dniach (usługa powszechna) | wysoka |
| Ppoczt. | art. 92 ust. 1–3 | kto reklamuje; reklamacja w każdej placówce; 12 miesięcy od nadania | wysoka |
| Ppoczt. | art. 93 ust. 2, art. 95 | przedawnienie 12 mies.; ADR przed Prezesem UKE | wysoka |
| rozp. MAiC 2013 | § 6 ust. 1–2, § 9 ust. 1, § 11, § 14 | kiedy można reklamować utratę; 30 dni; odwołanie 14 dni; milczenie = uznanie | wysoka |
| Pp | art. 65 ust. 1–2, 74, 75 ust. 1–3, 76, 77, 80, 81, 82, 83, 87 | odpowiedzialność, protokół, reklamacja, odszkodowania, odsetki | wysoka |
| rozp. MTiB 2006 | § 6 ust. 1, § 10 | 30 dni; milczenie = uwzględnienie | wysoka |
| k.c. | art. 543¹ § 1–2 | obowiązek wydania w 30 dni; dodatkowy termin i odstąpienie (pismo do sklepu) | wysoka |
| k.c. | art. 548 § 3 | ryzyko po stronie sprzedawcy do wydania konsumentowi (pismo do sklepu) | wysoka |
| u.p.k. | art. 7a, 43b, 43d ust. 1, 43e ust. 1 pkt 4 i ust. 6 | towar uszkodzony w transporcie – wymiana / odstąpienie; 14 dni | wysoka |

## Założenia

1. Wariant `unknown` nie wskazuje konkretnych limitów odszkodowania – tylko zasady ogólne obu ustaw i 30-dniowy termin z obu rozporządzeń.
2. W wariancie `post_universal` pismo przytacza limity art. 88 ust. 1, ale kwotę żądania wpisuje użytkownik (ustawa: „w wysokości żądanej przez nadawcę, nie wyższej niż…”).
3. Odbiorca reklamujący zaginioną przesyłkę pocztową bez zrzeczenia nadawcy – pismo i tak powstaje, a help/poradnik ostrzega o braku legitymacji (art. 92 ust. 1 pkt 2).
4. Pismo do sklepu – tylko dla konsumenta (zdanie „Umowę zawarto jako konsument”); przy zaginięciu i żądaniu zwrotu – dodatkowy termin z art. 543¹ § 2, bez natychmiastowego odstąpienia.
5. Deadline 12 miesięcy liczony od daty nadania (Prawo pocztowe); dla Prawa przewozowego termin roczny ma inne punkty startowe (art. 77 ust. 3) – opisane w `description`.

## [DO WERYFIKACJI] – pytania do prawnika

1. **Kwalifikacja usług kurierskich** – Prawo pocztowe vs. Prawo przewozowe przy paczkach (nie korespondencji) przewożonych przez operatorów pocztowych. Przyjęliśmy domyślnie Prawo pocztowe dla firm kurierskich i paczkomatów. Czy to bezpieczne?
2. **Odstąpienie od umowy na odległość przed doręczeniem towaru** (art. 27 u.p.k.) – nie powołujemy w piśmie do sklepu; czy dodać jako alternatywę dla konsumenta?
3. **Żądanie odsetek od dnia wniesienia reklamacji (art. 87 ust. 2 pkt 2 Pp)** – czy w piśmie nie należy doprecyzować „odsetek ustawowych za opóźnienie”?
4. **Sklep + opóźnienie** – żądanie zwrotu kosztów dostawy jako odszkodowania (art. 471 k.c.) – czy wystarczająco uzasadnione?
