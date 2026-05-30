import { useEffect, useState } from "react";
import {
  api, connectWS,
  type Config, type Operator, type Place, type Train, type TrainType,
} from "../lib/api";
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

const STATUSES: Train["status"][] = [
  "Scheduled", "Boarding", "Delayed", "Departed", "Arrived", "Cancelled",
];

const EMPTY: Partial<Train> = {
  number: "", origin: "Madrid Puerta de Atocha", destination: "",
  stops: [], scheduled_time: "12:00", expected_time: "12:00",
  platform: "1", sector: "A", observations: "", status: "Scheduled",
  operator_id: null, train_type_id: null,
};

export default function Trains() {
  const [config, setConfig] = useState<Config | null>(null);
  const [trains, setTrains] = useState<Train[]>([]);
  const [operators, setOperators] = useState<Operator[]>([]);
  const [trainTypes, setTrainTypes] = useState<TrainType[]>([]);
  const [places, setPlaces] = useState<Place[]>([]);
  const [editing, setEditing] = useState<Partial<Train> | null>(null);
  const [reorderMode, setReorderMode] = useState(false);

  const refresh = async () => {
    const [c, t, op, tt, pl] = await Promise.all([
      api.getConfig(), api.listTrains(), api.listOperators(),
      api.listTrainTypes(), api.listPlaces(),
    ]);
    setConfig(c); setTrains(t); setOperators(op); setTrainTypes(tt); setPlaces(pl);
  };

  useEffect(() => {
    refresh();
    const ws = connectWS(refresh);
    return () => {
      if (ws && typeof ws.close === "function") ws.close();
    };
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const trainIds = trains.map(t => String(t.id));

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = trainIds.indexOf(String(active.id));
    const newIndex = trainIds.indexOf(String(over.id));
    const newTrains = arrayMove(trains, oldIndex, newIndex);
    setTrains(newTrains);
    api.reorderTrains(newTrains.map(t => t.id));
  };

  const clearAllTrains = async () => {
    if (!confirm("¿Borrar todos los trenes?")) return;
    await api.clearTrains();
    refresh();
  };

  const speak = (text: string) => {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "es-ES"; u.rate = 0.95;
    window.speechSynthesis.speak(u);
  };

  const announce = (t: Train) => {
    const place = config?.mode === "arrivals" ? t.origin : t.destination;
    const action = config?.mode === "arrivals" ? "procedente de" : "con destino a";
    speak(
      `Atención. Tren ${t.type_name || ""} ${t.number}, ${action} ${place}, ` +
      `efectuará su ${config?.mode === "arrivals" ? "llegada" : "salida"} por la vía ${t.platform}, sector ${t.sector}.`
    );
  };

  if (!config) return <div className="p-10 text-board-dim">Cargando…</div>;

  return (
    <div className="min-h-screen bg-board-bg text-board-ink p-8 font-body">
      <header className="flex justify-between items-center mb-8">
        <h1 className="font-display text-4xl tracking-wide">RailBoard · Trenes</h1>
        <div className="flex gap-4 items-center text-sm">
          <span className="text-board-dim">Editar:</span>
          <a href="/train-settings" className="text-board-amber underline">Operadores</a>
          <a href="/train-settings" className="text-board-amber underline">Tipos de tren</a>
          <span className="text-board-dim">|</span>
          <a href="/admin" className="text-board-amber underline">Configuración</a>
          <a href="/" target="_blank" className="text-board-amber underline">Pantalla pública →</a>
        </div>
      </header>

      <section className="bg-board-row rounded-lg p-5">
        <div className="flex justify-between items-center mb-4">
          <h2 className="font-display text-2xl">Trenes ({trains.length})</h2>
          <div className="flex gap-2">
            <button onClick={() => { api.generateRandomTrain().then(refresh); }} className="bg-board-amber hover:bg-yellow-500 text-board-bg font-bold px-4 py-2 rounded text-sm">+ Tren random</button>
            <button
              onClick={() => setReorderMode(!reorderMode)}
              className={`px-3 py-1 rounded font-bold ${reorderMode ? "bg-board-green text-white" : "bg-white/10 text-board-dim"}`}
            >
              {reorderMode ? "✕ Hecho" : "↕ Reordenar"}
            </button>
            <button
              onClick={() => setEditing(EMPTY)}
              className="bg-board-amber text-board-bg px-3 py-1 rounded font-bold"
            >
              + Nuevo
            </button>
            <button
              onClick={clearAllTrains}
              className="bg-board-red text-white px-3 py-1 rounded font-bold"
            >
              Borrar todos
            </button>
          </div>
        </div>
        {reorderMode ? (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={trainIds} strategy={verticalListSortingStrategy}>
              <div className="space-y-2 mb-4">
                {trains.length === 0 ? (
                  <div className="text-board-dim text-sm py-4">Arrastra para reordenar</div>
                ) : (
                  trains.map((train) => (
                    <TrainRow key={train.id} train={train} announce={announce} refresh={refresh} STATUSES={STATUSES} onEdit={setEditing} />
                  ))
                )}
              </div>
            </SortableContext>
          </DndContext>
        ) : (
          <div className="space-y-2 mb-4">
            {trains.length === 0 ? (
              <div className="text-board-dim text-sm py-4">Sin trenes</div>
            ) : (
              trains.map((train) => (
                <TrainListRow key={train.id} train={train} announce={announce} refresh={refresh} onEdit={setEditing} />
              ))
            )}
          </div>
        )}

      </section>

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setEditing(null)}>
          <div className="bg-board-row rounded-lg p-6 w-full max-w-4xl max-h-[90vh] mx-4 border border-white/10 overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4 sticky top-0 bg-board-row">
              <h3 className="font-display text-2xl">{editing?.id ? "Editar tren" : "Nuevo tren"}</h3>
              <button onClick={() => setEditing(null)} className="text-board-dim hover:text-white text-2xl leading-none">✕</button>
            </div>
            <TrainForm
              value={editing}
              operators={operators}
              trainTypes={trainTypes}
              places={places}
              config={config}
              announce={announce}
              onCancel={() => setEditing(null)}
              onSave={async (v) => {
                if (v.id) await api.updateTrain(v.id, v);
                else await api.createTrain(v);
                setEditing(null);
                refresh();
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function formatPlatform(train: Train) {
  const sector = train.sector && train.sector !== "-" ? train.sector : "";
  if (!sector) return train.platform;
  return /^\d+$/.test(train.platform) && /^\d+$/.test(sector)
    ? `${train.platform}-${sector}`
    : `${train.platform}${sector}`;
}

function CommuterBadge({ code, color }: { code: string; color?: string | null }) {
  const label = code.toUpperCase();
  return (
    <svg viewBox="0 0 100.1 54.6" aria-label={label} role="img" className="h-8 w-[60px]">
      <rect x="0" y="0" width="100.1" height="54.6" rx="14" fill={color || "#c2185b"} />
      <text
        x="50"
        y="50%"
        textAnchor="middle"
        dominantBaseline="central"
        fontFamily="Oswald, Arial, sans-serif"
        fontSize={label.length > 3 ? 25 : 28}
        fontWeight="700"
        fill="#fff"
      >
        {label}
      </text>
    </svg>
  );
}

function TrainSummary({ train }: { train: Train }) {
  const service = [train.type_code, train.operator_name].filter(Boolean).join(" · ") || "Sin tipo";
  const expectedChanged = train.expected_time !== train.scheduled_time;
  const stopsText = train.stops?.length ? train.stops.join(" · ") : "Sin paradas intermedias";
  const isCommuter = /^(C(-\d+)?|R\d+[A-Z]?)$/i.test(train.type_code || "");
  const meta = [
    `ID ${train.id}`,
    `Orden ${train.sort_order ?? "-"}`,
    `Tipo ${train.type_name || train.type_code || "-"}`,
    `Operador ${train.operator_name || "-"}`,
    `Vía ${formatPlatform(train)}`,
    `Estado ${train.status}`,
    `Alta ${train.created_at || "-"}`,
  ].join(" · ");

  return (
    <div className="min-w-0 flex-1 grid grid-cols-1 xl:grid-cols-[8rem_9rem_1fr_9rem_9rem] gap-3 items-center">
      <div className="font-mono text-lg leading-tight">
        <div>{train.scheduled_time}</div>
        {expectedChanged && <div className="text-sm text-board-green">Est. {train.expected_time}</div>}
      </div>

      <div className="min-w-0">
        <div className="font-bold text-lg leading-tight">{train.number}</div>
        <div className="text-xs text-board-dim truncate">{service}</div>
      </div>

      <div className="min-w-0">
        <div className="text-lg font-bold" title={`${train.origin} → ${train.destination}`}>
          {train.origin} → {train.destination}
        </div>
        <div className="text-sm text-board-dim" title={stopsText}>{stopsText}</div>
        {train.observations && (
          <div className="text-sm text-board-green" title={train.observations}>{train.observations}</div>
        )}
        <div className="mt-1 text-xs text-board-dim">{meta}</div>
      </div>

      <div className="min-w-0 flex items-center gap-2">
        {isCommuter && train.type_code ? (
          <CommuterBadge code={train.type_code} color={train.type_color} />
        ) : (
          <span
            className="inline-flex min-w-14 items-center justify-center rounded px-2 py-1 text-sm font-bold text-white"
            style={{ backgroundColor: train.type_color || "rgba(255,255,255,0.1)" }}
          >
            {train.type_code || "—"}
          </span>
        )}
      </div>

      <div className="flex items-center justify-between gap-3 xl:justify-end">
        <div className="text-right">
          <div className="text-lg font-bold">Vía {formatPlatform(train)}</div>
          <div className="text-sm text-board-dim">{train.status}</div>
          <div className="text-xs text-board-dim">{train.created_at || "-"}</div>
        </div>
      </div>
    </div>
  );
}

function TrainListRow({ train, announce, refresh, onEdit }: {
  train: Train;
  announce: (t: Train) => void;
  refresh: () => void;
  onEdit: (t: Train) => void;
}) {
  return (
    <div className="bg-black/20 rounded p-3 flex gap-4 items-center">
      <TrainSummary train={train} />
      <div className="flex shrink-0 gap-3 items-center">
        <button onClick={(e) => { e.preventDefault(); announce(train); }} className="text-board-green text-lg" title="Anunciar">🔊</button>
        <button onClick={(e) => { e.preventDefault(); onEdit(train); }} className="text-board-amber text-lg" title="Editar">Editar</button>
        <button onClick={(e) => { e.preventDefault(); if (confirm("¿Eliminar tren?")) api.deleteTrain(train.id).then(refresh); }} className="text-board-red text-xl leading-none" title="Eliminar">✕</button>
      </div>
    </div>
  );
}

function TrainRow({ train, announce, refresh, STATUSES, onEdit }: {
  train: Train;
  announce: (t: Train) => void;
  refresh: () => void;
  STATUSES: Train["status"][];
  onEdit: (t: Train) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: String(train.id) });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={{
        ...style,
        display: "flex",
        gap: "1rem",
        alignItems: "center",
        padding: "0.75rem",
        backgroundColor: isDragging ? "rgba(0,0,0,0.3)" : "rgba(0,0,0,0.2)",
        borderRadius: "0.5rem",
      }}
    >
      {/* Drag handle */}
      <span {...attributes} {...listeners} className="cursor-grab text-board-dim text-lg select-none">⠿</span>

      <TrainSummary train={train} />

      {/* Actions */}
      <div className="flex shrink-0 gap-2">
        <button onClick={() => announce(train)} className="text-board-green text-lg" title="Anunciar">🔊</button>
        <button onClick={() => onEdit(train)} className="text-board-amber text-lg" title="Editar">✏️</button>
        <button
          onClick={() => { if (confirm("¿Eliminar tren?")) api.deleteTrain(train.id).then(refresh); }}
          className="text-board-red text-lg"
          title="Eliminar"
        >✕</button>
      </div>
    </div>
  );
}

function TrainForm({
  value, operators, trainTypes, places, config, announce, onSave, onCancel,
}: {
  value: Partial<Train>;
  operators: Operator[];
  trainTypes: TrainType[];
  places: Place[];
  config: Config | null;
  announce: (t: Train) => void;
  onSave: (v: Partial<Train>) => void;
  onCancel: () => void;
}) {
  const [v, setV] = useState<Partial<Train>>(value);
  const [stopsText, setStopsText] = useState((value.stops || []).join("\n"));

  useEffect(() => {
    setV(value);
    setStopsText((value.stops || []).join("\n"));
  }, [value]);

  const set = (k: keyof Train, val: any) => setV((s) => ({ ...s, [k]: val }));

  const [delayMinutes, setDelayMinutes] = useState(0);

  const calculateEstimatedTime = (scheduled: string, delay: number) => {
    const [h, m] = scheduled.split(":").map(Number);
    const d = new Date();
    d.setHours(h, m + delay, 0, 0);
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  };

  const calculateDelay = (scheduled: string, expected: string) => {
    if (!scheduled || !expected) return 0;
    const [sh, sm] = scheduled.split(":").map(Number);
    const [eh, em] = expected.split(":").map(Number);
    let delay = eh * 60 + em - (sh * 60 + sm);
    if (delay < -720) delay += 24 * 60; // wrap past midnight
    return delay;
  };

  // Auto-calculate delay when expected_time or scheduled_time changes
  useEffect(() => {
    const delay = calculateDelay(v.scheduled_time || "12:00", v.expected_time || "12:00");
    setDelayMinutes(delay);
  }, [v.scheduled_time, v.expected_time]);

  const estimatedFromDelay = calculateEstimatedTime(v.scheduled_time || "12:00", delayMinutes);

  const handleStopsChange = (text: string) => {
    setStopsText(text);
    const stops = text
      .split(/[\r\n;]+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    set("stops", stops);
  };

  const placeNames = places.map((p) => p.name);
  const dataListId = "places-list";

  return (
    <div className="grid grid-cols-2 gap-3">
      <datalist id={dataListId}>
        {placeNames.map((n) => <option key={n} value={n} />)}
      </datalist>

      <Field label="Número">
        <input className="bg-black/40 rounded px-3 py-2 w-full" value={v.number || ""} onChange={(e) => set("number", e.target.value)} />
      </Field>
      <Field label="Operador">
        <select className="bg-black/40 rounded px-3 py-2 w-full" value={v.operator_id ?? ""}
          onChange={(e) => set("operator_id", e.target.value ? Number(e.target.value) : null)}>
          <option value="">—</option>
          {operators.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
        </select>
      </Field>
      <Field label="Tipo">
        <select className="bg-black/40 rounded px-3 py-2 w-full" value={v.train_type_id ?? ""}
          onChange={(e) => set("train_type_id", e.target.value ? Number(e.target.value) : null)}>
          <option value="">—</option>
          {trainTypes.map((t) => <option key={t.id} value={t.id}>{t.code} — {t.name}</option>)}
        </select>
      </Field>
      <Field label="Estado">
        <select className="bg-black/40 rounded px-3 py-2 w-full" value={v.status} onChange={(e) => set("status", e.target.value as Train["status"])}>
          {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </Field>
      <Field label="Origen">
        <input className="bg-black/40 rounded px-3 py-2 w-full" value={v.origin || ""} onChange={(e) => set("origin", e.target.value)} />
      </Field>
      <Field label="Destino">
        <input className="bg-black/40 rounded px-3 py-2 w-full" value={v.destination || ""} onChange={(e) => set("destination", e.target.value)} />
      </Field>
      <Field label="Hora programada">
        <input className="bg-black/40 rounded px-3 py-2 w-full" type="time" value={v.scheduled_time || ""} onChange={(e) => set("scheduled_time", e.target.value)} />
      </Field>
      <Field label="Hora estimada">
        <input className="bg-black/40 rounded px-3 py-2 w-full" type="time" value={v.expected_time || ""} onChange={(e) => set("expected_time", e.target.value)} />
      </Field>
      <Field label="Retraso (minutos)">
        <input
          className="bg-black/40 rounded px-3 py-2 w-full opacity-75 cursor-not-allowed"
          type="number"
          value={delayMinutes}
          readOnly
        />
        <div className="text-board-dim text-xs mt-1">Calculado automáticamente</div>
        {delayMinutes > 0 && (
          <div className="text-board-red text-sm mt-1">
            Estimada: {estimatedFromDelay}
          </div>
        )}
      </Field>
      <Field label="Vía">
        <input className="bg-black/40 rounded px-3 py-2 w-full" value={v.platform || ""} onChange={(e) => set("platform", e.target.value)} />
      </Field>
      <Field label="Sector">
        <input className="bg-black/40 rounded px-3 py-2 w-full" value={v.sector || ""} onChange={(e) => set("sector", e.target.value)} />
      </Field>
      <Field label="Observaciones" wide>
        <textarea
          rows={5}
          placeholder="ej: Servicio reducido, parada adicional en..."
          className="bg-black/40 rounded px-3 py-2 w-full resize-vertical"
          value={v.observations || ""}
          onChange={(e) => set("observations", e.target.value)}
        />
      </Field>
      <Field label="Paradas intermedias (una por línea; `;` también separa)" wide>
        <textarea
          rows={4}
          placeholder="Escribe una parada por línea. Usa ';' para separar en la misma línea si quieres."
          className="bg-black/40 rounded px-3 py-2 w-full resize-vertical"
          value={stopsText}
          onChange={(e) => handleStopsChange(e.target.value)}
        />
      </Field>

      <div className="col-span-2 flex gap-2 justify-end mt-2">
        <button onClick={onCancel} className="px-4 py-2 rounded bg-white/10">Cancelar</button>
        {v.id && (
          <button onClick={() => announce(v as Train)} className="px-4 py-2 rounded bg-board-green text-board-bg font-bold" title="Escuchar anuncio en megafonía">
            🔊 Escuchar
          </button>
        )}
        <button onClick={() => onSave(v)} className="px-4 py-2 rounded bg-board-amber text-board-bg font-bold">
          Guardar
        </button>
      </div>
    </div>
  );
}

function Field({ label, children, wide }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <label className={`block ${wide ? "col-span-2" : ""}`}>
      <div className="text-xs text-board-dim uppercase mb-1">{label}</div>
      {children}
    </label>
  );
}
