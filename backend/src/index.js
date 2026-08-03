import crypto from "crypto";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import http from "http";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import routes from "./routes.js";
import railRoutesApi from "./railRoutesApi.js";
import { attachWebSocket } from "./ws.js";
import { db } from "./db.js";
import { logRouteStats } from "./services/routeService.js";
import logger, { requestLogger } from "./logger.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

// Behind nginx reverse proxy: trust X-Forwarded-* for accurate client IPs
// (used by auth brute-force lockout and rate limiting). Only enable when the
// proxy is trusted; keep false if exposed directly.
app.set("trust proxy", process.env.TRUST_PROXY === "1" ? 1 : false);

app.set("etag", false);

app.use((req, _res, next) => {
  req.id = crypto.randomUUID();
  next();
});
app.use(requestLogger);
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));

app.use(
  cors({
    origin: (origin, callback) => {
      const corsOrigin = process.env.CORS_ORIGIN || "http://localhost:5173";
      // Allow exact match or any localhost port in development
      if (!origin || origin === corsOrigin || (process.env.NODE_ENV !== "production" && origin?.startsWith("http://localhost:"))) {
        callback(null, true);
      } else {
        callback(new Error("CORS not allowed"));
      }
    },
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    credentials: true,
  }),
);

const rateLimitWindowMs = 60 * 1000;
const rateLimitMax = process.env.RATE_LIMIT_MAX ? Number(process.env.RATE_LIMIT_MAX) : process.env.NODE_ENV === "production" ? 120 : 1000;
const generalLimiter = rateLimit({
  windowMs: rateLimitWindowMs,
  // Allow a higher limit during development to avoid hitting the limiter
  max: rateLimitMax,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Demasiadas peticiones. Intenta de nuevo en un minuto." },
});
app.use("/admin", generalLimiter);

// Public API rate limit (defends /api/stations/search and /api/stations/:id/board
// from abuse/DoS). Public read endpoints get a generous but bounded limit.
const publicLimiter = rateLimit({
  windowMs: rateLimitWindowMs,
  max: process.env.PUBLIC_RATE_LIMIT_MAX ? Number(process.env.PUBLIC_RATE_LIMIT_MAX) : 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Demasiadas peticiones. Intenta de nuevo en un minuto." },
});
app.use("/api", publicLimiter);

const writeLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Demasiadas peticiones de escritura. Intenta de nuevo en un minuto." },
});

app.use(express.json({ limit: "1mb" }));
// Serve uploaded files but force SVG (and HTML-like types) to download instead
// of rendering inline in the browser, mitigating stored-XSS via injected
// <script> inside uploaded SVGs. PNG/JPEG/etc. are served normally.
app.use("/uploads", (req, res, next) => {
  const ext = path.extname(req.path || "").toLowerCase();
  if (ext === ".svg" || ext === ".html" || ext === ".htm" || ext === ".xhtml") {
    res.setHeader("Content-Disposition", "attachment");
    res.setHeader("X-Content-Type-Options", "nosniff");
  }
  next();
});
app.use("/uploads", express.static(path.resolve(__dirname, "../uploads")));
app.use(express.static(path.resolve(__dirname, "../public")));
app.use("/admin", (req, res, next) => {
  if (["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) {
    return writeLimiter(req, res, next);
  }
  next();
});
app.use("/admin", routes);
app.use("/api", railRoutesApi);

app.get("/health", (_req, res) => {
  const checks = {
    db: false,
    uploads: false,
  };
  const detail = {};

  try {
    db.prepare("SELECT 1 AS ok").get();
    checks.db = true;
    detail.db = { status: "ok" };
  } catch (err) {
    detail.db = { status: "error", message: err.message };
  }

  const uploadsPath = path.resolve(__dirname, "../uploads");
  try {
    const files = fs.readdirSync(uploadsPath);
    checks.uploads = true;
    detail.uploads = { status: "ok", fileCount: files.length };
  } catch (err) {
    detail.uploads = { status: "error", message: err.message };
  }

  const isProd = process.env.NODE_ENV === "production";
  const ok = Object.values(checks).every(Boolean);
  const status = ok ? 200 : 503;

  if (isProd) {
    // In production, avoid leaking node version, env names and file counts.
    return res.status(status).json({ ok, checks });
  }

  const mem = process.memoryUsage();
  detail.memory = {
    rss: Math.round(mem.rss / 1024 / 1024) + "MB",
    heapUsed: Math.round(mem.heapUsed / 1024 / 1024) + "MB",
    heapTotal: Math.round(mem.heapTotal / 1024 / 1024) + "MB",
  };

  detail.uptime = Math.floor(process.uptime()) + "s";
  detail.node = process.version;
  detail.env = process.env.NODE_ENV || "development";

  res.status(status).json({ ok, checks, detail });
});

app.use((err, req, res, _next) => {
  (req.log || logger).error({ err }, "Error:");
  if (err.name === "MulterError" || err.code === "FILE_TYPE_NOT_ALLOWED") {
    return res.status(400).json({ error: err.message });
  }
  res.status(500).json({ error: "Error interno del servidor" });
});

const PORT = process.env.PORT || 4000;
const server = http.createServer(app);
attachWebSocket(server, db);

server.listen(PORT, () => {
  logRouteStats();
  logger.info(`RailBoard backend on http://localhost:${PORT}`);
  logger.info(`WebSocket on ws://localhost:${PORT}/ws`);
  logger.info(`rateLimit max=${rateLimitMax} windowMs=${rateLimitWindowMs}`);
});
