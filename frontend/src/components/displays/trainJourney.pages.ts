import type { TrainStop } from "../../lib/trainStops";

/**
 * Splits an itinerary into pages of at most `visibleRows` stops each,
 * repeating the final destination on every page (except when everything
 * already fits on one page, or when visibleRows is 1 — one stop per page,
 * no room to also pin the destination) so viewers always see where the
 * train is headed.
 *
 * Invariants:
 * - No page ever exceeds `visibleRows` entries.
 * - The destination never appears twice within the same page.
 * - `buildStopPages([], n) === []`.
 */
export function buildStopPages(stops: TrainStop[], visibleRows = 4): TrainStop[][] {
  if (stops.length === 0) return [];

  const pageSize = Math.max(1, Math.floor(visibleRows) || 1);

  if (stops.length <= pageSize) return [stops];
  if (pageSize === 1) return stops.map((stop) => [stop]);

  const destination = stops[stops.length - 1];
  const intermediateStops = stops.slice(0, -1);
  const intermediatePageSize = pageSize - 1;
  const pages: TrainStop[][] = [];

  for (let start = 0; start < intermediateStops.length; start += intermediatePageSize) {
    pages.push([...intermediateStops.slice(start, start + intermediatePageSize), destination]);
  }

  return pages;
}

/** The itinerary's true final stop (by reference), used to know when a
 * visible row genuinely represents the end of the journey (vs. a
 * page-boundary preview of it) — see JourneyRows' line-segment rules. */
export function finalStopOf(stops: TrainStop[]): TrainStop | undefined {
  return stops[stops.length - 1];
}

// Stable content signature for a set of pages — used to reset pagination
// when the itinerary content changes (e.g. an admin edits a stop's time)
// even though the page *count* stays the same, which a plain
// `pages.length` dependency would miss.
export function pagesSignature(pages: TrainStop[][]): string {
  return pages.map((page) => page.map((stop) => `${stop.station}@${stop.time ?? ""}`).join(",")).join("|");
}
