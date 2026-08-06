import { describe, it, expect, beforeAll, afterAll } from "vitest";
import path from "path";
import fs from "fs";
import os from "os";

// Regression tests for the "random train stops are incomplete / out of order /
// belong to another line" bug. Root cause: generateRandomTrain and
// generateTrainFromRoute capped the intermediate stops to a random subset
// (Math.min(9, ...) + slice(0, randomInt(...))) instead of returning the full,
// continuous, correctly-ordered segment of the selected route. C-5 Cercanías
// València (18 stations) is used as the reproducible case because it's long
// enough (16 intermediate stops) to exceed the old artificial 9-stop cap.

let dbPath;
let dbModule;
let generatorModule;
let routeServiceModule;

const C5_VALENCIA_TO_CAUDIEL = [
  "València Estació del Nord",
  "València-Font de Sant Lluís",
  "València-Cabanyal",
  "Roca-Cúper",
  "Albuixech",
  "Massalfassar",
  "El Puig",
  "Puçol",
  "Sagunt",
  "Gilet",
  "Estivella-Albalat dels Tarongers",
  "Algimia-Ciudad",
  "Soneja",
  "Segorbe-Ciudad",
  "Segorbe-Arrabal",
  "Navajas",
  "Jérica-Viver",
  "Caudiel",
];

beforeAll(async () => {
  dbPath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "railboard-test-")), "test.db");
  process.env.DB_PATH = dbPath;
  dbModule = await import("../../db.js");
  generatorModule = await import("../trainGeneratorService.js");
  routeServiceModule = await import("../routeService.js");
});

afterAll(() => {
  delete process.env.DB_PATH;
  for (const suffix of ["", "-wal", "-shm"]) {
    try {
      fs.unlinkSync(dbPath + suffix);
    } catch {
      /* ignore */
    }
  }
});

function getC5Route() {
  const route = routeServiceModule
    .getAllRoutes()
    .find((r) => r.code === "C-5" && r.network === "Cercanías València");
  if (!route) throw new Error("C-5 route not found in railboard_routes.json");
  return route;
}

describe("railboard_routes.json — C-5 fixture", () => {
  it("has exactly 18 stations in the expected València → Caudiel order", () => {
    const route = getC5Route();
    expect(route.stations).toHaveLength(18);
    expect(route.stations).toEqual(C5_VALENCIA_TO_CAUDIEL);
  });
});

describe("orderedIntermediateStops (pure journey algorithm)", () => {
  it("the forward C-5 journey reconstructs all 18 stations in order", () => {
    const route = getC5Route();
    const stops = generatorModule.orderedIntermediateStops(route.stations, 0, 17);
    expect([route.stations[0], ...stops, route.stations[17]]).toEqual(C5_VALENCIA_TO_CAUDIEL);
  });

  it("the reverse C-5 journey reconstructs the same 18 stations in reverse order", () => {
    const route = getC5Route();
    const stops = generatorModule.orderedIntermediateStops(route.stations, 17, 0);
    expect([route.stations[17], ...stops, route.stations[0]]).toEqual(
      [...C5_VALENCIA_TO_CAUDIEL].reverse(),
    );
  });

  it("a partial service is a continuous segment that includes both ends (Sagunt → Segorbe-Ciudad)", () => {
    const route = getC5Route();
    const fromIndex = route.stations.indexOf("Sagunt");
    const toIndex = route.stations.indexOf("Segorbe-Ciudad");
    const stops = generatorModule.orderedIntermediateStops(route.stations, fromIndex, toIndex);
    const fullSegment = [route.stations[fromIndex], ...stops, route.stations[toIndex]];
    expect(fullSegment).toEqual(route.stations.slice(fromIndex, toIndex + 1));
  });

  it("does not mutate route.stations, forward or reverse", () => {
    const route = getC5Route();
    const before = [...route.stations];
    generatorModule.orderedIntermediateStops(route.stations, 0, 17);
    generatorModule.orderedIntermediateStops(route.stations, 17, 0);
    generatorModule.orderedIntermediateStops(route.stations, 5, 12);
    expect(route.stations).toEqual(before);
  });

  it("every returned stop belongs to the source route", () => {
    const route = getC5Route();
    const stops = generatorModule.orderedIntermediateStops(route.stations, 0, 17);
    for (const stop of stops) {
      expect(route.stations).toContain(stop);
    }
  });
});

