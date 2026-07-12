import { Router } from "express";
import basicAuth from "express-basic-auth";
import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";
import {
  db,
  getConfig, setConfig,
  listTrains, createTrain, updateTrain, deleteTrain, getTrain,
  addMinutes,
  operators, trainTypes, places, stations, trainIcons, countStations,
  getStationDisplayConfig, setStationDisplayConfig, listStationDisplayConfigs,
  services, serviceStops, serviceEvents,
} from "./db.js";
import SEED_FIXTURES from "./fixtures/seedTrains.js";
import { broadcast } from "./ws.js";
import { getAllRoutes, getAvailableRegions, reloadRoutesDataset } from "./services/routeService.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "railboard";

const adminAuth = basicAuth({
  users: { admin: ADMIN_PASSWORD },
  challenge: true,
  realm: "Railboard Admin",
});

const storage = multer.diskStorage({
  destination: path.resolve(__dirname, "../uploads"),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowedMimes = ["image/png", "image/jpeg", "image/gif", "image/webp", "image/svg+xml"];
    const allowedExts = [".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg"];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedMimes.includes(file.mimetype) && allowedExts.includes(ext)) {
      cb(null, true);
    } else {
      const err = new Error("Tipo de archivo no permitido. Solo imágenes (PNG, JPG, GIF, WebP, SVG).");
      err.code = "FILE_TYPE_NOT_ALLOWED";
      cb(err, false);
    }
  },
});

const uploadAudio = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowedMimes = ["audio/ogg", "audio/opus", "audio/mpeg"];
    const allowedExts = [".ogg", ".opus", ".mp3"];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedMimes.includes(file.mimetype) || allowedExts.includes(ext)) {
      cb(null, true);
    } else {
      const err = new Error("Tipo de archivo no permitido. Solo OGG / Opus / MP3.");
      err.code = "FILE_TYPE_NOT_ALLOWED";
      cb(err, false);
    }
  },
});

const r = Router();
const ping = () => broadcast({ type: "update", at: Date.now() });

// RODALIA_ROUTES moved to ./fixtures/routes.js

function ensureLearnedRailData() {
  const railRoutes = getAllRoutes();
  const baseOperators = ["Renfe", "Iryo", "Ouigo", "SNCF"];
  const knownOperators = new Set(operators.list().map((o) => o.name));
  for (const opName of baseOperators) {
    if (!knownOperators.has(opName)) {
      operators.create({ name: opName });
      knownOperators.add(opName);
    }
  }

  const knownTypes = trainTypes.list().map((t) => t.code);
  for (const route of railRoutes) {
    if (!knownTypes.includes(route.code)) {
      trainTypes.create({ code: route.code, name: route.name, color: route.color });
    }
  }

  const knownPlaces = new Set(places.list().map((p) => p.name));
  for (const route of railRoutes) {
    for (const station of route.stations) {
      if (!knownPlaces.has(station)) {
        places.create({ name: station });
        knownPlaces.add(station);
      }
    }
  }
}

const normalizeStation = (value) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/estacio/g, "estacion")
    .replace(/valencia[-\s]*estacio(n)? del nord/g, "valencia nord")
    .replace(/valencia estacion del nord/g, "valencia nord")
    .replace(/barcelona[-\s]*sants/g, "barcelona sants")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const stationIndex = (stations, name) => {
  const target = normalizeStation(name);
  return stations.findIndex((station) => normalizeStation(station) === target);
};

const isTruthy = (value) => value === true || value === 1 || value === "1" || value === "true";

const normalizeChoiceBounds = (minRaw, maxRaw) => {
  const min = String(minRaw ?? "").trim();
  const max = String(maxRaw ?? "").trim();
  if (!min && !max) return [];
  if (min && max && /^\d+$/.test(min) && /^\d+$/.test(max)) {
    const start = Number(min);
    const end = Number(max);
    const [lo, hi] = start <= end ? [start, end] : [end, start];
    const width = Math.max(min.length, max.length);
    return Array.from({ length: hi - lo + 1 }, (_, idx) => String(lo + idx).padStart(width, "0"));
  }
  if (min && max && min.length === 1 && max.length === 1) {
    const start = min.toUpperCase().charCodeAt(0);
    const end = max.toUpperCase().charCodeAt(0);
    const [lo, hi] = start <= end ? [start, end] : [end, start];
    return Array.from({ length: hi - lo + 1 }, (_, idx) => String.fromCharCode(lo + idx));
  }
  return [min || max].filter(Boolean);
};

const choiceFromConfig = (config, key, fallback = []) => {
  const min = config?.[`${key}Min`];
  const max = config?.[`${key}Max`];
  const allowEmpty = isTruthy(config?.[`${key}AllowEmpty`]);
  const choices = normalizeChoiceBounds(min, max);
  if (choices.length === 0) return allowEmpty ? [""] : [...fallback];
  return allowEmpty ? ["", ...choices] : choices;
};

const getRouteRegion = (route) => {
  const haystack = normalizeStation(`${route.network} ${route.name}`);
  if (haystack.includes("valencia")) return "Comunitat Valenciana";
  if (haystack.includes("catalunya") || haystack.includes("cataluna")) return "Catalunya";
  if (haystack.includes("madrid")) return "Comunidad de Madrid";
  if (haystack.includes("murcia") || haystack.includes("alicante")) return "Región de Murcia / Alicante";
  if (haystack.includes("sevilla")) return "Andalucía (Sevilla)";
  if (haystack.includes("san sebastian")) return "País Vasco (San Sebastián)";
  if (haystack.includes("zaragoza")) return "Aragón";
  if (haystack.includes("cantabria")) return "Cantabria";
  if (haystack.includes("asturias")) return "Asturias";
  if (haystack.includes("bilbao")) return "País Vasco (Bilbao)";
  if (haystack.includes("galicia") || haystack.includes("ferrol")) return "Galicia";
  return route.network;
};

function orderedIntermediateStops(stations, fromIndex, toIndex) {
  if (fromIndex === toIndex) return [];
  const step = fromIndex < toIndex ? 1 : -1;
  const stops = [];
  for (let i = fromIndex + step; i !== toIndex; i += step) {
    stops.push(stations[i]);
  }
  return stops;
}

const minutesFromHHMM = (hhmm) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

const clockBaseFromConfig = (config) => {
  if (config?.clockMode !== "fake") return new Date();
  const [h = 12, m = 0, s = 0] = String(config.clockFakeTime || "12:00:00")
    .split(":")
    .map((part) => Number(part));
  const d = new Date();
  d.setHours(Number.isFinite(h) ? h : 12, Number.isFinite(m) ? m : 0, Number.isFinite(s) ? s : 0, 0);
  return d;
};

