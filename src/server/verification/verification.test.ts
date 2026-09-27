import { describe, expect, it } from "vitest";
import { openDb } from "../db";
import { createStore } from "../store";
import { buildChallenges } from "./challenges";
import { nameMatches, parseAmountCents, parseMonthDay, sameDay } from "./parse";
import { preflight } from "./provenance";
import { VerificationSession } from "./session";

const NOW = Date.parse("2026-09-24T12:00:00Z");

function detail(id: string) {
  const store = createStore(openDb(":memory:"));
  store.seedIfEmpty(NOW);
  return store.getRequestDetail(id)!;
}

function northwindSession() {
  const d = detail("req_northwind");
  return {
    d,
    challenges: buildChallenges(d),
    session: new VerificationSession({
      contactName: d.vendor.contact_name,
      vendorName: d.vendor.name,
      challenges: buildChallenges(d),
    }),
  };
}

describe("parseAmountCents", () => {
  it.each([
    ["$96,325.00", 9_632_500],
    ["96325", 9_632_500],
    ["about 96,325 dollars", 9_632_500],
    ["127,400", 12_740_000],
    ["42915.4", 4_291_540],
    ["96.3k", 9_630_000],
    ["ninety six thousand three hundred twenty five", 9_632_500],
    ["one hundred twenty-seven thousand four hundred dollars", 12_740_000],
    ["forty two thousand nine hundred fifteen dollars and forty cents", 4_291_540],
  ])("%s", (input, cents) => {
    expect(parseAmountCents(input)).toBe(cents);
  });

  it("returns null for non-answers", () => {
    expect(parseAmountCents("I don't know")).toBeNull();
    expect(parseAmountCents("")).toBeNull();
  });
});

describe("parseMonthDay and sameDay", () => {
  it.each([
    ["August 12", 8, 12],
    ["12th of August", 8, 12],
    ["Aug 12, 2026", 8, 12],
    ["2026-08-12", 8, 12],
    ["8/12", 8, 12],
  ])("%s", (input, month, day) => {
    expect(parseMonthDay(input)).toMatchObject({ month, day });
  });

  it("accepts one day of settlement drift and rejects more", () => {
    expect(sameDay(parseMonthDay("August 13")!, "2026-08-12")).toBe(true);
    expect(sameDay(parseMonthDay("August 15")!, "2026-08-12")).toBe(false);
  });

  it("returns null for non-dates", () => {
    expect(parseMonthDay("sometime last month")).toBeNull();
  });
});

describe("nameMatches", () => {
  it("matches on a meaningful token", () => {
    expect(nameMatches("Jide", "Jide Okafor")).toBe(true);
    expect(nameMatches("northwind", "Northwind Steel")).toBe(true);
    expect(nameMatches("Tom Baker", "Jide Okafor")).toBe(false);
  });
});

describe("preflight", () => {
  it("allows the call when the number of record is old and unchanged", () => {
    const p = preflight(detail("req_northwind"), NOW);
    expect(p.locked).toBe(false);
    expect(p.numberOfRecord).toBe("+1 512 555 0142");
    expect(p.checks.find((c) => c.key === "request_callback_ignored")?.detail).toContain("+1 512 555 0199");
  });

  it("locks the call when the number of record changed recently", () => {
    const p = preflight(detail("req_brightline"), NOW);
    expect(p.locked).toBe(true);
    expect(p.reason).toBe("Number of record changed 6 days ago. Verify in person.");
    expect(p.checks.find((c) => c.key === "number_age")?.status).toBe("fail");
  });
});

describe("buildChallenges", () => {
  it("asks for facts without revealing them", () => {
    const { challenges } = northwindSession();
    expect(challenges.map((c) => c.id)).toEqual(["q1", "q2", "q3"]);
    for (const c of challenges) {
      expect(c.prompt).not.toContain(String(c.expected));
      expect(c.prompt).not.toMatch(/\$|\d{2},\d{3}/);
    }
    expect(challenges[0].expected).toBe(9_632_500);
    expect(challenges[1].expected).toBe(12_740_000);
  });

  it("draws a stable random set per run from the paid invoices", () => {
    const d = detail("req_northwind");
    const paid = new Map(d.invoices.filter((i) => i.paid_on).map((i) => [i.number, i]));
    const sets = new Set<string>();
    for (let i = 0; i < 40; i++) {
      const runId = `run_${i}`;
      const a = buildChallenges(d, runId);
      expect(buildChallenges(d, runId)).toEqual(a);
      const [q1, q2, q3] = a;
      expect(q1.label).not.toBe(q2.label);
      for (const c of a) {
        const inv = paid.get(c.label.split(" ")[0])!;
        expect(inv).toBeDefined();
        expect(c.expected).toBe(c.kind === "amount" ? inv.amount_cents : inv.paid_on);
        expect(c.prompt).not.toMatch(/\$|\d{2},\d{3}/);
      }
      expect(q3.kind).toBe("date");
      sets.add(a.map((c) => c.label).join("|"));
    }
    expect(sets.size).toBeGreaterThan(5);
  });

  it("refuses to build with fewer than two paid invoices", () => {
    expect(() => buildChallenges(detail("req_brightline"))).toThrow("at least two paid invoices");
  });
});

