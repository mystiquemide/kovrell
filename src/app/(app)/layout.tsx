import { Nav } from "@/components/nav";
import { visitorCompany } from "@/lib/company";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const company = await visitorCompany();
  return (
    <>
      <Nav company={company} />
      <main className="mx-auto w-full max-w-[1280px] flex-1 px-4 pb-24 pt-12 sm:px-8 sm:pt-16">{children}</main>
    </>
  );
}
