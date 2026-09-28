import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { clock, dateTime, duration, money } from "../lib/format";
import { VERIFY_CMD } from "../lib/verify";

/** The evidence view fields the report needs. Stored runs and the showcase run both fit. */
export interface EvidenceReportInput {
  run: { id: string; verdict: string | null; reason: string | null; started_at: string; ended_at: string | null; aai_session_id: string | null };
  vendor: { name: string; contact_name: string; contact_phone: string };
  request: { new_bank_name: string; new_account_last4: string; channel: string; received_at: string };
  payment: { amount_cents: number; status: string; destination_last4: string };
  labels: Record<string, string>;
  checks: { key: string; status: string; expected: string | null; heard: string | null }[];
  events: { t_ms: number; kind: string; payload: unknown }[];
  evidence: { sha256: string | null; status: string; median_response_ms: number | null } | null;
  record: unknown;
  isShowcase?: boolean;
  payer?: string;
  jsonUrl: string;
  pageUrl: string;
}

const PAGE = { w: 612, h: 792, margin: 54 };
const INK = rgb(0.07, 0.06, 0.07);
const MUTED = rgb(0.42, 0.42, 0.44);
const LINE = rgb(0.86, 0.86, 0.86);
const PASS = rgb(0.05, 0.45, 0.28);
const FAIL = rgb(0.72, 0.13, 0.13);

/** Standard PDF fonts only cover WinAnsi, so typographic characters are folded to plain ones. */
function plain(text: string): string {
  return text
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/…/g, "...")
    .replace(/[^\n\x20-\x7e\xa0-\xff]/g, "");
}

function expectedText(expected: string | null): string {
  if (!expected) return "n/a";
  return /^\d+\.\d{2}$/.test(expected) ? money(Math.round(Number(expected) * 100)) : expected;
}

