import { randomUUID } from "node:crypto";
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
  /** The company paying this vendor, for vendors added on Set up. Sample vendors use the app default. */
  payer_name?: string | null;
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

export type EvidenceStatus = "pending" | "sealed" | "unavailable";

export interface EvidenceRow {
  run_id: string;
  levels: number[];
  timeline: unknown | null;
  audio_available: boolean;
  median_response_ms: number | null;
  record: unknown | null;
  sha256: string | null;
  status: EvidenceStatus;
  updated_at: string;
}

export interface RunListRow extends Run {
  vendor_name: string;
  vendor_id: string;
}

export function createStore(db: Db) {
  const isEmpty = () => (db.prepare("SELECT COUNT(*) AS n FROM vendors").get() as { n: number }).n === 0;

  /** Deletes a vendor and everything recorded against it. */
  const removeVendor = (id: string) => {
    const runs = `SELECT r.id FROM runs r JOIN requests q ON q.id = r.request_id WHERE q.vendor_id = ?`;
    for (const t of ["evidence", "checks", "run_events"]) db.prepare(`DELETE FROM ${t} WHERE run_id IN (${runs})`).run(id);
    db.prepare(`DELETE FROM runs WHERE request_id IN (SELECT id FROM requests WHERE vendor_id = ?)`).run(id);
    for (const t of ["requests", "payments", "invoices", "vendor_changes", "vendors"]) {
      db.prepare(`DELETE FROM ${t} WHERE ${t === "vendors" ? "id" : "vendor_id"} = ?`).run(id);
    }
  };

  return {
    db,

    seedIfEmpty(now = Date.now()) {
      if (isEmpty()) seedSampleLedger(db, now);
    },

    reset(now = Date.now()) {
      db.transaction(() => {
        for (const t of ["evidence", "checks", "run_events", "runs", "requests", "payments", "invoices", "vendor_changes", "vendors"]) {
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

    listVendors(): (Vendor & { last_change_at: string | null })[] {
      return db
        .prepare(
          `SELECT v.*, (SELECT MAX(changed_at) FROM vendor_changes c WHERE c.vendor_id = v.id) AS last_change_at
           FROM vendors v ORDER BY v.name`,
        )
        .all() as (Vendor & { last_change_at: string | null })[];
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

    listRuns(): RunListRow[] {
      return db
        .prepare(
          `SELECT runs.*, v.name AS vendor_name, v.id AS vendor_id FROM runs
           JOIN requests r ON r.id = runs.request_id JOIN vendors v ON v.id = r.vendor_id
           ORDER BY runs.started_at DESC`,
        )
        .all() as RunListRow[];
    },

    listRunsForRequest(requestId: string): Run[] {
      return db.prepare("SELECT * FROM runs WHERE request_id = ? ORDER BY started_at DESC").all(requestId) as Run[];
    },

    saveEvidence(row: EvidenceRow) {
      db.prepare(
        `INSERT INTO evidence (run_id, levels_json, timeline_json, audio_available, median_response_ms, record_json, sha256, status, updated_at)
         VALUES (@run_id, @levels_json, @timeline_json, @audio_available, @median_response_ms, @record_json, @sha256, @status, @updated_at)
         ON CONFLICT(run_id) DO UPDATE SET levels_json = excluded.levels_json, timeline_json = excluded.timeline_json,
           audio_available = excluded.audio_available, median_response_ms = excluded.median_response_ms,
           record_json = excluded.record_json, sha256 = excluded.sha256, status = excluded.status, updated_at = excluded.updated_at`,
      ).run({
        run_id: row.run_id,
        levels_json: JSON.stringify(row.levels),
        timeline_json: row.timeline === null ? null : JSON.stringify(row.timeline),
        audio_available: row.audio_available ? 1 : 0,
        median_response_ms: row.median_response_ms,
        record_json: row.record === null ? null : JSON.stringify(row.record),
        sha256: row.sha256,
        status: row.status,
        updated_at: row.updated_at,
      });
    },

    getEvidence(runId: string): EvidenceRow | null {
      const r = db.prepare("SELECT * FROM evidence WHERE run_id = ?").get(runId) as
        | {
            run_id: string;
            levels_json: string;
            timeline_json: string | null;
            audio_available: number;
            median_response_ms: number | null;
            record_json: string | null;
            sha256: string | null;
            status: EvidenceStatus;
            updated_at: string;
          }
        | undefined;
      if (!r) return null;
      return {
        run_id: r.run_id,
        levels: JSON.parse(r.levels_json),
        timeline: r.timeline_json ? JSON.parse(r.timeline_json) : null,
        audio_available: r.audio_available === 1,
        median_response_ms: r.median_response_ms,
        record: r.record_json ? JSON.parse(r.record_json) : null,
        sha256: r.sha256,
        status: r.status,
        updated_at: r.updated_at,
      };
    },

    /**
     * Adds a vendor with its contact of record, paid invoices, and the next payment, held.
     * This is what an ERP sync would provide. Only the newest `keepCustom` added vendors are kept.
     */
    createVendorLedger(
      input: {
        name: string;
        payer_name?: string;
        contact_name: string;
        contact_phone: string;
        contact_email: string;
        bank_name: string;
        account_last4: string;
        number_on_file_days: number;
        invoices: { number: string; amount_cents: number; paid_on: string }[];
        payment_amount_cents: number;
      },
      now = Date.now(),
      keepCustom = 12,
    ): Vendor {
      const id = `v_${randomUUID().slice(0, 8)}`;
      const day = 86_400_000;
      const onFile = new Date(now - input.number_on_file_days * day).toISOString();
      db.transaction(() => {
        db.prepare(
          `INSERT INTO vendors (id, name, contact_name, contact_phone, contact_email, bank_name, account_last4, routing_last4, payer_name)
           VALUES (?, ?, ?, ?, ?, ?, ?, '0000', ?)`,
        ).run(id, input.name, input.contact_name, input.contact_phone, input.contact_email, input.bank_name, input.account_last4, input.payer_name || null);
        const change = db.prepare(
          `INSERT INTO vendor_changes (vendor_id, field, old_value, new_value, changed_at, source) VALUES (?, ?, ?, ?, ?, ?)`,
        );
        // A number on file for under 30 days is recorded as a change from an older number, which trips the provenance lock.
        const recent = input.number_on_file_days < 30;
        change.run(id, "contact_phone", recent ? "previous number" : null, input.contact_phone, onFile, recent ? "vendor request" : "vendor onboarding");
        change.run(id, "account_last4", null, input.account_last4, new Date(now - Math.max(input.number_on_file_days, 400) * day).toISOString(), "vendor onboarding");
        const invoice = db.prepare(`INSERT INTO invoices (id, vendor_id, number, amount_cents, issued_on, paid_on) VALUES (?, ?, ?, ?, ?, ?)`);
        for (const inv of input.invoices) {
          const issued = new Date(Date.parse(`${inv.paid_on}T00:00:00Z`) - 15 * day).toISOString().slice(0, 10);
          invoice.run(`inv_${randomUUID().slice(0, 8)}`, id, inv.number, inv.amount_cents, issued, inv.paid_on);
        }
        db.prepare(`INSERT INTO payments (id, vendor_id, amount_cents, due_on, status, destination_last4) VALUES (?, ?, ?, ?, 'held', ?)`).run(
          `pay_${randomUUID().slice(0, 8)}`,
          id,
          input.payment_amount_cents,
          new Date(now + 3 * day).toISOString().slice(0, 10),
          input.account_last4,
        );

        const custom = db
          .prepare(
            `SELECT v.id FROM vendors v WHERE v.id NOT IN ('v_northwind', 'v_halden', 'v_brightline')
             AND NOT EXISTS (SELECT 1 FROM runs r JOIN requests q ON q.id = r.request_id WHERE q.vendor_id = v.id AND r.status = 'live')
             ORDER BY v.rowid DESC`,
          )
          .all() as { id: string }[];
        for (const { id: old } of custom.slice(keepCustom)) removeVendor(old);
      })();
      return db.prepare("SELECT * FROM vendors WHERE id = ?").get(id) as Vendor;
    },

    /** Adds a bank-change request against the vendor's next held or scheduled payment. */
    createRequest(input: {
      id: string;
      vendor_id: string;
      channel: string;
      new_bank_name: string;
      new_account_last4: string;
      callback_contact: string | null;
      received_at: string;
    }): ChangeRequest {
      const payment = db
        .prepare("SELECT id FROM payments WHERE vendor_id = ? AND status = 'held' ORDER BY due_on ASC LIMIT 1")
        .get(input.vendor_id) as { id: string } | undefined;
      if (!payment) throw new Error(`No held payment for vendor ${input.vendor_id}`);
      db.prepare(
        `INSERT INTO requests (id, vendor_id, payment_id, received_at, channel, new_bank_name, new_account_last4, callback_contact, status)
         VALUES (@id, @vendor_id, @payment_id, @received_at, @channel, @new_bank_name, @new_account_last4, @callback_contact, 'held')`,
      ).run({ ...input, payment_id: payment.id });
      return db.prepare("SELECT * FROM requests WHERE id = ?").get(input.id) as ChangeRequest;
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
