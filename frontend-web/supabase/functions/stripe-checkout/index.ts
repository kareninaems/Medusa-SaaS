import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.3";
import Stripe from "https://esm.sh/stripe@15.1.0?target=deno";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
const stripePriceId = Deno.env.get("STRIPE_PRICE_ID") ?? "";
const stripeSuccessUrl = Deno.env.get("STRIPE_SUCCESS_URL") ?? "";
const stripeCancelUrl = Deno.env.get("STRIPE_CANCEL_URL") ?? "";

const missingVars = [
  ["STRIPE_SECRET_KEY", stripeSecretKey],
  ["STRIPE_PRICE_ID", stripePriceId],
  ["STRIPE_SUCCESS_URL", stripeSuccessUrl],
  ["STRIPE_CANCEL_URL", stripeCancelUrl],
].filter(([, value]) => !value).map(([name]) => name);

const stripe = stripeSecretKey
  ? new Stripe(stripeSecretKey, { apiVersion: "2024-06-20" })
  : null;

const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

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
    const authHeader = request.headers.get("Authorization") || "";
    if (!authHeader) {
      return new Response(JSON.stringify({ detail: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ detail: "Token inválido" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await request.json().catch(() => ({}));
    const successUrl = typeof body?.success_url === "string" && body.success_url.trim()
      ? body.success_url.trim()
      : stripeSuccessUrl;
    const cancelUrl = typeof body?.cancel_url === "string" && body.cancel_url.trim()
      ? body.cancel_url.trim()
      : stripeCancelUrl;

    const { data: existingSub } = await adminClient
      .from("subscriptions")
      .select("stripe_customer_id")
      .eq("user_id", user.id)
      .maybeSingle();

    let stripeCustomerId = existingSub?.stripe_customer_id || null;
    if (!stripeCustomerId) {
      const createdCustomer = await stripe!.customers.create({
        email: user.email || undefined,
        metadata: { user_id: user.id },
      });
      stripeCustomerId = createdCustomer.id;
    }

    const checkoutSession = await stripe!.checkout.sessions.create({
      mode: "subscription",
      customer: stripeCustomerId,
      line_items: [{ price: stripePriceId, quantity: 1 }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        user_id: user.id,
      },
      subscription_data: {
        metadata: {
          user_id: user.id,
        },
      },
    });

    try {
      await adminClient.from("subscriptions").upsert({
        user_id: user.id,
        stripe_customer_id: stripeCustomerId,
        status: "pending",
        stripe_price_id: stripePriceId,
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id" });
    } catch {
      // non-blocking: checkout deve continuar funcionando mesmo sem tabela de subscriptions
    }

    return new Response(JSON.stringify({
      checkout_url: checkoutSession.url,
      session_id: checkoutSession.id,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const detail = error instanceof Error
      ? error.message
      : (typeof error === "object" && error !== null && "message" in error && typeof (error as { message?: unknown }).message === "string"
        ? String((error as { message?: string }).message)
        : "Erro ao criar checkout");
    return new Response(JSON.stringify({ detail }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
