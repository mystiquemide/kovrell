import { createHmac, randomBytes } from "node:crypto";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import type { Store } from "./store";

export type Resolve = (host: string) => Promise<string[]>;

const defaultResolve: Resolve = async (host) => (await lookup(host, { all: true })).map((a) => a.address);

/** Loopback, private, link-local, CGNAT, multicast, and reserved ranges. The sandbox never posts to these. */
export function isPrivateAddress(ip: string): boolean {
  const v4 = ip.startsWith("::ffff:") ? ip.slice(7) : ip;
  if (isIP(v4) === 4) {
    const [a, b] = v4.split(".").map(Number);
    return (
      a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && (b === 168 || b === 0)) ||
      (a === 198 && (b === 18 || b === 19))
    );
  }
  const v6 = ip.toLowerCase();
  return v6 === "::" || v6 === "::1" || /^f[cd]/.test(v6) || /^fe[89ab]/.test(v6) || v6.startsWith("ff");
}

/** A webhook must be a public HTTPS endpoint on the default port. Checked at registration and before every delivery. */
export async function checkWebhookUrl(raw: string, resolve: Resolve = defaultResolve): Promise<{ ok: true; url: URL } | { ok: false; reason: string }> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { ok: false, reason: "Webhook URL is not a valid URL." };
  }
  if (url.protocol !== "https:") return { ok: false, reason: "Webhook URL must use https." };
  if (url.username || url.password) return { ok: false, reason: "Webhook URL can't contain credentials." };
  if (url.port && url.port !== "443") return { ok: false, reason: "Webhook URL must use the default https port." };
  const host = url.hostname.replace(/^\[|\]$/g, "");
  let addresses: string[];
  try {
    addresses = isIP(host) ? [host] : await resolve(host);
  } catch {
    return { ok: false, reason: "Webhook host could not be resolved." };
  }
  if (!addresses.length || addresses.some(isPrivateAddress)) return { ok: false, reason: "Webhook URL must point to a public address." };
  return { ok: true, url };
}

export function newWebhookSecret(): string {
  return `whsec_${randomBytes(24).toString("base64url")}`;
}

/** `t=<unix seconds>,v1=<hex HMAC-SHA256 of "<t>.<body>">`, the same scheme Stripe uses. */
export function signature(secret: string, body: string, t: number): string {
  return `t=${t},v1=${createHmac("sha256", secret).update(`${t}.${body}`).digest("hex")}`;
}

export interface DeliverOptions {
  fetchImpl?: typeof fetch;
  resolve?: Resolve;
  delaysMs?: number[];
  now?: () => number;
}

/** Posts the verdict to the request's webhook, retrying on failure. No-op when none is registered. */
export async function deliverWebhook(store: Store, requestId: string, payload: object, opts: DeliverOptions = {}): Promise<boolean> {
  const hook = store.getWebhook(requestId);
  if (!hook) return false;
  const { fetchImpl = fetch, resolve = defaultResolve, delaysMs = [0, 2_000, 10_000], now = Date.now } = opts;
  const body = JSON.stringify(payload);
  for (const delay of delaysMs) {
    if (delay) await new Promise((r) => setTimeout(r, delay));
    const checked = await checkWebhookUrl(hook.url, resolve);
    if (!checked.ok) {
      store.recordWebhookAttempt(requestId, { code: null, error: checked.reason, delivered: false });
      return false;
    }
    try {
      const res = await fetchImpl(checked.url, {
        method: "POST",
        redirect: "manual",
        signal: AbortSignal.timeout(5_000),
        headers: {
          "content-type": "application/json",
          "user-agent": "Kovrell-Webhook/1",
          "kovrell-event": "verification.completed",
          "kovrell-signature": signature(hook.secret, body, Math.floor(now() / 1000)),
        },
        body,
      });
      const delivered = res.status >= 200 && res.status < 300;
      store.recordWebhookAttempt(requestId, { code: res.status, error: delivered ? null : `HTTP ${res.status}`, delivered });
      if (delivered) return true;
    } catch (err) {
      store.recordWebhookAttempt(requestId, { code: null, error: (err as Error).name === "TimeoutError" ? "Timed out" : "Could not connect", delivered: false });
    }
  }
  return false;
}
