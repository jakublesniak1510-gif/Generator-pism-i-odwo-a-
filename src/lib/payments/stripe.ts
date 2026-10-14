import crypto from "node:crypto";
import Stripe from "stripe";
import { getDocument, markPaid, setStripeSession, type StoredDocument } from "@/lib/db";
import { isEmailConfigured, packageCodeEmail, sendEmail } from "@/lib/email";
import { createPackageCodeForSession, type StoredCode } from "./codes";
import type { LetterTemplate } from "@/lib/templates/types";

export function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/+$/, "");
}

export function documentUrl(id: string, token: string, paid = false): string {
  const params = new URLSearchParams({ token });
  if (paid) params.set("paid", "1");
  return `${siteUrl()}/dokument/${encodeURIComponent(id)}?${params.toString()}`;
}

export function isStripeMode(): boolean {
  return process.env.PAYMENTS_MODE === "stripe";
}

let stripeClient: Stripe | null = null;

function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("Brak STRIPE_SECRET_KEY przy PAYMENTS_MODE=stripe.");
  if (!stripeClient) stripeClient = new Stripe(key);
  return stripeClient;
}

/**
 * Zwraca adres płatności. W trybie dev od razu oznacza pismo jako opłacone
 * i zwraca adres strony dokumentu.
 */
export async function createCheckoutUrl(doc: StoredDocument, template: LetterTemplate, token: string): Promise<string> {
  if (!isStripeMode()) {
    markPaid(doc.id, "dev");
    return documentUrl(doc.id, token, true);
  }

  const session = await getStripe().checkout.sessions.create({
    mode: "payment",
    currency: "pln",
    line_items: [
      {
        price_data: {
          currency: "pln",
          unit_amount: template.priceGrosze,
          product_data: { name: `Pismo: ${template.name}` },
        },
        quantity: 1,
      },
    ],
    metadata: { documentId: doc.id },
    client_reference_id: doc.id,
    success_url: documentUrl(doc.id, token, true),
    cancel_url: documentUrl(doc.id, token),
    locale: "pl",
  });

  if (!session.url) throw new Error("Stripe nie zwrócił adresu sesji płatności.");
  setStripeSession(doc.id, session.id);
  return session.url;
}

/* ---------------------------- pakiet 5 pism ---------------------------- */

export const PACKAGE_USES = 5;
const DEFAULT_PACKAGE_PRICE_GROSZE = 5900;

export function packagePriceGrosze(): number {
  const n = Number(process.env.PACKAGE_PRICE_GROSZE);
  return Number.isInteger(n) && n >= 100 ? n : DEFAULT_PACKAGE_PRICE_GROSZE;
}

export function packageSuccessUrl(sessionId: string): string {
  return `${siteUrl()}/pakiet/sukces?session=${encodeURIComponent(sessionId)}`;
}

/** Wysyła kod pakietu e-mailem, jeśli podano adres i e-mail jest skonfigurowany. Nigdy nie rzuca. */
async function emailPackageCode(code: StoredCode): Promise<void> {
  if (!code.email || !isEmailConfigured()) return;
  const result = await sendEmail(
    packageCodeEmail({ to: code.email, code: code.code, uses: code.usesTotal, siteUrl: siteUrl() }),
  );
  if (!result.sent) console.warn("[email] nie wysłano kodu pakietu:", result.reason);
}

/**
 * Zakup pakietu 5 pism. Tryb dev: od razu tworzy kod i zwraca adres strony sukcesu.
 * Tryb stripe: sesja Stripe Checkout; kod tworzy webhook.
 */
export async function createPackageCheckoutUrl(input: { email: string | null }): Promise<string> {
  if (!isStripeMode()) {
    const sessionId = `dev-${crypto.randomUUID()}`;
    const { code } = createPackageCodeForSession(sessionId, PACKAGE_USES, input.email);
    await emailPackageCode(code);
    return packageSuccessUrl(sessionId);
  }

  const session = await getStripe().checkout.sessions.create({
    mode: "payment",
    currency: "pln",
    line_items: [
      {
        price_data: {
          currency: "pln",
          unit_amount: packagePriceGrosze(),
          product_data: { name: `Pakiet ${PACKAGE_USES} pism – PismoGotowe` },
        },
        quantity: 1,
      },
    ],
    metadata: { package: String(PACKAGE_USES), email: input.email ?? "" },
    ...(input.email ? { customer_email: input.email } : {}),
    success_url: `${siteUrl()}/pakiet/sukces?session={CHECKOUT_SESSION_ID}`,
    cancel_url: `${siteUrl()}/cennik`,
    locale: "pl",
  });
  if (!session.url) throw new Error("Stripe nie zwrócił adresu sesji płatności.");
  return session.url;
}

/* ---------------------------- webhook ---------------------------- */

export class WebhookSignatureError extends Error {}

async function handlePackageSession(session: Stripe.Checkout.Session): Promise<{ handled: boolean }> {
  const uses = Number(session.metadata?.package);
  const email = session.metadata?.email || session.customer_details?.email || session.customer_email || null;
  const { code, created } = createPackageCodeForSession(
    session.id,
    Number.isInteger(uses) && uses > 0 ? uses : PACKAGE_USES,
    email,
  );
  if (created) {
    console.info("[stripe] utworzono kod pakietu dla sesji", session.id);
    await emailPackageCode(code);
  }
  return { handled: true };
}

/**
 * Obsługa webhooka Stripe. Rzuca `WebhookSignatureError` przy błędnym podpisie.
 * Idempotentne: ponowne dostarczenie zdarzenia nic nie zmienia.
 * Obsługuje pojedyncze pisma (`metadata.documentId`) i pakiety (`metadata.package`).
 */
export async function handleStripeWebhook(rawBody: string, signature: string | null): Promise<{ handled: boolean }> {
  if (!signature) throw new WebhookSignatureError("Brak nagłówka stripe-signature.");
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) throw new Error("Brak STRIPE_WEBHOOK_SECRET.");

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(rawBody, signature, secret);
  } catch (err) {
    throw new WebhookSignatureError(err instanceof Error ? err.message : "Nieprawidłowy podpis.");
  }

  // `async_payment_succeeded` – metody z opóźnionym potwierdzeniem (np. przelewy)
  if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
    const session = event.data.object;
    if (session.payment_status !== "paid") {
      console.info("[stripe] sesja zakończona, płatność jeszcze nieopłacona", session.id, session.payment_status);
      return { handled: false };
    }

    if (session.metadata?.package) {
      return handlePackageSession(session);
    }

    const documentId = session.metadata?.documentId ?? session.client_reference_id;
    if (!documentId) {
      console.warn("[stripe] sesja bez documentId", session.id);
      return { handled: false };
    }
    const doc = getDocument(documentId);
    if (!doc) {
      console.warn("[stripe] nieznany dokument w metadanych", documentId);
      return { handled: false };
    }
    if (markPaid(documentId, "stripe")) {
      if (doc.stripeSessionId !== session.id) setStripeSession(documentId, session.id);
      console.info("[stripe] opłacono dokument", documentId);
    }
    return { handled: true };
  }

  return { handled: false };
}
