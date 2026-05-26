# PRD — Medusa Web SaaS (frontend-web ativo)

## Problem Statement
Construir a versão Web SaaS da Medusa em `/app/frontend-web` (React + Vite + Supabase), mantendo `/app/frontend` intacto como backup. O produto deve oferecer onboarding cognitivo guiado, check-in de energia, chat persistente, consentimento legal e UX acessível para usuários neurodivergentes.

## Arquitetura Atual
- **Frontend ativo:** React + Vite + TypeScript (`/app/frontend-web`)
- **Auth/DB/Storage/Serverless:** Supabase Auth + Postgres + Storage + Edge Function
- **Edge Function:** `claude-proxy` (sem alteração de prompt/chat nesta tarefa)
- **Tema UI:** warm paper (`#F4F1EA`) + calm green (`#4F8A72`), baixo estímulo, contraste AA

## Implementado

### Iteração atual — “Transformar em realidade” (fundação funcional)
- **Estado ativo visível no topo** com indicador persistente: `Estado atual: <loop>`.
- **Memória visível ao usuário** no chat (`Memória visível da Medusa`) com highlights de padrões/gatilhos/estratégias que funcionam.
- **Resumo de carga semanal** no chat com contagem de dias de energia baixa.
- **Sinal precoce de pré-BURNOUT** quando os últimos 3 dias registrados ficam em energia baixa.
- **Follow-up automático de evidência** preparado (extração de ação da sessão anterior + respostas rápidas `sim/parcial/não`).
- Backend Supabase client estendido com funções para:
  - leitura de conversa anterior,
  - leitura da última mensagem de assistente,
  - leitura de sinais recentes por usuário.

### Iteração atual — Isolamento de sessão por check-in (P0)
- **Nova conversa criada somente no check-in concluído** (não no login/reload).
- **Login/reload no mesmo dia reutiliza a conversa ativa do dia** sem exigir novo check-in.
- **Novo check-in inicia chat limpo** (estado de mensagens vazio na UI) preservando histórico no banco.
- `App.tsx` atualizado para:
  - usar `getLatestConversation` no bootstrap;
  - reusar conversa apenas quando `created_at` é do dia atual;
  - criar `createConversation(...)` ao confirmar check-in;
  - carregar mensagens apenas da conversa ativa.
- `medusa.ts` atualizado com `getLatestConversation(userId)`.

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

### Iteração atual — Setup Documentos + consentimento explícito + memória por opções
- **Setup > Documentos:**
  - Lista de PDFs enviados por usuário com nome, data e status.
  - Status suportados: `uploaded`, `awaiting_analysis`, `analyzed`, `error`.
  - Exclusão por item remove metadata (`user_documents`) + arquivo em Storage.
- **Consentimento explícito por documento:**
  - Campos em `user_documents`: `analysis_consent_at`, `analysis_consent_version`.
  - Ao consentir: status muda para `awaiting_analysis` e versão `2026-05` é persistida.
  - Sem consentimento, não há análise automática de documento.
- **Memória no Setup (preferência do usuário):**
  - Conversão de caixas de texto para opções/chips com `Outro` opcional.
  - Mantida persistência no mesmo formato (`patterns`, `triggers`, `worked`, `didnt_work`, `context`).

### Iteração atual — Onboarding inicial restaurado (nome + gênero)
- Reintroduzida a etapa inicial do onboarding: “Como você quer ser chamada(o)?”.
- Campo de **gênero** adicionado nesta etapa inicial (`Mulher`, `Homem`, `Não-binário`, `Prefiro não informar`, `Outro`).
- Persistência no onboarding: `gender` e `gender_other`.

### Iteração atual — Chat usando onboarding + laudos com consentimento
- Corrigido contexto enviado ao `claude-proxy` para sempre incluir onboarding atual (inclusive campos novos).
- Adicionado contexto de documentos consentidos no payload do chat (`documents`).
- `claude-proxy` agora monta bloco de contexto com:
  - perfil onboarding normalizado
  - memória persistente
  - documentos com consentimento e resumo extraído
- Sem consentimento do documento, ele não entra no contexto do chat.
- Upload agora tenta extrair resumo textual básico do PDF no frontend para `extracted_summary`.

### Iteração atual — Correção crítica de crise (suicídio/autolesão)
- `claude-proxy` agora detecta sinais de crise em mensagens do usuário antes da chamada ao modelo.
- Em crise, retorna sempre HTTP 200 com fallback seguro em pt-BR (sem 4xx/5xx para esse fluxo).
- Se houver falha inesperada durante crise, aplica fallback local da Edge Function (`crisis_fallback`) com 200.
- Frontend: em erro genérico da edge + texto de crise, injeta resposta segura e não exibe apenas erro técnico.
- `audit_logs`: registra `crisis_detected` / `crisis_fallback` sem persistir conteúdo sensível completo.

### Iteração atual — PWA básico (frontend-web)
- Adicionado `manifest.webmanifest` com `name/short_name=Medusa`, `display=standalone`, `start_url=/`, `scope=/`, `theme/background=#F4F1EA`.
- Adicionadas tags PWA no `index.html` (manifest, theme-color, metas Apple e apple-touch-icon).
- Criados ícones simples em `public/icons` (`192x192`, `512x512`, `180x180`) com estilo papel quente + monograma.
- Service worker mínimo e seguro (`public/sw.js`) sem cache de dados privados, sem cache de chat, PDFs ou chamadas Supabase/Edge.
- Registro do SW adicionado em `src/main.tsx`.

## Testes realizados
- Bloqueio sem checkbox 18+ validado.
- Fluxo 18+ → onboarding guiado → check-in validado (desktop/mobile).
- Persistência de onboarding validada (relogin cai no check-in, sem retornar para onboarding).
- Upload PDF validado com bucket privado e RLS.
- Consentimento por documento validado (`analysis_status` → `awaiting_analysis`, `analysis_consent_at`, `analysis_consent_version=2026-05`).
- Exclusão validada (metadata removida e arquivo inexistente após delete).
- Isolamento A/B validado para metadata e acesso a arquivo no Storage.
- Memória por opções/chips validada na UI e persistência em `memories` confirmada.

## Backlog Priorizado

### P0
1. Executar `frontend-web/supabase/schema.sql` no Supabase de produção/dev ativo.
2. Confirmar bucket privado `user-documents` criado e políticas de Storage/RLS ativas.
3. Revalidar upload PDF com sucesso ponta a ponta após migration.

### P1
1. Integração Stripe mensal (checkout + webhook + portal) — **não iniciada nesta rodada**.
2. Exibir badge visual mais forte para documento com consentimento registrado.
3. Soft delete opcional com `deleted_at` (em vez de hard delete) para trilha de auditoria.
4. Tela de detalhes por documento (sem IA) com histórico de mudanças de status.

### P2
1. Extração de resumo de PDF (`extracted_summary`) com consentimento explícito.
2. Daily Summary / extração automática de evidências do chat.
3. Voz (placeholder atual) com UX acessível e sem sobrecarga sensorial.