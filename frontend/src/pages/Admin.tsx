import { useEffect, useState } from "react";
import {
  api, connectWS, fileUrl,
  type Config, type Operator, type Place, type Train, type TrainType,
} from "../lib/api";
import { LANGUAGES, type Language } from "../lib/i18n";
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

export default function Admin() {
  const [config, setConfig] = useState<Config | null>(null);
  const [trains, setTrains] = useState<Train[]>([]);
  const [operators, setOperators] = useState<Operator[]>([]);
  const [trainTypes, setTrainTypes] = useState<TrainType[]>([]);
  const [places, setPlaces] = useState<Place[]>([]);
  const [editing, setEditing] = useState<Partial<Train> | null>(null);
  const [editingOperator, setEditingOperator] = useState<Operator | null>(null);
  const [editingType, setEditingType] = useState<TrainType | null>(null);
  const [activeTab, setActiveTab] = useState<"config">("config");

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
    newTrains.forEach((t, i) => {
      // Could update order in DB if DB supports it
      // For now, just reorder in UI
    });
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
        <h1 className="font-display text-4xl tracking-wide">RailBoard · Admin</h1>
        <a href="/" target="_blank" className="text-board-amber underline">
          Abrir pantalla pública →
        </a>
      </header>

      <div className="flex gap-4 mb-8 border-b border-white/10">
        <span className="px-4 py-2 font-bold text-board-amber border-b-2 border-board-amber">Configuración</span>
        <a href="/trains" className="px-4 py-2 font-bold text-board-dim hover:text-board-amber">Trenes</a>
      </div>

      {/* Configuración */}
        <div className="space-y-5">
          {/* Station Config */}
          <section className="bg-board-row rounded-lg p-5">
            <h2 className="font-display text-2xl mb-4">Estación</h2>
            <label className="block text-xs text-board-dim uppercase mb-1">Logo (URL o subir)</label>
            <div className="flex gap-2 mb-3">
              <input
                className="flex-1 bg-black/40 rounded px-3 py-2"
                placeholder="https://..."
                value={config.logo_url || ""}
                onChange={(e) => setConfig({ ...config, logo_url: e.target.value })}
              />
              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    const reader = new FileReader();
                    reader.onload = (ev) => {
                      setConfig({ ...config, logo_url: ev.target?.result as string });
                    };
                    reader.readAsDataURL(file);
                  }
                }}
              />
            </div>
            {config.logo_url && <img src={config.logo_url} className="h-8 mb-3" alt="Logo" />}
            <label className="block text-xs text-board-dim uppercase mb-1">Nombre</label>
            <input
              className="w-full bg-black/40 rounded px-3 py-2 mb-3"
              value={config.station_name}
              onChange={(e) => setConfig({ ...config, station_name: e.target.value })}
            />
            <label className="block text-xs text-board-dim uppercase mb-1">Modo</label>
            <select
              className="w-full bg-black/40 rounded px-3 py-2 mb-3"
              value={config.mode}
              onChange={(e) => setConfig({ ...config, mode: e.target.value as Config["mode"] })}
            >
              <option value="departures">Salidas</option>
              <option value="arrivals">Llegadas</option>
            </select>
            <label className="block text-xs text-board-dim uppercase mb-1">Idioma</label>
            <select
              className="w-full bg-black/40 rounded px-3 py-2 mb-4"
              value={(config.language as Language) ?? "es"}
              onChange={(e) => setConfig({ ...config, language: e.target.value as Language })}
            >
              {Object.entries(LANGUAGES).map(([code, name]) => (
                <option key={code} value={code}>{name}</option>
              ))}
            </select>
            <label className="block text-xs text-board-dim uppercase mb-1">Texto pie de pantalla</label>
            <input
              className="w-full bg-black/40 rounded px-3 py-2 mb-3"
              value={config.footerText || ""}
              onChange={(e) => setConfig({ ...config, footerText: e.target.value })}
            />
            <button
              onClick={() => api.setConfig(config)}
              className="bg-board-amber text-board-bg font-bold px-4 py-2 rounded w-full"
            >
              Guardar
            </button>
          </section>

          {/* Styling */}
          <section className="bg-board-row rounded-lg p-5">
            <h2 className="font-display text-2xl mb-4">Estilos</h2>
            <label className="block text-xs text-board-dim uppercase mb-1">Fondo</label>
            <input
              type="color"
              className="w-full bg-black/40 rounded px-3 py-2 mb-3"
              value={config.bgColor || "#050a14"}
              onChange={(e) => setConfig({ ...config, bgColor: e.target.value })}
            />
            <label className="block text-xs text-board-dim uppercase mb-1">Header fondo</label>
            <input
              type="color"
              className="w-full bg-black/40 rounded px-3 py-2 mb-3"
              value={config.headerBgColor || "#BFEFD5"}
              onChange={(e) => setConfig({ ...config, headerBgColor: e.target.value })}
            />
            <label className="block text-xs text-board-dim uppercase mb-1">Header texto</label>
            <input
              type="color"
              className="w-full bg-black/40 rounded px-3 py-2 mb-3"
              value={config.headerTextColor || "#f5f3ec"}
              onChange={(e) => setConfig({ ...config, headerTextColor: e.target.value })}
            />
            <label className="block text-xs text-board-dim uppercase mb-1">Fila par</label>
            <input
              type="color"
              className="w-full bg-black/40 rounded px-3 py-2 mb-3"
              value={config.rowBgColor || "#1A3254"}
              onChange={(e) => setConfig({ ...config, rowBgColor: e.target.value })}
            />
            <label className="block text-xs text-board-dim uppercase mb-1">Fila impar</label>
            <input
              type="color"
              className="w-full bg-black/40 rounded px-3 py-2 mb-3"
              value={config.altBgColor || "#102341"}
              onChange={(e) => setConfig({ ...config, altBgColor: e.target.value })}
            />
            <label className="block text-xs text-board-dim uppercase mb-1">Tamaño destino (px)</label>
            <input
              type="number"
              className="w-full bg-black/40 rounded px-3 py-2 mb-3"
              min="20"
              max="100"
              value={parseInt(config.destinationFontSize || "48")}
              onChange={(e) => setConfig({ ...config, destinationFontSize: e.target.value })}
            />
            <button
              onClick={() => api.setConfig(config)}
              className="bg-board-amber text-board-bg font-bold px-4 py-2 rounded w-full"
            >
              Guardar estilos
            </button>
          </section>

          {/* Operators */}
          <Catalog
            title="Operadores"
            items={operators.map((o) => ({ id: o.id, label: o.name, extra: o.logo_url ? <img src={fileUrl(o.logo_url)!} className="h-6"/> : null }))}
            onRemove={(id) => api.deleteOperator(id).then(refresh)}
            onEdit={(id) => setEditingOperator(operators.find(o => o.id === id) || null)}
            renderCreate={() => <OperatorCreate onCreated={refresh} />}
          />

          {/* Operator editor modal */}
          {editingOperator && (
            <section className="bg-board-row rounded-lg p-5 border border-board-amber">
              <h2 className="font-display text-2xl mb-4">Editar operador</h2>
              <div className="flex flex-col gap-2">
                <input
                  className="bg-black/40 rounded px-3 py-2"
                  placeholder="Nombre"
                  value={editingOperator.name}
                  onChange={(e) => setEditingOperator({ ...editingOperator, name: e.target.value })}
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => { api.updateOperator(editingOperator.id, editingOperator.name).then(() => { setEditingOperator(null); refresh(); }); }}
                    className="flex-1 bg-board-amber text-board-bg font-bold px-4 py-2 rounded"
                  >
                    Guardar
                  </button>
                  <button
                    onClick={() => { api.deleteOperator(editingOperator.id).then(() => { setEditingOperator(null); refresh(); }); }}
                    className="flex-1 bg-board-red text-white font-bold px-4 py-2 rounded"
                  >
                    Eliminar
                  </button>
                  <button
                    onClick={() => { setEditingOperator(null); }}
                    className="flex-1 px-4 py-2 rounded bg-white/10"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            </section>
          )}

          {/* Train types */}
          <Catalog
            title="Tipos de tren"
            items={trainTypes.map((t) => ({
              id: t.id,
              label: `${t.code} — ${t.name}`,
              extra: <span className="inline-block w-4 h-4 rounded" style={{ background: t.color }} />,
            }))}
            onRemove={(id) => api.deleteTrainType(id).then(refresh)}
            onEdit={(id) => setEditingType(trainTypes.find(t => t.id === id) || null)}
            renderCreate={() => <TrainTypeCreate onCreated={refresh} />}
          />

          {/* Train type editor modal */}
          {editingType && (
            <section className="bg-board-row rounded-lg p-5 border border-board-amber">
              <h2 className="font-display text-2xl mb-4">Editar tipo de tren</h2>
              <div className="flex flex-col gap-2">
                <input
                  className="bg-black/40 rounded px-3 py-2"
                  placeholder="Código (AVE)"
                  value={editingType.code}
                  onChange={(e) => setEditingType({ ...editingType, code: e.target.value })}
                />
                <input
                  className="bg-black/40 rounded px-3 py-2"
                  placeholder="Nombre"
                  value={editingType.name}
                  onChange={(e) => setEditingType({ ...editingType, name: e.target.value })}
                />
                <input
                  type="color"
                  value={editingType.color}
                  onChange={(e) => setEditingType({ ...editingType, color: e.target.value })}
                  className="bg-black/40 rounded px-3 py-2"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => { api.updateTrainType(editingType.id, editingType.code, editingType.name, editingType.color).then(() => { setEditingType(null); refresh(); }); }}
                    className="flex-1 bg-board-amber text-board-bg font-bold px-4 py-2 rounded"
                  >
                    Guardar
                  </button>
                  <button
                    onClick={() => { api.deleteTrainType(editingType.id).then(() => { setEditingType(null); refresh(); }); }}
                    className="flex-1 bg-board-red text-white font-bold px-4 py-2 rounded"
                  >
                    Eliminar
                  </button>
                  <button
                    onClick={() => { setEditingType(null); }}
                    className="flex-1 px-4 py-2 rounded bg-white/10"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            </section>
          )}

          {/* Places */}
          <Catalog
            title="Lugares / destinos"
            items={places.map((p) => ({ id: p.id, label: p.name }))}
            onRemove={(id) => api.deletePlace(id).then(refresh)}
            renderCreate={() => <PlaceCreate onCreated={refresh} />}
          />
        </div>
      )}
    </div>
  );
}

