import { readFileSync, writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const localesDir = resolve(__dirname, "../locales");

function load(lang) {
  return JSON.parse(readFileSync(resolve(localesDir, `${lang}.json`), "utf-8"));
}

function save(lang, data) {
  writeFileSync(resolve(localesDir, `${lang}.json`), JSON.stringify(data, null, 2) + "\n", "utf-8");
}

function deepMerge(target, source, path = "") {
  for (const key of Object.keys(source)) {
    const fullPath = path ? `${path}.${key}` : key;
    if (typeof source[key] === "object" && source[key] !== null && !Array.isArray(source[key])) {
      if (!target[key] || typeof target[key] !== "object") target[key] = {};
      deepMerge(target[key], source[key], fullPath);
    } else {
      if (!(key in target)) {
        target[key] = source[key];
        console.log(`  + ${fullPath}`);
      }
    }
  }
}

const SECTIONS_TO_FILL = ["events", "blocks", "service_intro", "closing_messages", "attention", "accessibility", "stopping_patterns", "fare_restrictions", "pre_recorded_fragments"];

const locales = ["ca", "en", "es", "eu", "gl", "va"];
const references = {
  va: "ca",
  gl: "es",
  eu: "ca",
};

for (const lang of locales) {
  if (lang === "ca" || lang === "en" || lang === "es") {
    console.log(`\n${lang}: already complete, skipping`);
    continue;
  }
  const refLang = references[lang];
  console.log(`\n${lang}: filling from ${refLang}...`);
  const target = load(lang);
  const source = load(refLang);
  for (const section of SECTIONS_TO_FILL) {
    if (source[section] && typeof source[section] === "object") {
      if (!target[section]) target[section] = {};
      console.log(`  ${section}:`);
      deepMerge(target[section], source[section], section);
    }
  }
  save(lang, target);
  console.log(`  done`);
}
