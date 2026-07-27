import logger from "../logger.js";
import { broadcast } from "../ws.js";

const VALID_MULTIPLIERS = [0.25, 0.5, 1, 2, 5, 10, 30, 60];

class SimulationService {
  constructor(db, eventEngine) {
    this.db = db;
    this.eventEngine = eventEngine;
    this._interval = null;
    this._sequenceIntervals = new Map();
    this._initialized = false;
  }

  initialize() {
    if (this._initialized) return;
    const clock = this.getClock();
    if (!clock.paused) this._startTick();
    this._initialized = true;
    logger.info({ multiplier: clock.multiplier, paused: clock.paused }, "Simulation Service initialized");
  }

  getClock() {
    const row = this.db.prepare("SELECT * FROM simulation_clock WHERE id = 1").get();
    if (!row) {
      this.db.prepare("INSERT INTO simulation_clock (id, base_real, base_sim, multiplier, paused) VALUES (1, datetime('now'), datetime('now'), 1.0, 1)").run();
      return this.getClock();
    }
    return row;
  }

  getSimulatedNow() {
    const clock = this.getClock();
    if (clock.paused) return new Date(clock.base_sim);
    const realNow = Date.now();
    const baseReal = new Date(clock.base_real).getTime();
    const baseSim = new Date(clock.base_sim).getTime();
    const elapsed = (realNow - baseReal) * clock.multiplier;
    return new Date(baseSim + elapsed);
  }

  setMultiplier(multiplier) {
    if (!VALID_MULTIPLIERS.includes(multiplier)) return { error: "Invalid multiplier" };
    const now = new Date().toISOString();
    const simNow = this.getSimulatedNow().toISOString();
    this.db.prepare("UPDATE simulation_clock SET multiplier = ?, base_real = ?, base_sim = ?, updated_at = ? WHERE id = 1").run(multiplier, now, simNow, now);
    this._restartTick();
    const clock = this.getClock();
    this._broadcastClock(clock);
    logger.info({ multiplier }, "Simulation multiplier changed");
    return { success: true, clock };
  }

  setPaused(paused) {
    const now = new Date().toISOString();
    const simNow = this.getSimulatedNow().toISOString();
    this.db.prepare("UPDATE simulation_clock SET paused = ?, base_real = ?, base_sim = ?, updated_at = ? WHERE id = 1").run(paused ? 1 : 0, now, simNow, now);
    if (paused) this._stopTick();
    else this._startTick();
    const clock = this.getClock();
    this._broadcastClock(clock);
    logger.info({ paused }, "Simulation paused state changed");
    return { success: true, clock };
  }

  resetClock() {
    const now = new Date().toISOString();
    this.db.prepare("UPDATE simulation_clock SET base_real = ?, base_sim = ?, multiplier = 1.0, paused = 1, updated_at = ? WHERE id = 1").run(now, now, now);
    this._stopTick();
    const clock = this.getClock();
    this._broadcastClock(clock);
    return { success: true, clock };
  }

