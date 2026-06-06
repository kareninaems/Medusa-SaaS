import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.3";
import Stripe from "https://esm.sh/stripe@15.1.0?target=deno";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, stripe-signature",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
const stripeWebhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET") ?? "";

const missingVars = [
  ["STRIPE_SECRET_KEY", stripeSecretKey],
  ["STRIPE_WEBHOOK_SECRET", stripeWebhookSecret],
].filter(([, value]) => !value).map(([name]) => name);

const stripe = stripeSecretKey
  ? new Stripe(stripeSecretKey, { apiVersion: "2024-06-20" })
  : null;

const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function mapStatus(status: string | null | undefined) {
  if (!status) return "inactive";
  return status;
}

serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (missingVars.length) {
    return new Response(
      JSON.stringify({ detail: `Missing env vars: ${missingVars.join(", ")}` }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  try {
    const signature = request.headers.get("stripe-signature") || "";
    if (!signature) {
      return new Response(JSON.stringify({ detail: "Stripe-Signature ausente" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const rawBody = await request.text();
    const event = await stripe!.webhooks.constructEventAsync(rawBody, signature, stripeWebhookSecret);

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.metadata?.user_id;
      if (!userId) {
        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      try {
        await adminClient.from("subscriptions").upsert({
          user_id: userId,
          stripe_customer_id: typeof session.customer === "string" ? session.customer : null,
          stripe_subscription_id: typeof session.subscription === "string" ? session.subscription : null,
          status: "active",
          updated_at: new Date().toISOString(),
        }, { onConflict: "user_id" });
      } catch {
        // non-blocking for webhook acknowledgment
      }
    }

    if (event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted") {
      const stripeSubscription = event.data.object as Stripe.Subscription;
      const userId = stripeSubscription.metadata?.user_id;
      if (userId) {
        const periodEnd = stripeSubscription.current_period_end
          ? new Date(stripeSubscription.current_period_end * 1000).toISOString()
          : null;

        try {
          await adminClient.from("subscriptions").upsert({
            user_id: userId,
            stripe_customer_id: typeof stripeSubscription.customer === "string" ? stripeSubscription.customer : null,
            stripe_subscription_id: stripeSubscription.id,
            stripe_price_id: stripeSubscription.items.data[0]?.price?.id ?? null,
            status: mapStatus(stripeSubscription.status),
            current_period_end: periodEnd,
            cancel_at_period_end: Boolean(stripeSubscription.cancel_at_period_end),
            updated_at: new Date().toISOString(),
          }, { onConflict: "user_id" });
        } catch {
          // non-blocking for webhook acknowledgment
        }
      }
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Erro no webhook Stripe";
    return new Response(JSON.stringify({ detail }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
