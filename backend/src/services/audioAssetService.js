import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import logger from "../logger.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOADS_DIR = path.resolve(__dirname, "../../uploads");

const ALLOWED_FORMATS = new Set(["MP3", "OGG", "WAV"]);

export function listAudioAssets(db, filters = {}) {
  let sql = `SELECT * FROM audio_assets WHERE 1=1`;
  const params = [];

  if (filters.asset_type) {
    sql += ` AND asset_type = ?`;
    params.push(filters.asset_type);
  }
  if (filters.format) {
    sql += ` AND format = ?`;
    params.push(filters.format);
  }
  if (filters.enabled !== undefined) {
    sql += ` AND enabled = ?`;
    params.push(filters.enabled ? 1 : 0);
  }

  sql += ` ORDER BY name ASC`;
  return db.prepare(sql).all(...params);
}

export function getAudioAsset(db, id) {
  return db.prepare("SELECT * FROM audio_assets WHERE id = ?").get(id);
}

export function createAudioAsset(db, { name, asset_type, format, file_path, original_filename, duration_ms, bitrate, sample_rate, channels, volume_db, default_volume }) {
  if (!ALLOWED_FORMATS.has(format)) throw new Error(`Format ${format} not allowed`);

  const result = db
    .prepare(
      `INSERT INTO audio_assets 
       (name, asset_type, format, file_path, original_filename, duration_ms, bitrate, sample_rate, channels, volume_db, default_volume, normalized)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`
    )
    .run(
      name,
      asset_type || "CUSTOM",
      format,
      file_path,
      original_filename || null,
      duration_ms || null,
      bitrate || null,
      sample_rate || null,
      channels || null,
      volume_db || null,
      default_volume || 1.0,
    );

  return getAudioAsset(db, result.lastInsertRowid);
}

export function updateAudioAsset(db, id, updates) {
  const cur = getAudioAsset(db, id);
  if (!cur) return null;

  const allowed = ["name", "asset_type", "format", "file_path", "duration_ms", "bitrate", "sample_rate", "channels", "volume_db", "normalized", "default_volume", "waveform_data", "metadata_json", "enabled"];

  const sets = [];
  const params = [];
  for (const field of allowed) {
    if (updates[field] !== undefined) {
      sets.push(`${field} = ?`);
      params.push(updates[field]);
    }
  }

  if (sets.length === 0) return cur;

  sets.push("updated_at = datetime('now')");
  params.push(id);

  db.prepare(`UPDATE audio_assets SET ${sets.join(", ")} WHERE id = ?`).run(...params);
  return getAudioAsset(db, id);
}

export function deleteAudioAsset(db, id) {
  const asset = getAudioAsset(db, id);
  if (!asset) return;

  if (asset.file_path) {
    const fullPath = path.resolve(UPLOADS_DIR, path.basename(asset.file_path));
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
    }
  }

  const conversions = db.prepare("SELECT file_path FROM audio_asset_conversions WHERE asset_id = ?").all(id);
  for (const conv of conversions) {
    const convPath = path.resolve(UPLOADS_DIR, path.basename(conv.file_path));
    if (fs.existsSync(convPath)) {
      fs.unlinkSync(convPath);
    }
  }

  db.prepare("DELETE FROM audio_asset_conversions WHERE asset_id = ?").run(id);
  db.prepare("DELETE FROM audio_assets WHERE id = ?").run(id);
}

export function analyzeAudioFile(filePath) {
  const stats = fs.statSync(filePath);
  const ext = path.extname(filePath).toLowerCase().replace(".", "").toUpperCase();

  const info = {
    format: ALLOWED_FORMATS.has(ext) ? ext : "MP3",
    fileSize: stats.size,
    durationMs: null,
    bitrate: null,
    sampleRate: null,
    channels: null,
  };

  return info;
}

export function getAssetConversions(db, assetId) {
  return db.prepare("SELECT * FROM audio_asset_conversions WHERE asset_id = ? ORDER BY format").all(assetId);
}

export function addAssetConversion(db, assetId, format, filePath) {
  db.prepare(
    "INSERT INTO audio_asset_conversions (asset_id, format, file_path) VALUES (?, ?, ?)"
  ).run(assetId, format, filePath);
}
