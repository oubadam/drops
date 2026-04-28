alter table public.drop_launches
  add column if not exists dev_buy_airdrop_enabled boolean not null default false,
  add column if not exists dev_buy_airdrop_bps int not null default 0,
  add column if not exists dev_buy_airdrop_supply_bps int not null default 0;

