import { describe, expect, it } from "vitest";

import { computeNextScheduledFor, MAX_RENOTIFY_COUNT } from "./reviewReminderPolicy";

describe("reviewReminderPolicy", () => {
  it("repeatCount=0..3 は nextScheduledFor を返す", () => {
    const now = Date.UTC(2025, 0, 1, 0, 0, 0);
    for (let i = 0; i <= 3; i++) {
      const next = computeNextScheduledFor(now, i);
      expect(next).toBeTypeOf("string");
      expect(Date.parse(next!)).toBeGreaterThan(now);
    }
  });

  it(`repeatCount=${MAX_RENOTIFY_COUNT - 1} は null（5回目送信後は再通知しない）`, () => {
    const now = Date.UTC(2025, 0, 1, 0, 0, 0);
    expect(computeNextScheduledFor(now, MAX_RENOTIFY_COUNT - 1)).toBeNull();
  });

  it("不正値は例外", () => {
    expect(() => computeNextScheduledFor(Number.NaN, 0)).toThrow();
    expect(() => computeNextScheduledFor(Date.now(), -1)).toThrow();
    expect(() => computeNextScheduledFor(Date.now(), 1.2)).toThrow();
  });
});

