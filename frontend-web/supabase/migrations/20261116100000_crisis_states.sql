-- Estado do modo crise por usuario. Escrito somente pelas edge functions (service role).
-- O nivel fica no servidor para que fechar o app nao apague a trava.
create table if not exists public.crisis_states (
  user_id uuid primary key references auth.users(id) on delete cascade,
  level smallint not null default 0 check (level between 0 and 3),
  calm_count integer not null default 0 check (calm_count >= 0),
  safety_seen smallint not null default 0 check (safety_seen between 0 and 2),
  last_risk_at timestamptz,
  last_signal_at timestamptz,
  level_since timestamptz,
  last_risco smallint,
  last_seguranca smallint,
  updated_at timestamptz not null default now()
);

alter table public.crisis_states enable row level security;

-- RLS ligado e nenhuma policy: o navegador nao le nem escreve.
-- O app consulta o nivel pela edge function "avaliar-risco".
revoke all on public.crisis_states from anon, authenticated;
