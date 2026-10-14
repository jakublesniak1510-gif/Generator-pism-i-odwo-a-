"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { ApiError, CreateDocumentResponse } from "@/lib/api-types";
import type { QuestionSection } from "@/lib/templates/types";
import { formatPrice } from "../site";
import { QuestionField, fieldDomId } from "./QuestionField";
import {
  type FormValues,
  clearStoredState,
  indexQuestions,
  isVisible,
  loadStoredState,
  saveStoredState,
  serializeAnswers,
  validateSection,
} from "./wizard-logic";

export interface LetterWizardProps {
  slug: string;
  templateName: string;
  sections: QuestionSection[];
  priceGrosze: number;
}

const noopSubscribe = () => () => {};

/**
 * Kreator pisma. Zewnętrzny komponent czeka na hydratację (żeby nie było rozjazdu
 * SSR ↔ sessionStorage), po czym montuje kreator z zapisanymi odpowiedziami.
 */
export function LetterWizard(props: LetterWizardProps) {
  const isClient = useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
  const initial = isClient ? loadStoredState(props.slug) : null;
  return (
    <WizardInner
      key={isClient ? "client" : "server"}
      {...props}
      persist={isClient}
      initialValues={initial?.values}
      initialStep={initial?.step}
    />
  );
}

const LOADING_MESSAGES = [
  "Sprawdzamy Twoje odpowiedzi…",
  "Wstawiamy podstawy prawne z szablonu…",
  "Redagujemy opis sytuacji…",
  "Składamy gotowy dokument…",
];

type SubmitError = { message: string; retryable: boolean } | null;

