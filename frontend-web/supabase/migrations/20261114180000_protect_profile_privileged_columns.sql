-- Impede que o proprio usuario (chamadas do app, papeis authenticated/anon)
-- altere campos de privilegio do perfil: administrador, assinatura,
-- identificadores de pagamento e contador do limite diario.
-- O servidor (service_role) e o painel continuam podendo alterar.
-- Aplicada em producao em 2026-11-14.

create or replace function public.protect_profile_privileged_columns()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.role := 'user';
    new.subscription_status := 'free';
    new.interacoes_hoje := 0;
    new.data_interacoes := null;
    new.stripe_customer_id := null;
    new.stripe_subscription_id := null;
    new.apple_original_transaction_id := null;
    new.apple_product_id := null;
    return new;
  end if;

  new.role := old.role;
  new.subscription_status := old.subscription_status;
  new.interacoes_hoje := old.interacoes_hoje;
  new.data_interacoes := old.data_interacoes;
  new.stripe_customer_id := old.stripe_customer_id;
  new.stripe_subscription_id := old.stripe_subscription_id;
  new.apple_original_transaction_id := old.apple_original_transaction_id;
  new.apple_product_id := old.apple_product_id;
  return new;
end;
$$;

create trigger profiles_protect_privileged_columns
before insert or update on public.profiles
for each row execute function public.protect_profile_privileged_columns();

comment on function public.protect_profile_privileged_columns() is
  'Bloqueia alteracao, pelo proprio usuario, de role, assinatura, ids de pagamento e contador diario em profiles.';
