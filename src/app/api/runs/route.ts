import { getStore } from "@/server/store";
import { runListView } from "@/server/views";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({ runs: runListView(getStore()) });
}
