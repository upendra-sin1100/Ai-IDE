-- Run this once in the Supabase SQL editor.
create table if not exists public.workspace_files (
  user_id uuid not null references auth.users(id) on delete cascade,
  path text not null,
  content text not null default '',
  is_dir boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, path)
);

alter table public.workspace_files enable row level security;

create policy "Users can manage their own workspace files"
  on public.workspace_files for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);