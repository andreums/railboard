import logger from "../logger.js";
import { broadcast } from "../ws.js";

const DEFAULT_TIME_WINDOWS = {
  SCHEDULED:   { beforeExpected: 300, autoState: "APPROACHING" },
  APPROACHING: { duration: 120,  autoState: "ARRIVING" },
  ARRIVING:    { duration: 60,   autoState: "STOPPED" },
  STOPPED:     { duration: 180,  autoState: "BOARDING" },
  BOARDING:    { duration: 240,  autoState: "READY_TO_DEPART" },
  READY_TO_DEPART: { duration: 60, autoState: "DEPARTING" },
  DEPARTING:   { duration: 30,   autoState: "DEPARTED" },
};

const HINT_CONFIG = {
  SCHEDULED:   { hint: "Esperando hora prevista",               action: "auto",    next: "APPROACHING" },
  APPROACHING: { hint: "Aproximándose a la estación",           action: "auto",    next: "ARRIVING" },
  ARRIVING:    { hint: "Entrando en la estación",               action: "auto",    next: "STOPPED" },
  STOPPED:     { hint: "Tren detenido — iniciar embarque",      action: "manual",  next: "BOARDING" },
  BOARDING:    { hint: "Pasajeros embarcando",                  action: "auto",    next: "READY_TO_DEPART" },
  READY_TO_DEPART: { hint: "Listo para salir — cerrar puertas", action: "manual",  next: "DEPARTING" },
  DEPARTING:   { hint: "Saliendo de la estación",               action: "auto",    next: "DEPARTED" },
  DEPARTED:    { hint: "Tren salido",                          action: "done",    next: null },
  ARRIVED:     { hint: "Tren finalizado",                      action: "done",    next: null },
  DELAYED:     { hint: "Retraso — revisar hora prevista",      action: "manual",  next: null },
  CANCELLED:   { hint: "Cancelado",                            action: "done",    next: null },
  FINISHED:    { hint: "Finalizado",                           action: "done",    next: null },
};

class AutomationService {
  constructor(db, eventEngine, simulationService) {
    this.db = db;
    this.eventEngine = eventEngine;
    this.simulation = simulationService;
    this._interval = null;
    this._initialized = false;
  }

  initialize() {
    if (this._initialized) return;
    this._startScheduler();
    this._initialized = true;
    logger.info("Automation Service initialized");
  }

  // ==================== RULES CRUD ====================

  listRules() {
    try { return this.db.prepare("SELECT * FROM automation_rules ORDER BY priority ASC, created_at DESC").all(); }
    catch { return []; }
  }

  getRule(id) {
    try { return this.db.prepare("SELECT * FROM automation_rules WHERE id = ?").get(id); }
    catch { return null; }
  }

