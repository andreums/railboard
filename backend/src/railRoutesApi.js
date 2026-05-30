import { Router } from "express";
import {
  getAllRoutes,
  getRouteByCode,
  getRoutesByNetwork,
  getStationsByRoute,
  getAllStations,
  searchStation,
  getAvailableNetworks,
  getAvailableOperators,
  reloadRoutesDataset,
} from "./services/routeService.js";

const r = Router();

r.get("/routes", (_req, res) => res.json(getAllRoutes()));

r.get("/routes/:code", (req, res) => {
  const route = getRouteByCode(req.params.code);
  if (!route) return res.status(404).json({ error: "Route not found" });
  return res.json(route);
});

r.get("/routes/network/:network", (req, res) => res.json(getRoutesByNetwork(req.params.network)));

r.get("/routes/:code/stations", (req, res) => res.json(getStationsByRoute(req.params.code)));

r.get("/stations", (_req, res) => res.json(getAllStations()));

r.get("/stations/search", (req, res) => {
  const q = String(req.query.q || "");
  return res.json(searchStation(q));
});

r.get("/networks", (_req, res) => res.json(getAvailableNetworks()));

r.get("/operators", (_req, res) => res.json(getAvailableOperators()));

r.post("/admin/routes/reload", (_req, res) => {
  const stats = reloadRoutesDataset();
  return res.json(stats);
});

export default r;
