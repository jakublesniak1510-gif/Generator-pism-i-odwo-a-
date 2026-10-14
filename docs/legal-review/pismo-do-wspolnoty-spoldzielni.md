# Przegląd prawny – `pismo-do-wspolnoty-spoldzielni`

Plik szablonu: `src/lib/templates/pismo-do-wspolnoty-spoldzielni.ts` (eksport `pismoDoWspolnoty`).
Warianty: podmiot (`entity_type`: `community` / `cooperative`) × rodzaj pisma (`letter_kind`: `documents` / `defect` / `settlement`) × tytuł do lokalu (`legal_title`: `owner` / `coop_ownership` / `coop_tenant` / `tenant`).

## Cytowane przepisy

| Akt | Artykuł | Do czego użyty | Pewność |
|---|---|---|---|
| Ustawa z 24.06.1994 r. o własności lokali (Dz.U. 1994 nr 85 poz. 388) | art. 27 | `documents`, `settlement` (wspólnota) – prawo i obowiązek współdziałania w zarządzie | wysoka |
| u.w.l. | art. 29 ust. 3 | kontrola działalności zarządu → prawo wglądu w dokumenty | wysoka co do przepisu; zakres „prawa wglądu” wynika z wykładni/orzecznictwa [DO WERYFIKACJI – czy dodać orzeczenie] |
| u.w.l. | art. 12 ust. 2 | `settlement` (wspólnota) – ponoszenie wydatków na nieruchomość wspólną wg udziałów | wysoka |
| u.w.l. | art. 14 pkt 1 | `defect` (wspólnota) – remonty i bieżąca konserwacja jako koszty zarządu | wysoka |
| u.w.l. | art. 21 ust. 1 | `defect` – zarząd kieruje sprawami wspólnoty | wysoka |
| u.w.l. | art. 22 (w piśmie bez numeru ustępu) | `defect` – czynności zwykłego zarządu podejmowane samodzielnie przez zarząd | wysoka co do treści; numer ust. 1 [DO WERYFIKACJI] |
| u.w.l. | art. 25 ust. 1 i 1a | poradnik – 6 tygodni na zaskarżenie uchwały | wysoka |
| Ustawa z 15.12.2000 r. o spółdzielniach mieszkaniowych (Dz.U. 2001 nr 4 poz. 27) | art. 8¹ ust. 1 | `documents`, `settlement` (spółdzielnia) – prawo do odpisów/kopii statutu, uchwał, protokołów, sprawozdań, faktur, umów | wysoka |
| u.s.m. | art. 8¹ (ustęp o kosztach kopii) | poradnik/FAQ – opłata za kopie poza statutem i regulaminami | [DO WERYFIKACJI] – numer ustępu |
| u.s.m. | art. 4 (ogólnie) | `defect`, `settlement` (spółdzielnia) – ponoszenie kosztów eksploatacji, utrzymania i mediów | wysoka |
| u.s.m. | art. 4 ust. 7 (w piśmie BEZ numeru) | `settlement` – „zmiana wysokości opłat wymaga uzasadnienia na piśmie” | [DO WERYFIKACJI] – numer ustępu (w zleceniu wskazano art. 4 ust. 6⁴) |
| u.s.m. | art. 4 ust. 1¹ | wskazany w zleceniu przy usterkach – NIE użyty w piśmie | [DO WERYFIKACJI] |
| Ustawa z 16.09.1982 r. – Prawo spółdzielcze | art. 18 § 2 pkt 3 (w piśmie BEZ numeru – ogólne odesłanie) | `documents` (spółdzielnia) – uprawnienia członka do dokumentów | [DO WERYFIKACJI] – numer punktu |
| Ustawa z 7.07.1994 r. – Prawo budowlane (Dz.U. 1994 nr 89 poz. 414) | art. 61 pkt 1 w zw. z art. 5 ust. 2 | `defect` – obowiązek utrzymania obiektu w należytym stanie technicznym i estetycznym | wysoka |

## Założenia
- Najemca: brak ustawowego prawa kontroli zarządu wspólnoty → przy `documents` tytuł „PROŚBA O UDOSTĘPNIENIE DOKUMENTÓW”, brak sekcji „Podstawa prawna”, prośba ograniczona do opłat dotyczących lokalu. Przy `defect` i `settlement` najemca otrzymuje to samo pismo co właściciel.
- `owner` w spółdzielni (odrębna własność) – przepis art. 8¹ dotyczy członków; zakładamy, że właściciel jest członkiem lub korzysta z analogicznych uprawnień [DO WERYFIKACJI – status członkostwa po nowelizacji z 2017 r.].
- Termin odpowiedzi wyznacza użytkownik (7/14/30 dni) – przepisy go nie określają.
- Deadline `settlement_complaint` (14 dni od doręczenia rozliczenia) ma charakter orientacyjny – terminy wynikają z regulaminów rozliczeń, nie z ustawy.
- „Mała wspólnota” (w której stosuje się przepisy KC o współwłasności) – nie obsługujemy osobno [DO WERYFIKACJI – próg liczby lokali po nowelizacji z 2015/2016 r.].
- **Filtr AI:** `src/lib/ai/guard.ts` odrzuca tekst AI zawierający „uchwał”. Dlatego lista dokumentów (`documents_list`) nie trafia do promptu AI i jest wstawiana deterministycznie, a `ai.context` zabrania modelowi używania tego słowa. Uwaga dla backendu: w tym szablonie guard będzie częściej odrzucał wersję AI (fallback do wersji deterministycznej jest poprawny).

## Pytania do prawnika
1. Czy powołanie art. 29 ust. 3 u.w.l. jako podstawy prawa wglądu w dokumenty jest wystarczające, czy dodać orzeczenie (np. SN/SA) potwierdzające to prawo?
2. Numer ustępu art. 4 u.s.m. dot. obowiązku pisemnego uzasadnienia zmiany opłat (ust. 7?) oraz art. 4 ust. 6⁴ i ust. 1¹ wskazane w zleceniu – czy i gdzie je wprowadzić?
3. Art. 18 § 2 pkt 3 Prawa spółdzielczego – potwierdzenie numeru i treści po zmianach.
4. Czy w wariancie spółdzielni dla `owner` (odrębna własność, ewentualnie bez członkostwa) potrzebne jest inne sformułowanie podstawy (np. art. 27 u.s.m.)?
5. Czy „zastrzegam sobie prawo zawiadomienia powiatowego inspektora nadzoru budowlanego” jest właściwym i dostatecznie neutralnym sformułowaniem?
