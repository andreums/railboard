import { WebSocketServer } from "ws";
import logger from "./logger.js";

let wss = null;
let db = null;

// Per-client subscriptions
// ws.__subscriptions = { displayIds: Set<string>, stationIds: Set<number> }
// ws.__deviceInfo = { deviceId, deviceType, displayId, lastHeartbeat }

const HEARTBEAT_TIMEOUT_MS = 60000; // 60s without heartbeat = offline

export function attachWebSocket(server, database) {
  db = database;
  wss = new WebSocketServer({ server, path: "/ws" });

  wss.on("connection", (ws, req) => {
    ws.__subscriptions = { displayIds: new Set(), stationIds: new Set() };
    ws.__deviceInfo = { deviceId: null, deviceType: null, displayId: null, lastHeartbeat: Date.now() };
    ws.__ip = req?.socket?.remoteAddress || "unknown";

    ws.send(JSON.stringify({ type: "hello" }));

    ws.on("message", (raw) => {
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

// Broadcast only to clients subscribed to a specific display
export function broadcastToDisplay(displayId, payload) {
  if (!wss) return;
  const data = JSON.stringify(payload);
  for (const client of wss.clients) {
    if (client.readyState === 1 && client.__subscriptions?.displayIds?.has(displayId)) {
      client.send(data);
    }
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
