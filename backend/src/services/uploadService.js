import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";
import { fileTypeFromBuffer } from "file-type";
import fs from "fs/promises";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const storage = multer.diskStorage({
  destination: path.resolve(__dirname, "../../uploads"),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
  },
});

const ALLOWED_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/gif", "image/webp", "image/svg+xml"]);
const ALLOWED_AUDIO_TYPES = new Set(["audio/ogg", "audio/opus", "audio/mpeg"]);

function basicFileFilter(allowedMimes, allowedExts, errorMessage) {
  return (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedMimes.includes(file.mimetype) && allowedExts.includes(ext)) {
      cb(null, true);
    } else {
      const err = new Error(errorMessage);
      err.code = "FILE_TYPE_NOT_ALLOWED";
      cb(err, false);
    }
  };
}

async function validateFileType(filePath, allowedTypes) {
  try {
    const buffer = await fs.readFile(filePath, { flag: "r" });
    const type = await fileTypeFromBuffer(buffer);
    if (!type || !allowedTypes.has(type.mime)) {
      await fs.unlink(filePath).catch(() => {});
      return false;
    }
    return true;
  } catch {
    await fs.unlink(filePath).catch(() => {});
    return false;
  }
}

function contentTypeValidator(allowedTypes, errorMessage) {
  return async (req, _res, next) => {
    const fileList = req.file ? [req.file] : [];
    if (req.files) {
      if (Array.isArray(req.files)) {
        fileList.push(...req.files);
      } else {
        for (const key of Object.keys(req.files)) {
          fileList.push(...req.files[key]);
        }
      }
    }
    if (fileList.length === 0) return next();
    for (const f of fileList) {
      const valid = await validateFileType(f.path, allowedTypes);
      if (!valid) {
        const err = new Error(errorMessage);
        err.code = "FILE_TYPE_NOT_ALLOWED";
        return next(err);
      }
    }
    next();
  };
}

export const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: basicFileFilter(
    ["image/png", "image/jpeg", "image/gif", "image/webp", "image/svg+xml"],
    [".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg"],
    "Tipo de archivo no permitido. Solo imágenes (PNG, JPG, GIF, WebP, SVG).",
  ),
});

export const uploadAudio = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: basicFileFilter(
    ["audio/ogg", "audio/opus", "audio/mpeg"],
    [".ogg", ".opus", ".mp3"],
    "Tipo de archivo no permitido. Solo OGG / Opus / MP3.",
  ),
});

export const uploadTrainTypeFields = upload.fields([
  { name: "logo", maxCount: 1 },
  { name: "destination_icon", maxCount: 1 },
]);

export const validateImageContent = contentTypeValidator(
  ALLOWED_IMAGE_TYPES,
  "El contenido del archivo no coincide con una imagen válida.",
);
export const validateAudioContent = contentTypeValidator(
  ALLOWED_AUDIO_TYPES,
  "El contenido del archivo no coincide con un formato de audio válido.",
);
