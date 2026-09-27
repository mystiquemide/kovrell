import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

export type Db = Database.Database;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS vendors (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  contact_name TEXT NOT NULL,
  contact_phone TEXT NOT NULL,
  contact_email TEXT NOT NULL,
  bank_name TEXT NOT NULL,
  account_last4 TEXT NOT NULL,
  routing_last4 TEXT NOT NULL,
  payer_name TEXT
);
CREATE TABLE IF NOT EXISTS vendor_changes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  vendor_id TEXT NOT NULL REFERENCES vendors(id),
  field TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT NOT NULL,
  changed_at TEXT NOT NULL,
  source TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS invoices (
  id TEXT PRIMARY KEY,
  vendor_id TEXT NOT NULL REFERENCES vendors(id),
  number TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  issued_on TEXT NOT NULL,
  paid_on TEXT
);
CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  vendor_id TEXT NOT NULL REFERENCES vendors(id),
  amount_cents INTEGER NOT NULL,
  due_on TEXT NOT NULL,
  status TEXT NOT NULL,
  destination_last4 TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS requests (
  id TEXT PRIMARY KEY,
  vendor_id TEXT NOT NULL REFERENCES vendors(id),
  payment_id TEXT NOT NULL REFERENCES payments(id),
  received_at TEXT NOT NULL,
  channel TEXT NOT NULL,
  new_bank_name TEXT NOT NULL,
  new_account_last4 TEXT NOT NULL,
  callback_contact TEXT,
  status TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS runs (
  id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL REFERENCES requests(id),
  channel TEXT NOT NULL,
  call_token TEXT NOT NULL UNIQUE,
  token_expires_at TEXT NOT NULL,
  token_used INTEGER NOT NULL DEFAULT 0,
  aai_session_id TEXT,
  status TEXT NOT NULL,
  verdict TEXT,
  reason TEXT,
  started_at TEXT NOT NULL,
  ended_at TEXT,
  evidence_sha256 TEXT
);
CREATE TABLE IF NOT EXISTS run_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id TEXT NOT NULL REFERENCES runs(id),
  t_ms INTEGER NOT NULL,
  kind TEXT NOT NULL,
  payload_json TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS evidence (
  run_id TEXT PRIMARY KEY REFERENCES runs(id),
  levels_json TEXT NOT NULL,
  timeline_json TEXT,
  audio_available INTEGER NOT NULL DEFAULT 0,
  median_response_ms INTEGER,
  record_json TEXT,
  sha256 TEXT,
  status TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS checks (
  run_id TEXT NOT NULL REFERENCES runs(id),
  key TEXT NOT NULL,
  status TEXT NOT NULL,
  expected TEXT,
  heard TEXT,
  PRIMARY KEY (run_id, key)
);
`;

export function openDb(path: string): Db {
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  const db = new Database(path);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(SCHEMA);
  // Databases created before per-vendor payer names get the column added in place.
  const cols = db.prepare("PRAGMA table_info(vendors)").all() as { name: string }[];
  if (!cols.some((c) => c.name === "payer_name")) db.exec("ALTER TABLE vendors ADD COLUMN payer_name TEXT");
  return db;
}
