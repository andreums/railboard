import { describe, it, expect } from "vitest";

// ── helpers duplicated from routes.js for unit testing ──

const normalizeStation = (value) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/estacio/g, "estacion")
    .replace(/valencia[-\s]*estacio(n)? del nord/g, "valencia nord")
    .replace(/valencia estacion del nord/g, "valencia nord")
    .replace(/barcelona[-\s]*sants/g, "barcelona sants")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const stationIndex = (stations, name) => {
  const target = normalizeStation(name);
  return stations.findIndex((station) => normalizeStation(station) === target);
};

const addMinutes = (hhmm, minutes) => {
  const [h, m] = hhmm.split(":").map(Number);
  const total = h * 60 + m + Number(minutes);
  const norm = ((total % (24 * 60)) + 24 * 60) % (24 * 60);
  const nh = String(Math.floor(norm / 60)).padStart(2, "0");
  const nm = String(norm % 60).padStart(2, "0");
  return `${nh}:${nm}`;
};

const minutesFromHHMM = (hhmm) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

function orderedIntermediateStops(stations, fromIndex, toIndex) {
  if (fromIndex === toIndex) return [];
  const step = fromIndex < toIndex ? 1 : -1;
  const stops = [];
  for (let i = fromIndex + step; i !== toIndex; i += step) {
    stops.push(stations[i]);
  }
  return stops;
}

const profileForType = (typeCode) => {
  if (/^(C(-\d+)?|R\d+[A-Z]?|R2N)$/i.test(typeCode)) {
    return { delayedProb: 0.16, cancelledProb: 0.03, advancedProb: 0.04, delayMin: 2, delayMax: 9 };
  }
  if (/^(MD)$/i.test(typeCode)) {
    return { delayedProb: 0.14, cancelledProb: 0.03, advancedProb: 0.03, delayMin: 4, delayMax: 16 };
  }
  if (/^(AVANT|AVE|IRYO|OUIGO|INOUI|EMD)$/i.test(typeCode)) {
    return { delayedProb: 0.09, cancelledProb: 0.02, advancedProb: 0.02, delayMin: 3, delayMax: 14 };
  }
  return { delayedProb: 0.12, cancelledProb: 0.03, advancedProb: 0.03, delayMin: 3, delayMax: 12 };
};

// ── Tests ──

describe("normalizeStation", () => {
  it("removes accents", () => {
    expect(normalizeStation("València")).toBe("valencia");
    expect(normalizeStation("Castelló")).toBe("castello");
    expect(normalizeStation("Xàtiva")).toBe("xativa");
  });

  it("converts estacio to estacion", () => {
    expect(normalizeStation("València Estació del Nord")).toBe("valencia nord");
  });

  it("handles BCN sants", () => {
    expect(normalizeStation("Barcelona-Sants")).toBe("barcelona sants");
  });

  it("lowercases and trims", () => {
    expect(normalizeStation("  MADRID PUERTA DE ATOCHA  ")).toBe("madrid puerta de atocha");
  });

  it("handles empty input", () => {
    expect(normalizeStation("")).toBe("");
    expect(normalizeStation(null)).toBe("");
    expect(normalizeStation(undefined)).toBe("");
  });
});

describe("stationIndex", () => {
  const stations = ["Madrid", "Barcelona", "València", "Sevilla"];

  it("finds station by normalized name", () => {
    expect(stationIndex(stations, "Valencia")).toBe(2);
  });

  it("returns -1 for unknown station", () => {
    expect(stationIndex(stations, "Paris")).toBe(-1);
  });
});

describe("addMinutes", () => {
  it("adds minutes within same hour", () => {
    expect(addMinutes("08:15", 5)).toBe("08:20");
  });

  it("wraps to next hour", () => {
    expect(addMinutes("08:45", 20)).toBe("09:05");
  });

  it("wraps to next day", () => {
    expect(addMinutes("23:50", 20)).toBe("00:10");
  });

  it("handles negative minutes", () => {
    expect(addMinutes("08:15", -10)).toBe("08:05");
  });

  it("wraps backward to previous day", () => {
    expect(addMinutes("00:10", -20)).toBe("23:50");
  });

  it("handles zero", () => {
    expect(addMinutes("12:00", 0)).toBe("12:00");
  });
});

describe("minutesFromHHMM", () => {
  it("converts HH:MM to minutes", () => {
    expect(minutesFromHHMM("08:15")).toBe(495);
    expect(minutesFromHHMM("00:00")).toBe(0);
    expect(minutesFromHHMM("23:59")).toBe(1439);
  });
});

describe("orderedIntermediateStops", () => {
  const stations = ["A", "B", "C", "D", "E"];

  it("returns stops between forward direction", () => {
    expect(orderedIntermediateStops(stations, 0, 3)).toEqual(["B", "C"]);
  });

  it("returns stops between reverse direction", () => {
    expect(orderedIntermediateStops(stations, 4, 1)).toEqual(["D", "C"]);
  });

  it("returns empty when adjacent", () => {
    expect(orderedIntermediateStops(stations, 0, 1)).toEqual([]);
  });

  it("returns empty when same index", () => {
    expect(orderedIntermediateStops(stations, 2, 2)).toEqual([]);
  });
});

describe("profileForType", () => {
  it("returns commuter profile for C routes", () => {
    const p = profileForType("C-1");
    expect(p.delayedProb).toBe(0.16);
    expect(p.cancelledProb).toBe(0.03);
    expect(p.delayMin).toBe(2);
    expect(p.delayMax).toBe(9);
  });

  it("returns regional profile for MD", () => {
    const p = profileForType("MD");
    expect(p.delayedProb).toBe(0.14);
    expect(p.delayMax).toBe(16);
  });

  it("returns high speed profile for AVE", () => {
    const p = profileForType("AVE");
    expect(p.delayedProb).toBe(0.09);
    expect(p.cancelledProb).toBe(0.02);
    expect(p.delayMin).toBe(3);
    expect(p.delayMax).toBe(14);
  });

  it("returns default profile for unknown type", () => {
    const p = profileForType("REGIONAL");
    expect(p.delayedProb).toBe(0.12);
    expect(p.delayMin).toBe(3);
    expect(p.delayMax).toBe(12);
  });

  it("matches R1, R2N commuter patterns", () => {
    expect(profileForType("R1").delayedProb).toBe(0.16);
    expect(profileForType("R2N").delayedProb).toBe(0.16);
    expect(profileForType("R16").delayedProb).toBe(0.16);
  });
});
