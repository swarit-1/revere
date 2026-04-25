// Thin wrapper around global fetch with a Chrome User-Agent (Legistar serves a
// trimmed page to defaults) and explicit error context on non-2xx responses.

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

export async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) {
    throw new Error(`fetchText failed: ${res.status} ${res.statusText} for ${url}`);
  }
  return res.text();
}

export async function fetchBuffer(url: string): Promise<Uint8Array> {
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) {
    throw new Error(`fetchBuffer failed: ${res.status} ${res.statusText} for ${url}`);
  }
  return new Uint8Array(await res.arrayBuffer());
}
