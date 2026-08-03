import crypto from "crypto";

const ADMIN_USER = process.env.ADMIN_USER || "admin";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

if (process.env.NODE_ENV === "production" && !ADMIN_PASSWORD) {
  throw new Error("ADMIN_PASSWORD es obligatorio en producción. Configúralo vía variable de entorno.");
}

// Password por defecto solo en desarrollo. En producción se exige arriba; si
// faltase en dev, se genera una aleatoria por arranque (se loguea una vez).
const resolvedPassword = ADMIN_PASSWORD || crypto.randomBytes(16).toString("hex");

if (!ADMIN_PASSWORD) {
  console.log(`[auth] ADMIN_PASSWORD no configurada: usando contraseña de desarrollo ${resolvedPassword}`);
}

// ---- Brute-force lockout (in-memory, por IP) ----
const MAX_FAILURES = 8;
const LOCKOUT_MS = 5 * 60 * 1000; // 5 min
const attempts = new Map(); // ip -> { failures, lockedUntil }

function clientKey(req) {
  return adminClientKey(req);
}

function isLocked(key) {
  const now = Date.now();
  const entry = attempts.get(key);
  if (!entry) return false;
  if (entry.lockedUntil && now < entry.lockedUntil) return true;
  if (entry.lockedUntil && now >= entry.lockedUntil) attempts.delete(key);
  return false;
}

function failure(key) {
  const now = Date.now();
  const entry = attempts.get(key) || { failures: 0, lockedUntil: 0 };
  if (entry.lockedUntil && now < entry.lockedUntil) return true;
  entry.failures += 1;
  if (entry.failures >= MAX_FAILURES) {
    entry.lockedUntil = now + LOCKOUT_MS;
    entry.failures = 0;
    attempts.set(key, entry);
    return true;
  }
  attempts.set(key, entry);
  return false;
}

function success(key) {
  attempts.delete(key);
}

function timingSafeEqualStr(a, b) {
  const ha = crypto.createHash("sha256").update(String(a)).digest();
  const hb = crypto.createHash("sha256").update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

// Verifies a Basic-auth style user:password pair against the configured admin.
// Used by HTTP middleware and the WebSocket handshake.
export function verifyCredentials(user, password) {
  const okUser = timingSafeEqualStr(user, ADMIN_USER);
  const okPass = timingSafeEqualStr(password || "", resolvedPassword);
  return okUser && okPass;
}

export function adminClientKey(req) {
  const forwarded = req.headers?.["x-forwarded-for"];
  const ip = (typeof forwarded === "string" ? forwarded.split(",")[0].trim() : req.ip || req?.socket?.remoteAddress) || "unknown";
  return `${ip}`;
}

function unauthorized(res) {
  res.set("WWW-Authenticate", 'Basic realm="Railboard Admin", charset="UTF-8"');
  return res.status(401).json({ error: "Autenticación requerida" });
}

function parseBasicAuth(req) {
  const header = req.headers["authorization"] || "";
  const parts = header.split(" ");
  if (parts[0] !== "Basic" || !parts[1]) return null;
  let decoded;
  try {
    decoded = Buffer.from(parts[1], "base64").toString("utf8");
  } catch {
    return null;
  }
  const idx = decoded.indexOf(":");
  if (idx < 0) return null;
  return { user: decoded.slice(0, idx), password: decoded.slice(idx + 1) };
}

export function adminAuth(req, res, next) {
  const key = clientKey(req);
  if (isLocked(key)) {
    return res.status(429).json({ error: "Demasiados intentos fallidos. Intenta más tarde." });
  }

  const creds = parseBasicAuth(req);
  if (!creds) {
    return unauthorized(res);
  }

  const okUser = timingSafeEqualStr(creds.user, ADMIN_USER);
  const okPass = timingSafeEqualStr(creds.password, resolvedPassword);
  if (okUser && okPass) {
    success(key);
    return next();
  }

  failure(key);
  return unauthorized(res);
}