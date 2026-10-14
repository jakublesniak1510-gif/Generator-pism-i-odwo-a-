# Legal review – `odwolanie-oplata-jazda-bez-biletu`

Plik szablonu: `src/lib/templates/odwolanie-oplata-jazda-bez-biletu.ts`
Stan prawny sprawdzony na: 14.10.2026 r.

- Prawo przewozowe (p.p.) – t.j. Dz. U. z 2024 r. poz. 1262; późniejsza zmiana (ustawa z 11.06.2026 r. o związku metropolitalnym w województwie pomorskim, Dz. U. z 2026 r. poz. 912, art. 64) dotyczy art. 15, 16 i 34a ust. 2 – nie zmienia art. 33a, 75, 77.
- Rozporządzenie Ministra Transportu i Budownictwa z 24.02.2006 r. w sprawie ustalania stanu przesyłek oraz postępowania reklamacyjnego (Dz. U. Nr 38, poz. 266) zmienione rozporządzeniem z 13.12.2017 r. (Dz. U. poz. 2406, w życie 23.03.2018 r.) – tekst pierwotny i zmiana przeczytane w całości.

## Przepisy cytowane

| Akt | Przepis | Do czego użyty | Pewność |
|---|---|---|---|
| p.p. | art. 33a ust. 1–2 | identyfikator kontrolera i jego elementy – pismo (argument `controller_no_id`), poradnik | wysoka |
| p.p. | art. 33a ust. 3 | opłata dodatkowa / wezwanie przy braku dokumentu przewozu – pismo (`app_or_machine`), poradnik | wysoka |
| p.p. | art. 33a ust. 4 zd. 2 | umorzenie przy udokumentowaniu ulgi w 7 dni od dnia przewozu, za opłatą manipulacyjną – pismo (`discount`) | wysoka |
| p.p. | art. 33a ust. 5 w zw. z ust. 4 zd. 2 | to samo dla ważnego dokumentu przewozu, którego nie miano przy sobie – pismo (`valid_ticket`) | wysoka (numeracja zweryfikowana: ust. 4 – ulga, ust. 5 – bilet) |
| p.p. | art. 33a ust. 6 | obniżona opłata dodatkowa przy szybkiej zapłacie (regulamin/taryfa) – poradnik, wniosek o raty | wysoka |
| p.p. | art. 33a ust. 7 | uprawnienia kontrolera (dokument tożsamości, ujęcie) – poradnik | wysoka |
| p.p. | art. 34a | sposób ustalania wysokości opłat dodatkowych (rozporządzenie / rada gminy, powiatu, sejmik; od 2026 r. także związek metropolitalny) – poradnik | wysoka |
| p.p. | art. 75 ust. 1–2 | droga sądowa po bezskutecznym wezwaniu – legalBasis | wysoka |
| p.p. | art. 77 ust. 1, 3 pkt 4, ust. 4 | przedawnienie 1 rok, początek biegu, zawieszenie na czas reklamacji – poradnik, FAQ | wysoka co do treści; **[DO WERYFIKACJI]** stosowanie do roszczeń przewoźnika o opłatę dodatkową i ustalenie początku biegu |
| rozporządzenie z 24.02.2006 r. | § 5 ust. 1 (po zm. 2017) | formy reklamacji: pisemna, ustna do protokołu, dokumentowa, elektroniczna – instrukcje, poradnik | wysoka |
| rozporządzenie | § 6 ust. 1 (po zm. 2017) | odpowiedź w 30 dni od wpływu reklamacji – pismo | wysoka |
| rozporządzenie | § 7 ust. 2 (pkt 1, 2, 8 zm. 2017) | wymagane elementy wezwania, w tym pkt 9 – dokument tożsamości podróżnego – pismo (`notice_errors`, `not_me`) | wysoka |
| rozporządzenie | § 9 ust. 1 (po zm. 2017) | reklamacja wezwania w 3 miesiące od otrzymania – deadline, poradnik | wysoka |
| rozporządzenie | § 10 | brak odpowiedzi w terminie = uwzględnienie reklamacji – pismo | wysoka (przepis niezmieniony w 2017 r.) |
| rozporządzenie | § 11 | odwołanie od nieuwzględnionej reklamacji; przewoźnik może zmienić rozstrzygnięcie w 14 dni – poradnik, instrukcje | wysoka |

## Założenia

1. Termin 7 dni liczony jest od dnia przewozu (= data kontroli z pytania `control_date`). Zdanie „Niniejszą reklamację wraz z kopią dokumentu składam przed upływem tego terminu” jest dodawane tylko wtedy, gdy data pisma mieści się w 7 dniach.
2. Termin reklamacji (3 miesiące) liczony jest w kalkulatorze od daty kontroli – to bezpieczne przybliżenie (wezwanie wręczane na miejscu). Opis reguły wyjaśnia, że przy wezwaniu doręczanym pocztą termin liczy się od doręczenia.
3. Opcja „tylko raty” generuje wniosek, a nie reklamację – bez powoływania § 6 i § 10 rozporządzenia.
4. Argument `app_or_machine` jest sformułowany ostrożnie („ewentualne opóźnienie aktywacji lub brak możliwości skasowania”) – regulaminy przewoźników zwykle wymagają zakupu/aktywacji biletu przed lub niezwłocznie po wejściu do pojazdu.
5. Art. 7a u.p.k. (14 dni) nie jest stosowany – przepis zastrzega „jeżeli przepisy odrębne nie stanowią inaczej”, a rozporządzenie przewiduje 30 dni.

## [DO WERYFIKACJI] – pytania do prawnika

1. **Kolej i autobusy dalekobieżne** – § 1 ust. 2 rozporządzenia (dodany w 2017 r.) wyłącza jego stosowanie do skarg z art. 27 rozporządzenia (WE) nr 1371/2007 (zastąpionego od 7.06.2023 r. rozporządzeniem (UE) 2021/782) i art. 26–27 rozporządzenia (UE) nr 181/2011. Czy reklamacja wezwania do zapłaty opłaty dodatkowej (np. PKP Intercity) jest „skargą” w rozumieniu tych rozporządzeń? Jeżeli tak – dla kolei termin odpowiedzi może wynosić 1 miesiąc (z możliwością przedłużenia do 3) i nie obowiązuje § 10 (milczenie = uwzględnienie).
2. **Art. 33a ust. 5 a bilety na okaziciela** – ustawa mówi o „ważnym dokumencie przewozu”; regulaminy przewoźników ograniczają umorzenie do biletów imiennych. Czy treść poradnika („w praktyce regulaminy ograniczają…”) jest właściwa?
3. **Przedawnienie (art. 77)** – czy roszczenie o opłatę dodatkową przedawnia się z upływem roku i od kiedy biegnie (termin zapłaty z wezwania vs dzień przewozu)?
4. **Nazwa organu ADR** – „Rzecznik Praw Pasażerów Kolei przy Prezesie UTK” – do potwierdzenia aktualnej nazwy i właściwości.
5. **Wezwanie bez danych dokumentu tożsamości** – czy brak danych z § 7 ust. 2 pkt 9 skutkuje bezskutecznością wezwania, czy tylko utrudnia dowód (pismo formułuje zarzut ostrożnie: „uniemożliwiają uznanie roszczenia za wykazane”)?
