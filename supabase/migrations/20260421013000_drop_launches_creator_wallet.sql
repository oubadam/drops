alter table public.drop_launches
  add column if not exists creator_wallet text;

create index if not exists drop_launches_creator_wallet_idx
  on public.drop_launches (creator_wallet, created_at desc);
