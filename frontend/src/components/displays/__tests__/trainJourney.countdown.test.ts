import { describe, expect, it } from "vitest";
import { computeDepartureCountdown, formatDepartureCountdown } from "../trainJourney.countdown";

const now = new Date(2026, 7, 6, 12, 0, 0);

describe("computeDepartureCountdown", () => {
  it("returns minutes remaining for a future departure the same day", () => {
    const result = computeDepartureCountdown({ scheduled_time: "12:30" }, now);
    expect(result).toEqual({ kind: "minutes", minutes: 30 });
  });

  it("reports a train that left a minute ago as passed, not 1439 minutes", () => {
    const result = computeDepartureCountdown({ scheduled_time: "11:59" }, now);
    expect(result).toEqual({ kind: "passed" });
    expect(formatDepartureCountdown(result)).toBe("0 min");
  });

  it("wraps to tomorrow only for a genuinely large negative difference", () => {
    const almostMidnight = new Date(2026, 7, 6, 23, 50, 0);
    const result = computeDepartureCountdown({ scheduled_time: "00:05" }, almostMidnight);
    expect(result).toEqual({ kind: "minutes", minutes: 15 });
  });

  it("does not wrap a same-day time that is merely within the past 12 hours", () => {
    const result = computeDepartureCountdown({ scheduled_time: "00:05" }, now);
    expect(result).toEqual({ kind: "passed" });
  });

  it("prefers expected_time over scheduled_time", () => {
    const result = computeDepartureCountdown({ scheduled_time: "12:00", expected_time: "12:15" }, now);
    expect(result).toEqual({ kind: "minutes", minutes: 15 });
  });

  it("returns unknown for an invalid time string", () => {
    expect(computeDepartureCountdown({ scheduled_time: "25:99" }, now)).toEqual({ kind: "unknown" });
  });

  it("returns unknown when no time field is present", () => {
    expect(computeDepartureCountdown({}, now)).toEqual({ kind: "unknown" });
  });

  it("rejects out-of-range hours and minutes", () => {
    expect(computeDepartureCountdown({ scheduled_time: "24:00" }, now)).toEqual({ kind: "unknown" });
    expect(computeDepartureCountdown({ scheduled_time: "10:60" }, now)).toEqual({ kind: "unknown" });
  });

  it("never returns a negative minute count", () => {
    const result = computeDepartureCountdown({ scheduled_time: "11:58" }, now);
    expect(result.kind === "minutes" ? result.minutes : 0).toBeGreaterThanOrEqual(0);
  });
});

describe("formatDepartureCountdown", () => {
  it("formats an unknown countdown", () => {
    expect(formatDepartureCountdown({ kind: "unknown" })).toBe("-- min");
  });
});
