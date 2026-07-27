import { useEffect, useState, useCallback } from "react";
import { api, type Device } from "../../lib/api";
import { Monitor, Smartphone, Radio, Cpu, Trash2, Wifi, WifiOff } from "lucide-react";

const TYPE_ICONS: Record<string, any> = {
  DISPLAY: Monitor,
  OPERATOR: Smartphone,
  AUDIO_NODE: Radio,
  HARDWARE: Cpu,
};

const TYPE_LABELS: Record<string, string> = {
  DISPLAY: "Pantalla",
  OPERATOR: "Operador",
  AUDIO_NODE: "Nodo audio",
  HARDWARE: "Hardware",
  UNKNOWN: "Desconocido",
};

export default function DevicesPanel() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [connected, setConnected] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [list, conn] = await Promise.all([
        api.listDevices().catch(() => []),
        api.getConnectedDevices().catch(() => []),
      ]);
      setDevices(list);
      setConnected(conn);
    } catch { /* noop */ } finally { setLoading(false); }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const handleDelete = async (id: string) => {
    if (!confirm("¿Eliminar este dispositivo?")) return;
    try { await api.deleteDevice(id); refresh(); } catch { /* noop */ }
  };

  const onlineIds = new Set(connected.map((c: any) => c.deviceId));

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
          <Radio className="text-blue-900" size={24} />
          Dispositivos
        </h2>
        <button onClick={refresh} className="px-3 py-1 bg-blue-900 text-white rounded-lg text-sm hover:bg-blue-800">
          {loading ? "..." : "Actualizar"}
        </button>
      </div>

      {/* Connected now */}
      {connected.length > 0 && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 mb-6">
          <h3 className="text-sm font-semibold text-emerald-800 mb-2">
            {connected.length} dispositivo{connected.length !== 1 ? "s" : ""} conectado{connected.length !== 1 ? "s" : ""} ahora
          </h3>
          <div className="flex flex-wrap gap-2">
            {connected.map((c: any, i: number) => (
              <span key={i} className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-medium">
                <Wifi size={12} />
                {c.deviceId?.slice(0, 8) || "?"}
                {c.displayId && <span className="text-emerald-400">· {c.displayId.slice(0, 8)}</span>}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Device list */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
              <tr>
                <th className="text-left px-4 py-2 font-medium">Dispositivo</th>
                <th className="text-left px-4 py-2 font-medium">Tipo</th>
                <th className="text-left px-4 py-2 font-medium">Estado</th>
                <th className="text-left px-4 py-2 font-medium">IP</th>
                <th className="text-left px-4 py-2 font-medium">Última conexión</th>
                <th className="text-left px-4 py-2 font-medium">Display</th>
                <th className="text-left px-4 py-2 font-medium">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {devices.map((d) => {
                const Icon = TYPE_ICONS[d.device_type] || Cpu;
                const isOnline = onlineIds.has(d.id);
                return (
                  <tr key={d.id} className="hover:bg-slate-50">
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-2">
                        <Icon size={16} className="text-slate-400" />
                        <span className="font-medium text-slate-700">{d.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2 text-slate-500">{TYPE_LABELS[d.device_type] || d.device_type}</td>
                    <td className="px-4 py-2">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${
                        isOnline ? "bg-green-100 text-green-700" : d.status === "ONLINE" ? "bg-yellow-100 text-yellow-700" : "bg-slate-100 text-slate-400"
                      }`}>
                        {isOnline ? <Wifi size={12} /> : <WifiOff size={12} />}
                        {isOnline ? "Online" : d.status === "ONLINE" ? "Sin heartbeat" : "Offline"}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-xs text-slate-400 font-mono">{d.ip_address || "-"}</td>
                    <td className="px-4 py-2 text-xs text-slate-400">{d.last_seen ? new Date(d.last_seen).toLocaleString() : "-"}</td>
                    <td className="px-4 py-2 text-xs text-slate-400 font-mono">{d.display_id ? d.display_id.slice(0, 8) : "-"}</td>
                    <td className="px-4 py-2">
                      <button onClick={() => handleDelete(d.id)}
                        className="p-1.5 rounded-lg hover:bg-red-50 text-red-500" title="Eliminar">
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                );
              })}
              {devices.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400">Sin dispositivos registrados</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