describe("VerificationSession verdicts", () => {
  it("PASS: real vendor answers correctly and confirms readback", () => {
    const { session, challenges } = northwindSession();
    session.confirmIdentity("Jide Okafor", "Northwind Steel");
    session.recordRequestStatus(true, "Yes, we moved banks");
    session.checkChallenge("q1", "96,325");
    session.checkChallenge("q2", "one hundred twenty seven thousand four hundred");
    session.checkChallenge("q3", challenges[2].expected as string);
    session.confirmReadback(true);
    expect(session.verdict().verdict).toBe("PASS");
  });

  it("PASS with one wrong challenge (2 of 3 required)", () => {
    const { session } = northwindSession();
    session.confirmIdentity("Jide", "Northwind");
    session.recordRequestStatus(true, "");
    session.checkChallenge("q1", "96,325");
    session.checkChallenge("q2", "127,400");
    session.checkChallenge("q3", "I'd have to check");
    session.confirmReadback(true);
    expect(session.verdict()).toMatchObject({ verdict: "PASS" });
  });

  it("FAIL: vendor denies requesting any change", () => {
    const { session } = northwindSession();
    session.confirmIdentity("Jide Okafor", "Northwind Steel");
    session.recordRequestStatus(false, "We never asked to change anything");
    expect(session.verdict()).toEqual({ verdict: "FAIL", reason: "Vendor says they did not request a bank change." });
  });

  it("FAIL: two wrong ledger answers", () => {
    const { session } = northwindSession();
    session.confirmIdentity("Jide", "Northwind");
    session.recordRequestStatus(true, "");
    session.checkChallenge("q1", "50,000");
    session.checkChallenge("q2", "80,000");
    expect(session.verdict()).toEqual({ verdict: "FAIL", reason: "2 of 3 ledger checks failed." });
  });

  it("FAIL: wrong person on the line", () => {
    const { session } = northwindSession();
    session.confirmIdentity("Tom Baker", "Northwind Steel");
    expect(session.verdict().verdict).toBe("FAIL");
  });

  it("FAIL: vendor rejects the readback", () => {
    const { session } = northwindSession();
    session.confirmIdentity("Jide", "Northwind");
    session.recordRequestStatus(true, "");
    session.checkChallenge("q1", "96325");
    session.checkChallenge("q2", "127400");
    session.confirmReadback(false);
    expect(session.verdict().reason).toBe("Vendor did not confirm the new account details.");
  });

  it("INCONCLUSIVE: call drops before the checks finish", () => {
    const { session } = northwindSession();
    session.confirmIdentity("Jide", "Northwind");
    session.checkChallenge("q1", "96325");
    const v = session.verdict();
    expect(v.verdict).toBe("INCONCLUSIVE");
    expect(v.reason).toContain("Readback of new account");
    expect(v.reason).toContain("INV-4502 total");
    expect(v.reason).toContain("The payment stays on hold.");
  });

  it("INCONCLUSIVE: nothing happened", () => {
    expect(northwindSession().session.verdict().verdict).toBe("INCONCLUSIVE");
  });

  it("counts only the first answer per question", () => {
    const { session } = northwindSession();
    session.checkChallenge("q1", "50,000");
    session.checkChallenge("q1", "96,325");
    expect(session.get("q1").status).toBe("fail");
    expect(session.ignoredAttempts).toEqual([{ key: "q1", heard: "96,325" }]);
  });

  it("emits check updates to listeners", () => {
    const { session } = northwindSession();
    const seen: string[] = [];
    session.onCheck((c) => seen.push(`${c.key}:${c.status}`));
    session.confirmIdentity("Jide", "Northwind");
    session.checkChallenge("q1", "96325");
    expect(seen).toEqual(["identity:pass", "q1:pass"]);
  });

  it("rejects unknown challenge ids", () => {
    expect(() => northwindSession().session.checkChallenge("q9" as "q1", "1")).toThrow("Unknown challenge");
  });
});
