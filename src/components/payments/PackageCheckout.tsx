"use client";

import { useId, useState } from "react";
import type { PackageCheckoutResponse } from "@/lib/api-types";
import { apiSend } from "../api-client";
import { PRICES, formatPrice } from "../site";
import { ConsentCheckbox } from "./ConsentCheckbox";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Zakup pakietu 5 pism: zgoda + opcjonalny e-mail → POST /api/packages/checkout → przekierowanie. */
export function PackageCheckout() {
  const uid = useId();
  const [consent, setConsent] = useState(false);
  const [consentInvalid, setConsentInvalid] = useState(false);
  const [email, setEmail] = useState("");
  const [state, setState] = useState<{ loading: boolean; error: string | null; emailError: string | null }>({
    loading: false,
    error: null,
    emailError: null,
  });

  async function buy(e: React.FormEvent) {
    e.preventDefault();
    if (state.loading) return;
    const address = email.trim();
    if (address && !EMAIL_RE.test(address)) {
      setState({ loading: false, error: null, emailError: "Podaj poprawny adres e-mail albo zostaw pole puste." });
      return;
    }
    if (!consent) {
      setConsentInvalid(true);
      setState({
        loading: false,
        error: "Zaznacz zgodę na natychmiastowe dostarczenie treści cyfrowej, aby przejść do płatności.",
        emailError: null,
      });
      return;
    }
    setState({ loading: true, error: null, emailError: null });
    const r = await apiSend<PackageCheckoutResponse>("POST", "/api/packages/checkout", {
      consent: true,
      ...(address ? { email: address } : {}),
    });
    if (r.ok && r.data && typeof r.data.url === "string") {
      window.location.assign(r.data.url);
      return;
    }
    let message: string;
    if (r.networkError) message = "Brak połączenia z serwerem. Spróbuj ponownie.";
    else if (r.status === 404 || r.status === 405 || r.status === 503)
      message = r.error && r.status === 503 ? r.error : "Zakup pakietu jest chwilowo niedostępny. Spróbuj ponownie później.";
    else if (r.status === 429) message = "Zbyt wiele prób. Odczekaj chwilę i spróbuj ponownie.";
    else message = r.error || "Nie udało się rozpocząć płatności. Spróbuj ponownie za chwilę.";
    if (r.fieldErrors?.email) {
      setState({ loading: false, error: null, emailError: r.fieldErrors.email });
      return;
    }
    setState({ loading: false, error: message, emailError: null });
  }

  return (
    <form onSubmit={buy} noValidate className="space-y-4">
      <div>
        <label htmlFor={`${uid}-email`} className="block text-sm font-semibold text-navy-900">
          E-mail <span className="font-normal text-gray-500">(opcjonalnie)</span>
        </label>
        <p id={`${uid}-email-pomoc`} className="mt-0.5 text-sm text-gray-600">
          Wyślemy kod także na e-mail – przyda się, gdy zamkniesz stronę.
        </p>
        <input
          id={`${uid}-email`}
          type="email"
          inputMode="email"
          autoComplete="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (state.emailError) setState((s) => ({ ...s, emailError: null }));
          }}
          placeholder="jan@przyklad.pl"
          aria-invalid={state.emailError ? true : undefined}
          aria-describedby={`${uid}-email-pomoc${state.emailError ? ` ${uid}-email-blad` : ""}`}
          className="mt-2 block w-full max-w-md rounded-lg border border-gray-300 bg-white px-3.5 py-2.5 text-base text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-navy-600 focus:outline-none focus:ring-4 focus:ring-navy-100"
        />
        {state.emailError ? (
          <p id={`${uid}-email-blad`} className="mt-1.5 text-sm font-medium text-red-700">
            {state.emailError}
          </p>
        ) : null}
      </div>

      <ConsentCheckbox
        checked={consent}
        onChange={(v) => {
          setConsent(v);
          if (v) setConsentInvalid(false);
        }}
        invalid={consentInvalid}
        className="max-w-2xl"
      />

      {state.error ? (
        <p role="alert" className="text-sm font-medium text-red-700">
          {state.error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={state.loading}
        className="inline-flex items-center justify-center gap-2 rounded-lg bg-accent-400 px-6 py-3 font-semibold text-navy-950 shadow-sm transition-colors hover:bg-accent-300 disabled:cursor-wait disabled:opacity-70"
      >
        {state.loading ? (
          <>
            <span aria-hidden="true" className="h-4 w-4 animate-spin rounded-full border-2 border-navy-900/30 border-t-navy-900" />
            Przekierowujemy do płatności…
          </>
        ) : (
          `Kup pakiet – ${formatPrice(PRICES.pack5)}`
        )}
      </button>
      <p className="text-xs text-gray-500">Płatność kartą, BLIK lub szybkim przelewem. Kod zobaczysz zaraz po płatności.</p>
    </form>
  );
}
