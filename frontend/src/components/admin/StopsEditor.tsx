import type { TrainStop } from "../../lib/trainStops";

type Variant = "light" | "dark";

const STYLES: Record<Variant, { input: string; add: string; remove: string; empty: string }> = {
  light: {
    input:
      "rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-900 focus:outline-none transition",
    add: "inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50",
    remove: "px-2.5 py-2 rounded-lg border border-red-200 bg-red-50 text-red-600 text-xs font-semibold hover:bg-red-100",
    empty: "text-xs text-slate-400 italic",
  },
  dark: {
    input: "bg-black/40 rounded px-3 py-2 text-sm w-full",
    add: "px-3 py-1.5 rounded bg-white/10 text-xs font-medium hover:bg-white/20",
    remove: "px-2.5 py-2 rounded bg-red-500/20 text-red-300 text-xs font-semibold hover:bg-red-500/30",
    empty: "text-xs text-board-dim italic",
  },
};

export default function StopsEditor({
  stops,
  onChange,
  variant = "light",
}: {
  stops: TrainStop[];
  onChange: (stops: TrainStop[]) => void;
  variant?: Variant;
}) {
  const s = STYLES[variant];

  const update = (i: number, patch: Partial<TrainStop>) => {
    const next = stops.slice();
    next[i] = { ...next[i], ...patch };
    onChange(next);
  };
  const remove = (i: number) => onChange(stops.filter((_, idx) => idx !== i));
  const add = () => onChange([...stops, { station: "" }]);

  return (
    <div className="space-y-2">
      {stops.map((stop, i) => (
        <div key={i} className="flex gap-2 items-center">
          <input
            className={`${s.input} flex-1`}
            placeholder="Estación"
            value={stop.station}
            onChange={(e) => update(i, { station: e.target.value })}
          />
          <input
            type="time"
            className={`${s.input} w-32 shrink-0`}
            value={stop.time || ""}
            onChange={(e) => update(i, { time: e.target.value || undefined })}
          />
          <button type="button" onClick={() => remove(i)} className={s.remove} title="Eliminar parada">
            ✕
          </button>
        </div>
      ))}
      <button type="button" onClick={add} className={s.add}>
        + Añadir parada
      </button>
      {stops.length === 0 && <p className={s.empty}>Sin paradas intermedias</p>}
    </div>
  );
}
