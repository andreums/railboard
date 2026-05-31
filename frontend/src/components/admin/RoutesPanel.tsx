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
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-xl">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                    <div>
                        <label className="mb-1 block text-xs uppercase tracking-wide text-slate-400">Red / Región</label>
                        <select
                            className="w-full rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-white"
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
                        <label className="mb-1 block text-xs uppercase tracking-wide text-slate-400">Operador</label>
                        <select
                            className="w-full rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-white"
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
                        <label className="mb-1 block text-xs uppercase tracking-wide text-slate-400">Rutas encontradas</label>
                        <div className="rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 font-semibold text-white">
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
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                    {filtered.map((route) => (
                        <div
                            key={route.code}
                            onClick={() => setSelectedRoute(route)}
                            className={`cursor-pointer rounded-2xl border p-4 transition-all ${selectedRoute?.code === route.code
                                    ? "border-amber-400/60 bg-amber-400/10"
                                    : "border-white/10 bg-slate-950/50 hover:border-white/20 hover:bg-white/5"
                                }`}
                        >
                            <div className="flex items-start justify-between mb-2">
                                <div>
                                    <h3 className="text-lg font-semibold text-white">{route.code}</h3>
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
                                <div className="space-y-3 rounded-xl border border-white/10 bg-black/20 p-3">
                                    <div>
                                        <p className="mb-2 text-xs uppercase tracking-wide text-slate-400">Estaciones de la ruta</p>
                                        <div className="max-h-44 space-y-1 overflow-auto pr-1">
                                            {route.stations.map((station, index) => (
                                                <div key={`${route.code}-${station}-${index}`} className="flex items-center gap-2 rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white">
                                                    <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-amber-500/20 text-xs font-semibold text-amber-200">
                                                        {index + 1}
                                                    </span>
                                                    <span className="min-w-0 flex-1 truncate">{station}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="text-xs text-slate-400">
                                        <p className="mb-1 font-semibold text-slate-300">Números disponibles</p>
                                        <div className="flex flex-wrap gap-1">
                                            {route.numbers.slice(0, 3).map((n) => (
                                                <span key={n} className="rounded bg-white/10 px-2 py-1 text-xs text-white">
                                                    {n}
                                                </span>
                                            ))}
                                            {route.numbers.length > 3 && (
                                                <span className="rounded bg-white/10 px-2 py-1 text-xs text-slate-400">
                                                    +{route.numbers.length - 3}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <button
                                        onClick={handleGenerateTrain}
                                        disabled={generating}
                                        className="w-full rounded-xl bg-emerald-500 px-4 py-2 font-semibold text-white transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-60"
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
