# Legal review – `odwolanie-od-decyzji-ubezpieczyciela`

Plik szablonu: `src/lib/templates/odwolanie-od-decyzji-ubezpieczyciela.ts`
Stan prawny sprawdzony na: 14.10.2026 r. Teksty jednolite pobrane z API Sejmu (ELI) i porównane artykuł po artykule.

Źródła weryfikacji:
- Ustawa z 5.08.2015 r. o rozpatrywaniu reklamacji przez podmioty rynku finansowego, o Rzeczniku Finansowym i o Funduszu Edukacji Finansowej (u.r.r.) – t.j. **Dz. U. z 2026 r. poz. 823** (stan na 10.06.2026 r., uwzględnia nowelizację Dz. U. z 2025 r. poz. 1545 obowiązującą od 13.02.2026 r. – nowe brzmienie art. 3 ust. 2 i art. 5).
- Ustawa z **22 maja 2003 r.** o ubezpieczeniach obowiązkowych, UFG i PBUK (u.u.o.) – t.j. **Dz. U. z 2026 r. poz. 783**. Uwaga: w zleceniu podano datę „11 września 2003 r.” – to błąd; prawidłowa data ustawy to 22 maja 2003 r. (11 września 2015 r. to data ustawy o działalności ubezpieczeniowej).
- Kodeks cywilny – t.j. **Dz. U. z 2026 r. poz. 795**.
- Ustawa z 11.09.2015 r. o działalności ubezpieczeniowej i reasekuracyjnej (u.d.u.r.) – t.j. **Dz. U. z 2025 r. poz. 1526**.
- Uchwały SN: III CZP 32/03 (13.06.2003), III CZP 5/11 (7 sędziów, 17.11.2011), III CZP 80/11 (7 sędziów, 12.04.2012) – treść tez sprawdzona w bazie SAOS (saos.org.pl, API). Strona sn.pl blokowała pobieranie (403).

## Rozgałęzienia

| Pole | Warianty | Skutek w piśmie |
|---|---|---|
| `insurance_type` | `oc` / `ac` / `property` / `life` | OC: art. 822 § 1 i 4 k.c., art. 19 ust. 1, art. 36 ust. 1, art. 14 u.u.o., art. 361 § 2, 363 k.c. + uchwała SN zależna od `vehicle_issue`. AC/mienie: art. 805 § 1 i 2 pkt 1, art. 385 § 2, art. 817 k.c. (+ akapit o potrąceniach przy AC). Życie/NNW: art. 805 § 2 pkt 2, art. 385 § 2, art. 817 k.c. (+ art. 6, 385¹ przy wyłączeniu odpowiedzialności). |
| `decision_type` | `refusal` / `underpaid` | Odmowa: żądanie zmiany decyzji i wypłaty kwoty żądanej. Zaniżenie: dopłata = `claimed_amount − granted_amount` (gdy dodatnia), inaczej „dopłata do kwoty”. |
| `vehicle_issue` (OC/AC) | `repair_costs` / `total_loss` / `rental` / `other` | OC: III CZP 32/03 + III CZP 80/11 (koszty naprawy, nowe części) / akapit o szkodzie całkowitej (bez orzeczenia) / III CZP 5/11 (najem pojazdu zastępczego). |
| `life_issue` | `percent` / `exclusion` / `other` | `percent`: dodatkowy wniosek o ponowne ustalenie uszczerbku; `exclusion`: akapit o ciężarze dowodu (art. 6 k.c.) i art. 385 § 2, 385¹ § 1 k.c. |
| `request_files` | checkbox | Wniosek o udostępnienie akt szkody – art. 29 ust. 6 i 7 u.d.u.r. |

Każdy wariant zawiera akapit o reklamacji: art. 2 pkt 2, art. 6, 7, 8 u.r.r.

## Przepisy cytowane w piśmie i w treściach

