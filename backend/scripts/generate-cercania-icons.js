import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { trainTypes } from "../src/db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const linesToGenerate = [
  { code: "C-1", color: "#3E8DCA" },
  { code: "C-2", color: "#F2C230" },
  { code: "C-3", color: "#B51EB8" },
  { code: "C-4", color: "#E5232C" },
  { code: "C-5", color: "#00853F" },
  { code: "C-6", color: "#004B9B" },
];

const uploadsDir = path.join(__dirname, "../uploads/destination-icons");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

function generateSVG(code, color) {
  const number = code.split("-")[1];
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
  <!-- Background circle -->
  <circle cx="50" cy="50" r="48" fill="${color}" />
  <!-- Inner circle for contrast -->
  <circle cx="50" cy="50" r="45" fill="${color}" />
  <!-- Text -->
  <text x="50" y="65" text-anchor="middle" font-size="48" font-weight="bold" fill="white" font-family="Arial, sans-serif">
    C${number}
  </text>
</svg>`;
}

console.log("Generando iconos de cercanías...");

linesToGenerate.forEach(({ code, color }) => {
  const svg = generateSVG(code, color);
  const filename = `cercania-${code.toLowerCase()}.svg`;
  const filepath = path.join(uploadsDir, filename);

  fs.writeFileSync(filepath, svg, "utf-8");
  console.log(`✓ Generado: ${filename}`);

  // Update DB
  const trainType = trainTypes.list().find(t => t.code === code);
  if (trainType) {
    trainTypes.update(trainType.id, {
      destination_icon_url: `/uploads/destination-icons/${filename}`
    });
    console.log(`  → BD actualizada: ${code}`);
  }
});

console.log("✓ Completado");
