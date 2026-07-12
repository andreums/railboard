import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { trainTypes } from "../src/db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Get all cercanías types from DB
const allTypes = trainTypes.list();
const cercaniasTypes = allTypes.filter(t =>
  t.name.includes("Cercanías") || t.name.includes("cercanías")
);

const linesToGenerate = cercaniasTypes.map(t => ({
  code: t.code,
  color: t.color,
  id: t.id
}));

const uploadsDir = path.join(__dirname, "../uploads/destination-icons");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

function generateSVG(code, color) {
  const parts = code.split("-");
  const displayCode = parts.length > 1 ? parts[1] : code;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100.1 54.6">
  <!-- Oval background (ADIF style) -->
  <path d="M75.1,0H24.9C11.2,0,0,11.2,0,24.9v4.8c0,13.7,11.2,24.9,24.9,24.9h50.3c13.7,0,24.9-11.2,24.9-24.9v-4.8 C100,11.2,88.8,0,75.1,0" fill="${color}" />
  <!-- Text -->
  <text x="50" y="36" text-anchor="middle" font-size="28" font-weight="bold" fill="white" font-family="Arial, sans-serif">
    C${displayCode}
  </text>
</svg>`;
}

console.log(`Generando iconos de cercanías (${linesToGenerate.length} líneas)...`);

linesToGenerate.forEach(({ code, color, id }) => {
  const svg = generateSVG(code, color);
  const filename = `cercania-${code.toLowerCase().replace("-", "")}.svg`;
  const filepath = path.join(uploadsDir, filename);

  fs.writeFileSync(filepath, svg, "utf-8");
  console.log(`✓ Generado: ${filename}`);

  // Update DB
  trainTypes.update(id, {
    destination_icon_url: `/uploads/destination-icons/${filename}`
  });
  console.log(`  → BD actualizada: ${code}`);
});

console.log(`✓ Completado (${linesToGenerate.length} iconos generados)`);
