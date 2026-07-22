import { composeAnnouncements, getAvailableLocales } from "./announcementComposer.js";
import { detectEvent, detectServiceEvent, detectStopEvent, getEventPriority, getEventTypes } from "./announcementEventDetector.js";
import { resolveAnnouncementSound, createDefaultSoundRules } from "./announcementSoundResolver.js";
import AnnouncementQueue from "./announcementQueue.js";
import { broadcast } from "../ws.js";
import logger from "../logger.js";

class AnnouncementService {
  constructor(db) {
    this.db = db;
    this.queue = new AnnouncementQueue(db);
    this._trainState = new Map();
    this._initialized = false;

    this.queue.onProcess((announcement) => {
      this._onAnnouncementReady(announcement);
    });
  }

  _onAnnouncementReady(announcement) {
    try {
      const languages = JSON.parse(announcement.languages || "[]");
      const composedData = JSON.parse(announcement.composed_data || "{}");

      let chimeInfo = null;
      if (announcement.chime_asset_id) {
        const asset = this.db.prepare("SELECT id, name, file_path, duration_ms FROM audio_assets WHERE id = ?").get(announcement.chime_asset_id);
        if (asset) {
          chimeInfo = { id: asset.id, name: asset.name, filePath: asset.file_path, durationMs: asset.duration_ms };
        }
      }

      broadcast({ type: "update" });

      broadcast({
        type: "announcement_ready",
        data: {
          id: announcement.id,
          trainId: announcement.train_id,
          serviceId: announcement.service_id,
          stationId: announcement.station_id,
          eventType: announcement.event_type,
          priority: announcement.priority,
          languages,
          texts: composedData,
          chime: chimeInfo,
          createdAt: announcement.created_at,
        },
      });

      try {
        this.db
          .prepare(
            `INSERT INTO announcement_history (queue_id, train_id, service_id, station_id, event_type, event_version, priority, languages, composed_data, chime_asset_id, queue_status)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'COMPLETED')`
          )
          .run(
            announcement.id,
            announcement.train_id,
            announcement.service_id,
            announcement.station_id,
            announcement.event_type,
            announcement.event_version,
            announcement.priority,
            announcement.languages,
            announcement.composed_data,
            announcement.chime_asset_id,
          );
      } catch (err) {
        logger.error({ err }, "Failed to move announcement to history");
      }

      this.queue.markCompleted(announcement.id);
    } catch (err) {
      logger.error({ err, queueId: announcement.id }, "Failed to process ready announcement");
      this.queue.fail(announcement.id, err.message);
    }
  }

  initialize() {
    if (this._initialized) return;
    createDefaultSoundRules(this.db);
    this._initialized = true;
    logger.info("Announcement service initialized");
  }

  onTrainUpdate(train) {
    if (!train) return;
    const key = `train:${train.id || train.number}`;
    const previous = this._trainState.get(key);
    this._trainState.set(key, { ...train });

    const events = detectEvent(train, previous);
    if (!events || events.length === 0) return;

    for (const event of events) {
      const stationId = train.station_id || train.stationId;
      const languages = this._getStationLanguages(stationId);

      const soundInfo = resolveAnnouncementSound(train, event.eventType, this.db);

      const composed = composeAnnouncements(train, event.eventType, languages);

      const eventVersion = (previous ? (previous._eventVersion || 0) + 1 : 1);

      this.queue.enqueue({
        trainId: train.id,
        stationId,
        eventType: event.eventType,
        eventVersion,
        priority: getEventPriority(event.eventType),
        languages,
        composedData: composed,
        chimeAssetId: soundInfo.soundId,
      });

      this._logEvent(event.eventType, "train", train.id, {
        train: train.number,
        eventVersion,
        soundRule: soundInfo.ruleId,
      });
    }
  }

  onServiceUpdate(service, previousService) {
    const event = detectServiceEvent(service, previousService);
    if (!event) return;

    const languages = this._getStationLanguages();
    const soundInfo = resolveAnnouncementSound(service, event.eventType, this.db);
    const composed = composeAnnouncements(service, event.eventType, languages);

    this.queue.enqueue({
      serviceId: service.id,
      stationId: service.station_id,
      eventType: event.eventType,
      eventVersion: 1,
      priority: getEventPriority(event.eventType),
      languages,
      composedData: composed,
      chimeAssetId: soundInfo.soundId,
    });

    this._logEvent(event.eventType, "service", service.id, { service: service.number });
  }

  onStopUpdate(stop, previousStop) {
    const event = detectStopEvent(stop, previousStop);
    if (!event) return;

    const trainData = {
      ...stop,
      id: stop.service_id,
      platform: stop.platform,
      sector: stop.sector,
    };

    const languages = this._getStationLanguages(stop.station_id);
    const soundInfo = resolveAnnouncementSound(trainData, event.eventType, this.db);
    const composed = composeAnnouncements(trainData, event.eventType, languages);

    this.queue.enqueue({
      serviceId: stop.service_id,
      stationId: stop.station_id,
      eventType: event.eventType,
      eventVersion: 1,
      priority: getEventPriority(event.eventType),
      languages,
      composedData: composed,
      chimeAssetId: soundInfo.soundId,
    });

    this._logEvent(event.eventType, "stop", stop.id, { stop: stop.station_name });
  }

  generateAnnouncement(train, eventType, languages) {
    return composeAnnouncements(train, eventType, languages);
  }

  enqueueManual(train, eventType, stationId, languages) {
    const soundInfo = resolveAnnouncementSound(train, eventType, this.db);
    const composed = composeAnnouncements(train, eventType, languages);

    return this.queue.enqueue({
      trainId: train.id,
      stationId,
      eventType,
      eventVersion: Date.now(),
      priority: getEventPriority(eventType),
      languages,
      composedData: composed,
      chimeAssetId: soundInfo.soundId,
    });
  }

  testAnnouncement(train, eventType, languages) {
    const composed = composeAnnouncements(train, eventType, languages);
    const soundInfo = resolveAnnouncementSound(train, eventType, this.db);

    return {
      eventType,
      languages,
      composed,
      chime: soundInfo,
      ruleApplied: soundInfo.ruleMatch,
    };
  }

  _getStationLanguages(stationId) {
    if (!stationId) return ["ca", "es", "en"];
    try {
      const config = this.db.prepare("SELECT languages FROM station_announcement_config WHERE station_id = ?").get(stationId);
      if (config?.languages) {
        try {
          return JSON.parse(config.languages);
        } catch {
          return ["ca", "es", "en"];
        }
      }
    } catch {
      // fallback
    }
    return ["ca", "es", "en"];
  }

  _logEvent(eventType, sourceType, sourceId, details) {
    try {
      this.db
        .prepare(
          `INSERT INTO announcement_event_log (event_type, source_type, source_id, details)
           VALUES (?, ?, ?, ?)`
        )
        .run(eventType, sourceType, sourceId, JSON.stringify(details));
    } catch (err) {
      logger.error({ err }, "Failed to log announcement event");
    }
  }

  getAvailableEventTypes() {
    return getEventTypes();
  }

  getAvailableLocales() {
    return getAvailableLocales();
  }

  getQueue(limit = 50) {
    return this.queue.getQueue(limit);
  }

  getHistory(limit = 100) {
    return this.queue.getHistory(limit);
  }

  getStats() {
    return this.queue.getStats();
  }

  getEventLog(limit = 100) {
    try {
      return this.db
        .prepare(`SELECT * FROM announcement_event_log ORDER BY created_at DESC LIMIT ?`)
        .all(limit);
    } catch {
      return [];
    }
  }
}

export default AnnouncementService;
