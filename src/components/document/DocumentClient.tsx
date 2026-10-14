"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import type { ApiError, CheckoutResponse, GetDocumentResponse, RedeemResponse } from "@/lib/api-types";
import type { Instructions, Paragraph } from "@/lib/templates/types";
import { apiSend, forgetPackageCode, recallPackageCode, rememberPackageCode, useCapabilities } from "../api-client";
import { pluralPl } from "../format-pl";
import { LegalBasisList } from "../LegalBasisList";
import { Markdown } from "../Markdown";
import { formatPrice } from "../site";
import { ConsentCheckbox } from "../payments/ConsentCheckbox";
import { CheckIcon } from "../ui";
import { DeadlineList } from "./DeadlineList";
import { LetterEditor } from "./LetterEditor";
import { LetterView } from "./LetterView";

type LoadState =
  | { kind: "loading" }
  | { kind: "ready"; data: GetDocumentResponse }
  | { kind: "error"; title: string; message: string; retryable: boolean };

const POLL_INTERVAL_MS = 2000;
const POLL_MAX_MS = 30000;

async function fetchDocument(id: string, token: string): Promise<LoadState> {
  try {
    const res = await fetch(`/api/documents/${encodeURIComponent(id)}?token=${encodeURIComponent(token)}`, {
      cache: "no-store",
    });
    let data: unknown = null;
    try {
      data = await res.json();
    } catch {
      data = null;
    }
    if (res.ok && data && typeof data === "object" && "document" in data) {
      return { kind: "ready", data: data as GetDocumentResponse };
    }
    const apiError = (data && typeof data === "object" ? data : {}) as Partial<ApiError>;
    if (res.status === 401 || res.status === 403) {
      return {
        kind: "error",
        title: "Nieprawidłowy link",
        message: "Link do pisma jest niepełny lub nieprawidłowy. Upewnij się, że skopiowałeś go w całości.",
        retryable: false,
      };
    }
    if (res.status === 404) {
      return {
        kind: "error",
        title: "Nie znaleźliśmy tego pisma",
        message:
          apiError.error ||
          "Dokument nie istnieje albo został już usunięty. Sprawdź, czy link jest poprawny, lub przygotuj pismo ponownie.",
        retryable: false,
      };
    }
    if (res.status === 429) {
      return {
        kind: "error",
        title: "Zbyt wiele zapytań",
        message: "Odczekaj chwilę i spróbuj ponownie.",
        retryable: true,
      };
    }
    return {
      kind: "error",
      title: "Nie udało się wczytać pisma",
      message: apiError.error || "Wystąpił błąd serwera. Spróbuj ponownie za chwilę.",
      retryable: true,
    };
  } catch {
    return {
      kind: "error",
      title: "Brak połączenia",
      message: "Nie udało się połączyć z serwerem. Sprawdź internet i spróbuj ponownie.",
      retryable: true,
    };
  }
}

export function DocumentClient({ id }: { id: string }) {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const paidFlag = searchParams.get("paid") === "1";

  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [pollingExpired, setPollingExpired] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    let timer: number | undefined;
    const startedAt = Date.now();

    async function load() {
      const result = await fetchDocument(id, token);
      if (cancelled) return;
      setState(result);
      // Po powrocie z płatności webhook może jeszcze nie dotrzeć – odpytujemy co 2 s, max 30 s.
      if (paidFlag && result.kind === "ready" && result.data.status === "preview") {
        if (Date.now() - startedAt < POLL_MAX_MS) {
          timer = window.setTimeout(load, POLL_INTERVAL_MS);
        } else {
          setPollingExpired(true);
        }
      }
    }
    void load();

    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [id, token, paidFlag, reloadKey]);

  /** Ciche odświeżenie (bez szkieletu ładowania) – np. po odblokowaniu kodem. */
  async function refresh(): Promise<boolean> {
    const result = await fetchDocument(id, token);
    if (result.kind === "ready") {
      setState(result);
      return true;
    }
    return false;
  }

  function retry() {
    setState({ kind: "loading" });
    setPollingExpired(false);
    setReloadKey((k) => k + 1);
  }

  if (!token) {
    return (
      <ErrorBox
        title="Brak tokenu dostępu"
        message="Link do pisma jest niepełny – brakuje w nim parametru „token”. Otwórz pełny link, który otrzymałeś po przygotowaniu pisma."
      />
    );
  }

  if (state.kind === "loading") return <DocumentSkeleton />;
  if (state.kind === "error") {
    return <ErrorBox title={state.title} message={state.message} onRetry={state.retryable ? retry : undefined} />;
  }

  return (
    <DocumentReady
      data={state.data}
      id={id}
      token={token}
      paidFlag={paidFlag}
      pollingExpired={pollingExpired}
      onRetry={retry}
      onDataChange={(d) => setState({ kind: "ready", data: d })}
      onRefresh={refresh}
    />
  );
}

