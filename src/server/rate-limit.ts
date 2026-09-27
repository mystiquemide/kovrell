/**
 * Sliding-window limiter keyed by client. Lives on globalThis because the custom server and
 * Next's route bundles load separate copies of this module.
 */
const g = globalThis as unknown as { __kovrellLimits?: Map<string, number[]> };

export function allow(key: string, max: number, windowMs: number, now = Date.now()): { ok: boolean; retryAfterS: number } {
  const hits = (g.__kovrellLimits ??= new Map<string, number[]>());
  const recent = (hits.get(key) ?? []).filter((t: number) => now - t < windowMs);
  if (recent.length >= max) {
    hits.set(key, recent);
    return { ok: false, retryAfterS: Math.ceil((windowMs - (now - recent[0])) / 1000) };
  }
  recent.push(now);
  hits.set(key, recent);
  return { ok: true, retryAfterS: 0 };
}

/** Client IP behind Cloudflare, falling back to the first forwarded address. */
export function clientIp(req: Request): string {
  return req.headers.get("cf-connecting-ip") ?? req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
}
