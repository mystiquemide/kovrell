import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { showcaseEvidenceView } from "../showcase";
import { buildEvidencePdf } from "./evidence-pdf";

describe("buildEvidencePdf", () => {
  it("renders the showcase run, including characters the standard fonts can't draw", async () => {
    const view = showcaseEvidenceView();
    const events = [...view.events, { id: 999, run_id: view.run.id, t_ms: 1000, kind: "vendor", payload: { text: "It’s “fine” — ok… 日本" } }];
    const bytes = await buildEvidencePdf({ ...view, events, payer: "Acme", jsonUrl: "https://k.test/r.json", pageUrl: "https://k.test/e" });
    expect(Buffer.from(bytes.slice(0, 5)).toString()).toBe("%PDF-");
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(2);
    expect(doc.getTitle()).toContain(view.run.id);
  });
});
