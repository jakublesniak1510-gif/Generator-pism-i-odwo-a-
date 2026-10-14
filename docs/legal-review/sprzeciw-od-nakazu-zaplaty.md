# Legal review – `sprzeciw-od-nakazu-zaplaty`

Plik szablonu: `src/lib/templates/sprzeciw-od-nakazu-zaplaty.ts`
Stan prawny sprawdzony na: 14.10.2026 r. Teksty jednolite pobrane z API Sejmu (ELI) i porównane artykuł po artykule.

Źródła weryfikacji:
- Kodeks postępowania cywilnego (k.p.c.) – t.j. **Dz. U. z 2026 r. poz. 468** (stan na 25.03.2026 r.). Zmiany po t.j.: Dz. U. z 2026 r. poz. 473 i 830 (w życie 8.07.2026 r.), poz. 1003 (systemy AI), poz. 1046 (od 5.11.2026 r., Kodeks pracy i k.p.c.), poz. 1296 (od 6.11.2026 r., usługi elektroniczne) – **nie sprawdzaliśmy ich treści pod kątem art. 480¹–505³⁹** [DO WERYFIKACJI], z tytułów nie wynika związek z postępowaniem nakazowym/upominawczym.
- Kodeks cywilny – t.j. **Dz. U. z 2026 r. poz. 795**.
- Ustawa z 28.07.2005 r. o kosztach sądowych w sprawach cywilnych (u.k.s.c.) – t.j. **Dz. U. z 2025 r. poz. 1228** (zmiany: Dz. U. z 2026 r. poz. 473 od 8.07.2026, poz. 1003 – nie sprawdzone pod kątem art. 19) [DO WERYFIKACJI].

## Ważne korekty względem założeń zlecenia

| Założenie w zleceniu | Stan po weryfikacji tekstu | Co zrobiono w szablonie |
|---|---|---|
| 14 dni na sprzeciw **i zarzuty** (art. 480³) | Termin określa **art. 480² § 2**: pkt 1 – **2 tygodnie** dla nakazu w postępowaniu upominawczym (doręczenie w kraju); pkt 3 – **miesiąc** dla nakazu w postępowaniu **nakazowym** (doręczenie w UE). Art. 480³ dotyczy treści i wnoszenia środka zaskarżenia. | Dwa osobne pola daty doręczenia (`service_date` – upominawczy/EPU, `service_date_n` – nakazowy) i dwa terminy: 14 dni oraz 1 miesiąc. W opisach: termin z pouczenia nakazu jest wiążący. |
| art. 503 – treść sprzeciwu | **art. 503 uchylony** (podobnie art. 491, 494, 497¹, 498, 502, 504). Treść: art. 480³ § 2 (zakres zaskarżenia + zarzuty formalne), art. 493 § 2 (zarzuty: fakty i dowody). | Pismo powołuje art. 505 § 1–2 (sprzeciw), art. 493 § 1–2 (zarzuty), art. 480³ § 2. |
| art. 505³⁵ – sprzeciw w EPU nie wymaga uzasadnienia | Obecne brzmienie art. 505³⁵: „Do sprzeciwu od nakazu zapłaty **nie dołącza się dowodów**.” | Przy EPU dowody tylko wymienione w treści, bez załączników. Pismo zawsze zawiera uzasadnienie. |
| art. 505³⁶ – umorzenie po sprzeciwie | Potwierdzone. Art. 505³⁷ § 2 – nowy pozew w 3 miesiące zachowuje skutki wniesienia pozwu w EPU. | W piśmie (EPU) i instrukcjach. |
| art. 493 – opłata 3/4 | Opłata wynika z **art. 19 ust. 4 u.k.s.c.**: 3/4 opłaty od zarzutów; konsument najwyżej **750 zł**. | W legalBasis, instrukcjach, poradniku, FAQ. |

## Rozgałęzienia

