import { describe, it, expect, beforeAll, afterAll } from "vitest";
import path from "path";
import fs from "fs";
import os from "os";

const AUTH = { user: "admin", pass: "railboard" };
const encode = (u, p) => Buffer.from(`${u}:${p}`).toString("base64");
const authHeader = `Basic ${encode(AUTH.user, AUTH.pass)}`;

let request;

beforeAll(async () => {
  const dbPath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "railboard-test-")), "test.db");
  process.env.DB_PATH = dbPath;

  const express = (await import("express")).default;
  const cors = (await import("cors")).default;
  const helmet = (await import("helmet")).default;
  const routes = (await import("../routes.js")).default;

  const app = express();
  app.use(helmet());
  app.use(cors({ origin: "*" }));
  app.use(express.json({ limit: "1mb" }));
  app.use("/api", routes);

  request = (await import("supertest")).default(app);
});

afterAll(() => {
  delete process.env.DB_PATH;
});

describe("E2E: Full API workflow", () => {
  let operatorId, typeId, trainId;

  it("1. creates an operator", async () => {
    const res = await request.post("/api/operators").set("Authorization", authHeader).field("name", "Renfe");
    expect(res.status).toBe(201);
    const ops = res.body;
    const renfe = ops.find((o) => o.name === "Renfe");
    expect(renfe).toBeDefined();
    operatorId = renfe.id;
  });

  it("2. creates a train type", async () => {
    const res = await request
      .post("/api/train-types")
      .set("Authorization", authHeader)
      .field("code", "AVE")
      .field("name", "Alta Velocidad")
      .field("color", "#7c1d2e");
    expect(res.status).toBe(201);
    const types = res.body;
    const ave = types.find((t) => t.code === "AVE");
    expect(ave).toBeDefined();
    typeId = ave.id;
  });

  it("3. creates places", async () => {
    const res1 = await request.post("/api/places").set("Authorization", authHeader).field("name", "Madrid Puerta de Atocha");
    expect(res1.status).toBe(201);

    const res2 = await request.post("/api/places").set("Authorization", authHeader).field("name", "Barcelona Sants");
    expect(res2.status).toBe(201);
  });

  it("4. creates a train", async () => {
    const res = await request
      .post("/api/trains")
      .set("Authorization", authHeader)
      .send({
        number: "03104",
        operator_id: operatorId,
        train_type_id: typeId,
        origin: "Madrid Puerta de Atocha",
        destination: "Barcelona Sants",
        stops: ["Zaragoza Delicias", "Tarragona Camp"],
        scheduled_time: "08:15",
        expected_time: "08:15",
        platform: "5",
        sector: "B",
        status: "Scheduled",
      });
    expect(res.status).toBe(201);
    expect(res.body.number).toBe("03104");
    trainId = res.body.id;
  });

  it("5. lists trains and sees the created train with joined fields", async () => {
    const res = await request.get("/api/trains");
    expect(res.status).toBe(200);
    const train = res.body.find((t) => t.id === trainId);
    expect(train).toBeDefined();
    expect(train.origin).toBe("Madrid Puerta de Atocha");
    expect(train.destination).toBe("Barcelona Sants");
    expect(train.operator_name).toBe("Renfe");
    expect(train.type_code).toBe("AVE");
  });

  it("6. updates train status", async () => {
    const res = await request.patch(`/api/trains/${trainId}/status`).set("Authorization", authHeader).send({ status: "Boarding" });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("Boarding");
  });

  it("7. adds delay to train", async () => {
    const res = await request.patch(`/api/trains/${trainId}/delay`).set("Authorization", authHeader).send({ minutes: 10 });
    expect(res.status).toBe(200);
    expect(res.body.expected_time).toBe("08:25");
    expect(res.body.status).toBe("Delayed");
  });

  it("8. updates train platform", async () => {
    const res = await request
      .patch(`/api/trains/${trainId}/platform`)
      .set("Authorization", authHeader)
      .send({ platform: "7", sector: "C" });
    expect(res.status).toBe(200);
    expect(res.body.platform).toBe("7");
    expect(res.body.sector).toBe("C");
  });

  it("9. reorders trains", async () => {
    // Create a second train
    const t2 = await request.post("/api/trains").set("Authorization", authHeader).send({
      number: "99999",
      origin: "Madrid",
      destination: "Valencia",
      scheduled_time: "10:00",
      expected_time: "10:00",
    });
    expect(t2.status).toBe(201);

    // Reorder
    const res = await request
      .put("/api/trains/reorder")
      .set("Authorization", authHeader)
      .send({ ids: [t2.body.id, trainId] });
    expect(res.status).toBe(200);
    expect(res.body[0].id).toBe(t2.body.id);
    expect(res.body[1].id).toBe(trainId);
  });

  it("10. generates a random train", async () => {
    // First seed some data so the generator has operators/types/places
    const res = await request.post("/api/generate-random-train").set("Authorization", authHeader);
    expect(res.status).toBe(201);
    expect(res.body.number).toBeDefined();
    expect(res.body.origin).toBeDefined();
    expect(res.body.destination).toBeDefined();
  });

  it("11. deletes the train", async () => {
    const res = await request.delete(`/api/trains/${trainId}`).set("Authorization", authHeader);
    expect(res.status).toBe(204);

    const list = await request.get("/api/trains");
    expect(list.body.find((t) => t.id === trainId)).toBeUndefined();
  });

  it("12. seeds demo trains", async () => {
    // First clear
    await request.delete("/api/trains").set("Authorization", authHeader).set("X-Confirm", "yes");

    const res = await request.post("/api/seed-trains").set("Authorization", authHeader);
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(9);
  });
});
