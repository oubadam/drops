"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { mintGradient, mintSparkPoints, sparkLinePathD } from "@/lib/mint-visual";
import { prependCreatedCoin } from "@/lib/created-coins-storage";

export default function CreateTokenPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [description, setDescription] = useState("");
  const [website, setWebsite] = useState("");
  const [twitter, setTwitter] = useState("");
  const [telegram, setTelegram] = useState("");
  const [amount, setAmount] = useState("0.01");
  const [slippage, setSlippage] = useState("15");
  const [priorityFee, setPriorityFee] = useState("0.00005");
  const [image, setImage] = useState<File | null>(null);
  const [banner, setBanner] = useState<File | null>(null);
  const [mayhem, setMayhem] = useState(false);
  const [agent, setAgent] = useState(false);
  const [cashback, setCashback] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const previewSeed = `${name}|${symbol}`.trim() || "preview";
  const g = mintGradient(previewSeed);
  const spark = sparkLinePathD(mintSparkPoints(previewSeed, 28));

  const imagePreviewUrl = useMemo(() => {
    if (!image) return null;
    return URL.createObjectURL(image);
  }, [image]);

  useEffect(() => {
    return () => {
      if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
    };
  }, [imagePreviewUrl]);

  const canSubmit = useMemo(() => {
    return name.trim().length > 0 && symbol.trim().length > 0 && image !== null && !loading;
  }, [name, symbol, image, loading]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!image) return;
    setLoading(true);
    setError(null);
    const fd = new FormData();
    fd.append("name", name.trim());
    fd.append("symbol", symbol.trim().toUpperCase());
    fd.append("description", description.trim());
    fd.append("website", website.trim());
    fd.append("twitter", twitter.trim());
    fd.append("telegram", telegram.trim());
    fd.append("amount", String(Number(amount) || 0.01));
    fd.append("slippage", String(Number(slippage) || 15));
    fd.append("priorityFee", String(Number(priorityFee) || 0.00005));
    fd.append("image", image);
    if (banner) fd.append("banner", banner);
    void mayhem;
    void agent;
    void cashback;

    const res = await fetch("/api/create-token", { method: "POST", body: fd });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "Create failed.");
      return;
    }
    prependCreatedCoin({
      mint: data.mint,
      name: name.trim(),
      symbol: symbol.trim().toUpperCase(),
      signature: data.signature ?? undefined,
      createdAt: new Date().toISOString(),
      description: description.trim() || undefined,
      imageUrl: typeof data.imageUrl === "string" ? data.imageUrl : undefined,
    });
    router.push("/profile");
  }

  return (
    <div className="grid gap-10 px-1 pb-24 lg:grid-cols-[minmax(0,1fr)_300px] lg:gap-8">
      <form onSubmit={(ev) => void onSubmit(ev)} className="min-w-0 space-y-8">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-black tracking-tight sm:text-3xl">Create new coin</h1>
            <span className="hidden h-1 w-10 shrink-0 rounded-full bg-[var(--pump-yellow)]/85 sm:block" aria-hidden />
          </div>
          <p className="mt-2 text-sm text-[var(--pump-muted)]">
            <span className="font-semibold text-[var(--pump-text)]">Coin details</span> — Choose carefully, these
            can&apos;t be changed once the coin is created. Mint is generated for you on the server and sent to{" "}
            <a className="text-[var(--pump-green)] hover:underline" href="https://pumpportal.fun/creation" target="_blank" rel="noreferrer">
              PumpPortal
            </a>
            .
          </p>
        </div>

        <section className="space-y-4 rounded-2xl border border-[var(--pump-border)] bg-[var(--pump-elevated)] p-5 sm:p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Coin name">
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name your coin" className="field" required />
            </Field>
            <Field label="Ticker">
              <input
                value={symbol}
                onChange={(e) => setSymbol(e.target.value)}
                placeholder="Add a coin ticker (e.g. DOGE)"
                className="field"
                required
              />
            </Field>
          </div>
          <Field label="Description (optional)">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Write a short description"
              rows={4}
              className="field resize-y"
            />
          </Field>

          <details className="rounded-xl border border-[var(--pump-border)] bg-[var(--pump-surface)] px-4 py-3">
            <summary className="cursor-pointer text-sm font-semibold text-[var(--pump-text)]">Add social links (optional)</summary>
            <div className="mt-4 space-y-3">
              <Field label="Website">
                <input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://…" className="field" />
              </Field>
              <Field label="X (Twitter)">
                <input value={twitter} onChange={(e) => setTwitter(e.target.value)} placeholder="https://x.com/…" className="field" />
              </Field>
              <Field label="Telegram">
                <input value={telegram} onChange={(e) => setTelegram(e.target.value)} placeholder="https://t.me/…" className="field" />
              </Field>
            </div>
          </details>
        </section>

        <section className="space-y-4 rounded-2xl border border-[var(--pump-border)] bg-[var(--pump-elevated)] p-5 sm:p-6">
          <h2 className="text-xs font-bold uppercase tracking-wide text-[var(--pump-muted)]">Trading defaults</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Initial dev buy (SOL)">
              <input value={amount} onChange={(e) => setAmount(e.target.value)} type="number" min="0" step="0.001" className="field" />
            </Field>
            <Field label="Slippage %">
              <input value={slippage} onChange={(e) => setSlippage(e.target.value)} type="number" min="1" className="field" />
            </Field>
            <Field label="Priority fee (SOL)">
              <input value={priorityFee} onChange={(e) => setPriorityFee(e.target.value)} type="number" min="0" step="0.00001" className="field" />
            </Field>
          </div>
        </section>

        <section className="space-y-4 rounded-2xl border border-[var(--pump-border)] bg-[var(--pump-elevated)] p-5 sm:p-6">
          <h2 className="text-xs font-bold uppercase tracking-wide text-[var(--pump-muted)]">Features (UI only for now)</h2>
          <div className="grid gap-3 md:grid-cols-3">
            <ToggleCard
              title="Mayhem mode"
              description="Increased price volume."
              note="Active for 24h, only set at creation. (Not sent to API yet.)"
              checked={mayhem}
              onChange={setMayhem}
            />
            <ToggleCard
              title="Tokenized agent"
              badge="New"
              description="Automated buybacks & burns."
              note="Placeholder toggle — wire to product logic later."
              checked={agent}
              onChange={setAgent}
            />
            <ToggleCard
              title="Cash back"
              description="Creator rewards go to traders."
              note="Placeholder toggle."
              checked={cashback}
              onChange={setCashback}
            />
          </div>
        </section>

        <section className="rounded-2xl border border-dashed border-[var(--pump-border)] bg-[var(--pump-surface)] p-8 text-center">
          <p className="text-sm font-medium text-[var(--pump-text)]">Coin image</p>
          <p className="mt-2 text-xs text-[var(--pump-muted)]">Select video or image to upload or drag and drop it here.</p>
          <label className="btn-primary mx-auto mt-4 inline-flex cursor-pointer">
            Select file
            <input
              type="file"
              accept="image/jpeg,image/png,image/gif,video/mp4"
              className="hidden"
              onChange={(e) => setImage(e.target.files?.[0] ?? null)}
            />
          </label>
          <p className="mt-4 text-[10px] leading-relaxed text-[var(--pump-muted)]">
            File size and type: image max 15mb (.jpg, .gif, .png) · video max 30mb (.mp4). Resolution: 1000×1000 (1:1)
            recommended; video 16:9 or 9:16.
          </p>
          <details className="mt-6 text-left">
            <summary className="cursor-pointer text-sm font-semibold text-[var(--pump-text)]">Add banner (optional)</summary>
            <label className="mt-3 block text-xs text-[var(--pump-muted)]">
              <span className="mb-2 block">Banner image</span>
              <input type="file" accept="image/*" onChange={(e) => setBanner(e.target.files?.[0] ?? null)} className="field py-2 text-xs" />
            </label>
          </details>
        </section>

        <p className="text-xs text-[var(--pump-muted)]">
          Coin data (social links, banner, etc.) should be finalized before create. drop uploads metadata to IPFS via Pinata
          then calls PumpPortal lightning create per{" "}
          <a href="https://pumpportal.fun/creation" className="text-[var(--pump-green)] hover:underline" target="_blank" rel="noreferrer">
            PumpPortal docs
          </a>
          .
        </p>

        {error ? <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</p> : null}

        <div className="flex flex-wrap gap-3">
          <Link href="/" className="btn-ghost">
            Cancel
          </Link>
          <button type="submit" disabled={!canSubmit} className="btn-primary flex-1 sm:flex-none sm:min-w-[200px]">
            {loading ? "Creating…" : "Create coin"}
          </button>
        </div>
      </form>

      <aside className="h-fit space-y-3 lg:sticky lg:top-4">
        <h2 className="text-sm font-bold text-[var(--pump-muted)]">Preview</h2>
        <div className="overflow-hidden rounded-2xl border border-[var(--pump-border)] bg-[var(--pump-surface)]">
          <div
            className="relative aspect-[4/5] w-full bg-gradient-to-br"
            style={{
              backgroundImage: imagePreviewUrl
                ? `url(${imagePreviewUrl})`
                : `linear-gradient(145deg, ${g.from}, ${g.to})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
            }}
          >
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />
            <div className="absolute bottom-3 left-3 right-3">
              <svg viewBox="0 0 100 22" className="h-8 w-full" preserveAspectRatio="none">
                <path d={spark} fill="none" stroke="var(--pump-green)" strokeWidth="1.35" />
              </svg>
            </div>
          </div>
          <div className="space-y-1 p-4">
            <p className="text-lg font-black text-[var(--pump-text)]">{name.trim() || "Coin name"}</p>
            <p className="text-sm font-bold text-[var(--pump-green)]">{symbol.trim().toUpperCase() || "TICKER"}</p>
            <p className="line-clamp-4 text-xs text-[var(--pump-muted)]">
              {description.trim() || "A preview of how the coin will look like."}
            </p>
          </div>
        </div>
      </aside>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-2">
      <span className="text-xs font-semibold text-[var(--pump-muted)]">{label}</span>
      {children}
    </label>
  );
}

function ToggleCard({
  title,
  description,
  note,
  badge,
  checked,
  onChange,
}: {
  title: string;
  description: string;
  note: string;
  badge?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex flex-col rounded-2xl border border-[var(--pump-border)] bg-[var(--pump-surface)] p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-bold text-[var(--pump-text)]">
            {title}{" "}
            {badge ? (
              <span className="ml-1 rounded bg-[var(--pump-green-dim)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--pump-green)]">
                {badge}
              </span>
            ) : null}
          </p>
          <p className="mt-1 text-xs text-[var(--pump-muted)]">{description}</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={checked}
          onClick={() => onChange(!checked)}
          className={`relative h-7 w-12 shrink-0 rounded-full transition ${checked ? "bg-[var(--pump-green)]" : "bg-[var(--pump-border)]"}`}
        >
          <span
            className={`absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-white transition ${checked ? "translate-x-5" : ""}`}
          />
        </button>
      </div>
      <p className="mt-3 text-[10px] leading-snug text-[var(--pump-muted)]">{note}</p>
    </div>
  );
}
