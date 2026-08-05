import { useEffect, useState, useCallback } from "react";
import { api, connectWS } from "../../lib/api";

const MULTIPLIERS = [0.25, 0.5, 1, 2, 5, 10, 30, 60];
const STATE_OPTIONS = [
  "SCHEDULED", "APPROACHING", "ARRIVING", "STOPPED", "BOARDING",
  "READY_TO_DEPART", "DEPARTING", "DEPARTED", "ARRIVED", "DELAYED", "CANCELLED",
];

export default function SimulationPanel() {
  const [clock, setClock] = useState<any>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [sequences, setSequences] = useState<any[]>([]);
  const [notification, setNotification] = useState<string | null>(null);

  const [newSeq, setNewSeq] = useState({ name: "", trainId: "", loop: false, steps: [{ eventType: STATE_OPTIONS[0], delaySeconds: 10, autoProceed: true }] });

  const notify = (msg: string) => { setNotification(msg); setTimeout(() => setNotification(null), 2000); };

  const refresh = useCallback(async () => {
    try {
      const [c, e, s] = await Promise.all([
        api.getSimulationClock().catch(() => null),
        api.getSimulationEvents(50).catch(() => []),
        api.listSimulationSequences().catch(() => []),
      ]);
      if (c) setClock(c);
      setEvents(e);
      setSequences(s);
    } catch { /* noop */ }
  }, []);

  useEffect(() => {
    refresh();
    const ws = connectWS(refresh);
    const unsub = ws.on("simulation_clock", (msg) => {
      if (msg.data) setClock((prev: any) => ({ ...prev, ...msg.data }));
    });
    return () => { ws.close(); unsub(); };
  }, [refresh]);

  const handleMultiplier = async (m: number) => {
    const result = await api.setSimulationMultiplier(m);
    if (result.error) notify(result.error);
    else notify(`Velocidad: ${m}x`);
    refresh();
  };

  const handlePause = async (paused: boolean) => {
    await api.setSimulationPaused(paused);
    notify(paused ? "Pausado" : "Reanudado");
    refresh();
  };

  const handleReset = async () => {
    await api.resetSimulationClock();
    notify("Reloj reiniciado");
    refresh();
  };

  const handleCreateSequence = async () => {
    const data = {
      name: newSeq.name,
      trainId: newSeq.trainId ? Number(newSeq.trainId) : null,
      loop: newSeq.loop,
      steps: newSeq.steps.filter((s) => s.eventType),
    };
    if (!data.name) { notify("Nombre requerido"); return; }
    if (data.steps.length === 0) { notify("Añade al menos un paso"); return; }
    const result = await api.createSimulationSequence(data);
    if (result.error) notify(result.error);
    else { notify("Secuencia creada"); setNewSeq({ name: "", trainId: "", loop: false, steps: [{ eventType: STATE_OPTIONS[0], delaySeconds: 10, autoProceed: true }] }); }
    refresh();
  };

  const handleStartSeq = async (id: number) => {
    await api.startSimulationSequence(id);
    notify("Secuencia iniciada");
    refresh();
  };

  const handlePauseSeq = async (id: number) => {
    await api.pauseSimulationSequence(id);
    notify("Secuencia pausada");
    refresh();
  };

  const handleResetSeq = async (id: number) => {
    await api.resetSimulationSequence(id);
    notify("Secuencia reiniciada");
    refresh();
  };

  const handleDeleteSeq = async (id: number) => {
    await api.deleteSimulationSequence(id);
    notify("Secuencia eliminada");
    refresh();
  };

  return (
    <div className="space-y-6">
      {notification && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 bg-emerald-600 text-white rounded-lg shadow-lg text-sm font-medium">
          {notification}
        </div>
      )}

      {/* Clock status */}
      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold text-white">Reloj de simulación</h3>
          <div className="flex gap-1">
            <button onClick={() => handlePause(!clock?.paused)}
              className={`px-3 py-1.5 rounded text-xs font-semibold ${clock?.paused ? "bg-green-600 text-white" : "bg-yellow-600 text-white"}`}>
              {clock?.paused ? "▶ Reanudar" : "⏸ Pausar"}
            </button>
            <button onClick={handleReset} className="px-3 py-1.5 rounded text-xs bg-slate-600 text-white hover:bg-slate-500">↺ Reset</button>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <div>
            <span className="text-slate-400 text-xs">Hora simulada</span>
            <div className="text-2xl font-bold text-yellow-300 font-mono">{clock?.simulatedTimeFormatted || "--:--"}</div>
          </div>
          <div>
            <span className="text-slate-400 text-xs">Velocidad</span>
            <div className="text-lg font-semibold text-white font-mono">{clock?.multiplier}x</div>
          </div>
          <div>
            <span className="text-slate-400 text-xs">Estado</span>
            <div className={`text-lg font-semibold ${clock?.paused ? "text-yellow-400" : "text-green-400"}`}>
              {clock?.paused ? "Pausado" : "Activo"}
            </div>
          </div>
          <div>
            <span className="text-slate-400 text-xs">Hora real</span>
            <div className="text-lg font-semibold text-slate-300 font-mono">{new Date().toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}</div>
          </div>
        </div>
        {/* Multiplier buttons */}
        <div className="flex flex-wrap gap-1.5 mt-3">
          {MULTIPLIERS.map((m) => (
            <button key={m} onClick={() => handleMultiplier(m)}
              className={`px-3 py-1.5 rounded text-xs font-medium ${
                clock?.multiplier === m ? "bg-blue-600 text-white" : "bg-slate-700 text-slate-300 hover:bg-slate-600"
              }`}>
              {m}x
            </button>
          ))}
        </div>
      </div>

      {/* Events */}
      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
        <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-2">Eventos de simulación</h3>
        <div className="max-h-40 overflow-y-auto space-y-0.5">
          {events.map((e: any) => (
            <div key={e.id} className="flex justify-between text-xs text-slate-400 py-0.5">
              <span className="font-mono text-slate-300">{e.event_type}</span>
              <span>{e.source}</span>
              <span className="text-slate-500">{new Date(e.created_at).toLocaleTimeString()}</span>
            </div>
          ))}
          {events.length === 0 && <div className="text-xs text-slate-500 italic">Sin eventos</div>}
        </div>
      </div>

      {/* Sequences */}
      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
        <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-3">Secuencias de viaje</h3>

        {/* Existing sequences */}
        <div className="space-y-2 mb-4">
          {sequences.map((seq: any) => (
            <div key={seq.id} className="flex items-center justify-between bg-slate-700/50 rounded-lg px-3 py-2">
              <div className="min-w-0">
                <div className="text-sm font-medium text-white truncate">{seq.name}</div>
                <div className="text-xs text-slate-400">Tren {seq.train_number || seq.train_id || "—"} · Paso {seq.current_step || 0}</div>
              </div>
              <div className="flex gap-1 flex-shrink-0">
                <button onClick={() => handleStartSeq(seq.id)} className="px-2 py-1 rounded text-xs bg-green-700 text-white hover:bg-green-600">▶</button>
                <button onClick={() => handlePauseSeq(seq.id)} className="px-2 py-1 rounded text-xs bg-yellow-700 text-white hover:bg-yellow-600">⏸</button>
                <button onClick={() => handleResetSeq(seq.id)} className="px-2 py-1 rounded text-xs bg-slate-600 text-white hover:bg-slate-500">↺</button>
                <button onClick={() => handleDeleteSeq(seq.id)} className="px-2 py-1 rounded text-xs bg-red-700 text-white hover:bg-red-600">✕</button>
              </div>
            </div>
          ))}
          {sequences.length === 0 && <div className="text-xs text-slate-500 italic">Sin secuencias</div>}
        </div>

        {/* Create sequence form */}
        <div className="bg-slate-900/50 rounded-lg p-3">
          <div className="text-xs text-slate-400 font-semibold uppercase mb-2">Crear secuencia</div>
          <div className="grid grid-cols-2 gap-2 mb-2">
            <input value={newSeq.name} onChange={(e) => setNewSeq({ ...newSeq, name: e.target.value })}
              placeholder="Nombre" className="bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-sm text-white placeholder-slate-500" />
            <input value={newSeq.trainId} onChange={(e) => setNewSeq({ ...newSeq, trainId: e.target.value })}
              placeholder="ID de tren (opcional)" type="number" className="bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-sm text-white placeholder-slate-500" />
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-300 mb-2">
            <input type="checkbox" checked={newSeq.loop} onChange={(e) => setNewSeq({ ...newSeq, loop: e.target.checked })}
              className="rounded bg-slate-700 border-slate-500" />
            Repetir en bucle
          </label>

          {/* Steps */}
          <div className="space-y-1.5 mb-2">
            {newSeq.steps.map((step, i) => (
              <div key={i} className="flex gap-1 items-center">
                <span className="text-xs text-slate-500 w-4">{i + 1}.</span>
                <select value={step.eventType} onChange={(e) => {
                  const steps = [...newSeq.steps];
                  steps[i] = { ...steps[i], eventType: e.target.value };
                  setNewSeq({ ...newSeq, steps });
                }} className="bg-slate-800 border border-slate-600 rounded px-2 py-1 text-xs text-white flex-1">
                  {STATE_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
                <input value={step.delaySeconds} onChange={(e) => {
                  const steps = [...newSeq.steps];
                  steps[i] = { ...steps[i], delaySeconds: Number(e.target.value) };
                  setNewSeq({ ...newSeq, steps });
                }} type="number" className="bg-slate-800 border border-slate-600 rounded px-2 py-1 text-xs text-white w-16" placeholder="Seg" />
                <span className="text-xs text-slate-500">seg</span>
                {newSeq.steps.length > 1 && (
                  <button onClick={() => {
                    const steps = newSeq.steps.filter((_, j) => j !== i);
                    setNewSeq({ ...newSeq, steps });
                  }} className="text-red-400 hover:text-red-300 text-xs">✕</button>
                )}
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <button onClick={() => setNewSeq({ ...newSeq, steps: [...newSeq.steps, { eventType: STATE_OPTIONS[0], delaySeconds: 10, autoProceed: true }] })}
              className="px-3 py-1.5 rounded text-xs bg-slate-700 text-slate-300 hover:bg-slate-600">
              + Añadir paso
            </button>
            <button onClick={handleCreateSequence}
              className="px-3 py-1.5 rounded text-xs bg-emerald-700 text-white hover:bg-emerald-600 font-semibold">
              Crear secuencia
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