type Notice = { tone: "success" | "info" | "warning"; title: string; text: string } | null;

function DocumentReady({
  data,
  id,
  token,
  paidFlag,
  pollingExpired,
  onRetry,
  onDataChange,
  onRefresh,
}: {
  data: GetDocumentResponse;
  id: string;
  token: string;
  paidFlag: boolean;
  pollingExpired: boolean;
  onRetry: () => void;
  onDataChange: (data: GetDocumentResponse) => void;
  onRefresh: () => Promise<boolean>;
}) {
  const paid = data.status === "paid";
  const [checkout, setCheckout] = useState<{ loading: boolean; error: string | null }>({
    loading: false,
    error: null,
  });
  const [consent, setConsent] = useState(false);
  const [consentInvalid, setConsentInvalid] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const [editing, setEditing] = useState(false);
  const [edit, setEdit] = useState<{ saving: boolean; error: string | null }>({ saving: false, error: null });
  /** licznik zapisów – dopisywany do linków pobierania, żeby przeglądarka nie podała starej wersji z cache */
  const [revision, setRevision] = useState(0);
  const noticeRef = useRef<HTMLDivElement>(null);

  function showNotice(n: Notice) {
    setNotice(n);
    window.setTimeout(() => noticeRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 50);
  }

  function changeConsent(v: boolean) {
    setConsent(v);
    if (v) setConsentInvalid(false);
  }

  async function startCheckout() {
    if (checkout.loading) return;
    if (!consent) {
      setConsentInvalid(true);
      setCheckout({ loading: false, error: "Zaznacz zgodę na natychmiastowe dostarczenie pisma, aby przejść do płatności." });
      return;
    }
    setCheckout({ loading: true, error: null });
    const r = await apiSend<CheckoutResponse>("POST", `/api/documents/${encodeURIComponent(id)}/checkout`, {
      token,
      consent: true,
    });
    if (r.ok && r.data && typeof r.data.url === "string") {
      window.location.assign(r.data.url);
      return;
    }
    setCheckout({
      loading: false,
      error: r.networkError
        ? "Brak połączenia z serwerem. Spróbuj ponownie."
        : r.status === 429
          ? "Zbyt wiele prób. Odczekaj chwilę i spróbuj ponownie."
          : r.error || "Nie udało się rozpocząć płatności. Spróbuj ponownie za chwilę.",
    });
  }

  async function handleRedeemed(remaining: number) {
    setCheckout({ loading: false, error: null });
    await onRefresh();
    showNotice({
      tone: "success",
      title: "Odblokowano kodem.",
      text: `Pozostało użyć: ${remaining}. Pobierz pismo w formacie DOCX lub PDF i sprawdź instrukcję wysyłki poniżej.`,
    });
  }

  async function saveEdits(paragraphs: Paragraph[], attachments: string[]) {
    setEdit({ saving: true, error: null });
    const r = await apiSend<GetDocumentResponse>("PATCH", `/api/documents/${encodeURIComponent(id)}`, {
      token,
      paragraphs,
      attachments,
    });
    if (r.ok && r.data && typeof r.data === "object" && "document" in r.data) {
      onDataChange(r.data);
      setEdit({ saving: false, error: null });
      setEditing(false);
      setRevision((v) => v + 1);
      showNotice({ tone: "success", title: "Zapisano", text: "Pliki DOCX/PDF zawierają już zmiany." });
      return;
    }
    let message: string;
    if (r.networkError) message = "Brak połączenia z serwerem. Twoje zmiany są nadal w edytorze – spróbuj ponownie.";
    else if (r.status === 405 || (r.status === 404 && !r.error))
      message = "Edycja treści jest chwilowo niedostępna. Spróbuj ponownie później.";
    else if (r.status === 429) message = "Zbyt wiele zapisów w krótkim czasie. Odczekaj chwilę i spróbuj ponownie.";
    else if (r.status === 400) message = r.error || "Nie udało się zapisać – sprawdź długość akapitów i załączników.";
    else if (r.status === 402 || r.status === 409) message = r.error || "Edytować można tylko opłacone pismo.";
    else if (r.status === 401 || r.status === 403)
      message = r.error || "Brak dostępu – edycja jest możliwa tylko dla odblokowanego pisma z prawidłowego linku.";
    else message = r.error || "Nie udało się zapisać zmian. Spróbuj ponownie za chwilę.";
    setEdit({ saving: false, error: message });
  }

  function startEditing() {
    setNotice(null);
    setEdit({ saving: false, error: null });
    setEditing(true);
  }

  const price = formatPrice(data.priceGrosze);
  const downloadUrl = (format: "docx" | "pdf") =>
    `/api/documents/${encodeURIComponent(id)}/download?token=${encodeURIComponent(token)}&format=${format}${
      revision ? `&v=${revision}` : ""
    }`;

  const n = data.lockedParagraphs;
  const lockedText =
    n > 0
      ? `${pluralPl(n, "Pozostały", "Pozostałe", "Pozostałych")} ${n} ${pluralPl(n, "akapit", "akapity", "akapitów")}, instrukcja wysyłki i pobieranie DOCX/PDF po odblokowaniu – ${price}`
      : `Instrukcja wysyłki i pobieranie DOCX/PDF po odblokowaniu – ${price}`;

  const consentBox = (
    <ConsentCheckbox checked={consent} onChange={changeConsent} invalid={consentInvalid} className="mt-4" />
  );

  const unlockButton = (
    <button
      type="button"
      onClick={startCheckout}
      disabled={checkout.loading}
      className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-accent-400 px-5 py-3 font-sans font-semibold text-navy-950 shadow-sm transition-colors hover:bg-accent-300 disabled:cursor-wait disabled:opacity-70"
    >
      {checkout.loading ? (
        <>
          <span aria-hidden="true" className="h-4 w-4 animate-spin rounded-full border-2 border-navy-900/30 border-t-navy-900" />
          Przekierowujemy do płatności…
        </>
      ) : (
        <>
          <LockIcon className="h-4 w-4" open />
          Odblokuj pismo
        </>
      )}
    </button>
  );

  const checkoutError = checkout.error ? (
    <p role="alert" className="mt-3 font-sans text-sm font-medium text-red-700">
      {checkout.error}
    </p>
  ) : null;

  const redeem = (
    <RedeemCode
      id={id}
      token={token}
      consent={consent}
      onMissingConsent={() => setConsentInvalid(true)}
      onRedeemed={handleRedeemed}
    />
  );

  return (
    <div className="bg-navy-50/60">
      <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
        {/* Komunikaty po płatności / odblokowaniu / zapisie */}
        <div aria-live="polite" ref={noticeRef} className="scroll-mt-24">
          {notice ? (
            <Banner tone={notice.tone} title={notice.title} onClose={() => setNotice(null)}>
              {notice.text}
            </Banner>
          ) : null}
          {paidFlag && paid && !notice ? (
            <Banner tone="success" title="Płatność przyjęta – dziękujemy!">
              Twoje pismo jest odblokowane. Pobierz je w formacie DOCX lub PDF i sprawdź instrukcję wysyłki poniżej.
            </Banner>
          ) : null}
          {paidFlag && !paid && !pollingExpired ? (
            <Banner tone="info" title="Potwierdzamy płatność…" spinner>
              To zwykle trwa kilka sekund. Strona odświeży się automatycznie.
            </Banner>
          ) : null}
          {paidFlag && !paid && pollingExpired ? (
            <Banner tone="warning" title="Płatność jest jeszcze przetwarzana">
              Nie otrzymaliśmy jeszcze potwierdzenia od operatora płatności. Jeśli zapłaciłeś, odśwież stronę za chwilę.{" "}
              <button type="button" onClick={onRetry} className="font-semibold underline underline-offset-2">
                Sprawdź ponownie
              </button>
            </Banner>
          ) : null}
        </div>

        <div className="flex flex-col gap-1">
          <p className="text-sm font-semibold uppercase tracking-wider text-accent-700">{data.templateName}</p>
          <h1 className="text-2xl font-bold tracking-tight text-navy-900 sm:text-3xl">
            {paid ? "Twoje pismo jest gotowe" : "Podgląd Twojego pisma"}
          </h1>
          <p className="mt-1 max-w-2xl text-gray-600">
            {paid
              ? "Sprawdź dane, pobierz dokument, podpisz go i wyślij zgodnie z instrukcją."
              : "Tak wygląda początek Twojego pisma. Odblokuj je, aby zobaczyć całość i pobrać pliki."}
          </p>
        </div>

        <SaveLinkBox id={id} token={token} />

        <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
          <div className="min-w-0">
            {paid && editing ? (
              <LetterEditor
                document={data.document}
                saving={edit.saving}
                error={edit.error}
                onSave={saveEdits}
                onCancel={() => setEditing(false)}
              />
            ) : (
              <>
                {paid ? (
                  <div className="mx-auto mb-3 flex max-w-[210mm] justify-end">
                    <button
                      type="button"
                      onClick={startEditing}
                      className="inline-flex items-center gap-2 rounded-lg border border-navy-200 bg-white px-4 py-2 text-sm font-semibold text-navy-900 shadow-sm transition-colors hover:bg-navy-50"
                    >
                      <EditIcon /> Edytuj treść
                    </button>
                  </div>
                ) : null}
                <LetterView
                  document={data.document}
                  locked={!paid}
                  lockedOverlay={
                    <div className="w-full max-w-sm rounded-xl border border-navy-100 bg-white/95 p-5 text-center font-sans shadow-xl">
                      <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-navy-800 text-white">
                        <LockIcon className="h-5 w-5" />
                      </span>
                      <p className="mt-3 text-sm font-medium leading-relaxed text-navy-900">{lockedText}</p>
                      <div className="text-left">{consentBox}</div>
                      <div className="mt-4">{unlockButton}</div>
                      {checkoutError}
                      <div className="mt-3 text-left">{redeem}</div>
                    </div>
                  }
                />
              </>
            )}
            {data.aiUsed && !editing ? (
              <p className="mt-3 text-center text-xs text-gray-500">
                Opis sytuacji zredagowano z pomocą AI na podstawie Twoich odpowiedzi. Podstawy prawne i struktura pisma
                pochodzą z szablonu.
              </p>
            ) : null}
          </div>

          <aside className="space-y-4 lg:sticky lg:top-24" aria-label={paid ? "Pobieranie" : "Odblokowanie pisma"}>
            {paid ? (
              <div className="rounded-xl border border-navy-100 bg-white p-5 shadow-sm">
                <h2 className="font-semibold text-navy-900">Pobierz pismo</h2>
                {editing ? (
                  <p className="mt-3 rounded-lg bg-accent-50 p-3 text-sm text-navy-900">
                    Edytujesz treść. Zapisz zmiany, aby pobrać nową wersję – pliki poniżej zawierają ostatnią zapisaną
                    wersję.
                  </p>
                ) : null}
                <div className="mt-4 space-y-3">
                  <a
                    href={downloadUrl("pdf")}
                    className="flex w-full items-center justify-center gap-2 rounded-lg bg-navy-800 px-4 py-3 font-semibold text-white transition-colors hover:bg-navy-900"
                  >
                    <DownloadIcon /> Pobierz PDF
                  </a>
                  <a
                    href={downloadUrl("docx")}
                    className="flex w-full items-center justify-center gap-2 rounded-lg border border-navy-200 bg-white px-4 py-3 font-semibold text-navy-900 transition-colors hover:bg-navy-50"
                  >
                    <DownloadIcon /> Pobierz DOCX
                  </a>
                  {!editing ? (
                    <button
                      type="button"
                      onClick={startEditing}
                      className="flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-navy-800 underline-offset-2 hover:underline"
                    >
                      <EditIcon /> Edytuj treść w przeglądarce
                    </button>
                  ) : null}
                </div>
                <p className="mt-3 text-xs leading-relaxed text-gray-500">
                  PDF – gotowy do druku. DOCX – do edycji w Wordzie, LibreOffice lub Google Docs.
                </p>
              </div>
            ) : (
              <div className="rounded-xl border border-navy-800 bg-white p-5 shadow-sm ring-1 ring-navy-800">
                <h2 className="font-semibold text-navy-900">Odblokuj pełne pismo</h2>
                <p className="mt-1 text-3xl font-bold text-navy-900">{price}</p>
                <ul className="mt-4 space-y-2 text-sm text-gray-700">
                  {[
                    "Pełna treść pisma",
                    "Pliki DOCX i PDF",
                    "Edycja treści w przeglądarce",
                    "Instrukcja: gdzie i jak wysłać",
                    "Terminy i podstawy prawne",
                  ].map((f) => (
                    <li key={f} className="flex gap-2">
                      <CheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-navy-700" />
                      {f}
                    </li>
                  ))}
                </ul>
                {consentBox}
                <div className="mt-4">{unlockButton}</div>
                {checkoutError}
                <div className="mt-3">{redeem}</div>
                <p className="mt-3 text-xs leading-relaxed text-gray-500">
                  Płatność kartą, BLIK lub szybkim przelewem. Treść cyfrowa dostarczana natychmiast po płatności –
                  szczegóły w{" "}
                  <Link href="/regulamin" className="underline underline-offset-2">
                    regulaminie
                  </Link>
                  . Więcej pism?{" "}
                  <Link href="/cennik#pakiet" className="underline underline-offset-2">
                    Pakiet 5 pism
                  </Link>
                  .
                </p>
              </div>
            )}
            <Link
              href="/#pisma"
              className="block rounded-lg px-4 py-2 text-center text-sm font-medium text-navy-700 underline-offset-2 hover:underline"
            >
              Wygeneruj kolejne pismo →
            </Link>
          </aside>
        </div>

        {/* Treści dodatkowe */}
        <div className="mt-12 grid max-w-4xl gap-10">
          {paid ? <InstructionsSection instructions={data.instructions} /> : null}

          {data.deadlines.length ? (
            <section aria-labelledby="terminy-heading">
              <h2 id="terminy-heading" className="text-xl font-bold text-navy-900">
                Terminy
              </h2>
              <p className="mt-1 text-sm text-gray-600">Wyliczone na podstawie dat podanych w kwestionariuszu.</p>
              <div className="mt-4">
                <DeadlineList deadlines={data.deadlines} />
              </div>
            </section>
          ) : null}

          {paid && data.legalBasis.length ? (
            <section aria-labelledby="podstawa-heading">
              <h2 id="podstawa-heading" className="text-xl font-bold text-navy-900">
                Podstawa prawna
              </h2>
              <div className="mt-4">
                <LegalBasisList items={data.legalBasis} />
              </div>
            </section>
          ) : null}

          <p className="rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-600">
            <strong className="text-navy-900">Sprawdź dane przed wysłaniem. Dokument nie jest poradą prawną.</strong>{" "}
            W razie wątpliwości skonsultuj sprawę z prawnikiem lub rzecznikiem konsumentów.
          </p>
        </div>
      </div>
    </div>
  );
}

