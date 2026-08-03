import crypto from "crypto";
import path from "path";
import fs from "fs";
import { execFile } from "child_process";
import { fileURLToPath } from "url";
import https from "https";
import WebSocket from "ws";
import logger from "../logger.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TTS_CACHE_DIR = path.resolve(__dirname, "../../uploads/tts");

if (!fs.existsSync(TTS_CACHE_DIR)) {
  fs.mkdirSync(TTS_CACHE_DIR, { recursive: true });
}

const LANG_TO_SAY = {
  es: "Mónica",
  ca: "Montse",
  en: "Samantha",
  fr: "Thomas",
  eu: "Mikel",
  gl: "Mónica",
};

const LANG_TO_EDGE = {
  es: "es-ES-ElviraNeural",
  ca: "ca-ES-JoanaNeural",
  en: "en-GB-SoniaNeural",
  fr: "fr-FR-DeniseNeural",
  eu: "eu-ES-AinhoaNeural",
  gl: "gl-ES-RoiNeural",
};

class TTSService {
  constructor() {
    this.cacheEnabled = true;
  }

  async synthesize({ text, language, voice, rate, pitch }) {
    if (!text || !text.trim()) return null;

    const cacheKey = this._buildCacheKey(text, language, voice, rate, pitch);

    if (this.cacheEnabled) {
      const cached = this._checkCache(cacheKey);
      if (cached) return cached;
    }

    const lang = language || "es";

    let result = await this._synthesizeMacOS(text, lang, voice);
    if (!result) result = await this._synthesizeEdgeTTS(text, lang, voice);

    if (result && this.cacheEnabled) {
      this._writeCache(cacheKey, result);
    }

    return result;
  }

