import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOCALES_DIR = path.resolve(__dirname, "../../locales");

const localeCache = {};

// Sanitize a locale key: only short latin language codes. Blocks path traversal
// (e.g. "../../private", "..%2F.."), separators, extensions and empty values.
const LOCALE_KEY_RE = /^[a-z]{2,3}$/;
function safeLocaleKey(language) {
  const lang = String(language || "").toLowerCase();
  if (!LOCALE_KEY_RE.test(lang)) return null;
  // Defensive: resolve and confirm it stays inside LOCALES_DIR
  const resolved = path.resolve(LOCALES_DIR, `${lang}.json`);
  if (!resolved.startsWith(path.resolve(LOCALES_DIR) + path.sep)) return null;
  return lang;
}

function loadLocale(language) {
  const lang = safeLocaleKey(language);
  if (!lang) return null;
  if (localeCache[lang]) return localeCache[lang];
  const filePath = path.join(LOCALES_DIR, `${lang}.json`);
  if (!fs.existsSync(filePath)) return null;
  const raw = fs.readFileSync(filePath, "utf8");
  localeCache[lang] = JSON.parse(raw);
  return localeCache[lang];
}

export function getLocaleContent(language) {
  const lang = safeLocaleKey(language);
  if (!lang) return null;
  const filePath = path.join(LOCALES_DIR, `${lang}.json`);
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

export function saveLocaleContent(language, data) {
  const lang = safeLocaleKey(language);
  if (!lang) return;
  const filePath = path.join(LOCALES_DIR, `${lang}.json`);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
  delete localeCache[lang];
}

export function getAvailableLocales() {
  if (!fs.existsSync(LOCALES_DIR)) return [];
  return fs
    .readdirSync(LOCALES_DIR)
    .filter((f) => f.endsWith(".json"))
    .map((f) => f.replace(".json", ""));
}

export function formatTimeForSpeech(time24, language) {
  if (!time24 || !/^\d{2}:\d{2}$/.test(time24)) return null;
  const locale = loadLocale(language);
  if (!locale) return time24;

  const [h, m] = time24.split(":").map(Number);
  const hourNum = Number(h);
  const minNum = Number(m);

  if (locale.time.format === "H12") {
    const period = hourNum >= 12 ? locale.time.pm : locale.time.am;
    const h12 = hourNum === 0 ? 0 : hourNum > 12 ? hourNum - 12 : hourNum;
    const hWord = locale.time.hours_12h?.[h12] || String(h12);
    if (minNum === 0) {
      if (h12 === 0) return `${locale.time.midnight}`;
      if (h12 === 12) return `${locale.time.noon}`;
      return `${hWord} ${period}`;
    }
    const mWord = locale.time.minutes?.[minNum] || String(minNum);
    if (minNum <= 9) return `${hWord} oh ${mWord} ${period}`;
    return `${hWord} ${mWord} ${period}`;
  }

  const hWord = locale.time.hours[hourNum] || String(hourNum);
  const mWord = locale.time.minutes[minNum] || String(minNum);

  if (minNum === 0) {
    return `${hWord} ${locale.time.hour}`;
  }

  if (minNum === 1) {
    return `${hWord} ${locale.time.hour} ${locale.time.and} ${mWord} ${locale.time.minute_singular}`;
  }

  const minuteLabel = locale.time.minute || locale.time.minutes || "minutos";
  return `${hWord} ${locale.time.hour} ${locale.time.and} ${mWord} ${minuteLabel}`;
}

export function formatLocalizedList(items, language) {
  if (!items || items.length === 0) return "";
  const locale = loadLocale(language);
  const andWord = locale?.conjunctions?.and || "and";
  const comma = locale?.conjunctions?.comma || ", ";

  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} ${andWord} ${items[1]}`;
  return items.slice(0, -1).join(comma) + ` ${andWord} ${items.slice(-1)[0]}`;
}

function getServiceIntro(train, locale) {
  const isCommuter = /^(C(-\d+)?|R\d+[A-Z]?)$/i.test(train.type_code || train.line || "");
  const isRegional = /^(MD|REGIONAL|R-\d+|REG-\d+)/i.test(train.type_code || "");
  const isLongDistance = /^(AVE|ALVIA|EUROMED|INTERCITY|IC)/i.test(train.type_code || "");
  const isHighSpeed = /^(AVE|AVLO|IRYO|OUIGO)/i.test(train.type_code || "");

  let serviceType = train.type_name || train.service || "";
  let operator = train.operator_name || train.operator || "";
  let line = train.line || train.type_code || "";

  let template = locale?.service_intro?.default || "{service_type}";
  if (isCommuter && locale?.service_intro?.commuter)
    template = locale.service_intro.commuter;
  else if (isRegional && locale?.service_intro?.regional)
    template = locale.service_intro.regional;
  else if (isHighSpeed && locale?.service_intro?.high_speed)
    template = locale.service_intro.high_speed;
  else if (isLongDistance && locale?.service_intro?.long_distance)
    template = locale.service_intro.long_distance;

  return template
    .replace("{line}", line)
    .replace("{service_type}", serviceType)
    .replace("{operator}", operator)
    .replace("{service}", train.commercialService || train.service || "");
}

function buildStandingBlock(train, locale) {
  if (!train.platform || train.platform === "-") return null;
  const hasSector = train.sector && train.sector !== "-";
  const tmplKey = hasSector ? "standing_at_platform_sector" : "standing_at_platform";
  const tmpl = locale?.blocks?.[tmplKey];
  if (!tmpl) return null;
  return tmpl
    .replace("{platform}", train.platform)
    .replace("{sector}", train.sector || "");
}

function buildDelayedBlock(train, locale) {
  if (!train.delay && !train.delayMinutes) return null;
  const minutes = train.delay || train.delayMinutes || 0;
  if (train.delayReason) {
    const tmpl = locale?.blocks?.delayed_reason || "{minutes} minutos de retraso por {reason}";
    return tmpl.replace("{minutes}", String(minutes)).replace("{reason}", train.delayReason);
  }
  const tmpl = locale?.blocks?.delayed || "{minutes} minutos de retraso";
  return tmpl.replace("{minutes}", String(minutes));
}

function buildCancelledBlock(train, locale) {
  const tmpl = train.cancelReason
    ? locale?.blocks?.cancelled_reason || "cancelado por {reason}"
    : locale?.blocks?.cancelled || "cancelado";
  return tmpl
    .replace("{reason}", train.cancelReason || "")
    .trim();
}

function buildPlatformBlock(train, locale, eventType) {
  if (!train.platform || train.platform === "-" || train.platform === "?") return null;
  if (eventType === "PLATFORM_CHANGE") {
    const hasSector = train.sector && train.sector !== "-";
    const tmplKey = hasSector ? "platform_changed_sector" : "platform_changed";
    const tmpl = locale?.blocks?.[tmplKey];
    return tmpl
      .replace("{platform}", train.platform)
      .replace("{sector}", train.sector || "");
  }
  const hasSector = train.sector && train.sector !== "-";
  const tmplKey = hasSector ? "platform_sector" : "platform";
  const tmpl = locale?.blocks?.[tmplKey];
  if (!tmpl) return `vía ${train.platform}`;
  return tmpl
    .replace("{platform}", train.platform)
    .replace("{sector}", train.sector || "");
}

function buildDepartureTimeBlock(train, language, locale) {
  const time = train.departureTime || train.scheduled_time || train.scheduledDeparture;
  if (!time) return null;
  const speechTime = formatTimeForSpeech(time, language);
  if (!speechTime) return null;
  return speechTime;
}

function buildStoppingPatternBlock(train, language) {
  const locale = loadLocale(language);
  if (!locale?.stopping_patterns) return null;

  const pattern = train.stoppingPattern || train.stopPattern;
  const stops = train.stops || train.intermediateStops || [];

  if (pattern === "ALL_STATIONS") {
    return locale.stopping_patterns.ALL_STATIONS + ".";
  }
  if (pattern === "DIRECT") {
    return locale.stopping_patterns.DIRECT + ".";
  }
  if (pattern === "SEMI_FAST") {
    return locale.stopping_patterns.SEMI_FAST + ".";
  }
  if (pattern === "ALL_EXCEPT") {
    const exceptStations = train.exceptStations || [];
    if (exceptStations.length > 0) {
      const st = formatLocalizedList(exceptStations, language);
      return (locale.stopping_patterns.ALL_EXCEPT || "Para en todas excepto {stations}").replace("{stations}", st) + ".";
    }
  }
  if (pattern === "ONLY_STOPS_AT") {
    if (stops.length > 0) {
      const st = formatLocalizedList(stops, language);
      return (locale.stopping_patterns.ONLY_STOPS_AT || "Solo para en {stations}").replace("{stations}", st) + ".";
    }
  }
  if (pattern === "CUSTOM" && train.stoppingPatternDescription) {
    return (locale.stopping_patterns.CUSTOM || "{description}").replace("{description}", train.stoppingPatternDescription) + ".";
  }

  if (Array.isArray(stops) && stops.length > 0) {
    const st = formatLocalizedList(stops, language);
    return (locale.stopping_patterns.intermediate || "Efectúa parada en {stations}").replace("{stations}", st) + ".";
  }

  return null;
}

function buildFareRestrictionBlock(train, language) {
  const locale = loadLocale(language);
  if (!locale?.fare_restrictions) return null;

  const fare = train.fareRestrictions || train.fare_restrictions;
  if (!fare) return null;

  const items = [];
  if (fare.commuterTicketsAccepted === false) items.push(locale.fare_restrictions.commuter_tickets_not_accepted);
  if (fare.commuterPassesAccepted === false) items.push(locale.fare_restrictions.commuter_passes_not_accepted);
  if (fare.regionalTicketsAccepted === false) items.push(locale.fare_restrictions.regional_tickets_not_accepted);
  if (fare.regionalPassesAccepted === false) items.push(locale.fare_restrictions.regional_passes_not_accepted);

  if (items.length >= 3) {
    return locale.fare_restrictions.none_accepted || "";
  }
  if (items.length > 0) {
    const formatted = formatLocalizedList(items, language);
    const tmpl = locale.fare_restrictions.some_not_accepted || "";
    return tmpl.replace("{items}", formatted);
  }

  if (fare.reservationRequired) return locale.fare_restrictions.reservation_required;
  if (fare.supplementRequired) return locale.fare_restrictions.supplement_required;
  if (fare.specificTicketRequired) return locale.fare_restrictions.specific_ticket_required;

  return null;
}

function buildClosingBlock(train, language) {
  const locale = loadLocale(language);
  if (!locale?.closing_messages) return null;

  const op = train.operator_name || train.operator || "";
  const isRenfe = /renfe/i.test(op);
  const isLongDistance = /^(AVE|ALVIA|EUROMED|INTERCITY|IC|LARGA\s*DISTANCIA)/i.test(train.type_code || "");

  if (isRenfe && isLongDistance) {
    const tmpl = locale.closing_messages.renfe_long_distance;
    if (tmpl) return tmpl;
  }
  if (isLongDistance && locale.closing_messages.long_distance) {
    return locale.closing_messages.long_distance.replace("{operator}", op);
  }
  if (locale.closing_messages.operator) {
    return locale.closing_messages.operator.replace("{operator}", op);
  }
  return null;
}

function buildAccessibilityBlock(train, language) {
  const locale = loadLocale(language);
  if (!locale?.accessibility) return null;
  if (train.accessible === true || train.accessibility === true) {
    return locale.accessibility.accessible || "";
  }
  return null;
}

export function composeAnnouncement(train, eventType, language) {
  const locale = loadLocale(language);
  if (!locale) return null;

  const eventConfig = locale.events?.[eventType];
  if (!eventConfig) return null;

  const serviceIntro = getServiceIntro(train, locale);
  const destinationBlock = locale.blocks?.destination || "";
  const originBlock = locale.blocks?.origin || "";
  const platformBlock = buildPlatformBlock(train, locale, eventType);
  const standingBlock = buildStandingBlock(train, locale);
  const platformChangedBlock = eventType === "PLATFORM_CHANGE" ? buildPlatformBlock(train, locale, eventType) : null;
  const delayedBlock = buildDelayedBlock(train, locale);
  const cancelledBlock = buildCancelledBlock(train, locale);
  const departureTimeBlock = buildDepartureTimeBlock(train, language, locale);
  const stoppingPatternBlock = buildStoppingPatternBlock(train, language);
  const fareRestrictionBlock = buildFareRestrictionBlock(train, language);
  const closingBlock = buildClosingBlock(train, language);
  const accessibilityBlock = buildAccessibilityBlock(train, language);

  const platformVal = train.platform && train.platform !== "-" && train.platform !== "?" ? train.platform : null;
  const isAtPlatform = standingBlock || (platformVal ? `a la vía ${platformVal}` : null);

  const vars = {
    service_intro: serviceIntro || "",
    destination: train.destination || train.destination_name || "",
    origin: train.origin || train.origin_name || "",
    platform: train.platform && train.platform !== "-" ? train.platform : "",
    sector: train.sector || "",
    platform_sector: platformBlock || "",
    platform_changed: platformChangedBlock || "",
    is_at_platform: standingBlock || "",
    time: departureTimeBlock || "",
    delayed: delayedBlock || "",
    cancelled: cancelledBlock || "",
    stopping_pattern: stoppingPatternBlock || "",
    fare_restriction: fareRestrictionBlock || "",
    closing_message: closingBlock || "",
    accessible: accessibilityBlock || "",
    line: train.line || train.type_code || "",
    operator: train.operator_name || train.operator || "",
    service: train.commercialService || train.service || "",
    service_type: train.type_name || "",
    train: train.number || "",
    message: train.message || "",
    reason: train.reason || train.delayReason || "",
  };

  let template;
  const isCommuter = /^(C(-\d+)?|R\d+[A-Z]?)$/i.test(train.type_code || train.line || "");
  if (eventType === "TRAIN_ANNOUNCEMENT") {
    if (train.isDeparture !== false) {
      if (isCommuter && eventConfig.compact_departure) template = eventConfig.compact_departure;
      else template = eventConfig.departure || eventConfig.compact_departure;
    } else {
      if (isCommuter && eventConfig.compact_arrival) template = eventConfig.compact_arrival;
      else template = eventConfig.arrival || eventConfig.compact_arrival;
    }
  } else if (standingBlock && standingBlock.length > 0 && eventConfig.standing) {
    template = eventConfig.standing;
  } else {
    template = eventConfig.default || "";
  }

  // Upgrade to with_stops / with_fare variant if data is available
  if (stoppingPatternBlock && eventConfig.with_stops) {
    template = eventConfig.with_stops;
  }
  if (fareRestrictionBlock && eventConfig.with_fare) {
    template = eventConfig.with_fare;
  }

  let text = template;
  for (const [key, value] of Object.entries(vars)) {
    if (!value) {
      text = text.replace(new RegExp(`,\\s*\\{${key}\\}`, "g"), "");
      text = text.replace(new RegExp(`\\{${key}\\},\\s*`, "g"), "");
      text = text.replace(new RegExp(`\\{${key}\\}`, "g"), "");
    } else {
      text = text.replace(new RegExp(`\\{${key}\\}`, "g"), value);
    }
  }

  text = text.replace(/\s+/g, " ").trim();
  text = text.replace(/,\s*(?:amb sortida|con salida|departing)\s+(?:a\s+(?:les|las)|at)\s*[.,]/gi, "");
  text = text.replace(/\s+(?:a\s+(?:les|las)|at)\s*[.,]/gi, "");
  text = text.replace(/,+\s*\./g, ".");
  text = text.replace(/\s*\.\s*/g, ". ");
  text = text.replace(/(\.\s*){2,}/g, ". ");
  text = text.replace(/\s+/g, " ").trim();
  if (text && !text.endsWith(".")) text += ".";

  if (accessibilityBlock && !text.includes(accessibilityBlock)) {
    text += ` ${accessibilityBlock}`;
  }
  if (closingBlock && !text.includes(closingBlock)) {
    text += ` ${closingBlock}`;
  }

  return text;
}

export function composeAnnouncements(train, eventType, languages) {
  const result = {};
  for (const lang of languages) {
    const text = composeAnnouncement(train, eventType, lang);
    if (text) result[lang] = text;
  }
  return result;
}

export function testCompose(data) {
  const languages = data.languages || ["ca", "es", "en"];
  const eventType = data.eventType || "LONG_DISTANCE_DEPARTURE_ANNOUNCEMENT";
  const train = data.train || data;
  return composeAnnouncements(train, eventType, languages);
}
