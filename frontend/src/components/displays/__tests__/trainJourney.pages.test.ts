import { describe, expect, it } from "vitest";
import { buildStopPages, finalStopOf, pagesSignature } from "../trainJourney.pages";
import type { TrainStop } from "../../../lib/trainStops";

const stop = (station: string, time: string): TrainStop => ({ station, time });

const fourStops: TrainStop[] = [stop("Cuenca", "12:55"), stop("Albacete", "13:33"), stop("Villena", "14:24"), stop("Alacant", "14:45")];

describe("buildStopPages", () => {
  it("returns no pages for an empty itinerary", () => {
    expect(buildStopPages([], 4)).toEqual([]);
  });

  it("keeps stops fewer than visibleRows on one page", () => {
    const stops = fourStops.slice(0, 2);
    expect(buildStopPages(stops, 4)).toEqual([stops]);
  });

  it("keeps exactly four stops on one page", () => {
    expect(buildStopPages(fourStops, 4)).toEqual([fourStops]);
  });

  it("pages five stops while preserving the final destination on every page", () => {
    const stops = [...fourStops, stop("Valencia", "15:30")];
    const pages = buildStopPages(stops, 4);
    expect(pages.length).toBeGreaterThan(1);
    for (const page of pages) {
      expect(page.length).toBeLessThanOrEqual(4);
      expect(page.at(-1)).toBe(stops.at(-1));
      expect(page.filter((s) => s === stops.at(-1))).toHaveLength(1);
    }
  });

  it("pages a long journey without ever exceeding visibleRows per page", () => {
    const stops = Array.from({ length: 13 }, (_, i) => stop(`Station ${i}`, `${String(10 + i).padStart(2, "0")}:00`));
    const pages = buildStopPages(stops, 4);
    for (const page of pages) expect(page.length).toBeLessThanOrEqual(4);
  });

  it("gives each stop its own page when visibleRows is 1, without appending the destination", () => {
    const pages = buildStopPages(fourStops, 1);
    expect(pages).toHaveLength(4);
    for (const page of pages) expect(page).toHaveLength(1);
  });

  it("treats visibleRows of 0 as at least 1", () => {
    const pages = buildStopPages(fourStops, 0);
    for (const page of pages) expect(page.length).toBeLessThanOrEqual(1);
  });

  it("floors a decimal visibleRows value", () => {
    const pages = buildStopPages(fourStops, 2.9);
    for (const page of pages) expect(page.length).toBeLessThanOrEqual(2);
  });
});

describe("finalStopOf", () => {
  it("returns the last stop", () => {
    expect(finalStopOf(fourStops)).toBe(fourStops.at(-1));
  });

  it("returns undefined for an empty itinerary", () => {
    expect(finalStopOf([])).toBeUndefined();
  });
});

describe("pagesSignature", () => {
  it("differs when stop content changes even if page count stays the same", () => {
    const a = buildStopPages(fourStops, 4);
    const changed = fourStops.map((s, i) => (i === 1 ? { ...s, time: "99:99" } : s));
    const b = buildStopPages(changed, 4);
    expect(pagesSignature(a)).not.toBe(pagesSignature(b));
  });
});
