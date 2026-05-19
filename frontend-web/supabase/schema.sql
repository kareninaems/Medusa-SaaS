-- Medusa SaaS Web - Schema inicial
-- Execute no SQL Editor do Supabase

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  display_name text,
  onboarding jsonb,
  energy_default int check (energy_default between 1 and 3),
  age_confirmed_at timestamptz,
  age_confirmed_version text,
  terms_accepted_at timestamptz,
  privacy_accepted_at timestamptz,
  terms_version text,
  privacy_version text
);

alter table public.profiles add column if not exists terms_accepted_at timestamptz;
alter table public.profiles add column if not exists privacy_accepted_at timestamptz;
alter table public.profiles add column if not exists terms_version text;
alter table public.profiles add column if not exists privacy_version text;
alter table public.profiles add column if not exists age_confirmed_at timestamptz;
alter table public.profiles add column if not exists age_confirmed_version text;

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  title text
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null,
  energy int check (energy between 1 and 3),
  mode text,
  created_at timestamptz not null default now()
);

create table if not exists public.memories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  patterns jsonb not null default '[]'::jsonb,
  triggers jsonb not null default '[]'::jsonb,
  worked jsonb not null default '[]'::jsonb,
  didnt_work jsonb not null default '[]'::jsonb,
  context jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.memories alter column context set default '{}'::jsonb;

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  model text not null,
  status text not null,
  input_tokens int,
  output_tokens int,
  cache_creation_tokens int,
  cache_read_tokens int
);

create table if not exists public.user_consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  terms_version text not null,
  privacy_version text not null,
  accepted_at timestamptz not null default now(),
  ip_hash text,
  user_agent text
);

create table if not exists public.user_documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  file_path text not null,
  file_name text,
  mime_type text,
  uploaded_at timestamptz not null default now(),
  extracted_summary text
);

create index if not exists conversations_user_id_idx on public.conversations(user_id);
create index if not exists messages_conversation_id_idx on public.messages(conversation_id);
create index if not exists messages_user_id_idx on public.messages(user_id);
create index if not exists memories_user_id_idx on public.memories(user_id);
create index if not exists audit_logs_user_id_idx on public.audit_logs(user_id);
create index if not exists user_consents_user_id_idx on public.user_consents(user_id);
create index if not exists user_documents_user_id_idx on public.user_documents(user_id);

alter table public.profiles enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.memories enable row level security;
alter table public.audit_logs enable row level security;
alter table public.user_consents enable row level security;
alter table public.user_documents enable row level security;

grant select, insert, update on public.profiles to authenticated;
grant select, insert, update, delete on public.conversations to authenticated;
grant select, insert, update, delete on public.messages to authenticated;
grant select, insert, update, delete on public.memories to authenticated;
grant select on public.audit_logs to authenticated;
grant select, insert on public.user_consents to authenticated;
grant select, insert, update, delete on public.user_documents to authenticated;

drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own
  on public.profiles
  for select
  using (id = auth.uid());

drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own
  on public.profiles
  for insert
  with check (id = auth.uid());

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own
  on public.profiles
  for update
  using (id = auth.uid())
  with check (id = auth.uid());

drop policy if exists conversations_all_own on public.conversations;
create policy conversations_all_own
  on public.conversations
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists messages_all_own on public.messages;
create policy messages_all_own
  on public.messages
  for all
  using (
    user_id = auth.uid()
    and exists (
      select 1 from public.conversations c
      where c.id = messages.conversation_id and c.user_id = auth.uid()
    )
  )
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.conversations c
      where c.id = messages.conversation_id and c.user_id = auth.uid()
    )
  );

drop policy if exists memories_all_own on public.memories;
create policy memories_all_own
  on public.memories
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists audit_logs_select_own on public.audit_logs;
create policy audit_logs_select_own
  on public.audit_logs
  for select
  using (user_id = auth.uid());

drop policy if exists user_consents_select_own on public.user_consents;
create policy user_consents_select_own
  on public.user_consents
  for select
  using (user_id = auth.uid());

drop policy if exists user_consents_insert_own on public.user_consents;
create policy user_consents_insert_own
  on public.user_consents
  for insert
  with check (user_id = auth.uid());

drop policy if exists user_documents_all_own on public.user_documents;
create policy user_documents_all_own
  on public.user_documents
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Storage (bucket privado para PDF/laudos)
-- Caso o bucket já exista, este insert não altera dados existentes.
insert into storage.buckets (id, name, public)
values ('user-documents', 'user-documents', false)
on conflict (id) do update set public = excluded.public;

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
