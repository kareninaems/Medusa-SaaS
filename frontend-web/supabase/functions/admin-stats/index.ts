import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
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

    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser();

    if (userError || !user) {
      return new Response(JSON.stringify({ detail: "Token inválido" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: profile, error: profileError } = await adminClient
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) throw profileError;
    if ((profile?.role ?? "user") !== "admin") {
      return new Response(JSON.stringify({ detail: "Acesso restrito ao admin." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { count: usuarios, error: usuariosError } = await adminClient
      .from("profiles")
      .select("id", { count: "exact", head: true });
    if (usuariosError) throw usuariosError;

    const { count: assinantes, error: assinantesError } = await adminClient
      .from("subscriptions")
      .select("user_id", { count: "exact", head: true })
      .eq("status", "active");

    if (assinantesError) {
      const msg = assinantesError.message.toLowerCase();
      if (!msg.includes("subscriptions")) {
        throw assinantesError;
      }
    }

    const seteDiasAtras = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { count: trial, error: trialError } = await adminClient
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .gte("created_at", seteDiasAtras)
      .neq("role", "admin");
    if (trialError) throw trialError;

    return new Response(
      JSON.stringify({
        usuarios: usuarios ?? 0,
        assinantes: assinantes ?? 0,
        trial: trial ?? 0,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Erro ao carregar painel admin";
    return new Response(JSON.stringify({ detail }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
