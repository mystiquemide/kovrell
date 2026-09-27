import { cookies } from "next/headers";

export const COMPANY_COOKIE = "kovrell_company";
const VALID = /^[\p{L}\p{N} .,&'()-]{2,60}$/u;

export function defaultCompany(): string {
  return process.env.KOVRELL_COMPANY_NAME || "Acme Manufacturing";
}

/** The company set on Set up by this visitor, if any. The sandbox has no accounts, so a cookie stands in for the tenant. */
export async function visitorCompany(): Promise<string | null> {
  const value = (await cookies()).get(COMPANY_COOKIE)?.value;
  return value && VALID.test(value) ? value : null;
}
