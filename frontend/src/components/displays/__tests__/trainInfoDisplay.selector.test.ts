import { describe, expect, it } from "vitest";
import { journeyKeyFor, selectTrainInfoTrain, type TrainInfoRow } from "../trainInfoDisplay.selector";

const row = (overrides: Partial<TrainInfoRow>): TrainInfoRow => ({
  id: overrides.id ?? 1,
  number: "1234",
  destination: "Valencia",
  scheduled_time: "12:00",
  status: "Scheduled",
  platform: "1",
  sector: "A",
  ...overrides,
});

describe("selectTrainInfoTrain", () => {
  it("returns undefined for an empty board", () => {
    expect(selectTrainInfoTrain([], { platform: "1" })).toBeUndefined();
    expect(selectTrainInfoTrain(undefined, { platform: "1" })).toBeUndefined();
  });

  it("picks the row matching the screen's configured platform", () => {
    const rows = [row({ id: 1, platform: "2" }), row({ id: 2, platform: "1" })];
    const selected = selectTrainInfoTrain(rows, { platform: "1" });
    expect(selected?.id).toBe(2);
  });

  it("picks the row matching the screen's configured sector when platform is not set", () => {
    const rows = [row({ id: 1, sector: "B" }), row({ id: 2, sector: "A" })];
    const selected = selectTrainInfoTrain(rows, { sector: "A" });
    expect(selected?.id).toBe(2);
  });

  it("does not pick a different train that merely shares the same destination", () => {
    const rows = [row({ id: 1, platform: "3", destination: "Valencia" }), row({ id: 2, platform: "1", destination: "Valencia" })];
    const selected = selectTrainInfoTrain(rows, { platform: "1" });
    expect(selected?.id).toBe(2);
  });

  it("skips trains that already departed or arrived", () => {
    const rows = [row({ id: 1, platform: "1", status: "Departed" }), row({ id: 2, platform: "1", status: "Scheduled" })];
    const selected = selectTrainInfoTrain(rows, { platform: "1" });
    expect(selected?.id).toBe(2);
  });

  it("returns undefined when the selected train is no longer on the board", () => {
    const rows = [row({ id: 1, platform: "9" })];
    expect(selectTrainInfoTrain(rows, { platform: "1" })).toBeUndefined();
  });

  it("falls back to the earliest eligible row when the screen has no platform/sector configured", () => {
    const rows = [row({ id: 1 }), row({ id: 2 })];
    const selected = selectTrainInfoTrain(rows, {});
    expect(selected?.id).toBe(1);
  });
});

describe("journeyKeyFor", () => {
  it("prefers the real id when present", () => {
    expect(journeyKeyFor(row({ id: 42 }))).toBe("id:42");
  });

  it("changes when the train changes", () => {
    expect(journeyKeyFor(row({ id: 1 }))).not.toBe(journeyKeyFor(row({ id: 2 })));
  });

  it("falls back to a composite key when no id is present, without reusing rows[0] blindly", () => {
    const key = journeyKeyFor(row({ id: null, number: "9999", scheduled_time: "08:00", destination: "Alacant" }));
    expect(key).toBe("fallback|9999|08:00|Alacant");
  });

  it("returns an empty key when there is no train", () => {
    expect(journeyKeyFor(undefined)).toBe("");
  });
});
