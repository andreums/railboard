import { db, operators, trainTypes, places, createTrain, setConfig } from "./db.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadsDir = path.resolve(__dirname, "../uploads");

// Ensure uploads directory exists
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Function to save SVG logo and return the path
function saveSvgLogo(name, svgContent) {
  const filename = `${name.toLowerCase().replace(/\s+/g, "-")}-logo.svg`;
  const filePath = path.join(uploadsDir, filename);
  fs.writeFileSync(filePath, svgContent);
  return `/uploads/${filename}`;
}

// Operator logos (SVG)
const renfeLogoSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 100">
  <rect width="200" height="100" fill="#7c1d2e"/>
  <text x="100" y="55" font-size="32" font-weight="bold" text-anchor="middle" fill="white" font-family="Arial">RENFE</text>
</svg>`;

const avloLogoSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 100">
  <rect width="200" height="100" fill="#5b1fb8"/>
  <text x="100" y="55" font-size="28" font-weight="bold" text-anchor="middle" fill="white" font-family="Arial">AVLO</text>
</svg>`;

const iryoLogoSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 100">
  <rect width="200" height="100" fill="#1f4e78"/>
  <text x="100" y="55" font-size="28" font-weight="bold" text-anchor="middle" fill="white" font-family="Arial">IRYO</text>
</svg>`;

const ouigoLogoSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 100">
  <rect width="200" height="100" fill="#f79646"/>
  <text x="100" y="55" font-size="28" font-weight="bold" text-anchor="middle" fill="white" font-family="Arial">OUIGO</text>
</svg>`;

// Train type logos (SVG)
const aveLogoSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 100">
  <rect width="200" height="100" fill="#7c1d2e"/>
  <text x="100" y="55" font-size="24" font-weight="bold" text-anchor="middle" fill="white" font-family="Arial">AVE</text>
</svg>`;

const alviaLogoSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 100">
  <rect width="200" height="100" fill="#1f6fb2"/>
  <text x="100" y="55" font-size="20" font-weight="bold" text-anchor="middle" fill="white" font-family="Arial">ALVIA</text>
</svg>`;

const icLogoSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 100">
  <rect width="200" height="100" fill="#2b6e3f"/>
  <text x="100" y="55" font-size="24" font-weight="bold" text-anchor="middle" fill="white" font-family="Arial">IC</text>
</svg>`;

const mdLogoSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 100">
  <rect width="200" height="100" fill="#b25a1f"/>
  <text x="100" y="55" font-size="20" font-weight="bold" text-anchor="middle" fill="white" font-family="Arial">MD</text>
</svg>`;

const cercaniasSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 100">
  <rect width="200" height="100" fill="#c2185b"/>
  <text x="100" y="55" font-size="16" font-weight="bold" text-anchor="middle" fill="white" font-family="Arial">CERCANÍAS</text>
