import type { Metadata } from "next";
import { Markdown } from "@/components/Markdown";
import { ContentPage } from "@/components/ui";

export const metadata: Metadata = {
  title: "Regulamin",
  description: "Regulamin serwisu PismoGotowe – zasady korzystania z usługi tworzenia pism i odwołań.",
  alternates: { canonical: "/regulamin" },
};

// Placeholdery w nawiasach kwadratowych – do uzupełnienia przed startem.
const CONTENT = `
_Wersja z dnia [DATA WEJŚCIA W ŻYCIE]._

## § 1. Postanowienia ogólne

1. Niniejszy regulamin określa zasady korzystania z serwisu internetowego **PismoGotowe** dostępnego pod adresem [ADRES SERWISU] („Serwis”).
2. Serwis prowadzi [DANE FIRMY – nazwa, adres siedziby, NIP, REGON, KRS/CEIDG] („Usługodawca”).
3. Kontakt z Usługodawcą: e-mail [ADRES E-MAIL], adres korespondencyjny [ADRES].
4. Regulamin jest regulaminem, o którym mowa w art. 8 ustawy z dnia 18 lipca 2002 r. o świadczeniu usług drogą elektroniczną.

## § 2. Definicje

1. **Użytkownik** – osoba fizyczna, osoba prawna lub jednostka organizacyjna korzystająca z Serwisu.
2. **Konsument** – Użytkownik będący konsumentem w rozumieniu art. 22¹ Kodeksu cywilnego.
3. **Pismo** – dokument (np. reklamacja, odwołanie, wypowiedzenie, wezwanie) wygenerowany w Serwisie na podstawie szablonu i odpowiedzi Użytkownika, udostępniany w formatach DOCX i PDF.
4. **Szablon** – przygotowany przez Usługodawcę wzór pisma zawierający strukturę dokumentu, podstawy prawne, terminy i instrukcję wysyłki.
5. **Podgląd** – bezpłatnie udostępniany fragment Pisma.

## § 3. Charakter usługi

1. Serwis świadczy usługę elektroniczną polegającą na **tworzeniu dokumentów na podstawie Szablonów** i odpowiedzi udzielonych przez Użytkownika w kwestionariuszu.
2. **Serwis nie świadczy pomocy prawnej i nie stanowi porady prawnej.** Usługodawca nie analizuje indywidualnej sytuacji Użytkownika i nie gwarantuje określonego rozstrzygnięcia sprawy.
3. Podstawy prawne, terminy i instrukcje zawarte w Pismach pochodzą z Szablonów. Do zredagowania opisu stanu faktycznego na podstawie odpowiedzi Użytkownika Serwis może wykorzystywać narzędzia sztucznej inteligencji; narzędzia te nie dobierają przepisów prawa.
4. Użytkownik odpowiada za prawdziwość i kompletność podanych danych oraz zobowiązany jest sprawdzić treść Pisma przed jego wysłaniem.

## § 4. Wymagania techniczne

Do korzystania z Serwisu potrzebne są: urządzenie z dostępem do internetu, aktualna przeglądarka internetowa z włączoną obsługą JavaScript oraz program do otwierania plików PDF lub DOCX.

## § 5. Zawarcie umowy i płatność

1. Wypełnienie kwestionariusza i wyświetlenie Podglądu są bezpłatne.
2. Umowa o dostarczenie Pisma zostaje zawarta z chwilą opłacenia zamówienia. Cena podana jest przy każdym Szablonie i jest ceną brutto ([INFORMACJA O VAT]).
3. Płatności obsługuje zewnętrzny operator płatności (Stripe). Dostępne metody płatności są prezentowane przed dokonaniem płatności.
4. Po zaksięgowaniu płatności Pismo jest dostępne natychmiast pod unikalnym linkiem. Użytkownik powinien zachować ten link – stanowi on jedyny sposób dostępu do Pisma.

## § 6. Prawo odstąpienia od umowy

1. Pismo jest **treścią cyfrową niedostarczaną na nośniku materialnym**, dostarczaną natychmiast po płatności.
2. Przed dokonaniem płatności Konsument wyraża wyraźną zgodę na rozpoczęcie świadczenia (dostarczenie Pisma) przed upływem terminu do odstąpienia od umowy i przyjmuje do wiadomości, że w ten sposób **traci prawo odstąpienia od umowy** – zgodnie z art. 38 ust. 1 pkt 13 ustawy z dnia 30 maja 2014 r. o prawach konsumenta. Usługodawca potwierdza ten fakt w potwierdzeniu zawarcia umowy.
3. Postanowienia dotyczące Konsumenta stosuje się również do osoby fizycznej zawierającej umowę bezpośrednio związaną z jej działalnością gospodarczą, gdy umowa ta nie ma dla niej charakteru zawodowego (art. 38a ustawy o prawach konsumenta).

## § 7. Reklamacje

1. Użytkownik może złożyć reklamację dotyczącą działania Serwisu lub Pisma (np. błąd techniczny, brak dostępu do plików, niezgodność Pisma z udzielonymi odpowiedziami) na adres e-mail [ADRES E-MAIL].
2. Reklamacja powinna zawierać opis problemu, link do Pisma lub identyfikator dokumentu oraz dane kontaktowe.
3. Usługodawca rozpatruje reklamację **w terminie 14 dni** od jej otrzymania i informuje o wyniku na adres e-mail, z którego reklamacja została wysłana.
4. W przypadku uwzględnienia reklamacji Usługodawca wygeneruje Pismo ponownie, poprawi błąd albo zwróci zapłaconą cenę.
5. Konsument może skorzystać z pozasądowych sposobów rozpatrywania sporów, m.in. z pomocy miejskiego lub powiatowego rzecznika konsumentów oraz wojewódzkiego inspektoratu Inspekcji Handlowej.

## § 8. Odpowiedzialność

1. Usługodawca dokłada starań, aby Szablony były zgodne z obowiązującymi przepisami na dzień ich publikacji.
2. Usługodawca nie ponosi odpowiedzialności za skutki wykorzystania Pisma, w szczególności za wynik sprawy, niedochowanie terminów przez Użytkownika ani za podanie przez Użytkownika nieprawdziwych lub niepełnych danych.
3. Wobec Użytkowników niebędących Konsumentami odpowiedzialność Usługodawcy ograniczona jest do wysokości ceny zapłaconej za Pismo. Ograniczenie nie dotyczy szkody wyrządzonej umyślnie.
4. Usługodawca może czasowo wstrzymać działanie Serwisu z przyczyn technicznych.

## § 9. Dane osobowe

Zasady przetwarzania danych osobowych opisuje [Polityka prywatności](/polityka-prywatnosci).

## § 10. Postanowienia końcowe

1. Usługodawca może zmienić Regulamin z ważnych przyczyn (np. zmiana przepisów, zmiana zakresu usług). Do umów zawartych przed zmianą stosuje się Regulamin w dotychczasowym brzmieniu.
2. W sprawach nieuregulowanych stosuje się przepisy prawa polskiego, w szczególności Kodeksu cywilnego, ustawy o świadczeniu usług drogą elektroniczną i ustawy o prawach konsumenta.
`;

export default function TermsPage() {
  return (
    <ContentPage title="Regulamin" lead="Zasady korzystania z serwisu PismoGotowe.">
      <div className="max-w-3xl">
        <Markdown document>{CONTENT}</Markdown>
      </div>
    </ContentPage>
  );
}
