import Link from "next/link";
import { SetupForm } from "./setup-form";

export const metadata = { title: "Set up a vendor" };

export default function SetupPage() {
  return (
    <div className="reveal max-w-[880px]">
      <p className="label text-subtle">Set up</p>
      <h1 className="heading mt-3 text-[32px] sm:text-[40px]">Run Kovrell on your own vendor.</h1>
      <p className="mt-4 text-[17px] leading-[1.55] text-muted">
        In production your ERP sends these details through the <Link href="/integrate" className="text-ink underline underline-offset-4">API</Link>. Here you
        type them in, then take the call as the vendor. The questions come from the invoices you enter, so answer from memory, or get one wrong to watch
        the payment get blocked.
      </p>
      <p className="mt-4 rounded-[10px] border border-line bg-panel px-4 py-3 text-[14px] text-ink-2">
        This is a shared sandbox. Use made-up names and numbers, never real vendor or banking details. Reset clears everything you add.
      </p>
      <SetupForm />
    </div>
  );
}
