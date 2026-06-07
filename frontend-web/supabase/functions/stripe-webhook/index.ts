// Required environment variables:
//   STRIPE_WEBHOOK_SECRET — Stripe webhook signing secret (whsec_...)
//   SUPABASE_URL          — Supabase project URL (auto-set in Edge Functions)
//   SUPABASE_SERVICE_ROLE_KEY — Service role key for admin DB writes

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.3";

async function verifyStripeSignature(
  payload: string,
  signature: string,
  secret: string,
): Promise<boolean> {
  try {
    const parts = Object.fromEntries(
      signature.split(",").map((part) => part.split("=")),
    );
    const timestamp = parts["t"];
    const v1 = parts["v1"];
    if (!timestamp || !v1) return false;

    const signedPayload = `${timestamp}.${payload}`;
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const sigBytes = await crypto.subtle.sign(
      "HMAC",
      key,
      new TextEncoder().encode(signedPayload),
    );
    const expected = Array.from(new Uint8Array(sigBytes))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    return expected === v1;
  } catch {
    return false;
  }
}

serve(async (req) => {
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET")!;
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const signature = req.headers.get("stripe-signature") ?? "";
  const body = await req.text();

  const valid = await verifyStripeSignature(body, signature, webhookSecret);
  if (!valid) {
    console.error("Assinatura invalida no webhook Stripe");
    return new Response(JSON.stringify({ error: "Assinatura invalida" }), { status: 400 });
  }

  let event: { type: string; data: { object: Record<string, unknown> } };
  try {
    event = JSON.parse(body);
  } catch {
    return new Response(JSON.stringify({ error: "JSON invalido" }), { status: 400 });
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey);
  const obj = event.data.object;

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const customerId = obj["customer"] as string;
        const subscriptionId = obj["subscription"] as string | undefined;
        if (customerId && subscriptionId) {
          await adminClient
            .from("profiles")
            .update({
              stripe_subscription_id: subscriptionId,
              subscription_status: "active",
            })
            .eq("stripe_customer_id", customerId);
        }
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const customerId = obj["customer"] as string;
        const subscriptionId = obj["id"] as string;
        const rawStatus = obj["status"] as string;
        // Map Stripe status to our enum
        const allowedStatuses = ["free", "trialing", "active", "past_due", "canceled", "incomplete"];
        const status = allowedStatuses.includes(rawStatus) ? rawStatus : "incomplete";

        await adminClient
          .from("profiles")
          .update({
            stripe_subscription_id: subscriptionId,
            subscription_status: status,
          })
          .eq("stripe_customer_id", customerId);
        break;
      }

      case "customer.subscription.deleted": {
        const customerId = obj["customer"] as string;
        await adminClient
          .from("profiles")
          .update({ subscription_status: "canceled" })
          .eq("stripe_customer_id", customerId);
        break;
      }

      case "invoice.payment_failed": {
        const customerId = obj["customer"] as string;
        await adminClient
          .from("profiles")
          .update({ subscription_status: "past_due" })
          .eq("stripe_customer_id", customerId);
        break;
      }

      default:
        console.log("Tipo de evento nao tratado:", event.type);
    }
  } catch (err) {
    console.error("Erro ao processar evento do webhook:", err);
    // Return 200 so Stripe doesn't retry — log for investigation
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
