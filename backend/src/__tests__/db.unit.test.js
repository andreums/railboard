import { describe, it, expect, beforeAll, afterAll } from "vitest";
import path from "path";
import fs from "fs";
import os from "os";

let dbPath;
let dbModule;

beforeAll(async () => {
  dbPath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "railboard-test-")), "test.db");
  process.env.DB_PATH = dbPath;
  dbModule = await import("../db.js");
});

afterAll(() => {
  delete process.env.DB_PATH;
  try {
    fs.unlinkSync(dbPath);
  } catch {
    /* ignore */
  }
  try {
    fs.unlinkSync(dbPath + "-wal");
  } catch {
    /* ignore */
  }
  try {
    fs.unlinkSync(dbPath + "-shm");
  } catch {
    /* ignore */
  }
});

describe("Config", () => {
  it("has defaults", () => {
    const cfg = dbModule.getConfig();
    expect(cfg.station_name).toBe("MADRID PUERTA DE ATOCHA");
    expect(cfg.mode).toBe("departures");
  });

  it("sets and gets config", () => {
    dbModule.setConfig({ station_name: "TEST STATION", mode: "arrivals" });
    const cfg = dbModule.getConfig();
    expect(cfg.station_name).toBe("TEST STATION");
    expect(cfg.mode).toBe("arrivals");
  });

  it("merges config without removing existing keys", () => {
    dbModule.setConfig({ language: "en" });
    const cfg = dbModule.getConfig();
    expect(cfg.language).toBe("en");
    expect(cfg.station_name).toBe("TEST STATION");
  });
});

describe("Operators CRUD", () => {
  it("starts empty", () => {
    expect(dbModule.operators.list()).toHaveLength(0);
  });

  it("creates an operator", () => {
    dbModule.operators.create({ name: "Renfe" });
    const list = dbModule.operators.list();
    expect(list).toHaveLength(1);
    expect(list[0].name).toBe("Renfe");
  });

  it("updates an operator", () => {
    const op = dbModule.operators.list()[0];
    dbModule.operators.update(op.id, { name: "RENFE Updated", logo_url: "/logo.png" });
    const updated = dbModule.operators.list()[0];
    expect(updated.name).toBe("RENFE Updated");
    expect(updated.logo_url).toBe("/logo.png");
  });

  it("deletes an operator", () => {
    dbModule.operators.create({ name: "Iryo" });
    const iryo = dbModule.operators.list().find((o) => o.name === "Iryo");
    dbModule.operators.remove(iryo.id);
    const names = dbModule.operators.list().map((o) => o.name);
    expect(names).not.toContain("Iryo");
  });
});

describe("Train Types CRUD", () => {
  it("creates a train type", () => {
    dbModule.trainTypes.create({ code: "AVE", name: "Alta Velocidad", color: "#7c1d2e" });
    const list = dbModule.trainTypes.list();
    expect(list).toHaveLength(1);
    expect(list[0].code).toBe("AVE");
  });

  it("prevents duplicate code", () => {
    expect(() => dbModule.trainTypes.create({ code: "AVE", name: "AVE Dupe" })).toThrow();
  });
});

describe("Places CRUD", () => {
  it("creates a place", () => {
    dbModule.places.create({ name: "Madrid Puerta de Atocha" });
    const list = dbModule.places.list();
    expect(list).toHaveLength(1);
    expect(list[0].name).toBe("Madrid Puerta de Atocha");
  });
});

describe("Trains CRUD", () => {
  const trainData = () => ({
    number: "03104",
    operator_id: null,
    train_type_id: null,
    origin: "Madrid",
    destination: "Barcelona",
    stops: [],
    scheduled_time: "08:15",
    expected_time: "08:15",
    platform: "1",
    sector: "A",
    status: "Scheduled",
    observations: "",
  });

  it("creates a train", () => {
    const t = dbModule.createTrain(trainData());
    expect(t.number).toBe("03104");
    expect(t.origin).toBe("Madrid");
    expect(t.id).toBeGreaterThan(0);
    expect(Array.isArray(t.stops)).toBe(true);
  });

  it("lists trains", () => {
    const list = dbModule.listTrains();
    expect(list.length).toBeGreaterThanOrEqual(1);
    expect(list[0]).toHaveProperty("number");
  });

  it("gets train by id", () => {
    const all = dbModule.listTrains();
    const t = dbModule.getTrain(all[0].id);
    expect(t.id).toBe(all[0].id);
    expect(t.origin).toBe("Madrid");
  });

  it("returns null for non-existent train", () => {
    expect(dbModule.getTrain(99999)).toBeNull();
  });

  it("updates a train", () => {
    const all = dbModule.listTrains();
    const t = dbModule.updateTrain(all[0].id, { status: "Delayed", platform: "2" });
    expect(t.status).toBe("Delayed");
    expect(t.platform).toBe("2");
  });

  it("adds delay via expected_time change", () => {
    const t = dbModule.createTrain({ ...trainData(), number: "99901" });
    const updated = dbModule.updateTrain(t.id, {
      expected_time: "08:25",
      status: "Delayed",
    });
    expect(updated.expected_time).toBe("08:25");
    expect(updated.status).toBe("Delayed");
  });

  it("deletes a train", () => {
    const all = dbModule.listTrains();
    const before = all.length;
    dbModule.deleteTrain(all[0].id);
    expect(dbModule.listTrains()).toHaveLength(before - 1);
  });
});

describe("addMinutes helper", () => {
  it("adds minutes correctly", () => {
    expect(dbModule.addMinutes("08:15", 5)).toBe("08:20");
    expect(dbModule.addMinutes("23:50", 20)).toBe("00:10");
  });
});
