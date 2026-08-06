import { describe, expect, it } from "vitest";
import { buildStopPages, formatClock, formatStopTime } from "../TrainJourneyDisplay";
import type { TrainStop } from "../../../lib/trainStops";

const stops: TrainStop[] = [
  { station: "Cuenca", time: "12:55" },
  { station: "Albacete", time: "13:33" },
  { station: "Villena", time: "14:24" },
  { station: "Alacant", time: "14:45" },
];

describe("TrainJourneyDisplay helpers", () => {
  it("returns no pages for an empty itinerary", () => {
    expect(buildStopPages([])).toEqual([]);
  });

  it("keeps four or fewer stops on one page", () => {
    expect(buildStopPages(stops)).toEqual([stops]);
  });

  it("pages long itineraries while preserving the final stop", () => {
    const longStops = [...stops, { station: "Valencia", time: "15:30" }, { station: "Castello", time: "16:10" }];
    const pages = buildStopPages(longStops);
    expect(pages).toHaveLength(2);
    expect(pages[0]).toHaveLength(4);
    expect(pages.every((page) => page.at(-1) === longStops.at(-1) || page.includes(longStops.at(-1)!))).toBe(true);
    expect(pages[1].filter((stop) => stop === longStops.at(-1))).toHaveLength(1);
  });

  it("formats clock and missing stop times as HH:mm values", () => {
    expect(formatClock(new Date(2026, 7, 6, 5, 7, 45))).toBe("05:07");
    expect(formatStopTime("14:45:00")).toBe("14:45");
    expect(formatStopTime()).toBe("--:--");
  });
});