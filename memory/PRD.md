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

## Status Atual por Fase
- **Fase 1 (Foundation SaaS):** concluída
- **Fase 2 (Onboarding + memória individual):** concluída no MVP
- **Fase 3 (Billing e planos):** parcialmente concluída (APIs prontas; depende de chaves Stripe)
- **Fase 4 (Admin panel):** concluída em versão MVP mobile/admin interno
- **Fase 5 (Hardening):** parcialmente iniciada (logs, export/delete, falta observabilidade avançada)

## Backlog Priorizado

### P0 (próximo passo imediato)
1. Configurar `STRIPE_SECRET_KEY`, `STRIPE_PRICE_PAID`, `STRIPE_WEBHOOK_SECRET` para ativar checkout real.
2. Conectar webhook Stripe em ambiente externo e validar ciclo completo (active/past_due/canceled).
3. Substituir reset de senha por e-mail transacional (Resend/SendGrid) mantendo UX atual.

### P1
1. Implementar voz real (captura + STT/TTS) para o recurso premium.
2. Melhorar política de memória (tipagem automática, score dinâmico, retenção inteligente).
3. Expandir dashboard admin com retenção, churn e conversão por período.

### P2
1. Política de retenção avançada + anonimização.
2. Auditoria detalhada por ação crítica.
3. Preparar estrutura para futura expansão family plan/B2B.

## Next Tasks List
1. Ativar Stripe em produção de teste (chaves + webhook).
2. Validar upgrade/paywall end-to-end no app.
3. Integrar e-mail de recuperação e notificações de billing.
4. Evoluir voz premium para experiência completa (gravação + resposta falada).