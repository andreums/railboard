import { fileURLToPath } from "url";
import path from "path";

// Load the fixtures module relative to this file
const fixturesPath = new URL("../backend/src/fixtures/routes.js", import.meta.url).href;
const mod = await import(fixturesPath);
const RODALIA_ROUTES = mod.RODALIA_ROUTES ?? mod.default ?? mod;

function simulate(n = 50000) {
  const counts = Object.create(null);
  for (let i = 0; i < n; i++) {
    // replicate the weighted selection used in backend (counts=0)
    const pool = RODALIA_ROUTES.map((r) => ({ route: r, count: 0 }));
    const weights = pool.map((p) => 1 / (1 + p.count));
    const total = weights.reduce((a, b) => a + b, 0);
    let pick = Math.random() * total;
    let chosen = pool.length - 1;
    for (let j = 0; j < weights.length; j++) {
      pick -= weights[j];
      if (pick <= 0) {
        chosen = j;
        break;
      }
    }
    const code = pool[chosen % pool.length].route.code;
    counts[code] = (counts[code] || 0) + 1;
  }
  return counts;
}

function sortCounts(counts) {
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([code, c]) => ({ code, count: c }));
}

const n = process.argv[2] ? Number(process.argv[2]) : 50000;
console.log(`Simulating ${n} picks across ${RODALIA_ROUTES.length} routes...`);
const res = simulate(n);
const sorted = sortCounts(res);
console.log(sorted.slice(0, 40));
console.log("Full map:", JSON.stringify(res, null, 2));
