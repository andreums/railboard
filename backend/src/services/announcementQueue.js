import logger from "../logger.js";

class AnnouncementQueue {
  constructor(db) {
    this.db = db;
    this._listeners = new Set();
    this._processing = false;
  }

  onProcess(callback) {
    this._listeners.add(callback);
    return () => this._listeners.delete(callback);
  }

  async enqueue({
    trainId,
    serviceId,
    stationId,
    eventType,
    eventVersion = 1,
    priority = "NORMAL",
    languages,
    composedData = {},
    chimeAssetId = null,
  }) {
    const dedupKey = `${trainId || "t"}:${stationId || "s"}:${eventType}:${eventVersion}:${(languages || []).join(",")}`;

    const existing = this.db
      .prepare(
        `SELECT id FROM announcement_queue 
         WHERE dedup_key = ? AND status NOT IN ('COMPLETED','CANCELLED','FAILED')`
      )
      .get(dedupKey);

    if (existing) {
      logger.info({ dedupKey, queueId: existing.id }, "Announcement already queued, skipping dedup");
      return existing.id;
    }

    const result = this.db
      .prepare(
        `INSERT INTO announcement_queue 
         (train_id, service_id, station_id, event_type, event_version, dedup_key, priority, languages, composed_data, chime_asset_id, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING')`
      )
      .run(
        trainId || null,
        serviceId || null,
        stationId || null,
        eventType,
        eventVersion,
        dedupKey,
        priority,
        JSON.stringify(languages || []),
        JSON.stringify(composedData),
        chimeAssetId || null,
      );

    logger.info({ dedupKey, queueId: result.lastInsertRowid, eventType, priority }, "Announcement enqueued");

    if (!this._processing) {
      this._processing = true;
      setImmediate(() => this._processNext());
    }

    return result.lastInsertRowid;
  }

  _processNext() {
    const next = this.db
      .prepare(
        `SELECT * FROM announcement_queue 
         WHERE status = 'PENDING'
         ORDER BY 
           CASE priority
             WHEN 'EMERGENCY' THEN 0
             WHEN 'HIGH' THEN 1
             WHEN 'NORMAL' THEN 2
             WHEN 'LOW' THEN 3
           END,
           created_at ASC
         LIMIT 1`
      )
      .get();

    if (!next) {
      this._processing = false;
      return;
    }

    this.db
      .prepare(`UPDATE announcement_queue SET status = 'READY', updated_at = datetime('now') WHERE id = ?`)
      .run(next.id);

    for (const listener of this._listeners) {
      try {
        listener(next);
      } catch (err) {
        logger.error({ err, queueId: next.id }, "Error in announcement queue listener");
      }
    }

    setImmediate(() => this._processNext());
  }

  getQueue(limit = 50) {
    return this.db
      .prepare(
        `SELECT * FROM announcement_queue 
         ORDER BY 
           CASE priority
             WHEN 'EMERGENCY' THEN 0
             WHEN 'HIGH' THEN 1
             WHEN 'NORMAL' THEN 2
             WHEN 'LOW' THEN 3
           END,
           created_at DESC
         LIMIT ?`
      )
      .all(limit);
  }

  getPending() {
    return this.db
      .prepare(
        `SELECT * FROM announcement_queue 
         WHERE status IN ('PENDING','GENERATING_AUDIO','READY','PLAYING_SOUND','PLAYING_ANNOUNCEMENT')
         ORDER BY created_at ASC`
      )
      .all();
  }

  markStatus(id, status, error = null) {
    const stmt = error
      ? this.db.prepare(`UPDATE announcement_queue SET status = ?, error = ?, updated_at = datetime('now') WHERE id = ?`)
      : this.db.prepare(`UPDATE announcement_queue SET status = ?, updated_at = datetime('now') WHERE id = ?`);
    
    if (error) {
      stmt.run(status, error, id);
    } else {
      stmt.run(status, id);
    }
  }

  markCompleted(id) {
    this.markStatus(id, "COMPLETED");
  }

  cancel(id) {
    this.markStatus(id, "CANCELLED", "Manually cancelled");
  }

  fail(id, error) {
    this.markStatus(id, "FAILED", error);
  }

  getHistory(limit = 100) {
    return this.db
      .prepare(
        `SELECT * FROM announcement_history ORDER BY created_at DESC LIMIT ?`
      )
      .all(limit);
  }

  getStats() {
    const pending = this.db.prepare(`SELECT COUNT(*) as count FROM announcement_queue WHERE status = 'PENDING'`).get()?.count || 0;
    const ready = this.db.prepare(`SELECT COUNT(*) as count FROM announcement_queue WHERE status = 'READY'`).get()?.count || 0;
    const playing = this.db
      .prepare(`SELECT COUNT(*) as count FROM announcement_queue WHERE status IN ('PLAYING_SOUND','PLAYING_ANNOUNCEMENT')`)
      .get()?.count || 0;
    const completed = this.db.prepare(`SELECT COUNT(*) as count FROM announcement_history`).get()?.count || 0;

    return { pending, ready, playing, completed };
  }
}

export default AnnouncementQueue;
