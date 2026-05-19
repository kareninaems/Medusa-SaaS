-- Configuração de Storage e tabela para upload opcional de PDF
-- Execute no Supabase SQL Editor (projeto correto)

create extension if not exists pgcrypto;

create table if not exists public.user_documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  file_path text not null,
  file_name text,
  mime_type text,
  uploaded_at timestamptz not null default now(),
  extracted_summary text
);

create index if not exists user_documents_user_id_idx on public.user_documents(user_id);

alter table public.user_documents enable row level security;
grant select, insert, update, delete on public.user_documents to authenticated;

drop policy if exists user_documents_all_own on public.user_documents;
create policy user_documents_all_own
  on public.user_documents
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Bucket privado para documentos do usuário
insert into storage.buckets (id, name, public)
values ('user-documents', 'user-documents', false)
on conflict (id) do update set public = excluded.public;

-- Path obrigatório no app: {user_id}/{document_id}.pdf
-- Exemplo completo no bucket: user-documents/{user_id}/{document_id}.pdf

drop policy if exists storage_user_documents_select_own on storage.objects;
create policy storage_user_documents_select_own
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'user-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists storage_user_documents_insert_own on storage.objects;
create policy storage_user_documents_insert_own
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'user-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists storage_user_documents_update_own on storage.objects;
create policy storage_user_documents_update_own
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'user-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'user-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists storage_user_documents_delete_own on storage.objects;
create policy storage_user_documents_delete_own
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'user-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
