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
  platform: "1", sector: "A", status: "Scheduled",
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

  useEffect(() => { refresh(); return connectWS(refresh); }, []);

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
        <div className="flex gap-4 items-center">
          <span className="text-board-dim text-sm">Editar:</span>
          <a href="/train-settings" className="text-board-amber underline text-sm">Operadores</a>
          <a href="/train-settings" className="text-board-amber underline text-sm">Tipos de tren</a>
          <span className="text-board-dim">|</span>
          <a href="/admin" className="text-board-amber underline">Configuración</a>
          <a href="/" target="_blank" className="text-board-amber underline">
            Pantalla pública →
          </a>
        </div>
      </header>

      <section className="bg-board-row rounded-lg p-5">
        <div className="flex justify-between items-center mb-4">
          <h2 className="font-display text-2xl">Trenes ({trains.length})</h2>
          <div className="flex gap-2">
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
                    <TrainRow key={train.id} train={train} announce={announce} refresh={refresh} STATUSES={STATUSES} onEdit={setEditing} dragHandle />
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
                <div key={train.id} className="bg-black/20 rounded p-3 flex gap-3 items-center flex-wrap">
                  <span className="w-24 text-center">{train.scheduled_time}</span>
                  <span className="w-16 text-center">{train.number}</span>
                  <span className="flex-1 min-w-48">{train.destination}</span>
                  <span className="w-12 text-center">{train.platform}</span>
                  <span className="text-board-dim text-sm">{train.status}</span>
                  <button onClick={(e) => { e.preventDefault(); announce(train); }} className="text-board-green">🔊</button>
                  <button onClick={(e) => { e.preventDefault(); setEditing(train); }} className="text-board-amber">Editar</button>
                  <button onClick={(e) => { e.preventDefault(); if (confirm("¿Eliminar tren?")) api.deleteTrain(train.id).then(refresh); }} className="text-board-red">✕</button>
                </div>
              ))
            )}
          </div>
        )}

      </section>

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setEditing(null)}>
          <div className="bg-board-row rounded-lg p-6 w-full max-w-xl mx-4 border border-white/10" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-display text-2xl">{editing?.id ? "Editar tren" : "Nuevo tren"}</h3>
              <button onClick={() => setEditing(null)} className="text-board-dim hover:text-white text-2xl leading-none">✕</button>
            </div>
            <TrainForm
              value={editing}
              operators={operators}
              trainTypes={trainTypes}
              places={places}
              onCancel={() => setEditing(null)}
              onSave={async (v) => {
                if (v.id) await api.updateTrain(v.id, v);
                else      await api.createTrain(v);
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
      style={style}
      className={`bg-black/20 rounded p-3 flex gap-3 items-center flex-wrap ${isDragging ? "opacity-50" : ""}`}
    >
      <span {...attributes} {...listeners} className="cursor-grab text-board-dim text-lg select-none">⠿</span>
      <input
        type="time"
        className="bg-black/40 rounded px-2 py-1 w-24"
        value={train.scheduled_time}
        onChange={(e) => api.updateTrain(train.id, { scheduled_time: e.target.value }).then(refresh)}
      />
      <input
        type="text"
        className="bg-black/40 rounded px-2 py-1 w-16"
        value={train.number}
        onChange={(e) => api.updateTrain(train.id, { number: e.target.value }).then(refresh)}
      />
      <input
        type="text"
        className="bg-black/40 rounded px-2 py-1 flex-1 min-w-48"
        value={train.destination}
        onChange={(e) => api.updateTrain(train.id, { destination: e.target.value }).then(refresh)}
        placeholder="Destino"
      />
      <input
        type="text"
        className="bg-black/40 rounded px-2 py-1 w-12"
        value={train.platform}
        onChange={(e) => api.updateTrain(train.id, { platform: e.target.value }).then(refresh)}
      />
      <select
        className="bg-black/40 rounded px-2 py-1"
        value={train.status}
        onChange={(e) => api.setStatus(train.id, e.target.value as Train["status"]).then(refresh)}
      >
        {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
      </select>
      <button onClick={() => announce(train)} className="text-board-green">🔊</button>
      <button onClick={() => onEdit(train)} className="text-board-amber mr-2">
        Editar
      </button>
      <button
        onClick={() => { if (confirm("¿Eliminar tren?")) api.deleteTrain(train.id).then(refresh); }}
        className="text-board-red"
      >✕</button>
    </div>
  );
}

function TrainForm({
  value, operators, trainTypes, places, onSave, onCancel,
}: {
  value: Partial<Train>;
  operators: Operator[];
  trainTypes: TrainType[];
  places: Place[];
  onSave: (v: Partial<Train>) => void;
  onCancel: () => void;
}) {
  const [v, setV] = useState<Partial<Train>>(value);
  useEffect(() => setV(value), [value]);
  const set = (k: keyof Train, val: any) => setV((s) => ({ ...s, [k]: val }));

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
        <select className="bg-black/40 rounded px-3 py-2 w-full" value={v.status} onChange={(e) => set("status", e.target.value)}>
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
      <Field label="Vía">
        <input className="bg-black/40 rounded px-3 py-2 w-full" value={v.platform || ""} onChange={(e) => set("platform", e.target.value)} />
      </Field>
      <Field label="Sector">
        <input className="bg-black/40 rounded px-3 py-2 w-full" value={v.sector || ""} onChange={(e) => set("sector", e.target.value)} />
      </Field>
      <Field label="Paradas intermedias (separadas por coma)" wide>
        <input
          className="bg-black/40 rounded px-3 py-2 w-full"
          value={(v.stops || []).join(", ")}
          onChange={(e) => set("stops", e.target.value.split(",").map((s) => s.trim()).filter(Boolean))}
        />
      </Field>

      <div className="col-span-2 flex gap-2 justify-end mt-2">
        <button onClick={onCancel} className="px-4 py-2 rounded bg-white/10">Cancelar</button>
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
