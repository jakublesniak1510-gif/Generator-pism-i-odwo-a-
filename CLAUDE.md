# Generator pism i odwołań – zasady projektu

- Język UI, treści i komentarzy: **polski**. Kod (nazwy zmiennych, funkcji): angielski.
- Przeczytaj `docs/ARCHITEKTURA.md` przed pracą. Kontrakt typów: `src/lib/templates/types.ts`, `src/lib/api-types.ts`.
- Next.js 16: przed użyciem API frameworka sprawdź `node_modules/next/dist/docs/` (zmiany względem starszych wersji). `params` i `searchParams` w stronach/route handlerach są **Promise** – trzeba je `await`.
- AI (Claude) nigdy nie generuje podstaw prawnych – tylko opis faktów i żądanie (patrz ARCHITEKTURA, zasada nr 1).
- Przed oddaniem pracy: `npm run lint` i `npx tsc --noEmit` muszą przechodzić bez błędów w Twoich plikach.
- Nie edytuj plików innych właścicieli (tabela w ARCHITEKTURA.md). Nie zmieniaj `package.json` – zależności są już zainstalowane; jeśli czegoś brakuje, napisz to w raporcie.
- Nie commituj; commit robi szef.
