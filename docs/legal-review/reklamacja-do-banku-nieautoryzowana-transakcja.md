# Legal review – `reklamacja-do-banku-nieautoryzowana-transakcja`

Plik szablonu: `src/lib/templates/reklamacja-do-banku-nieautoryzowana-transakcja.ts`
Stan prawny sprawdzony na: 14.10.2026 r. Teksty jednolite pobrane z API Sejmu (ELI) i porównane artykuł po artykule.

Źródła weryfikacji:
- Ustawa z 19.08.2011 r. o usługach płatniczych (u.u.p.) – t.j. **Dz. U. z 2026 r. poz. 623** (stan na 13.04.2026 r.). Późniejsze zmiany (Dz. U. z 2026 r. poz. 340 – w życie 31.03.2026; poz. 875, 1206, 1074 – w życie 2027 r.) nie dotyczą cytowanych przepisów według stanu na dziś; **zmiany wchodzące w życie w 2027 r. do przejrzenia przed ich wejściem w życie** [DO WERYFIKACJI].
- Ustawa z 5.08.2015 r. o rozpatrywaniu reklamacji (u.r.r.) – t.j. **Dz. U. z 2026 r. poz. 823**.

## Rozgałęzienia

| Pole | Warianty | Skutek w piśmie |
|---|---|---|
| `transaction_type` | `card` / `transfer` / `blik` | opis instrumentu w pierwszym akapicie |
| `cause` | `card_lost` / `phishing` / `vishing` / `remote_access` / `unknown` | `card_lost`: art. 46 ust. 2 (50 EUR), ust. 3, ust. 4. Oszustwa (`phishing`, `vishing`, `remote_access`): akapit przeciwko zarzutowi rażącego niedbalstwa + art. 45 ust. 2. `unknown`: art. 46 ust. 3 i 4 bez akapitu o oszustwie. |
| `confirmed_in_app` | `no` / `yes_misled` / `unknown` | `yes_misled`: zdanie, że potwierdzenie uzyskane podstępem nie jest zgodą w rozumieniu art. 40 ust. 1. |
| `bank_response` | `none` / `refused` | `refused`: tytuł „PONOWNA REKLAMACJA”, akapit z treścią odmowy. |
| daty | `first_debit_date`, `bank_report_date` | zdanie „Zgłoszenie zostało dokonane w tym terminie” (art. 44 ust. 2) tylko gdy zgłoszenie mieści się w 13 miesiącach; „niezwłocznie” tylko gdy zgłoszenie ≤ 1 dzień od zauważenia. |

## Przepisy cytowane w piśmie i w treściach

| Akt | Przepis | Do czego użyty | Pewność |
|---|---|---|---|
| u.u.p. | art. 40 ust. 1 | definicja autoryzacji (zgoda w sposób uzgodniony) | wysoka |
| u.u.p. | art. 42 ust. 1–2 | obowiązki użytkownika (niezwłoczne zgłoszenie, ochrona danych) | wysoka |
| u.u.p. | art. 43 ust. 1 pkt 4 | wniosek o potwierdzenie dokonania zgłoszenia (procedury dowodowe, 18 mies.) | wysoka |
| u.u.p. | art. 44 ust. 1–2 | niezwłoczne powiadomienie; wygaśnięcie roszczeń po 13 miesiącach | wysoka |
| u.u.p. | art. 45 ust. 1–2 | ciężar dowodu autoryzacji i rażącego niedbalstwa na dostawcy; zarejestrowane użycie instrumentu niewystarczające | wysoka |
| u.u.p. | art. 46 ust. 1 | zwrot do końca następnego dnia roboczego po zgłoszeniu (D+1); wyjątek – udokumentowane podejrzenie oszustwa + pisemne zawiadomienie organów ścigania | wysoka (w piśmie użyto ustawowego „podejrzewać oszustwo”, bez dopowiedzenia „ze strony płatnika”; w poradniku – interpretacja „ze strony klienta”) |
| u.u.p. | art. 46 ust. 2, 2a | odpowiedzialność do równowartości 50 euro przy utracie/kradzieży/przywłaszczeniu | wysoka |
| u.u.p. | art. 46 ust. 3 | pełna odpowiedzialność tylko przy umyślności lub rażącym niedbalstwie | wysoka |
| u.u.p. | art. 46 ust. 4 | po zgłoszeniu brak odpowiedzialności (chyba że umyślnie) | wysoka (zlecenie oznaczało go jako [DO WERYFIKACJI] – brzmienie potwierdzone) |
| u.u.p. | art. 46 ust. 4a | brak silnego uwierzytelnienia – brak odpowiedzialności płatnika | wysoka |
| u.u.p. | art. 15a ust. 2–4 | odpowiedź na reklamację w 15 dni roboczych, max 35 dni roboczych; wysłanie przed upływem wystarcza | wysoka (zlecenie oznaczało jako [DO WERYFIKACJI] – brzmienie potwierdzone) |
| u.u.p. | art. 15 | skarga do KNF (instrukcje) | wysoka |
| u.r.r. | art. 8 | fikcja rozpatrzenia reklamacji zgodnie z wolą klienta | wysoka co do treści; **relacja do art. 15a u.u.p. – patrz pytanie 1** |
| u.r.r. | art. 17, 36–38 | Rzecznik Finansowy: interwencja bezpłatna, postępowanie polubowne 50 zł | wysoka |