// ------- sub-components --------

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
      className={`bg-black/20 rounded p-3 flex gap-3 items-center flex-wrap cursor-grab ${isDragging ? "cursor-grabbing" : ""}`}
      {...attributes}
      {...listeners}
    >
      <input
        type="time"
        className="bg-black/40 rounded px-2 py-1 w-24"
        value={train.scheduled_time}
        onChange={(e) => api.updateTrain(train.id, { scheduled_time: e.target.value }).then(refresh)}
        onClick={(e) => e.stopPropagation()}
      />
      <input
        type="text"
        className="bg-black/40 rounded px-2 py-1 w-16"
        value={train.number}
        onChange={(e) => api.updateTrain(train.id, { number: e.target.value }).then(refresh)}
        onClick={(e) => e.stopPropagation()}
      />
      <input
        type="text"
        className="bg-black/40 rounded px-2 py-1 flex-1 min-w-48"
        value={train.destination}
        onChange={(e) => api.updateTrain(train.id, { destination: e.target.value }).then(refresh)}
        onClick={(e) => e.stopPropagation()}
        placeholder="Destino"
      />
      <input
        type="text"
        className="bg-black/40 rounded px-2 py-1 w-12"
        value={train.platform}
        onChange={(e) => api.updateTrain(train.id, { platform: e.target.value }).then(refresh)}
        onClick={(e) => e.stopPropagation()}
      />
      <select
        className="bg-black/40 rounded px-2 py-1"
        value={train.status}
        onChange={(e) => api.setStatus(train.id, e.target.value as Train["status"]).then(refresh)}
        onClick={(e) => e.stopPropagation()}
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

