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
const stripeCancelUrl = Deno.env.get("STRIPE_CANCEL_URL") ?? "";

const missingVars = [
  ["STRIPE_SECRET_KEY", stripeSecretKey],
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

    const { data: subscription, error: subscriptionError } = await adminClient
      .from("subscriptions")
      .select("stripe_customer_id")
      .eq("user_id", user.id)
      .maybeSingle();

    let stripeCustomerId: string | null = null;

    if (!subscriptionError && subscription?.stripe_customer_id) {
      stripeCustomerId = subscription.stripe_customer_id;
    }

    if (!stripeCustomerId && user.email) {
      const customers = await stripe!.customers.list({ email: user.email, limit: 1 });
      stripeCustomerId = customers.data[0]?.id ?? null;
    }

    if (!stripeCustomerId) {
      return new Response(JSON.stringify({ detail: "Assinatura não encontrada para esta conta" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const portalSession = await stripe!.billingPortal.sessions.create({
      customer: stripeCustomerId,
      return_url: stripeCancelUrl,
    });

    return new Response(JSON.stringify({ portal_url: portalSession.url }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const detail = error instanceof Error
      ? error.message
      : (typeof error === "object" && error !== null && "message" in error && typeof (error as { message?: unknown }).message === "string"
        ? String((error as { message?: string }).message)
        : "Erro ao abrir portal");
    return new Response(JSON.stringify({ detail }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