  logEvent(eventType, { trainId, serviceId, stationId, displayId, source, details } = {}) {
    try {
      this.db.prepare(
        `INSERT INTO simulation_events (event_type, train_id, service_id, station_id, display_id, source, details)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).run(eventType, trainId || null, serviceId || null, stationId || null, displayId || null, source || "manual", details ? JSON.stringify(details) : null);
    } catch (err) {
      logger.error({ err }, "Failed to log simulation event");
    }
  }

  getEvents(limit = 100) {
    try {
      return this.db.prepare("SELECT * FROM simulation_events ORDER BY created_at DESC LIMIT ?").all(limit);
    } catch { return []; }
  }

  // -- Journey Sequences --

  listSequences() {
    try {
      return this.db.prepare(`
        SELECT js.*, t.number as train_number, t.destination as train_destination
        FROM journey_sequences js
        LEFT JOIN trains t ON t.id = js.train_id
        ORDER BY js.created_at DESC
      `).all();
    } catch { return []; }
  }

  getSequence(id) {
    try {
      const seq = this.db.prepare("SELECT * FROM journey_sequences WHERE id = ?").get(id);
      if (!seq) return null;
      seq.steps = this.db.prepare("SELECT * FROM journey_sequence_steps WHERE sequence_id = ? ORDER BY step_order ASC").all(id);
      return seq;
    } catch { return null; }
  }

  createSequence({ name, trainId, serviceId, stationId, loop, steps }) {
    try {
      const result = this.db.prepare(
        "INSERT INTO journey_sequences (name, train_id, service_id, station_id, loop) VALUES (?, ?, ?, ?, ?)"
      ).run(name, trainId || null, serviceId || null, stationId || null, loop ? 1 : 0);
      const seqId = result.lastInsertRowid;

      if (steps && steps.length > 0) {
        const stmt = this.db.prepare(
          "INSERT INTO journey_sequence_steps (sequence_id, step_order, event_type, delay_seconds, auto_proceed) VALUES (?, ?, ?, ?, ?)"
        );
        for (let i = 0; i < steps.length; i++) {
          const s = steps[i];
          stmt.run(seqId, i, s.eventType, s.delaySeconds || 0, s.autoProceed !== false ? 1 : 0);
        }
      }

      return { success: true, id: seqId };
    } catch (err) {
      return { error: err.message };
    }
  }

  deleteSequence(id) {
    try {
      this.db.prepare("DELETE FROM journey_sequence_steps WHERE sequence_id = ?").run(id);
      this.db.prepare("DELETE FROM journey_sequences WHERE id = ?").run(id);
      return { success: true };
    } catch (err) {
      return { error: err.message };
    }
  }

  startSequence(id) {
    const seq = this.getSequence(id);
    if (!seq) return { error: "Sequence not found" };
    if (!seq.steps || seq.steps.length === 0) return { error: "Sequence has no steps" };

    this.db.prepare("UPDATE journey_sequences SET current_step = 0, updated_at = datetime('now') WHERE id = ?").run(id);
    this._advanceSequence(seq);
    return { success: true };
  }

  pauseSequence(id) {
    const interval = this._sequenceIntervals.get(id);
    if (interval) {
      clearTimeout(interval);
      this._sequenceIntervals.delete(id);
    }
    return { success: true };
  }

  resetSequence(id) {
    this.pauseSequence(id);
    this.db.prepare("UPDATE journey_sequences SET current_step = 0, updated_at = datetime('now') WHERE id = ?").run(id);
    return { success: true };
  }

  _advanceSequence(seq) {
    const stepIndex = seq.current_step || 0;
    if (stepIndex >= seq.steps.length) {
      if (seq.loop) {
        this.db.prepare("UPDATE journey_sequences SET current_step = 0, updated_at = datetime('now') WHERE id = ?").run(seq.id);
        this._advanceSequence({ ...seq, current_step: 0 });
      }
      return;
    }

    const step = seq.steps[stepIndex];
    logger.info({ seqId: seq.id, step: stepIndex, eventType: step.event_type }, "Journey sequence step");

    // Fire the event through the Event Engine if it references a train
    if (seq.train_id && step.event_type !== "DELAY" && step.event_type !== "PLATFORM_CHANGE") {
      this.eventEngine.fireStateChange(seq.train_id, step.event_type, "automation", { sequenceId: seq.id, step: stepIndex });
    } else if (seq.train_id && step.event_type === "PLATFORM_CHANGE") {
      // Platform change handled separately via platform endpoint
      this.eventEngine.firePlatformChange(seq.train_id, step.platform || "1", step.sector, "automation");
    }

    this.logEvent("SEQUENCE_STEP", {
      trainId: seq.train_id,
      source: "automation",
      details: { sequenceId: seq.id, step: stepIndex, eventType: step.event_type },
    });

    // Schedule next step
    const delayMs = (step.delay_seconds || 0) * 1000;
    if (step.auto_proceed && delayMs > 0) {
      const timer = setTimeout(() => {
        this._sequenceIntervals.delete(seq.id);
        this.db.prepare("UPDATE journey_sequences SET current_step = current_step + 1, updated_at = datetime('now') WHERE id = ?").run(seq.id);
        this._advanceSequence({ ...seq, current_step: stepIndex + 1 });
      }, delayMs);
      this._sequenceIntervals.set(seq.id, timer);
    }
  }

  // -- Internal clock tick --
  _startTick() {
    if (this._interval) return;
    this._interval = setInterval(() => {
      this._broadcastClock(this.getClock());
    }, 5000);
  }

  _stopTick() {
    if (this._interval) {
      clearInterval(this._interval);
      this._interval = null;
    }
  }

  _restartTick() {
    this._stopTick();
    const clock = this.getClock();
    if (!clock.paused) this._startTick();
  }

  _broadcastClock(clock) {
    const simNow = this.getSimulatedNow();
    broadcast({
      type: "simulation_clock",
      data: {
        multiplier: clock.multiplier,
        paused: !!clock.paused,
        simulatedTime: simNow.toISOString(),
        simulatedTimeFormatted: simNow.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" }),
        updatedAt: clock.updated_at,
      },
    });
  }
}

export default SimulationService;