/* ---------- „Mam kod pakietu lub promocyjny” ---------- */

function RedeemCode({
  id,
  token,
  consent,
  onMissingConsent,
  onRedeemed,
}: {
  id: string;
  token: string;
  consent: boolean;
  onMissingConsent: () => void;
  onRedeemed: (remaining: number) => Promise<void>;
}) {
  const uid = useId();
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [state, setState] = useState<{ loading: boolean; error: string | null }>({ loading: false, error: null });

  function toggle() {
    if (!open && !code) setCode(recallPackageCode());
    setOpen((o) => !o);
  }

  async function redeem(e: React.FormEvent) {
    e.preventDefault();
    if (state.loading) return;
    const trimmed = code.trim();
    if (!trimmed) {
      setState({ loading: false, error: "Wpisz kod." });
      return;
    }
    if (!consent) {
      onMissingConsent();
      setState({ loading: false, error: "Zaznacz powyżej zgodę na natychmiastowe dostarczenie pisma." });
      return;
    }
    setState({ loading: true, error: null });
    const r = await apiSend<RedeemResponse>("POST", `/api/documents/${encodeURIComponent(id)}/redeem`, {
      token,
      code: trimmed,
      consent: true,
    });
    if (r.ok && r.data && r.data.status === "paid") {
      const remaining = typeof r.data.remaining === "number" ? r.data.remaining : 0;
      if (remaining > 0) rememberPackageCode(trimmed);
      else forgetPackageCode();
      setState({ loading: false, error: null });
      await onRedeemed(remaining);
      return;
    }
    let message: string;
    if (r.networkError) message = "Brak połączenia z serwerem. Spróbuj ponownie.";
    else if (r.status === 405 || (r.status === 404 && !r.error))
      message = "Odblokowanie kodem jest chwilowo niedostępne. Spróbuj ponownie później albo zapłać za pismo.";
    else if (r.status === 429) message = "Zbyt wiele prób. Odczekaj chwilę i spróbuj ponownie.";
    else if (r.status === 409 || r.status === 410) message = r.error || "Ten kod został już w pełni wykorzystany.";
    else if (r.status === 400 || r.status === 404) message = r.error || "Nieprawidłowy kod. Sprawdź, czy przepisałeś go dokładnie.";
    else message = r.error || "Nie udało się użyć kodu. Spróbuj ponownie za chwilę.";
    if (r.status === 409 || r.status === 410) forgetPackageCode();
    setState({ loading: false, error: message });
  }

  return (
    <div className="font-sans">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-controls={`${uid}-kod`}
        className="text-sm font-medium text-navy-700 underline underline-offset-2 hover:text-navy-950"
      >
        Mam kod pakietu lub promocyjny
      </button>
      {open ? (
        <form id={`${uid}-kod`} onSubmit={redeem} noValidate className="mt-2">
          <label htmlFor={`${uid}-pole`} className="sr-only">
            Kod pakietu lub kod promocyjny
          </label>
          <div className="flex gap-2">
            <input
              id={`${uid}-pole`}
              type="text"
              value={code}
              onChange={(e) => {
                setCode(e.target.value);
                if (state.error) setState({ loading: false, error: null });
              }}
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              maxLength={64}
              placeholder="np. PG-ABCDE-FGHJK"
              aria-invalid={state.error ? true : undefined}
              aria-describedby={state.error ? `${uid}-blad` : undefined}
              className="min-w-0 flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 font-mono text-sm uppercase text-gray-900 placeholder:font-sans placeholder:normal-case placeholder:tracking-normal focus:border-navy-600 focus:outline-none focus:ring-4 focus:ring-navy-100"
            />
            <button
              type="submit"
              disabled={state.loading}
              className="shrink-0 rounded-lg bg-navy-800 px-3 py-2 text-sm font-semibold text-white hover:bg-navy-900 disabled:cursor-wait disabled:opacity-70"
            >
              {state.loading ? "Sprawdzamy…" : "Odblokuj kodem"}
            </button>
          </div>
          {state.error ? (
            <p id={`${uid}-blad`} role="alert" className="mt-2 text-sm font-medium text-red-700">
              {state.error}
            </p>
          ) : (
            <p className="mt-1.5 text-xs text-gray-500">Kod wymaga tej samej zgody co płatność (pole powyżej).</p>
          )}
        </form>
      ) : null}
    </div>
  );
}

