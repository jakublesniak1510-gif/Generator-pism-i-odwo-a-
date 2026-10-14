import Stripe from "stripe";
import { getDocument, markPaid, setStripeSession, type StoredDocument } from "@/lib/db";
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
    markPaid(doc.id);
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

export class WebhookSignatureError extends Error {}

/**
 * Obsługa webhooka Stripe. Rzuca `WebhookSignatureError` przy błędnym podpisie.
 * Idempotentne: ponowne dostarczenie zdarzenia nic nie zmienia.
 */
export function handleStripeWebhook(rawBody: string, signature: string | null): { handled: boolean } {
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
    const documentId = session.metadata?.documentId ?? session.client_reference_id;
    if (!documentId) {
      console.warn("[stripe] sesja bez documentId", session.id);
      return { handled: false };
    }
    if (session.payment_status !== "paid") {
      console.info("[stripe] sesja zakończona, płatność jeszcze nieopłacona", session.id, session.payment_status);
      return { handled: false };
    }
    const doc = getDocument(documentId);
    if (!doc) {
      console.warn("[stripe] nieznany dokument w metadanych", documentId);
      return { handled: false };
    }
    if (markPaid(documentId)) {
      if (doc.stripeSessionId !== session.id) setStripeSession(documentId, session.id);
      console.info("[stripe] opłacono dokument", documentId);
    }
    return { handled: true };
  }

  return { handled: false };
}
