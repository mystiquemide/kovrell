import type { Db } from "./db";

const DAY = 24 * 60 * 60 * 1000;

function daysAgo(now: number, days: number): string {
  return new Date(now - days * DAY).toISOString();
}

function dateOnly(now: number, days: number): string {
  return daysAgo(now, days).slice(0, 10);
}

// Sample ledger for one company (Acme Manufacturing). Dates are relative to seed time
// so provenance windows (30 days) stay meaningful whenever the ledger is reset.
export function seedSampleLedger(db: Db, now = Date.now()): void {
  const vendor = db.prepare(
    `INSERT INTO vendors (id, name, contact_name, contact_phone, contact_email, bank_name, account_last4, routing_last4)
     VALUES (@id, @name, @contact_name, @contact_phone, @contact_email, @bank_name, @account_last4, @routing_last4)`,
  );
  const change = db.prepare(
    `INSERT INTO vendor_changes (vendor_id, field, old_value, new_value, changed_at, source)
     VALUES (?, ?, ?, ?, ?, ?)`,
  );
  const invoice = db.prepare(
    `INSERT INTO invoices (id, vendor_id, number, amount_cents, issued_on, paid_on) VALUES (?, ?, ?, ?, ?, ?)`,
  );
  const payment = db.prepare(
    `INSERT INTO payments (id, vendor_id, amount_cents, due_on, status, destination_last4) VALUES (?, ?, ?, ?, ?, ?)`,
  );
  const request = db.prepare(
    `INSERT INTO requests (id, vendor_id, payment_id, received_at, channel, new_bank_name, new_account_last4, callback_contact, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );

  db.transaction(() => {
    // Genuine change request. Real vendor will confirm.
    vendor.run({
      id: "v_northwind",
      name: "Northwind Steel",
      contact_name: "Jide Okafor",
      contact_phone: "+1 512 555 0142",
      contact_email: "ap@northwindsteel.example",
      bank_name: "First Citizens Bank",
      account_last4: "2209",
      routing_last4: "0071",
    });
    change.run("v_northwind", "contact_phone", null, "+1 512 555 0142", daysAgo(now, 562), "vendor onboarding");
    change.run("v_northwind", "account_last4", null, "2209", daysAgo(now, 562), "vendor onboarding");
    invoice.run("inv_4388", "v_northwind", "INV-4388", 7_418_000, dateOnly(now, 91), dateOnly(now, 76));
    invoice.run("inv_4426", "v_northwind", "INV-4426", 11_056_250, dateOnly(now, 69), dateOnly(now, 54));
    invoice.run("inv_4471", "v_northwind", "INV-4471", 9_632_500, dateOnly(now, 48), dateOnly(now, 33));
    invoice.run("inv_4502", "v_northwind", "INV-4502", 12_740_000, dateOnly(now, 27), dateOnly(now, 12));
    invoice.run("inv_4533", "v_northwind", "INV-4533", 18_420_000, dateOnly(now, 9), null);
    payment.run("pay_northwind", "v_northwind", 18_420_000, dateOnly(now, -3), "held", "2209");
    request.run(
      "req_northwind",
      "v_northwind",
      "pay_northwind",
      daysAgo(now, 0.2),
      "email",
      "Chase",
      "8841",
      "+1 512 555 0199",
      "held",
    );

    // Business email compromise. Real vendor never asked for this.
    vendor.run({
      id: "v_halden",
      name: "Halden Freight",
      contact_name: "Maria Lindqvist",
      contact_phone: "+1 737 555 0118",
      contact_email: "billing@haldenfreight.example",
      bank_name: "Wells Fargo",
      account_last4: "5530",
      routing_last4: "0248",
    });
    change.run("v_halden", "contact_phone", null, "+1 737 555 0118", daysAgo(now, 830), "vendor onboarding");
    change.run("v_halden", "account_last4", null, "5530", daysAgo(now, 830), "vendor onboarding");
    invoice.run("inv_h2154", "v_halden", "HF-2154", 2_976_480, dateOnly(now, 83), dateOnly(now, 72));
    invoice.run("inv_h2187", "v_halden", "HF-2187", 3_540_900, dateOnly(now, 62), dateOnly(now, 51));
    invoice.run("inv_h2210", "v_halden", "HF-2210", 3_815_060, dateOnly(now, 41), dateOnly(now, 30));
    invoice.run("inv_h2238", "v_halden", "HF-2238", 4_102_275, dateOnly(now, 20), dateOnly(now, 9));
    invoice.run("inv_h2261", "v_halden", "HF-2261", 4_291_540, dateOnly(now, 6), null);
    payment.run("pay_halden", "v_halden", 4_291_540, dateOnly(now, -2), "held", "5530");
    request.run(
      "req_halden",
      "v_halden",
      "pay_halden",
      daysAgo(now, 0.25),
      "email",
      "Metro Commerce Bank",
      "7712",
      "+1 646 555 0173",
      "held",
    );

    // Number of record changed recently. Kovrell must refuse to call.
    vendor.run({
      id: "v_brightline",
      name: "Brightline Print",
      contact_name: "Sam Reyes",
      contact_phone: "+1 415 555 0107",
      contact_email: "accounts@brightlineprint.example",
      bank_name: "US Bank",
      account_last4: "3016",
      routing_last4: "0119",
    });
    change.run("v_brightline", "contact_phone", null, "+1 415 555 0190", daysAgo(now, 410), "vendor onboarding");
    change.run("v_brightline", "account_last4", null, "3016", daysAgo(now, 410), "vendor onboarding");
    change.run("v_brightline", "contact_phone", "+1 415 555 0190", "+1 415 555 0107", daysAgo(now, 6), "vendor portal");
    invoice.run("inv_b118", "v_brightline", "BP-118", 540_000, dateOnly(now, 44), dateOnly(now, 31));
    invoice.run("inv_b124", "v_brightline", "BP-124", 612_000, dateOnly(now, 14), null);
    payment.run("pay_brightline", "v_brightline", 612_000, dateOnly(now, -5), "held", "3016");
    request.run(
      "req_brightline",
      "v_brightline",
      "pay_brightline",
      daysAgo(now, 1),
      "portal",
      "Novo Bank",
      "4480",
      null,
      "held",
    );
  })();
}
