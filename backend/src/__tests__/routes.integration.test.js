import { describe, it, expect, beforeAll, afterAll } from "vitest";
import path from "path";
import fs from "fs";
import os from "os";

let appModule, dbModule;
const AUTH = { user: "admin", pass: "railboard" };
const encode = (u, p) => Buffer.from(`${u}:${p}`).toString("base64");
const authHeader = `Basic ${encode(AUTH.user, AUTH.pass)}`;

beforeAll(async () => {
  const dbPath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "railboard-test-")), "test.db");
  process.env.DB_PATH = dbPath;

  dbModule = await import("../db.js");

  // Create some seed data
  dbModule.operators.create({ name: "Renfe" });
  dbModule.trainTypes.create({ code: "AVE", name: "Alta Velocidad", color: "#7c1d2e" });
  dbModule.places.create({ name: "Madrid" });
  dbModule.places.create({ name: "Barcelona" });

  // Need to import after DB is set up since express app references it
  // We can't re-import express easily, so let's test via supertest directly
});

afterAll(() => {
  delete process.env.DB_PATH;
});

describe("Express app", () => {
  let app;
  let request;

  beforeAll(async () => {
    const express = (await import("express")).default;
    const cors = (await import("cors")).default;
    const helmet = (await import("helmet")).default;
    const rateLimit = (await import("express-rate-limit")).default;
    const routes = (await import("../routes.js")).default;

    app = express();
    app.use(helmet());
    app.use(cors({ origin: "http://test.local", methods: ["GET", "POST", "PUT", "PATCH", "DELETE"] }));

    const limiter = rateLimit({ windowMs: 60 * 1000, max: 1000 });
    app.use("/api", limiter);
    app.use(express.json({ limit: "1mb" }));
    app.use("/api", routes);
    app.get("/health", (_req, res) => res.json({ ok: true }));
    app.use((err, _req, res, _next) => {
      res.status(err.status || 500).json({ error: err.message || "Error interno" });
    });

    request = (await import("supertest")).default(app);
  });

  it("GET /health returns ok", async () => {
    const res = await request.get("/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });

  it("has helmet security headers", async () => {
    const res = await request.get("/health");
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["x-frame-options"]).toBe("SAMEORIGIN");
    expect(res.headers["strict-transport-security"]).toBeDefined();
    expect(res.headers["content-security-policy"]).toBeDefined();
  });

  it("has CORS headers", async () => {
    const res = await request.get("/api/trains");
    expect(res.headers["access-control-allow-origin"]).toBe("http://test.local");
  });

  // ── Public read endpoints ──

  it("GET /api/trains returns array", async () => {
    const res = await request.get("/api/trains");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it("GET /api/config returns config", async () => {
    const res = await request.get("/api/config");
    expect(res.status).toBe(200);
    expect(res.body.station_name).toBeDefined();
  });

  it("GET /api/operators returns array", async () => {
    const res = await request.get("/api/operators");
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThanOrEqual(1);
  });

  it("GET /api/train-types returns array", async () => {
    const res = await request.get("/api/train-types");
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThanOrEqual(1);
  });

  it("GET /api/places returns array", async () => {
    const res = await request.get("/api/places");
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThanOrEqual(2);
  });

  // ── Auth protection ──

  it("POST /api/trains without auth returns 401", async () => {
    const res = await request.post("/api/trains").send({ number: "123" });
    expect(res.status).toBe(401);
  });

  it("PUT /api/config without auth returns 401", async () => {
    const res = await request.put("/api/config").send({ station_name: "X" });
    expect(res.status).toBe(401);
  });

  it("DELETE /api/trains without auth returns 401", async () => {
    const res = await request.delete("/api/trains");
    expect(res.status).toBe(401);
  });

  it("POST /seed-trains without auth returns 401", async () => {
    const res = await request.post("/api/seed-trains");
    expect(res.status).toBe(401);
  });

  // ── Authenticated write endpoints ──

  it("POST /api/trains with auth creates train", async () => {
    const res = await request
      .post("/api/trains")
      .set("Authorization", authHeader)
      .send({
        number: "99999",
        origin: "Madrid",
        destination: "Barcelona",
        scheduled_time: "12:00",
        expected_time: "12:00",
      });
    expect(res.status).toBe(201);
    expect(res.body.number).toBe("99999");
    expect(res.body.id).toBeGreaterThan(0);
  });

  it("PUT /api/trains/:id with auth updates train", async () => {
    const list = (await request.get("/api/trains")).body;
    const train = list.find((t) => t.number === "99999");
    expect(train).toBeDefined();

    const res = await request
      .put(`/api/trains/${train.id}`)
      .set("Authorization", authHeader)
      .send({ status: "Delayed", platform: "5" });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("Delayed");
    expect(res.body.platform).toBe("5");
  });

  it("PATCH /api/trains/:id/status with auth", async () => {
    const list = (await request.get("/api/trains")).body;
    const train = list[list.length - 1];

    const res = await request
      .patch(`/api/trains/${train.id}/status`)
      .set("Authorization", authHeader)
      .send({ status: "Cancelled" });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("Cancelled");
  });

  it("PATCH /api/trains/:id/delay with auth", async () => {
    const list = (await request.get("/api/trains")).body;
    const train = list[list.length - 1];
    const origExpected = train.expected_time;

    const res = await request
      .patch(`/api/trains/${train.id}/delay`)
      .set("Authorization", authHeader)
      .send({ minutes: 10 });
    expect(res.status).toBe(200);
    expect(res.body.expected_time).not.toBe(origExpected);
  });

  it("DELETE /api/trains with auth and X-Confirm clears all", async () => {
    const res = await request
      .delete("/api/trains")
      .set("Authorization", authHeader)
      .set("X-Confirm", "yes");
    expect(res.status).toBe(204);

    const list = await request.get("/api/trains");
    expect(list.body).toHaveLength(0);
  });

  it("DELETE /api/trains with auth but without X-Confirm returns 400", async () => {
    const res = await request
      .delete("/api/trains")
      .set("Authorization", authHeader);
    expect(res.status).toBe(400);
    expect(res.body.error).toContain("X-Confirm");
  });

  // ── Config ──

  it("PUT /api/config with auth updates config", async () => {
    const res = await request
      .put("/api/config")
      .set("Authorization", authHeader)
      .send({ station_name: "TEST STATION", mode: "arrivals" });
    expect(res.status).toBe(200);
    expect(res.body.station_name).toBe("TEST STATION");
    expect(res.body.mode).toBe("arrivals");
  });
});
