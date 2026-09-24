// Parsing of spoken or transcribed answers. Transcripts usually arrive with digits
// ("$96,325"), but the model may pass words through ("ninety six thousand"), so both work.

const UNITS: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9,
  ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16,
  seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50,
  sixty: 60, seventy: 70, eighty: 80, ninety: 90,
};
const SCALES: Record<string, number> = { hundred: 100, thousand: 1_000, million: 1_000_000 };

function wordsToNumber(text: string): number | null {
  const tokens = text.toLowerCase().replace(/-/g, " ").split(/[\s,]+/).filter(Boolean);
  let total = 0;
  let current = 0;
  let seen = false;
  for (const t of tokens) {
    if (t === "and" || t === "a") continue;
    if (t in UNITS) {
      current += UNITS[t];
      seen = true;
    } else if (t === "hundred") {
      current = (current || 1) * 100;
      seen = true;
    } else if (t in SCALES) {
      total += (current || 1) * SCALES[t];
      current = 0;
      seen = true;
    } else {
      return null;
    }
  }
  return seen ? total + current : null;
}

/** Returns an amount in cents, or null when the answer holds no usable amount. */
export function parseAmountCents(answer: string): number | null {
  const text = answer.trim().toLowerCase();
  if (!text) return null;

  const digits = text.match(/(\d[\d,]*)(\.\d{1,2})?\s*(k|thousand|m|million)?/);
  if (digits) {
    const whole = Number(digits[1].replace(/,/g, ""));
    const frac = digits[2] ? Number(digits[2].slice(1).padEnd(2, "0")) : 0;
    const scale = digits[3] === "k" || digits[3] === "thousand" ? 1_000 : digits[3] === "m" || digits[3] === "million" ? 1_000_000 : 1;
    if (scale > 1) return Math.round((whole + frac / 100) * scale * 100);
    return whole * 100 + frac;
  }

  // "ninety six thousand three hundred twenty five dollars and fifty cents"
  const cleaned = text.replace(/[$.]/g, " ").replace(/\b(dollars?|usd|bucks)\b/g, " ");
  const [dollarPart, centPart] = cleaned.split(/\band\b(?=[^]*\bcents?\b)/);
  const dollars = wordsToNumber(dollarPart.replace(/\bcents?\b/g, ""));
  if (dollars === null) return null;
  const cents = centPart ? wordsToNumber(centPart.replace(/\bcents?\b/g, "")) ?? 0 : 0;
  return dollars * 100 + cents;
}

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

export interface MonthDay {
  month: number; // 1-12
  day: number;
  year?: number;
}

/** Parses "August 12", "12 Aug 2026", "2026-08-12", "8/12". Year is optional. US order for slashes. */
export function parseMonthDay(answer: string): MonthDay | null {
  const text = answer.trim().toLowerCase().replace(/(\d)(st|nd|rd|th)\b/g, "$1");

  const iso = text.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) return { year: +iso[1], month: +iso[2], day: +iso[3] };

  const slash = text.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/);
  if (slash) {
    const year = slash[3] ? (slash[3].length === 2 ? 2000 + +slash[3] : +slash[3]) : undefined;
    return valid({ month: +slash[1], day: +slash[2], year });
  }

  const monthIdx = MONTHS.findIndex((m) => new RegExp(`\\b${m}[a-z]*\\b`).test(text));
  if (monthIdx >= 0) {
    const nums = [...text.matchAll(/\b(\d{1,4})\b/g)].map((m) => +m[1]);
    const day = nums.find((n) => n >= 1 && n <= 31);
    const year = nums.find((n) => n >= 1900);
    if (day !== undefined) return valid({ month: monthIdx + 1, day, year });
  }
  return null;
}

function valid(d: MonthDay): MonthDay | null {
  return d.month >= 1 && d.month <= 12 && d.day >= 1 && d.day <= 31 ? d : null;
}

/** True when the spoken date is within `toleranceDays` of the ISO date. Year defaults to the expected year. */
export function sameDay(answer: MonthDay, expectedIso: string, toleranceDays = 1): boolean {
  const expected = new Date(`${expectedIso.slice(0, 10)}T00:00:00Z`);
  const year = answer.year ?? expected.getUTCFullYear();
  const heard = Date.UTC(year, answer.month - 1, answer.day);
  return Math.abs(heard - expected.getTime()) <= toleranceDays * 24 * 60 * 60 * 1000;
}

function tokens(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 3);
}

/** True when any meaningful token of the expected name appears in the heard name. */
export function nameMatches(heard: string, expected: string): boolean {
  const h = new Set(tokens(heard));
  return tokens(expected).some((t) => h.has(t));
}
