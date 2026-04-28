alter table public.drop_launches
  add column if not exists dev_buy_airdrop_wallet_bps jsonb not null default '[]'::jsonb;

