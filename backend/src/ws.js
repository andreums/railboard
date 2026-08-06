import { WebSocketServer } from "ws";
import logger from "./logger.js";
import { verifyCredentials } from "./middleware/auth.js";

let wss = null;
let db = null;

// Per-client subscriptions
// ws.__subscriptions = { displayIds: Set<string>, stationIds: Set<number> }
// ws.__deviceInfo = { deviceId, deviceType, displayId, lastHeartbeat }
// ws.__authenticated = boolean (set when the client proves admin credentials)

const HEARTBEAT_TIMEOUT_MS = 60000; // 60s without heartbeat = offline
const MAX_MESSAGES_PER_WINDOW = 120; // per 30s, per connection
const RATE_WINDOW_MS = 30000;

export function attachWebSocket(server, database) {
  db = database;
  wss = new WebSocketServer({ server, path: "/ws" });

  wss.on("connection", (ws, req) => {
    ws.__subscriptions = { displayIds: new Set(), stationIds: new Set() };
    ws.__deviceInfo = { deviceId: null, deviceType: null, displayId: null, lastHeartbeat: Date.now() };
    ws.__ip = req?.socket?.remoteAddress || "unknown";
    ws.__authenticated = false;
    ws.__msgWindowStart = Date.now();
    ws.__msgCount = 0;

    // Auth via query token: ?user=admin&token=<base64 user:password> or ?auth=<base64 user:password>
    ws.__authenticated = authenticateHandshake(req);

    ws.send(JSON.stringify({ type: "hello", authenticated: ws.__authenticated }));

    ws.on("message", (raw) => {
      // Per-connection message rate limit
      if (!allowMessage(ws)) {
        return ws.send(JSON.stringify({ type: "error", error: "Demasiados mensajes. Conexión limitada." }));
      }
      try {
        const msg = JSON.parse(raw.toString());
        handleMessage(ws, msg);
      } catch {
        /* invalid JSON */
      }
    });

    ws.on("close", () => {
      const info = ws.__deviceInfo;
      if (info?.deviceId) {
        updateDeviceStatus(info.deviceId, "OFFLINE");
        broadcast({ type: "device_disconnected", data: { deviceId: info.deviceId } });
      }
    });

    ws.on("error", () => {
      /* noop */
    });
  });

  // Periodic heartbeat check
  setInterval(() => {
    const now = Date.now();
    for (const client of wss.clients) {
      if (client.readyState !== 1) continue;
      const info = client.__deviceInfo;
      if (info?.deviceId && (now - (info.lastHeartbeat || 0)) > HEARTBEAT_TIMEOUT_MS) {
        updateDeviceStatus(info.deviceId, "OFFLINE");
        broadcast({ type: "device_disconnected", data: { deviceId: info.deviceId } });
      }
    }
  }, 30000);
}

function allowMessage(ws) {
  const now = Date.now();
  if (now - ws.__msgWindowStart > RATE_WINDOW_MS) {
    ws.__msgWindowStart = now;
    ws.__msgCount = 0;
  }
  ws.__msgCount += 1;
  return ws.__msgCount <= MAX_MESSAGES_PER_WINDOW;
}

function authenticateHandshake(req) {
  const url = req?.url || "";
  let query;
  try {
    query = new URL(url, "http://localhost").searchParams;
  } catch {
    return false;
  }
  const auth = query.get("auth");
  if (auth) {
    const decoded = Buffer.from(String(auth), "base64").toString("utf8");
    const idx = decoded.indexOf(":");
    if (idx < 0) return false;
    const user = decoded.slice(0, idx);
    const password = decoded.slice(idx + 1);
    return verifyCredentials(user, password);
  }
  const user = query.get("user");
  const token = query.get("token");
  if (user && token) {
    const decoded = Buffer.from(String(token), "base64").toString("utf8");
    const idx = decoded.indexOf(":");
    if (idx < 0) return false;
    const tokUser = decoded.slice(0, idx);
    const password = decoded.slice(idx + 1);
    return user === tokUser && verifyCredentials(user, password);
  }
  return false;
}