## Założenia

1. Termin „odpowiedź banku” w kalkulatorze to 21 dni kalendarzowych od daty wysłania (przybliżenie 15 dni roboczych); opis wyjaśnia uproszczenie.
2. Termin D+1 w kalkulatorze to +1 dzień kalendarzowy od zgłoszenia; opis informuje o przesunięciu na dzień roboczy.
3. Akapit „Rażące niedbalstwo to kwalifikowana postać winy, polegająca na naruszeniu elementarnych zasad ostrożności…” to argumentacja doktrynalna, bez sygnatur orzeczeń.
4. Pismo żąda przedstawienia logów (IP, urządzenie, sposób uwierzytelnienia) – nie powołujemy przepisu nakładającego taki obowiązek; to wniosek dowodowy/negocjacyjny.
5. Formularz pyta tylko o 4 ostatnie cyfry rachunku/karty (minimalizacja danych, PCI).

## [DO WERYFIKACJI] – pytania do prawnika

1. **Art. 8 u.r.r. vs art. 15a u.u.p.** – czy fikcja z art. 8 u.r.r. (odnosząca się do terminów z art. 6–7 u.r.r., tj. 30/60 dni) ma zastosowanie, gdy bank nie dotrzyma 15/35 dni roboczych z art. 15a u.u.p.? Pismo mówi ogólnie „w przypadku niedotrzymania terminu odpowiedzi” – prosimy o ocenę, czy nie doprecyzować („najpóźniej po upływie 30 dni od otrzymania reklamacji”).
2. **Potwierdzenie w aplikacji pod wpływem manipulacji** – czy formuła „potwierdzenie uzyskane podstępem, bez wiedzy o rzeczywistej treści transakcji, nie stanowi zgody” jest wystarczająco ostrożna w świetle aktualnego orzecznictwa (rozbieżnego)? Ewentualnie dodać stanowisko RF/UOKiK (nie weryfikowaliśmy).
3. **Arbiter Bankowy ZBP** – aktualne limity kwotowe, opłaty i zakres spraw nie zostały zweryfikowane; w treściach odsyłamy do strony ZBP.
4. **Silne uwierzytelnianie (art. 46 ust. 4a)** – zdanie warunkowe w piśmie („jeżeli przy którejkolwiek…”) – czy nie lepiej żądać od banku wprost informacji, czy SCA zastosowano (jest to w punkcie 2 wniosków)?
5. **Zmiany u.u.p. od 2027 r.** (Dz. U. z 2026 r. poz. 875, 1074, 1206) oraz ewentualne wdrożenie PSD3/PSR – przegląd przed wejściem w życie.
