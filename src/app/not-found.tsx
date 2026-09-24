import { Nav } from "@/components/nav";
import { ButtonLink, Arrow } from "@/components/button";

export default function NotFound() {
  return (
    <>
      <Nav company={`${process.env.KOVRELL_COMPANY_NAME || "Acme Manufacturing"} AP`} />
      <main className="mx-auto w-full max-w-[1200px] flex-1 px-4 pt-20 sm:px-6">
        <p className="label text-subtle">404</p>
        <h1 className="heading mt-3 text-[40px]">Nothing here.</h1>
        <ButtonLink href="/requests" className="mt-8">
          Back to requests <Arrow />
        </ButtonLink>
      </main>
    </>
  );
}
