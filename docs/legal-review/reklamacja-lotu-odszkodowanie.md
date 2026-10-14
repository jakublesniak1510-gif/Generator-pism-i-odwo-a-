# Przegląd prawny – `reklamacja-lotu-odszkodowanie`

Plik szablonu: `src/lib/templates/reklamacja-lotu-odszkodowanie.ts` (eksport `reklamacjaLotu`).
Warianty (`incident_type`): `delay` (opóźnienie przylotu ≥ 3 h), `cancellation` (odwołanie; podwariant `cancellation_notice`: lt7 / 7to14 / gt14), `denied` (odmowa przyjęcia na pokład).
Kwota odszkodowania = stawka z art. 7 ust. 1 (250/400/600 EUR wg `distance`) × `passengers_count`.

## Cytowane przepisy i orzeczenia

| Akt / orzeczenie | Artykuł / sygnatura | Do czego użyty | Pewność |
|---|---|---|---|
| Rozporządzenie (WE) nr 261/2004 z 11.02.2004 r. | art. 4 ust. 3 | `denied` – odszkodowanie i pomoc przy odmowie przyjęcia na pokład wbrew woli | wysoka |
| Rozporządzenie 261/2004 | art. 5 ust. 1 (lit. c) | `cancellation` – prawo do pomocy (art. 8, 9) i odszkodowania, wyjątki 14 / 7–14 / < 7 dni | wysoka |
| Rozporządzenie 261/2004 | art. 5 ust. 3 | `delay`, `cancellation` – nadzwyczajne okoliczności, ciężar dowodu na przewoźniku | wysoka |
| Rozporządzenie 261/2004 | art. 6 | `delay` – pomoc przy dużym opóźnieniu | wysoka |
| Rozporządzenie 261/2004 | art. 7 ust. 1 lit. a–c | kwoty 250/400/600 EUR, podział dystansów (w tym loty wewnątrzwspólnotowe > 1500 km = 400 EUR) | wysoka |
| Rozporządzenie 261/2004 | art. 7 ust. 2 | poradnik – obniżenie o 50 % przy zmianie planu podróży | wysoka |
| Rozporządzenie 261/2004 | art. 7 ust. 3 | zdanie „Nie wyrażam zgody na … voucher” (bony tylko za pisemną zgodą pasażera) | wysoka |
| Rozporządzenie 261/2004 | art. 7 ust. 4 | help pola `distance` – odległość po ortodromie | wysoka |
| Rozporządzenie 261/2004 | art. 8 | zwrot ceny biletu / zmiana planu podróży (cancellation, denied) | wysoka |
| Rozporządzenie 261/2004 | art. 9 | opieka (posiłki, hotel, transport) – akapit przy braku opieki / kosztach | wysoka |
| Rozporządzenie 261/2004 | art. 3 ust. 3 | FAQ/help – pasażerowie podróżujący bezpłatnie (niemowlęta) nie są objęci | wysoka |
| Rozporządzenie 261/2004 | art. 16 | instrukcje – krajowe organy wykonawcze (NEB) | wysoka |
| Wyrok TSUE C-402/07 i C-432/07 (Sturgeon), 19.11.2009 | – | `delay` – opóźnienie ≥ 3 h = odszkodowanie | wysoka |
| Wyrok TSUE C-581/10 i C-629/10 (Nelson i in.), 23.10.2012 | – | `delay` – potwierdzenie Sturgeon | wysoka |
| Wyrok TSUE C-549/07 (Wallentin-Hermann), 22.12.2008 | – | problemy techniczne ≠ nadzwyczajne okoliczności | wysoka |
| Wyrok TSUE C-452/13 (Germanwings), 4.09.2014 | – (tylko w help, bez sygnatury) | opóźnienie liczone do otwarcia drzwi samolotu | wysoka |
| Wyrok TSUE C-12/11 (McDonagh) | – (bez sygnatury w piśmie) | zwrot kosztów opieki, gdy przewoźnik jej nie zapewnił („niezbędne, odpowiednie i rozsądne”) | średnia [DO WERYFIKACJI] |
| Kodeks cywilny | art. 778 | termin 1 roku – deadline `limitation`, poradnik, FAQ | [DO WERYFIKACJI] |
| Uchwała SN III CZP 111/16 | – | przedawnienie roczne roszczeń z rozp. 261/2004 | [DO WERYFIKACJI] – skład, data (prawdopodobnie 17.03.2017 r., 7 sędziów), aktualność wobec późniejszego orzecznictwa TSUE |
| Rozporządzenie (WE) nr 861/2007 (europejskie postępowanie w sprawie drobnych roszczeń) | limit 5000 EUR | instrukcje, poradnik | wysoka |
| Prawo lotnicze – Rzecznik Praw Pasażerów Lotniczych przy Prezesie ULC | – | instrukcje, „Termin odpowiedzi” w piśmie | [DO WERYFIKACJI] – dokładna nazwa organu ADR i podstawa w Prawie lotniczym |

## Założenia
- Roszczenie kieruje się do przewoźnika obsługującego (operating carrier).
- `distance` wybiera użytkownik; nie liczymy odległości automatycznie.
- `delay_hours` ma walidację min. 3 – pismo nie powstanie dla opóźnienia < 3 h.
- `cancellation_notice = gt14` → pismo bez żądania odszkodowania (tytuł „REKLAMACJA”), tylko zwrot kosztów / ustosunkowanie się.
- `cancellation_notice = 7to14` → żądamy odszkodowania; ewentualny wyjątek (lot zastępczy w oknie godzinowym) musi wykazać przewoźnik.
- Kwota w EUR „lub równowartość w złotych” – zakładamy prawo pasażera do żądania wypłaty w walucie krajowej [DO WERYFIKACJI – wyrok TSUE C-356/19 Delfly].
- Termin 30 dni na odpowiedź – praktyczny, zbieżny z praktyką ULC (wniosek po 30 dniach od reklamacji lub po odmowie) [DO WERYFIKACJI].
- Wypłata na rachunek nadawcy także za współpasażerów – wymaga upoważnień (dodawane automatycznie do załączników).

## Pytania do prawnika
1. Czy uchwała SN III CZP 111/16 (roczne przedawnienie, art. 778 KC) jest nadal aktualna i czy bezpiecznie komunikować ją użytkownikom jako „ostrożny termin”?
2. Dokładna nazwa i właściwość organu: „Rzecznik Praw Pasażerów Lotniczych przy Prezesie ULC” – podstawa w Prawie lotniczym, warunki złożenia wniosku (30 dni?).
3. Czy można żądać wypłaty odszkodowania w PLN (C-356/19) i jak sformułować kurs przeliczenia?
4. Czy zdanie o zwrocie kosztów opieki (art. 9) warto uzupełnić o sygnaturę C-12/11 McDonagh?
5. Czy przy locie z przesiadką na jednej rezerwacji (C-11/11 Folkerts) dodać osobne sformułowanie w piśmie?
