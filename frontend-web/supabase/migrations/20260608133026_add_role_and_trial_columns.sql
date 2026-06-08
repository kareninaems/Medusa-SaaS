alter table public.profiles add column if not exists role text default 'user';
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check check (role in ('user', 'admin'));

alter table public.profiles add column if not exists interacoes_hoje int default 0;
alter table public.profiles add column if not exists data_interacoes date;