  createRule({ name, description, triggerType, conditions, actions, priority, stationId, trainTypeId, operatorId, intervalSeconds, cooldownSeconds }) {
    try {
      const result = this.db.prepare(
        `INSERT INTO automation_rules (name, description, trigger_type, conditions, actions, priority, station_id, train_type_id, operator_id, interval_seconds, cooldown_seconds)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        name, description || null, triggerType || "time_based",
        JSON.stringify(conditions || {}), JSON.stringify(actions || []),
        priority || 100, stationId || null, trainTypeId || null, operatorId || null,
        intervalSeconds || 30, cooldownSeconds || 60
      );
      return { success: true, id: result.lastInsertRowid };
    } catch (err) { return { error: err.message }; }
  }

  updateRule(id, data) {
    try {
      const existing = this.getRule(id);
      if (!existing) return { error: "Rule not found" };
      const fields = [];
      const values = [];
      for (const [key, val] of Object.entries(data)) {
        const col = { name: "name", description: "description", triggerType: "trigger_type", conditions: "conditions", actions: "actions", priority: "priority", enabled: "enabled", stationId: "station_id", trainTypeId: "train_type_id", operatorId: "operator_id", intervalSeconds: "interval_seconds", cooldownSeconds: "cooldown_seconds" }[key];
        if (!col) continue;
        fields.push(`${col} = ?`);
        values.push(typeof val === "object" ? JSON.stringify(val) : val);
      }
      if (fields.length === 0) return { error: "No fields to update" };
      fields.push("updated_at = datetime('now')");
      this.db.prepare(`UPDATE automation_rules SET ${fields.join(", ")} WHERE id = ?`).run(...values, id);
      return { success: true };
    } catch (err) { return { error: err.message }; }
  }

  deleteRule(id) {
    try { this.db.prepare("DELETE FROM automation_rules WHERE id = ?").run(id); return { success: true }; }
    catch (err) { return { error: err.message }; }
  }

  // ==================== STATE SUGGESTIONS ====================

  getSuggestions(trainId) {
    try {
      const train = this.db.prepare("SELECT * FROM trains WHERE id = ?").get(trainId);
      if (!train) return null;

      const status = train.status;
      const config = HINT_CONFIG[status];
      if (!config) return { hint: "Estado desconocido", nextActions: [] };

      const nextActions = [];
      if (config.next) {
        nextActions.push({ state: config.next, hint: config.hint, action: config.action });
      }

      // Add delay suggestion if applicable
      const expectedMin = this._minutesFromNow(train.expected_time);
      if (expectedMin > 2) {
        nextActions.push({ state: "DELAYED", hint: `Retraso de ${Math.round(expectedMin)} min detectado`, action: "manual" });
      }

      return { currentState: status, hint: config.hint, nextActions };
    } catch { return null; }
  }

  getSuggestionsForStation(stationId) {
    try {
      const trains = this.db.prepare("SELECT * FROM trains WHERE station_id = ? ORDER BY expected_time ASC").all(stationId);
      return trains.map(t => this.getSuggestions(t.id)).filter(Boolean);
    } catch { return []; }
  }

  // ==================== SCHEDULER ====================

  _startScheduler() {
    if (this._interval) return;
    // Evaluate every 15 seconds
    this._interval = setInterval(() => this._evaluateAll(), 15000);
    // Also evaluate after a short delay
    setTimeout(() => this._evaluateAll(), 2000);
  }

  _stopScheduler() {
    if (this._interval) { clearInterval(this._interval); this._interval = null; }
  }

  _evaluateAll() {
    try {
      this._evaluateTimeBasedRules();
      this._evaluateTimeProgression();
      this._evaluateDelayDetection();
    } catch (err) {
      logger.error({ err }, "Automation evaluation error");
    }
  }

  // ==================== TIME-BASED PROGRESSION ====================

  _evaluateTimeProgression() {
    const simNow = this.simulation ? this.simulation.getSimulatedNow() : new Date();
    const simMinutes = simNow.getHours() * 60 + simNow.getMinutes();

    const trains = this.db.prepare(
      "SELECT * FROM trains WHERE status NOT IN ('CANCELLED', 'FINISHED', 'DEPARTED', 'ARRIVED') AND station_id IS NOT NULL"
    ).all();

    for (const train of trains) {
      this._trackStateDuration(train);
      this._tryAutoProgress(train, simMinutes);
    }
  }

  _trackStateDuration(train) {
    if (!train.status || train.status === "CANCELLED" || train.status === "FINISHED") return;
    const existing = this.db.prepare(
      "SELECT id FROM train_state_timings WHERE train_id = ? AND state = ? AND exceeded = 0"
    ).get(train.id, train.status);
    if (existing) return;
    // Close previous active timing
    this.db.prepare("UPDATE train_state_timings SET exceeded = 1 WHERE train_id = ? AND exceeded = 0").run(train.id);
    // Insert new timing
    const window = DEFAULT_TIME_WINDOWS[train.status];
    this.db.prepare(
      "INSERT INTO train_state_timings (train_id, state, expected_duration_seconds) VALUES (?, ?, ?)"
    ).run(train.id, train.status, window ? window.duration : null);
  }

  _tryAutoProgress(train, simMinutes) {
    const expectedMin = this._parseTimeToMinutes(train.expected_time);
    if (expectedMin == null) return;

    const window = DEFAULT_TIME_WINDOWS[train.status];
    if (!window) return;

    let shouldProgress = false;

    if (train.status === "SCHEDULED") {
      // Progress to APPROACHING `beforeExpected` seconds before expected_time
      const diffMs = (expectedMin - simMinutes) * 60 * 1000;
      if (diffMs <= 0 && diffMs > -300000) {
        shouldProgress = true;
      }
    } else if (train.status === "DELAYED") {
      // Auto-resume from DELAYED if expected_time is still in the future
      const diffMs = (expectedMin - simMinutes) * 60 * 1000;
      if (diffMs > 60000) {
        shouldProgress = true;
      }
    } else {
      // For other states, check duration in state vs expected duration
      const timing = this.db.prepare(
        "SELECT entered_at FROM train_state_timings WHERE train_id = ? AND state = ? AND exceeded = 0 ORDER BY id DESC LIMIT 1"
      ).get(train.id, train.status);
      if (timing) {
        const entered = new Date(timing.entered_at).getTime();
        const elapsed = (this.simulation ? this.simulation.getSimulatedNow().getTime() : Date.now()) - entered;
        if (elapsed >= (window.duration * 1000)) {
          shouldProgress = true;
        }
      }
    }

    if (shouldProgress && window.autoState) {
      try {
        this.eventEngine.fireStateChange(train.id, window.autoState, "automation", { rule: "time_progression" });
        logger.info({ trainId: train.id, from: train.status, to: window.autoState }, "Auto-progression");
      } catch (err) {
        logger.error({ err, trainId: train.id }, "Auto-progression failed");
      }
    }
  }

  // ==================== DELAY DETECTION ====================

  _evaluateDelayDetection() {
    const simNow = this.simulation ? this.simulation.getSimulatedNow() : new Date();
    const simMinutes = simNow.getHours() * 60 + simNow.getMinutes();

    const trains = this.db.prepare(
      "SELECT * FROM trains WHERE status NOT IN ('CANCELLED', 'FINISHED', 'DEPARTED', 'ARRIVED', 'DELAYED') AND station_id IS NOT NULL"
    ).all();

    for (const train of trains) {
      const expectedMin = this._parseTimeToMinutes(train.expected_time);
      if (expectedMin == null) continue;

      const diffMs = (expectedMin - simMinutes) * 60 * 1000;
      // If expected_time has passed by more than 3 minutes, auto-delay
      if (diffMs < -180000) {
        // Check if the train is still in an early state
        const earlyStates = ["SCHEDULED", "APPROACHING", "ARRIVING"];
        if (earlyStates.includes(train.status)) {
          const delayMinutes = Math.round(Math.abs(diffMs) / 60000);
          try {
            this.eventEngine.fireStateChange(train.id, "DELAYED", "automation", { reason: "Detección automática de retraso", delayMinutes });
            // Update expected_time
            this.db.prepare("UPDATE trains SET expected_time = ?, delay_minutes = ?, delay_reason = ? WHERE id = ?")
              .run(this._addMinutes(train.expected_time, delayMinutes), delayMinutes, "Retraso automático", train.id);
            logger.info({ trainId: train.id, delayMinutes }, "Auto-delay detected");
          } catch (err) {
            logger.error({ err, trainId: train.id }, "Auto-delay failed");
          }
        }
      }
    }
  }

  // ==================== RULE EVALUATION ====================

  _evaluateTimeBasedRules() {
    const rules = this.db.prepare(
      "SELECT * FROM automation_rules WHERE enabled = 1 AND trigger_type IN ('time_based', 'periodic')"
    ).all();

    for (const rule of rules) {
      this._evaluateRule(rule);
    }
  }

  _evaluateRule(rule) {
    // Cooldown check
    if (rule.last_evaluated && rule.cooldown_seconds > 0) {
      const elapsed = (Date.now() - new Date(rule.last_evaluated + "Z").getTime()) / 1000;
      if (elapsed < rule.cooldown_seconds) return;
    }

    let conditions;
    try { conditions = typeof rule.conditions === "string" ? JSON.parse(rule.conditions) : rule.conditions; }
    catch { return; }

    let actions;
    try { actions = typeof rule.actions === "string" ? JSON.parse(rule.actions) : rule.actions; }
    catch { return; }

    const trains = this.db.prepare("SELECT * FROM trains WHERE station_id IS NOT NULL").all();

    for (const train of trains) {
      if (this._matchConditions(conditions, train)) {
        this._executeActions(actions, train, rule.id);
      }
    }

    this.db.prepare("UPDATE automation_rules SET last_evaluated = datetime('now') WHERE id = ?").run(rule.id);
  }

  _matchConditions(conditions, train) {
    if (conditions.status && conditions.status !== train.status) return false;
    if (conditions.platform && conditions.platform !== train.platform) return false;
    if (conditions.train_type_id && Number(conditions.train_type_id) !== train.train_type_id) return false;
    if (conditions.station_id && Number(conditions.station_id) !== train.station_id) return false;
    if (conditions.operator_id && Number(conditions.operator_id) !== train.operator_id) return false;
    return true;
  }

  _executeActions(actions, train, ruleId) {
    for (const action of actions) {
      try {
        switch (action.type) {
          case "state_change":
            this.eventEngine.fireStateChange(train.id, action.to_state, "automation", { ruleId });
            break;
          case "platform_change":
            this.eventEngine.firePlatformChange(train.id, action.platform, action.sector || null, "automation");
            break;
          case "delay":
            this.eventEngine.fireStateChange(train.id, "DELAYED", "automation", { ruleId, reason: action.reason });
            break;
          case "log":
            logger.info({ trainId: train.id, ruleId, message: action.message }, "Automation rule action");
            break;
        }
      } catch (err) {
        logger.error({ err, trainId: train.id, ruleId }, "Automation rule action failed");
      }
    }
  }

  // ==================== TRIGGER HOOKS ====================

  onStateChange(trainId) {
    // Called when a state change happens — evaluate state_change rules
    const train = this.db.prepare("SELECT * FROM trains WHERE id = ?").get(trainId);
    if (!train) return;
    const rules = this.db.prepare(
      "SELECT * FROM automation_rules WHERE enabled = 1 AND trigger_type = 'state_change'"
    ).all();
    for (const rule of rules) {
      let conditions;
      try { conditions = typeof rule.conditions === "string" ? JSON.parse(rule.conditions) : rule.conditions; }
      catch { continue; }
      if (this._matchConditions(conditions, train)) {
        let actions;
        try { actions = typeof rule.actions === "string" ? JSON.parse(rule.actions) : rule.actions; }
        catch { continue; }
        this._executeActions(actions, train, rule.id);
      }
    }
  }

  // ==================== HELPERS ====================

  _parseTimeToMinutes(timeStr) {
    if (!timeStr) return null;
    const parts = timeStr.split(":");
    if (parts.length !== 2) return null;
    return Number(parts[0]) * 60 + Number(parts[1]);
  }

  _addMinutes(timeStr, minutes) {
    if (!timeStr) return timeStr;
    const parts = timeStr.split(":");
    let h = Number(parts[0]), m = Number(parts[1]) + minutes;
    while (m >= 60) { m -= 60; h++; }
    while (m < 0) { m += 60; h--; }
    h = ((h % 24) + 24) % 24;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  }

  _minutesFromNow(timeStr) {
    const now = new Date();
    const nowMin = now.getHours() * 60 + now.getMinutes();
    const timeMin = this._parseTimeToMinutes(timeStr);
    if (timeMin == null) return 0;
    return timeMin - nowMin;
  }
}

export default AutomationService;
