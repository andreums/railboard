import logger from "../logger.js";
import { broadcast } from "../ws.js";

const VALID_EVENT_TYPES = [
  "SENSOR_TRIGGERED",
  "TRAIN_DETECTED",
  "TRAIN_LEFT",
  "BUTTON_PRESSED",
  "STATUS",
  "ERROR",
  "OCCUPANCY_CHANGED",
  "SIGNAL_CHANGED",
  "TURNOUT_CHANGED",
];

class HardwareService {
  constructor(db, eventEngine) {
    this.db = db;
    this.eventEngine = eventEngine;
  }

  processEvent({ deviceId, eventType, sensorId, trainId, stationId, platform, data }) {
    if (!deviceId) return { error: "device_id required" };
    if (!eventType || !VALID_EVENT_TYPES.includes(eventType)) {
      return { error: `Invalid event_type. Valid: ${VALID_EVENT_TYPES.join(", ")}` };
    }

    // Log to simulation_events
    this._logEvent(eventType, { deviceId, sensorId, trainId, stationId, platform, data });

    // Auto-trigger state transitions based on event type + sensor
    const stateResult = this._handleTrainDetection(eventType, trainId, stationId, platform, data);

    // Broadcast to WebSocket
    broadcast({
      type: "hardware_event",
      data: {
        deviceId,
        eventType,
        sensorId,
        trainId,
        stationId,
        platform,
        data: data || {},
        timestamp: new Date().toISOString(),
      },
    });

    // Update device's last_seen
    try {
      this.db.prepare("UPDATE devices SET last_seen = datetime('now') WHERE id = ?").run(deviceId);
    } catch { /* device may not exist */ }

    return { success: true, stateTriggered: !!stateResult, stateResult };
  }

  _handleTrainDetection(eventType, trainId, stationId, platform, data) {
    if (eventType === "TRAIN_DETECTED" && trainId) {
      const train = this.db.prepare("SELECT * FROM trains WHERE id = ?").get(trainId);
      if (!train) return null;

      // Determine next state based on current state and position context
      let toState;
      switch (train.status) {
        case "SCHEDULED":
          toState = "APPROACHING";
          break;
        case "APPROACHING":
          toState = "ARRIVING";
          break;
        case "ARRIVING":
          toState = "STOPPED";
          break;
        case "STOPPED":
          toState = "BOARDING";
          break;
        default:
          toState = null;
      }

      if (toState && this.eventEngine) {
        try {
          const result = this.eventEngine.fireStateChange(trainId, toState, "hardware", { sensorId: data?.sensorId, platform });
          return result;
        } catch (err) {
          logger.error({ err, trainId }, "Hardware auto-fire state change failed");
          return null;
        }
      }
    }

    if (eventType === "TRAIN_LEFT" && trainId) {
      const train = this.db.prepare("SELECT * FROM trains WHERE id = ?").get(trainId);
      if (!train) return null;

      // Auto-advance after departure
      let toState;
      switch (train.status) {
        case "DEPARTING":
          toState = "DEPARTED";
          break;
        case "DEPARTED":
          toState = "FINISHED";
          break;
        default:
          toState = null;
      }

      if (toState && this.eventEngine) {
        try {
          const result = this.eventEngine.fireStateChange(trainId, toState, "hardware", { sensorId: data?.sensorId, platform });
          return result;
        } catch (err) {
          logger.error({ err, trainId }, "Hardware auto-fire train-left failed");
          return null;
        }
      }
    }

    return null;
  }

  getEvents(limit = 100) {
    try {
      return this.db.prepare(
        "SELECT * FROM simulation_events WHERE source = 'hardware' ORDER BY created_at DESC LIMIT ?"
      ).all(limit);
    } catch { return []; }
  }

  _logEvent(eventType, { deviceId, sensorId, trainId, stationId, platform, data }) {
    try {
      this.db.prepare(
        `INSERT INTO simulation_events (event_type, train_id, station_id, source, details)
         VALUES (?, ?, ?, 'hardware', ?)`
      ).run(
        eventType,
        trainId || null,
        stationId || null,
        JSON.stringify({ deviceId, sensorId, platform, data: data || {} }),
      );
    } catch (err) {
      logger.error({ err }, "Failed to log hardware event");
    }
  }
}

export default HardwareService;
