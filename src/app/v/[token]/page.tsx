import { Wordmark } from "@/components/mark";
import { getRunController } from "@/server/runs";
import { VendorCall } from "./vendor-call";

export const dynamic = "force-dynamic";

export default async function VendorCallPage({ params }: PageProps<"/v/[token]">) {
  const { token } = await params;
  const company = process.env.KOVRELL_COMPANY_NAME || "Acme Manufacturing";
  const inspected = getRunController().inspectToken(token);

  if (!inspected.ok) {
    return (
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 py-10">
        <Wordmark />
        <div className="flex flex-1 flex-col justify-center py-12">
          <p className="label text-subtle">Verification call</p>
          <h1 className="heading mt-4 text-[32px]">{inspected.reason}</h1>
          <p className="mt-3 text-muted">If you expected a call from {company} accounts payable, they will contact you again.</p>
        </div>
      </main>
    );
  }

  return <VendorCall token={token} company={company} callerLine="Payment details verification" />;
}
