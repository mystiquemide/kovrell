import { Nav } from "@/components/nav";
import { ButtonLink, Arrow } from "@/components/button";
import { visitorCompany } from "@/lib/company";

export default async function NotFound() {
  return (
    <>
      <Nav company={await visitorCompany()} />
      <main className="mx-auto w-full max-w-[1280px] flex-1 px-4 pt-20 sm:px-8">
        <p className="label text-subtle">404</p>
        <h1 className="heading mt-3 text-[40px]">Nothing here.</h1>
        <ButtonLink href="/requests" className="mt-8">
          Back to requests <Arrow />
        </ButtonLink>
      </main>
    </>
  );
}
