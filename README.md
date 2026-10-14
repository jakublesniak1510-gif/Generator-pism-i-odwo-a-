# PismoGotowe – generator pism i odwołań

Serwis, w którym użytkownik wybiera rodzaj pisma (reklamacja, odwołanie od opłaty, wypowiedzenie umowy…), odpowiada na kwestionariusz i pobiera gotowe pismo DOCX/PDF razem z instrukcją, gdzie i jak je wysłać.

- Koncepcja biznesowa i decyzje: [`docs/KONCEPCJA.md`](docs/KONCEPCJA.md)
- Architektura i kontrakt API: [`docs/ARCHITEKTURA.md`](docs/ARCHITEKTURA.md)
- Przepisy do weryfikacji przez prawnika: [`docs/legal-review/`](docs/legal-review/)

## Uruchomienie lokalne

```bash
npm install
cp .env.example .env     # PAYMENTS_MODE=dev – płatność symulowana, bez klucza AI działa czysty szablon
npm run dev              # http://localhost:3000
```

Produkcja: ustaw `PAYMENTS_MODE=stripe`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` (endpoint `/api/webhooks/stripe`, zdarzenie `checkout.session.completed`), `NEXT_PUBLIC_SITE_URL`, `DOCUMENT_TOKEN_SECRET` (długi losowy ciąg) i opcjonalnie `ANTHROPIC_API_KEY`. Baza SQLite (`DATABASE_PATH`) wymaga trwałego dysku.

```bash
npm run build && npm start
```

## Dodawanie nowego pisma

1. Utwórz `src/lib/templates/<slug>.ts` zgodnie z `LetterTemplate` (`src/lib/templates/types.ts`).
2. Dodaj do listy w `src/lib/templates/index.ts`.
3. Dopisz `docs/legal-review/<slug>.md` z listą cytowanych przepisów.

Podstawy prawne, terminy i instrukcje są zawsze w szablonie. AI redaguje wyłącznie opis stanu faktycznego i żądanie; tekst z cytowaniem przepisów jest odrzucany automatycznie.
