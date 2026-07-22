const https = require("https");
const fs = require("fs");
const path = require("path");

const URLS = [
  "https://fonts.googleapis.com/css2?family=Bebas+Neue&display=swap",
  "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap",
  "https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@500;700&display=swap",
  "https://fonts.googleapis.com/css2?family=Oswald:wght@400;600;700&display=swap",
  "https://fonts.googleapis.com/css2?family=Roboto+Condensed:wght@300;400;700&display=swap",
  "https://fonts.googleapis.com/css2?family=Roboto+Mono:wght@400;700&display=swap",
];

const FONTS_DIR = path.resolve(__dirname, "../frontend/public/fonts");

if (!fs.existsSync(FONTS_DIR)) fs.mkdirSync(FONTS_DIR, { recursive: true });

function fetch(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, { headers: { "User-Agent": "Mozilla/5.0" } }, (res) => {
        let data = "";
        res.on("data", (c) => (data += c));
        res.on("end", () => resolve(data));
      })
      .on("error", reject);
  });
}

function download(url, dest) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        const file = fs.createWriteStream(dest);
        res.pipe(file);
        file.on("finish", () => {
          file.close();
          resolve();
        });
      })
      .on("error", reject);
  });
}

(async () => {
  const cssLines = [];
  const seen = new Set();

  for (const url of URLS) {
    const css = await fetch(url);
    for (const line of css.split("\n")) {
      const m = line.match(/src:\s*url\(([^)]+)\)/);
      if (m) {
        const fontUrl = m[1].replace(/^https?:/, "https:");
        const filename = fontUrl.split("/").pop().split("?")[0];
        const dest = path.join(FONTS_DIR, filename);
        if (!seen.has(filename)) {
          seen.add(filename);
          console.log(`Downloading ${filename}...`);
          await download(fontUrl, dest);
        }
        cssLines.push(line.replace(fontUrl, `/fonts/${filename}`));
      } else {
        cssLines.push(line);
      }
    }
  }

  const output = cssLines
    .join("\n")
    .replace(/\/\* \[[^\]]+\] \*\//g, "")
    .trim();
  fs.writeFileSync(path.resolve(FONTS_DIR, "fonts.css"), output);
  console.log(`Done — ${seen.size} font files downloaded, fonts.css generated.`);
})().catch(console.error);