</svg>`;

console.log("Seeding RailBoard…");

db.exec("DELETE FROM trains; DELETE FROM operators; DELETE FROM train_types; DELETE FROM places;");

setConfig({ station_name: "MADRID PUERTA DE ATOCHA", mode: "departures", displayMode: "multiple" });

operators.create({
  name: "Renfe",
  logo_url: saveSvgLogo("renfe", renfeLogoSvg)
});
operators.create({
  name: "Avlo",
  logo_url: saveSvgLogo("avlo", avloLogoSvg)
});
operators.create({
  name: "Iryo",
  logo_url: saveSvgLogo("iryo", iryoLogoSvg)
});
operators.create({
  name: "Ouigo",
  logo_url: saveSvgLogo("ouigo", ouigoLogoSvg)
});

trainTypes.create({
  code: "AVE",
  name: "Alta Velocidad",
  color: "#7c1d2e",
  logo_url: saveSvgLogo("ave", aveLogoSvg)
});
trainTypes.create({
  code: "AVLO",
  name: "Avlo",
  color: "#5b1fb8",
  logo_url: saveSvgLogo("avlo-type", avloLogoSvg)
});
trainTypes.create({
  code: "ALVIA",
  name: "Alvia",
  color: "#1f6fb2",
  logo_url: saveSvgLogo("alvia", alviaLogoSvg)
});
trainTypes.create({
  code: "IC",
  name: "Intercity",
  color: "#2b6e3f",
  logo_url: saveSvgLogo("ic", icLogoSvg)
});
trainTypes.create({
  code: "MD",
  name: "Media Distancia",
  color: "#b25a1f",
  logo_url: saveSvgLogo("md", mdLogoSvg)
});
trainTypes.create({
  code: "C",
  name: "Cercanías",
  color: "#c2185b",
  logo_url: saveSvgLogo("cercanias", cercaniasSvg)
});

[
  "Madrid Puerta de Atocha", "Barcelona Sants", "Sevilla Santa Justa",
  "Valencia Joaquín Sorolla", "Zaragoza Delicias", "Málaga María Zambrano",
  "Córdoba Central", "Alicante Terminal", "Murcia del Carmen",
  "Toledo", "Cuenca Fernando Zóbel", "Albacete Los Llanos",
  "Tarragona Camp", "Lleida Pirineus", "Girona",
].forEach((n) => places.create({ name: n }));

const ops = operators.list();
const types = trainTypes.list();
const opId = (name) => ops.find((o) => o.name === name)?.id;
const typeId = (code) => types.find((t) => t.code === code)?.id;

const now = new Date();
const hhmm = (offsetMin) => {
  const d = new Date(now.getTime() + offsetMin * 60_000);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

const fixtures = [
  {
    number: "03104", op: "Renfe", type: "AVE", destination: "Barcelona Sants",
    stops: ["Zaragoza Delicias", "Tarragona Camp"], platform: "5", sector: "B", min: 8, status: "Boarding"
  },
  {
    number: "06112", op: "Avlo", type: "AVLO", destination: "Valencia Joaquín Sorolla",
    stops: ["Cuenca Fernando Zóbel"], platform: "9", sector: "C", min: 15, status: "Scheduled"
  },
  {
    number: "02087", op: "Renfe", type: "ALVIA", destination: "Sevilla Santa Justa",
    stops: ["Córdoba Central"], platform: "11", sector: "A", min: 22, status: "Scheduled"
  },
  {
    number: "00451", op: "Renfe", type: "IC", destination: "Murcia del Carmen",
    stops: ["Albacete Los Llanos"], platform: "3", sector: "D", min: 31, status: "Delayed", delay: 10
  },
  {
    number: "18021", op: "Renfe", type: "MD", destination: "Toledo",
    stops: [], platform: "1", sector: "A", min: 5, status: "Boarding"
  },
  {
    number: "03210", op: "Iryo", type: "AVE", destination: "Málaga María Zambrano",
    stops: ["Córdoba Central"], platform: "7", sector: "B", min: 45, status: "Scheduled"
  },
  {
    number: "06440", op: "Ouigo", type: "AVE", destination: "Barcelona Sants",
    stops: ["Zaragoza Delicias"], platform: "8", sector: "C", min: 52, status: "Scheduled"
  },
  {
    number: "00112", op: "Renfe", type: "C", destination: "Alcalá de Henares",
    stops: [], platform: "2", sector: "A", min: 2, status: "Departed"
  },
  {
    number: "02540", op: "Renfe", type: "AVE", destination: "Alicante Terminal",
    stops: ["Cuenca Fernando Zóbel", "Albacete Los Llanos"], platform: "6", sector: "B", min: 67, status: "Cancelled"
  },
];

for (const f of fixtures) {
  const sched = hhmm(f.min);
  const expected = f.delay ? hhmm(f.min + f.delay) : sched;
  createTrain({
    number: f.number,
    operator_id: opId(f.op),
    train_type_id: typeId(f.type),
    station_id: 1,
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

console.log("Seed complete — ", fixtures.length, "trains.");