export async function buildEvidencePdf(input: EvidenceReportInput): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`Kovrell evidence pack ${input.run.id}`);
  doc.setAuthor("Kovrell");
  doc.setSubject(`Bank-detail change verification for ${input.vendor.name}`);
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const mono = await doc.embedFont(StandardFonts.Courier);

  let page: PDFPage = doc.addPage([PAGE.w, PAGE.h]);
  let y = PAGE.h - PAGE.margin;
  const width = PAGE.w - PAGE.margin * 2;

  const newPage = () => {
    page = doc.addPage([PAGE.w, PAGE.h]);
    y = PAGE.h - PAGE.margin;
  };
  const need = (h: number) => {
    if (y - h < PAGE.margin + 24) newPage();
  };

  function wrap(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
    const out: string[] = [];
    for (const para of plain(text).split("\n")) {
      let line = "";
      for (const word of para.split(/(\s+)/)) {
        const next = line + word;
        if (font.widthOfTextAtSize(next, size) <= maxWidth || !line.trim()) {
          line = next;
        } else {
          out.push(line.trimEnd());
          line = word.trimStart();
        }
        // Break tokens wider than the column (hashes, commands) by character.
        while (font.widthOfTextAtSize(line, size) > maxWidth) {
          let cut = line.length - 1;
          while (cut > 1 && font.widthOfTextAtSize(line.slice(0, cut), size) > maxWidth) cut--;
          out.push(line.slice(0, cut));
          line = line.slice(cut);
        }
      }
      out.push(line.trimEnd());
    }
    return out;
  }

  function text(t: string, opts: { font?: PDFFont; size?: number; color?: ReturnType<typeof rgb>; x?: number; maxWidth?: number; gap?: number } = {}) {
    const { font = regular, size = 10, color = INK, x = PAGE.margin, maxWidth = width, gap = 4 } = opts;
    for (const line of wrap(t, font, size, maxWidth)) {
      need(size + gap);
      page.drawText(line, { x, y: y - size, size, font, color });
      y -= size + gap;
    }
  }

  const rule = (space = 10) => {
    need(space * 2);
    y -= space;
    page.drawLine({ start: { x: PAGE.margin, y }, end: { x: PAGE.w - PAGE.margin, y }, thickness: 0.6, color: LINE });
    y -= space;
  };

  const heading = (t: string) => {
    // Keep a heading on the same page as its first row.
    need(64);
    y -= 12;
    text(t.toUpperCase(), { font: bold, size: 8.5, color: MUTED, gap: 8 });
  };

  /** One row of fixed columns; each cell wraps inside its column and the row takes the tallest cell. */
  function row(cells: { t: string; w: number; font?: PDFFont; color?: ReturnType<typeof rgb>; align?: "right" }[], size = 9.5) {
    const wrapped = cells.map((c) => wrap(c.t, c.font ?? regular, size, c.w - 8));
    const h = Math.max(...wrapped.map((l) => l.length)) * (size + 3) + 6;
    need(h);
    let x = PAGE.margin;
    cells.forEach((c, i) => {
      wrapped[i].forEach((line, j) => {
        const font = c.font ?? regular;
        const lx = c.align === "right" ? x + c.w - font.widthOfTextAtSize(line, size) : x;
        page.drawText(line, { x: lx, y: y - size - j * (size + 3), size, font, color: c.color ?? INK });
      });
      x += c.w;
    });
    y -= h;
    page.drawLine({ start: { x: PAGE.margin, y: y + 2 }, end: { x: PAGE.w - PAGE.margin, y: y + 2 }, thickness: 0.4, color: LINE });
  }

  const { run, vendor, request, payment, evidence } = input;
  const verdict = run.verdict ?? "In progress";
  const verdictColor = verdict === "PASS" ? PASS : verdict === "FAIL" ? FAIL : MUTED;

  // Header
  text("KOVRELL", { font: bold, size: 11, gap: 2 });
  text(`Evidence pack  /  ${run.id}  /  generated ${dateTime(new Date().toISOString())}`, { size: 8.5, color: MUTED });
  y -= 14;
  text(vendor.name, { font: bold, size: 22, gap: 6 });
  text(verdict, { font: bold, size: 16, color: verdictColor, gap: 6 });
  if (run.reason) text(run.reason, { size: 11 });
  text(
    verdict === "PASS"
      ? `Payment released to ${request.new_bank_name} ending ${request.new_account_last4}.`
      : verdict === "FAIL"
        ? "Payment blocked. The account on file was kept."
        : "Payment stays held.",
    { size: 11, color: MUTED },
  );
  const manual = input.events.find((e) => e.kind === "manual")?.payload as { verified_by: string; method: string; confirmed_last4: string; note: string | null } | undefined;
  if (manual) {
    y -= 4;
    const how = { in_person: "in person", video_call: "on a video call", known_number: "on a number already known to AP" }[manual.method] ?? manual.method;
    text(`Verified outside Kovrell by ${manual.verified_by}, ${how}. No call was placed, so there is no recording. The vendor confirmed the new account ending ${manual.confirmed_last4}.${manual.note ? ` Note: ${manual.note}` : ""}`, {
      size: 9.5,
      color: MUTED,
    });
  }
  if (input.isShowcase) {
    y -= 4;
    text("Showcase run. The agent ran live on the AssemblyAI Voice Agent API; the vendor's answers were spoken by a scripted test caller against the sample ledger.", {
      size: 9,
      color: MUTED,
    });
  }

  heading("Summary");
  const facts: [string, string][] = [
    ["Called on behalf of", input.payer ?? "Acme Manufacturing"],
    ["Contact of record", `${vendor.contact_name}, ${vendor.contact_phone}`],
    ["Change requested", `${request.new_bank_name} ending ${request.new_account_last4}, received by ${request.channel} ${dateTime(request.received_at)}`],
    ["Payment", `${money(payment.amount_cents)}, ${payment.status}, destination ending ${payment.destination_last4}`],
    ["Call", `${dateTime(run.started_at)}${duration(run.started_at, run.ended_at) ? `, ${duration(run.started_at, run.ended_at)}` : ""}`],
    ["AssemblyAI session", run.aai_session_id ?? "none"],
  ];
  if (evidence?.median_response_ms != null) facts.push(["Median agent response", `${evidence.median_response_ms} ms`]);
  for (const [k, v] of facts) row([{ t: k, w: 150, color: MUTED }, { t: v, w: width - 150 }]);

  heading("Checks");
  row([
    { t: "Check", w: 170, font: bold, color: MUTED },
    { t: "Expected", w: 110, font: bold, color: MUTED },
    { t: "Heard", w: 164, font: bold, color: MUTED },
    { t: "Result", w: 60, font: bold, color: MUTED, align: "right" },
  ]);
  for (const c of input.checks) {
    const color = c.status === "pass" ? PASS : c.status === "fail" ? FAIL : MUTED;
    row([
      { t: input.labels[c.key] ?? c.key, w: 170 },
      { t: expectedText(c.expected), w: 110, font: mono },
      { t: c.heard ?? "Not answered", w: 164 },
      { t: c.status === "pending" ? "not reached" : c.status.toUpperCase(), w: 60, font: bold, color, align: "right" },
    ]);
  }
  y -= 4;
  text("Expected values come from the ledger and appear only in the evidence pack. The agent never heard them.", { size: 8.5, color: MUTED });

  const provenance = (input.record as { provenance_at_call?: { label: string; status: string; detail: string }[] } | null)?.provenance_at_call;
  if (provenance?.length) {
    heading("Provenance at call time");
    for (const p of provenance) {
      row([
        { t: `${p.label}\n${p.detail}`, w: width - 60 },
        { t: p.status.toUpperCase(), w: 60, font: bold, color: p.status === "ok" ? PASS : p.status === "fail" ? FAIL : MUTED, align: "right" },
      ]);
    }
  }

  const timeline = input.events.filter((ev) => ["agent", "vendor", "tool"].includes(ev.kind));
  if (timeline.length) heading("Timeline");
  for (const e of timeline) {
    const p = e.payload as { text?: string; name?: string; args?: Record<string, unknown> };
    const who = e.kind === "agent" ? "Agent" : e.kind === "tool" ? "Tool" : "Vendor";
    const what = e.kind === "tool" ? `${p.name}(${p.args?.question_id ? String(p.args.question_id) : ""})` : (p.text ?? "");
    row([
      { t: clock(e.t_ms), w: 44, font: mono, color: MUTED },
      { t: who, w: 56, font: bold, color: e.kind === "agent" ? INK : MUTED },
      { t: what, w: width - 100, font: e.kind === "tool" ? mono : regular, color: e.kind === "tool" ? MUTED : INK },
    ]);
  }

  heading("Seal");
  if (evidence?.sha256) {
    text("SHA-256 over the canonical run record: request, provenance, checks with expected values, every event, and the AssemblyAI session.", {
      size: 9.5,
    });
    y -= 2;
    text(evidence.sha256, { font: mono, size: 9.5 });
    y -= 4;
    text(`This PDF is a readable copy. The seal covers the JSON record at ${input.jsonUrl}. To check it, save that file as kovrell-record.json and run:`, {
      size: 9,
      color: MUTED,
    });
    text(VERIFY_CMD, { font: mono, size: 7.5, color: MUTED, gap: 2 });
  } else {
    text("Not sealed yet. The seal is added within a minute of the call ending.", { size: 9.5, color: MUTED });
  }
  rule(8);
  text(`Full evidence page: ${input.pageUrl}`, { size: 8.5, color: MUTED });

  const pages = doc.getPages();
  pages.forEach((p, i) =>
    p.drawText(`Kovrell evidence pack ${run.id}  /  page ${i + 1} of ${pages.length}`, { x: PAGE.margin, y: 30, size: 7.5, font: regular, color: MUTED }),
  );
  return doc.save();
}
