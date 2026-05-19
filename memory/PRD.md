# PRD — Medusa Web SaaS (frontend-web ativo)

## Problem Statement
Construir a versão Web SaaS da Medusa em `/app/frontend-web` (React + Vite + Supabase), mantendo `/app/frontend` intacto como backup. O produto deve oferecer onboarding cognitivo guiado, check-in de energia, chat persistente, consentimento legal e UX acessível para usuários neurodivergentes.

## Arquitetura Atual
- **Frontend ativo:** React + Vite + TypeScript (`/app/frontend-web`)
- **Auth/DB/Storage/Serverless:** Supabase Auth + Postgres + Storage + Edge Function
- **Edge Function:** `claude-proxy` (sem alteração de prompt/chat nesta tarefa)
- **Tema UI:** warm paper (`#F4F1EA`) + calm green (`#4F8A72`), baixo estímulo, contraste AA

## Implementado

### Base já existente (antes desta iteração)
- Fluxo completo: Auth → Consentimento legal → Onboarding → Check-in → Chat.
- Persistência por usuário com RLS (`profiles`, `conversations`, `messages`, `memories`, `audit_logs`, `user_consents`).
- Páginas legais (`/terms`, `/privacy`, `/crisis`).

### Iteração atual — Onboarding guiado + 18+ + upload opcional de PDF
- **Segurança 18+:**
  - Checkbox obrigatório no cadastro: “Declaro que tenho 18 anos ou mais.”
  - Gate de idade antes do onboarding (`AgeGate`) para bloquear continuidade sem confirmação.
  - Persistência alvo em `profiles.age_confirmed_at` e `profiles.age_confirmed_version = "2026-05"`.
  - Compatibilidade temporária: se colunas ainda não existirem no ambiente, usa fallback em `onboarding.age_confirmed` sem quebrar fluxo.

- **Onboarding convertido para fluxo guiado (baixa carga cognitiva):**
  - Passos com **chips/selects/opções** e “Outro” condicional.
  - Etapas: identidade/contexto, rotina, restrições, travas, energia baixa, estilo de orientação, limites da Medusa.
  - Sem obrigar texto longo.

- **Upload de PDF/laudo opcional no onboarding (etapa final):**
  - Input de arquivo PDF + botão de upload explícito.
  - Sem envio automático para Claude.
  - Mensagem de uso seguro (evitar documentos de terceiros).

- **Schema SQL atualizado (`/app/frontend-web/supabase/schema.sql`):**
  - `profiles`: `age_confirmed_at`, `age_confirmed_version`
  - Nova tabela `user_documents` + índice
  - RLS `user_documents` por `user_id = auth.uid()`
  - Políticas de Storage para bucket privado `user-documents` (path por usuário)

- **Termos atualizados:**
  - Seção explícita de faixa etária 18+ no `/terms`.

- **Hardening de testabilidade/acessibilidade:**
  - `data-testid` adicionado nos controles críticos (auth, age gate, consent, onboarding, check-in, settings/legal).
  - Botões ajustados para touch target mínimo de 44px.

## Testes realizados
- Bloqueio sem checkbox 18+ validado.
- Fluxo 18+ → onboarding guiado → check-in validado (desktop/mobile).
- Persistência de onboarding validada (relogin cai no check-in, sem retornar para onboarding).
- Upload PDF testado em UI.
- **Status upload no ambiente atual:** `Bucket not found` quando bucket/migration não aplicados no Supabase alvo.

## Backlog Priorizado

### P0
1. Executar `frontend-web/supabase/schema.sql` no Supabase de produção/dev ativo.
2. Confirmar bucket privado `user-documents` criado e políticas de Storage/RLS ativas.
3. Revalidar upload PDF com sucesso ponta a ponta após migration.

### P1
1. Exibir lista de documentos enviados (metadata `user_documents`) na UI.
2. Fluxo explícito de consentimento por documento antes de qualquer análise por IA.
3. Limpeza de documentos no reset (metadata + arquivo no bucket).

### P2
1. Extração de resumo de PDF (`extracted_summary`) com consentimento explícito.
2. Daily Summary / extração automática de evidências do chat.
3. Voz (placeholder atual) com UX acessível e sem sobrecarga sensorial.