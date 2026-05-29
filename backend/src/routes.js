import { Router } from "express";
import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";
import {
  db,
  getConfig, setConfig,
  listTrains, createTrain, updateTrain, deleteTrain, getTrain,
  addMinutes,
  operators, trainTypes, places,
} from "./db.js";
import { broadcast } from "./ws.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const upload = multer({
  storage: multer.diskStorage({
    destination: path.resolve(__dirname, "../uploads"),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname);
      cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
    },
  }),
  limits: { fileSize: 2 * 1024 * 1024 },
});

const r = Router();
const ping = () => broadcast({ type: "update", at: Date.now() });

const RODALIA_ROUTES = [
  {
    code: "C-1",
    name: "Rodalia C-1",
    color: "#3E8DCA",
    headwayMin: 20,
    platforms: ["1", "2", "3"],
    numbers: ["14101", "14103", "14105", "14107", "14109", "14111", "14113", "14115", "14117", "14119", "14121", "14123", "14125", "14127"],
    stations: [
      "València Nord",
      "Alfafar-Benetússer",
      "Massanassa",
      "Catarroja",
      "Silla",
      "El Romaní",
      "Sollana",
      "Sueca",
      "Cullera",
      "Tavernes de la Valldigna",
      "Xeraco",
      "Gandia",
      "Platja i Grau Gandia",
    ],
  },
  {
    code: "C-2",
    name: "Rodalia C-2",
    color: "#F2C230",
    headwayMin: 15,
    platforms: ["1", "2", "3"],
    numbers: ["24001", "24003", "24005", "24007", "24009", "24011", "24013", "24015", "24017", "24019", "24023", "24027", "24029", "24031", "24033", "24035", "24037", "24039", "24041", "24043", "24047", "24049", "24051", "24055", "24057", "24059", "24061", "24067", "24069", "24071", "24073", "24075", "24077", "24079", "24083", "24085", "24087", "24091", "24093", "24095", "24097", "24099", "36433", "36453", "36457"],
    stations: [
      "València Estació del Nord",
      "Alfafar-Benetússer",
      "Massanassa",
      "Catarroja",
      "Silla",
      "Benifaió-Almussafes",
      "Algemesí",
      "Alzira",
      "Carcaixent",
      "La Pobla Llarga",
      "L'Ènova-Manuel",
      "Xàtiva",
      "L'Alcúdia de Crespins",
      "Montesa",
      "Vallada",
      "Moixent",
    ],
  },
  {
    code: "C-6",
    name: "Rodalia C-6",
    color: "#004B9B",
    headwayMin: 30,
    platforms: ["5", "6", "7"],
    numbers: ["38002", "38004", "38006", "38008", "38010", "38012", "38014", "38016", "38018", "38020", "38022", "38024", "38026", "38028", "38030", "38032", "38034", "38036", "38038", "38040", "38042", "38044", "38046", "38048", "38050", "38052", "38054", "38056", "38058", "38060", "38062", "38064"],
    stations: [
      "Castelló de la Plana",
      "Almassora",
      "Vila-real",
      "Borriana-Alqueries",
      "Nules-La Vilavella",
      "Moncofa",
      "Xilxes",
      "La Llosa",
      "Almenara",
      "Les Valls",
      "Sagunt",
      "Puçol",
      "El Puig",
      "Massalfassar",
      "Albuixech",
      "Roca-Cúper",
      "València-Cabanyal",
      "València-Font de Sant Lluís",
      "València Nord",
    ],
  },
  {
    code: "C-3",
    name: "Rodalia C-3",
    color: "#B51EB8",
    headwayMin: 45,
    platforms: ["4", "5", "6"],
    numbers: ["34001", "34003", "34005", "34007", "34009", "34011", "34013", "34015", "34017", "34019", "34021", "34023", "34025", "34027", "34029", "34031", "34033", "34035", "34037", "34039", "34041", "34043", "34045", "34047", "34049", "34051", "34053", "34055", "34101", "34103", "34105", "34107"],
    stations: [
      "Utiel",
      "San Antonio de Requena",
      "Requena",
      "El Rebollar",
      "Siete Aguas",
      "Venta Mina",
      "Buñol",
      "Chiva",
      "Cheste",
      "Circuito Ricardo Tormo",
      "Loriguilla-Reva",
      "Aldaia",
      "Xirivella-Alqueries",
      "València-Sant Isidre",
      "València la Font de Sant Lluís",
      "València Nord",
    ],
  },
  {
    code: "C-4",
    name: "Rodalia C-4",
    color: "#E5232C",
    headwayMin: 40,
    platforms: ["3", "4", "5"],
    numbers: ["34401", "34403", "34405", "34407", "34409", "34411", "34413", "34415", "34417", "34419", "34421", "34423"],
    stations: [
      "València Nord",
      "Xirivella-Alqueries",
      "Quart de Poble",
      "Manises",
      "Manises Aeroport",
      "La Presa",
      "Masia de Traver",
      "Riba-roja de Túria",
    ],
  },
  {
    code: "C-5",
    name: "Rodalia C-5",
    color: "#00853F",
    headwayMin: 55,
    platforms: ["6", "7", "8"],
    numbers: ["34501", "34503", "34505", "34507", "34509", "34511", "34513", "34515", "34517", "34519", "34521", "34523"],
    stations: [
      "València Nord",
      "València la Font de Sant Lluís",
      "València-Cabanyal",
      "Roca-Cúper",
      "Albuixech",
      "Massalfassar",
      "El Puig",
      "Puçol",
      "Sagunt",
      "Gilet",
      "Estivella-Albalat dels Tarongers",
      "Algimia-Ciudad",
      "Soneja",
      "Segorbe-Ciudad",
      "Segorbe-Arrabal",
      "Navajas",
      "Jérica-Viver",
      "Caudiel",
    ],
  },
  {
    code: "EMD",
    name: "Euromed",
    color: "#A50073",
    headwayMin: 50,
    platforms: ["8", "9", "10", "11"],
    numbers: ["01071", "01081", "01101", "01121", "01131", "01141", "01151", "01161", "01171", "01181"],
    stations: [
      "Barcelona-Sants",
      "Camp De Tarragona",
      "Castelló De La Plana",
      "València-Estació Del Nord",
      "Alicante/Alacant-Terminal",
    ],
  },
  {
    code: "R16",
    name: "R16 Regional",
    color: "#B0003A",
    headwayMin: 55,
    platforms: ["7", "8", "9", "10"],
    numbers: ["18121", "18123", "18125", "18127", "18129", "18131", "18133", "18135", "18055", "18093", "30718", "30722", "33704", "33968"],
    stations: [
      "El Prat de Llobregat",
      "Vilanova i la Geltrú",
      "Sant Vicenç de Calders",
      "Torredembarra",
      "Altafulla-Tamarit",
      "Tarragona",
      "Vila-seca",
      "Cambrils",
      "L'Hospitalet de l'Infant",
      "L'Ametlla de Mar",
      "L'Ampolla-Perelló-Deltebre",
      "Camp-redó",
      "Tortosa",
      "L'Aldea-Amposta-Tortosa",
      "Ulldecona-Alcanar-La Sénia",
      "Vinaròs",
      "Benicarló-Peñíscola",

      "Alcalà de Xivert",
      "Castelló de la Plana",
    ],
  },
  {
    code: "R1",
    name: "R1 Barcelona",
    color: "#4BA6E0",
    operator: "Renfe",
    headwayMin: 18,
    platforms: ["1", "2", "3", "4"],
    numbers: ["25101", "25103", "25105", "25107", "25109", "25111", "25113", "25115", "25117", "25119", "25121", "25123"],
    stations: [
      "Molins de Rei",
      "Barcelona-Sants",
      "Plaça de Catalunya",
      "Arc de Triomf",
      "El Clot-Aragó",
      "Sant Adrià de Besòs",
      "Badalona",
      "Montgat",
      "El Masnou",
      "Ocata",
      "Premià de Mar",
      "Vilassar de Mar",
      "Mataró",
      "Arenys de Mar",
      "Canet de Mar",
      "Sant Pol de Mar",
      "Calella",
      "Pineda de Mar",
      "Santa Susanna",
      "Malgrat de Mar",
      "Blanes",
      "Tordera",
      "Maçanet-Massanes",
    ],
  },
  {
    code: "R2",
    name: "R2 Barcelona",
    color: "#007A3D",
    operator: "Renfe",
    headwayMin: 20,
    platforms: ["5", "6", "7", "8"],
    numbers: ["25201", "25203", "25205", "25207", "25209", "25211", "25213", "25215", "25217", "25219", "25221", "25223"],
    stations: [
      "Sant Vicenç de Calders",
      "Vilanova i la Geltrú",
      "Sitges",
      "Garraf",
      "Castelldefels",
      "Gavà",
      "Viladecans",
      "El Prat de Llobregat",
      "Bellvitge",
      "Barcelona-Sants",
      "Passeig de Gràcia",
      "El Clot-Aragó",
      "Sant Andreu Comtal",
      "Granollers Centre",
      "Cardedeu",
      "Sant Celoni",
      "Hostalric",
      "Maçanet-Massanes",
    ],
  },
  {
    code: "R2N",
    name: "R2 Nord",
    color: "#8BC53F",
    operator: "Renfe",
    headwayMin: 30,
    platforms: ["9", "10"],
    numbers: ["25301", "25303", "25305", "25307", "25309", "25311", "25313", "25315"],
    stations: [
      "Aeroport",
      "El Prat de Llobregat",
      "Bellvitge",
      "Barcelona-Sants",
      "Passeig de Gràcia",
      "El Clot-Aragó",
      "Sant Andreu Comtal",
      "Granollers Centre",
      "Cardedeu",
      "Sant Celoni",
      "Hostalric",
      "Maçanet-Massanes",
    ],
  },
  {
    code: "R3",
    name: "R3 Barcelona",
    color: "#E2332A",
    operator: "Renfe",
    headwayMin: 35,
    platforms: ["6", "7", "8"],
    numbers: ["25401", "25403", "25405", "25407", "25409", "25411", "25413", "25415", "25417", "25419"],
    stations: [
      "L'Hospitalet de Llobregat",
      "Barcelona-Sants",
      "Plaça de Catalunya",
      "Arc de Triomf",
      "La Sagrera-Meridiana",
      "Montcada Bifurcació",
      "Montcada Ripollet",
      "Cerdanyola del Vallès",
      "Barberà del Vallès",
      "Sabadell Sud",
      "Sabadell Centre",
      "Sabadell Nord",
      "Terrassa Estació del Nord",
      "Granollers-Canovelles",
      "La Garriga",
      "Vic",
      "Ripoll",
      "Puigcerdà",
    ],
  },
  {
    code: "R4",
    name: "R4 Barcelona",
    color: "#F4A236",
    operator: "Renfe",
    headwayMin: 20,
    platforms: ["3", "4", "5", "6"],
    numbers: ["25501", "25503", "25505", "25507", "25509", "25511", "25513", "25515", "25517", "25519", "25521", "25523"],
    stations: [
      "Sant Vicenç de Calders",
      "El Vendrell",
      "L'Arboç",
      "Els Monjos",
      "Vilafranca del Penedès",
      "La Granada",
      "Sant Sadurní d'Anoia",
      "Gelida",
      "Martorell",
      "Molins de Rei",
      "L'Hospitalet de Llobregat",
      "Barcelona-Sants",
      "Plaça de Catalunya",
      "Arc de Triomf",
      "Sant Andreu Arenal",
      "Cerdanyola del Vallès",
      "Sabadell Centre",
      "Terrassa",
      "Manresa",
    ],
  },
  {
    code: "R7",
    name: "R7 Barcelona",
    color: "#8A4FA8",
    operator: "Renfe",
    headwayMin: 45,
    platforms: ["2", "3", "4"],
    numbers: ["25701", "25703", "25705", "25707", "25709", "25711"],
    stations: [
      "Barcelona-Sants",
      "Plaça de Catalunya",
      "Arc de Triomf",
      "La Sagrera-Meridiana",
      "Cerdanyola del Vallès",
      "Cerdanyola Universitat",
    ],
  },
  {
    code: "R8",
    name: "R8 Barcelona",
    color: "#8A1F62",
    operator: "Renfe",
    headwayMin: 45,
    platforms: ["2", "3", "4"],
    numbers: ["25801", "25803", "25805", "25807", "25809", "25811"],
    stations: [
      "Martorell",
      "Castellbisbal",
      "Rubí",
      "Sant Cugat del Vallès",
      "Cerdanyola Universitat",
      "Barberà del Vallès",
      "Mollet-Sant Fost",
      "Granollers Centre",
    ],
  },
  {
    code: "AVANT",
    name: "Avant",
    color: "#6B7280",
    operator: "Renfe",
    headwayMin: 70,
    platforms: ["7", "8", "9", "10"],
    numbers: ["08121", "08123", "08125", "08127", "08129", "08131", "08133", "08135"],
    stations: [
      "Madrid Puerta de Atocha",
      "Segovia Guiomar",
      "Valladolid-Campo Grande",
      "Palencia",
      "León",
    ],
  },
  {
    code: "MD",
    name: "Media Distancia",
    color: "#B25A1F",
    operator: "Renfe",
    headwayMin: 50,
    platforms: ["4", "5", "6", "7", "8"],
    numbers: ["18021", "18031", "18041", "18051", "18061", "18071", "18081", "18091", "18101", "18111", "18141", "18151"],
    stations: [
      "Barcelona-Sants",
      "Vilanova i la Geltrú",
      "Sant Vicenç de Calders",
      "Tarragona",
      "Reus",
      "Lleida Pirineus",
      "Zaragoza Delicias",
    ],
  },
];

