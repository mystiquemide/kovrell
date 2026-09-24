import { notFound } from "next/navigation";
import { getRunController } from "@/server/runs";
import { getStore } from "@/server/store";
import { runView } from "@/server/views";
import { LiveCall } from "./live-call";

export const dynamic = "force-dynamic";
export const metadata = { title: "Verification call" };

export default async function CallPage({ params }: PageProps<"/calls/[id]">) {
  const { id } = await params;
  const view = runView(getStore(), id);
  if (!view) notFound();
  return <LiveCall initial={view} callPath={getRunController().callPathFor(id)} />;
}
