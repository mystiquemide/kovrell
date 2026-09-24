import { getRunController } from "@/server/runs";
import { VendorCall } from "./vendor-call";

export const dynamic = "force-dynamic";

export default async function VendorCallPage({ params }: PageProps<"/v/[token]">) {
  const { token } = await params;
  const company = process.env.KOVRELL_COMPANY_NAME || "Acme Manufacturing";
  const inspected = getRunController().inspectToken(token);

  if (!inspected.ok) {
    return (
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-12">
        <p className="font-mono text-xs tracking-[0.18em] text-muted">VERIFICATION CALL</p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">{inspected.reason}</h1>
      </main>
    );
  }

  return <VendorCall token={token} company={company} callerLine="Payment details verification" />;
}
