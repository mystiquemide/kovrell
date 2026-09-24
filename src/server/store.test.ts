import { describe, expect, it } from "vitest";
import { openDb } from "./db";
import { createStore } from "./store";

const NOW = Date.parse("2026-09-24T12:00:00Z");
const DAY = 24 * 60 * 60 * 1000;

function freshStore() {
  const store = createStore(openDb(":memory:"));
  store.seedIfEmpty(NOW);
  return store;
}

describe("sample ledger", () => {
  it("seeds three vendors with held bank-change requests", () => {
    const inbox = freshStore().listInbox();
    expect(inbox.map((r) => r.vendor_name).sort()).toEqual(["Brightline Print", "Halden Freight", "Northwind Steel"]);
    expect(inbox.every((r) => r.status === "held")).toBe(true);
  });

  it("orders the inbox newest first and carries the amount due", () => {
    const inbox = freshStore().listInbox();
    expect(inbox[0].vendor_name).toBe("Northwind Steel");
    expect(inbox[0].amount_cents).toBe(18_420_000);
    expect(inbox.find((r) => r.vendor_name === "Halden Freight")?.amount_cents).toBe(4_291_540);
  });

  it("does not seed twice", () => {
    const store = freshStore();
    store.seedIfEmpty(NOW);
    expect(store.listInbox()).toHaveLength(3);
  });
});

describe("request detail", () => {
  it("returns vendor, payment, change log and invoices", () => {
    const detail = freshStore().getRequestDetail("req_northwind");
    expect(detail?.vendor.contact_name).toBe("Jide Okafor");
    expect(detail?.payment.status).toBe("held");
    expect(detail?.invoices.map((i) => i.number)).toEqual(["INV-4471", "INV-4502", "INV-4533"]);
    expect(detail?.request.callback_contact).toBe("+1 512 555 0199");
    expect(detail?.request.callback_contact).not.toBe(detail?.vendor.contact_phone);
  });

  it("returns null for an unknown request", () => {
    expect(freshStore().getRequestDetail("nope")).toBeNull();
  });

  it("records a recent phone change for Brightline so provenance can lock it", () => {
    const detail = freshStore().getRequestDetail("req_brightline")!;
    const phoneChanges = detail.changes.filter((c) => c.field === "contact_phone");
    const latest = phoneChanges[phoneChanges.length - 1];
    expect(latest.new_value).toBe(detail.vendor.contact_phone);
    expect(NOW - Date.parse(latest.changed_at)).toBeLessThan(30 * DAY);
  });

  it("keeps Northwind and Halden phone numbers older than 30 days", () => {
    const store = freshStore();
    for (const id of ["req_northwind", "req_halden"]) {
      const d = store.getRequestDetail(id)!;
      const latest = d.changes.filter((c) => c.field === "contact_phone").at(-1)!;
      expect(NOW - Date.parse(latest.changed_at)).toBeGreaterThan(30 * DAY);
    }
  });
});

describe("outcomes", () => {
  it("releases payment to the new account on verification", () => {
    const store = freshStore();
    store.setOutcome("req_northwind", "verified", "released", "8841");
    const d = store.getRequestDetail("req_northwind")!;
    expect(d.request.status).toBe("verified");
    expect(d.payment.status).toBe("released");
    expect(d.payment.destination_last4).toBe("8841");
  });

  it("keeps the account on file when blocked", () => {
    const store = freshStore();
    store.setOutcome("req_halden", "blocked", "blocked");
    const d = store.getRequestDetail("req_halden")!;
    expect(d.payment.status).toBe("blocked");
    expect(d.payment.destination_last4).toBe("5530");
  });

  it("rejects an unknown request", () => {
    expect(() => freshStore().setOutcome("nope", "verified", "released")).toThrow("Unknown request");
  });

  it("reset restores the sample ledger", () => {
    const store = freshStore();
    store.setOutcome("req_halden", "blocked", "blocked");
    store.reset(NOW);
    expect(store.listInbox().every((r) => r.status === "held")).toBe(true);
  });
});
