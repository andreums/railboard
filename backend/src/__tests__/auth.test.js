import { describe, it, expect, beforeAll, afterAll } from "vitest";
import path from "path";
import fs from "fs";
import os from "os";

const TEST_PASSWORD = "strong-test-pass-456";
const encode = (u, p) => Buffer.from(`${u}:${p}`).toString("base64");

let request;

beforeAll(async () => {
  const dbPath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "railboard-auth-test-")), "test.db");
  process.env.DB_PATH = dbPath;
  process.env.ADMIN_PASSWORD = TEST_PASSWORD;
  process.env.NODE_ENV = "test";

  const express = (await import("express")).default;
  const routes = (await import("../routes.js")).default;
  const app = express();
  app.use(express.json());
  app.use("/admin", routes);
  request = (await import("supertest")).default(app);
});

afterAll(() => {
  delete process.env.DB_PATH;
  delete process.env.ADMIN_PASSWORD;
  process.env.NODE_ENV = "test";
});

describe("Admin auth", () => {
  it("rejects requests without credentials (401)", async () => {
    const res = await request.get("/admin/auth/me");
    expect(res.status).toBe(401);
  });

  it("rejects wrong password (401)", async () => {
    const res = await request.get("/admin/auth/me").set("Authorization", `Basic ${encode("admin", "wrong")}`);
    expect(res.status).toBe(401);
  });

  it("accepts valid credentials (200)", async () => {
    const res = await request.get("/admin/auth/me").set("Authorization", `Basic ${encode("admin", TEST_PASSWORD)}`);
    expect(res.status).toBe(200);
  });

  it("returns 429 after repeated wrong attempts (brute-force lockout)", async () => {
    let last;
    for (let i = 0; i < 10; i++) {
      last = await request
        .get("/admin/auth/me")
        .set("Authorization", `Basic ${encode("admin", `wrong-${i}`)}`);
    }
    // After MAX_FAILURES (8) consecutive failures, the IP gets locked.
    expect(last.status).toBe(429);
  });
});