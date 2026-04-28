import Link from "next/link";

export default function DocsPage() {
  return (
    <article className="mx-auto max-w-3xl space-y-8 px-1 pb-20 text-sm leading-relaxed text-[var(--pump-muted)]">
      <div>
        <h1 className="border-b-2 border-b-[var(--pump-yellow)]/70 pb-1 text-3xl font-black tracking-tight text-[var(--pump-text)]">
          Docs
        </h1>
        <p className="mt-4">
          Drops is an immutable airdrop protocol for Pump.fun launches. You launch through Drops, then creator-fee payouts are
          claimed and distributed automatically by the protocol rules saved at launch time.
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="border-l-2 border-l-[var(--pump-yellow)] pl-3 text-lg font-bold text-[var(--pump-text)]">
          Quick start
        </h2>
        <ol className="list-decimal space-y-2 pl-5">
          <li>Connect your wallet from the top-right profile area.</li>
          <li>
            Go to <Link href="/create" className="text-[var(--pump-green)] hover:underline">Create</Link> and enter coin name, ticker, media, and socials.
          </li>
          <li>Add 1 to 25 payout wallets (whitelist).</li>
          <li>Set the whitelist vs holders split.</li>
          <li>Launch and track in Home, Explore, Token pages, and Profile.</li>
        </ol>
      </section>

      <section className="space-y-3">
        <h2 className="border-l-2 border-l-[var(--pump-yellow)] pl-3 text-lg font-bold text-[var(--pump-text)]">
          How it works
        </h2>
        <ol className="list-decimal space-y-2 pl-5">
          <li>Launch parameters are stored by the protocol and treated as immutable runtime config.</li>
          <li>Creator fees are claimed via the configured worker flow.</li>
          <li>Whitelist share is split equally across valid configured whitelist wallets.</li>
          <li>Holders share is split by token balance weight across top holders (up to configured limit).</li>
          <li>Payout runs are recorded and surfaced in app metrics.</li>
        </ol>
      </section>

      <section className="space-y-3">
        <h2 className="border-l-2 border-l-[var(--pump-yellow)] pl-3 text-lg font-bold text-[var(--pump-text)]">
          Current protocol defaults
        </h2>
        <p>
          The payout interval displayed in the app defaults to 5 minutes unless changed by configuration. Holder distribution
          uses weighted balances and a capped holder set for efficiency.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="border-l-2 border-l-[var(--pump-yellow)] pl-3 text-lg font-bold text-[var(--pump-text)]">
          What Home metrics mean
        </h2>
        <ul className="list-disc space-y-2 pl-5">
          <li><span className="font-semibold text-[var(--pump-text)]">Tokens launched</span>: launchpad coins recorded by the backend.</li>
          <li><span className="font-semibold text-[var(--pump-text)]">Token payouts</span>: launch-derived token distribution metric shown in millions.</li>
          <li><span className="font-semibold text-[var(--pump-text)]">SOL airdropped</span>: summed on-chain payout amounts recorded by payout runs.</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="border-l-2 border-l-[var(--pump-yellow)] pl-3 text-lg font-bold text-[var(--pump-text)]">
          Operational checklist
        </h2>
        <ul className="list-disc space-y-2 pl-5">
          <li>Use valid payout wallets before launching (double-check addresses).</li>
          <li>Keep treasury config valid so claim/distribution jobs can execute.</li>
          <li>After config changes, restart the app and verify the Home metrics/API health.</li>
        </ul>
      </section>

      <p>
        <Link href="/create" className="font-semibold text-[var(--pump-green)] hover:underline">
          → Create a coin
        </Link>
      </p>
    </article>
  );
}
