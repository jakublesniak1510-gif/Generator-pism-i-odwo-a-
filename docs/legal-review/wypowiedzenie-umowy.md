# Przegląd prawny – `wypowiedzenie-umowy`

Plik szablonu: `src/lib/templates/wypowiedzenie-umowy.ts` (eksport `wypowiedzenieUmowy`).
Warianty (`contract_type`): `telecom` (telefon/internet/TV), `fitness` (siłownia, usługi ciągłe), `rental` (najem lokalu mieszkalnego – najemca), `other` (inna umowa).

## Cytowane przepisy

| Akt | Artykuł | Do czego użyty (gdzie) | Pewność |
|---|---|---|---|
| Kodeks cywilny (Dz.U. 1964 nr 16 poz. 93) | art. 365¹ | wariant `other`, umowa bezterminowa – pismo, legalBasis, poradnik | wysoka |
| Kodeks cywilny | art. 750 | wariant `fitness` – odpowiednie stosowanie przepisów o zleceniu do usług | wysoka |
| Kodeks cywilny | art. 746 § 1 | `fitness` – wypowiedzenie w każdym czasie | wysoka |
| Kodeks cywilny | art. 746 § 3 | `fitness` – nie można z góry zrzec się wypowiedzenia z ważnych powodów | wysoka |
| Kodeks cywilny | art. 385¹ § 1 | `fitness` – klauzule niedozwolone (blokada rezygnacji, rażąco wygórowana opłata) | wysoka |
| Kodeks cywilny | art. 673 § 1 i 2 | `rental`, czas nieoznaczony – terminy umowne / ustawowe | wysoka |
| Kodeks cywilny | art. 673 § 3 | `rental`, czas oznaczony – wypowiedzenie tylko w wypadkach z umowy | wysoka |
| Kodeks cywilny | art. 688 | `rental` – 3 miesiące naprzód na koniec miesiąca przy czynszu miesięcznym | wysoka |
| Ustawa z 21.06.2001 r. o ochronie praw lokatorów… | art. 6 ust. 4 (w piśmie BEZ numeru – ogólne odesłanie) | `rental` – zwrot kaucji w ciągu miesiąca od opróżnienia lokalu | wysoka co do treści, numer ust. [DO WERYFIKACJI] |
| Ustawa z 12.07.2024 r. – Prawo komunikacji elektronicznej (Dz.U. 2024 poz. 1221) | ogólnie (bez numerów artykułów) | `telecom` – podstawa wypowiedzenia; od 10.11.2024 zastąpiła Prawo telekomunikacyjne | wysoka co do aktu i daty; Dz.U. [DO WERYFIKACJI] |
| PKE | przepis o formie wypowiedzenia (co najmniej forma zawarcia umowy) | `telecom` – akapit „Podstawa prawna” | [DO WERYFIKACJI] – numer artykułu i dokładne brzmienie |
| PKE | przepis o obowiązku potwierdzenia przyjęcia wypowiedzenia | `telecom` – akapit „Podstawa prawna” | [DO WERYFIKACJI] |
| PKE (implementacja art. 105 ust. 4 EKŁE – dyrektywa 2018/1972) | prawo wypowiedzenia bez kosztów przy zmianie warunków + wyjątki (zmiana wyłącznie korzystna / czysto administracyjna / wynikająca z przepisów) | `telecom` + `reason = terms_change` | [DO WERYFIKACJI] – numer artykułu, zakres wyjątków |
| PKE | roszczenie z tytułu ulgi (proporcjonalne), przejście umowy terminowej w bezterminową | poradnik, FAQ, żądanie wskazania należności | [DO WERYFIKACJI] |
| PKE | pozasądowe rozwiązywanie sporów przed Prezesem UKE | instrukcje „afterSending”, poradnik | [DO WERYFIKACJI] – czy tryb ADR przy Prezesie UKE w PKE w tej samej formie |
| RODO (UE) 2016/679 | art. 7 ust. 3 | checkbox `marketing_withdrawal` – cofnięcie zgody | wysoka |
| RODO (UE) 2016/679 | art. 21 ust. 2 | checkbox `marketing_withdrawal` – sprzeciw wobec marketingu bezpośredniego | wysoka |

## Założenia
- Nadawca to konsument (osoba fizyczna) – stąd powołanie art. 385¹ KC i przepisów konsumenckich PKE.
- Pismo zawsze zawiera „bezpiecznik”: jeżeli wskazana data jest za wczesna, umowa rozwiązuje się w najbliższym dopuszczalnym terminie.
- Najem: przy braku terminu umownego pismo podaje szacowaną datę rozwiązania przy założeniu doręczenia w miesiącu planowanej wysyłki (`send_date`) – sformułowane warunkowo („Przy doręczeniu … w październiku 2026 r. umowa ulegnie rozwiązaniu z dniem …”).
- `fitness` + ważny powód + brak żądanej daty → wypowiedzenie ze skutkiem natychmiastowym z klauzulą ewentualną (okres umowny).
- `other` bez terminu umownego → „ze skutkiem niezwłocznym, a jeżeli z umowy lub przepisów wynika termin – z jego zachowaniem” (art. 365¹ KC).
- `telecom` bez okresu w umowie → „okres z regulaminu, a w razie braku – koniec okresu rozliczeniowego” (praktyka rynkowa).
- Pismo nie powołuje numerów artykułów PKE – wyłącznie „przepisy ustawy … Prawo komunikacji elektronicznej”.

## Pytania do prawnika
1. Proszę o wskazanie numerów artykułów PKE dot.: formy wypowiedzenia przez konsumenta, potwierdzenia przyjęcia wypowiedzenia, prawa wypowiedzenia przy zmianie warunków (i wyjątków), maksymalnego okresu wypowiedzenia umowy przedłużonej / bezterminowej, roszczenia z tytułu ulgi.
2. Czy w piśmie można bezpiecznie sformułować wypowiedzenie umowy z klubem fitness „ze skutkiem natychmiastowym” z ważnych powodów (art. 746 § 1 i 3 KC), czy lepiej zawsze z zachowaniem okresu z regulaminu?
3. Czy dla umów z siłownią zawartych na czas oznaczony (np. 12 miesięcy) powołanie art. 746 KC jest wystarczające w świetle aktualnego orzecznictwa i praktyki UOKiK?
4. Najem: czy umowny termin wypowiedzenia krótszy niż w art. 688 KC (np. 1 miesiąc) jest skuteczny dla najemcy – założyliśmy, że tak (art. 673 § 1 „terminy umowne”).
5. Najem okazjonalny / instytucjonalny – czy wymagają odrębnych sformułowań?
6. Czy akapit o zwrocie kaucji (ogólne odesłanie do ustawy o ochronie praw lokatorów) jest właściwy także przy najmie okazjonalnym?
