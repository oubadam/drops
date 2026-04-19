# drop MVP

`drop` is a Next.js + TypeScript MVP for creator-fee buybacks and token airdrops on Solana.

Every 10 minutes, each registered campaign runs:
1. Claim creator fees from PumpPortal
2. Buy back token supply
3. Queue airdrop transactions for local signing

## Pages

- `/` landing page
- `/launch` register coin + frozen whitelist config
- `/campaign/[mint]` public proof page
- `/dashboard` creator campaign list

## Local setup

1. Install dependencies:

```bash
npm install
```

2. Copy env file:

```bash
cp .env.example .env.local
```

3. Fill env values (Supabase, Helius, PumpPortal, secrets).

4. Start app:

```bash
npm run dev
```

## Cron

`vercel.json` is configured for `*/10 * * * *` hitting:

- `GET /api/cron/run`

Use `CRON_SECRET` and pass `Authorization: Bearer <secret>` from Vercel.

## Local signer flow (no private keys on server)

The server stores unsigned tx payloads in `pending_signature_jobs`.
Creator runs:

```bash
CREATOR_WALLET=<wallet> API_BASE_URL=http://localhost:3000 npm run signer
```

This polls `GET /api/signer/pending?wallet=...`, signs locally (placeholder in MVP script), and submits via `POST /api/signer/submit`.

## Supabase schema

Run SQL in `supabase/schema.sql` to create:
- `campaigns`
- `airdrop_runs`
- `pending_signature_jobs`

## Notes

- MVP has **no platform cut**: 100% creator fees are recycled.
- Whitelist is capped at 50% and max 25 wallets.
- Creator wallet cannot be whitelisted.
- If env keys are missing, API clients return mock data for UI/dev testing.
