import { useEffect, useState, useCallback } from "react";
import { api, connectWS, type Train } from "../../lib/api";
import { Brain, Plus, Trash2, Play, Pause, Settings, Lightbulb } from "lucide-react";

const TRIGGER_TYPES = [
  { value: "time_based", label: "Temporal" },
  { value: "state_change", label: "Cambio de estado" },
  { value: "delay_detected", label: "Retraso detectado" },
  { value: "periodic", label: "Periódico" },
];

const ACTION_TYPES = [
  { value: "state_change", label: "Cambiar estado" },
  { value: "platform_change", label: "Cambiar vía" },
  { value: "delay", label: "Añadir retraso" },
  { value: "log", label: "Registrar" },
];

const EVENT_STATES = [
  "SCHEDULED", "APPROACHING", "ARRIVING", "STOPPED", "BOARDING",
  "READY_TO_DEPART", "DEPARTING", "DEPARTED", "DELAYED", "CANCELLED",
];

export default function AutomationPanel() {
  const [tab, setTab] = useState<"rules" | "suggestions">("suggestions");
  const [rules, setRules] = useState<any[]>([]);
  const [trains, setTrains] = useState<Train[]>([]);
  const [suggestions, setSuggestions] = useState<Record<number, any>>({});
  const [notification, setNotification] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<Record<string, any>>({
    name: "", description: "", triggerType: "time_based",
    conditions: JSON.stringify({ status: "SCHEDULED" }, null, 2),
    actions: JSON.stringify([{ type: "state_change", to_state: "APPROACHING" }], null, 2),
    priority: 100, intervalSeconds: 30, cooldownSeconds: 60,
  });

  const notify = (msg: string) => { setNotification(msg); setTimeout(() => setNotification(null), 2000); };

  const refresh = useCallback(async () => {
    try {
      const [r, t] = await Promise.all([
        api.listAutomationRules().catch(() => []),
        api.listTrains().catch(() => []),
      ]);
      setRules(r);
      setTrains(t);
    } catch { /* noop */ }
  }, []);

  const refreshSuggestions = useCallback(async () => {
    if (trains.length === 0) return;
    const map: Record<number, any> = {};
    const batch = trains.slice(0, 20);
    for (const train of batch) {
      try {
        const s = await api.getAutomationSuggestions(train.id);
        if (s) map[train.id] = s;
      } catch { /* noop */ }
    }
    setSuggestions(map);
  }, [trains]);

  useEffect(() => {
    refresh();
    const ws = connectWS(refresh);
    return () => ws.close();
  }, [refresh]);

  useEffect(() => {
    if (tab === "suggestions" && trains.length > 0) refreshSuggestions();
  }, [tab, trains, refreshSuggestions]);

  const handleCreate = async () => {
    let conditions, actions;
    try { conditions = JSON.parse(form.conditions); } catch { notify("Conditions JSON inválido"); return; }
    try { actions = JSON.parse(form.actions); } catch { notify("Actions JSON inválido"); return; }
    const result = await api.createAutomationRule({
      name: form.name, description: form.description, triggerType: form.triggerType,
      conditions, actions, priority: Number(form.priority),
      intervalSeconds: Number(form.intervalSeconds), cooldownSeconds: Number(form.cooldownSeconds),
    } as any);
    if (result.error) notify(result.error);
    else { notify("Regla creada"); setShowForm(false); }
    refresh();
  };

  const handleDelete = async (id: number) => {
    if (!confirm("¿Eliminar regla?")) return;
    await api.deleteAutomationRule(id);
    notify("Regla eliminada");
    refresh();
  };

  return (
    <div className="space-y-6">
      {notification && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 bg-emerald-600 text-white rounded-lg shadow-lg text-sm font-medium">
          {notification}
        </div>
      )}

      {/* Tab selector */}
      <div className="flex gap-1 bg-slate-100 rounded-lg p-1 w-fit">
        <button onClick={() => setTab("suggestions")}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition ${tab === "suggestions" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
          <Lightbulb size={14} className="inline mr-1" />Sugerencias
        </button>
        <button onClick={() => setTab("rules")}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition ${tab === "rules" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
          <Brain size={14} className="inline mr-1" />Reglas ({rules.length})
        </button>
      </div>

      {tab === "suggestions" && (
        <div className="grid gap-3 md:grid-cols-2">
          {trains.slice(0, 20).map((t) => {
            const s = suggestions[t.id];
            return (
              <div key={t.id} className="bg-white rounded-xl border border-slate-200 p-4">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <span className="font-semibold text-slate-800">{t.number}</span>
                    <span className="text-slate-400 ml-2 text-sm">{t.destination}</span>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                    String(t.status) === "DELAYED" || String(t.status) === "Delayed" ? "bg-orange-100 text-orange-700" :
                    String(t.status) === "CANCELLED" || String(t.status) === "Cancelled" ? "bg-red-100 text-red-700" :
                    String(t.status) === "DEPARTED" || String(t.status) === "Departed" ? "bg-slate-100 text-slate-500" :
                    String(t.status) === "BOARDING" || String(t.status) === "Boarding" ? "bg-green-100 text-green-700" :
                    "bg-blue-100 text-blue-700"
                  }`}>{String(t.status)}</span>
                </div>
                <div className="text-xs text-slate-400 mb-2">{t.expected_time} · V{t.platform}</div>
                {s ? (
                  <div className="space-y-1">
                    <div className="text-xs text-slate-500 italic">{s.hint}</div>
                    {s.nextActions.map((a: any, i: number) => (
                      <div key={i} className="flex items-center gap-2 text-xs">
                        <span className={`px-1.5 py-0.5 rounded ${
                          a.action === "auto" ? "bg-emerald-100 text-emerald-700" :
                          a.action === "manual" ? "bg-amber-100 text-amber-700" :
                          "bg-slate-100 text-slate-400"
                        }`}>
                          {a.action === "auto" ? "Automático" : a.action === "manual" ? "Manual" : a.action}
                        </span>
                        <span className="font-mono text-slate-600">{a.next}</span>
                        <span className="text-slate-400">{a.hint}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-slate-400 italic">Cargando...</div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {tab === "rules" && (
        <>
          {/* Rules list */}
          <div className="space-y-2">
            {rules.map((rule) => (
              <div key={rule.id} className="bg-white rounded-xl border border-slate-200 p-4">
                <div className="flex items-center justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-800">{rule.name}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                        rule.enabled ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-400"
                      }`}>{rule.enabled ? "Activa" : "Inactiva"}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">
                        {TRIGGER_TYPES.find((t) => t.value === rule.trigger_type)?.label || rule.trigger_type}
                      </span>
                    </div>
                    <div className="text-xs text-slate-400 mt-0.5">Prioridad {rule.priority} · T: cada {rule.interval_seconds}s · CD: {rule.cooldown_seconds}s</div>
                  </div>
                  <button onClick={() => handleDelete(rule.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-500 flex-shrink-0"><Trash2 size={14} /></button>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2 text-[10px]">
                  <div>
                    <span className="text-slate-400 uppercase tracking-wider">Condiciones</span>
                    <pre className="mt-0.5 bg-slate-50 rounded p-1.5 text-slate-600 overflow-x-auto">{JSON.stringify(JSON.parse(rule.conditions || "{}"), null, 1)}</pre>
                  </div>
                  <div>
                    <span className="text-slate-400 uppercase tracking-wider">Acciones</span>
                    <pre className="mt-0.5 bg-slate-50 rounded p-1.5 text-slate-600 overflow-x-auto">{JSON.stringify(JSON.parse(rule.actions || "[]"), null, 1)}</pre>
                  </div>
                </div>
              </div>
            ))}
            {rules.length === 0 && <div className="text-sm text-slate-400 italic text-center py-8">Sin reglas de automatización</div>}
          </div>

          {/* Create button */}
          <button onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-900 text-white rounded-lg text-sm font-semibold hover:bg-blue-800">
            <Plus size={16} /> {showForm ? "Cancelar" : "Nueva regla"}
          </button>

          {/* Create form */}
          {showForm && (
            <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
              <h3 className="font-semibold text-slate-800">Nueva regla</h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-slate-400 uppercase">Nombre</label>
                  <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded px-2 py-1.5 text-sm" />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 uppercase">Tipo</label>
                  <select value={form.triggerType} onChange={(e) => setForm({ ...form, triggerType: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded px-2 py-1.5 text-sm">
                    {TRIGGER_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 uppercase">Prioridad</label>
                  <input value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}
                    type="number" className="w-full bg-slate-50 border border-slate-300 rounded px-2 py-1.5 text-sm" />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 uppercase">Intervalo (s)</label>
                  <input value={form.intervalSeconds} onChange={(e) => setForm({ ...form, intervalSeconds: e.target.value })}
                    type="number" className="w-full bg-slate-50 border border-slate-300 rounded px-2 py-1.5 text-sm" />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 uppercase">Cooldown (s)</label>
                  <input value={form.cooldownSeconds} onChange={(e) => setForm({ ...form, cooldownSeconds: e.target.value })}
                    type="number" className="w-full bg-slate-50 border border-slate-300 rounded px-2 py-1.5 text-sm" />
                </div>
              </div>
              <div>
                <label className="text-[10px] text-slate-400 uppercase">Descripción</label>
                <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded px-2 py-1.5 text-sm" />
              </div>
              <div>
                <label className="text-[10px] text-slate-400 uppercase">Condiciones (JSON)</label>
                <textarea value={form.conditions} onChange={(e) => setForm({ ...form, conditions: e.target.value })}
                  rows={3} className="w-full bg-slate-50 border border-slate-300 rounded px-2 py-1.5 text-sm font-mono" />
              </div>
              <div>
                <label className="text-[10px] text-slate-400 uppercase">Acciones (JSON array)</label>
                <textarea value={form.actions} onChange={(e) => setForm({ ...form, actions: e.target.value })}
                  rows={3} className="w-full bg-slate-50 border border-slate-300 rounded px-2 py-1.5 text-sm font-mono" />
              </div>
              <button onClick={handleCreate}
                className="px-4 py-2 bg-emerald-700 text-white rounded-lg text-sm font-semibold hover:bg-emerald-600">
                Crear regla
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