function Catalog({
  title, items, onRemove, onEdit, renderCreate,
}: {
  title: string;
  items: { id: number; label: string; extra?: React.ReactNode }[];
  onRemove: (id: number) => void;
  onEdit?: (id: number) => void;
  renderCreate: () => React.ReactNode;
}) {
  return (
    <section className="bg-board-row rounded-lg p-5">
      <h2 className="font-display text-2xl mb-4">{title}</h2>
      <ul className="space-y-1 max-h-48 overflow-y-auto mb-3">
        {items.map((it) => (
          <li key={it.id} className="flex items-center justify-between py-1 border-b border-white/5">
            <span className="flex items-center gap-2">{it.extra}{it.label}</span>
            <div className="flex gap-1">
              {onEdit && <button onClick={() => onEdit(it.id)} className="text-board-amber text-sm">Editar</button>}
              <button onClick={() => onRemove(it.id)} className="text-board-red text-sm">✕</button>
            </div>
          </li>
        ))}
        {items.length === 0 && <li className="text-board-dim text-sm">Vacío</li>}
      </ul>
      {renderCreate()}
    </section>
  );
}

function OperatorCreate({ onCreated }: { onCreated: () => void }) {
  const [name, setName] = useState("");
  const [logo, setLogo] = useState<File | null>(null);
  return (
    <div className="flex flex-col gap-2">
      <input className="bg-black/40 rounded px-2 py-1" placeholder="Nombre"
             value={name} onChange={(e) => setName(e.target.value)} />
      <input type="file" accept="image/*" onChange={(e) => setLogo(e.target.files?.[0] ?? null)} />
      <button
        className="bg-board-amber text-board-bg font-bold rounded py-1"
        onClick={async () => { if (name) { await api.createOperator(name, logo); setName(""); setLogo(null); onCreated(); } }}
      >Añadir operador</button>
    </div>
  );
}