function ensureLearnedRailData() {
  const baseOperators = ["Renfe", "Iryo", "Ouigo", "SNCF"];
  const knownOperators = new Set(operators.list().map((o) => o.name));
  for (const opName of baseOperators) {
    if (!knownOperators.has(opName)) {
      operators.create({ name: opName });
      knownOperators.add(opName);
    }
  }

  const knownTypes = trainTypes.list().map((t) => t.code);
  for (const route of RODALIA_ROUTES) {
    if (!knownTypes.includes(route.code)) {
      trainTypes.create({ code: route.code, name: route.name, color: route.color });
    }
  }

  const knownPlaces = new Set(places.list().map((p) => p.name));
  for (const route of RODALIA_ROUTES) {
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

const minutesUntilHHMM = (hhmm) => {
  let diff = minutesFromHHMM(hhmm) - (new Date().getHours() * 60 + new Date().getMinutes());
  if (diff < -12 * 60) diff += 24 * 60;
  if (diff > 12 * 60) diff -= 24 * 60;
  return diff;
};

// ----- config -----
r.get("/config", (_req, res) => res.json(getConfig()));
r.put("/config", (req, res) => {
  setConfig(req.body || {});
  ping();
  res.json(getConfig());
});

// ----- trains -----
r.get("/trains", (_req, res) => res.json(listTrains()));

r.delete("/trains", (_req, res) => {
  db.exec("DELETE FROM trains");
  ping();
  res.status(204).end();
});

function reorderTrains(ids) {
  const stmt = db.prepare("UPDATE trains SET sort_order = ? WHERE id = ?");
  ids.forEach((id, idx) => stmt.run(idx, id));
}

r.put("/trains/reorder", (req, res) => {
  reorderTrains(req.body.ids);
  ping();
  res.json(listTrains());
});

r.post("/trains", (req, res) => {
  const t = createTrain(req.body);
  ping();
  res.status(201).json(t);
});
r.put("/trains/:id", (req, res) => {
  const t = updateTrain(Number(req.params.id), req.body);
  if (!t) return res.status(404).end();
  ping();
  res.json(t);
});
r.patch("/trains/:id/status", (req, res) => {
  const t = updateTrain(Number(req.params.id), { status: req.body.status });
  if (!t) return res.status(404).end();
  ping();
  res.json(t);
});
r.patch("/trains/:id/delay", (req, res) => {
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
r.patch("/trains/:id/platform", (req, res) => {
  const t = updateTrain(Number(req.params.id), {
    platform: req.body.platform,
    sector: req.body.sector,
  });
  if (!t) return res.status(404).end();
  ping();
  res.json(t);
});
r.delete("/trains/:id", (req, res) => {
  deleteTrain(Number(req.params.id));
  ping();
  res.status(204).end();
});

// ----- operators -----
r.get("/operators", (_req, res) => res.json(operators.list()));
r.post("/operators", upload.single("logo"), (req, res) => {
  const logo_url = req.file ? `/uploads/${req.file.filename}` : null;
  operators.create({ name: req.body.name, logo_url });
  ping();
  res.status(201).json(operators.list());
});
r.put("/operators/:id", upload.single("logo"), (req, res) => {
  const id = Number(req.params.id);
  const logo_url = req.file ? `/uploads/${req.file.filename}` : req.body.logo_url;
  operators.update(id, { name: req.body.name, logo_url });
  ping();
  res.json(operators.list());
});
r.delete("/operators/:id", (req, res) => {
  operators.remove(Number(req.params.id));
  ping();
  res.status(204).end();
});

// ----- train types -----
r.get("/train-types", (_req, res) => res.json(trainTypes.list()));
r.post("/train-types", upload.single("logo"), (req, res) => {
  const logo_url = req.file ? `/uploads/${req.file.filename}` : null;
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
    });
  } else {
    trainTypes.create({
      code,
      name: req.body.name,
      color: req.body.color,
      logo_url,
    });
  }
  ping();
  res.status(statusCode).json(trainTypes.list());
});
r.put("/train-types/:id", upload.single("logo"), (req, res) => {
  const id = Number(req.params.id);
  const logo_url = req.file ? `/uploads/${req.file.filename}` : req.body.logo_url;
  trainTypes.update(id, {
    code: req.body.code,
    name: req.body.name,
    color: req.body.color,
    logo_url,
  });
  ping();
  res.json(trainTypes.list());
});
r.delete("/train-types/:id", (req, res) => {
  trainTypes.remove(Number(req.params.id));
  ping();
  res.status(204).end();
});

// ----- places -----
r.get("/places", (_req, res) => res.json(places.list()));
r.post("/places", upload.single("logo"), (req, res) => {
  const logo_url = req.file ? `/uploads/${req.file.filename}` : null;
  places.create({ name: req.body.name, logo_url });
  ping();
  res.status(201).json(places.list());
});
r.put("/places/:id", upload.single("logo"), (req, res) => {
  const id = Number(req.params.id);
  const logo_url = req.file ? `/uploads/${req.file.filename}` : req.body.logo_url;
  places.update(id, { name: req.body.name, logo_url });
  ping();
  res.json(places.list());
});
r.delete("/places/:id", (req, res) => {
  places.remove(Number(req.params.id));
  ping();
  res.status(204).end();
});

// ----- seed (load demo trains) -----
r.post("/seed-trains", (_req, res) => {
  // Delete existing trains
  db.exec("DELETE FROM trains");

  // Ensure operators exist
  const opList = operators.list().map((o) => o.name);
  if (!opList.includes("Renfe")) operators.create({ name: "Renfe" });
  if (!opList.includes("Avlo")) operators.create({ name: "Avlo" });
  if (!opList.includes("Iryo")) operators.create({ name: "Iryo" });
  if (!opList.includes("Ouigo")) operators.create({ name: "Ouigo" });

  // Ensure train types exist
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

  const fixtures = [
    { number: "03104", op: "Renfe", type: "AVE", destination: "Barcelona Sants", stops: ["Zaragoza Delicias", "Tarragona Camp"], platform: "5", sector: "B", min: 8, status: "Boarding" },
    { number: "06112", op: "Avlo", type: "AVLO", destination: "Valencia Joaquín Sorolla", stops: ["Cuenca Fernando Zóbel"], platform: "9", sector: "C", min: 15, status: "Scheduled" },
    { number: "02087", op: "Renfe", type: "ALVIA", destination: "Sevilla Santa Justa", stops: ["Córdoba Central"], platform: "11", sector: "A", min: 22, status: "Scheduled" },
    { number: "00451", op: "Renfe", type: "IC", destination: "Murcia del Carmen", stops: ["Albacete Los Llanos"], platform: "3", sector: "D", min: 31, status: "Delayed", delay: 10 },
    { number: "18021", op: "Renfe", type: "MD", destination: "Toledo", stops: [], platform: "1", sector: "A", min: 5, status: "Boarding" },
    { number: "03210", op: "Iryo", type: "AVE", destination: "Málaga María Zambrano", stops: ["Córdoba Central"], platform: "7", sector: "B", min: 45, status: "Scheduled" },
    { number: "06440", op: "Ouigo", type: "AVE", destination: "Barcelona Sants", stops: ["Zaragoza Delicias"], platform: "8", sector: "C", min: 52, status: "Scheduled" },
    { number: "00112", op: "Renfe", type: "C", destination: "Alcalá de Henares", stops: [], platform: "2", sector: "A", min: 2, status: "Departed" },
    { number: "02540", op: "Renfe", type: "AVE", destination: "Alicante Terminal", stops: ["Cuenca Fernando Zóbel", "Albacete Los Llanos"], platform: "6", sector: "B", min: 67, status: "Cancelled" },
  ];

  for (const f of fixtures) {
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
r.post("/generate-random-train", (_req, res) => {
  ensureLearnedRailData();

  const opList = operators.list();
  const typeList = trainTypes.list();
  const placeList = places.list();

  if (opList.length === 0 || typeList.length === 0 || placeList.length === 0) {
    return res.status(400).json({ error: "Need at least one operator, train type, and place" });
  }

  const randomItem = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
  const hhmmFromOffset = (offsetMin) => {
    const d = new Date(Date.now() + offsetMin * 60_000);
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  };
  const statusForOffset = (offset) => {
    if (offset <= 8) return "Boarding";
    const roll = Math.random();
    if (roll < 0.08) return "Cancelled";
    if (roll < 0.22) return "Delayed";
    if (roll < 0.28) return "Advanced";
    return "Scheduled";
  };
  const config = getConfig();
  const mode = config.mode === "arrivals" ? "arrivals" : "departures";
  const station = config.station_name || "Madrid Puerta de Atocha";
  const routesAtStation = RODALIA_ROUTES.filter((r) => stationIndex(r.stations, station) >= 0);
  const routePool = routesAtStation.length ? routesAtStation : RODALIA_ROUTES;
  const existing = listTrains().filter((t) => !["Departed", "Arrived"].includes(t.status));
  const routeCounts = new Map();
  for (const train of existing) routeCounts.set(train.type_code, (routeCounts.get(train.type_code) || 0) + 1);
  const route = [...routePool].sort((a, b) => (routeCounts.get(a.code) || 0) - (routeCounts.get(b.code) || 0))[0] || randomItem(routePool);
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
    .map((t) => minutesUntilHHMM(t.scheduled_time))
    .filter((offset) => offset > -5)
    .sort((a, b) => a - b);
  const lastOffset = sameLineUpcoming.length ? sameLineUpcoming[sameLineUpcoming.length - 1] : randomInt(2, 10);
  const scheduledOffset = Math.min(240, Math.max(3, lastOffset + route.headwayMin + randomInt(-3, 4)));
  const rawStatus = statusForOffset(scheduledOffset);
  const expectedOffset = rawStatus === "Delayed"
    ? scheduledOffset + randomInt(5, 18)
    : rawStatus === "Advanced"
      ? Math.max(1, scheduledOffset - randomInt(2, 8))
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
  const observations = randomItem([
    "",
    "",
    "",
    "",
    "Por obras en el corredor",
    "Tren con parada en todas las estaciones",
    "Servicio sujeto a regulación de tráfico",
  ]);

  const train = createTrain({
    number: availableNumbers.length ? randomItem(availableNumbers) : randomItem(route.numbers),
    operator_id: op.id,
    train_type_id: type.id,
    origin: route.stations[fromIndex],
    destination: route.stations[toIndex],
    stops,
    scheduled_time: hhmmFromOffset(scheduledOffset),
    expected_time: hhmmFromOffset(expectedOffset),
    platform: randomItem(route.platforms),
    sector: "",
    status,
    observations,
  });

  ping();
  res.status(201).json(train);
});

export default r;
