import type { RequestDetail } from "../store";

export type ChallengeId = "q1" | "q2" | "q3";

export interface Challenge {
  id: ChallengeId;
  kind: "amount" | "date";
  /** What the agent asks. Never contains the answer. */
  prompt: string;
  /** Cents for amounts, ISO date for dates. Server side only. */
  expected: number | string;
  /** Safe label for the UI and evidence before an auditor opens the full record. */
  label: string;
}

/** How far back the question pool reaches. Older invoices are harder for a real AR team to recall. */
export const QUESTION_POOL_SIZE = 6;

/** Deterministic PRNG so every part of a run (agent, tester sheet, evidence labels) picks the same questions. */
function seededRandom(seed: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return () => {
    h = (h + 0x6d2b79f5) | 0;
    let t = Math.imul(h ^ (h >>> 15), 1 | h);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Three facts only the real vendor's AR team would know: two invoice totals and the date one
 * payment arrived. With a seed (the run id) they are drawn at random from the recent paid invoices,
 * so a caller can't prepare for a fixed script. Without one, the newest invoices are used.
 */
export function buildChallenges(detail: RequestDetail, seed?: string): Challenge[] {
  const paid = detail.invoices
    .filter((i) => i.paid_on)
    .sort((a, b) => b.issued_on.localeCompare(a.issued_on))
    .slice(0, QUESTION_POOL_SIZE);
  if (paid.length < 2) {
    throw new Error(`Vendor ${detail.vendor.id} needs at least two paid invoices to build challenges`);
  }

  let first = paid[1];
  let second = paid[0];
  let dated = paid[0];
  if (seed) {
    const rand = seededRandom(seed);
    const pool = [...paid];
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    [first, second] = pool;
    dated = paid[Math.floor(rand() * paid.length)];
  }

  return [
    {
      id: "q1",
      kind: "amount",
      prompt: `What was the total amount on invoice ${first.number}?`,
      expected: first.amount_cents,
      label: `${first.number} total`,
    },
    {
      id: "q2",
      kind: "amount",
      prompt: `What was the total amount on invoice ${second.number}?`,
      expected: second.amount_cents,
      label: `${second.number} total`,
    },
    {
      id: "q3",
      kind: "date",
      prompt: `On what date did you receive our payment for invoice ${dated.number}?`,
      expected: dated.paid_on as string,
      label: `${dated.number} payment date`,
    },
  ];
}