function WizardInner({
  slug,
  templateName,
  sections,
  priceGrosze,
  initialValues,
  initialStep,
  persist,
}: LetterWizardProps & { initialValues?: FormValues; initialStep?: number; persist: boolean }) {
  const router = useRouter();
  const allQuestions = useMemo(() => indexQuestions(sections), [sections]);
  const lastStep = Math.max(0, sections.length - 1);

  const [values, setValues] = useState<FormValues>(() => initialValues ?? {});
  const [step, setStep] = useState(() => Math.min(Math.max(0, initialStep ?? 0), lastStep));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<SubmitError>(null);
  const [loadingMsg, setLoadingMsg] = useState(0);

  const headingRef = useRef<HTMLHeadingElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const pendingFocus = useRef<"heading" | string | null>(null);

  // Zapis odpowiedzi w sessionStorage – odświeżenie strony ich nie kasuje.
  // Instancja z renderu serwerowego (przed hydratacją) nie zapisuje – nadpisałaby zapisane dane pustymi.
  useEffect(() => {
    if (!persist) return;
    saveStoredState(slug, { values, step });
  }, [persist, slug, values, step]);

  // Po zmianie kroku / błędach: przenieś fokus (nagłówek kroku lub pierwsze błędne pole).
  useEffect(() => {
    const target = pendingFocus.current;
    if (!target) return;
    pendingFocus.current = null;
    if (target === "heading") {
      rootRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      headingRef.current?.focus({ preventScroll: true });
      return;
    }
    const el = document.getElementById(fieldDomId(target));
    const focusable = el?.tagName === "LEGEND" ? el.parentElement?.querySelector<HTMLInputElement>("input") : el;
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
    focusable?.focus({ preventScroll: true });
  }, [step, errors]);

  // Zmieniające się komunikaty w trakcie generowania.
  useEffect(() => {
    if (!submitting) return;
    const t = window.setInterval(() => setLoadingMsg((m) => (m + 1) % LOADING_MESSAGES.length), 2500);
    return () => window.clearInterval(t);
  }, [submitting]);

  if (sections.length === 0) {
    return (
      <div className="rounded-xl border border-navy-100 bg-white p-6 text-gray-700">
        Kwestionariusz dla tego pisma jest w przygotowaniu.
      </div>
    );
  }

  const section = sections[step];
  const visibleQuestions = section.questions.filter((q) => isVisible(q, values, allQuestions));
  const progress = Math.round(((step + 1) / sections.length) * 100);

  function setValue(id: string, v: string | boolean) {
    setValues((prev) => ({ ...prev, [id]: v }));
    if (errors[id]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }
  }

  function goTo(nextStep: number) {
    pendingFocus.current = "heading";
    setStep(nextStep);
    setSubmitError(null);
  }

  function validateCurrent(): boolean {
    const errs = validateSection(section, values, allQuestions);
    const ids = Object.keys(errs);
    setErrors(errs);
    if (ids.length) {
      const first = section.questions.find((q) => errs[q.id]);
      pendingFocus.current = first?.id ?? ids[0];
      return false;
    }
    return true;
  }

  function handleBack() {
    if (step > 0) {
      setErrors({});
      goTo(step - 1);
    }
  }

  function handleReset() {
    if (!window.confirm("Wyczyścić wszystkie odpowiedzi i zacząć od nowa?")) return;
    clearStoredState(slug);
    setValues({});
    setErrors({});
    setSubmitError(null);
    goTo(0);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting) return;
    if (!validateCurrent()) return;
    if (step < lastStep) {
      goTo(step + 1);
      return;
    }

    // Ostatni krok – walidujemy wszystko jeszcze raz (np. po zmianie showIf).
    for (let i = 0; i < sections.length; i++) {
      const errs = validateSection(sections[i], values, allQuestions);
      if (Object.keys(errs).length) {
        setErrors(errs);
        pendingFocus.current = sections[i].questions.find((q) => errs[q.id])?.id ?? null;
        setStep(i);
        return;
      }
    }

    setSubmitting(true);
    setSubmitError(null);
    setLoadingMsg(0);

    try {
      const res = await fetch("/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, answers: serializeAnswers(sections, values) }),
      });

      let data: unknown = null;
      try {
        data = await res.json();
      } catch {
        data = null;
      }

      if (res.ok && data && typeof data === "object" && "id" in data && "token" in data) {
        const doc = data as CreateDocumentResponse;
        router.push(`/dokument/${encodeURIComponent(doc.id)}?token=${encodeURIComponent(doc.token)}`);
        return; // zostawiamy stan ładowania do czasu nawigacji
      }

      const apiError = (data && typeof data === "object" ? data : {}) as Partial<ApiError>;

      if (res.status === 400 && apiError.fieldErrors && Object.keys(apiError.fieldErrors).length) {
        const fe = apiError.fieldErrors;
        const stepWithError = sections.findIndex((s) => s.questions.some((q) => fe[q.id]));
        if (stepWithError >= 0) {
          const sectionErrors: Record<string, string> = {};
          for (const q of sections[stepWithError].questions) if (fe[q.id]) sectionErrors[q.id] = fe[q.id];
          setErrors(sectionErrors);
          pendingFocus.current = sections[stepWithError].questions.find((q) => fe[q.id])?.id ?? null;
          setStep(stepWithError);
          setSubmitError({ message: "Popraw zaznaczone pola i spróbuj ponownie.", retryable: false });
        } else {
          setSubmitError({
            message: apiError.error || "Część odpowiedzi jest niepoprawna. Sprawdź dane i spróbuj ponownie.",
            retryable: false,
          });
        }
      } else if (res.status === 429) {
        setSubmitError({
          message: "Wysłano zbyt wiele próśb w krótkim czasie. Odczekaj chwilę i spróbuj ponownie.",
          retryable: true,
        });
      } else if (res.status === 404 && !apiError.error) {
        setSubmitError({
          message: "Usługa generowania pism jest chwilowo niedostępna. Spróbuj ponownie za kilka minut.",
          retryable: true,
        });
      } else {
        setSubmitError({
          message: apiError.error || "Nie udało się przygotować pisma. Spróbuj ponownie za chwilę.",
          retryable: true,
        });
      }
    } catch {
      setSubmitError({
        message: "Brak połączenia z serwerem. Sprawdź internet i spróbuj ponownie.",
        retryable: true,
      });
    }
    setSubmitting(false);
  }

  const isLast = step === lastStep;

  return (
    <div ref={rootRef} className="scroll-mt-24">
      <div className="relative overflow-hidden rounded-2xl border border-navy-100 bg-white shadow-lg shadow-navy-900/5">
        {/* Pasek postępu */}
        <div className="border-b border-navy-100 bg-navy-50/60 px-5 py-4 sm:px-8">
          <div className="flex items-center justify-between gap-3 text-sm">
            <p className="font-medium text-navy-800">
              Krok {step + 1} z {sections.length}
            </p>
            <p className="text-gray-500">{templateName}</p>
          </div>
          <div
            className="mt-3 h-2 overflow-hidden rounded-full bg-navy-100"
            role="progressbar"
            aria-label="Postęp wypełniania"
            aria-valuemin={1}
            aria-valuemax={sections.length}
            aria-valuenow={step + 1}
            aria-valuetext={`Krok ${step + 1} z ${sections.length}: ${section.title}`}
          >
            <div className="h-full rounded-full bg-accent-400 transition-all duration-300" style={{ width: `${progress}%` }} />
          </div>
          <ol className="mt-3 hidden flex-wrap gap-x-4 gap-y-1 text-xs sm:flex" aria-label="Etapy">
            {sections.map((s, i) => (
              <li
                key={s.id}
                aria-current={i === step ? "step" : undefined}
                className={i === step ? "font-semibold text-navy-900" : i < step ? "text-navy-600" : "text-gray-400"}
              >
                {i < step ? "✓ " : ""}
                {s.title}
              </li>
            ))}
          </ol>
        </div>

        <form noValidate onSubmit={handleSubmit} className="px-5 py-6 sm:px-8 sm:py-8" aria-busy={submitting}>
          <h3
            ref={headingRef}
            tabIndex={-1}
            className="text-xl font-semibold text-navy-900 focus:outline-none"
          >
            {section.title}
          </h3>
          {section.description ? <p className="mt-1.5 text-gray-600">{section.description}</p> : null}

          <fieldset disabled={submitting} className="mt-6 space-y-6">
            <legend className="sr-only">{section.title}</legend>
            {visibleQuestions.map((q) => (
              <QuestionField
                key={q.id}
                question={q}
                value={values[q.id]}
                error={errors[q.id]}
                onChange={(v) => setValue(q.id, v)}
              />
            ))}
          </fieldset>

          <p className="mt-6 text-xs text-gray-500">
            <span className="text-red-600" aria-hidden="true">
              *
            </span>{" "}
            pole wymagane. Odpowiedzi są zapisywane tylko w tej karcie przeglądarki.
          </p>

          {submitError ? (
            <div role="alert" className="mt-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
              <p className="font-semibold">Nie udało się przygotować pisma</p>
              <p className="mt-1">{submitError.message}</p>
            </div>
          ) : null}

          {isLast ? (
            <p className="mt-6 rounded-lg bg-navy-50 p-4 text-sm text-navy-900">
              Za chwilę zobaczysz <strong>bezpłatny podgląd</strong> pisma. Pełny dokument (DOCX i PDF) z instrukcją
              wysyłki odblokujesz za {formatPrice(priceGrosze)}.
            </p>
          ) : null}

          <div className="mt-6 flex flex-col-reverse gap-3 border-t border-navy-100 pt-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              {step > 0 ? (
                <button
                  type="button"
                  onClick={handleBack}
                  disabled={submitting}
                  className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg border border-gray-300 bg-white px-5 py-3 font-medium text-navy-900 transition-colors hover:bg-gray-50 disabled:opacity-50 sm:flex-none"
                >
                  <span aria-hidden="true">←</span> Wstecz
                </button>
              ) : null}
              <button
                type="button"
                onClick={handleReset}
                disabled={submitting}
                className="px-2 py-3 text-sm text-gray-500 underline-offset-2 hover:text-navy-800 hover:underline disabled:opacity-50"
              >
                Zacznij od nowa
              </button>
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-accent-400 px-6 py-3 font-semibold text-navy-950 shadow-sm transition-colors hover:bg-accent-300 disabled:cursor-wait disabled:opacity-70"
            >
              {isLast ? (submitting ? "Przygotowujemy…" : "Przygotuj pismo") : "Dalej"}
              {!isLast ? <span aria-hidden="true">→</span> : null}
            </button>
          </div>
        </form>

        {submitting ? (
          <div
            className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-white/90 px-6 text-center backdrop-blur-sm"
            role="status"
            aria-live="polite"
          >
            <span
              aria-hidden="true"
              className="h-12 w-12 animate-spin rounded-full border-4 border-navy-100 border-t-accent-400"
            />
            <p className="mt-5 text-lg font-semibold text-navy-900">Składamy Twoje pismo…</p>
            <p className="mt-1 text-sm text-gray-600">To potrwa od kilku do kilkunastu sekund. Nie zamykaj strony.</p>
            <p className="mt-4 text-sm font-medium text-navy-700">{LOADING_MESSAGES[loadingMsg]}</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
