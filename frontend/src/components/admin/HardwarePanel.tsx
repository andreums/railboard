import { useEffect, useState, useCallback } from "react";
import { api, connectWS } from "../../lib/api";

export default function HardwarePanel() {
  const [events, setEvents] = useState<any[]>([]);
  const [notification, setNotification] = useState<string | null>(null);
  const [testForm, setTestForm] = useState({
    deviceId: "esp32-test",
    eventType: "SENSOR_TRIGGERED",
    sensorId: "reed_1",
    trainId: "",
    stationId: "",
    platform: "",
    data: "{}",
  });

  const notify = (msg: string) => { setNotification(msg); setTimeout(() => setNotification(null), 2000); };

  const refresh = useCallback(async () => {
    try {
      const e = await api.getHardwareEvents(50).catch(() => []);
      setEvents(e);
    } catch { /* noop */ }
  }, []);

  useEffect(() => {
    refresh();
    const ws = connectWS(refresh);
    const unsub = ws.on("hardware_event", () => refresh());
    return () => { ws.close(); unsub(); };
  }, [refresh]);

  const handleSend = async () => {
    const data = {
      deviceId: testForm.deviceId,
      eventType: testForm.eventType,
      sensorId: testForm.sensorId || undefined,
      trainId: testForm.trainId ? Number(testForm.trainId) : undefined,
      stationId: testForm.stationId ? Number(testForm.stationId) : undefined,
      platform: testForm.platform || undefined,
      data: testForm.data ? JSON.parse(testForm.data) : undefined,
    };
    try {
      const result = await api.postHardwareEvent(data);
      if (result.error) notify(result.error);
      else notify("Evento enviado" + (result.stateTriggered ? " (cambio de estado automático)" : ""));
      refresh();
    } catch (err: any) { notify(err.message); }
  };

  return (
    <div className="space-y-6">
      {notification && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 bg-emerald-600 text-white rounded-lg shadow-lg text-sm font-medium">
          {notification}
        </div>
      )}

      {/* Event log */}
      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold text-white">Eventos de hardware</h3>
          <span className="text-xs text-slate-400">{events.length} eventos</span>
        </div>
        <div className="max-h-80 overflow-y-auto space-y-1">
          {events.map((e: any) => {
            const details = e.details ? (typeof e.details === "string" ? JSON.parse(e.details) : e.details) : {};
            return (
              <div key={e.id} className="flex justify-between items-start py-1.5 px-2 bg-slate-900/50 rounded text-xs">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className={`font-mono font-semibold ${
                      e.event_type === "ERROR" ? "text-red-400" :
                      e.event_type === "SENSOR_TRIGGERED" ? "text-yellow-300" :
                      e.event_type === "TRAIN_DETECTED" ? "text-green-300" :
                      "text-slate-300"
                    }`}>{e.event_type}</span>
                    {details.deviceId && <span className="text-slate-500">{details.deviceId}</span>}
                    {details.sensorId && <span className="text-slate-500">sensor: {details.sensorId}</span>}
                    {e.train_id && <span className="text-blue-300">tren: {e.train_id}</span>}
                  </div>
                </div>
                <span className="text-slate-500 flex-shrink-0 ml-2">{new Date(e.created_at).toLocaleTimeString()}</span>
              </div>
            );
          })}
          {events.length === 0 && <div className="text-xs text-slate-500 italic">Sin eventos de hardware</div>}
        </div>
      </div>

      {/* Test sender */}
      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
        <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-3">Simulador de hardware</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mb-3">
          <div>
            <label className="text-[10px] text-slate-400 uppercase tracking-wider">Device ID</label>
            <input value={testForm.deviceId} onChange={(e) => setTestForm({ ...testForm, deviceId: e.target.value })}
              className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1.5 text-sm text-white" />
          </div>
          <div>
            <label className="text-[10px] text-slate-400 uppercase tracking-wider">Event Type</label>
            <select value={testForm.eventType} onChange={(e) => setTestForm({ ...testForm, eventType: e.target.value })}
              className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1.5 text-sm text-white">
              <option>SENSOR_TRIGGERED</option>
              <option>TRAIN_DETECTED</option>
              <option>TRAIN_LEFT</option>
              <option>BUTTON_PRESSED</option>
              <option>STATUS</option>
              <option>ERROR</option>
              <option>OCCUPANCY_CHANGED</option>
              <option>SIGNAL_CHANGED</option>
              <option>TURNOUT_CHANGED</option>
            </select>
          </div>
          <div>
            <label className="text-[10px] text-slate-400 uppercase tracking-wider">Sensor ID</label>
            <input value={testForm.sensorId} onChange={(e) => setTestForm({ ...testForm, sensorId: e.target.value })}
              className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1.5 text-sm text-white" />
          </div>
          <div>
            <label className="text-[10px] text-slate-400 uppercase tracking-wider">Train ID</label>
            <input value={testForm.trainId} onChange={(e) => setTestForm({ ...testForm, trainId: e.target.value })}
              type="number" className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1.5 text-sm text-white" />
          </div>
          <div>
            <label className="text-[10px] text-slate-400 uppercase tracking-wider">Station ID</label>
            <input value={testForm.stationId} onChange={(e) => setTestForm({ ...testForm, stationId: e.target.value })}
              type="number" className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1.5 text-sm text-white" />
          </div>
          <div>
            <label className="text-[10px] text-slate-400 uppercase tracking-wider">Platform</label>
            <input value={testForm.platform} onChange={(e) => setTestForm({ ...testForm, platform: e.target.value })}
              className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1.5 text-sm text-white" />
          </div>
        </div>
        <div className="mb-3">
          <label className="text-[10px] text-slate-400 uppercase tracking-wider">Data (JSON)</label>
          <input value={testForm.data} onChange={(e) => setTestForm({ ...testForm, data: e.target.value })}
            className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1.5 text-sm text-white font-mono" />
        </div>
        <button onClick={handleSend}
          className="px-4 py-2 bg-emerald-700 text-white rounded-lg text-sm font-semibold hover:bg-emerald-600 transition">
          Enviar evento
        </button>
      </div>
    </div>
  );
}
