import { readFileSync, writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const localesDir = resolve(__dirname, "../locales");

const MISSING_EVENTS = {
  COMPACT_SERVICE_ANNOUNCEMENT: {
    default: "{service_intro} amb destinació {destination}, {platform_sector}.",
    departure: "{service_intro} amb destinació {destination}, {platform_sector}.",
    arrival: "{service_intro} procedent de {origin}, {platform_sector}.",
  },
  TRAIN_ARRIVING: {
    default: "{service_intro} procedent de {origin} està entrant a {platform_sector}.",
  },
  TRAIN_READY_FOR_BOARDING: {
    default: "{service_intro} amb destinació {destination}, {platform_sector}. Es prega als viatgers que es preparin per pujar.",
    accessible: "{service_intro} accessible amb destinació {destination}, {platform_sector}. Es prega als viatgers que es preparin per pujar.",
  },
  TRAIN_DEPARTING: {
    default: "{service_intro} amb destinació {destination} està sortint de {platform_sector}.",
  },
};

function load(lang) { return JSON.parse(readFileSync(resolve(localesDir, `${lang}.json`), "utf-8")); }
function save(lang, data) { writeFileSync(resolve(localesDir, `${lang}.json`), JSON.stringify(data, null, 2) + "\n", "utf-8"); }

// Base templates per language
const BASES = {
  ca: MISSING_EVENTS,
  en: {
    COMPACT_SERVICE_ANNOUNCEMENT: {
      default: "{service_intro} to {destination}, {platform_sector}.",
      departure: "{service_intro} to {destination}, {platform_sector}.",
      arrival: "{service_intro} from {origin}, {platform_sector}.",
    },
    TRAIN_ARRIVING: { default: "{service_intro} from {origin} is arriving at {platform_sector}." },
    TRAIN_READY_FOR_BOARDING: { default: "{service_intro} to {destination}, {platform_sector}. Passengers please prepare to board.", accessible: "Accessible {service_intro} to {destination}, {platform_sector}. Passengers please prepare to board." },
    TRAIN_DEPARTING: { default: "{service_intro} to {destination} is departing from {platform_sector}." },
  },
  es: {
    COMPACT_SERVICE_ANNOUNCEMENT: {
      default: "{service_intro} con destino a {destination}, {platform_sector}.",
      departure: "{service_intro} con destino a {destination}, {platform_sector}.",
      arrival: "{service_intro} procedente de {origin}, {platform_sector}.",
    },
    TRAIN_ARRIVING: { default: "{service_intro} procedente de {origin} está entrando en {platform_sector}." },
    TRAIN_READY_FOR_BOARDING: { default: "{service_intro} con destino a {destination}, {platform_sector}. Se ruega a los viajeros que se preparen para embarcar.", accessible: "{service_intro} accesible con destino a {destination}, {platform_sector}. Se ruega a los viajeros que se preparen para embarcar." },
    TRAIN_DEPARTING: { default: "{service_intro} con destino a {destination} está saliendo de {platform_sector}." },
  },
  eu: {
    COMPACT_SERVICE_ANNOUNCEMENT: {
      default: "{service_intro} {destination} helmugarekin, {platform_sector}.",
      departure: "{service_intro} {destination} helmugarekin, {platform_sector}.",
      arrival: "{service_intro} {origin}tik, {platform_sector}.",
    },
    TRAIN_ARRIVING: { default: "{service_intro} {origin}tik iristen ari da {platform_sector}." },
    TRAIN_READY_FOR_BOARDING: { default: "{service_intro} {destination} helmugarekin, {platform_sector}. Bidaiariak prestatu ontziratzeko.", accessible: "{service_intro} irisgarria {destination} helmugarekin, {platform_sector}. Bidaiariak prestatu ontziratzeko." },
    TRAIN_DEPARTING: { default: "{service_intro} {destination} helmugarekin irteten ari da {platform_sector}." },
  },
  gl: {
    COMPACT_SERVICE_ANNOUNCEMENT: {
      default: "{service_intro} con destino a {destination}, {platform_sector}.",
      departure: "{service_intro} con destino a {destination}, {platform_sector}.",
      arrival: "{service_intro} procedente de {origin}, {platform_sector}.",
    },
    TRAIN_ARRIVING: { default: "{service_intro} procedente de {origin} está entrando en {platform_sector}." },
    TRAIN_READY_FOR_BOARDING: { default: "{service_intro} con destino a {destination}, {platform_sector}. Rógase aos viaxeiros que se preparen para embarcar.", accessible: "{service_intro} accesible con destino a {destination}, {platform_sector}. Rógase aos viaxeiros que se preparen para embarcar." },
    TRAIN_DEPARTING: { default: "{service_intro} con destino a {destination} está saíndo de {platform_sector}." },
  },
  va: {
    COMPACT_SERVICE_ANNOUNCEMENT: {
      default: "{service_intro} amb destinació a {destination}, {platform_sector}.",
      departure: "{service_intro} amb destinació a {destination}, {platform_sector}.",
      arrival: "{service_intro} procedent de {origin}, {platform_sector}.",
    },
    TRAIN_ARRIVING: { default: "{service_intro} procedent de {origin} està entrant en {platform_sector}." },
    TRAIN_READY_FOR_BOARDING: { default: "{service_intro} amb destinació a {destination}, {platform_sector}. Es prega als viatgers que es preparen per a embarcar.", accessible: "{service_intro} accessible amb destinació a {destination}, {platform_sector}. Es prega als viatgers que es preparen per a embarcar." },
    TRAIN_DEPARTING: { default: "{service_intro} amb destinació a {destination} està eixint de {platform_sector}." },
  },
};

for (const lang of Object.keys(BASES)) {
  const data = load(lang);
  if (!data.events) data.events = {};
  let count = 0;
  for (const [eventType, templates] of Object.entries(BASES[lang])) {
    if (!data.events[eventType]) {
      data.events[eventType] = templates;
      count++;
      console.log(`  + ${lang}.events.${eventType}`);
    }
  }
  if (count > 0) {
    save(lang, data);
    console.log(`${lang}: added ${count} missing event types`);
  } else {
    console.log(`${lang}: all present`);
  }
}
