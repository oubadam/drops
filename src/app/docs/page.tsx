import Link from "next/link";

export default function DocsPage() {
  return (
    <article className="mx-auto max-w-2xl space-y-8 px-1 pb-20 text-sm leading-relaxed text-[var(--pump-muted)]">
      <div>
        <h1 className="border-b-2 border-b-[var(--pump-yellow)]/70 pb-1 text-3xl font-black tracking-tight text-[var(--pump-text)]">
          Docs
        </h1>
        <p className="mt-4">
          drop creates pump.fun coins through{" "}
          <a href="https://pumpportal.fun/creation" className="font-medium text-[var(--pump-green)] hover:underline" target="_blank" rel="noopener noreferrer">
            PumpPortal token creation
          </a>{" "}
          and Pinata for IPFS metadata, matching the official flow.
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="border-l-2 border-l-[var(--pump-yellow)] pl-3 text-lg font-bold text-[var(--pump-text)]">
          Environment variables
        </h2>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <code className="rounded bg-[var(--pump-surface)] px-1.5 py-0.5 text-[var(--pump-green)]">PUMPPORTAL_API_KEY</code> — from
            PumpPortal (server only).
          </li>
          <li>
            <code className="rounded bg-[var(--pump-surface)] px-1.5 py-0.5 text-[var(--pump-green)]">PINATA_JWT</code> — Pinata API JWT
            for <code className="text-[var(--pump-text)]">uploads.pinata.cloud/v3/files</code> (server only).
          </li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="border-l-2 border-l-[var(--pump-yellow)] pl-3 text-lg font-bold text-[var(--pump-text)]">
          What happens on Create
        </h2>
        <ol className="list-decimal space-y-2 pl-5">
          <li>A new mint keypair is generated on the server (not shown in the UI).</li>
          <li>Your image (and optional banner) is uploaded to Pinata; you get IPFS CIDs.</li>
          <li>
            Metadata JSON{" "}
            <code className="text-[var(--pump-text)]">{"{ name, symbol, image, description, twitter, telegram, website }"}</code> is
            uploaded to Pinata.
          </li>
          <li>
            drop calls{" "}
            <code className="text-[var(--pump-text)]">POST https://pumpportal.fun/api/trade?api-key=…</code> with{" "}
            <code className="text-[var(--pump-text)]">action: &quot;create&quot;</code> and the metadata URI, as in the PumpPortal
            lightning example.
          </li>
          <li>The mint address and transaction signature (if returned) are stored in your browser for the Profile page.</li>
        </ol>
      </section>

      <section className="space-y-3">
        <h2 className="border-l-2 border-l-[var(--pump-yellow)] pl-3 text-lg font-bold text-[var(--pump-text)]">
          Security notes
        </h2>
        <ul className="list-disc space-y-2 pl-5">
          <li>Never commit API keys. Use <code className="text-[var(--pump-text)]">.env.local</code> locally and Vercel env in production.</li>
          <li>The lightning flow sends the mint keypair secret to PumpPortal for that request only — it is not stored by drop.</li>
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
