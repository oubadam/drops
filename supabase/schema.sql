create table if not exists campaigns (
  mint text primary key,
  creator_wallet text not null,
  whitelist_percent int not null default 0,
  distribution_mode text not null,
  whitelist_wallets text[] not null default '{}',
  created_at timestamptz not null default now()
);

create table if not exists airdrop_runs (
  id uuid primary key default gen_random_uuid(),
  mint text not null references campaigns(mint) on delete cascade,
  run_at timestamptz not null default now(),
  creator_fee_sol numeric not null default 0,
  claim_tx text,
  buyback_tx text,
  holders_percent int not null,
  whitelist_percent int not null,
  recipients_count int not null default 0,
  total_tokens_distributed numeric not null default 0,
  status text not null,
  error text
);

create table if not exists pending_signature_jobs (
  id uuid primary key default gen_random_uuid(),
  mint text not null references campaigns(mint) on delete cascade,
  creator_wallet text not null,
  unsigned_transactions text[] not null default '{}',
  created_at timestamptz not null default now(),
  status text not null
);
