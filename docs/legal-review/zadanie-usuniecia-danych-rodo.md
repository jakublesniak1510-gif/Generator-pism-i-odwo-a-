# Legal review – `zadanie-usuniecia-danych-rodo`

Plik szablonu: `src/lib/templates/zadanie-usuniecia-danych-rodo.ts` (eksport `zadanieUsunieciaDanychRodo`).
Stan prawny sprawdzony na: 14.10.2026 r.

Źródła:
- **RODO** – rozporządzenie (UE) 2016/679, Dz. Urz. UE L 119 z 4.05.2016, s. 1 – polski tekst pobrany z Urzędu Publikacji UE (CELEX 32016R0679, wersja skonsolidowana w repozytorium Cellar); porównane art. 7, 12, 15, 17, 19, 21, 77, 79, 82.
- **Prawo komunikacji elektronicznej** – **Dz. U. z 2024 r. poz. 1221** (art. 398, 399, 400). Akty zmieniające (Dz. U. z 2025 r. poz. 637, 820; z 2026 r. poz. 252, 815, 1296) nie dotyczą art. 398–400 (poz. 1296 zmienia tylko art. 419 – koordynator DSA).
- **Ustawa o świadczeniu usług drogą elektroniczną** – t.j. **Dz. U. z 2024 r. poz. 1513**: art. 10 oznaczony jako „(uchylony)” – uchylony przez art. 26 pkt 3 ustawy – Przepisy wprowadzające PKE (**Dz. U. z 2024 r. poz. 1222**), z dniem wejścia w życie PKE (10.11.2024 r.).

**Wynik weryfikacji punktu z briefu:** od 10.11.2024 r. zgoda na marketing bezpośredni z użyciem telekomunikacyjnych urządzeń końcowych (e-mail, SMS, telefon) i automatycznych systemów wywołujących wynika z **art. 398 ust. 1 PKE**; zgodę można wyrazić przez udostępnienie adresu elektronicznego (ust. 2); do zgody stosuje się odpowiednio przepisy o ochronie danych osobowych (**art. 400 PKE**). Art. 10 u.ś.u.d.e. i art. 172 Prawa telekomunikacyjnego nie obowiązują. W piśmie cytujemy art. 398 ust. 1 i art. 400 PKE – **pewność wysoka**.

## Warianty (`request_type`)

| Wartość | Przepis | Uwagi |
|---|---|---|
| `erasure` | art. 17 ust. 1 lit. a/b/c/d (wg `erasure_ground`), art. 17 ust. 3, art. 19 | prośba o wskazanie danych zatrzymanych na podstawie ust. 3 |
| `objection` | art. 21 ust. 2–3 | zawsze z cofnięciem zgody z art. 398 PKE |
| `access` | art. 15 ust. 1 lit. a–d, g, h; ust. 3 | kopia w formie elektronicznej lub papierowej (wg `response_form`) |
| `withdraw_consent` | art. 7 ust. 3; art. 17 ust. 1 lit. b | prośba o usunięcie, jeśli brak innej podstawy |

Wspólne: art. 12 ust. 3–6 (termin 1 miesiąc + 2, bezpłatność, wątpliwości co do tożsamości), art. 77 (skarga do Prezesa UODO).

## Przepisy cytowane

| Akt | Przepis | Do czego | Pewność |
|---|---|---|---|
| RODO | art. 7 ust. 3 | wycofanie zgody w dowolnym momencie, „równie łatwe jak wyrażenie” | wysoka |
| RODO | art. 12 ust. 3 | bez zbędnej zwłoki, max 1 miesiąc, przedłużenie o 2 miesiące z informacją w 1. miesiącu | wysoka |
| RODO | art. 12 ust. 5 | bezpłatność; opłata / odmowa przy żądaniach ewidentnie nieuzasadnionych | wysoka |
| RODO | art. 12 ust. 6 | dodatkowe informacje przy uzasadnionych wątpliwościach co do tożsamości | wysoka |
| RODO | art. 15 ust. 1 lit. a–h, ust. 3 | zakres informacji; kopia (pierwsza bezpłatna, forma elektroniczna) | wysoka |
| RODO | art. 17 ust. 1 lit. a–d, ust. 3 | przesłanki i wyjątki prawa do usunięcia | wysoka |
| RODO | art. 19 | zawiadomienie odbiorców; wskazanie ich na żądanie | wysoka |
| RODO | art. 21 ust. 2–3 | sprzeciw wobec marketingu bezpośredniego, w tym profilowania | wysoka |
| RODO | art. 77, 79, 82 | skarga do organu nadzorczego, sąd, odszkodowanie (instrukcje, poradnik) | wysoka |
| PKE | art. 398 ust. 1–2, art. 400 | zgoda na marketing e-mail/SMS/telefon; stosowanie przepisów o ochronie danych | wysoka |

## Założenia

1. Pismo nie żąda dokumentów tożsamości i nie zawiera PESEL; identyfikatory są opcjonalne – przy ich braku odsyłamy do nagłówka pisma.
2. W wariancie `erasure` + `objection_marketing` łączymy art. 17 ust. 1 lit. c z sprzeciwem z art. 21 ust. 2 (druga część lit. c).
3. W wariancie `unlawful` (lit. d) pismo stwierdza, że według wiedzy autora nie zachodzi przesłanka z art. 6 ust. 1 – sformułowanie ostrożne („według mojej wiedzy”).
4. Cena 1999 gr (zgodnie z briefem).
5. Adresów PUODO nie podajemy (mogą się zmieniać) – odsyłamy do uodo.gov.pl.

## [DO WERYFIKACJI] – pytania do prawnika

1. Czy w wariancie `objection` należy dodatkowo wskazać art. 21 ust. 1 (sprzeciw z przyczyn szczególnej sytuacji) dla profilowania niezwiązanego z marketingiem?
2. Czy cofnięcie zgody z art. 398 PKE kierowane do administratora, który nie jest nadawcą komunikatów (np. broker danych), jest skuteczne – czy pismo powinno to zastrzegać?
3. Czy w FAQ/instrukcjach właściwe jest wskazanie Prezesa UKE i UOKiK jako organów do zgłaszania uporczywego telemarketingu (art. 398 ust. 4 PKE – czyn nieuczciwej konkurencji)?
