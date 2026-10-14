# Legal review – `wypowiedzenie-umowy-o-prace`

Plik szablonu: `src/lib/templates/wypowiedzenie-umowy-o-prace.ts` (eksport `wypowiedzenieUmowyOPrace`).
Stan prawny sprawdzony na: 14.10.2026 r. – teksty pobrane z API Sejmu (ELI) i porównane artykuł po artykule.

Źródła (Dz. U. – rok/poz.):
- Kodeks pracy – t.j. **Dz. U. z 2026 r. poz. 1245** (obwieszczenie z 1.09.2026 r., stan prawny na 27.08.2026 r.).
- Zmiana KP z 19.06.2026 r. – **Dz. U. z 2026 r. poz. 1046** (wchodzi w życie 5.11.2026 r.; dotyczy równego traktowania i mobbingu – art. 18³ᵃ–18³ᵍ, 94 pkt 2b–2c, 94³; nie zmienia przepisów o rozwiązywaniu umów).
- Zmiana KP z 26.09.2025 r. (wliczanie okresów do stażu) – **Dz. U. z 2025 r. poz. 1423** (art. 302¹; przepisy przejściowe art. 5–9).
- Ustawa o dniach wolnych od pracy – t.j. **Dz. U. z 2025 r. poz. 296** (Wigilia dniem wolnym – lit. ka).
- Ustawa o rynku pracy i służbach zatrudnienia – **Dz. U. z 2025 r. poz. 620** (art. 219–220 – FAQ o zasiłku).
- Ustawa o kosztach sądowych w sprawach cywilnych – t.j. **Dz. U. z 2025 r. poz. 1228** (art. 35, art. 96 ust. 1 pkt 4 – instrukcje).

## Warianty (`mode`)

| Wartość | Pismo | Podstawa |
|---|---|---|
| `notice` | wypowiedzenie przez pracownika | art. 30 § 1 pkt 2, art. 32, art. 34 / art. 36 § 1, art. 30 § 2¹ |
| `notice_shorten` | wypowiedzenie + propozycja wcześniejszego terminu | j.w. + art. 36 § 6 |
| `agreement` | wniosek o rozwiązanie za porozumieniem stron | art. 30 § 1 pkt 1 |
| `employer_fault` | rozwiązanie bez wypowiedzenia z winy pracodawcy | art. 55 § 1¹, § 2, § 3; art. 52 § 2 (odpowiednio) |

## Przepisy cytowane w piśmie i w treściach

| Akt | Przepis | Do czego użyty | Pewność |
|---|---|---|---|
| KP | art. 25 § 2, 2²–2³ | długość okresu próbnego (opcje `trial_length`) | wysoka |
| KP | art. 30 § 1 pkt 1–4 | tryby rozwiązania umowy (pismo, poradnik) | wysoka |
| KP | art. 30 § 2 | umowa na okres próbny rozwiązuje się z upływem okresu próbnego (pismo – wariant trial) | wysoka |
| KP | art. 30 § 2¹ | tydzień → sobota, miesiąc → ostatni dzień miesiąca (pismo, algorytm `noticeEnd`) | wysoka |
| KP | art. 30 § 3 | forma pisemna (poradnik, FAQ) | wysoka |
| KP | art. 32 § 1–2 | wypowiedzenie, rozwiązanie z upływem okresu (pismo) | wysoka |
| KP | art. 34 pkt 1–3 | 3 dni robocze / 1 tydzień / 2 tygodnie (pismo) | wysoka |
| KP | art. 36 § 1 pkt 1–3, § 1¹, § 5 | 2 tyg. / 1 mies. / 3 mies.; wliczanie zatrudnienia u poprzednika; odpowiedzialność materialna (pismo, poradnik) | wysoka |
| KP | art. 36 § 6 | wcześniejszy termin za porozumieniem – nie zmienia trybu (pismo – notice_shorten) | wysoka |
| KP | art. 36² | zwolnienie z obowiązku świadczenia pracy – decyzja pracodawcy (pismo – prośba) | wysoka |
| KP | art. 30 § 1 pkt 4 | umowa terminowa kończy się z upływem czasu (pismo – gdy koniec umowy przed końcem wypowiedzenia) | wysoka |
| KP | art. 55 § 1¹ | ciężkie naruszenie podstawowych obowiązków; odszkodowanie (umowa terminowa – do końca umowy, max okres wypowiedzenia) | wysoka |
| KP | art. 55 § 2 | forma pisemna z podaniem przyczyny; odpowiednio art. 52 § 2 (1 miesiąc) | wysoka |
| KP | art. 55 § 3 | skutki jak rozwiązanie przez pracodawcę za wypowiedzeniem | wysoka |
| KP | art. 11¹, art. 94 pkt 4 i 5, art. 94³ § 1, art. 85 § 1–2, art. 207 § 1 | kwalifikacja naruszeń (`fault_category`) | wysoka (art. 94³ § 1 ma nowe brzmienie od 5.11.2026 – numer jednostki bez zmian) |
| KP | art. 97 § 1, § 1³, § 2, § 2¹ | świadectwo pracy w dniu ustania stosunku pracy; sprostowanie 14 dni | wysoka |
| KP | art. 167¹ | urlop w okresie wypowiedzenia | wysoka |
| KP | art. 171 § 1, § 4–5 | ekwiwalent; termin wypłaty (§ 4–5 dodane od 27.01.2026 r., Dz. U. z 2026 r. poz. 25) | wysoka |
| KP | art. 302¹ § 8 | wliczanie okresów zlecenia/B2B na rzecz tego pracodawcy (help, poradnik) | wysoka co do treści; przepisy przejściowe – patrz pytania |
| u. o rynku pracy | art. 219 ust. 1 pkt 1, art. 220 ust. 1 pkt 5 i ust. 2 pkt 3 | zasiłek po wypowiedzeniu / porozumieniu (FAQ) | wysoka co do treści |
| u. o kosztach sądowych | art. 96 ust. 1 pkt 4, art. 35 ust. 1 | pracownik zwolniony z kosztów (instrukcje) | wysoka |

