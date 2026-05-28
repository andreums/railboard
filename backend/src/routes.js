import { Router } from "express";
import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";
import {
  db,
  getConfig, setConfig,
  listTrains, createTrain, updateTrain, deleteTrain, getTrain,
  addMinutes,
  operators, trainTypes, places,
} from "./db.js";
import { broadcast } from "./ws.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const upload = multer({
  storage: multer.diskStorage({
    destination: path.resolve(__dirname, "../uploads"),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname);
      cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
    },
  }),
  limits: { fileSize: 2 * 1024 * 1024 },
});

const r = Router();
const ping = () => broadcast({ type: "update", at: Date.now() });

// ----- config -----
r.get("/config", (_req, res) => res.json(getConfig()));
r.put("/config", (req, res) => {
  setConfig(req.body || {});
  ping();
  res.json(getConfig());
});

// ----- trains -----
r.get("/trains", (_req, res) => res.json(listTrains()));

function reorderTrains(ids: number[]) {
  const stmt = db.prepare("UPDATE trains SET sort_order = ? WHERE id = ?");
  ids.forEach((id, idx) => stmt.run(idx, id));
}

r.put("/trains/reorder", (req, res) => {
  reorderTrains(req.body.ids);
  ping();
  res.json(listTrains());
});

r.post("/trains", (req, res) => {
  const t = createTrain(req.body);
  ping();
  res.status(201).json(t);
});
r.put("/trains/:id", (req, res) => {
  const t = updateTrain(Number(req.params.id), req.body);
  if (!t) return res.status(404).end();
  ping();
  res.json(t);
});
r.patch("/trains/:id/status", (req, res) => {
  const t = updateTrain(Number(req.params.id), { status: req.body.status });
  if (!t) return res.status(404).end();
  ping();
  res.json(t);
});
r.patch("/trains/:id/delay", (req, res) => {
  const cur = getTrain(Number(req.params.id));
  if (!cur) return res.status(404).end();
  const minutes = Number(req.body.minutes || 0);
  const t = updateTrain(cur.id, {
    expected_time: addMinutes(cur.expected_time, minutes),
    status: minutes > 0 ? "Delayed" : cur.status,
  });
  ping();
  res.json(t);
});
r.patch("/trains/:id/platform", (req, res) => {
  const t = updateTrain(Number(req.params.id), {
    platform: req.body.platform,
    sector: req.body.sector,
  });
  if (!t) return res.status(404).end();
  ping();
  res.json(t);
});
r.delete("/trains/:id", (req, res) => {
  deleteTrain(Number(req.params.id));
  ping();
  res.status(204).end();
});

// ----- operators -----
r.get("/operators", (_req, res) => res.json(operators.list()));
r.post("/operators", upload.single("logo"), (req, res) => {
  const logo_url = req.file ? `/uploads/${req.file.filename}` : null;
  operators.create({ name: req.body.name, logo_url });
  ping();
  res.status(201).json(operators.list());
});
r.put("/operators/:id", upload.single("logo"), (req, res) => {
  const id = Number(req.params.id);
  const logo_url = req.file ? `/uploads/${req.file.filename}` : req.body.logo_url;
  operators.update(id, { name: req.body.name, logo_url });
  ping();
  res.json(operators.list());
});
r.delete("/operators/:id", (req, res) => {
  operators.remove(Number(req.params.id));
  ping();
  res.status(204).end();
});

// ----- train types -----
r.get("/train-types", (_req, res) => res.json(trainTypes.list()));
r.post("/train-types", upload.single("logo"), (req, res) => {
  const logo_url = req.file ? `/uploads/${req.file.filename}` : null;
  trainTypes.create({
    code: req.body.code,
    name: req.body.name,
    color: req.body.color,
    logo_url,
  });
  ping();
  res.status(201).json(trainTypes.list());
});
r.put("/train-types/:id", upload.single("logo"), (req, res) => {
  const id = Number(req.params.id);
  const logo_url = req.file ? `/uploads/${req.file.filename}` : req.body.logo_url;
  trainTypes.update(id, {
    code: req.body.code,
    name: req.body.name,
    color: req.body.color,
    logo_url,
  });
  ping();
  res.json(trainTypes.list());
});
r.delete("/train-types/:id", (req, res) => {
  trainTypes.remove(Number(req.params.id));
  ping();
  res.status(204).end();
});

// ----- places -----
r.get("/places", (_req, res) => res.json(places.list()));
r.post("/places", (req, res) => {
  places.create({ name: req.body.name });
  ping();
  res.status(201).json(places.list());
});
r.delete("/places/:id", (req, res) => {
  places.remove(Number(req.params.id));
  ping();
  res.status(204).end();
});

export default r;
