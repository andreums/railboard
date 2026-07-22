import { setConfig } from "../backend/src/db.js";

const arg = process.argv[2];
const value = typeof arg === "string" ? arg : "";
setConfig({ station_name: value });
console.log(`Set config.station_name = "${value}"`);