function TrainTypeCreate({ onCreated }: { onCreated: () => void }) {
  const [code, setCode] = useState(""); const [name, setName] = useState("");
  const [color, setColor] = useState("#7c1d2e"); const [logo, setLogo] = useState<File | null>(null);
  return (
    <div className="flex flex-col gap-2">
      <input className="bg-black/40 rounded px-2 py-1" placeholder="Código (AVE)" value={code} onChange={(e) => setCode(e.target.value)} />
      <input className="bg-black/40 rounded px-2 py-1" placeholder="Nombre" value={name} onChange={(e) => setName(e.target.value)} />
      <input type="color" value={color} onChange={(e) => setColor(e.target.value)} />
      <input type="file" accept="image/*" onChange={(e) => setLogo(e.target.files?.[0] ?? null)} />
      <button
        className="bg-board-amber text-board-bg font-bold rounded py-1"
        onClick={async () => { if (code && name) { await api.createTrainType(code, name, color, logo); setCode(""); setName(""); setLogo(null); onCreated(); } }}
      >Añadir tipo</button>
    </div>
  );
}

function PlaceCreate({ onCreated }: { onCreated: () => void }) {
  const [name, setName] = useState("");
  return (
    <div className="flex gap-2">
      <input className="bg-black/40 rounded px-2 py-1 flex-1" placeholder="Lugar"
             value={name} onChange={(e) => setName(e.target.value)} />
      <button
        className="bg-board-amber text-board-bg font-bold rounded px-3"
        onClick={async () => { if (name) { await api.createPlace(name); setName(""); onCreated(); } }}
      >+</button>
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
        <input className="bg-black/40 rounded px-3 py-2 w-full" list={dataListId} value={v.origin || ""} onChange={(e) => set("origin", e.target.value)} />
      </Field>
      <Field label="Destino">
        <input className="bg-black/40 rounded px-3 py-2 w-full" list={dataListId} value={v.destination || ""} onChange={(e) => set("destination", e.target.value)} />
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