| Pole | Warianty | Skutek w piśmie |
|---|---|---|
| `order_type` | `epu` / `upominawczy` / `nakazowy` | Tytuł „SPRZECIW…” albo „ZARZUTY…”; podstawa (art. 505 vs art. 493); EPU: brak wniosku o koszty (art. 505³⁷ § 1), brak dowodów w załącznikach (art. 505³⁵), informacja o umorzeniu (art. 505³⁶); nakazowy: wniosek o uchylenie nakazu, załącznik „dowód uiszczenia opłaty” albo wniosek o zwolnienie. |
| `scope` | `whole` / `part` | zakres zaskarżenia (art. 480³ § 2), wartość przedmiotu zaskarżenia. |
| zarzuty (checkboxy) | `obj_prescription`, `obj_standing`, `obj_unproven`, `obj_paid`, `obj_no_contract`, `obj_costs` | osobny nagłówek i akapit dla każdego; `obj_standing`/`obj_unproven`/`obj_no_contract` dodają wniosek o zobowiązanie powoda do złożenia dokumentów. |
| `due_date` | data wymagalności | Przy przedawnieniu: koniec terminu = 31 grudnia roku (wymagalność + 3 lata), tylko gdy wymagalność ≥ 9.07.2018 r. i termin już minął. |
| `fee_waiver` | checkbox | wniosek o zwolnienie od kosztów (art. 102 u.k.s.c.) + załącznik – oświadczenie na formularzu. |

## Przepisy cytowane w piśmie i w treściach

| Akt | Przepis | Do czego użyty | Pewność |
|---|---|---|---|
| k.p.c. | art. 126 § 1–2¹, art. 128 § 1 | wymogi pisma procesowego, odpisy (instrukcje, poradnik) | wysoka |
| k.p.c. | art. 165 § 1–2 | obliczanie terminów wg k.c.; nadanie w placówce operatora wyznaczonego = wniesienie | wysoka |
| k.p.c. | art. 168–169 | przywrócenie terminu – wniosek w tydzień, brak winy | wysoka |
| k.p.c. | art. 232 | ciężar wskazania dowodów (pismo – nieudowodnienie) | wysoka |
| k.p.c. | art. 480² § 1–4 | termin 2 tygodnie / miesiąc; skutek prawomocnego wyroku | wysoka |
| k.p.c. | art. 480³ § 1–3 | wnoszenie do sądu, który wydał nakaz; zakres zaskarżenia, zarzuty formalne; odrzucenie | wysoka |
| k.p.c. | art. 492 § 1 | nakaz w postępowaniu nakazowym jako tytuł zabezpieczenia (instrukcje) | wysoka |
| k.p.c. | art. 493 § 1–4 | zarzuty, fakty i dowody, rozstrzygnięcie wyrokiem | wysoka |
| k.p.c. | art. 505 § 1–2 | sprzeciw, utrata mocy nakazu | wysoka |
| k.p.c. | art. 505¹ § 1 | postępowanie uproszczone do 20 000 zł (poradnik pośrednio) | wysoka |
| k.p.c. | art. 505²⁹ᵃ | EPU – roszczenia wymagalne w 3 lata przed pozwem (poradnik) | wysoka |
| k.p.c. | art. 505³¹ § 2 | wybór drogi elektronicznej wiąże (instrukcje, FAQ) | wysoka |
| k.p.c. | art. 505³⁴ § 1 | fikcja doręczenia w EPU przy adresie z PESEL (poradnik) | wysoka |
| k.p.c. | art. 505³⁵–505³⁷ | brak dowodów przy sprzeciwie w EPU, umorzenie, koszty, nowy pozew w 3 miesiące | wysoka |
| k.c. | art. 6 | ciężar dowodu | wysoka |
| k.c. | art. 117 § 2¹ | przedawnienie wobec konsumenta | wysoka |
| k.c. | art. 118 | 3 lata (działalność gospodarcza, świadczenia okresowe), koniec roku | wysoka |
| k.c. | art. 123 § 1 pkt 2 | uznanie przerywa przedawnienie (poradnik – ostrzeżenie) | wysoka |
| k.c. | art. 481 § 2¹ | odsetki maksymalne za opóźnienie | wysoka |
| k.c. | art. 385¹ § 1 | niedozwolone postanowienia umowne | wysoka |
| k.c. | art. 509, art. 513 § 1 | przelew wierzytelności, zarzuty wobec nabywcy | wysoka |
| u.k.s.c. | art. 19 ust. 4 | 3/4 opłaty od zarzutów, konsument max 750 zł | wysoka (t.j. 2025) |
| u.k.s.c. | art. 102 ust. 1–2 | zwolnienie od kosztów, oświadczenie według wzoru | wysoka |

