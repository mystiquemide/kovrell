import { openDb, type Db } from "./db";
import { seedSampleLedger } from "./seed";

export type RequestStatus = "held" | "verified" | "blocked" | "locked";
export type PaymentStatus = "held" | "released" | "blocked";

export interface Vendor {
  id: string;
  name: string;
  contact_name: string;
  contact_phone: string;
  contact_email: string;
  bank_name: string;
  account_last4: string;
  routing_last4: string;
}

export interface VendorChange {
  id: number;
  vendor_id: string;
  field: string;
  old_value: string | null;
  new_value: string;
  changed_at: string;
  source: string;
}

export interface Invoice {
  id: string;
  vendor_id: string;
  number: string;
  amount_cents: number;
  issued_on: string;
  paid_on: string | null;
}

export interface Payment {
  id: string;
  vendor_id: string;
  amount_cents: number;
  due_on: string;
  status: PaymentStatus;
  destination_last4: string;
}

export interface ChangeRequest {
  id: string;
  vendor_id: string;
  payment_id: string;
  received_at: string;
  channel: string;
  new_bank_name: string;
  new_account_last4: string;
  callback_contact: string | null;
  status: RequestStatus;
}

export interface InboxRow extends ChangeRequest {
  vendor_name: string;
  amount_cents: number;
}

export interface RequestDetail {
  request: ChangeRequest;
  vendor: Vendor;
  payment: Payment;
  changes: VendorChange[];
  invoices: Invoice[];
}

export type RunStatus = "ringing" | "live" | "ended";
export type RunVerdict = "PASS" | "FAIL" | "INCONCLUSIVE";

export interface Run {
  id: string;
  request_id: string;
  channel: string;
  call_token: string;
  token_expires_at: string;
  token_used: number;
  aai_session_id: string | null;
  status: RunStatus;
  verdict: RunVerdict | null;
  reason: string | null;
  started_at: string;
  ended_at: string | null;
  evidence_sha256: string | null;
}

export interface RunEvent {
  id: number;
  run_id: string;
  t_ms: number;
  kind: string;
  payload: unknown;
}

export interface StoredCheck {
  run_id: string;
  key: string;
  status: string;
  expected: string | null;
  heard: string | null;
}

