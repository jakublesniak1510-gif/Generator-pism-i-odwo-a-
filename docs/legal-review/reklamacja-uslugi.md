# Legal review – `reklamacja-uslugi`

Plik szablonu: `src/lib/templates/reklamacja-uslugi.ts` (eksport `reklamacjaUslugi`).
Stan prawny sprawdzony na: 14.10.2026 r. – teksty pobrane z API Sejmu (ELI).

Źródła (Dz. U. – rok/poz.):
- Kodeks cywilny – t.j. **Dz. U. z 2026 r. poz. 795**.
- Ustawa o prawach konsumenta (u.p.k.) – t.j. **Dz. U. z 2026 r. poz. 1244**.
- Prawo komunikacji elektronicznej (PKE) – **Dz. U. z 2024 r. poz. 1221** (brak tekstu jednolitego; sprawdzono akty zmieniające: Dz. U. z 2025 r. poz. 637, 820; z 2026 r. poz. 252, 815, 1296 – nie dotyczą art. 378–383).
- PKE – przepisy wprowadzające – **Dz. U. z 2024 r. poz. 1222** (wejście w życie po 3 miesiącach od ogłoszenia, tj. 10.11.2024 r.).
- Kodeks postępowania cywilnego – t.j. **Dz. U. z 2026 r. poz. 468** (art. 505¹ – instrukcje).

## Rozgałęzienie reżimu (`regimeOf`)

| `service_type` | Status klienta | Reżim w piśmie |
|---|---|---|
| `work` + `work_status=finished` | dowolny | umowa o dzieło: art. 638 § 1 k.c. → rękojmia odpowiednio (art. 556¹, 560, 561, 561³, 566, 568) + art. 471 |
| `work` + `in_progress` | dowolny | art. 636 § 1 k.c. (wezwanie do zmiany sposobu wykonania) |
| `service`, `course` | dowolny | art. 750, 355, 471, 363 § 1 k.c. |
| `digital` | konsument / JDG | u.p.k. rozdz. 5b: art. 43k, 43l, 43m, 43n, 43o ust. 6 (JDG: w zw. z art. 7aa ust. 1) |
| `digital` | przedsiębiorca | jak `service` (art. 750/471 k.c.); żądania mapowane: fix→redo, reduce→reduce, withdraw→refund |
| `telecom` | dowolny | PKE art. 378 ust. 1 pkt 3, ust. 4 pkt 7–8, ust. 5; art. 379, 383 (instrukcje) |

Odpowiedź na reklamację: konsument – art. 7a ust. 1–3 u.p.k.; JDG przy dziele – art. 561⁵ w zw. z art. 556⁴ i 638 § 1 k.c.; pozostali – prośba o odpowiedź w 14 dni bez skutku prawnego milczenia; telekomunikacja – 30 dni (PKE).

Dzieło będące rzeczą ruchomą (meble na wymiar itp.) – art. 43a ust. 1 u.p.k. wyłącza rękojmię k.c. dla konsumenta; w kwestionariuszu kierujemy do szablonu „Reklamacja towaru”.

## Przepisy cytowane

