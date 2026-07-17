import crypto from "crypto";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import http from "http";
import path from "path";
import { fileURLToPath } from "url";
import routes from "./routes.js";
import railRoutesApi from "./railRoutesApi.js";
import { attachWebSocket } from "./ws.js";
import { db } from "./db.js";
import { runMigrations } from "./migrations.js";
import { logRouteStats } from "./services/routeService.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

app.set("etag", false);

app.use((req, _res, next) => {
  req.id = crypto.randomUUID();
  next();
});
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));

app.use(cors({
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
}));

const rateLimitWindowMs = 60 * 1000;
const rateLimitMax = process.env.RATE_LIMIT_MAX ? Number(process.env.RATE_LIMIT_MAX) : (process.env.NODE_ENV === "production" ? 120 : 1000);
const generalLimiter = rateLimit({
  windowMs: rateLimitWindowMs,
  // Allow a higher limit during development to avoid hitting the limiter
  max: rateLimitMax,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Demasiadas peticiones. Intenta de nuevo en un minuto." },
});
app.use("/admin", generalLimiter);

const writeLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Demasiadas peticiones de escritura. Intenta de nuevo en un minuto." },
});

app.use(express.json({ limit: "1mb" }));
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

app.get("/health", (_req, res) => res.json({ ok: true }));

app.use((err, _req, res, _next) => {
  console.error("Error:", err.message);
  if (err.name === "MulterError" || err.code === "FILE_TYPE_NOT_ALLOWED") {
    return res.status(400).json({ error: err.message });
  }
  res.status(500).json({ error: "Error interno del servidor" });
});

const PORT = process.env.PORT || 4000;
const server = http.createServer(app);
attachWebSocket(server);

// Run database migrations before starting the server
runMigrations(db);

server.listen(PORT, () => {
  logRouteStats();
  console.log(`RailBoard backend on http://localhost:${PORT}`);
  console.log(`WebSocket on ws://localhost:${PORT}/ws`);
  console.log(`rateLimit max=${rateLimitMax} windowMs=${rateLimitWindowMs}`);
});
