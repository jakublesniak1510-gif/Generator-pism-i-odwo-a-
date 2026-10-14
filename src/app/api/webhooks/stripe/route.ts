import { handleStripeWebhook, WebhookSignatureError } from "@/lib/payments/stripe";
import { apiError, json } from "../../_lib/http";

export const runtime = "nodejs";

export async function POST(req: Request): Promise<Response> {
  // podpis Stripe liczony jest z surowego body – nie parsujemy JSON przed weryfikacją
  const rawBody = await req.text();
  const signature = req.headers.get("stripe-signature");

  try {
    const result = await handleStripeWebhook(rawBody, signature);
    return json({ received: true, handled: result.handled });
  } catch (err) {
    if (err instanceof WebhookSignatureError) {
      console.warn("[webhook/stripe] odrzucono zdarzenie:", err.message);
      return apiError(400, "Nieprawidłowy podpis webhooka.");
    }
    console.error("[webhook/stripe] błąd obsługi", err);
    return apiError(500, "Błąd obsługi webhooka.");
  }
}
