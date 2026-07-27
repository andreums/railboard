import { broadcast, broadcastToDisplay, broadcastToStation } from "../ws.js";
import logger from "../logger.js";

const VALID_TRANSITIONS = {
  SCHEDULED:   ["APPROACHING", "DELAYED", "CANCELLED"],
  APPROACHING: ["ARRIVING", "DELAYED", "CANCELLED"],
  ARRIVING:    ["STOPPED", "DELAYED", "CANCELLED"],
  STOPPED:     ["BOARDING", "ARRIVED", "CANCELLED"],
  BOARDING:    ["READY_TO_DEPART", "CANCELLED"],
  READY_TO_DEPART: ["DEPARTING", "CANCELLED"],
  DEPARTING:   ["DEPARTED", "CANCELLED"],
  DEPARTED:    ["FINISHED"],
  ARRIVED:     ["FINISHED"],
  DELAYED:     ["SCHEDULED", "APPROACHING", "ARRIVING", "STOPPED", "BOARDING", "READY_TO_DEPART", "CANCELLED"],
  CANCELLED:   [],
  FINISHED:    [],
};

const STATE_DISPLAY_NAMES = {
  SCHEDULED:     { ca: "Programat", es: "Programado", en: "Scheduled" },
  APPROACHING:   { ca: "Aproximant-se", es: "Aproximándose", en: "Approaching" },
  ARRIVING:      { ca: "Entrant", es: "Entrando", en: "Arriving" },
  STOPPED:       { ca: "Aturat", es: "Detenido", en: "Stopped" },
  BOARDING:      { ca: "Embarque", es: "Embarque", en: "Boarding" },
  READY_TO_DEPART: { ca: "Llest per sortir", es: "Listo para salir", en: "Ready to depart" },
  DEPARTING:     { ca: "Sortint", es: "Saliendo", en: "Departing" },
  DEPARTED:      { ca: "Sortit", es: "Salido", en: "Departed" },
  ARRIVED:       { ca: "Arribat", es: "Llegado", en: "Arrived" },
  DELAYED:       { ca: "Retardat", es: "Retrasado", en: "Delayed" },
  CANCELLED:     { ca: "Cancel·lat", es: "Cancelado", en: "Cancelled" },
  FINISHED:      { ca: "Finalitzat", es: "Finalizado", en: "Finished" },
};

export function getValidTransitions(fromState) {
  return VALID_TRANSITIONS[fromState] || [];
}

export function isValidTransition(fromState, toState) {
  const allowed = VALID_TRANSITIONS[fromState];
  return allowed && allowed.includes(toState);
}

export function getStateDisplayName(state, language = "ca") {
  return STATE_DISPLAY_NAMES[state]?.[language] || state;
}

export function getAllStates() {
  return Object.keys(VALID_TRANSITIONS);
}

class EventEngine {
  constructor(db, announcementService) {
    this.db = db;
    this.announcementService = announcementService;
    this._handlers = new Map();
    this._initialized = false;
  }

  // Map Event Engine states to announcement event types for direct composition
  static STATE_EVENT_MAP = {
    SCHEDULED: "TRAIN_ANNOUNCEMENT",
    APPROACHING: "TRAIN_APPROACHING",
    ARRIVING: "TRAIN_ARRIVING",
    STOPPED: "TRAIN_AT_PLATFORM",
    BOARDING: "TRAIN_BOARDING",
    READY_TO_DEPART: "TRAIN_READY_TO_DEPART",
    DEPARTING: "TRAIN_DEPARTING",
    DEPARTED: "TRAIN_DEPARTED",
    ARRIVED: "TRAIN_AT_PLATFORM",
    DELAYED: "TRAIN_DELAYED",
    CANCELLED: "TRAIN_CANCELLED",
    FINISHED: null,
  };

  initialize() {
    if (this._initialized) return;
    this._registerDefaultHandlers();
    this._initialized = true;
    logger.info("Event Engine initialized");
  }

  on(eventType, handler) {
    if (!this._handlers.has(eventType)) {
      this._handlers.set(eventType, new Set());
    }
    this._handlers.get(eventType).add(handler);
    return () => this._handlers.get(eventType)?.delete(handler);
  }

  _registerDefaultHandlers() {
    // Display updates
    this.on("TRAIN_STATE_CHANGED", (event) => {
      broadcastToStation(event.stationId, {
        type: "TRAIN_STATE_CHANGED",
        data: {
          trainId: event.trainId,
          number: event.number,
          fromState: event.fromState,
          toState: event.toState,
          platform: event.platform,
          stationId: event.stationId,
        },
      });
      // Also broadcast to displays subscribed to this train's platform
      if (event.platform) {
        // Generic update for all
        broadcast({ type: "update", at: Date.now() });
      }
    });

    // Announcements via announcementService — direct state-to-event composition
    this.on("TRAIN_STATE_CHANGED", (event) => {
      if (!this.announcementService || !event.trainData) return;
      try {
        const eventType = EventEngine.STATE_EVENT_MAP[event.toState];
        if (!eventType) return;
        const stationId = event.stationId || event.trainData.station_id;
        const languages = this._getStationLanguages(stationId);
        this.announcementService.enqueueStateEvent(event.trainData, eventType, event.fromState, event.toState, stationId, languages);
      } catch (err) {
        logger.error({ err, trainId: event.trainId }, "Failed to trigger announcement for state change");
      }
    });
  }

