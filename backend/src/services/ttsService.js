import crypto from "crypto";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import logger from "../logger.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TTS_CACHE_DIR = path.resolve(__dirname, "../../uploads/tts");

if (!fs.existsSync(TTS_CACHE_DIR)) {
  fs.mkdirSync(TTS_CACHE_DIR, { recursive: true });
}

const SUPPORTED_PROVIDERS = ["browser", "google", "azure", "amazon", "elevenlabs"];

class TTSService {
  constructor(options = {}) {
    this.provider = options.provider || "browser";
    this.db = options.db || null;
    this.cacheEnabled = options.cacheEnabled !== false;
  }

  synthesize({ text, language, voice, speed = 1, pitch = 1 }) {
    const cacheKey = this._buildCacheKey(text, language, voice, speed, pitch);

    if (this.cacheEnabled) {
      const cached = this._checkCache(cacheKey);
      if (cached) return cached;
    }

    const audioResult = this._synthesizeWithProvider({ text, language, voice, speed, pitch });

    if (this.cacheEnabled && audioResult) {
      this._writeCache(cacheKey, audioResult);
    }

    return audioResult;
  }

  _buildCacheKey(text, language, voice, speed, pitch) {
    const raw = `${text}:${language}:${voice || ""}:${speed}:${pitch}`;
    return crypto.createHash("md5").update(raw).digest("hex");
  }

  _checkCache(cacheKey) {
    const formats = ["mp3", "ogg", "wav"];
    for (const format of formats) {
      const cachePath = path.join(TTS_CACHE_DIR, `${cacheKey}.${format}`);
      if (fs.existsSync(cachePath)) {
        const stats = fs.statSync(cachePath);
        return {
          filePath: `/uploads/tts/${cacheKey}.${format}`,
          durationMs: null,
          format: format.toUpperCase(),
          cached: true,
          size: stats.size,
        };
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
      logger.info({ cacheKey, format: ext }, "TTS audio cached");
    } catch (err) {
      logger.error({ err, cacheKey }, "Failed to write TTS cache");
    }
  }

  _synthesizeWithProvider({ text, language, voice, speed, pitch }) {
    switch (this.provider) {
      case "browser":
        return this._synthesizeBrowser(text, language);
      case "google":
        return this._synthesizeGoogle(text, language, voice);
      case "azure":
        return this._synthesizeAzure(text, language, voice);
      default:
        logger.warn({ provider: this.provider }, "TTS provider not available, falling back to browser");
        return this._synthesizeBrowser(text, language);
    }
  }

  _synthesizeBrowser(text, language) {
    return null;
  }

  async _synthesizeGoogle(text, language, voice) {
    return null;
  }

  async _synthesizeAzure(text, language, voice) {
    return null;
  }

  getCachePath(cacheKey, format = "mp3") {
    return path.join(TTS_CACHE_DIR, `${cacheKey}.${format}`);
  }

  getCacheUrl(cacheKey, format = "mp3") {
    return `/uploads/tts/${cacheKey}.${format}`;
  }

  clearCache() {
    const files = fs.readdirSync(TTS_CACHE_DIR);
    for (const file of files) {
      fs.unlinkSync(path.join(TTS_CACHE_DIR, file));
    }
    logger.info({ count: files.length }, "TTS cache cleared");
  }

  getCacheStats() {
    const files = fs.readdirSync(TTS_CACHE_DIR);
    let totalSize = 0;
    for (const file of files) {
      const stat = fs.statSync(path.join(TTS_CACHE_DIR, file));
      totalSize += stat.size;
    }
    return { count: files.length, totalSize };
  }
}

export default TTSService;
