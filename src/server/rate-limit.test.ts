import { describe, expect, it } from "vitest";
import { allow } from "./rate-limit";

describe("allow", () => {
  it("permits up to max per window, then refuses with a retry time", () => {
    const t = 1_000_000;
    expect(allow("a", 2, 60_000, t).ok).toBe(true);
    expect(allow("a", 2, 60_000, t + 1).ok).toBe(true);
    expect(allow("a", 2, 60_000, t + 2)).toEqual({ ok: false, retryAfterS: 60 });
    expect(allow("b", 2, 60_000, t + 2).ok).toBe(true);
  });

  it("frees a slot once the oldest hit leaves the window", () => {
    const t = 2_000_000;
    allow("c", 1, 60_000, t);
    expect(allow("c", 1, 60_000, t + 59_999).ok).toBe(false);
    expect(allow("c", 1, 60_000, t + 60_000).ok).toBe(true);
  });
});