## Algorytm okresu wypowiedzenia (render)

1. Okres próbny: `trial_length` → 3 dni robocze / 1 tydzień / 2 tygodnie.
2. Pozostałe umowy: staż = pełne miesiące od `employment_start` do `submit_date`; < 6 mies. → 2 tyg.; ≥ 6 mies. → 1 mies.; ≥ 36 mies. → 3 mies.
3. Jeżeli próg (6 mies. / 3 lata) zostanie osiągnięty w trakcie biegu wypowiedzenia – stosujemy dłuższy okres (pętla w `computeNotice`).
4. Koniec: tygodnie – od niedzieli następującej po doręczeniu, n pełnych tygodni do soboty; miesiące – ostatni dzień miesiąca n-tego po miesiącu doręczenia; dni robocze – pn–pt z pominięciem dni ustawowo wolnych (Wielkanoc liczona algorytmicznie, Wigilia od 2025 r.).
5. Umowa na czas określony kończąca się wcześniej – pismo informuje o rozwiązaniu z upływem czasu (art. 30 § 1 pkt 4).
6. W piśmie zawsze klauzula bezpieczeństwa: „gdyby z przepisów lub umowy wynikał inny okres – z upływem okresu właściwego”.

## Założenia

1. Dzień doręczenia = `submit_date` (deklaracja użytkownika); w treści pisma sformułowane warunkowo („Przy doręczeniu … w dniu …”).
2. Dni robocze przy okresie 3 dni = dni od poniedziałku do piątku niebędące dniami ustawowo wolnymi (pracodawca może mieć inny rozkład czasu pracy).
3. Deadline „Orientacyjny koniec okresu wypowiedzenia” to stałe +1 miesiąc (silnik terminów nie zna zasady końca miesiąca) – opisany jako orientacyjny; dokładna data jest w piśmie.
4. Prośba o zwolnienie z obowiązku świadczenia pracy (art. 36²) sformułowana jako prośba – to uprawnienie pracodawcy.
5. Zdanie o złożeniu oświadczenia z art. 55 § 1¹ „przed upływem 1 miesiąca” dodajemy tylko, gdy `submit_date` ≤ `fault_last_date` + 1 miesiąc.

## [DO WERYFIKACJI] – pytania do prawnika

1. **Wydłużenie okresu wypowiedzenia w trakcie jego biegu** – przyjęliśmy (za poglądem spotykanym w praktyce kadrowej i komentarzach – nie weryfikowaliśmy orzecznictwa), że jeżeli pracownik osiągnie 6 miesięcy / 3 lata stażu w okresie wypowiedzenia, stosuje się dłuższy okres. Prosimy o potwierdzenie lub wskazanie, czy bezpieczniej liczyć staż wyłącznie na dzień doręczenia.
2. **Art. 302¹ § 8 k.p. – przepisy przejściowe** (art. 5–9 ustawy z 26.09.2025 r.): udokumentowanie w 24 miesiące, stosowanie u pracodawców prywatnych od 1.05.2026 r., art. 8 – okresów nie wlicza się do wypowiedzeń trwających w dniu wejścia w życie. Generator nie rozróżnia tych sytuacji – w help odsyłamy do zaświadczenia ZUS. Czy to wystarczy?
3. **Art. 55 § 1¹ przy umowie na okres próbny** – przyjęliśmy odszkodowanie za okres wypowiedzenia z art. 34 (zdanie 1). Czy dla umowy próbnej nie należy stosować zdania 2 (umowa terminowa – „do czasu, do którego umowa miała trwać”)?
4. **Termin 1 miesiąca przy naruszeniach ciągłych** – w poradniku piszemy, że „zwykle liczy się od ostatniego zdarzenia”. Prosimy o potwierdzenie sformułowania.
5. **Sprzeczność próbnego okresu i okresu wypowiedzenia** – pismo nie zna daty końca okresu próbnego; zamieszczamy ogólne zdanie z art. 30 § 2. Czy dodać pytanie o datę końca okresu próbnego?
6. **FAQ o zasiłku** – sformułowania z art. 219–220 ustawy o rynku pracy (Dz. U. z 2025 r. poz. 620) – do potwierdzenia, czy nie było późniejszych zmian.
