// Shared display formatting. Times are shown in UTC and say so, since the server renders them.

export function money(cents: number): string {
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
}

export function dateTime(iso: string): string {
  const d = new Date(iso);
  return `${d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })}, ${d.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  })} UTC`;
}

export function dateOnly(iso: string): string {
  return new Date(iso.length === 10 ? `${iso}T00:00:00Z` : iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function clock(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

export function duration(startIso: string, endIso: string | null): string | null {
  if (!endIso) return null;
  return clock(Date.parse(endIso) - Date.parse(startIso));
}

export const CHANNEL_LABEL: Record<string, string> = {
  email: "Email",
  portal: "Vendor portal",
  phone: "Phone",
  letter: "Letter",
};
