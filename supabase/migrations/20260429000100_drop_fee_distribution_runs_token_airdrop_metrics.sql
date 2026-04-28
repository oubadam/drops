alter table public.drop_fee_distribution_runs
  add column if not exists buyback_lamports bigint not null default 0,
  add column if not exists token_airdrop_raw bigint not null default 0,
  add column if not exists token_airdrop_transfers_sent int not null default 0;