const hhmmFromOffsetAt = (baseDate, offsetMin) => {
  const d = new Date(baseDate.getTime() + offsetMin * 60_000);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

const minutesUntilHHMM = (hhmm, baseDate = new Date()) => {
  let diff = minutesFromHHMM(hhmm) - (baseDate.getHours() * 60 + baseDate.getMinutes());
  if (diff < -12 * 60) diff += 24 * 60;
  if (diff > 12 * 60) diff -= 24 * 60;
  return diff;
};

const SUPPORTED_LANGUAGES = new Set(["es", "ca", "en", "fr", "eu", "gl"]);

const OBSERVATION_BANK = {
  es: {
    generic: [
      "Sin incidencias",
      "Servicio habitual",
      "Operación normal",
      "Material revisado",
      "Salida prevista según horario",
      "Servicio reforzado por demanda",
      "Tren con alta ocupación prevista",
      "Circulación con normalidad",
      "Servicio sin novedades",
      "Tren revisado y listo",
      "Personal a bordo completo",
      "Condiciones de viaje habituales",
      "Tren preparado para salida",
      "Conexiones garantizadas",
      "Servicio de temporada activo",
      "Refuerzo de personal en estación",
      "Tren con servicio de cafetería",
    ],
    service: [
      "Por trabajos de mantenimiento en la infraestructura",
      "Debido a obras en el corredor",
      "Servicio sujeto a regulación de tráfico",
      "Afectado por circulación densa en el tramo central",
      "Cambio puntual de material por necesidades operativas",
      "Parada reforzada en estaciones intermedias",
      "Por obras de modernización en la vía",
      "Servicio afectado por obras de electrificación",
      "Por renovación de catenaria en el trayecto",
      "Adaptación temporal por obras estacionales",
      "Por mejora de la accesibilidad en andenes",
      "Cambio de material rodante por mantenimiento programado",
      "Afectado por trabajos de señalización",
      "Por sustitución de traviesas en el tramo",
      "Desvío provisional por obras en la estación",
      "Por obras de soterramiento en el casco urbano",
    ],
    delay: [
      "Retraso por incidencia en la infraestructura",
      "Retraso por acumulación de tráfico ferroviario",
      "Retraso por avería de material",
      "Retraso por maniobras de regulación",
      "Demora por intervención técnica",
      "Retraso por incidencia en la catenaria",
      "Retraso por cruce de trenes en vía única",
      "Demora por operaciones de estacionamiento",
      "Retraso por revisión extraordinaria de seguridad",
      "Retraso por alta densidad de viajeros en origen",
      "Demora por procedimientos de seguridad en estación",
      "Retraso por incidencia en el sistema de bordo",
      "Demora por espera de correspondencia",
      "Retraso por baja visibilidad en el trayecto",
    ],
    platform: [
      "Se confirma vía asignada en panel",
      "Posible cambio de vía por regulación de tráfico",
      "Asignación de vía sujeta a última hora",
      "Vía confirmada por megafonía",
      "Cambio de vía por obras en andén contiguo",
      "Por obras en la vía habitual, acceso por andén alternativo",
      "Estacionamiento en vía provisional por eventos en la estación",
      "Compruebe el panel informativo para posible cambio de vía",
      "Vía asignada momentáneamente por operativa de tráfico",
    ],
    status: [
      "Embarque en curso por puertas 1-4",
      "Última llamada para viajeros con destino a bordo",
      "Puertas de acceso abiertas",
      "Personal de a bordo esperando en andén",
      "Tren listo para recibir viajeros",
      "Cancelado por incidencias técnicas",
      "Cancelado por condiciones meteorológicas adversas",
      "Cancelado por huelga en el sector",
      "Cancelado por obras de emergencia en la vía",
      "Transbordo organizado por carretera",
    ],
    info: [
      "Recuerden validar su billete antes de subir",
      "Atención al llegar a su destino por posible cambio de andén",
      "Mantengan su equipaje controlado en todo momento",
      "Próxima estación con correspondencia de metro",
      "Tren con espacio para bicicletas disponible",
      "Servicio de asistencia disponible para movilidad reducida",
      "Tren con zona de silencio en coches centrales",
      "Se ruega cedan el asiento a personas con movilidad reducida",
    ],
  },
  ca: {
    generic: [
      "Sense incidències",
      "Servei habitual",
      "Operació normal",
      "Material revisat",
      "Sortida prevista segons horari",
      "Servei reforçat per demanda",
      "Tren amb alta ocupació prevista",
      "Circulació amb normalitat",
      "Servei sense novetats",
      "Tren revisat i a punt",
      "Personal a bord complet",
      "Condicions de viatge habituals",
      "Tren preparat per a la sortida",
      "Connexions garantides",
      "Servei de temporada actiu",
      "Reforç de personal a l'estació",
    ],
    service: [
      "Per treballs de manteniment a la infraestructura",
      "A causa d'obres al corredor",
      "Servei sotmès a regulació de trànsit",
      "Afectat per circulació densa al tram central",
      "Canvi puntual de material per necessitats operatives",
      "Parada reforçada en estacions intermèdies",
      "Per obres de modernització a la via",
      "Servei afectat per obres d'electrificació",
      "Per renovació de catenària al trajecte",
      "Adaptació temporal per obres estacionals",
      "Per millora de l'accessibilitat als andanes",
      "Canvi de material rodant per manteniment programat",
      "Afectat per treballs de senyalització",
      "Desviament provisional per obres a l'estació",
    ],
    delay: [
      "Retard per incidència a la infraestructura",
      "Retard per acumulació de trànsit ferroviari",
      "Retard per avaria de material",
      "Retard per maniobres de regulació",
      "Demora per intervenció tècnica",
      "Retard per incidència a la catenària",
      "Retard per encreuament de trens en via única",
      "Demora per operacions d'estacionament",
      "Retard per revisió extraordinària de seguretat",
      "Retard per alta densitat de viatgers a l'origen",
      "Retard per incidència al sistema de bord",
      "Demora per espera de correspondència",
    ],
    platform: [
      "Via assignada confirmada al panell",
      "Possible canvi de via per regulació de trànsit",
      "Assignació de via subjecta a última hora",
      "Via confirmada per megafonia",
      "Canvi de via per obres a l'andana contigua",
      "Per obres a la via habitual, accés per andana alternativa",
      "Comproveu el panell informatiu per a possible canvi de via",
    ],
    status: [
      "Embarque en curs per portes 1-4",
      "Darrera crida per a viatgers amb destinació a bord",
      "Portes d'accés obertes",
      "Personal a bord esperant a l'andana",
      "Cancel·lat per incidències tècniques",
      "Cancel·lat per condicions meteorològiques adverses",
      "Cancel·lat per vaga al sector",
      "Transbord organitzat per carretera",
    ],
    info: [
      "Recordeu validar el vostre bitllet abans de pujar",
      "Mantingueu l'equipatge controlat en tot moment",
      "Tren amb espai per a bicicletes disponible",
      "Servei d'assistència disponible per a mobilitat reduïda",
      "Tren amb zona de silenci en cotxes centrals",
    ],
  },
  en: {
    generic: [
      "No incidents reported",
      "Normal service",
      "Operating as scheduled",
      "Rolling stock checked",
      "Departure expected on time",
      "Service reinforced due to demand",
      "High occupancy expected",
      "Service running smoothly",
      "Train ready for departure",
      "Full crew on board",
      "Standard travel conditions",
      "Seasonal service active",
      "All connections guaranteed",
    ],
    service: [
      "Maintenance work on the infrastructure",
      "Works along the corridor",
      "Service subject to traffic regulation",
      "Affected by heavy traffic on the central section",
      "Temporary rolling stock change for operational needs",
      "Extra intermediate stops in place",
      "Due to track modernisation works",
      "Electrification works affecting service",
      "Catenary renewal in progress",
      "Temporary adaptation for seasonal works",
      "Platform accessibility improvements underway",
      "Rolling stock change for scheduled maintenance",
    ],
    delay: [
      "Delay due to an infrastructure incident",
      "Delay due to rail traffic congestion",
      "Delay due to rolling stock failure",
      "Delay due to traffic management",
      "Delay due to technical intervention",
      "Delay due to a catenary fault",
      "Delay due to single-track crossing operations",
      "Delay due to extraordinary safety inspection",
      "Delay due to high passenger density at origin",
      "Delay due to on-board system fault",
      "Delay waiting for connecting service",
    ],
    platform: [
      "Platform assignment confirmed on the board",
      "Possible platform change due to traffic regulation",
      "Platform assignment may change at short notice",
      "Platform confirmed via announcement",
      "Platform change due to works on adjacent platform",
      "Check information boards for possible platform change",
      "Temporary platform due to station events",
    ],
    status: [
      "Boarding in progress via gates 1-4",
      "Final call for passengers",
      "Boarding gates open",
      "Train crew waiting on platform",
      "Cancelled due to technical issues",
      "Cancelled due to adverse weather conditions",
      "Cancelled due to strike action",
      "Coach transfer organised",
    ],
    info: [
      "Please validate your ticket before boarding",
      "Keep your luggage with you at all times",
      "Next station with underground connection",
      "Bicycle storage available on this service",
      "Assistance available for reduced mobility",
      "Silent zone carriages available",
    ],
  },
  fr: {
    generic: [
      "Aucun incident signalé",
      "Service normal",
      "Exploitation conforme à l'horaire",
      "Matériel vérifié",
      "Départ prévu à l'heure",
      "Service renforcé en fonction de la demande",
      "Fort taux d'occupation attendu",
      "Circulation normale",
      "Train prêt pour le départ",
      "Équipage complet à bord",
      "Service saisonnier actif",
      "Correspondances garanties",
    ],
    service: [
      "Travaux de maintenance sur l'infrastructure",
      "Chantiers sur le corridor",
      "Service soumis à régulation du trafic",
      "Trafic dense sur la section centrale",
      "Changement ponctuel de matériel pour besoins d'exploitation",
      "Arrêts intermédiaires renforcés",
      "Travaux de modernisation de la voie",
      "Travaux d'électrification en cours",
      "Renouvellement de la caténaire",
      "Adaptation temporaire pour travaux saisonniers",
      "Amélioration de l'accessibilité des quais",
    ],
    delay: [
      "Retard dû à un incident d'infrastructure",
      "Retard dû à la congestion ferroviaire",
      "Retard dû à une panne de matériel",
      "Retard dû à une régulation du trafic",
      "Retard dû à une intervention technique",
      "Retard dû à un incident de caténaire",
      "Retard dû au croisement sur voie unique",
      "Retard dû à un contrôle de sécurité extraordinaire",
      "Retard dû à une forte affluence au départ",
      "Retard pour attente de correspondance",
    ],
    platform: [
      "Voie attribuée confirmée sur le panneau",
      "Changement de voie possible selon la régulation",
      "Attribution de voie susceptible de changer à la dernière minute",
      "Voie confirmée par haut-parleur",
      "Changement de voie pour travaux sur quai adjacent",
      "Consultez le panneau pour un éventuel changement de voie",
    ],
    status: [
      "Embarquement en cours portes 1-4",
      "Dernier appel pour les voyageurs",
      "Portes d'accès ouvertes",
      "Personnel à bord attendant en quai",
      "Annulé pour raisons techniques",
      "Annulé en raison des conditions météorologiques",
      "Annulé pour grève dans le secteur",
      "Transfert par car organisé",
    ],
    info: [
      "Pensez à valider votre billet avant de monter",
      "Surveillez vos bagages en tout temps",
      "Prochain gare avec correspondance métro",
      "Espace vélo disponible à bord",
      "Assistance disponible pour mobilité réduite",
    ],
  },
  eu: {
    generic: [
      "Ez da gorabeherarik jakinarazi",
      "Zerbitzu arrunta",
      "Ordutegiaren arabera martxan",
      "Materiala berrikusita",
      "Irteera orduz espero da",
      "Eskariagatik zerbitzu indartua",
      "Gaitasun handia espero da",
      "Zirkulazio normala",
      "Treina prest irteerarako",
      "Langile osoa treinean",
      "Sasoiko zerbitzua aktibatuta",
      "Konexioak bermatuta",
    ],
    service: [
      "Azpiegiturako mantentze lanengatik",
      "Korridorean obrak daudelako",
      "Zirkulazioaren erregulaziopean",
      "Erdiko tarteko zirkulazio trinkoak eraginda",
      "Eragiketa beharretarako material aldaketa puntuala",
      "Tarteko geltokietan geldialdi indartuak",
      "Bidean modernizazio lanengatik",
      "Elektrifikazio lanek zerbitzuan eraginda",
      "Katenaria berritze lanak",
      "Aldi baterako egokitzapena sasoiko lanengatik",
    ],
    delay: [
      "Atzerapena azpiegiturako gorabeheragatik",
      "Atzerapena tren trafikoaren pilaketagatik",
      "Atzerapena materialaren matxuragatik",
      "Atzerapena trafikoaren erregulazioagatik",
      "Atzerapena esku-hartze teknikoagatik",
      "Atzerapena katenariako matxuragatik",
      "Atzerapena bide bakarreko gurutzatzeagatik",
      "Atzerapena segurtasun ikuskapenagatik",
      "Atzerapena jatorrian bidaiari dentsitate handiagatik",
      "Atzerapena barneko sistemaren matxuragatik",
    ],
    platform: [
      "Esleitutako nasaren baieztapena panelean",
      "Nasaren aldaketa posiblea trafikoaren arabera",
      "Nasa azken unean alda daiteke",
      "Nasa baieztatua megafonia bidez",
      "Nasa aldaketa ondoko nasako obrengatik",
      "Egiaztatu informazio panela nasa aldaketa posibleagatik",
    ],
    status: [
      "Ontziratzea martxan 1-4 ateetatik",
      "Azken deia bidaiarientzat",
      "Sarbide ateak irekita",
      "Treineko langileak nasan itxaroten",
      "Bertan behera utzia arrazoi teknikoengatik",
      "Bertan behera utzia eguraldi txarrarengatik",
      "Bertan behera utzia grebarengatik",
      "Autobusez transbordoa antolatuta",
    ],
    info: [
      "Txartela balidatu igo aurretik",
      "Ekipajea uneoro kontrolpean eduki",
      "Hurrengo geltokia metrorako konexioarekin",
      "Bizikleta lekua eskuragarri treinean",
      "Mugikortasun urrikoentzako laguntza eskuragarri",
    ],
  },
  gl: {
    generic: [
      "Sen incidencias",
      "Servizo habitual",
      "Operación normal",
      "Material revisado",
      "Saída prevista segundo horario",
      "Servizo reforzado por demanda",
      "Alta ocupación prevista",
      "Circulación con normalidade",
      "Servizo sen novidades",
      "Tren preparado para a saída",
      "Persoal a bordo completo",
      "Condicións de viaxe habituais",
      "Servizo de tempada activo",
      "Reforzo de personal na estación",
    ],
    service: [
      "Por traballos de mantemento na infraestrutura",
      "Debido a obras no corredor",
      "Servizo suxeito a regulación de tráfico",
      "Afectado por circulación densa no tramo central",
      "Cambio puntual de material por necesidades operativas",
      "Parada reforzada en estacións intermedias",
      "Por obras de modernización na vía",
      "Servizo afectado por obras de electrificación",
      "Por renovación de catenaria no traxecto",
      "Adaptación temporal por obras estacionais",
      "Cambio de material rodante por mantemento programado",
      "Desvío provisional por obras na estación",
    ],
    delay: [
      "Retraso por incidencia na infraestrutura",
      "Retraso por acumulación de tráfico ferroviario",
      "Retraso por avaría de material",
      "Retraso por manobras de regulación",
      "Demora por intervención técnica",
      "Retraso por incidencia na catenaria",
      "Retraso por cruce de trens en vía única",
      "Demora por operacións de estacionamento",
      "Retraso por revisión extraordinaria de seguridade",
      "Retraso por alta densidade de viaxeiros na orixe",
      "Retraso por incidencia no sistema de a bordo",
    ],
    platform: [
      "Vía asignada confirmada no panel",
      "Posible cambio de vía por regulación de tráfico",
      "A asignación de vía pode mudar á última hora",
      "Vía confirmada por megafonía",
      "Cambio de vía por obras no andén contiguo",
      "Por obras na vía habitual, acceso por andén alternativo",
      "Comprobe o panel informativo para posible cambio de vía",
    ],
    status: [
      "Embarque en curso polas portas 1-4",
      "Última chamada para viaxeiros con destino a bordo",
      "Portas de acceso abertas",
      "Persoal de a bordo esperando no andén",
      "Cancelado por incidencias técnicas",
      "Cancelado por condicións meteorolóxicas adversas",
      "Cancelado por folga no sector",
      "Transbordo organizado por estrada",
    ],
    info: [
      "Lembren validar o seu billete antes de subir",
      "Manteñan a súa equipaxe controlada en todo momento",
      "Vindeira estación con correspondencia de metro",
      "Tren con espazo para bicicletas dispoñible",
      "Servizo de asistencia dispoñible para mobilidade reducida",
    ],
  },
};

const normalizeLanguage = (value) => {
  const lang = String(value || "").toLowerCase().trim();
  return SUPPORTED_LANGUAGES.has(lang) ? lang : "es";
};

const normalizeLanguageList = (value, fallbackLanguage = "es") => {
  const rawList = Array.isArray(value)
    ? value
    : typeof value === "string" && value.trim().startsWith("[")
      ? (() => {
        try {
          const parsed = JSON.parse(value);
          return Array.isArray(parsed) ? parsed : [value];
        } catch {
          return [value];
        }
      })()
      : typeof value === "string" && value.includes(",")
        ? value.split(",")
        : value != null
          ? [value]
          : [];

  const unique = [];
  for (const item of rawList) {
    const lang = normalizeLanguage(item);
    if (!unique.includes(lang)) unique.push(lang);
  }
  if (!unique.length) unique.push(normalizeLanguage(fallbackLanguage));
  return unique;
};

const pickDisplayLanguage = (config) => {
  const languages = normalizeLanguageList(config?.languages, config?.language || "es");
  return languages[Math.floor(Math.random() * languages.length)] || "es";
};

const randomItem = (arr) => arr[Math.floor(Math.random() * arr.length)];

const pickObservation = ({ language, status, modeValue }) => {
  const lang = normalizeLanguage(language);
  const bank = OBSERVATION_BANK[lang] || OBSERVATION_BANK.es;

  const parts = [];

  if (status === "Delayed") {
    parts.push(randomItem(bank.delay));
    if (Math.random() < 0.35) parts.push(randomItem(bank.service));
  } else if (status === "Cancelled") {
    parts.push(randomItem(bank.status.filter(s => s.toLowerCase().includes("cancel"))));
  } else if (status === "Boarding") {
    if (Math.random() < 0.55) parts.push(randomItem(bank.status));
    parts.push(randomItem(bank.generic));
  } else {
    const pool = [
      ...bank.generic,
      ...bank.service,
      ...bank.platform,
      ...bank.info,
    ];
    parts.push(randomItem(pool));
    if (Math.random() < 0.25) parts.push(randomItem(pool));
  }

  if (parts.length === 0) {
    parts.push(randomItem(bank.generic));
  }

  return parts.join(" · ");
};

// ----- config -----
r.get("/config", (_req, res) => res.json(getConfig()));
r.put("/config", adminAuth, (req, res) => {
  setConfig(req.body || {});
  ping();
  res.json(getConfig());
});

// ----- display configs -----
r.get("/displays", adminAuth, (_req, res) => {
  res.json(
    listStationDisplayConfigs().map(({ station, config }) => ({
      station,
      config,
      trains: listTrains(station.id),
    }))
  );
});

r.get("/stations/:id/config", (req, res) => {
  const config = getStationDisplayConfig(Number(req.params.id));
  if (!config) return res.status(404).json({ error: "Station not found" });
  res.json(config);
});

r.put("/stations/:id/config", adminAuth, (req, res) => {
  const config = setStationDisplayConfig(Number(req.params.id), req.body || {});
  if (!config) return res.status(404).json({ error: "Station not found" });
  ping();
  res.json(config);
});

// ----- trains -----
r.get("/trains", (req, res) => {
  const stationId = req.query.station_id != null ? Number(req.query.station_id) : null;
  res.json(listTrains(stationId));
});

r.delete("/trains", adminAuth, (req, res) => {
  if (req.headers["x-confirm"] !== "yes") {
    return res.status(400).json({ error: 'Requiere header X-Confirm: yes para borrar todos los trenes.' });
  }
  const stationId = req.query.station_id != null ? Number(req.query.station_id) : null;
  if (stationId != null && Number.isFinite(stationId)) {
    db.prepare("DELETE FROM trains WHERE station_id = ?").run(stationId);
  } else {
    db.exec("DELETE FROM trains");
  }
  ping();
  res.status(204).end();
});

function reorderTrains(ids) {
  const stmt = db.prepare("UPDATE trains SET sort_order = ? WHERE id = ?");
  ids.forEach((id, idx) => stmt.run(idx, id));
}

r.put("/trains/reorder", adminAuth, (req, res) => {
  reorderTrains(req.body.ids);
  ping();
  res.json(listTrains());
});

r.post("/trains", adminAuth, upload.single("custom_icon"), (req, res) => {
  const body = req.body;
  if (req.file) {
    body.custom_icon_url = `/uploads/${req.file.filename}`;
  }
  const t = createTrain(body);
  ping();
  res.status(201).json(t);
});
r.put("/trains/:id", adminAuth, upload.single("custom_icon"), (req, res) => {
  const body = req.body;
  if (req.file) {
    body.custom_icon_url = `/uploads/${req.file.filename}`;
  } else if (body.custom_icon_url === "") {
    body.custom_icon_url = null;
  }
  const t = updateTrain(Number(req.params.id), body);
  if (!t) return res.status(404).end();
  ping();
  res.json(t);
});
r.patch("/trains/:id/status", adminAuth, (req, res) => {
  const t = updateTrain(Number(req.params.id), { status: req.body.status });
  if (!t) return res.status(404).end();
  ping();
  res.json(t);
});
r.patch("/trains/:id/delay", adminAuth, (req, res) => {
  const cur = getTrain(Number(req.params.id));
  if (!cur) return res.status(404).end();
  const minutes = Number(req.body.minutes || 0);
  const t = updateTrain(cur.id, {
    expected_time: addMinutes(cur.expected_time, minutes),
    status: minutes > 0 ? "Delayed" : cur.status,
  });
  ping();
  res.json(t);
});
r.patch("/trains/:id/platform", adminAuth, (req, res) => {
  const t = updateTrain(Number(req.params.id), {
    platform: req.body.platform,
    sector: req.body.sector,
  });
  if (!t) return res.status(404).end();
  ping();
  res.json(t);
});
r.delete("/trains/:id", adminAuth, (req, res) => {
  deleteTrain(Number(req.params.id));
  ping();
  res.status(204).end();
});

// ----- operators -----
r.get("/operators", (_req, res) => res.json(operators.list()));
r.post("/operators", adminAuth, upload.single("logo"), (req, res) => {
  const logo_url = req.file ? `/uploads/${req.file.filename}` : null;
  operators.create({ name: req.body.name, logo_url });
  ping();
  res.status(201).json(operators.list());
});
r.put("/operators/:id", adminAuth, upload.single("logo"), (req, res) => {
  const id = Number(req.params.id);
  const logo_url = req.file ? `/uploads/${req.file.filename}` : req.body.logo_url;
  operators.update(id, { name: req.body.name, logo_url });
  ping();
  res.json(operators.list());
});
r.delete("/operators/:id", adminAuth, (req, res) => {
  operators.remove(Number(req.params.id));
  ping();
  res.status(204).end();
});
r.post("/operators/:id/pre-announce", adminAuth, uploadAudio.single("file"), (req, res) => {
  const id = Number(req.params.id);
  const url = req.file ? `/uploads/${req.file.filename}` : null;
  operators.update(id, { pre_announce_ogg: url });
  ping();
  res.json(operators.list());
});
r.delete("/operators/:id/pre-announce", adminAuth, (req, res) => {
  operators.update(Number(req.params.id), { pre_announce_ogg: null });
  ping();
  res.status(204).end();
});

// ----- routes (Rodalia, etc) -----
r.get("/routes", (_req, res) => res.json(getAllRoutes()));
r.get("/regions", (_req, res) => res.json(getAvailableRegions()));
r.get("/routes/export", adminAuth, (_req, res) => {
  const routes = getAllRoutes();
  res.setHeader("Content-Disposition", 'attachment; filename="railboard_routes.json"');
  res.type("application/json").send(JSON.stringify(routes, null, 2));
});
r.post("/routes/reload", adminAuth, (_req, res) => res.json(reloadRoutesDataset()));

// ----- train icons (library) -----
r.get("/train-icons", (_req, res) => res.json(trainIcons.list()));
r.post("/train-icons", adminAuth, upload.single("icon"), (req, res) => {
  const icon_url = req.file ? `/uploads/${req.file.filename}` : null;
  if (!icon_url || !req.body.name) return res.status(400).json({ error: "name and icon required" });
  trainIcons.create({ name: req.body.name, icon_url });
  ping();
  res.status(201).json(trainIcons.list());
});
r.put("/train-icons/:id", adminAuth, upload.single("icon"), (req, res) => {
  const id = Number(req.params.id);
  const icon_url = req.file ? `/uploads/${req.file.filename}` : req.body.icon_url;
  trainIcons.update(id, { name: req.body.name, icon_url });
  ping();
  res.json(trainIcons.list());
});
r.delete("/train-icons/:id", adminAuth, (req, res) => {
  trainIcons.remove(Number(req.params.id));
  ping();
  res.status(204).end();
});

// ----- train types -----
r.get("/train-types", (_req, res) => res.json(trainTypes.list()));

const uploadFields = upload.fields([
  { name: "logo", maxCount: 1 },
  { name: "destination_icon", maxCount: 1 },
]);

r.post("/train-types", adminAuth, uploadFields, (req, res) => {
  const logo_url = req.files?.logo?.[0] ? `/uploads/${req.files.logo[0].filename}` : null;
  const destination_icon_url = req.files?.destination_icon?.[0] ? `/uploads/${req.files.destination_icon[0].filename}` : null;
  const code = String(req.body.code || "").trim();
  const existing = trainTypes.list().find((t) => t.code === code);
  let statusCode = 201;

  if (existing) {
    statusCode = 200;
    trainTypes.update(existing.id, {
      code,
      name: req.body.name,
      color: req.body.color,
      logo_url: logo_url ?? existing.logo_url,
      destination_icon_url: destination_icon_url ?? existing.destination_icon_url,
    });
  } else {
    trainTypes.create({
      code,
      name: req.body.name,
      color: req.body.color,
      logo_url,
      destination_icon_url,
    });
  }
  ping();
  res.status(statusCode).json(trainTypes.list());
});
r.put("/train-types/:id", adminAuth, uploadFields, (req, res) => {
  const id = Number(req.params.id);
  const logo_url = req.files?.logo?.[0] ? `/uploads/${req.files.logo[0].filename}` : req.body.logo_url;
  const destination_icon_url = req.files?.destination_icon?.[0] ? `/uploads/${req.files.destination_icon[0].filename}` : req.body.destination_icon_url;
  trainTypes.update(id, {
    code: req.body.code,
    name: req.body.name,
    color: req.body.color,
    logo_url,
    destination_icon_url,
  });
  ping();
  res.json(trainTypes.list());
});
r.delete("/train-types/:id", adminAuth, (req, res) => {
  trainTypes.remove(Number(req.params.id));
  ping();
  res.status(204).end();
});
r.post("/train-types/:id/pre-announce", adminAuth, uploadAudio.single("file"), (req, res) => {
  const id = Number(req.params.id);
  const url = req.file ? `/uploads/${req.file.filename}` : null;
  trainTypes.update(id, { pre_announce_ogg: url });
  ping();
  res.json(trainTypes.list());
});
r.delete("/train-types/:id/pre-announce", adminAuth, (req, res) => {
  trainTypes.update(Number(req.params.id), { pre_announce_ogg: null });
  ping();
  res.status(204).end();
});

// ----- places -----
r.get("/places", (_req, res) => res.json(places.list()));
r.post("/places", adminAuth, upload.single("logo"), (req, res) => {
  const logo_url = req.file ? `/uploads/${req.file.filename}` : null;
  places.create({ name: req.body.name, logo_url });
  ping();
  res.status(201).json(places.list());
});
r.put("/places/:id", adminAuth, upload.single("logo"), (req, res) => {
  const id = Number(req.params.id);
  const logo_url = req.file ? `/uploads/${req.file.filename}` : req.body.logo_url;
  places.update(id, { name: req.body.name, logo_url });
  ping();
  res.json(places.list());
});
r.delete("/places/:id", adminAuth, (req, res) => {
  places.remove(Number(req.params.id));
  ping();
  res.status(204).end();
});

// ----- stations -----
r.get("/stations", (_req, res) => res.json(stations.list()));
r.post("/stations", adminAuth, (req, res) => {
  const s = stations.create(req.body);
  ping();
  res.status(201).json(stations.list());
});
r.put("/stations/:id", adminAuth, (req, res) => {
  const s = stations.update(Number(req.params.id), req.body);
  if (!s) return res.status(404).end();
  ping();
  res.json(stations.list());
});
r.delete("/stations/:id", adminAuth, (req, res) => {
  if (countStations() <= 1) {
    return res.status(400).json({ error: "Debe existir al menos un display." });
  }
  stations.remove(Number(req.params.id));
  ping();
  res.status(204).end();
});
r.post("/stations/:id/pre-announce", adminAuth, uploadAudio.single("file"), (req, res) => {
  const id = Number(req.params.id);
  const url = req.file ? `/uploads/${req.file.filename}` : null;
  stations.update(id, { pre_announce_ogg: url });
  ping();
  res.json(stations.list());
});
r.delete("/stations/:id/pre-announce", adminAuth, (req, res) => {
  stations.update(Number(req.params.id), { pre_announce_ogg: null });
  ping();
  res.status(204).end();
});

// ----- export trains -----
r.get("/trains/export", adminAuth, (req, res) => {
  const stationId = req.query.station_id != null ? Number(req.query.station_id) : null;
  const trains = listTrains(Number.isFinite(stationId) ? stationId : undefined);
  const filename = Number.isFinite(stationId)
    ? `railboard_trains_station_${stationId}.json`
    : "railboard_trains.json";
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.type("application/json").send(JSON.stringify(trains, null, 2));
});

// ----- seed (load demo trains) -----
r.post("/seed-trains", adminAuth, (_req, res) => {
  db.exec("DELETE FROM trains");

  const opList = operators.list().map((o) => o.name);
  if (!opList.includes("Renfe")) operators.create({ name: "Renfe" });
  if (!opList.includes("Avlo")) operators.create({ name: "Avlo" });
  if (!opList.includes("Iryo")) operators.create({ name: "Iryo" });
  if (!opList.includes("Ouigo")) operators.create({ name: "Ouigo" });

  const typeList = trainTypes.list().map((t) => t.code);
  if (!typeList.includes("AVE")) trainTypes.create({ code: "AVE", name: "Alta Velocidad", color: "#7c1d2e" });
  if (!typeList.includes("AVLO")) trainTypes.create({ code: "AVLO", name: "Avlo", color: "#5b1fb8" });
  if (!typeList.includes("ALVIA")) trainTypes.create({ code: "ALVIA", name: "Alvia", color: "#1f6fb2" });
  if (!typeList.includes("IC")) trainTypes.create({ code: "IC", name: "Intercity", color: "#2b6e3f" });
  if (!typeList.includes("MD")) trainTypes.create({ code: "MD", name: "Media Distancia", color: "#b25a1f" });
  if (!typeList.includes("C")) trainTypes.create({ code: "C", name: "Cercanías", color: "#c2185b" });

  const opId = (name) => operators.list().find((o) => o.name === name)?.id;
  const typeId = (code) => trainTypes.list().find((t) => t.code === code)?.id;

  const now = new Date();
  const hhmm = (offsetMin) => {
    const d = new Date(now.getTime() + offsetMin * 60_000);
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  };

  for (const f of SEED_FIXTURES) {
    const sched = hhmm(f.min);
    const expected = f.delay ? hhmm(f.min + f.delay) : sched;
    createTrain({
      number: f.number,
      operator_id: opId(f.op),
      train_type_id: typeId(f.type),
      origin: "Madrid Puerta de Atocha",
      destination: f.destination,
      stops: f.stops,
      scheduled_time: sched,
      expected_time: expected,
      platform: f.platform,
      sector: f.sector,
      status: f.status,
    });
  }

  ping();
  res.json(listTrains());
});

// ----- generate random train -----
r.post("/generate-random-train", adminAuth, (req, res) => {
  ensureLearnedRailData();
  const railRoutes = getAllRoutes();

  const opList = operators.list();
  const typeList = trainTypes.list();
  const placeList = places.list();
  if (railRoutes.length === 0) {
    return res.status(400).json({ error: "No routes available from backend data" });
  }

  if (opList.length === 0 || typeList.length === 0 || placeList.length === 0) {
    return res.status(400).json({ error: "Need at least one operator, train type, and place" });
  }

  const randomItem = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
  const profileForType = (typeCode) => {
    if (/^(C(-\d+)?|R\d+[A-Z]?|R2N)$/i.test(typeCode)) {
      return { delayedProb: 0.16, cancelledProb: 0.03, advancedProb: 0.04, delayMin: 2, delayMax: 9 };
    }
    if (/^(MD)$/i.test(typeCode)) {
      return { delayedProb: 0.14, cancelledProb: 0.03, advancedProb: 0.03, delayMin: 4, delayMax: 16 };
    }
    if (/^(AVANT|AVE|IRYO|OUIGO|INOUI|EMD)$/i.test(typeCode)) {
      return { delayedProb: 0.09, cancelledProb: 0.02, advancedProb: 0.02, delayMin: 3, delayMax: 14 };
    }
    return { delayedProb: 0.12, cancelledProb: 0.03, advancedProb: 0.03, delayMin: 3, delayMax: 12 };
  };
  const statusForOffset = (offset, profile, modeValue) => {
    if (offset < 0) return modeValue === "arrivals" ? "Arrived" : "Departed";
    if (offset <= 8) return "Boarding";
    const roll = Math.random();
    if (roll < profile.cancelledProb) return "Cancelled";
    if (roll < profile.cancelledProb + profile.delayedProb) return "Delayed";
    if (roll < profile.cancelledProb + profile.delayedProb + profile.advancedProb) return "Advanced";
    return "Scheduled";
  };
  const config = getConfig();
  const clockBase = clockBaseFromConfig(config);
  const hhmmFromOffset = (offsetMin) => hhmmFromOffsetAt(clockBase, offsetMin);
  const mode = config.mode === "arrivals" ? "arrivals" : "departures";
  const requestedStationId = req.body?.station_id != null ? Number(req.body.station_id) : null;
  const stationRow = requestedStationId != null && Number.isFinite(requestedStationId)
    ? stations.get(requestedStationId)
    : null;
  const station = stationRow?.name || config.station_name || "Madrid Puerta de Atocha";
  const stationConfig = stationRow ? getStationDisplayConfig(stationRow.id) : config;
  const routesAtStation = railRoutes.filter((r) => stationIndex(r.stations, station) >= 0);
  const requestedRegion = String(stationConfig?.routeRegion || "").trim();
  const routePoolSource = routesAtStation.length ? routesAtStation : railRoutes;
  const routePool = requestedRegion
    ? routePoolSource.filter((route) => getRouteRegion(route) === requestedRegion)
    : routePoolSource;
  if (!routePool.length) {
    return res.status(400).json({
      error: requestedRegion
        ? `No hay rutas disponibles para la región "${requestedRegion}" en este display.`
        : "No routes available for this display",
    });
  }
  const existing = listTrains().filter((t) => !["Departed", "Arrived"].includes(t.status));
  const routeCounts = new Map();
  for (const train of existing) routeCounts.set(train.type_code, (routeCounts.get(train.type_code) || 0) + 1);
  const pool = routePool.map((r) => ({ route: r, count: routeCounts.get(r.code) || 0 }));
  const weights = pool.map((p) => 1 / (1 + p.count));
  const totalWeight = weights.reduce((s, w) => s + w, 0);
  let pick = Math.random() * totalWeight;
  let chosenIndex = 0;
  for (let i = 0; i < weights.length; i++) {
    pick -= weights[i];
    if (pick <= 0) { chosenIndex = i; break; }
  }
  const route = pool[chosenIndex % pool.length].route;
  const routeStationIndex = stationIndex(route.stations, station);
  const currentIndex = routeStationIndex >= 0 ? routeStationIndex : 0;
  const direction = currentIndex === 0 ? 1 : currentIndex === route.stations.length - 1 ? -1 : randomItem([-1, 1]);
  const terminalIndex = direction === 1 ? route.stations.length - 1 : 0;
  const xativaIndex = route.stations.indexOf("Xàtiva");
  const endIndex = route.code === "C-2" && direction === 1 && currentIndex < xativaIndex && Math.random() < 0.55
    ? xativaIndex
    : terminalIndex;
  const [fromIndex, toIndex] = mode === "arrivals" ? [endIndex, currentIndex] : [currentIndex, endIndex];
  const routeStops = orderedIntermediateStops(route.stations, fromIndex, toIndex);
  const op = opList.find((o) => o.name === (route.operator || "Renfe"))
    || opList.find((o) => o.name === "Renfe")
    || randomItem(opList);
  const type = typeList.find((t) => t.code === route.code) || randomItem(typeList);
  const sameLineUpcoming = existing
    .filter((t) => t.type_code === route.code)
    .map((t) => minutesUntilHHMM(t.scheduled_time, clockBase))
    .filter((offset) => offset > -5)
    .sort((a, b) => a - b);
  const lastOffset = sameLineUpcoming.length ? sameLineUpcoming[sameLineUpcoming.length - 1] : randomInt(2, 10);
  const scheduledOffset = Math.random() < 0.14
    ? -randomInt(2, 25)
    : Math.min(240, Math.max(3, lastOffset + route.headwayMin + randomInt(-3, 4)));
  const profile = profileForType(route.code);
  const rawStatus = statusForOffset(scheduledOffset, profile, mode);
  const expectedOffset = rawStatus === "Delayed"
    ? scheduledOffset + randomInt(profile.delayMin, profile.delayMax)
    : rawStatus === "Advanced"
      ? Math.max(1, scheduledOffset - randomInt(1, Math.min(7, profile.delayMax)))
      : scheduledOffset;
  const status = rawStatus === "Advanced" ? "Scheduled" : rawStatus;
  const maxStopLimit = Math.min(9, routeStops.length);
  const stopLimit = route.code === "C-3"
    ? routeStops.length
    : maxStopLimit > 0
      ? randomInt(Math.min(4, maxStopLimit), maxStopLimit)
      : 0;
  const stops = routeStops.slice(0, stopLimit);
  const usedNumbers = new Set(existing.map((t) => t.number));
  const availableNumbers = route.numbers.filter((number) => !usedNumbers.has(number));
  const observations = pickObservation({
    language: pickDisplayLanguage(stationConfig || config),
    status,
    modeValue: mode,
  });

  const train = createTrain({
    number: availableNumbers.length ? randomItem(availableNumbers) : randomItem(route.numbers),
    operator_id: op.id,
    train_type_id: type.id,
    origin: route.stations[fromIndex],
    destination: route.stations[toIndex],
    stops,
    scheduled_time: hhmmFromOffset(scheduledOffset),
    expected_time: hhmmFromOffset(expectedOffset),
    platform: randomItem(choiceFromConfig(stationConfig, "platform", route.platforms)),
    sector: randomItem(choiceFromConfig(stationConfig, "sector", [""])),
    status,
    observations,
    station_id: stationRow?.id ?? null,
  });

  ping();
  res.status(201).json(train);
});

// ----- generate train from specific route -----
r.post("/trains/from-route/:code", adminAuth, (req, res) => {
  ensureLearnedRailData();
  const railRoutes = getAllRoutes();
  const { code } = req.params;

  const route = railRoutes.find(r => r.code === code);
  if (!route) {
    return res.status(404).json({ error: `Route ${code} not found` });
  }

  const opList = req.body?.operator_id ?
    operators.list().filter(o => o.id === req.body.operator_id) :
    [operators.list().find(o => o.name === (route.operator || "Renfe")) ||
      operators.list().find(o => o.name === "Renfe") ||
      operators.list()[0]];

  const typeList = trainTypes.list();
  if (opList.length === 0 || typeList.length === 0) {
    return res.status(400).json({ error: "Missing operators or train types" });
  }

  const randomItem = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

  const config = getConfig();
  const mode = config.mode === "arrivals" ? "arrivals" : "departures";
  const station = config.station_name || "Madrid Puerta de Atocha";
  const stationRow = stations.list().find((s) => normalizeStation(s.name) === normalizeStation(station)) || null;
  const stationConfig = stationRow ? getStationDisplayConfig(stationRow.id) : config;
  const routeStationIndex = route.stations.indexOf(station);
  const currentIndex = routeStationIndex >= 0 ? routeStationIndex : 0;
  const direction = currentIndex === 0 ? 1 : currentIndex === route.stations.length - 1 ? -1 : randomItem([-1, 1]);
  const terminalIndex = direction === 1 ? route.stations.length - 1 : 0;
  const [fromIndex, toIndex] = mode === "arrivals" ? [terminalIndex, currentIndex] : [currentIndex, terminalIndex];

  const orderedIntermediateStops = (stations, from, to) => {
    const [start, end] = from <= to ? [from, to] : [to, from];
    return stations.slice(start + 1, end);
  };

  const routeStops = orderedIntermediateStops(route.stations, fromIndex, toIndex);
  const op = opList[0];
  const type = typeList.find(t => t.code === route.code) || randomItem(typeList);

  const existing = listTrains();
  const usedNumbers = new Set(existing.map(t => t.number));
  const availableNumbers = route.numbers.filter(number => !usedNumbers.has(number));

  const hhmmNow = () => {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  };

  const maxStopLimit = Math.min(9, routeStops.length);
  const stopLimit = maxStopLimit > 0 ? randomInt(Math.min(3, maxStopLimit), maxStopLimit) : 0;
  const stops = routeStops.slice(0, stopLimit);

  const train = createTrain({
    number: availableNumbers.length ? randomItem(availableNumbers) : randomItem(route.numbers),
    operator_id: op.id,
    train_type_id: type.id,
    origin: route.stations[fromIndex],
    destination: route.stations[toIndex],
    stops,
    scheduled_time: hhmmNow(),
    expected_time: hhmmNow(),
    platform: randomItem(choiceFromConfig(stationConfig, "platform", route.platforms)),
    sector: randomItem(choiceFromConfig(stationConfig, "sector", [""])),
    status: "Scheduled",
    observations: req.body?.observations || pickObservation({
      language: pickDisplayLanguage(stationConfig || config),
      status: "Scheduled",
      modeValue: mode,
    }),
    station_id: stationRow?.id ?? null,
  });

  ping();
  res.status(201).json(train);
});

// ============ MULTISTATION SERVICES ENDPOINTS ============

// GET /admin/services - List all services with filters
r.get("/services", adminAuth, (req, res) => {
  const { status, operator_id } = req.query;
  const filters = {};
  if (status) filters.status = status;
  if (operator_id) filters.operator_id = Number(operator_id);

  const data = services.list(filters);
  res.json({ status: "ok", data });
});

// POST /admin/services - Create new service
r.post("/services", adminAuth, (req, res) => {
  const { number, operator_id, train_type_id, origin_place_id, destination_place_id, notes } = req.body;

  if (!number) return res.status(400).json({ status: "error", error: "number is required" });

  try {
    const service = services.create({
      number,
      operator_id: operator_id ? Number(operator_id) : null,
      train_type_id: train_type_id ? Number(train_type_id) : null,
      origin_place_id: origin_place_id ? Number(origin_place_id) : null,
      destination_place_id: destination_place_id ? Number(destination_place_id) : null,
      notes,
    });

    serviceEvents.log(service.id, null, 'service_created', { number });
    broadcast({ type: "service_created", service_id: service.id, timestamp: Date.now() });

    res.status(201).json({ status: "ok", data: service });
  } catch (error) {
    res.status(400).json({ status: "error", error: error.message });
  }
});

// GET /admin/services/:id - Get service detail with all stops
r.get("/services/:id", adminAuth, (req, res) => {
  const { id } = req.params;
  const service = services.get(Number(id));

  if (!service) return res.status(404).json({ status: "error", error: "Service not found" });

  const stops = serviceStops.listByService(service.id);
  const events = serviceEvents.listByService(service.id, 50);

  res.json({ status: "ok", data: { service, stops, events } });
});

// PATCH /admin/services/:id - Update service
r.patch("/services/:id", adminAuth, (req, res) => {
  const { id } = req.params;
  const { status, notes } = req.body;

  const updated = services.update(Number(id), { status, notes });
  if (!updated) return res.status(404).json({ status: "error", error: "Service not found" });

  broadcast({ type: "service_updated", service_id: updated.id, timestamp: Date.now() });
  res.json({ status: "ok", data: updated });
});

// DELETE /admin/services/:id - Delete service
r.delete("/services/:id", adminAuth, (req, res) => {
  const { id } = req.params;
  services.remove(Number(id));
  broadcast({ type: "service_deleted", service_id: Number(id), timestamp: Date.now() });
  res.status(204).send();
});

// POST /admin/services/:id/cancel - Cancel service
r.post("/services/:id/cancel", adminAuth, (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;

  const cancelled = services.cancel(Number(id), reason || "Cancelled by operator");
  if (!cancelled) return res.status(404).json({ status: "error", error: "Service not found" });

  broadcast({ type: "service_cancelled", service_id: cancelled.id, reason, timestamp: Date.now() });
  res.json({ status: "ok", data: cancelled });
});

// ============ SERVICE STOPS ENDPOINTS ============

// GET /admin/services/:serviceId/stops - List stops for a service
r.get("/services/:serviceId/stops", adminAuth, (req, res) => {
  const { serviceId } = req.params;
  const stops = serviceStops.listByService(Number(serviceId));
  res.json({ status: "ok", data: stops });
});

// POST /admin/services/:serviceId/stops - Create a stop
r.post("/services/:serviceId/stops", adminAuth, (req, res) => {
  const { serviceId } = req.params;
  const { station_id, stop_number, stop_type, arrival_scheduled, departure_scheduled, platform, sector, notes } = req.body;

  if (!station_id || !stop_number || !stop_type) {
    return res.status(400).json({ status: "error", error: "station_id, stop_number, stop_type are required" });
  }

  try {
    const stop = serviceStops.create({
      service_id: Number(serviceId),
      station_id: Number(station_id),
      stop_number: Number(stop_number),
      stop_type,
      arrival_scheduled,
      departure_scheduled,
      platform,
      sector,
      notes,
    });

    serviceEvents.log(Number(serviceId), stop.id, 'stop_created', { stop_number });
    broadcast({ type: "service_stop_created", service_id: Number(serviceId), stop_id: stop.id, timestamp: Date.now() });

    res.status(201).json({ status: "ok", data: stop });
  } catch (error) {
    res.status(400).json({ status: "error", error: error.message });
  }
});

// PATCH /admin/services/:serviceId/stops/:stopId - Update a stop
r.patch("/services/:serviceId/stops/:stopId", adminAuth, (req, res) => {
  const { stopId } = req.params;
  const { platform, sector, notes, delay_locked } = req.body;

  const updated = serviceStops.update(Number(stopId), { platform, sector, notes, delay_locked });
  if (!updated) return res.status(404).json({ status: "error", error: "Stop not found" });

  broadcast({ type: "service_stop_updated", stop_id: updated.id, timestamp: Date.now() });
  res.json({ status: "ok", data: updated });
});

// DELETE /admin/services/:serviceId/stops/:stopId - Delete a stop
r.delete("/services/:serviceId/stops/:stopId", adminAuth, (req, res) => {
  const { stopId } = req.params;
  serviceStops.remove(Number(stopId));
  broadcast({ type: "service_stop_deleted", stop_id: Number(stopId), timestamp: Date.now() });
  res.status(204).send();
});

// POST /admin/services/:serviceId/stops/reorder - Reorder stops
r.post("/services/:serviceId/stops/reorder", adminAuth, (req, res) => {
  const { serviceId } = req.params;
  const { order } = req.body;  // array of stop IDs in new order

  if (!Array.isArray(order)) {
    return res.status(400).json({ status: "error", error: "order must be an array" });
  }

  const reordered = serviceStops.reorder(Number(serviceId), order);
  broadcast({ type: "service_stops_reordered", service_id: Number(serviceId), timestamp: Date.now() });
  res.json({ status: "ok", data: reordered });
});

// ============ SERVICE STOP OPERATIONS ============

// POST /admin/stops/:stopId/arrival - Mark arrival
r.post("/stops/:stopId/arrival", adminAuth, (req, res) => {
  const { stopId } = req.params;
  const { actual_time, platform } = req.body;

  if (!actual_time) {
    return res.status(400).json({ status: "error", error: "actual_time is required" });
  }

  const updated = serviceStops.markArrival(Number(stopId), actual_time, platform);
  if (!updated) return res.status(404).json({ status: "error", error: "Stop not found" });

  broadcast({
    type: "service_stop_state_changed",
    stop_id: updated.id,
    service_id: updated.service_id,
    new_state: "Arrived",
    delay_minutes: updated.delay_minutes,
    timestamp: Date.now()
  });

  res.json({ status: "ok", data: updated });
});

// POST /admin/stops/:stopId/departure - Mark departure
r.post("/stops/:stopId/departure", adminAuth, (req, res) => {
  const { stopId } = req.params;
  const { actual_time } = req.body;

  if (!actual_time) {
    return res.status(400).json({ status: "error", error: "actual_time is required" });
  }

  const updated = serviceStops.markDeparture(Number(stopId), actual_time);
  if (!updated) return res.status(404).json({ status: "error", error: "Stop not found" });

  broadcast({
    type: "service_stop_state_changed",
    stop_id: updated.id,
    service_id: updated.service_id,
    new_state: "Departed",
    timestamp: Date.now()
  });

  res.json({ status: "ok", data: updated });
});

// POST /admin/stops/:stopId/pass - Mark as passed (no stop)
r.post("/stops/:stopId/pass", adminAuth, (req, res) => {
  const { stopId } = req.params;
  const { actual_time } = req.body;

  if (!actual_time) {
    return res.status(400).json({ status: "error", error: "actual_time is required" });
  }

  const updated = serviceStops.markPass(Number(stopId), actual_time);
  if (!updated) return res.status(404).json({ status: "error", error: "Stop not found" });

  broadcast({
    type: "service_stop_state_changed",
    stop_id: updated.id,
    service_id: updated.service_id,
    new_state: "Passed",
    timestamp: Date.now()
  });

  res.json({ status: "ok", data: updated });
});

// POST /admin/stops/:stopId/delay - Add delay
r.post("/stops/:stopId/delay", adminAuth, (req, res) => {
  const { stopId } = req.params;
  const { minutes, reason } = req.body;

  if (!minutes || isNaN(minutes)) {
    return res.status(400).json({ status: "error", error: "minutes is required and must be a number" });
  }

  const updated = serviceStops.addDelay(Number(stopId), Number(minutes), reason || "Manual adjustment");
  if (!updated) return res.status(404).json({ status: "error", error: "Stop not found" });

  broadcast({
    type: "service_stop_delayed",
    stop_id: updated.id,
    service_id: updated.service_id,
    delay_minutes: updated.delay_minutes,
    reason: reason || "Manual adjustment",
    timestamp: Date.now()
  });

  res.json({ status: "ok", data: updated });
});

// ============ CRITICAL: BOARD DISPLAY ENDPOINT ============

// GET /stations/:stationId/board?mode=departures|arrivals|all
// Returns all service information needed for departure/arrival boards
r.get("/stations/:stationId/board", (req, res) => {
  const { stationId } = req.params;
  const { mode = "departures" } = req.query;
  const station = stations.list().find(s => s.id === Number(stationId));

  if (!station) {
    return res.status(404).json({ status: "error", error: "Station not found" });
  }
  const stationConfig = getStationDisplayConfig(station.id);

  // Legacy: Get trains from old table
  const trains = listTrains(Number(stationId));

  // New: Get services with stops at this station
  const allServices = services.list();
  const servicesWithStops = allServices
    .map(svc => {
      const stops = serviceStops.listByService(svc.id);
      return { service: svc, stops };
    })
    .filter(({ stops }) => stops.some(s => s.station_id === Number(stationId)))
    .map(({ service, stops }) => {
      const stopAtStation = stops.find(s => s.station_id === Number(stationId));
      return {
        ...service,
        stop_here: stopAtStation,
        all_stops: stops,
      };
    });

  // Filter by mode if provided
  const filtered = mode !== "all" ? {
    mode,
    trains: trains.filter(t => t.status !== "Cancelled"),
    services: servicesWithStops.filter(s => s.status !== "Cancelled"),
  } : {
    mode: "all",
    trains,
    services: servicesWithStops,
  };

  // Normalize trains to board row format
  const normalizedTrains = filtered.trains.map((train, idx) => ({
    stopId: train.id,
    serviceId: train.id,
    number: train.number,
    operatorName: train.operator_name || "",
    operatorLogo: train.operator_logo || null,
    trainTypeCode: train.type_code || "",
    trainTypeName: train.type_name || "",
    trainTypeColor: train.type_color || null,
    trainTypeLogo: train.type_logo || null,
    trainTypeDestinationIcon: train.type_destination_icon || null,
    destination: train.destination || "—",
    origin: train.origin || "—",
    stopsText: train.stops && train.stops.length > 0 ? train.stops.join(" · ") : "",
    time: train.scheduled_time || "—",
    expectedTime: train.expected_time || train.scheduled_time || "—",
    platform: train.platform || "?",
    sector: train.sector || "",
    status: train.status || "Scheduled",
    notes: train.observations || "",
  }));

  // Normalize services to board row format
  const normalizedServices = filtered.services.map((svc, idx) => {
    const stopAtStation = svc.stop_here;
    const stopsText = svc.all_stops
      .sort((a, b) => (a.stop_order || 0) - (b.stop_order || 0))
      .map(s => {
        const st = stations.list().find(x => x.id === s.station_id);
        return st?.name || "?";
      })
      .join(" · ");

    const trainType = svc.train_type_id ? trainTypes.list().find(t => t.id === svc.train_type_id) : null;
    return {
      stopId: svc.id,
      serviceId: svc.id,
      number: svc.number || "?",
      operatorName: svc.operator_id ? operators.list().find(o => o.id === svc.operator_id)?.name || "" : "",
      operatorLogo: svc.operator_logo || null,
      trainTypeCode: trainType?.code || "",
      trainTypeName: trainType?.name || "",
      trainTypeColor: trainType?.color || null,
      trainTypeLogo: svc.train_type_logo || null,
      trainTypeDestinationIcon: trainType?.destination_icon_url || null,
      destination: svc.destination_place_id ? places.list().find(p => p.id === svc.destination_place_id)?.name || "—" : "—",
      origin: svc.origin_place_id ? places.list().find(p => p.id === svc.origin_place_id)?.name || "—" : "—",
      stopsText: stopsText,
      time: stopAtStation?.scheduled_time || "—",
      expectedTime: stopAtStation?.expected_time || stopAtStation?.scheduled_time || "—",
      platform: stopAtStation?.platform || "?",
      sector: stopAtStation?.sector || "",
      status: svc.status || "Scheduled",
      notes: svc.notes || "",
    };
  });

  // Combine and return in format expected by Display.tsx
  res.json({
    status: "ok",
    station: {
      id: station.id,
      name: station.name,
      displayName: stationConfig?.station_name || station.display_name || station.name,
    },
    mode: filtered.mode,
    timestamp: Date.now(),
    rows: [...normalizedTrains, ...normalizedServices],
  });
});

export default r;
