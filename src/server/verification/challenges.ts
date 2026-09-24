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

/**
 * Three facts only the real vendor's AR team would know: the totals of the two most
 * recent paid invoices and the date the latest one was paid.
 */
export function buildChallenges(detail: RequestDetail): Challenge[] {
  const paid = detail.invoices
    .filter((i) => i.paid_on)
    .sort((a, b) => b.issued_on.localeCompare(a.issued_on));
  if (paid.length < 2) {
    throw new Error(`Vendor ${detail.vendor.id} needs at least two paid invoices to build challenges`);
  }
  const [latest, previous] = paid;
  return [
    {
      id: "q1",
      kind: "amount",
      prompt: `What was the total amount on invoice ${previous.number}?`,
      expected: previous.amount_cents,
      label: `${previous.number} total`,
    },
    {
      id: "q2",
      kind: "amount",
      prompt: `What was the total amount on invoice ${latest.number}?`,
      expected: latest.amount_cents,
      label: `${latest.number} total`,
    },
    {
      id: "q3",
      kind: "date",
      prompt: `On what date did you receive our payment for invoice ${latest.number}?`,
      expected: latest.paid_on as string,
      label: `${latest.number} payment date`,
    },
  ];
}
