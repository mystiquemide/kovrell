import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { openDb } from "./db";
import { createStore } from "./store";
import { checkWebhookUrl, deliverWebhook, isPrivateAddress, signature } from "./webhook";

const publicDns = async () => ["93.184.216.34"];

describe("webhook url checks", () => {
  it.each(["127.0.0.1", "10.1.2.3", "172.20.0.1", "192.168.1.1", "169.254.169.254", "100.64.0.1", "0.0.0.0", "::1", "fd00::1", "fe80::1", "::ffff:127.0.0.1"])(
    "treats %s as private",
    (ip) => expect(isPrivateAddress(ip)).toBe(true),
  );

  it("accepts a public https endpoint", async () => {
    expect((await checkWebhookUrl("https://hooks.example.com/kovrell", publicDns)).ok).toBe(true);
  });

  it.each([
    ["http://hooks.example.com/x", "https"],
    ["https://user:pw@hooks.example.com/x", "credentials"],
    ["https://hooks.example.com:3199/x", "default https port"],
    ["https://169.254.169.254/latest", "public address"],
    ["not a url", "valid URL"],
  ])("rejects %s", async (url, reason) => {
    const r = await checkWebhookUrl(url, publicDns);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain(reason);
  });

  it("rejects a hostname that resolves to a private address", async () => {
    const r = await checkWebhookUrl("https://sneaky.example.com", async () => ["93.184.216.34", "127.0.0.1"]);
    expect(r.ok).toBe(false);
  });
});

describe("deliverWebhook", () => {
  function storeWithHook() {
    const store = createStore(openDb(":memory:"));
    store.seedIfEmpty();
    store.setWebhook("req_northwind", "https://hooks.example.com/k", "whsec_test");
    return store;
  }

  it("signs the body and retries until the endpoint accepts it", async () => {
    const store = storeWithHook();
    const calls: { headers: Record<string, string>; body: string }[] = [];
    const statuses = [500, 200];
    const fetchImpl = (async (_url: URL, init: RequestInit) => {
      calls.push({ headers: init.headers as Record<string, string>, body: init.body as string });
      return new Response(null, { status: statuses.shift() });
    }) as unknown as typeof fetch;
    const ok = await deliverWebhook(store, "req_northwind", { verdict: "PASS" }, { fetchImpl, resolve: publicDns, delaysMs: [0, 0, 0], now: () => 1_700_000_000_000 });
    expect(ok).toBe(true);
    expect(calls).toHaveLength(2);
    const expected = createHmac("sha256", "whsec_test").update(`1700000000.${calls[1].body}`).digest("hex");
    expect(calls[1].headers["kovrell-signature"]).toBe(`t=1700000000,v1=${expected}`);
    expect(signature("whsec_test", calls[1].body, 1_700_000_000)).toBe(calls[1].headers["kovrell-signature"]);
    expect(store.getWebhook("req_northwind")).toMatchObject({ attempts: 2, last_code: 200, delivered: 1 });
  });

  it("never posts when the host now resolves to a private address", async () => {
    const store = storeWithHook();
    let called = false;
    const fetchImpl = (async () => ((called = true), new Response(null))) as unknown as typeof fetch;
    const ok = await deliverWebhook(store, "req_northwind", {}, { fetchImpl, resolve: async () => ["10.0.0.5"], delaysMs: [0] });
    expect(ok).toBe(false);
    expect(called).toBe(false);
    expect(store.getWebhook("req_northwind")?.last_error).toContain("public address");
  });

  it("does nothing without a registered webhook", async () => {
    const store = createStore(openDb(":memory:"));
    store.seedIfEmpty();
    expect(await deliverWebhook(store, "req_halden", {})).toBe(false);
  });
});
