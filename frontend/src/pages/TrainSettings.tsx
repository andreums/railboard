import { useEffect, useState } from "react";
import {
  api, connectWS, fileUrl,
  type Operator, type TrainType,
} from "../lib/api";

export default function TrainSettings() {
  const [operators, setOperators] = useState<Operator[]>([]);
  const [trainTypes, setTrainTypes] = useState<TrainType[]>([]);
  const [editingOperator, setEditingOperator] = useState<Operator | null>(null);
  const [editingType, setEditingType] = useState<TrainType | null>(null);
  const [operatorLogo, setOperatorLogo] = useState<File | null>(null);
  const [typeLogo, setTypeLogo] = useState<File | null>(null);

  const refresh = async () => {
    const [op, tt] = await Promise.all([
      api.listOperators(), api.listTrainTypes(),
    ]);
    setOperators(op); setTrainTypes(tt);
  };

  useEffect(() => { refresh(); return connectWS(refresh); }, []);

  return (
    <div className="min-h-screen bg-board-bg text-board-ink p-8 font-body">
      <header className="flex justify-between items-center mb-8">
        <h1 className="font-display text-4xl tracking-wide">RailBoard · Tipos y operadores</h1>
        <div className="flex gap-4 items-center">
          <a href="/trains" className="text-board-amber underline">Trenes</a>
          <a href="/admin" className="text-board-amber underline">Configuración</a>
          <a href="/" target="_blank" className="text-board-amber underline">
            Pantalla pública →
          </a>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Operators */}
        <section className="bg-board-row rounded-lg p-5">
          <h2 className="font-display text-2xl mb-4">Operadores</h2>
          <Catalog
            items={operators.map((o) => ({ id: o.id, label: o.name, extra: o.logo_url ? <img src={fileUrl(o.logo_url)!} className="h-6"/> : null }))}
            onRemove={(id) => api.deleteOperator(id).then(refresh)}
            onEdit={(id) => setEditingOperator(operators.find(o => o.id === id) || null)}
            renderCreate={() => <OperatorCreate onCreated={refresh} />}
          />
          {editingOperator && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setEditingOperator(null)}>
              <div className="bg-board-row rounded-lg p-6 w-full max-w-md mx-4 border border-board-amber" onClick={(e) => e.stopPropagation()}>
                <h3 className="font-display text-xl mb-4">Editar operador</h3>
                <div className="flex flex-col gap-3">
                  <input className="bg-black/40 rounded px-3 py-2" placeholder="Nombre" value={editingOperator.name} onChange={(e) => setEditingOperator({ ...editingOperator, name: e.target.value })} />
                  <div>
                    <label className="block text-xs text-board-dim uppercase tracking-wider mb-1.5">Logo</label>
                    {editingOperator.logo_url && <img src={fileUrl(editingOperator.logo_url)!} className="h-8 mb-2" alt="Logo" />}
                    <input type="file" accept="image/*" onChange={(e) => setOperatorLogo(e.target.files?.[0] ?? null)} />
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => { api.updateOperator(editingOperator.id, editingOperator.name, operatorLogo).then(() => { setEditingOperator(null); setOperatorLogo(null); refresh(); }); }} className="flex-1 bg-board-amber text-board-bg font-bold px-4 py-2 rounded">Guardar</button>
                    <button onClick={() => { api.deleteOperator(editingOperator.id).then(() => { setEditingOperator(null); setOperatorLogo(null); refresh(); }); }} className="flex-1 bg-board-red text-white font-bold px-4 py-2 rounded">Eliminar</button>
                    <button onClick={() => { setEditingOperator(null); setOperatorLogo(null); }} className="flex-1 px-4 py-2 rounded bg-white/10">Cancelar</button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* Train Types */}
        <section className="bg-board-row rounded-lg p-5">
          <h2 className="font-display text-2xl mb-4">Tipos de tren</h2>
          <Catalog
            items={trainTypes.map((t) => ({
              id: t.id,
              label: `${t.code} — ${t.name}`,
              extra: t.logo_url ? <img src={fileUrl(t.logo_url)!} className="h-6" alt={t.code} /> : <span className="inline-block w-4 h-4 rounded" style={{ background: t.color }} />,
            }))}
            onRemove={(id) => api.deleteTrainType(id).then(refresh)}
            onEdit={(id) => setEditingType(trainTypes.find(t => t.id === id) || null)}
            renderCreate={() => <TrainTypeCreate onCreated={refresh} />}
          />
          {editingType && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setEditingType(null)}>
              <div className="bg-board-row rounded-lg p-6 w-full max-w-md mx-4 border border-board-amber" onClick={(e) => e.stopPropagation()}>
                <h3 className="font-display text-xl mb-4">Editar tipo de tren</h3>
                <div className="flex flex-col gap-3">
                  <input className="bg-black/40 rounded px-3 py-2" placeholder="Código (AVE)" value={editingType.code} onChange={(e) => setEditingType({ ...editingType, code: e.target.value })} />
                  <input className="bg-black/40 rounded px-3 py-2" placeholder="Nombre" value={editingType.name} onChange={(e) => setEditingType({ ...editingType, name: e.target.value })} />
                  <input type="color" value={editingType.color} onChange={(e) => setEditingType({ ...editingType, color: e.target.value })} className="bg-black/40 rounded px-3 py-2 h-10" />
                  <div>
                    <label className="block text-xs text-board-dim uppercase tracking-wider mb-1.5">Logo</label>
                    {editingType.logo_url && <img src={fileUrl(editingType.logo_url)!} className="h-8 mb-2" alt="Logo" />}
                    <input type="file" accept="image/*" onChange={(e) => setTypeLogo(e.target.files?.[0] ?? null)} />
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => { api.updateTrainType(editingType.id, editingType.code, editingType.name, editingType.color, typeLogo).then(() => { setEditingType(null); setTypeLogo(null); refresh(); }); }} className="flex-1 bg-board-amber text-board-bg font-bold px-4 py-2 rounded">Guardar</button>
                    <button onClick={() => { api.deleteTrainType(editingType.id).then(() => { setEditingType(null); setTypeLogo(null); refresh(); }); }} className="flex-1 bg-board-red text-white font-bold px-4 py-2 rounded">Eliminar</button>
                    <button onClick={() => { setEditingType(null); setTypeLogo(null); }} className="flex-1 px-4 py-2 rounded bg-white/10">Cancelar</button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function Catalog({ items, onRemove, onEdit, renderCreate }: {
  items: { id: number; label: string; extra?: React.ReactNode }[];
  onRemove: (id: number) => void;
  onEdit?: (id: number) => void;
  renderCreate: () => React.ReactNode;
}) {
  return (
    <div>
      <ul className="space-y-1 max-h-64 overflow-y-auto mb-3">
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
    </div>
  );
}

function OperatorCreate({ onCreated }: { onCreated: () => void }) {
  const [name, setName] = useState("");
  const [logo, setLogo] = useState<File | null>(null);
  return (
    <div className="flex flex-col gap-2">
      <input className="bg-black/40 rounded px-2 py-1" placeholder="Nombre" value={name} onChange={(e) => setName(e.target.value)} />
      <input type="file" accept="image/*" onChange={(e) => setLogo(e.target.files?.[0] ?? null)} />
      <button className="bg-board-amber text-board-bg font-bold rounded py-1" onClick={async () => { if (name) { await api.createOperator(name, logo); setName(""); setLogo(null); onCreated(); } }}>Añadir operador</button>
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
      <button className="bg-board-amber text-board-bg font-bold rounded py-1" onClick={async () => { if (code && name) { await api.createTrainType(code, name, color, logo); setCode(""); setName(""); setLogo(null); onCreated(); } }}>Añadir tipo</button>
    </div>
  );
}
