import Link from "next/link";

export default function DocsPage() {
  return (
    <article className="mx-auto max-w-3xl space-y-8 px-1 pb-20 text-sm leading-relaxed text-[var(--pump-muted)]">
      <div>
        <h1 className="border-b-2 border-b-[var(--pump-yellow)]/70 pb-1 text-3xl font-black tracking-tight text-[var(--pump-text)]">
          Docs
        </h1>
        <p className="mt-4">
          drops is a launch platform where creators can create coins, route creator fees to a protected treasury wallet,
          and auto-distribute payouts to configured wallets and top holders.
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="border-l-2 border-l-[var(--pump-yellow)] pl-3 text-lg font-bold text-[var(--pump-text)]">
          Quick start
        </h2>
        <ol className="list-decimal space-y-2 pl-5">
          <li>
            Connect your wallet from the top-right profile area.
          </li>
          <li>
            Go to <Link href="/create" className="text-[var(--pump-green)] hover:underline">Create</Link> and enter coin name, ticker, image, and links.
          </li>
          <li>Add 1 to 25 airdrop wallets (one wallet per input).</li>
          <li>Set the creator-fee split slider for whitelist vs holders.</li>
          <li>Launch coin and track it in Home, Explore, and Profile.</li>
        </ol>
      </section>

      <section className="space-y-3">
        <h2 className="border-l-2 border-l-[var(--pump-yellow)] pl-3 text-lg font-bold text-[var(--pump-text)]">
          How fee payouts work (simple)
        </h2>
        <ol className="list-decimal space-y-2 pl-5">
          <li>Creator fees are routed to one treasury wallet configured by drops.</li>
          <li>Every 5 minutes, drops claims creator fees for each launched coin.</li>
          <li>A configured percentage is split equally between your whitelist wallets.</li>
          <li>The rest is distributed to top 100 holders, weighted by holding amount.</li>
        </ol>
      </section>

      <section className="space-y-3">
        <h2 className="border-l-2 border-l-[var(--pump-yellow)] pl-3 text-lg font-bold text-[var(--pump-text)]">
          What the tech does behind the scenes
        </h2>
        <ul className="list-disc space-y-2 pl-5">
          <li>Uploads your coin image/metadata to IPFS for a permanent token profile.</li>
          <li>Creates the token through PumpPortal.</li>
          <li>Stores launch settings in the drops backend database.</li>
          <li>Runs an automated payout job every 5 minutes.</li>
          <li>Shows created coins in the website feed and profile views.</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="border-l-2 border-l-[var(--pump-yellow)] pl-3 text-lg font-bold text-[var(--pump-text)]">
          Notes
        </h2>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            Launch settings are locked by the platform config to keep fee routing safe and consistent.
          </li>
          <li>Always verify wallets before launch; payouts are automated from saved launch settings.</li>
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
