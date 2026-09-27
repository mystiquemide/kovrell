import type { Challenge, ChallengeId } from "./challenges";
import { nameMatches, parseAmountCents, parseMonthDay, sameDay } from "./parse";

export const AMOUNT_TOLERANCE_CENTS = 100;
export const REQUIRED_CORRECT = 2;

export type CheckKey = "identity" | "requested" | ChallengeId | "readback";
export type CheckStatus = "pending" | "pass" | "fail";

export interface CheckState {
  key: CheckKey;
  label: string;
  status: CheckStatus;
  heard: string | null;
}

export type Verdict = "PASS" | "FAIL" | "INCONCLUSIVE";

export interface VerdictResult {
  verdict: Verdict;
  reason: string;
}

export interface VerificationContext {
  contactName: string;
  vendorName: string;
  challenges: Challenge[];
}

type Listener = (check: CheckState) => void;

/**
 * Holds the state of one verification call. The agent only ever learns that an answer
 * was recorded. Correctness stays here, and the verdict is computed by fixed rules.
 */
export class VerificationSession {
  private checks = new Map<CheckKey, CheckState>();
  private challenges: Map<ChallengeId, Challenge>;
  private listeners: Listener[] = [];
  readonly ignoredAttempts: { key: CheckKey; heard: string }[] = [];

  constructor(private ctx: VerificationContext) {
    this.challenges = new Map(ctx.challenges.map((c) => [c.id, c]));
    this.init("identity", "Identity confirmed");
    this.init("requested", "Vendor confirms the request");
    for (const c of ctx.challenges) this.init(c.id, c.label);
    this.init("readback", "Readback of new account");
  }

  onCheck(listener: Listener) {
    this.listeners.push(listener);
  }

  list(): CheckState[] {
    return [...this.checks.values()];
  }

  get(key: CheckKey): CheckState {
    return this.checks.get(key)!;
  }

  confirmIdentity(name: string, company: string): void {
    const ok = nameMatches(name, this.ctx.contactName) && nameMatches(company, this.ctx.vendorName);
    this.settle("identity", ok ? "pass" : "fail", `${name} at ${company}`);
  }

  recordRequestStatus(vendorSaysRequested: boolean, note: string): void {
    this.settle("requested", vendorSaysRequested ? "pass" : "fail", note || (vendorSaysRequested ? "yes" : "no"));
  }

  checkChallenge(id: ChallengeId, answer: string): void {
    const challenge = this.challenges.get(id);
    if (!challenge) throw new Error(`Unknown challenge ${id}`);
    let ok = false;
    if (challenge.kind === "amount") {
      const cents = parseAmountCents(answer);
      ok = cents !== null && Math.abs(cents - (challenge.expected as number)) <= AMOUNT_TOLERANCE_CENTS;
    } else {
      const heard = parseMonthDay(answer);
      ok = heard !== null && sameDay(heard, challenge.expected as string);
    }
    this.settle(id, ok ? "pass" : "fail", answer);
  }

  confirmReadback(confirmed: boolean): void {
    this.settle("readback", confirmed ? "pass" : "fail", confirmed ? "confirmed" : "rejected");
  }

  /** Answers that don't count toward any check: unanswered challenges stay pending. */
  pendingChallenges(): ChallengeId[] {
    return this.ctx.challenges.filter((c) => this.get(c.id).status === "pending").map((c) => c.id);
  }

  verdict(): VerdictResult {
    const s = (k: CheckKey) => this.get(k).status;
    const challengeStates = this.ctx.challenges.map((c) => s(c.id));
    const correct = challengeStates.filter((x) => x === "pass").length;
    const wrong = challengeStates.filter((x) => x === "fail").length;
    const total = this.ctx.challenges.length;

    if (s("requested") === "fail") {
      return { verdict: "FAIL", reason: "Vendor says they did not request a bank change." };
    }
    if (s("identity") === "fail") {
      return { verdict: "FAIL", reason: "The person on the line did not match the contact of record." };
    }
    if (wrong > total - REQUIRED_CORRECT) {
      return { verdict: "FAIL", reason: `${wrong} of ${total} ledger checks failed.` };
    }
    if (s("readback") === "fail") {
      return { verdict: "FAIL", reason: "Vendor did not confirm the new account details." };
    }
    if (s("identity") === "pass" && s("requested") !== "fail" && correct >= REQUIRED_CORRECT && s("readback") === "pass") {
      return { verdict: "PASS", reason: `Identity, ${correct} of ${total} ledger checks, and readback confirmed.` };
    }
    const missing = this.list()
      .filter((c) => c.status === "pending" && c.key !== "requested")
      .map((c) => c.label);
    return {
      verdict: "INCONCLUSIVE",
      reason: missing.length
        ? `The call ended before these checks: ${missing.join(", ")}. The payment stays on hold.`
        : "Not enough checks were confirmed. The payment stays on hold.",
    };
  }

  private init(key: CheckKey, label: string) {
    this.checks.set(key, { key, label, status: "pending", heard: null });
  }

  // First answer counts. Later attempts are logged and ignored, so a caller cannot guess and retry.
  private settle(key: CheckKey, status: CheckStatus, heard: string) {
    const check = this.get(key);
    if (check.status !== "pending") {
      this.ignoredAttempts.push({ key, heard });
      return;
    }
    const next = { ...check, status, heard };
    this.checks.set(key, next);
    for (const l of this.listeners) l(next);
  }
}
