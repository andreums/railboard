import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { trainTypes } from "../src/db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadsDir = path.join(__dirname, "../uploads/destination-icons");

// Renfe cercanías color (standard red/orange)
const RENFE_CERCANIA_COLOR = "#E5232C";

const renfeSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100.1 54.6">
  <!-- Oval background -->
  <path d="M75.1,0H24.9C11.2,0,0,11.2,0,24.9v4.8c0,13.7,11.2,24.9,24.9,24.9h50.3c13.7,0,24.9-11.2,24.9-24.9v-4.8 C100,11.2,88.8,0,75.1,0" fill="${RENFE_CERCANIA_COLOR}" />
  <!-- Text: RENFE -->
  <text x="50" y="36" text-anchor="middle" font-size="20" font-weight="bold" fill="white" font-family="Arial, sans-serif">
    RENFE
  </text>
</svg>`;

const filename = "renfe-cercania.svg";
const filepath = path.join(uploadsDir, filename);
fs.writeFileSync(filepath, renfeSvg, "utf-8");
console.log(`✓ Creado: ${filename}`);

// Update all cercanías train types to use generic Renfe icon
const allTypes = trainTypes.list();
const cercaniasTypes = allTypes.filter((t) => t.name.includes("Cercanías") || t.name.includes("cercanías"));

console.log(`Actualizando ${cercaniasTypes.length} líneas Renfe...`);
cercaniasTypes.forEach((type) => {
  trainTypes.update(type.id, {
    destination_icon_url: `/uploads/destination-icons/${filename}`,
  });
  console.log(`  ✓ ${type.code}: ${type.name}`);
});

console.log("✓ Completado");
