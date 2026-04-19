/** Deterministic pseudo-visuals from mint (no on-chain fetch). */

/** Card gradients: blue family only (matches site `--pump-green` ~214°). */
export function mintGradient(mint: string) {
  let h = 0;
  for (let i = 0; i < mint.length; i += 1) h = (h * 31 + mint.charCodeAt(i)) >>> 0;
  const spread = h % 18;
  const hue = 206 + spread;
  const hue2 = 214 + ((h >>> 3) % 14);
  return {
    from: `hsl(${hue} 52% 30%)`,
    to: `hsl(${hue2} 48% 18%)`,
  };
}

export function mintSparkPoints(mint: string, count: number) {
  let seed = mint.split("").reduce((a, ch) => (a * 33 + ch.charCodeAt(0)) >>> 0, 7);
  const out: number[] = [];
  let v = 50;
  for (let i = 0; i < count; i += 1) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const d = (seed % 17) - 8;
    v = Math.max(18, Math.min(92, v + d));
    out.push(v);
  }
  return out;
}

export function sparkLinePathD(ys: number[]) {
  if (ys.length < 2) return "M0,12 L100,12";
  const n = ys.length;
  const step = 100 / (n - 1);
  return ys
    .map((y, i) => {
      const x = i * step;
      const yy = 20 - (y / 100) * 16;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${yy.toFixed(1)}`;
    })
    .join(" ");
}