describe("getAllRoutes consistency", () => {
  it("repeated calls (as happens once per generated train) don't reorder C-5's stations", () => {
    const first = routeServiceModule.getAllRoutes().find((r) => r.code === "C-5").stations;
    const second = routeServiceModule.getAllRoutes().find((r) => r.code === "C-5").stations;
    const third = routeServiceModule.getAllRoutes().find((r) => r.code === "C-5").stations;
    expect(second).toEqual(first);
    expect(third).toEqual(first);
  });
});

describe("generateTrainFromRoute — C-5 integration", () => {
  it("forward journey (origin at València) keeps all 16 intermediate stops, unTruncated and in order", () => {
    dbModule.setConfig({ station_name: "València Estació del Nord", mode: "departures" });
    const train = generatorModule.generateTrainFromRoute("C-5", {});
    expect(train.origin).toBe("València Estació del Nord");
    expect(train.destination).toBe("Caudiel");
    const stopNames = train.stops.map((s) => s.station);
    expect(stopNames).toHaveLength(16);
    expect([train.origin, ...stopNames, train.destination]).toEqual(C5_VALENCIA_TO_CAUDIEL);
  });

  it("reverse journey (origin at Caudiel) keeps all 16 intermediate stops in reverse order", () => {
    dbModule.setConfig({ station_name: "Caudiel", mode: "departures" });
    const train = generatorModule.generateTrainFromRoute("C-5", {});
    expect(train.origin).toBe("Caudiel");
    expect(train.destination).toBe("València Estació del Nord");
    const stopNames = train.stops.map((s) => s.station);
    expect(stopNames).toHaveLength(16);
    expect([train.origin, ...stopNames, train.destination]).toEqual(
      [...C5_VALENCIA_TO_CAUDIEL].reverse(),
    );
  });

  it("every stop belongs to the C-5 route (never another line)", () => {
    dbModule.setConfig({ station_name: "València Estació del Nord" });
    const train = generatorModule.generateTrainFromRoute("C-5", {});
    const route = getC5Route();
    for (const stop of train.stops) {
      expect(route.stations).toContain(stop.station);
    }
  });

  it("keeps the same stops after being persisted and reloaded from the database", () => {
    dbModule.setConfig({ station_name: "València Estació del Nord" });
    const created = generatorModule.generateTrainFromRoute("C-5", {});
    const reloaded = dbModule.getTrain(created.id);
    expect(reloaded.stops.map((s) => s.station)).toEqual(created.stops.map((s) => s.station));
    expect(reloaded.origin).toBe(created.origin);
    expect(reloaded.destination).toBe(created.destination);
  });

  it("generating several trains consecutively never alters the route's station order", () => {
    dbModule.setConfig({ station_name: "València Estació del Nord" });
    generatorModule.generateTrainFromRoute("C-5", {});
    generatorModule.generateTrainFromRoute("C-5", {});
    generatorModule.generateTrainFromRoute("C-5", {});
    expect(getC5Route().stations).toEqual(C5_VALENCIA_TO_CAUDIEL);
  });
});

describe("generateRandomTrain — C-5 forced via a station unique to that line", () => {
  it("a display at 'Caudiel' (only served by C-5) always generates complete, correctly-ordered C-5 stops", () => {
    const { lastInsertRowid: stationId } = dbModule.stations.create({ name: "Caudiel", short: "Caudiel", color: "#000000" });
    for (let i = 0; i < 5; i++) {
      const train = generatorModule.generateRandomTrain({ station_id: stationId });
      const route = getC5Route();
      const stopNames = train.stops.map((s) => s.station);
      // Whichever direction was picked, the full reconstructed journey must be
      // exactly the C-5 station list, forward or reverse — never truncated,
      // never stations from another line.
      const fullJourney = [train.origin, ...stopNames, train.destination];
      const forward = fullJourney.length === route.stations.length && fullJourney.every((s, idx) => s === route.stations[idx]);
      const reverse =
        fullJourney.length === route.stations.length &&
        fullJourney.every((s, idx) => s === route.stations[route.stations.length - 1 - idx]);
      expect(forward || reverse).toBe(true);
      expect(fullJourney).toHaveLength(18);
    }
  });
});
