// Required environment variables:
//   STRIPE_SECRET_KEY     — Stripe secret key (sk_live_... or sk_test_...)
//   STRIPE_PRICE_ID       — Stripe Price ID for the monthly subscription
//   STRIPE_SUCCESS_URL    — Redirect URL on successful checkout
//   STRIPE_CANCEL_URL     — Redirect URL when user cancels checkout
//   SUPABASE_URL          — Supabase project URL (auto-set in Edge Functions)
//   SUPABASE_SERVICE_ROLE_KEY — Service role key for admin DB access

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
    return json({ error: "Missing authorization" }, 401);
  }
  const jwt = authHeader.slice(7);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY")!;
  const stripePriceId = Deno.env.get("STRIPE_PRICE_ID")!;
  const successUrl = Deno.env.get("STRIPE_SUCCESS_URL")!;
  const cancelUrl = Deno.env.get("STRIPE_CANCEL_URL")!;

  // Verify JWT and get user
  const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  });
  const { data: { user }, error: userError } = await userClient.auth.getUser();
  if (userError || !user) {
    return json({ error: "Invalid token" }, 401);
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  // Fetch profile to check for existing stripe_customer_id
  const { data: profile, error: profileError } = await adminClient
    .from("profiles")
    .select("stripe_customer_id")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    console.error("Profile query error:", profileError);
    return json({ error: "Failed to load profile" }, 500);
  }

  let customerId: string = profile?.stripe_customer_id ?? "";

  const stripeAuth = `Basic ${btoa(stripeSecretKey + ":")}`;

  // Create Stripe customer if needed
  if (!customerId) {
    const customerRes = await fetch("https://api.stripe.com/v1/customers", {
      method: "POST",
      headers: {
        Authorization: stripeAuth,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        email: user.email ?? "",
        "metadata[user_id]": user.id,
      }),
    });

    if (!customerRes.ok) {
      const err = await customerRes.text();
      console.error("Stripe create customer error:", err);
      return json({ error: "Failed to create Stripe customer", detail: err }, 500);
    }

    const customer = await customerRes.json();
    customerId = customer.id;

    // Save customer ID to profile
    const { error: updateError } = await adminClient
      .from("profiles")
      .update({ stripe_customer_id: customerId })
      .eq("id", user.id);

    if (updateError) {
      console.error("Failed to save stripe_customer_id:", updateError);
    }
  }

  // Create checkout session
  const checkoutParams = new URLSearchParams({
    mode: "subscription",
    "line_items[0][price]": stripePriceId,
    "line_items[0][quantity]": "1",
    customer: customerId,
    success_url: successUrl,
    cancel_url: cancelUrl,
    "metadata[user_id]": user.id,
  });

  const checkoutRes = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: stripeAuth,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: checkoutParams,
  });

  if (!checkoutRes.ok) {
    const err = await checkoutRes.text();
    console.error("Stripe checkout session error:", err);
    return json({ error: "Failed to create checkout session", detail: err }, 500);
  }

  const session = await checkoutRes.json();
  return json({ url: session.url });
});