function handleMessage(ws, msg) {
  switch (msg.type) {
    case "subscribe":
      if (msg.displayId) ws.__subscriptions.displayIds.add(msg.displayId);
      if (msg.stationId) ws.__subscriptions.stationIds.add(Number(msg.stationId));
      ws.send(JSON.stringify({ type: "subscribed", displayId: msg.displayId, stationId: msg.stationId }));
      break;

    case "unsubscribe":
      if (msg.displayId) ws.__subscriptions.displayIds.delete(msg.displayId);
      if (msg.stationId) ws.__subscriptions.stationIds.delete(Number(msg.stationId));
      break;

    case "heartbeat":
      // Privileged: registering/updating a device requires an authenticated connection.
      if (!ws.__authenticated) {
        ws.send(JSON.stringify({ type: "error", error: "No autorizado" }));
        return;
      }
      ws.__deviceInfo.lastHeartbeat = Date.now();
      if (msg.deviceId) {
        ws.__deviceInfo.deviceId = msg.deviceId;
        ws.__deviceInfo.deviceType = msg.deviceType || "DISPLAY";
        ws.__deviceInfo.displayId = msg.displayId || null;
        upsertDevice(msg.deviceId, msg.deviceType || "DISPLAY", msg.displayId || null, msg.stationId || null, msg.name, ws.__ip);
        updateDeviceStatus(msg.deviceId, "ONLINE");
      }
      ws.send(JSON.stringify({ type: "heartbeat_ack" }));
      break;

    case "identify":
      if (!ws.__authenticated) {
        ws.send(JSON.stringify({ type: "error", error: "No autorizado" }));
        return;
      }
      ws.__deviceInfo.deviceId = msg.deviceId;
      ws.__deviceInfo.deviceType = msg.deviceType || "UNKNOWN";
      ws.__deviceInfo.displayId = msg.displayId || null;
      if (msg.deviceId) {
        upsertDevice(msg.deviceId, msg.deviceType || "UNKNOWN", msg.displayId || null, msg.stationId || null, msg.name, ws.__ip);
        updateDeviceStatus(msg.deviceId, "ONLINE");
      }
      break;
  }
}

function upsertDevice(deviceId, deviceType, displayId, stationId, name, ip) {
  if (!db) return;
  try {
    const existing = db.prepare("SELECT id FROM devices WHERE id = ?").get(deviceId);
    if (existing) {
      db.prepare("UPDATE devices SET last_seen = datetime('now'), ip_address = ?, status = 'ONLINE' WHERE id = ?")
        .run(ip || "unknown", deviceId);
    } else {
      db.prepare(
        "INSERT INTO devices (id, name, device_type, display_id, station_id, ip_address, status, last_seen) VALUES (?, ?, ?, ?, ?, ?, 'ONLINE', datetime('now'))"
      ).run(deviceId, name || `Device ${deviceId.slice(0, 8)}`, deviceType || "UNKNOWN", displayId || null, stationId || null, ip || "unknown");
    }
  } catch (err) {
    logger.error({ err, deviceId }, "Failed to upsert device");
  }
}

function updateDeviceStatus(deviceId, status) {
  if (!db) return;
  try {
    db.prepare("UPDATE devices SET status = ?, last_seen = datetime('now') WHERE id = ?").run(status, deviceId);
  } catch {
    /* noop */
  }
}

// Broadcast to ALL connected clients
export function broadcast(payload) {
  if (!wss) return;
  const data = JSON.stringify(payload);
  for (const client of wss.clients) {
    if (client.readyState === 1) client.send(data);
  }
}

// Broadcast only to clients subscribed to a specific station
export function broadcastToStation(stationId, payload) {
  if (!wss) return;
  const data = JSON.stringify(payload);
  for (const client of wss.clients) {
    if (client.readyState === 1 && client.__subscriptions?.stationIds?.has(Number(stationId))) {
      client.send(data);
    }
  }
}

// Get list of connected devices for admin
export function getConnectedDevices() {
  if (!wss) return [];
  const devices = [];
  for (const client of wss.clients) {
    if (client.readyState === 1 && client.__deviceInfo?.deviceId) {
      devices.push({
        ...client.__deviceInfo,
        ip: client.__ip,
        subscriptions: {
          displayIds: [...(client.__subscriptions?.displayIds || [])],
          stationIds: [...(client.__subscriptions?.stationIds || [])],
        },
      });
    }
  }
  return devices;
}
