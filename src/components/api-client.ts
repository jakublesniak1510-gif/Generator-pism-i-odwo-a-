"use client";

/**
 * Wspólne helpery do wywołań API po stronie klienta.
 * Endpointy z „fali 2” mogą jeszcze nie istnieć (404 z HTML-em) – helpery nigdy nie rzucają.
 */
import { useEffect, useState } from "react";
import type { ApiError, CapabilitiesResponse } from "@/lib/api-types";

export interface ApiResult<T> {
  ok: boolean;
  status: number;
  /** sparsowane JSON-owe body (gdy ok) */
  data: T | null;
  /** komunikat błędu z API (`ApiError.error`), jeśli serwer go zwrócił */
  error: string | null;
  fieldErrors?: Record<string, string>;
  /** true = nie udało się połączyć (brak sieci, timeout) */
  networkError: boolean;
}

/** fetch + bezpieczne parsowanie JSON. Status 0 = błąd sieci. */
export async function apiFetch<T>(input: string, init?: RequestInit): Promise<ApiResult<T>> {
  let res: Response;
  try {
    res = await fetch(input, { cache: "no-store", ...init });
  } catch {
    return { ok: false, status: 0, data: null, error: null, networkError: true };
  }
  let body: unknown = null;
  try {
    const text = await res.text();
    body = text ? JSON.parse(text) : null;
  } catch {
    body = null;
  }
  if (res.ok) {
    return { ok: true, status: res.status, data: body as T, error: null, networkError: false };
  }
  const err = (body && typeof body === "object" ? body : {}) as Partial<ApiError>;
  return {
    ok: false,
    status: res.status,
    data: null,
    error: typeof err.error === "string" && err.error.trim() ? err.error : null,
    fieldErrors: err.fieldErrors,
    networkError: false,
  };
}

/** JSON POST/PATCH. */
export function apiSend<T>(method: "POST" | "PATCH", url: string, payload: unknown): Promise<ApiResult<T>> {
  return apiFetch<T>(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

/* ---------- GET /api/capabilities (pobierane raz na sesję strony) ---------- */

let capabilitiesPromise: Promise<CapabilitiesResponse | null> | null = null;

function isCapabilities(v: unknown): v is CapabilitiesResponse {
  return !!v && typeof v === "object" && "aiPrefill" in v && "email" in v;
}

export function loadCapabilities(): Promise<CapabilitiesResponse | null> {
  if (!capabilitiesPromise) {
    capabilitiesPromise = apiFetch<CapabilitiesResponse>("/api/capabilities").then((r) => {
      if (r.ok && isCapabilities(r.data)) return r.data;
      // błąd → funkcje ukryte; przy błędzie sieci pozwalamy spróbować ponownie przy kolejnym montowaniu
      if (r.networkError) capabilitiesPromise = null;
      return null;
    });
  }
  return capabilitiesPromise;
}

/** null = jeszcze nie wiadomo albo niedostępne (UI ukrywa wtedy opcjonalne funkcje). */
export function useCapabilities(): CapabilitiesResponse | null {
  const [caps, setCaps] = useState<CapabilitiesResponse | null>(null);
  useEffect(() => {
    let cancelled = false;
    void loadCapabilities().then((c) => {
      if (!cancelled) setCaps(c);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return caps;
}

/* ---------- kod pakietu zapamiętany w przeglądarce (wygoda, nie źródło prawdy) ---------- */

const PACKAGE_CODE_KEY = "pismogotowe:kod-pakietu";

export function rememberPackageCode(code: string): void {
  try {
    window.localStorage.setItem(PACKAGE_CODE_KEY, code);
  } catch {
    /* tryb prywatny – ignorujemy */
  }
}

export function recallPackageCode(): string {
  try {
    return window.localStorage.getItem(PACKAGE_CODE_KEY) ?? "";
  } catch {
    return "";
  }
}

export function forgetPackageCode(): void {
  try {
    window.localStorage.removeItem(PACKAGE_CODE_KEY);
  } catch {
    /* ignorujemy */
  }
}
