# PRD — Medusa SaaS B2C iOS-first

## Problem Statement
Transformar o Medusa em SaaS B2C individual com autenticação real, onboarding cognitivo por usuário, memória individual persistente, chat com IA, freemium + assinatura, e painel admin operacional.

## User Choices Confirmadas
- Times/membros no MVP: **apenas usuário individual**
- Gatilho principal de upgrade: **voz**
- Paywall: **leve no onboarding + forte no momento de limite/voz**
- IA: **camada multi-modelo desde o início**
- Chave IA: **EMERGENT_LLM_KEY (universal key)**

## Arquitetura
- **Frontend (Expo + TypeScript):** fluxo auth → onboarding → app principal com abas (Chat, Memória, Conta, Admin para usuários admin).
- **Backend (FastAPI):** auth/sessão JWT, onboarding, chat multi-modelo, memória, subscription Stripe, painel admin, exportação e exclusão de conta.
- **Database (MongoDB):** coleções `users`, `subscriptions`, `onboarding_profiles`, `conversations`, `memory_items`, `usage_events`, `admin_logs`, `password_resets`.

## Personas
1. **Usuário individual B2C:** quer suporte cognitivo e organização pessoal.
2. **Usuário freemium:** testa valor, encontra limite e converte via voz/premium.
3. **Operação/admin:** acompanha métricas, plano dos usuários e ações de suporte.

## Core Requirements (estáticos)
- Login/cadastro/recuperação de senha
- Sessão persistente por usuário
- Onboarding cognitivo individual
- Chat principal com contexto pessoal
- Memória separada por usuário
- Freemium + plano pago com gating
- Assinatura recorrente via Stripe
- Painel admin com visão operacional

## Implementado

### 2026-05-19 — Foundation SaaS + UX premium iOS-first
- Backend refeito com FastAPI para:
  - Auth completo (`/api/auth/register`, `/api/auth/login`, `/api/auth/me`, reset de senha)
  - Onboarding cognitivo por usuário (`/api/onboarding/questions`, `/api/onboarding/profile`)
  - Chat multi-modelo (`openai`, `anthropic`, `gemini`) com contexto + memória
  - Gating freemium (limite diário) e gatilho premium de voz
  - Memória individual (`/api/memory`)
  - Subscription APIs Stripe (`/api/subscription/me`, `/checkout`, `/portal`, `/webhook`)
  - Admin APIs (`/api/admin/overview`, `/api/admin/users`, `/api/admin/events`, ajuste manual de plano)
  - Privacidade LGPD base (`/api/account/export`, `/api/account/delete`)
- Frontend Expo iOS-first com interface calma/premium:
  - Tela de auth (login/cadastro/recuperação)
  - Onboarding progressivo
  - Chat principal com seletor multi-modelo e botão de voz
  - Paywall modal (onboarding + momento de uso)
  - Aba Memória (listar + criar memória manual)
  - Aba Conta (upgrade, cobrança, exportar dados, excluir conta, logout)
  - Aba Admin (métricas e suporte de plano)
- Sessão persistente implementada com `@/src/utils/storage` (SecureStore/AsyncStorage wrapper existente).
- Permissões mobile adicionadas no `app.json` para voz premium (`RECORD_AUDIO`, `NSMicrophoneUsageDescription`).

### 2026-05-19 — Medusa SaaS Web (incremental, sem destruir base atual)
- Criado novo projeto web isolado em `/app/frontend-web` preservando `/app/frontend` intacto.
- Implementado MVP web com fluxo de produto (sem landing de marketing):
  - Login/cadastro Supabase Auth (email + senha)
  - Onboarding com campos:
    - `education_level`
    - `profession`
    - `routine` (`days`, `start_time`, `end_time`, `variable_schedule`, `notes`)
    - `constraints`
  - Check-in de energia 1/2/3 antes do chat
  - Chat Medusa com modos `ACAO`, `FOCO`, `PROCESSO`, `TRAVA`
  - Placeholder de voz no composer (sem implementação de voz ainda)
  - Tela de memória (`patterns`, `triggers`, `worked`, `didnt_work`, `context`)
  - Setup/configurações (status de conta, reset de dados, logout)
- Implementado persistência por usuário no Supabase:
  - `profiles`, `conversations`, `messages`, `memories`, `audit_logs`
- Criado schema SQL + RLS em `/app/frontend-web/supabase/schema.sql` para isolamento multiusuário.
- Criada Edge Function server-side `claude-proxy` em `/app/frontend-web/supabase/functions/claude-proxy/`:
  - usa `ANTHROPIC_API_KEY` apenas em secret/env server-side
  - `ANTHROPIC_MODEL` configurável por env (default Haiku 4.5)
  - suporta prompt caching quando habilitado por env
  - registra `audit_logs` com status e tokens sem armazenar conteúdo sensível
- Criado system prompt separado em `/app/frontend-web/supabase/functions/claude-proxy/system_prompt.ts` com seções de identidade da Medusa.
- README de execução local e setup completo em `/app/frontend-web/README.md`.

## Status Atual por Fase
- **Fase 1 (Foundation SaaS):** concluída
- **Fase 2 (Onboarding + memória individual):** concluída no MVP
- **Fase 3 (Billing e planos):** parcialmente concluída (APIs prontas; depende de chaves Stripe)
- **Fase 4 (Admin panel):** concluída em versão MVP mobile/admin interno
- **Fase 5 (Hardening):** parcialmente iniciada (logs, export/delete, falta observabilidade avançada)

## Backlog Priorizado

### P0 (próximo passo imediato)
1. Executar `/app/frontend-web/supabase/schema.sql` no projeto Supabase e validar RLS em produção.
2. Publicar `claude-proxy` e configurar secrets (`ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`, `ANTHROPIC_PROMPT_CACHING`).
3. Validar fluxo real fim-a-fim (cadastro → onboarding → check-in → chat → memória) com dados reais.

### P1
1. Implementar voz real no chat (captura + STT/TTS) mantendo identidade da Medusa.
2. Implementar consolidação automática de memória com função dedicada.
3. Integrar calendário para sincronização de energia, rotina e agenda.

### P2
1. Política de retenção avançada + anonimização.
2. Auditoria detalhada por ação crítica.
3. Preparar estrutura para futura expansão family plan/B2B.

## Next Tasks List
1. Rodar SQL de schema e políticas no Supabase alvo.
2. Deploy da Edge Function `claude-proxy` com secrets.
3. Testar onboarding novo (escolaridade/profissão/rotina/restrições) impactando respostas do Claude.
4. Evoluir para memória automática e integração de calendário.