| Akt | Przepis | Do czego | Pewność |
|---|---|---|---|
| k.c. | art. 627 | definicja umowy o dzieło (poradnik, legalBasis) | wysoka |
| k.c. | art. 636 § 1 | prace w toku – wezwanie, odstąpienie, wykonanie zastępcze (pismo) | wysoka |
| k.c. | art. 638 § 1 | odpowiednie stosowanie rękojmi do wad dzieła (pismo) | wysoka |
| k.c. | art. 556¹ § 1 pkt 1 | definicja wady (pismo) | wysoka |
| k.c. | art. 560 § 1, 3, 4 | obniżenie / odstąpienie; wada istotna (pismo) | wysoka |
| k.c. | art. 561 § 1–2, art. 561³ | usunięcie wady / wymiana (ponowne wykonanie); koszty (pismo) | wysoka; „ponowne wykonanie dzieła” jako odpowiednik „wymiany” – patrz pytania |
| k.c. | art. 561⁵, art. 556⁴ | 14 dni, milczenie = uznanie – JDG (pismo) | wysoka co do treści |
| k.c. | art. 566 § 1 | odszkodowanie przy odstąpieniu (pismo) | wysoka |
| k.c. | art. 568 § 1 | 2 lata od wydania (pismo, deadline) | wysoka |
| k.c. | art. 750, 355 § 1–2, 471, 363 § 1 | usługi – należyta staranność, odszkodowanie, wybór sposobu naprawienia szkody (pismo) | wysoka |
| u.p.k. | art. 7a ust. 1–3 | 14 dni, milczenie = uznanie, trwały nośnik (pismo) | wysoka |
| u.p.k. | art. 7aa ust. 1 | JDG – rozdz. 5b (pismo – digital) | wysoka |
| u.p.k. | art. 43a ust. 1 | dzieło będące towarem → rozdz. 5a (komentarz, help) | wysoka |
| u.p.k. | art. 43h–43i | zakres rozdz. 5b; wyłączenie usług telekomunikacyjnych (art. 43i pkt 1) | wysoka |
| u.p.k. | art. 43k ust. 1, 43l ust. 1 i 3 | zgodność z umową; odpowiedzialność 2 lata / w okresie dostarczania ciągłego | wysoka |
| u.p.k. | art. 43m ust. 1 i 4 | doprowadzenie do zgodności, koszty | wysoka |
| u.p.k. | art. 43n ust. 1 pkt 2 i 4, ust. 3 | obniżenie / odstąpienie, domniemanie istotności | wysoka |
| u.p.k. | art. 43o ust. 6 | zwrot ceny w 14 dni | wysoka |
| PKE | art. 378 ust. 1 pkt 3, ust. 2, ust. 3, ust. 4, ust. 5 | reklamacja: podstawa, 12 mies., formy, treść, 30 dni + milczenie = uznanie | wysoka (tekst ustawy pierwotnej) |
| PKE | art. 379, 383 | droga sądowa po reklamacji; ADR przed Prezesem UKE (instrukcje) | wysoka |

## Założenia

1. Fryzjer/kosmetyka zakwalifikowane domyślnie jako „usługa” (art. 750 k.c.) – w poradniku wskazujemy, że gdy usługa ma konkretny, sprawdzalny rezultat, użytkownik może wybrać wariant dzieła.
2. Żądanie „zwrotu całej zapłaty” przy usłudze (`refund`) sformułowane jako naprawienie szkody w pieniądzu (art. 471, 363 § 1 k.c.), a nie odstąpienie.
3. W wariancie dzieła `withdraw` pismo stwierdza, że wada jest istotna i nie została usunięta niezwłocznie – to stanowisko użytkownika wybierającego tę opcję (help ostrzega o przesłance istotności).
4. W wariancie `digital` + `reduce/withdraw` pismo powołuje art. 43n ust. 1 pkt 2 i 4 jako przesłanki alternatywne.
5. Przy telekomunikacji brak rachunku → wniosek o zaliczenie na poczet przyszłych płatności (art. 378 ust. 4 pkt 8 PKE).

## [DO WERYFIKACJI] – pytania do prawnika

1. **„Ponowne wykonanie dzieła”** jako odpowiednik „wymiany rzeczy na wolną od wad” (art. 561 § 1 w zw. z art. 638 § 1 k.c.) – czy takie sformułowanie jest akceptowalne przy dziełach nieruchomych (remonty)?
2. **Art. 7a u.p.k. przy umowie o dzieło** – stosujemy go obok rękojmi k.c. dla konsumenta. Czy dodatkowo powoływać art. 561⁵ k.c. (konsument) – czy wystarczy art. 7a?
3. **Zwrot całego wynagrodzenia przy usłudze (art. 750)** – czy bezpieczniej formułować jako wypowiedzenie (art. 746 k.c.) + odszkodowanie? Obecnie: naprawienie szkody (art. 471, 363).
4. **PKE** – brak tekstu jednolitego; numeracja art. 378–383 wg Dz. U. z 2024 r. poz. 1221. Prosimy o potwierdzenie, że rozporządzenie wykonawcze z art. 378 ust. 7 nie zmienia treści wymaganej w reklamacji.
5. **Dzieło na zlecenie JDG** – art. 556⁴ k.c. obowiązuje od 1.01.2021 r.; nie rozróżniamy umów starszych.
