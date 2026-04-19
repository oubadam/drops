import { Keypair } from "@solana/web3.js";

const SUFFIX = "drop";

/** Mint vanity suffix for drops launches (Solana base58 pubkey must end with this). */
export function grindKeypairEndingDrop(maxAttempts = 35_000_000): Keypair {
  for (let i = 0; i < maxAttempts; i += 1) {
    const kp = Keypair.generate();
    if (kp.publicKey.toBase58().endsWith(SUFFIX)) return kp;
  }
  throw new Error(
    `Could not find a mint ending in "${SUFFIX}" within ${maxAttempts} attempts. Try again (vanity is random).`,
  );
}