## Założenia

1. Strona pozwana to osoba fizyczna; w treści używamy neutralnego określenia „strona pozwana”.
2. Zarzut przedawnienia opisuje termin 3-letni (roszczenia przedsiębiorcy). Przy długach między osobami prywatnymi (6 lat) zarzut pozostaje, ale bez wyliczenia daty – użytkownik powinien zweryfikować.
3. Data końca przedawnienia jest podawana tylko dla wymagalności od 9.07.2018 r. (dla wcześniejszych – przepisy przejściowe ustawy z 13.04.2018 r. o zmianie k.c., nie przesądzamy).
4. Sprzeciw w zwykłym postępowaniu upominawczym opisano jako „co do zasady bez opłaty” (brak przepisu o opłacie od sprzeciwu w u.k.s.c.).
5. Adres Sądu Rejonowego Lublin-Zachód w Lublinie nie jest wpisany na sztywno – użytkownik przepisuje go z nakazu/pouczenia.
6. W EPU nie wnosimy o zasądzenie kosztów (art. 505³⁷ § 1 – każda strona ponosi koszty związane ze swym udziałem).

## [DO WERYFIKACJI] – pytania do prawnika

1. **Termin w postępowaniu nakazowym** – tekst art. 480² § 2 pkt 3 wskazuje miesiąc (doręczenie w UE). Prosimy o potwierdzenie, że dotyczy to także doręczeń w Polsce (sformułowanie „na terytorium Unii Europejskiej” obejmuje Polskę) – szablon tak przyjmuje, ale w opisach odsyła do pouczenia w nakazie.
2. **Doręczenie zastępcze** – art. 139 § 1 i art. 139¹ k.p.c. (dla pierwszego pisma: doręczenie przez komornika), a w EPU art. 505³⁴ § 1. Pomoc pola daty mówi ogólnie, że zasady są złożone. Czy dodać precyzyjniejszy opis?
3. **Odpis sprzeciwu w EPU wnoszonego na papierze** – czy wymagany jest odpis dla powoda (art. 128 § 1)? Szablon go dołącza.
4. **Zmiany k.p.c. i u.k.s.c. po t.j.** (Dz. U. z 2026 r. poz. 473, 830, 1003, 1046, 1296) – potwierdzić brak wpływu na art. 480¹–505³⁹ k.p.c. i art. 19 u.k.s.c.
5. **Zarzut przedawnienia a cesja** – zdanie „Przelew wierzytelności nie powoduje rozpoczęcia biegu przedawnienia na nowo” – czy pozostawić jako argument ogólny (dodawany zawsze przy przedawnieniu)?
6. **Wniosek o zobowiązanie powoda do złożenia dokumentów** – brak powołanego przepisu (np. art. 248 k.p.c. – nie weryfikowaliśmy). Czy dodać podstawę?
7. **Ryzyko pominięcia twierdzeń i dowodów** – czy w poradniku/instrukcjach wyraźniej opisać skutki art. 205¹² § 2 i art. 458⁵ k.p.c. (sprawy gospodarcze)?