  _synthesizeMacOS(text, language, voice) {
    return new Promise((resolve) => {
      const voiceName = voice || LANG_TO_SAY[language] || "Monica";
      const tmpFile = path.join(TTS_CACHE_DIR, `tmp-${crypto.randomUUID()}.aiff`);

      const args = ["-v", voiceName, "-o", tmpFile, "-"];
      const proc = execFile("say", args, { maxBuffer: 10 * 1024 * 1024 }, (err) => {
        if (err || !fs.existsSync(tmpFile)) {
          logger.warn({ err: err?.message, language }, "macOS say failed");
          try { if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile); } catch { /* ignore */ }
          resolve(null);
          return;
        }
        try {
          const buffer = fs.readFileSync(tmpFile);
          fs.unlinkSync(tmpFile);
          resolve({ buffer, format: "aiff", language, provider: "macos" });
        } catch {
          resolve(null);
        }
      });
      proc.stdin.write(text);
      proc.stdin.end();
    });
  }

  _synthesizeEdgeTTS(text, language, voice) {
    return new Promise((resolve) => {
      const voiceName = voice || LANG_TO_EDGE[language] || "es-ES-ElviraNeural";
      const url = `https://speech.platform.bing.com/consumer/speech/synthesize/readaloud/voices/list?trustedclienttoken=6A5AA1D4EAFF4E9FB37E23D68491D6F4`;

      https.get(url, { headers: { "User-Agent": "Mozilla/5.0" } }, (res) => {
        let data = "";
        res.on("data", (chunk) => { data += chunk; });
        res.on("end", () => {
          try {
            const voices = JSON.parse(data);
            const found = voices.find((v) => v.ShortName === voiceName);
            if (!found) {
              resolve(null);
              return;
            }
            this._edgeSynthesize(text, voiceName, found.Locale).then(resolve).catch(() => resolve(null));
          } catch {
            resolve(null);
          }
        });
      }).on("error", () => resolve(null));
    });
  }

  _edgeSynthesize(text, voiceName, locale) {
    return new Promise((resolve, reject) => {
      const connId = crypto.randomUUID().replace(/-/g, "");
      const wsUrl = `wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1?TrustedClientToken=6A5AA1D4EAFF4E9FB37E23D68491D6F4&ConnectionId=${connId}`;

      const ws = new WebSocket(wsUrl);
      const chunks = [];
      let settled = false;

      ws.on("open", () => {
        const configId = crypto.randomUUID();
        const ssml = `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='${locale}'><voice name='${voiceName}'>${text.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</voice></speak>`;

        ws.send(`Content-Type:application/json; charset=utf-8\r\nPath:speech.config\r\nX-RequestId:${configId}\r\n\r\n{"context":{"synthesis":{"audio":{"metadataOptions":{"sentenceBoundaryEnabled":"false","wordBoundaryEnabled":"false"},"outputFormat":"audio-24khz-48kbitrate-mono-mp3"}}}}`);
        ws.send(`X-RequestId:${configId}\r\nContent-Type:application/ssml+xml\r\nPath:ssml\r\n\r\n${ssml}`);
      });

      ws.on("message", (data, isBinary) => {
        if (isBinary) {
          const headerLen = data.readUInt16BE(0);
          chunks.push(data.slice(headerLen + 2));
        } else {
          const msg = data.toString();
          if (msg.includes("Path:turn.end")) {
            if (!settled) {
              settled = true;
              ws.close();
              resolve({ buffer: Buffer.concat(chunks), format: "mp3", language: locale.split("-")[0], provider: "edge-tts" });
            }
          }
        }
      });

      ws.on("error", () => { if (!settled) { settled = true; reject(new Error("Edge TTS WS error")); } });
      ws.on("close", () => { if (!settled) { settled = true; reject(new Error("Edge TTS WS closed")); } });

      setTimeout(() => { if (!settled) { settled = true; ws.close(); reject(new Error("Edge TTS timeout")); } }, 15000);
    });
  }

  async listVoices(language) {
    const voices = Object.entries(LANG_TO_EDGE).map(([lang, name]) => ({
      id: name,
      name: name,
      lang,
      source: "edge-tts",
    }));

    const macVoices = Object.entries(LANG_TO_SAY).map(([lang, name]) => ({
      id: `mac-${name}`,
      name: `${name} (macOS)`,
      lang,
      source: "macos",
    }));

    const all = [...voices, ...macVoices];
    if (!language) return all;
    return all.filter((v) => v.lang === language);
  }

  async getProviderInfo() {
    try {
      await new Promise((resolve, reject) => {
        execFile("say", ["-v", "?"], { maxBuffer: 1024 * 1024 }, (err, stdout) => {
          if (err) reject(err);
          else resolve(stdout);
        });
      });
      return { available: true, provider: "macos", detail: "macOS say command" };
    } catch {
      return { available: true, provider: "edge-tts", detail: "Microsoft Edge neural voices" };
    }
  }

  _buildCacheKey(text, language, voice, rate, pitch) {
    const raw = `${text}:${language || ""}:${voice || ""}:${rate || ""}:${pitch || ""}`;
    return crypto.createHash("md5").update(raw).digest("hex");
  }

  _checkCache(cacheKey) {
    for (const format of ["mp3", "wav"]) {
      const cachePath = path.join(TTS_CACHE_DIR, `${cacheKey}.${format}`);
      if (fs.existsSync(cachePath)) {
        const stats = fs.statSync(cachePath);
        return { filePath: `/uploads/tts/${cacheKey}.${format}`, format, cached: true, size: stats.size };
      }
    }
    return null;
  }

  _writeCache(cacheKey, audioResult) {
    if (!audioResult?.buffer) return;
    const ext = (audioResult.format || "mp3").toLowerCase();
    const cachePath = path.join(TTS_CACHE_DIR, `${cacheKey}.${ext}`);
    try {
      fs.writeFileSync(cachePath, audioResult.buffer);
      logger.info({ cacheKey, format: ext, bytes: audioResult.buffer.length }, "TTS audio cached");
    } catch (err) {
      logger.error({ err, cacheKey }, "Failed to write TTS cache");
    }
  }

  getCacheStats() {
    const files = fs.readdirSync(TTS_CACHE_DIR);
    let totalSize = 0;
    for (const file of files) {
      totalSize += fs.statSync(path.join(TTS_CACHE_DIR, file)).size;
    }
    return { count: files.length, totalSize };
  }

  clearCache() {
    const files = fs.readdirSync(TTS_CACHE_DIR);
    for (const file of files) {
      fs.unlinkSync(path.join(TTS_CACHE_DIR, file));
    }
    logger.info({ count: files.length }, "TTS cache cleared");
  }
}

export default new TTSService();
