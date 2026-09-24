import { Nav } from "@/components/nav";

export default function AppLayout({ children }: LayoutProps<"/">) {
  const company = (process.env.KOVRELL_COMPANY_NAME || "Acme Manufacturing").toUpperCase();
  return (
    <>
      <Nav company={company} />
      <main className="mx-auto w-full max-w-[1200px] flex-1 px-4 pb-24 pt-10 sm:px-6 sm:pt-14">{children}</main>
    </>
  );
}
