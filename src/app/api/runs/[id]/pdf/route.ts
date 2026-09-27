import type { NextRequest } from "next/server";
import { buildEvidencePdf } from "@/server/evidence-pdf";
import { COPY } from "@/lib/messages";
import { getStore } from "@/server/store";
import { evidenceView } from "@/server/views";
import { SHOWCASE_RUN_ID, showcaseEvidenceView } from "@/showcase";

export const dynamic = "force-dynamic";

/** The evidence pack as a PDF an auditor can file. The seal itself covers the JSON record. */
export async function GET(_req: NextRequest, ctx: RouteContext<"/api/runs/[id]/pdf">) {
  const { id } = await ctx.params;
  const base = (process.env.PUBLIC_BASE_URL || "https://kovrell.midelabs.xyz").replace(/\/$/, "");
  const fallbackPayer = process.env.KOVRELL_COMPANY_NAME || "Acme Manufacturing";

  let input;
  if (id === SHOWCASE_RUN_ID) {
    const view = showcaseEvidenceView();
    input = { ...view, payer: fallbackPayer, jsonUrl: `${base}${view.downloadHref}` };
  } else {
    const store = getStore();
    const view = evidenceView(store, id);
    if (!view) return Response.json({ error: COPY.runNotFound }, { status: 404 });
    if (view.run.status !== "ended") return Response.json({ error: COPY.runOpen }, { status: 409 });
    const payer = view.run.caller_company || store.getRequestDetail(view.run.request_id)?.vendor.payer_name || fallbackPayer;
    input = { ...view, payer, jsonUrl: `${base}/api/runs/${id}/evidence?download=1` };
  }

  const pdf = await buildEvidencePdf({ ...input, pageUrl: `${base}/evidence/${id}` });
  return new Response(Buffer.from(pdf), {
    headers: { "content-type": "application/pdf", "content-disposition": `attachment; filename="kovrell-evidence-${id}.pdf"` },
  });
}
