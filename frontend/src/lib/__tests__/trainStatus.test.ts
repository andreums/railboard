import { describe, expect, it } from "vitest";
import { isCancelledStatus, isFinalStatus, normalizeTrainStatus, trainStatusLabel } from "../trainStatus";

describe("normalizeTrainStatus", () => {
  it("normalizes known backend values case-insensitively", () => {
    expect(normalizeTrainStatus("Cancelled")).toBe("cancelled");
    expect(normalizeTrainStatus("DEPARTED")).toBe("departed");
  });

  it("falls back to unknown for unrecognized values", () => {
    expect(normalizeTrainStatus("Whatever")).toBe("unknown");
    expect(normalizeTrainStatus(undefined)).toBe("unknown");
  });
});

describe("isCancelledStatus / isFinalStatus", () => {
  it("only treats the real Cancelled status as cancelled", () => {
    expect(isCancelledStatus("Cancelled")).toBe(true);
    expect(isCancelledStatus("Delayed")).toBe(false);
  });

  it("treats Departed and Arrived as final", () => {
    expect(isFinalStatus("Departed")).toBe(true);
    expect(isFinalStatus("Arrived")).toBe(true);
    expect(isFinalStatus("Scheduled")).toBe(false);
  });
});

describe("trainStatusLabel", () => {
  it("uses an existing translation key", () => {
    expect(trainStatusLabel("Cancelled", "es")).not.toBe("");
  });

  it("passes through unknown statuses instead of inventing a translation", () => {
    expect(trainStatusLabel("Whatever", "es")).toBe("Whatever");
  });
});
