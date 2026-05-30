import React from "react";
import type { Place } from "../../lib/api";

type Props = {
    places: Place[];
    newPlace: string;
    setNewPlace: (s: string) => void;
    onAddPlace: () => void;
    onDeletePlace: (id: number) => void;
};

export default function PlacesPanel({ places, newPlace, setNewPlace, onAddPlace, onDeletePlace }: Props) {
    return (
        <section id="places" className="bg-board-row rounded-lg p-6 lg:col-span-2">
            <h2 className="font-display text-2xl mb-5 pb-3 border-b border-white/10">Lugares / destinos</h2>
            <div className="flex flex-wrap gap-2 mb-4">
                {places.map((p) => (
                    <span key={p.id} className="inline-flex items-center gap-2 bg-black/30 rounded-full px-3 py-1.5 text-sm">
                        {p.name}
                        <button type="button" onClick={() => onDeletePlace(p.id)} className="text-board-red hover:text-white leading-none">✕</button>
                    </span>
                ))}
                {places.length === 0 && <span className="text-board-dim text-sm">Vacío</span>}
            </div>
            <div className="flex gap-2">
                <input aria-label="Nuevo lugar" className="flex-1 bg-black/40 rounded px-3 py-2" placeholder="Nuevo lugar" value={newPlace} onChange={(e) => setNewPlace(e.target.value)} onKeyPress={(e) => e.key === "Enter" && onAddPlace()} />
                <button type="button" onClick={onAddPlace} className="bg-board-amber text-board-bg font-bold px-4 py-2 rounded" aria-label="Agregar lugar">+</button>
            </div>
        </section>
    );
}
