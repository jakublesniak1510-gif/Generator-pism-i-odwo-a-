import type { CapabilitiesResponse } from "@/lib/api-types";
import { isEmailConfigured } from "@/lib/email";
import { isStripeMode } from "@/lib/payments/stripe";
import { json } from "../_lib/http";

export const runtime = "nodejs";

export async function GET(): Promise<Response> {
  return json<CapabilitiesResponse>({
    aiPrefill: Boolean(process.env.ANTHROPIC_API_KEY),
    email: isEmailConfigured(),
    payments: isStripeMode() ? "stripe" : "dev",
  });
}