| Akt | Przepis | Do czego użyty | Pewność |
|---|---|---|---|
| u.r.r. | art. 2 pkt 1 lit. a–b, pkt 2 | odwołanie od decyzji = reklamacja klienta (osoby fizycznej, także poszkodowanego z OC) | wysoka (tekst zweryfikowany) |
| u.r.r. | art. 3 ust. 2 | formy złożenia reklamacji (papier, elektronicznie, e-Doręczenia, ustnie) – instrukcje, FAQ | wysoka (brzmienie od 13.02.2026 r.) |
| u.r.r. | art. 6, 7, 8 | 30 dni, max 60 dni, milczenie = rozpatrzenie zgodnie z wolą klienta (pismo, terminy) | wysoka |
| u.r.r. | art. 17 ust. 1 pkt 1, art. 36, 37, 38 | wniosek o interwencję RF (bez opłaty), postępowanie polubowne – opłata 50 zł, obowiązkowy udział podmiotu | wysoka |
| u.u.o. | art. 14 ust. 1–3 | 30 dni / 90 dni, bezsporna część, obowiązek uzasadnienia odmowy (pismo – OC) | wysoka |
| u.u.o. | art. 19 ust. 1 | bezpośrednie roszczenie wobec ubezpieczyciela OC (pismo) | wysoka |
| u.u.o. | art. 36 ust. 1 | odszkodowanie w granicach odpowiedzialności cywilnej sprawcy (pismo) | wysoka |
| u.u.o. | art. 34a ust. 1 | właściwość sądu przy OC komunikacyjnym (instrukcje „afterSending”, poradnik) | wysoka |
| u.d.u.r. | art. 29 ust. 6 i 7 | udostępnienie akt szkody, także elektronicznie (pismo – opcja, poradnik) | wysoka |
| k.c. | art. 361 § 2, art. 363 § 1 i 2 | zasada pełnego odszkodowania (pismo – OC) | wysoka |
| k.c. | art. 805 § 1, § 2 pkt 1 i 2 | świadczenie ubezpieczyciela (pismo – AC, mienie, życie) | wysoka |
| k.c. | art. 817 § 1 i 2 | 30 dni na świadczenie, 14 dni od wyjaśnienia, bezsporna część (pismo – AC, mienie, życie) | wysoka |
| k.c. | art. 819 § 1, 3, 4 | przedawnienie 3 lata / jak dla deliktu przy OC / przerwanie przez zgłoszenie (legalBasis, termin, FAQ) | wysoka |
| k.c. | art. 442¹ § 1 | przedawnienie roszczeń deliktowych (opis terminu) | wysoka |
| k.c. | art. 822 § 1 i 4 | ubezpieczenie OC, roszczenie bezpośrednie (pismo – OC) | wysoka |
| k.c. | art. 385 § 2, art. 385¹ § 1, art. 6 | wykładnia wzorca na korzyść konsumenta, klauzule abuzywne, ciężar dowodu (pismo – AC/mienie/życie) | wysoka |
| SN | III CZP 32/03 | koszty naprawy według cen na lokalnym rynku | wysoka (teza z SAOS) |
| SN | III CZP 80/11 | koszty **nowych** części; obniżenie tylko gdy ubezpieczyciel wykaże wzrost wartości pojazdu | wysoka (teza z SAOS). Uwaga: teza mówi o „nowych częściach”, nie o „oryginalnych” – w piśmie użyto sformułowania zgodnego z tezą. |
| SN | III CZP 5/11 | najem pojazdu zastępczego dla pojazdu niesłużącego działalności gospodarczej | wysoka (teza z SAOS) |

## Założenia

1. Szablon zakłada, że nadawcą jest osoba fizyczna (wymóg definicji „klienta” z art. 2 pkt 1 u.r.r.). Przedsiębiorcy (np. spółka z AC floty) nie korzystają z art. 8 u.r.r.
2. Kwota dopłaty liczona wyłącznie jako różnica `claimed_amount − granted_amount`; gdy różnica ≤ 0 (błąd użytkownika), pismo żąda „dopłaty do łącznej kwoty”.
3. Termin przedawnienia w kalkulatorze: 3 lata od daty zdarzenia – świadomie ostrożny (najwcześniejszy możliwy koniec). Opis wyjaśnia art. 819 § 3 i 4 oraz art. 442¹ k.c.
4. Akapit o szkodzie całkowitej (OC) oraz o potrąceniach przy AC nie powołuje orzecznictwa – to argumentacja wynikająca z art. 361 § 2 i 363 k.c. oraz z umowy.
5. Zdanie „Wyłączenia odpowiedzialności, jako wyjątki od ochrony ubezpieczeniowej, nie mogą być wykładane rozszerzająco” jest tezą doktrynalno-orzeczniczą, bez sygnatury.

## [DO WERYFIKACJI] – pytania do prawnika

1. **Art. 8 u.r.r. a decyzja likwidacyjna** – czy fikcja „rozpatrzenia zgodnie z wolą klienta” przy odwołaniu od decyzji (a nie pierwszym zgłoszeniu roszczenia) jest bezsporna w praktyce RF i sądów? Pismo powołuje ją wprost.
2. **Amortyzacja przy OC** – sformułowanie „Zastosowanie w kalkulacji zamienników, stawek … niższych od rynkowych lub potrąceń amortyzacyjnych bez wykazania wzrostu wartości pojazdu prowadzi do odszkodowania niepełnego” – czy akceptowalne jako uogólnienie uchwał III CZP 32/03 i III CZP 80/11 (szczególnie co do zamienników)? Ewentualnie dodać nowsze orzecznictwo (np. dot. rabatów warsztatowych) – nie weryfikowaliśmy go.
3. **Szkoda całkowita** – czy dodać orzecznictwo SN o metodzie różnicowej i o obowiązku ubezpieczyciela wykazania realnej możliwości sprzedaży pozostałości?
4. **Najem pojazdu zastępczego przy AC** – szablon nie dodaje argumentu prawnego (zależy od OWU / assistance). Czy to wystarczające?
5. **Właściwość sądu i postępowanie uproszczone** – w instrukcjach wspominamy próg 20 000 zł (art. 505¹ § 1 k.p.c. – zweryfikowany w t.j. Dz. U. z 2026 r. poz. 468) i art. 34a u.u.o. – do potwierdzenia, że informacja jest dostatecznie precyzyjna dla laika.
6. **Życie/NNW – procent uszczerbku** – czy wniosek o „skierowanie na badanie przez innego lekarza orzecznika lub komisję lekarską” jest zgodny z typowymi OWU (niektóre przewidują tryb odwoławczy)? Ewentualnie dodać odesłanie do trybu odwoławczego z art. 10 pkt 1 u.r.r.
