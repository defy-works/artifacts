import { randomBytes } from "node:crypto";

const ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";

/** URL-safe lowercase id, `n` chars from a 36-symbol alphabet. */
export function shortId(n = 12): string {
  const bytes = randomBytes(n);
  let out = "";
  for (let i = 0; i < n; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}

/** 32-char hex id — the asset id shape the runtime contract promises. */
export function hexId(): string {
  return randomBytes(16).toString("hex");
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}
