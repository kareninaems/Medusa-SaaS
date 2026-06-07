// Required environment variables:
//   STRIPE_SECRET_KEY         — Stripe secret key (sk_live_... or sk_test_...)
//   STRIPE_PORTAL_RETURN_URL  — URL to return to after managing subscription
//   SUPABASE_URL              — auto-set in Edge Functions
//   SUPABASE_SERVICE_ROLE_KEY — service role key for admin DB access

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.3";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return json({ error: "Autorizacao ausente" }, 401);
  }
  const jwt = authHeader.slice(7);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
  const returnUrl = Deno.env.get("STRIPE_PORTAL_RETURN_URL") ?? Deno.env.get("STRIPE_CANCEL_URL") ?? "";

  if (!stripeSecretKey) {
    return json({ error: "Stripe nao configurado" }, 500);
  }

  const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  });
  const { data: { user }, error: userError } = await userClient.auth.getUser();
  if (userError || !user) {
    return json({ error: "Token invalido" }, 401);
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  const { data: profile, error: profileError } = await adminClient
    .from("profiles")
    .select("stripe_customer_id")
    .eq("id", user.id)
    .single();

  if (profileError) {
    return json({ error: "Falha ao carregar perfil" }, 500);
  }

  const customerId = profile?.stripe_customer_id;
  if (!customerId) {
    return json({ error: "Nenhuma assinatura ativa encontrada. Assine primeiro." }, 400);
  }

  const stripeAuth = `Basic ${btoa(stripeSecretKey + ":")}`;

  const portalRes = await fetch("https://api.stripe.com/v1/billing_portal/sessions", {
    method: "POST",
    headers: {
      Authorization: stripeAuth,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      customer: customerId,
      return_url: returnUrl,
    }),
  });

  if (!portalRes.ok) {
    const err = await portalRes.text();
    console.error("Stripe portal session error:", err);
    return json({ error: "Falha ao criar portal de assinatura", detail: err }, 500);
  }

  const session = await portalRes.json();
  return json({ url: session.url });
});
