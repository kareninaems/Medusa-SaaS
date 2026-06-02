-- Stripe integration columns for profiles table
-- Required env vars for Edge Functions:
--   STRIPE_SECRET_KEY, STRIPE_PRICE_ID, STRIPE_WEBHOOK_SECRET,
--   STRIPE_SUCCESS_URL, STRIPE_CANCEL_URL

alter table public.profiles add column if not exists stripe_customer_id text;
alter table public.profiles add column if not exists stripe_subscription_id text;
alter table public.profiles add column if not exists subscription_status text not null default 'free'
  check (subscription_status in ('free','trialing','active','past_due','canceled','incomplete'));
