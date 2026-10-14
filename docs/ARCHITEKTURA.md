# Architektura – Generator pism i odwołań

Stack: **Next.js 16 (App Router, TypeScript, Tailwind 4)**, `@anthropic-ai/sdk` (redakcja faktów), `docx` + `pdf-lib` (eksport), `better-sqlite3` (dokumenty), `stripe` (płatności, BLIK/P24/karta).

## Zasada nr 1 – AI nie tworzy prawa
Podstawy prawne, terminy, instrukcje i struktura pisma są w szablonie (`src/lib/templates/*.ts`).
Model dostaje odpowiedzi użytkownika i zwraca **wyłącznie** `AiDraft { facts, demand, justification? }`
(structured output, schema Zod). Tekst AI jest filtrowany: jeśli zawiera „art.”, „sygn.”, „ustaw”, „§”,
„wyrok”, „orzecz” – odrzucamy i używamy wersji deterministycznej. Bez klucza API serwis działa w 100 %
na szablonie (`ctx.ai === undefined`).

## Przepływ
1. `/pisma/[slug]` – poradnik SEO + kwestionariusz (sekcje z `template.sections`).
2. `POST /api/documents` `{ slug, answers }` → walidacja (zod budowany z pytań) → opcjonalne AI → `template.render()` → zapis do SQLite → zwrot podglądu (`previewParagraphCount` akapitów, reszta „zamknięta”).
3. `/dokument/[id]?token=…` – podgląd, przycisk „Odblokuj pełne pismo – 24,99 zł”.
4. `POST /api/documents/[id]/checkout` → Stripe Checkout (`PAYMENTS_MODE=stripe`) **lub** natychmiastowe oznaczenie jako opłacone (`PAYMENTS_MODE=dev`).
5. `POST /api/webhooks/stripe` – `checkout.session.completed` → `status = paid`.
6. `GET /api/documents/[id]/download?token=…&format=docx|pdf` – tylko gdy `paid`.

Typy odpowiedzi API: `src/lib/api-types.ts`. Typy szablonu: `src/lib/templates/types.ts`. Helpery do szablonów: `src/lib/templates/helpers.ts`.

## Struktura katalogów i właściciele
| Ścieżka | Zawartość | Właściciel |
|---|---|---|
| `src/app/(site)/**`, `src/app/layout.tsx`, `src/app/globals.css`, `src/app/sitemap.ts`, `src/app/robots.ts`, `src/components/**` | UI, strony, formularz, podgląd | **frontend** |
| `src/app/api/**`, `src/lib/engine/**`, `src/lib/ai/**`, `src/lib/export/**`, `src/lib/db/**`, `src/lib/payments/**` | backend | **backend** |
| `src/lib/templates/<slug>.ts`, `docs/LEGAL_REVIEW.md` | treść szablonów | **content-A / content-B** |
| `src/lib/templates/types.ts`, `helpers.ts`, `index.ts`, `src/lib/api-types.ts` | kontrakt – **nie zmieniać bez zgody szefa** | szef |

## Zmienne środowiskowe (`.env.example`)
```
ANTHROPIC_API_KEY=            # opcjonalny; bez niego pisma składa sam szablon
AI_MODEL=claude-opus-5-5
PAYMENTS_MODE=dev             # dev | stripe
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
NEXT_PUBLIC_SITE_URL=http://localhost:3000
DATABASE_PATH=./data/pisma.db
DOCUMENT_TOKEN_SECRET=change-me
```

## Strony
`/` (lista pism, jak to działa, cennik skrót), `/pisma/[slug]`, `/dokument/[id]`, `/cennik`, `/jak-to-dziala`, `/regulamin`, `/polityka-prywatnosci`, `/kontakt`.

## Ceny (grosze)
Pojedyncze pismo 2499 (domyślnie w szablonach), pakiet 5 pism 5900 (etap 2), sprawdzenie przez prawnika 12900 (etap 2 – partner).

---

## Fala 2 (rozszerzenia)

Nowe endpointy i typy odpowiedzi są opisane w `src/lib/api-types.ts` (sekcja „FALA 2”). Skrót:

| Endpoint | Cel |
|---|---|
| `GET /api/capabilities` | które funkcje są skonfigurowane (AI prefill, e-mail, tryb płatności) |
| `POST /api/prefill` | wypełnienie formularza ze zdjęcia / PDF / wklejonego tekstu dokumentu (Claude vision + structured output); AI wyodrębnia WYŁĄCZNIE dane widoczne w dokumencie |
| `PATCH /api/documents/[id]` | edycja akapitów opłaconego pisma w przeglądarce; eksport z wersji po edycji |
| `POST /api/documents/[id]/redeem` | odblokowanie kodem (pakiet 5 pism, kody promocyjne, kody partnerskie) |
| `POST /api/packages/checkout`, `GET /api/packages/session` | zakup pakietu 5 pism → kod |
| `POST /api/documents/[id]/email` | wysyłka linku do pisma na e-mail (Resend, opcjonalne) |
| `POST /api/cron/cleanup` | retencja: usuwanie pism po 90 dniach (RODO) |

Nowe tabele SQLite: `codes(code PK, kind 'package'|'promo', uses_total, uses_left, created_at, stripe_session_id, email)`, kolumny w `documents`: `edited_at`, `paid_via` ('stripe'|'dev'|'code:<code>').

Nowe strony: `/poradniki` + `/poradniki/[slug]` (baza wiedzy), `/pakiet/sukces`, `opengraph-image` dla pism.

Nowe kategorie szablonów: `praca`, `dane-osobowe`. Helpery `sentence`, `tidy`, `tidyParagraph`, `userParagraphs` są teraz w `helpers.ts` – nie kopiować ich do szablonów.

Testy: `npm test` (vitest) – `src/**/*.test.ts`. Konfiguracja aliasu `@/` w `vitest.config.ts`.