  /**
   * Fire a state change event: validates transition, updates train, logs event, dispatches to handlers
   */
  fireStateChange(trainId, toState, source = "manual", details = {}) {
    try {
      const train = this.db.prepare("SELECT * FROM trains WHERE id = ?").get(trainId);
      if (!train) return { error: "Train not found" };

      const fromState = train.status;

      if (!isValidTransition(fromState, toState)) {
        return { error: `Invalid transition: ${fromState} → ${toState}`, fromState, toState };
      }

      const now = new Date().toISOString();

      // Update train state
      this.db
        .prepare("UPDATE trains SET status = ?, state_source = ?, state_updated_at = ? WHERE id = ?")
        .run(toState, source, now, trainId);

      // Log event
      const event = {
        trainId,
        serviceId: null,
        eventType: "TRAIN_STATE_CHANGED",
        fromState,
        toState,
        source,
        stationId: train.station_id,
        number: train.number,
        platform: train.platform,
        trainData: { ...train, status: toState, state_source: source, state_updated_at: now },
      };

      this._logEvent(trainId, null, "TRAIN_STATE_CHANGED", fromState, toState, source, train.station_id, details);

      // Dispatch to handlers
      const handlers = this._handlers.get("TRAIN_STATE_CHANGED");
      if (handlers) {
        for (const handler of handlers) {
          try { handler(event); } catch (err) {
            logger.error({ err, trainId }, "Error in event handler");
          }
        }
      }

      return { success: true, fromState, toState, trainId };
    } catch (err) {
      logger.error({ err, trainId }, "fireStateChange error");
      return { error: err.message };
    }
  }

  /**
   * Log a platform change event
   */
  firePlatformChange(trainId, platform, sector, source = "manual") {
    try {
      const train = this.db.prepare("SELECT * FROM trains WHERE id = ?").get(trainId);
      if (!train) return { error: "Train not found" };

      const oldPlatform = train.platform;
      const oldSector = train.sector;

      this.db
        .prepare("UPDATE trains SET platform = ?, sector = ?, state_source = ?, state_updated_at = ? WHERE id = ?")
        .run(platform, sector || null, source, new Date().toISOString(), trainId);

      this._logEvent(trainId, null, "TRAIN_PLATFORM_CHANGED", null, null, source, train.station_id, { oldPlatform, oldSector, newPlatform: platform, newSector: sector });

      const event = { trainId, number: train.number, oldPlatform, oldSector, newPlatform: platform, newSector: sector, stationId: train.station_id };

      broadcastToStation(train.station_id, { type: "TRAIN_PLATFORM_CHANGED", data: event });
      broadcast({ type: "update", at: Date.now() });

      if (this.announcementService) {
        try {
          const updated = this.db.prepare("SELECT * FROM trains WHERE id = ?").get(trainId);
          const stationId = train.station_id;
          const languages = this._getStationLanguages(stationId);
          this.announcementService.enqueueStateEvent(updated, "PLATFORM_CHANGE", null, null, stationId, languages);
        } catch (err) {
          logger.error({ err, trainId }, "Failed to trigger announcement for platform change");
        }
      }

      return { success: true, ...event };
    } catch (err) {
      logger.error({ err, trainId }, "firePlatformChange error");
      return { error: err.message };
    }
  }

  _logEvent(trainId, serviceId, eventType, fromState, toState, source, stationId, details) {
    try {
      this.db
        .prepare(
          "INSERT INTO train_events (train_id, service_id, event_type, from_state, to_state, source, station_id, details) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
        )
        .run(trainId, serviceId, eventType, fromState, toState, source, stationId, JSON.stringify(details || {}));
    } catch (err) {
      logger.error({ err }, "Failed to log train event");
    }
  }

  _getStationLanguages(stationId) {
    if (!this.db || !stationId) return ["ca", "es", "en"];
    try {
      const config = this.db.prepare("SELECT languages FROM station_announcement_config WHERE station_id = ?").get(stationId);
      if (config?.languages) {
        try { return JSON.parse(config.languages); } catch { return ["ca", "es", "en"]; }
      }
    } catch { /* fallback */ }
    return ["ca", "es", "en"];
  }

  getEvents(trainId = null, limit = 100) {
    try {
      if (trainId) {
        return this.db
          .prepare("SELECT * FROM train_events WHERE train_id = ? ORDER BY created_at DESC LIMIT ?")
          .all(trainId, limit);
      }
      return this.db
        .prepare("SELECT * FROM train_events ORDER BY created_at DESC LIMIT ?")
        .all(limit);
    } catch {
      return [];
    }
  }
}

export default EventEngine;
