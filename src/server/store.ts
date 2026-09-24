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
