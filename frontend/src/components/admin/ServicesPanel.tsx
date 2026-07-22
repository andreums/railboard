import { useEffect, useState } from "react";
import { api, connectWS, type Service, type ServiceStop } from "../../lib/api";

interface EditingService {
  id?: number;
  number: string;
  operator_id: number | null;
  train_type_id: number | null;
  origin_place_id: number | null;
  destination_place_id: number | null;
  notes?: string;
}

interface EditingStop {
  id?: number;
  station_id: number;
  stop_number: number;
  stop_type: "Origin" | "Stop" | "Pass" | "Destination";
  arrival_scheduled?: string;
  departure_scheduled?: string;
  platform?: string;
  sector?: string;
}

export default function ServicesPanel() {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [stops, setStops] = useState<ServiceStop[]>([]);
  const [editingService, setEditingService] = useState<EditingService | null>(null);
  const [newStop, setNewStop] = useState<EditingStop>({
    station_id: 1,
    stop_number: 1,
    stop_type: "Stop",
  });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    refreshServices();
    const ws = connectWS(refreshServices);
    const unsubscribe = ws?.on?.("service_updated", refreshServices);
    return () => {
      if (typeof unsubscribe === "function") unsubscribe();
      if (ws && typeof ws.close === "function") ws.close();
    };
  }, []);

  useEffect(() => {
    if (selectedService) {
      loadStops(selectedService.id);
    }
  }, [selectedService]);

  const refreshServices = async () => {
    try {
      setLoading(true);
      const data = await api.listServices();
      setServices(data || []);
      setError(null);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  const loadStops = async (serviceId: number) => {
    try {
      const data = await api.getServiceStops(serviceId);
      setStops(data || []);
    } catch (err) {
      setError(String(err));
    }
  };

  const handleCreateService = async () => {
    if (!editingService?.number) return;
    try {
      await api.createService(editingService);
      setEditingService(null);
      await refreshServices();
    } catch (err) {
      setError(String(err));
    }
  };

  const handleUpdateService = async () => {
    if (!editingService?.id) return;
    try {
      await api.updateService(editingService.id, editingService);
      setEditingService(null);
      await refreshServices();
      setSelectedService(null);
    } catch (err) {
      setError(String(err));
    }
  };

  const handleDeleteService = async (id: number) => {
    if (!confirm("¿Eliminar este servicio?")) return;
    try {
      await api.deleteService(id);
      await refreshServices();
      setSelectedService(null);
    } catch (err) {
      setError(String(err));
    }
  };

  const handleCancelService = async (id: number) => {
    if (!confirm("¿Cancelar este servicio?")) return;
    try {
      await api.cancelService(id, "Cancelled by admin");
      await refreshServices();
      setSelectedService(null);
    } catch (err) {
      setError(String(err));
    }
  };

  const handleAddStop = async () => {
    if (!selectedService || !newStop.station_id) return;
    try {
      await api.createServiceStop(selectedService.id, {
        ...newStop,
        stop_number: stops.length + 1,
      });
      setNewStop({
        station_id: 1,
        stop_number: stops.length + 2,
        stop_type: "Stop",
      });
      await loadStops(selectedService.id);
    } catch (err) {
      setError(String(err));
    }
  };

  const handleDeleteStop = async (stopId: number) => {
    if (!selectedService || !confirm("¿Eliminar esta parada?")) return;
    try {
      await api.deleteServiceStop(selectedService.id, stopId);
      await loadStops(selectedService.id);
    } catch (err) {
      setError(String(err));
    }
  };

  const handleMarkArrival = async (stopId: number) => {
    try {
      const now = new Date().toISOString().split("T")[0];
      const time = new Date().toTimeString().split(" ")[0];
      await api.markArrival(stopId, `${now}T${time}Z`, "");
      if (selectedService) await loadStops(selectedService.id);
    } catch (err) {
      setError(String(err));
    }
  };

  const handleMarkDeparture = async (stopId: number) => {
    try {
      const now = new Date().toISOString().split("T")[0];
      const time = new Date().toTimeString().split(" ")[0];
      await api.markDeparture(stopId, `${now}T${time}Z`);
      if (selectedService) await loadStops(selectedService.id);
    } catch (err) {
      setError(String(err));
    }
  };

  if (loading) return <div className="p-6 text-center text-slate-300">Cargando servicios...</div>;

  return (
    <div className="space-y-6">
      {error && <div className="bg-red-900/40 border border-red-700 text-red-200 p-4 rounded-lg">Error: {error}</div>}

      <div className="flex gap-2">
        <button
          onClick={() =>
            setEditingService({ number: "", operator_id: null, train_type_id: null, origin_place_id: null, destination_place_id: null })
          }
          className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
        >
          ➕ Nuevo Servicio
        </button>
        {selectedService && (
          <button
            onClick={() => handleDeleteService(selectedService.id)}
            className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
          >
            🗑️ Eliminar
          </button>
        )}
      </div>

      {/* Create/Edit Service Modal */}
      {editingService && (
        <div className="bg-black/20 p-6 rounded-lg border border-blue-700/50">
          <h3 className="text-lg font-bold text-white mb-4">{editingService.id ? "Editar Servicio" : "Nuevo Servicio"}</h3>
          <div className="grid grid-cols-2 gap-4">
            <input
              type="text"
              placeholder="Número de servicio (ej: AVE-001)"
              value={editingService.number}
              onChange={(e) => setEditingService({ ...editingService, number: e.target.value })}
              className="col-span-2 px-3 py-2 bg-black/40 border border-white/10 rounded text-white"
            />
            <input
              type="number"
              placeholder="ID de operador"
              value={editingService.operator_id || ""}
              onChange={(e) =>
                setEditingService({
                  ...editingService,
                  operator_id: e.target.value ? Number(e.target.value) : null,
                })
              }
              className="px-3 py-2 bg-black/40 border border-white/10 rounded text-white"
            />
            <input
              type="number"
              placeholder="ID de tipo de tren"
              value={editingService.train_type_id || ""}
              onChange={(e) =>
                setEditingService({
                  ...editingService,
                  train_type_id: e.target.value ? Number(e.target.value) : null,
                })
              }
              className="px-3 py-2 bg-black/40 border border-white/10 rounded text-white"
            />
            <input
              type="number"
              placeholder="ID de lugar origen"
              value={editingService.origin_place_id || ""}
              onChange={(e) =>
                setEditingService({
                  ...editingService,
                  origin_place_id: e.target.value ? Number(e.target.value) : null,
                })
              }
              className="px-3 py-2 bg-black/40 border border-white/10 rounded text-white"
            />
            <input
              type="number"
              placeholder="ID de lugar destino"
              value={editingService.destination_place_id || ""}
              onChange={(e) =>
                setEditingService({
                  ...editingService,
                  destination_place_id: e.target.value ? Number(e.target.value) : null,
                })
              }
              className="px-3 py-2 bg-black/40 border border-white/10 rounded text-white"
            />
            <textarea
              placeholder="Notas"
              value={editingService.notes || ""}
              onChange={(e) => setEditingService({ ...editingService, notes: e.target.value })}
              className="col-span-2 px-3 py-2 bg-black/40 border border-white/10 rounded text-white"
              rows={2}
            />
          </div>
          <div className="flex gap-2 mt-4">
            <button
              onClick={editingService.id ? handleUpdateService : handleCreateService}
              className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
            >
              {editingService.id ? "Actualizar" : "Crear"}
            </button>
            <button onClick={() => setEditingService(null)} className="px-4 py-2 bg-slate-700 text-white rounded hover:bg-slate-600">
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Services List */}
      <div className="grid grid-cols-1 gap-4">
        {services.map((service) => (
          <div
            key={service.id}
            className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
              selectedService?.id === service.id ? "border-blue-500 bg-blue-900/20" : "border-white/15 bg-black/20 hover:border-white/30"
            }`}
            onClick={() => setSelectedService(service)}
          >
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <div className="font-bold text-lg text-white">{service.number}</div>
                <div className="text-sm text-slate-300">
                  {service.origin_name} → {service.destination_name}
                </div>
                <div className="text-sm text-slate-200">
                  {service.operator_name} / {service.train_type_name || "—"}
                </div>
                <div className="text-xs text-slate-400 mt-1">
                  Estado: <span className="font-mono">{service.status}</span>
                  {service.delay_minutes ? ` (+${service.delay_minutes}m)` : ""}
                </div>
              </div>
              <span
                className={`px-3 py-1 rounded-full text-sm font-bold text-white ${
                  service.status === "Cancelled" ? "bg-red-500" : service.status === "Completed" ? "bg-green-500" : "bg-blue-500"
                }`}
              >
                {service.status === "Cancelled" ? "✗" : service.status === "Completed" ? "✓" : "◉"}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Stops List */}
      {selectedService && (
        <div className="bg-black/20 p-6 rounded-lg border border-white/10">
          <h3 className="text-lg font-bold text-white mb-4">Paradas ({stops.length})</h3>

          <div className="space-y-2 mb-6">
            {stops.map((stop) => (
              <div key={stop.id} className="bg-black/30 p-4 rounded border border-white/10 flex justify-between items-center">
                <div className="flex-1">
                  <div className="font-bold text-white">
                    {stop.stop_number}. {stop.station_name}
                  </div>
                  <div className="text-sm text-slate-300">
                    Llegada: {stop.arrival_scheduled}
                    {stop.arrival_actual && ` (${stop.arrival_actual})`}
                    {stop.delay_minutes ? ` +${stop.delay_minutes}m` : ""}
                  </div>
                  {stop.departure_scheduled && (
                    <div className="text-sm text-slate-300">
                      Salida: {stop.departure_scheduled}
                      {stop.departure_actual && ` (${stop.departure_actual})`}
                    </div>
                  )}
                  <div className="text-xs text-slate-400 mt-1">
                    {stop.platform && `Andén ${stop.platform}${stop.sector ? `/${stop.sector}` : ""}`}
                  </div>
                </div>
                <div className="flex gap-2">
                  {stop.state === "Scheduled" && (
                    <>
                      <button
                        onClick={() => handleMarkArrival(stop.id)}
                        className="px-3 py-1 bg-green-500 text-white rounded text-sm hover:bg-green-600"
                      >
                        Llegar
                      </button>
                      {stop.stop_type !== "Origin" && (
                        <button
                          onClick={() => handleMarkDeparture(stop.id)}
                          className="px-3 py-1 bg-orange-500 text-white rounded text-sm hover:bg-orange-600"
                        >
                          Salir
                        </button>
                      )}
                    </>
                  )}
                  <button
                    onClick={() => handleDeleteStop(stop.id)}
                    className="px-3 py-1 bg-red-500 text-white rounded text-sm hover:bg-red-600"
                  >
                    Borrar
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Add Stop Form */}
          <div className="bg-black/30 p-4 rounded border border-blue-700/50">
            <h4 className="font-bold text-white mb-3">Agregar Parada</h4>
            <div className="grid grid-cols-3 gap-3">
              <input
                type="number"
                placeholder="ID Estación"
                value={newStop.station_id}
                onChange={(e) => setNewStop({ ...newStop, station_id: Number(e.target.value) })}
                className="px-3 py-2 bg-black/40 border border-white/10 rounded text-white"
              />
              <select
                value={newStop.stop_type}
                onChange={(e) =>
                  setNewStop({
                    ...newStop,
                    stop_type: e.target.value as EditingStop["stop_type"],
                  })
                }
                className="px-3 py-2 bg-black/40 border border-white/10 rounded text-white"
              >
                <option value="Origin">Origen</option>
                <option value="Stop">Parada</option>
                <option value="Pass">Paso</option>
                <option value="Destination">Destino</option>
              </select>
              <input
                type="time"
                placeholder="Llegada"
                value={newStop.arrival_scheduled || ""}
                onChange={(e) =>
                  setNewStop({
                    ...newStop,
                    arrival_scheduled: e.target.value,
                  })
                }
                className="px-3 py-2 bg-black/40 border border-white/10 rounded text-white"
              />
              <input
                type="time"
                placeholder="Salida"
                value={newStop.departure_scheduled || ""}
                onChange={(e) =>
                  setNewStop({
                    ...newStop,
                    departure_scheduled: e.target.value,
                  })
                }
                className="px-3 py-2 bg-black/40 border border-white/10 rounded text-white"
              />
              <input
                type="text"
                placeholder="Andén"
                value={newStop.platform || ""}
                onChange={(e) => setNewStop({ ...newStop, platform: e.target.value })}
                className="px-3 py-2 bg-black/40 border border-white/10 rounded text-white"
              />
              <input
                type="text"
                placeholder="Sector"
                value={newStop.sector || ""}
                onChange={(e) => setNewStop({ ...newStop, sector: e.target.value })}
                className="px-3 py-2 bg-black/40 border border-white/10 rounded text-white"
              />
            </div>
            <button onClick={handleAddStop} className="mt-3 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">
              ➕ Agregar Parada
            </button>
          </div>

          {/* Service Actions */}
          <div className="flex gap-2 mt-6">
            <button
              onClick={() => {
                setEditingService({
                  id: selectedService.id,
                  number: selectedService.number,
                  operator_id: selectedService.operator_id,
                  train_type_id: selectedService.train_type_id,
                  origin_place_id: selectedService.origin_place_id,
                  destination_place_id: selectedService.destination_place_id,
                  notes: selectedService.notes ?? undefined,
                });
              }}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              ✏️ Editar
            </button>
            {selectedService.status !== "Cancelled" && (
              <button
                onClick={() => handleCancelService(selectedService.id)}
                className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
              >
                ✗ Cancelar
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
