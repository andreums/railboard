import logger from "../logger.js";

export function resolveAnnouncementSound(train, eventType, db) {
  const rules = db
    .prepare(
      `SELECT r.*, a.file_path as asset_path, a.name as asset_name
       FROM announcement_sound_rules r
       LEFT JOIN audio_assets a ON a.id = r.sound_id
       WHERE r.enabled = 1
       ORDER BY r.priority ASC`
    )
    .all();

  const stationId = train.station_id;
  const operatorId = train.operator_id;
  const operatorName = train.operator_name || train.operator || "";
  const typeCode = train.type_code || train.type_name || "";
  const commercialService = train.commercialService || train.service || "";
  const serviceType = train.serviceType || "";

  const candidates = [];

  for (const rule of rules) {
    let match = true;
    const config = safeParseMatchConfig(rule.match_config);

    if (config.station_id && Number(config.station_id) !== Number(stationId)) match = false;
    if (config.operator_id && Number(config.operator_id) !== Number(operatorId)) match = false;
    if (config.operator && !operatorName.toLowerCase().includes(config.operator.toLowerCase())) match = false;
    if (config.commercial_service && !commercialService.toLowerCase().includes(config.commercial_service.toLowerCase())) match = false;
    if (config.service_type && !serviceType.toLowerCase().includes(config.service_type.toLowerCase())) match = false;
    if (config.train_type_code && !typeCode.toLowerCase().includes(config.train_type_code.toLowerCase())) match = false;
    if (config.event_type && config.event_type !== eventType) match = false;

    if (match) {
      candidates.push(rule);
    }
  }

  if (candidates.length === 0) {
    return { soundId: null, ruleId: null, assetPath: null, soundMode: "SINGLE", delayAfterSoundMs: 600, delayBetweenLanguagesMs: 1000, soundVolume: 1.0 };
  }

  const best = candidates.reduce((a, b) => (a.priority < b.priority ? a : b));

  if (!best.asset_path) {
    return { soundId: null, ruleId: best.id, assetPath: null, soundMode: best.sound_mode || "SINGLE", delayAfterSoundMs: best.delay_after_sound_ms || 600, delayBetweenLanguagesMs: best.delay_between_languages_ms || 1000, soundVolume: best.sound_volume || 1.0 };
  }

  return {
    soundId: best.sound_id,
    ruleId: best.id,
    assetPath: best.asset_path,
    soundMode: best.sound_mode || "SINGLE",
    delayAfterSoundMs: best.delay_after_sound_ms || 600,
    delayBetweenLanguagesMs: best.delay_between_languages_ms || 1000,
    soundVolume: best.sound_volume || 1.0,
    ruleMatch: best.match_config,
  };
}

function safeParseMatchConfig(raw) {
  if (!raw) return {};
  try {
    return typeof raw === "string" ? JSON.parse(raw) : raw;
  } catch {
    return {};
  }
}

export function createDefaultSoundRules(db) {
  const existing = db.prepare("SELECT COUNT(*) as count FROM announcement_sound_rules").get()?.count || 0;
  if (existing > 0) return;

  const stmt = db.prepare(
    `INSERT INTO announcement_sound_rules (priority, match_config, sound_id, sound_mode, delay_after_sound_ms, delay_between_languages_ms, enabled)
     VALUES (?, ?, ?, ?, ?, ?, 1)`
  );

  stmt.run(100, JSON.stringify({ service_type: "COMMUTER" }), null, "SINGLE", 500, 800);
  stmt.run(200, JSON.stringify({ service_type: "REGIONAL" }), null, "SINGLE", 600, 1000);
  stmt.run(300, JSON.stringify({ service_type: "LONG_DISTANCE" }), null, "SINGLE", 800, 1200);
  stmt.run(400, JSON.stringify({}), null, "SINGLE", 600, 1000);

  logger.info("Default sound rules created");
}
