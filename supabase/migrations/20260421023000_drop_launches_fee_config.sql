alter table public.drop_launches
  add column if not exists whitelist_wallets text[] not null default '{}',
  add column if not exists whitelist_fee_bps int not null default 0,
  add column if not exists holders_fee_bps int not null default 10000,
  add column if not exists holder_limit int not null default 100,
  add column if not exists fee_treasury_wallet text,
  add column if not exists fee_recipient_locked boolean not null default false;