/* ---------- „Zachowaj ten link” + opcjonalnie e-mail ---------- */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function SaveLinkBox({ id, token }: { id: string; token: string }) {
  const uid = useId();
  const capabilities = useCapabilities();
  const [copied, setCopied] = useState(false);
  const [email, setEmail] = useState("");
  const [mail, setMail] = useState<{ loading: boolean; error: string | null; sentTo: string | null }>({
    loading: false,
    error: null,
    sentTo: null,
  });

  async function copyLink() {
    const link = `${window.location.origin}/dokument/${encodeURIComponent(id)}?token=${encodeURIComponent(token)}`;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      window.prompt("Skopiuj link do pisma:", link);
    }
  }

  async function sendEmail(e: React.FormEvent) {
    e.preventDefault();
    if (mail.loading) return;
    const address = email.trim();
    if (!EMAIL_RE.test(address)) {
      setMail({ loading: false, error: "Podaj poprawny adres e-mail, np. jan@przyklad.pl.", sentTo: null });
      return;
    }
    setMail({ loading: true, error: null, sentTo: null });
    const r = await apiSend<unknown>("POST", `/api/documents/${encodeURIComponent(id)}/email`, { token, email: address });
    if (r.ok) {
      setMail({ loading: false, error: null, sentTo: address });
      return;
    }
    let message: string;
    if (r.networkError) message = "Brak połączenia z serwerem. Spróbuj ponownie albo skopiuj link.";
    else if (r.status === 503 || r.status === 405 || (r.status === 404 && !r.error))
      message = "Wysyłka e-maili jest chwilowo niedostępna – skopiuj link i zapisz go u siebie.";
    else if (r.status === 429) message = "Zbyt wiele wysyłek w krótkim czasie. Spróbuj ponownie później.";
    else if (r.status === 400) message = r.error || "Podaj poprawny adres e-mail.";
    else message = r.error || "Nie udało się wysłać e-maila. Skopiuj link i zapisz go u siebie.";
    setMail({ loading: false, error: message, sentTo: null });
  }

  const emailEnabled = capabilities?.email === true;

  return (
    <div className="mt-6 rounded-xl border border-accent-200 bg-accent-50 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="flex items-start gap-2.5 text-sm text-navy-900">
          <svg aria-hidden="true" viewBox="0 0 24 24" className="mt-0.5 h-5 w-5 shrink-0 text-accent-700" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10 13a5 5 0 007.5.5l3-3a5 5 0 00-7-7l-1.7 1.7M14 11a5 5 0 00-7.5-.5l-3 3a5 5 0 007 7l1.7-1.7" />
          </svg>
          <span>
            <strong>Zachowaj ten link – tylko on daje dostęp do pisma.</strong> Nie zakładamy kont, więc bez linku nie
            odzyskasz dokumentu.
          </span>
        </p>
        <button
          type="button"
          onClick={copyLink}
          className="shrink-0 rounded-lg border border-accent-300 bg-white px-4 py-2 text-sm font-semibold text-navy-900 transition-colors hover:bg-accent-100"
        >
          {copied ? "Skopiowano ✓" : "Kopiuj link"}
        </button>
      </div>

      {emailEnabled ? (
        <form onSubmit={sendEmail} noValidate className="mt-3 border-t border-accent-200 pt-3">
          {mail.sentTo ? (
            <p role="status" className="flex items-start gap-2 text-sm text-green-800">
              <CheckIcon className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                Wysłano link na adres <strong>{mail.sentTo}</strong>. Jeśli nie widzisz wiadomości, sprawdź folder spam.
              </span>
            </p>
          ) : (
            <>
              <label htmlFor={`${uid}-email`} className="block text-sm font-medium text-navy-900">
                Wolisz mieć link w skrzynce? Wyślemy go na Twój e-mail.
              </label>
              <div className="mt-1.5 flex flex-col gap-2 sm:flex-row">
                <input
                  id={`${uid}-email`}
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (mail.error) setMail({ loading: false, error: null, sentTo: null });
                  }}
                  placeholder="jan@przyklad.pl"
                  aria-invalid={mail.error ? true : undefined}
                  aria-describedby={mail.error ? `${uid}-email-blad` : undefined}
                  className="min-w-0 flex-1 rounded-lg border border-accent-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-navy-600 focus:outline-none focus:ring-4 focus:ring-navy-100"
                />
                <button
                  type="submit"
                  disabled={mail.loading}
                  className="shrink-0 rounded-lg bg-navy-800 px-4 py-2 text-sm font-semibold text-white hover:bg-navy-900 disabled:cursor-wait disabled:opacity-70"
                >
                  {mail.loading ? "Wysyłamy…" : "Wyślij link na e-mail"}
                </button>
              </div>
              {mail.error ? (
                <p id={`${uid}-email-blad`} role="alert" className="mt-2 text-sm font-medium text-red-700">
                  {mail.error}
                </p>
              ) : null}
            </>
          )}
        </form>
      ) : null}
    </div>
  );
}

