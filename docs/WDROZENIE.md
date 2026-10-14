# Wdrożenie produkcyjne – krok po kroku

Czas: ok. 2 godziny przy gotowych kontach. Kolejność ma znaczenie.

## 1. Hosting
Najprościej **Vercel** (Next.js działa bez konfiguracji) **z zewnętrzną bazą**: SQLite na Vercelu nie przetrwa restartu. Opcje:
- **Railway / Render / VPS (Docker)** – SQLite na trwałym dysku działa od razu (`DATABASE_PATH=/data/pisma.db`). Najtańsza droga na start.
- **Vercel** – wymaga zamiany `src/lib/db/index.ts` na Postgres (np. Neon) – ok. 2 godziny pracy; moduł bazy jest odizolowany (tylko ten plik).

Zalecenie na start: Railway lub mały VPS z Dockerem, SQLite + codzienny backup pliku bazy.

## 2. Zmienne środowiskowe (z `.env.example`)
| Zmienna | Wartość |
|---|---|
| `NEXT_PUBLIC_SITE_URL` | `https://twojadomena.pl` (bez ukośnika na końcu) |
| `PAYMENTS_MODE` | `stripe` |
| `STRIPE_SECRET_KEY` | klucz `sk_live_…` z dashboardu Stripe |
| `STRIPE_WEBHOOK_SECRET` | `whsec_…` – po dodaniu webhooka (krok 3) |
| `DOCUMENT_TOKEN_SECRET` | losowy ciąg 64 znaków (`openssl rand -hex 32`) |
| `DATABASE_PATH` | ścieżka na trwałym dysku |
| `ANTHROPIC_API_KEY` | klucz z console.anthropic.com – włącza redakcję AI i wypełnianie ze zdjęcia |
| `RESEND_API_KEY`, `EMAIL_FROM` | opcjonalnie – wysyłka linków e-mailem (domena zweryfikowana w Resend) |
| `CRON_SECRET` | losowy ciąg – zabezpiecza endpoint czyszczący |
| `NEXT_PUBLIC_PLAUSIBLE_DOMAIN` | opcjonalnie – domena w Plausible |

## 3. Stripe
1. Aktywuj konto (dane firmy, rachunek).
2. Ustawienia → Metody płatności: włącz **BLIK**, **Przelewy24**, karty.
3. Developers → Webhooks → „Add endpoint”: `https://twojadomena.pl/api/webhooks/stripe`, zdarzenia `checkout.session.completed` i `checkout.session.async_payment_succeeded`. Skopiuj `whsec_…` do `STRIPE_WEBHOOK_SECRET`.
4. Test: tryb testowy Stripe (`sk_test_…`) + karta 4242 4242 4242 4242; sprawdź, że po płatności dokument ma status „opłacone”.

## 4. Regulamin, polityka prywatności, kontakt
Wyszukaj w kodzie `[` w `src/app/(site)/regulamin`, `polityka-prywatnosci`, `kontakt` i uzupełnij placeholdery: nazwa firmy, NIP, adres, e-mail, czas przechowywania (90 dni), podwykonawcy (Anthropic, Stripe, Resend, hosting).

## 5. Cron (retencja danych)
Raz dziennie: `curl -X POST -H "Authorization: Bearer $CRON_SECRET" https://twojadomena.pl/api/cron/cleanup`. Na Vercelu – `vercel.json` ma gotową sekcję `crons`; na VPS – wpis w crontab.

## 6. Google
1. Search Console: dodaj domenę, prześlij `https://twojadomena.pl/sitemap.xml`.
2. Google Ads: 3 kampanie na pisma z największym wolumenem (reklamacja towaru, odstąpienie od umowy, jazda bez biletu), frazy z „wzór” i „jak napisać”, budżet 30 zł/dzień przez 14 dni, śledzenie konwersji = wejście na `/dokument/…?paid=1`.

## 7. Audyt prawny
Przekaż prawnikowi katalog `docs/legal-review/` (jeden plik na pismo, przepisy z oceną pewności i pytaniami). Po akceptacji można w UI przywrócić sformułowanie „szablony sprawdzone przez prawnika”.

## 8. Kody partnerskie i testowe
```bash
node scripts/create-code.mjs --uses 5 --kind promo
```
Wydrukowany kod odblokowuje 5 pism. Kody dla kancelarii, rzeczników, recenzentów.

## 9. Po starcie – co monitorować
- stosunek podglądów do płatności (cel ≥ 3 %),
- błędy w logach z prefixem `[ai]` i `[stripe]`,
- czas odpowiedzi `/api/documents` (AI dodaje 5–15 s; bez klucza < 1 s),
- czy webhooki Stripe docierają (dashboard → Webhooks → Logs).
