"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { PrefillResponse } from "@/lib/api-types";
import { apiFetch } from "../api-client";
import { pluralPl } from "../format-pl";

const MAX_FILE_BYTES = 8 * 1024 * 1024;
const MAX_TEXT_LENGTH = 20000;
const REQUEST_TIMEOUT_MS = 90_000;
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
const ACCEPTED_EXT = /\.(jpe?g|png|webp|pdf)$/i;
const ACCEPT_ATTR = "image/jpeg,image/png,image/webp,application/pdf,.jpg,.jpeg,.png,.webp,.pdf";

const LOADING_STEPS = [
  "Czytamy dokument…",
  "Szukamy dat, kwot i danych stron…",
  "Dopasowujemy dane do pól formularza…",
  "Jeszcze chwila – dokładnie sprawdzamy treść…",
];

export interface PrefillApplyResult {
  filled: number;
  skippedFilledByUser: number;
}

interface Props {
  slug: string;
  disabled?: boolean;
  /** wstawia odpowiedzi do kreatora i zwraca, ile pól faktycznie wypełniono */
  onPrefill: (response: PrefillResponse) => PrefillApplyResult;
}

type Status =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "done"; filled: number; skipped: number };

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1).replace(".", ",")} MB`;
}

function validateFile(file: File): string | null {
  const typeOk = ACCEPTED_TYPES.includes(file.type) || (!file.type && ACCEPTED_EXT.test(file.name));
  if (!typeOk) return "Ten format pliku nie jest obsługiwany. Wgraj zdjęcie JPG, PNG lub WEBP albo plik PDF.";
  if (file.size > MAX_FILE_BYTES) return `Plik ma ${formatSize(file.size)} – maksymalnie 8 MB. Zrób zdjęcie w niższej rozdzielczości albo wklej tekst.`;
  if (file.size === 0) return "Plik jest pusty. Wybierz inny plik.";
  return null;
}

function errorMessage(status: number, apiError: string | null, networkError: boolean): string {
  if (networkError) return "Brak połączenia z serwerem albo odczyt trwał zbyt długo. Sprawdź internet i spróbuj ponownie.";
  switch (status) {
    case 503:
      return "Odczytywanie dokumentów jest chwilowo niedostępne. Wypełnij formularz ręcznie – zajmie to tylko kilka minut.";
    case 429:
      return "Osiągnięto limit odczytów dokumentów (10 na godzinę). Spróbuj ponownie później albo wypełnij formularz ręcznie.";
    case 413:
      return "Plik jest za duży – maksymalnie 8 MB. Zrób zdjęcie w niższej rozdzielczości albo wklej tekst.";
    case 400:
      return apiError || "Nie udało się odczytać pliku. Użyj zdjęcia JPG, PNG lub WEBP albo pliku PDF.";
    case 404:
    case 405:
      return "Ta funkcja jest chwilowo niedostępna. Wypełnij formularz ręcznie.";
    default:
      return apiError || "Nie udało się odczytać dokumentu. Spróbuj ponownie albo wypełnij formularz ręcznie.";
  }
}

/** Panel „wypełnij formularz z dokumentu” (zdjęcie / PDF / wklejony tekst → POST /api/prefill). */
export function PrefillPanel({ slug, disabled = false, onPrefill }: Props) {
  const uid = useId();
  const fileInputId = `${uid}-plik`;
  const cameraInputId = `${uid}-aparat`;
  const textId = `${uid}-tekst`;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState("");
  const [showText, setShowText] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [loadingStep, setLoadingStep] = useState(0);

  useEffect(() => {
    if (status.kind !== "loading") return;
    const t = window.setInterval(() => setLoadingStep((s) => Math.min(s + 1, LOADING_STEPS.length - 1)), 5000);
    return () => window.clearInterval(t);
  }, [status.kind]);

  useEffect(() => () => abortRef.current?.abort(), []);

  function pickFile(f: File | null | undefined) {
    if (!f) return;
    const err = validateFile(f);
    if (err) {
      setFile(null);
      setStatus({ kind: "error", message: err });
      return;
    }
    setFile(f);
    setStatus({ kind: "idle" });
  }

  function clearFile() {
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (cameraInputRef.current) cameraInputRef.current.value = "";
  }

  async function submit() {
    if (status.kind === "loading" || disabled) return;
    const trimmed = text.trim();
    if (!file && !trimmed) {
      setStatus({ kind: "error", message: "Wybierz plik albo wklej tekst dokumentu." });
      return;
    }
    if (trimmed.length > MAX_TEXT_LENGTH) {
      setStatus({ kind: "error", message: `Wklejony tekst jest za długi (maks. ${MAX_TEXT_LENGTH.toLocaleString("pl-PL")} znaków).` });
      return;
    }

    const form = new FormData();
    form.append("slug", slug);
    if (file) form.append("file", file, file.name);
    if (trimmed) form.append("text", trimmed);

    const controller = new AbortController();
    abortRef.current = controller;
    const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    setLoadingStep(0);
    setStatus({ kind: "loading" });

    const res = await apiFetch<PrefillResponse>("/api/prefill", {
      method: "POST",
      body: form,
      signal: controller.signal,
    });
    window.clearTimeout(timeout);
    if (controller.signal.aborted && abortRef.current !== controller) return; // odmontowano
    abortRef.current = null;

    if (!res.ok || !res.data || typeof res.data !== "object" || !res.data.answers) {
      setStatus({ kind: "error", message: errorMessage(res.status, res.error, res.networkError) });
      return;
    }

    const applied = onPrefill(res.data);
    if (applied.filled === 0 && applied.skippedFilledByUser === 0) {
      setStatus({
        kind: "error",
        message:
          "Nie znaleźliśmy w dokumencie danych pasujących do tego formularza. Spróbuj wyraźniejszego zdjęcia albo wypełnij pola ręcznie.",
      });
      return;
    }
    setStatus({ kind: "done", filled: applied.filled, skipped: applied.skippedFilledByUser });
    clearFile();
    setText("");
    setShowText(false);
  }

  const loading = status.kind === "loading";

  if (status.kind === "done") {
    const n = status.filled;
    return (
      <div role="status" className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-900">
        <p className="font-semibold">
          {n > 0
            ? `Wypełniliśmy ${n} ${pluralPl(n, "pole", "pola", "pól")} – sprawdź je, zanim przejdziesz dalej.`
            : "Nie wypełniliśmy żadnego nowego pola."}
        </p>
        <p className="mt-1 text-green-800">
          Pola z dokumentu (także w kolejnych krokach) mają oznaczenie <span className="rounded bg-accent-100 px-1.5 py-0.5 text-xs font-semibold text-accent-800">z dokumentu</span>.
          {status.skipped > 0
            ? ` ${status.skipped} ${pluralPl(status.skipped, "pole pominęliśmy", "pola pominęliśmy", "pól pominęliśmy")}, bo ${status.skipped === 1 ? "było" : "były"} już wypełnione przez Ciebie.`
            : ""}{" "}
          Odczyt może zawierać błędy – popraw je przed przygotowaniem pisma.
        </p>
        <button
          type="button"
          onClick={() => setStatus({ kind: "idle" })}
          className="mt-2 text-sm font-medium text-green-900 underline underline-offset-2 hover:no-underline"
        >
          Wgraj inny dokument
        </button>
      </div>
    );
  }

  return (
    <section
      aria-labelledby={`${uid}-tytul`}
      aria-busy={loading}
      className="relative overflow-hidden rounded-xl border border-accent-200 bg-accent-50/70 p-4 sm:p-5"
    >
      <div className="flex items-start gap-3">
        <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent-400 text-navy-950">
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8zM14 3v5h5M9 13h6M9 17h4" />
          </svg>
        </span>
        <div className="min-w-0">
          <h4 id={`${uid}-tytul`} className="font-semibold text-navy-900">
            Masz wezwanie, umowę lub paragon?
          </h4>
          <p className="mt-0.5 text-sm text-gray-700">Wgraj zdjęcie lub wklej tekst – wypełnimy formularz za Ciebie.</p>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {file ? (
          <div className="flex items-center justify-between gap-3 rounded-lg border border-navy-200 bg-white px-3 py-2.5 text-sm">
            <span className="min-w-0 truncate">
              <span className="font-medium text-navy-900">{file.name}</span>{" "}
              <span className="text-gray-500">({formatSize(file.size)})</span>
            </span>
            <button
              type="button"
              onClick={clearFile}
              disabled={loading}
              className="shrink-0 rounded px-2 py-1 text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-navy-900"
            >
              Usuń
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-2 sm:flex-row">
            <label
              htmlFor={fileInputId}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                pickFile(e.dataTransfer.files?.[0]);
              }}
              className={`flex flex-1 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-4 py-4 text-center text-sm transition-colors ${
                dragOver ? "border-navy-600 bg-navy-50" : "border-accent-300 bg-white hover:border-navy-400"
              }`}
            >
              <span className="text-navy-900">
                <span className="hidden sm:inline">Przeciągnij plik tutaj lub </span>
                <span className="font-semibold text-navy-800 underline underline-offset-2">wybierz plik</span>
              </span>
              <span className="mt-0.5 text-xs text-gray-500">JPG, PNG, WEBP lub PDF, do 8 MB</span>
            </label>
            <label
              htmlFor={cameraInputId}
              className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-navy-200 bg-white px-4 py-3 text-sm font-semibold text-navy-900 hover:bg-navy-50 sm:hidden"
            >
              <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 8h3l2-3h6l2 3h3v11H4zM12 17a4 4 0 100-8 4 4 0 000 8z" />
              </svg>
              Zrób zdjęcie
            </label>
            <input
              ref={fileInputRef}
              id={fileInputId}
              type="file"
              accept={ACCEPT_ATTR}
              className="sr-only"
              disabled={loading || disabled}
              onChange={(e) => pickFile(e.target.files?.[0])}
            />
            <input
              ref={cameraInputRef}
              id={cameraInputId}
              type="file"
              accept="image/*"
              capture="environment"
              className="sr-only"
              tabIndex={-1}
              disabled={loading || disabled}
              onChange={(e) => pickFile(e.target.files?.[0])}
            />
          </div>
        )}

        {showText ? (
          <div>
            <label htmlFor={textId} className="block text-sm font-medium text-navy-900">
              Wklej tekst dokumentu
            </label>
            <textarea
              id={textId}
              rows={5}
              value={text}
              maxLength={MAX_TEXT_LENGTH}
              disabled={loading}
              onChange={(e) => setText(e.target.value)}
              placeholder="Np. treść e-maila od sprzedawcy, wezwania do zapłaty albo fragment umowy…"
              className="mt-1.5 block w-full resize-y rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm leading-relaxed text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-navy-600 focus:outline-none focus:ring-4 focus:ring-navy-100"
            />
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowText(true)}
            className="text-sm font-medium text-navy-800 underline underline-offset-2 hover:text-navy-950"
          >
            lub wklej tekst
          </button>
        )}

        {status.kind === "error" ? (
          <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            {status.message}
          </p>
        ) : null}

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            onClick={submit}
            disabled={loading || disabled}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-navy-800 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-navy-900 disabled:cursor-wait disabled:opacity-70"
          >
            Wypełnij formularz
          </button>
          <p className="flex items-start gap-1.5 text-xs text-gray-600">
            <svg aria-hidden="true" viewBox="0 0 24 24" className="mt-px h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="4" y="11" width="16" height="10" rx="2" />
              <path d="M8 11V7a4 4 0 018 0v4" />
            </svg>
            Plik służy tylko do odczytania danych i nie jest zapisywany.
          </p>
        </div>
      </div>

      {loading ? (
        <div
          role="status"
          aria-live="polite"
          className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-accent-50/95 px-6 text-center backdrop-blur-[2px]"
        >
          <span aria-hidden="true" className="h-10 w-10 animate-spin rounded-full border-4 border-accent-200 border-t-navy-800" />
          <p className="mt-3 font-semibold text-navy-900">{LOADING_STEPS[loadingStep]}</p>
          <p className="mt-1 text-xs text-gray-600">To może potrwać 10–30 sekund. Nie zamykaj strony.</p>
          <button
            type="button"
            onClick={() => {
              abortRef.current?.abort();
              abortRef.current = null;
              setStatus({ kind: "idle" });
            }}
            className="mt-3 text-xs font-medium text-navy-800 underline underline-offset-2"
          >
            Anuluj
          </button>
        </div>
      ) : null}
    </section>
  );
}
