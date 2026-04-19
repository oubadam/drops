-- Canonical registry of coins created through drops (server insert on successful PumpPortal create).
-- Run in Supabase SQL editor or via supabase db push.

create table if not exists public.drop_launches (
  id uuid primary key default gen_random_uuid(),
  mint text not null unique,
  name text not null,
  symbol text not null,
  description text,
  image_url text,
  metadata_uri text,
  signature text,
  created_at timestamptz not null default now()
);

create index if not exists drop_launches_created_at_idx on public.drop_launches (created_at desc);

alter table public.drop_launches enable row level security;

-- Public read (anon + authenticated) for feeds; writes use service role only (bypasses RLS).
create policy "drop_launches_select_public"
  on public.drop_launches for select
  to anon, authenticated
  using (true);