function InstructionsSection({ instructions }: { instructions: Instructions }) {
  const [checked, setChecked] = useState<Record<number, boolean>>({});
  const blocks = [
    { title: "Gdzie wysłać", body: instructions.whereToSend },
    { title: "Jak wysłać", body: instructions.howToSend },
    { title: "Co po wysłaniu", body: instructions.afterSending },
  ].filter((b) => b.body?.trim());

  if (!blocks.length && !instructions.checklist.length) return null;

  return (
    <section aria-labelledby="co-dalej-heading">
      <h2 id="co-dalej-heading" className="text-xl font-bold text-navy-900">
        Co dalej?
      </h2>
      <div className="mt-4 grid gap-4">
        {blocks.map((b, i) => (
          <div key={b.title} className="rounded-xl border border-navy-100 bg-white p-5">
            <h3 className="flex items-center gap-2.5 font-semibold text-navy-900">
              <span aria-hidden="true" className="flex h-7 w-7 items-center justify-center rounded-full bg-navy-800 text-sm text-white">
                {i + 1}
              </span>
              {b.title}
            </h3>
            <div className="mt-3">
              <Markdown>{b.body}</Markdown>
            </div>
          </div>
        ))}
        {instructions.checklist.length ? (
          <div className="rounded-xl border border-accent-200 bg-accent-50 p-5">
            <h3 className="font-semibold text-navy-900">Lista kontrolna przed wysłaniem</h3>
            <ul className="mt-3 space-y-2">
              {instructions.checklist.map((item, i) => (
                <li key={i}>
                  <label className="flex cursor-pointer items-start gap-3 text-sm text-gray-800">
                    <input
                      type="checkbox"
                      checked={!!checked[i]}
                      onChange={(e) => setChecked((c) => ({ ...c, [i]: e.target.checked }))}
                      className="mt-0.5 h-4 w-4 shrink-0 accent-navy-800"
                    />
                    <span className={checked[i] ? "text-gray-500 line-through" : undefined}>{item}</span>
                  </label>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function Banner({
  tone,
  title,
  children,
  spinner = false,
  onClose,
}: {
  tone: "success" | "info" | "warning";
  title: string;
  children: React.ReactNode;
  spinner?: boolean;
  onClose?: () => void;
}) {
  const styles = {
    success: "border-green-200 bg-green-50 text-green-900",
    info: "border-navy-200 bg-white text-navy-900",
    warning: "border-accent-300 bg-accent-50 text-navy-900",
  }[tone];
  return (
    <div className={`mb-6 flex items-start gap-3 rounded-xl border p-4 ${styles}`} role={tone === "success" ? "status" : undefined}>
      {spinner ? (
        <span aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 animate-spin rounded-full border-2 border-navy-200 border-t-navy-800" />
      ) : tone === "success" ? (
        <CheckIcon className="mt-0.5 h-5 w-5 shrink-0 text-green-700" />
      ) : null}
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{title}</p>
        <p className="mt-0.5 text-sm">{children}</p>
      </div>
      {onClose ? (
        <button
          type="button"
          onClick={onClose}
          aria-label="Zamknij komunikat"
          className="-m-1 shrink-0 rounded p-1 text-current opacity-60 hover:opacity-100"
        >
          ✕
        </button>
      ) : null}
    </div>
  );
}

function ErrorBox({ title, message, onRetry }: { title: string; message: string; onRetry?: () => void }) {
  return (
    <div className="mx-auto max-w-xl px-4 py-16 text-center sm:py-24">
      <span aria-hidden="true" className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-xl text-red-700">
        !
      </span>
      <h1 className="mt-4 text-2xl font-bold text-navy-900">{title}</h1>
      <p role="alert" className="mt-2 text-gray-600">
        {message}
      </p>
      <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
        {onRetry ? (
          <button
            type="button"
            onClick={onRetry}
            className="rounded-lg bg-navy-800 px-5 py-2.5 font-semibold text-white hover:bg-navy-900"
          >
            Spróbuj ponownie
          </button>
        ) : null}
        <Link href="/#pisma" className="rounded-lg border border-gray-300 px-5 py-2.5 font-semibold text-navy-900 hover:bg-gray-50">
          Wybierz pismo
        </Link>
      </div>
    </div>
  );
}

export function DocumentSkeleton() {
  return (
    <div className="bg-navy-50/60" aria-busy="true">
      <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
        <p className="sr-only" role="status">
          Wczytujemy Twoje pismo…
        </p>
        <div className="h-4 w-40 animate-pulse rounded bg-navy-100" />
        <div className="mt-3 h-8 w-72 animate-pulse rounded bg-navy-100" />
        <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="mx-auto w-full max-w-[210mm] space-y-3 rounded-sm bg-white p-10 shadow ring-1 ring-gray-200">
            {[40, 30, 35, 0, 50, 45, 0, 100, 95, 98, 80, 100, 92].map((w, i) =>
              w ? (
                <div key={i} className="h-3 animate-pulse rounded bg-gray-200" style={{ width: `${w}%` }} />
              ) : (
                <div key={i} className="h-4" />
              ),
            )}
          </div>
          <div className="h-64 animate-pulse rounded-xl bg-white ring-1 ring-navy-100" />
        </div>
      </div>
    </div>
  );
}

function LockIcon({ className = "h-5 w-5", open = false }: { className?: string; open?: boolean }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d={open ? "M8 11V7a4 4 0 017.7-1.5" : "M8 11V7a4 4 0 018 0v4"} />
    </svg>
  );
}

function EditIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 20h4L19 9l-4-4L4 16zM14 6l4 4" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 4v11M7 10l5 5 5-5M5 20h14" />
    </svg>
  );
}