export function createStore(db: Db) {
  const isEmpty = () => (db.prepare("SELECT COUNT(*) AS n FROM vendors").get() as { n: number }).n === 0;

  return {
    db,

    seedIfEmpty(now = Date.now()) {
      if (isEmpty()) seedSampleLedger(db, now);
    },

    reset(now = Date.now()) {
      db.transaction(() => {
        for (const t of ["checks", "run_events", "runs", "requests", "payments", "invoices", "vendor_changes", "vendors"]) {
          db.prepare(`DELETE FROM ${t}`).run();
        }
        seedSampleLedger(db, now);
      })();
    },

    listInbox(): InboxRow[] {
      return db
        .prepare(
          `SELECT r.*, v.name AS vendor_name, p.amount_cents
           FROM requests r JOIN vendors v ON v.id = r.vendor_id JOIN payments p ON p.id = r.payment_id
           ORDER BY r.received_at DESC`,
        )
        .all() as InboxRow[];
    },

    getRequestDetail(id: string): RequestDetail | null {
      const request = db.prepare("SELECT * FROM requests WHERE id = ?").get(id) as ChangeRequest | undefined;
      if (!request) return null;
      const vendor = db.prepare("SELECT * FROM vendors WHERE id = ?").get(request.vendor_id) as Vendor;
      const payment = db.prepare("SELECT * FROM payments WHERE id = ?").get(request.payment_id) as Payment;
      const changes = db
        .prepare("SELECT * FROM vendor_changes WHERE vendor_id = ? ORDER BY changed_at ASC")
        .all(request.vendor_id) as VendorChange[];
      const invoices = db
        .prepare("SELECT * FROM invoices WHERE vendor_id = ? ORDER BY issued_on ASC")
        .all(request.vendor_id) as Invoice[];
      return { request, vendor, payment, changes, invoices };
    },

    getVendor(id: string): { vendor: Vendor; changes: VendorChange[] } | null {
      const vendor = db.prepare("SELECT * FROM vendors WHERE id = ?").get(id) as Vendor | undefined;
      if (!vendor) return null;
      const changes = db
        .prepare("SELECT * FROM vendor_changes WHERE vendor_id = ? ORDER BY changed_at DESC")
        .all(id) as VendorChange[];
      return { vendor, changes };
    },

    createRun(run: Pick<Run, "id" | "request_id" | "channel" | "call_token" | "token_expires_at" | "started_at">) {
      db.prepare(
        `INSERT INTO runs (id, request_id, channel, call_token, token_expires_at, status, started_at)
         VALUES (@id, @request_id, @channel, @call_token, @token_expires_at, 'ringing', @started_at)`,
      ).run(run);
    },

    getRun(id: string): Run | null {
      return (db.prepare("SELECT * FROM runs WHERE id = ?").get(id) as Run | undefined) ?? null;
    },

    getRunByToken(token: string): Run | null {
      return (db.prepare("SELECT * FROM runs WHERE call_token = ?").get(token) as Run | undefined) ?? null;
    },

    latestRunForRequest(requestId: string): Run | null {
      return (
        (db.prepare("SELECT * FROM runs WHERE request_id = ? ORDER BY started_at DESC LIMIT 1").get(requestId) as
          | Run
          | undefined) ?? null
      );
    },

    /** Marks a call token used. Returns false if it was already used, so each link answers once. */
    claimToken(token: string): boolean {
      return db.prepare("UPDATE runs SET token_used = 1 WHERE call_token = ? AND token_used = 0").run(token).changes === 1;
    },

    updateRun(id: string, fields: Partial<Pick<Run, "aai_session_id" | "status" | "verdict" | "reason" | "ended_at" | "evidence_sha256">>) {
      const keys = Object.keys(fields);
      if (!keys.length) return;
      db.prepare(`UPDATE runs SET ${keys.map((k) => `${k} = @${k}`).join(", ")} WHERE id = @id`).run({ ...fields, id });
    },

    addEvent(runId: string, tMs: number, kind: string, payload: unknown): RunEvent {
      const info = db
        .prepare("INSERT INTO run_events (run_id, t_ms, kind, payload_json) VALUES (?, ?, ?, ?)")
        .run(runId, tMs, kind, JSON.stringify(payload));
      return { id: Number(info.lastInsertRowid), run_id: runId, t_ms: tMs, kind, payload };
    },

    listEvents(runId: string): RunEvent[] {
      return (
        db.prepare("SELECT * FROM run_events WHERE run_id = ? ORDER BY id ASC").all(runId) as (Omit<RunEvent, "payload"> & {
          payload_json: string;
        })[]
      ).map(({ payload_json, ...e }) => ({ ...e, payload: JSON.parse(payload_json) }));
    },

    upsertCheck(check: StoredCheck) {
      db.prepare(
        `INSERT INTO checks (run_id, key, status, expected, heard) VALUES (@run_id, @key, @status, @expected, @heard)
         ON CONFLICT(run_id, key) DO UPDATE SET status = excluded.status, heard = excluded.heard`,
      ).run(check);
    },

    listChecks(runId: string): StoredCheck[] {
      return db.prepare("SELECT * FROM checks WHERE run_id = ? ORDER BY rowid ASC").all(runId) as StoredCheck[];
    },

    setOutcome(requestId: string, requestStatus: RequestStatus, paymentStatus: PaymentStatus, destinationLast4?: string) {
      db.transaction(() => {
        const req = db.prepare("SELECT payment_id FROM requests WHERE id = ?").get(requestId) as
          | { payment_id: string }
          | undefined;
        if (!req) throw new Error(`Unknown request ${requestId}`);
        db.prepare("UPDATE requests SET status = ? WHERE id = ?").run(requestStatus, requestId);
        if (destinationLast4) {
          db.prepare("UPDATE payments SET status = ?, destination_last4 = ? WHERE id = ?").run(
            paymentStatus,
            destinationLast4,
            req.payment_id,
          );
        } else {
          db.prepare("UPDATE payments SET status = ? WHERE id = ?").run(paymentStatus, req.payment_id);
        }
      })();
    },
  };
}

export type Store = ReturnType<typeof createStore>;

// Process-wide store. Lazy so every module context (API routes, custom server) sees seeded data.
const globalForStore = globalThis as unknown as { __kovrellStore?: Store };

export function getStore(): Store {
  if (!globalForStore.__kovrellStore) {
    const store = createStore(openDb(process.env.DATABASE_PATH || "./data/kovrell.db"));
    store.seedIfEmpty();
    globalForStore.__kovrellStore = store;
  }
  return globalForStore.__kovrellStore;
}
