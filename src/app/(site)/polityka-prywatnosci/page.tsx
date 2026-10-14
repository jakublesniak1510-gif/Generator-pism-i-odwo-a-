import type { Metadata } from "next";
import { Markdown } from "@/components/Markdown";
import { ContentPage } from "@/components/ui";

export const metadata: Metadata = {
  title: "Polityka prywatności",
  description: "Jak PismoGotowe przetwarza dane osobowe podane w kwestionariuszu i przy płatności.",
  alternates: { canonical: "/polityka-prywatnosci" },
};

// Placeholdery w nawiasach kwadratowych – do uzupełnienia przed startem.
const CONTENT = `
_Wersja z dnia [DATA WEJŚCIA W ŻYCIE]._

## 1. Administrator danych

Administratorem Twoich danych osobowych jest [DANE FIRMY – nazwa, adres siedziby, NIP] („Administrator”). Kontakt w sprawach danych osobowych: [ADRES E-MAIL DO SPRAW RODO].

## 2. Jakie dane przetwarzamy

- **Dane z kwestionariusza** – informacje potrzebne do przygotowania pisma, np. imię i nazwisko, adres, dane kontaktowe, dane adresata, numery umów, rezerwacji lub wezwań, daty i kwoty, opis sytuacji.
- **Dane dotyczące płatności** – identyfikator transakcji i jej status. Danych karty płatniczej nie przetwarzamy – obsługuje je operator płatności.
- **Dane techniczne** – adres IP, informacje o przeglądarce, logi serwera (w celach bezpieczeństwa i ochrony przed nadużyciami).

Prosimy, nie wpisuj do kwestionariusza danych, które nie są potrzebne do pisma – zwłaszcza danych o zdrowiu czy innych danych szczególnych kategorii.

## 3. Cele i podstawy przetwarzania

- **Przygotowanie pisma, udostępnienie podglądu i plików** – art. 6 ust. 1 lit. b RODO (wykonanie umowy lub działania przed jej zawarciem).
- **Obsługa płatności, rozliczenia i dokumentacja księgowa** – art. 6 ust. 1 lit. c RODO (obowiązek prawny).
- **Rozpatrywanie reklamacji, dochodzenie i obrona roszczeń** – art. 6 ust. 1 lit. f RODO (prawnie uzasadniony interes).
- **Bezpieczeństwo Serwisu i ochrona przed nadużyciami** – art. 6 ust. 1 lit. f RODO (prawnie uzasadniony interes).

## 4. Jak długo przechowujemy dane

- Treść pisma i odpowiedzi z kwestionariusza przechowujemy przez **[X] dni** od wygenerowania pisma – w tym czasie możesz ponownie pobrać dokument. Po tym okresie są usuwane.
- Dane dotyczące płatności przechowujemy przez okres wymagany przepisami podatkowymi i rachunkowymi ([5 lat] od końca roku podatkowego).
- Logi techniczne przechowujemy przez [X] dni.

Odpowiedzi wpisywane w kwestionariuszu są też tymczasowo zapisywane w pamięci Twojej przeglądarki (sessionStorage), aby odświeżenie strony nie kasowało formularza. Znikają po zamknięciu karty.

## 5. Komu przekazujemy dane (podwykonawcy)

Korzystamy z usług podmiotów przetwarzających dane w naszym imieniu, na podstawie umów powierzenia:

- **Anthropic PBC** (USA) – redakcja tekstu opisu sytuacji z użyciem modelu AI. Przekazujemy wyłącznie odpowiedzi potrzebne do zredagowania opisu faktów. [PODSTAWA TRANSFERU POZA EOG – np. standardowe klauzule umowne / EU-US Data Privacy Framework].
- **Stripe** – obsługa płatności. Stripe przetwarza dane płatnicze jako niezależny administrator zgodnie z własną polityką prywatności.
- **[DOSTAWCA HOSTINGU]** – utrzymanie serwerów i bazy danych ([LOKALIZACJA SERWERÓW]).

Dane mogą być również udostępnione organom państwowym, jeśli wymagają tego przepisy prawa.

## 6. Twoje prawa

Masz prawo do:

- dostępu do swoich danych i otrzymania ich kopii,
- sprostowania danych,
- usunięcia danych („prawo do bycia zapomnianym”),
- ograniczenia przetwarzania,
- przenoszenia danych,
- wniesienia sprzeciwu wobec przetwarzania opartego na prawnie uzasadnionym interesie,
- wniesienia skargi do **Prezesa Urzędu Ochrony Danych Osobowych** (ul. Stawki 2, 00-193 Warszawa).

Aby skorzystać z praw, napisz na [ADRES E-MAIL DO SPRAW RODO] – podaj link do pisma lub jego identyfikator, abyśmy mogli odnaleźć dane.

## 7. Dobrowolność podania danych

Podanie danych jest dobrowolne, ale niezbędne do przygotowania pisma – bez nich dokument nie będzie kompletny.

## 8. Pliki cookies

Serwis używa wyłącznie niezbędnych mechanizmów technicznych. [JEŚLI ZOSTANĄ DODANE NARZĘDZIA ANALITYCZNE – OPISAĆ TUTAJ I DODAĆ BANER ZGÓD].

## 9. Zautomatyzowane decyzje

Nie podejmujemy wobec Ciebie decyzji opartych wyłącznie na zautomatyzowanym przetwarzaniu, w tym profilowaniu, które wywoływałyby skutki prawne.
`;

export default function PrivacyPage() {
  return (
    <ContentPage title="Polityka prywatności" lead="Jakie dane przetwarzamy, po co i jak długo – oraz jakie masz prawa.">
      <div className="max-w-3xl">
        <Markdown document>{CONTENT}</Markdown>
      </div>
    </ContentPage>
  );
}
