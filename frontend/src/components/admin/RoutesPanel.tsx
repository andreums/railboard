import { useEffect, useState } from "react";
import { api, type Route, type Train } from "../../lib/api";

export default function RoutesPanel() {
  const [routes, setRoutes] = useState<Route[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedRoute, setSelectedRoute] = useState<Route | null>(null);
  const [generating, setGenerating] = useState(false);
  const [regionFilter, setRegionFilter] = useState("all");
  const [serviceFilter, setServiceFilter] = useState("all");
  const [operatorFilter, setOperatorFilter] = useState("all");
  const [lastGenerated, setLastGenerated] = useState<Train | null>(null);

  useEffect(() => {
    loadRoutes();
  }, []);

  const loadRoutes = async () => {
    try {
      setLoading(true);
      const data = await api.listRoutes();
      setRoutes(data || []);
      setError(null);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateTrain = async () => {
    if (!selectedRoute) return;
    try {
      setGenerating(true);
      const train = await api.generateTrainFromRoute(selectedRoute.code);
      setLastGenerated(train);
      setTimeout(() => setLastGenerated(null), 5000);
    } catch (err: any) {
      alert(`Error: ${err.message || String(err)}`);
    } finally {
      setGenerating(false);
    }
  };

  const regions = Array.from(new Set(routes.map((r) => r.network)));
  const services = Array.from(new Set(routes.map((r) => r.code.split("-")[0])));
  const operators = Array.from(new Set(routes.map((r) => r.operator)));

  const filtered = routes.filter((r) => {
    if (regionFilter !== "all" && r.network !== regionFilter) return false;
    if (operatorFilter !== "all" && r.operator !== operatorFilter) return false;
    return true;
  });

  return (
    <div className="space-y-4">
      <div className="bg-black/20 border border-white/10 rounded-lg p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs text-slate-400 uppercase tracking-wide mb-1">
              Red / Región
            </label>
            <select
              className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white"
              value={regionFilter}
              onChange={(e) => setRegionFilter(e.target.value)}
            >
              <option value="all">Todas</option>
              {regions.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-400 uppercase tracking-wide mb-1">
              Operador
            </label>
            <select
              className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white"
              value={operatorFilter}
              onChange={(e) => setOperatorFilter(e.target.value)}
            >
              <option value="all">Todos</option>
              {operators.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-400 uppercase tracking-wide mb-1">
              Rutas encontradas
            </label>
            <div className="bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white font-semibold">
              {filtered.length}
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-8">
          <p className="text-slate-400">Cargando rutas…</p>
        </div>
      ) : error ? (
        <div className="text-center py-8">
          <p className="text-red-300">{error}</p>
          <button
            onClick={loadRoutes}
            className="mt-4 px-4 py-2 rounded-lg bg-blue-500 text-white hover:bg-blue-600"
          >
            Reintentar
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-slate-400">No hay rutas con los filtros aplicados</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((route) => (
            <div
              key={route.code}
              onClick={() => setSelectedRoute(route)}
              className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                selectedRoute?.code === route.code
                  ? "border-blue-500 bg-blue-500/10"
                  : "border-white/10 bg-black/20 hover:border-white/20"
              }`}
            >
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h3 className="font-bold text-white text-lg">{route.code}</h3>
                  <p className="text-xs text-slate-400">{route.name}</p>
                </div>
              </div>

              <div className="space-y-1 text-sm mb-3">
                <div className="flex justify-between">
                  <span className="text-slate-400">Red:</span>
                  <span className="text-white">{route.network}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Operador:</span>
                  <span className="text-white">{route.operator}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Frecuencia:</span>
                  <span className="text-white">{route.headwayMin} min</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Andenes:</span>
                  <span className="text-white">{route.platforms.join(", ")}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Estaciones:</span>
                  <span className="text-white">{route.stations.length}</span>
                </div>
              </div>

              {selectedRoute?.code === route.code && (
                <div className="space-y-2">
                  <div className="text-xs text-slate-400 mb-2">
                    <p className="mb-1">
                      <strong>Números disponibles:</strong>
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {route.numbers.slice(0, 3).map((n) => (
                        <span
                          key={n}
                          className="px-2 py-1 bg-white/10 rounded text-xs text-white"
                        >
                          {n}
                        </span>
                      ))}
                      {route.numbers.length > 3 && (
                        <span className="px-2 py-1 bg-white/10 rounded text-xs text-slate-400">
                          +{route.numbers.length - 3}
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={handleGenerateTrain}
                    disabled={generating}
                    className="w-full px-4 py-2 rounded-lg font-semibold bg-green-500 text-white hover:bg-green-600 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {generating ? "Generando..." : "✈️ Generar Tren"}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {lastGenerated && (
        <div className="fixed bottom-6 right-6 bg-green-500/20 border border-green-500 rounded-lg p-4 max-w-sm">
          <p className="text-green-300 font-semibold mb-1">
            ✓ Tren creado: {lastGenerated.number}
          </p>
          <p className="text-xs text-green-200">
            {lastGenerated.origin} → {lastGenerated.destination}
          </p>
        </div>
      )}
    </div>
  );
}
