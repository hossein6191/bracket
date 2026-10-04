// sha256 of a text as lowercase hex, in the browser. The deploy page hashes the contract source it
// serves, so a reader can compare it with the file in the repository.

export async function sha256Hex(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
