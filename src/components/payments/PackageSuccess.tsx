"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import type { PackageSessionResponse } from "@/lib/api-types";
import { apiFetch, rememberPackageCode } from "../api-client";
import { CheckIcon } from "../ui";

const POLL_INTERVAL_MS = 2000;
const POLL_MAX_MS = 60_000;

type State =
  | { kind: "polling" }
  | { kind: "ready"; code: string; uses: number }
  | { kind: "timeout" }
  | { kind: "error"; message: string };

export function PackageSuccess() {
  const searchParams = useSearchParams();
  const session = searchParams.get("session") ?? "";
  const [state, setState] = useState<State>({ kind: "polling" });
  const [attempt, setAttempt] = useState(0);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    let timer: number | undefined;
    const startedAt = Date.now();

    async function poll() {
      const r = await apiFetch<PackageSessionResponse>(`/api/packages/session?session=${encodeURIComponent(session)}`);
      if (cancelled) return;
      if (r.ok && r.data && r.data.ready === true && typeof r.data.code === "string") {
        rememberPackageCode(r.data.code);
        setState({ kind: "ready", code: r.data.code, uses: r.data.uses });
        return;
      }
      if (r.status === 400) {
        setState({
          kind: "error",
          message: r.error || "Nieprawidłowy identyfikator płatności. Otwórz stronę z linku, na który przekierował Cię operator płatności.",
        });
        return;
      }
      // ready: false, 404 (sesja jeszcze nieznana) albo chwilowy błąd – pytamy ponownie do skutku lub limitu czasu
      if (Date.now() - startedAt < POLL_MAX_MS) {
        timer = window.setTimeout(poll, POLL_INTERVAL_MS);
      } else {
        setState({ kind: "timeout" });
      }
    }
    void poll();

    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [session, attempt]);

  async function copy(code: string) {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      window.prompt("Skopiuj kod pakietu:", code);
    }
  }

  function retry() {
    setState({ kind: "polling" });
    setAttempt((a) => a + 1);
  }

  return (
    <div className="bg-navy-50/60">
      <div className="mx-auto w-full max-w-2xl px-4 py-12 sm:px-6 sm:py-16">
        {!session ? (
          <Box tone="warning" title="Brak identyfikatora płatności">
            Ten adres jest niepełny – brakuje w nim parametru „session”. Otwórz stronę z linku, na który przekierował
            Cię operator płatności, albo sprawdź e-mail z kodem.
          </Box>
        ) : state.kind === "polling" ? (
          <div role="status" aria-live="polite" className="rounded-2xl border border-navy-100 bg-white p-8 text-center shadow-sm">
            <span aria-hidden="true" className="mx-auto block h-12 w-12 animate-spin rounded-full border-4 border-navy-100 border-t-accent-400" />
            <h1 className="mt-5 text-2xl font-bold text-navy-900">Potwierdzamy płatność…</h1>
            <p className="mt-2 text-gray-600">Zwykle trwa to kilka sekund. Za chwilę zobaczysz swój kod pakietu.</p>
          </div>
        ) : state.kind === "ready" ? (
          <div className="rounded-2xl border border-navy-100 bg-white p-6 shadow-sm sm:p-8">
            <p className="flex items-center gap-2 text-sm font-semibold text-green-800">
              <CheckIcon className="h-5 w-5" /> Płatność przyjęta – dziękujemy!
            </p>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-navy-900 sm:text-3xl">Twój kod pakietu 5 pism</h1>
            <div className="mt-6 flex flex-col items-stretch gap-3 rounded-xl border-2 border-dashed border-accent-300 bg-accent-50 p-5 sm:flex-row sm:items-center sm:justify-between">
              <p
                className="break-all text-center font-mono text-3xl font-bold tracking-[0.15em] text-navy-950 sm:text-left sm:text-4xl"
                aria-label={`Kod: ${state.code}`}
              >
                {state.code}
              </p>
              <button
                type="button"
                onClick={() => copy(state.code)}
                className="shrink-0 rounded-lg bg-navy-800 px-5 py-3 font-semibold text-white hover:bg-navy-900"
              >
                {copied ? "Skopiowano ✓" : "Kopiuj"}
              </button>
            </div>
            <p className="mt-3 text-sm text-gray-600">
              Kod działa 5 razy – każde użycie odblokowuje jedno pismo. Pozostało użyć: <strong>{state.uses}</strong>.
              Zapisz go w bezpiecznym miejscu.
            </p>

            <h2 className="mt-8 text-lg font-semibold text-navy-900">Jak użyć kodu</h2>
            <ol className="mt-3 space-y-3 text-sm text-gray-700">
              {[
                "Wejdź na stronę dowolnego pisma i wypełnij formularz.",
                "Na stronie podglądu kliknij „Mam kod pakietu lub promocyjny”.",
                "Wpisz kod, zaznacz zgodę i kliknij „Odblokuj kodem” – pismo odblokuje się od razu.",
              ].map((step, i) => (
                <li key={step} className="flex gap-3">
                  <span aria-hidden="true" className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-navy-800 text-xs font-bold text-white">
                    {i + 1}
                  </span>
                  <span className="pt-0.5">{step}</span>
                </li>
              ))}
            </ol>
            <p className="mt-4 text-xs text-gray-500">
              W tej przeglądarce zapamiętamy kod i podpowiemy go przy odblokowywaniu kolejnego pisma.
            </p>
            <Link
              href="/#pisma"
              className="mt-8 inline-flex rounded-lg bg-accent-400 px-6 py-3 font-semibold text-navy-950 shadow-sm hover:bg-accent-300"
            >
              Wybierz pierwsze pismo
            </Link>
          </div>
        ) : state.kind === "timeout" ? (
          <Box tone="warning" title="Płatność jest przetwarzana">
            Nie otrzymaliśmy jeszcze potwierdzenia od operatora płatności. Sprawdź e-mail (jeśli go podałeś) albo
            odśwież stronę za chwilę.{" "}
            <button type="button" onClick={retry} className="font-semibold underline underline-offset-2">
              Sprawdź ponownie
            </button>
          </Box>
        ) : (
          <Box tone="error" title="Nie udało się pobrać kodu">
            {state.message}
          </Box>
        )}

        <p className="mt-8 text-center text-sm">
          <Link href="/" className="font-medium text-navy-700 underline underline-offset-2 hover:text-navy-900">
            Wróć na stronę główną
          </Link>
        </p>
      </div>
    </div>
  );
}

function Box({ tone, title, children }: { tone: "warning" | "error"; title: string; children: React.ReactNode }) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={`rounded-2xl border p-6 sm:p-8 ${tone === "error" ? "border-red-200 bg-red-50" : "border-accent-300 bg-accent-50"}`}
    >
      <h1 className="text-xl font-bold text-navy-900">{title}</h1>
      <p className="mt-2 leading-relaxed text-gray-700">{children}</p>
    </div>
  );
}

export function PackageSuccessSkeleton() {
  return (
    <div className="bg-navy-50/60" aria-busy="true">
      <div className="mx-auto w-full max-w-2xl px-4 py-12 sm:px-6 sm:py-16">
        <div className="h-56 animate-pulse rounded-2xl bg-white ring-1 ring-navy-100" />
      </div>
    </div>
  );
}
