# Medusa SaaS Web (MVP)

Versão web incremental da Medusa, mantendo identidade do produto:
- visual escuro, simples, direto
- primeira experiência: onboarding → check-in energia → chat
- sem interface genérica de GPT/Gemini

## Stack
- React + TypeScript + Vite
- Supabase Auth (email/senha)
- Supabase Postgres + RLS
- Supabase Edge Function (`claude-proxy`) chamando Claude server-side

## 1) Rodar frontend local

```bash
cd /app/frontend-web
npm install
npm run dev -- --host 0.0.0.0 --port 3000
```

Abre em `http://localhost:3000`.

## 2) Variáveis de ambiente (frontend)

Arquivo: `.env`

```env
VITE_SUPABASE_URL=https://wdjaggnxdbbovupfzslj.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_ffwKLfMycG2gO0UzXIm9tg_c64pQJRn
VITE_SUPABASE_FUNCTION_NAME=claude-proxy
VITE_TERMS_VERSION=2026-05
VITE_PRIVACY_VERSION=2026-05
```

> Importante: usar apenas key publishable no frontend.

## 3) Criar schema e RLS no Supabase

No SQL Editor do Supabase, execute:

`/app/frontend-web/supabase/schema.sql`

Isso cria as tabelas:
- `profiles`
- `conversations`
- `messages`
- `memories`
- `audit_logs`

E ativa RLS para isolamento por usuário.

## 4) Deploy da Edge Function Claude

Pré-requisito: Supabase CLI autenticada no projeto `wdjaggnxdbbovupfzslj`.

```bash
cd /app/frontend-web
supabase link --project-ref wdjaggnxdbbovupfzslj
supabase functions deploy claude-proxy
```

### Secrets da função (server-side)

```bash
supabase secrets set ANTHROPIC_API_KEY="<SUA_CHAVE_ANTHROPIC>"
supabase secrets set ANTHROPIC_MODEL="claude-haiku-4-5-20251001"
supabase secrets set ANTHROPIC_PROMPT_CACHING="true"
```

Troca de modelo sem alterar código:
- exemplo Sonnet depois: `ANTHROPIC_MODEL=claude-sonnet-4-5-20250929`

## 5) Fluxo funcional do MVP

1. Login/cadastro via Supabase Auth
2. Onboarding cognitivo com:
   - `education_level`
   - `profession`
   - `routine` (days/start_time/end_time/variable_schedule/notes)
   - `constraints`
   - campos cognitivos/emocionais (`blockers`, `low_energy_works`, `guidance_style`, `known_patterns`, `never_do`)
3. Check-in de energia 1/2/3
4. Chat com Medusa via `claude-proxy`
5. Mensagens salvas por usuário
6. Memória inicial editável (`patterns`, `triggers`, `worked`, `didnt_work`, `context`)
7. Setup com reset de dados, status da conta e logout
8. Páginas legais: `/terms`, `/privacy`, `/crisis`
9. Aceite obrigatório de termos/privacidade no cadastro + registro em `profiles` e `user_consents`

## 6) Segurança aplicada

- RLS habilitado em todas as tabelas principais.
- Usuário acessa apenas dados próprios.
- Anthropic API key **não** vai para frontend.
- `claude-proxy` registra `audit_logs` com tokens e status, sem salvar conteúdo sensível.
