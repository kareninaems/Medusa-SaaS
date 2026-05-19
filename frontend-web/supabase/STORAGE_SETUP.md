# Setup do upload opcional de PDF (Supabase)

## Objetivo
Habilitar upload opcional de PDF no onboarding, com bucket privado e isolamento por usuário.

Path obrigatório usado pelo app:

`user-documents/{user_id}/{document_id}.pdf`

No código, isso significa:
- bucket: `user-documents`
- object path: `{user_id}/{document_id}.pdf`

Campos de controle por documento (`user_documents`):
- `analysis_status` (`uploaded`, `awaiting_analysis`, `analyzed`, `error`)
- `analysis_consent_at` (nullable)
- `analysis_consent_version` (nullable)
- `deleted_at` (nullable, opcional)

---

## Opção A (rápida): SQL único

No Supabase Dashboard -> **SQL Editor** -> **New query**, execute:

`/app/frontend-web/supabase/storage_user_documents_setup.sql`

---

## Opção B (manual pelo painel + SQL de policy)

### 1) Criar bucket no painel
1. Abra Supabase Dashboard.
2. Vá em **Storage**.
3. Clique em **Create bucket**.
4. Nome: `user-documents`
5. **Public bucket = OFF** (privado).
6. Salve.

### 2) Criar tabela e RLS (`user_documents`)
No **SQL Editor**, execute o bloco da tabela/policies do arquivo:

`/app/frontend-web/supabase/storage_user_documents_setup.sql`

> Se você já executou uma versão anterior, rode novamente para aplicar as novas colunas de consentimento/status.

### 3) Criar policies do Storage
No **SQL Editor**, execute as policies `storage_user_documents_*` do mesmo arquivo.

---

## Checklist de validação

1. Logar com usuário A.
2. Fazer upload de PDF no onboarding.
3. Verificar registro em `public.user_documents` com `user_id` do usuário A.
4. Logar com usuário B e tentar acessar path do usuário A.
5. Resultado esperado: bloqueio por RLS/policy.

Se Storage ainda não estiver configurado, o app mostra:

`Armazenamento de documentos ainda não configurado. Você pode continuar sem PDF.`

E o usuário continua normalmente sem PDF (upload opcional).
