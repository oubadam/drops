/** Upload a file to Pinata v3 (public network). Returns IPFS CID. */
export async function pinataUploadFile(jwt: string, file: File, filename?: string) {
  const form = new FormData();
  form.append("network", "public");
  form.append("file", file, (filename ?? file.name) || "upload");

  const res = await fetch("https://uploads.pinata.cloud/v3/files", {
    method: "POST",
    headers: { Authorization: `Bearer ${jwt}` },
    body: form,
  });

  const json = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  if (!res.ok) {
    const msg = typeof json?.error === "string" ? json.error : res.statusText;
    throw new Error(`Pinata upload failed (${res.status}): ${msg}`);
  }
  const cid = extractCid(json);
  if (!cid) throw new Error("Pinata response missing CID");
  return cid;
}

function extractCid(json: Record<string, unknown> | null): string | null {
  if (!json) return null;
  const data = json.data as Record<string, unknown> | undefined;
  if (data && typeof data.cid === "string") return data.cid;
  if (typeof json.IpfsHash === "string") return json.IpfsHash;
  return null;
}

export function ipfsUri(cid: string) {
  return `https://ipfs.io/ipfs/${cid}`;
}
