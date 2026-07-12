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
<svg viewBox="0 0 100 60" xmlns="http://www.w3.org/2000/svg">
  <!-- Rounded rectangle background -->
  <path d="M 15 0 L 85 0 Q 100 0 100 15 L 100 45 Q 100 60 85 60 L 15 60 Q 0 60 0 45 L 0 15 Q 0 0 15 0" fill="${color}" />
  <!-- Text -->
  <text x="50" y="42" text-anchor="middle" font-size="32" font-weight="bold" fill="white" font-family="Arial, sans-serif">
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
