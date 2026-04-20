create table if not exists public.drop_profiles (
  wallet_address text primary key,
  username text not null,
  bio text not null default '',
  avatar_url text not null default '',
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists drop_profiles_updated_at_idx on public.drop_profiles (updated_at desc);

alter table public.drop_profiles enable row level security;

create policy "drop_profiles_select_public"
  on public.drop_profiles for select
  to anon, authenticated
  using (true);
