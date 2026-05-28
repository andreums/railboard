import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from "react";
import { api, connectWS, } from "../lib/api";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, } from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, } from "@dnd-kit/sortable";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
const STATUSES = [
    "Scheduled", "Boarding", "Delayed", "Departed", "Arrived", "Cancelled",
];
const EMPTY = {
    number: "", origin: "Madrid Puerta de Atocha", destination: "",
    stops: [], scheduled_time: "12:00", expected_time: "12:00",
    platform: "1", sector: "A", status: "Scheduled",
    operator_id: null, train_type_id: null,
};
export default function Trains() {
    const [config, setConfig] = useState(null);
    const [trains, setTrains] = useState([]);
    const [operators, setOperators] = useState([]);
    const [trainTypes, setTrainTypes] = useState([]);
    const [places, setPlaces] = useState([]);
    const [editing, setEditing] = useState(null);
    const [reorderMode, setReorderMode] = useState(false);
    const refresh = async () => {
        const [c, t, op, tt, pl] = await Promise.all([
            api.getConfig(), api.listTrains(), api.listOperators(),
            api.listTrainTypes(), api.listPlaces(),
        ]);
        setConfig(c);
        setTrains(t);
        setOperators(op);
        setTrainTypes(tt);
        setPlaces(pl);
    };
    useEffect(() => { refresh(); return connectWS(refresh); }, []);
    const sensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
    const trainIds = trains.map(t => String(t.id));
    const handleDragEnd = (event) => {
        const { active, over } = event;
        if (!over || active.id === over.id)
            return;
        const oldIndex = trainIds.indexOf(String(active.id));
        const newIndex = trainIds.indexOf(String(over.id));
        const newTrains = arrayMove(trains, oldIndex, newIndex);
        setTrains(newTrains);
        api.reorderTrains(newTrains.map(t => t.id));
    };
    const speak = (text) => {
        const u = new SpeechSynthesisUtterance(text);
        u.lang = "es-ES";
        u.rate = 0.95;
        window.speechSynthesis.speak(u);
    };
    const announce = (t) => {
        const place = config?.mode === "arrivals" ? t.origin : t.destination;
        const action = config?.mode === "arrivals" ? "procedente de" : "con destino a";
        speak(`Atención. Tren ${t.type_name || ""} ${t.number}, ${action} ${place}, ` +
            `efectuará su ${config?.mode === "arrivals" ? "llegada" : "salida"} por la vía ${t.platform}, sector ${t.sector}.`);
    };
    if (!config)
        return _jsx("div", { className: "p-10 text-board-dim", children: "Cargando\u2026" });
    return (_jsxs("div", { className: "min-h-screen bg-board-bg text-board-ink p-8 font-body", children: [_jsxs("header", { className: "flex justify-between items-center mb-8", children: [_jsx("h1", { className: "font-display text-4xl tracking-wide", children: "RailBoard \u00B7 Trenes" }), _jsxs("div", { className: "flex gap-4 items-center", children: [_jsx("span", { className: "text-board-dim text-sm", children: "Editar:" }), _jsx("a", { href: "/train-settings", className: "text-board-amber underline text-sm", children: "Operadores" }), _jsx("a", { href: "/train-settings", className: "text-board-amber underline text-sm", children: "Tipos de tren" }), _jsx("span", { className: "text-board-dim", children: "|" }), _jsx("a", { href: "/admin", className: "text-board-amber underline", children: "Configuraci\u00F3n" }), _jsx("a", { href: "/", target: "_blank", className: "text-board-amber underline", children: "Pantalla p\u00FAblica \u2192" })] })] }), _jsxs("section", { className: "bg-board-row rounded-lg p-5", children: [_jsxs("div", { className: "flex justify-between items-center mb-4", children: [_jsxs("h2", { className: "font-display text-2xl", children: ["Trenes (", trains.length, ")"] }), _jsxs("div", { className: "flex gap-2", children: [_jsx("button", { onClick: () => setReorderMode(!reorderMode), className: `px-3 py-1 rounded font-bold ${reorderMode ? "bg-board-green text-white" : "bg-white/10 text-board-dim"}`, children: reorderMode ? "✕ Hecho" : "↕ Reordenar" }), _jsx("button", { onClick: () => setEditing(EMPTY), className: "bg-board-amber text-board-bg px-3 py-1 rounded font-bold", children: "+ Nuevo" })] })] }), reorderMode ? (_jsx(DndContext, { sensors: sensors, collisionDetection: closestCenter, onDragEnd: handleDragEnd, children: _jsx(SortableContext, { items: trainIds, strategy: verticalListSortingStrategy, children: _jsx("div", { className: "space-y-2 mb-4", children: trains.length === 0 ? (_jsx("div", { className: "text-board-dim text-sm py-4", children: "Arrastra para reordenar" })) : (trains.map((train) => (_jsx(TrainRow, { train: train, announce: announce, refresh: refresh, STATUSES: STATUSES, onEdit: setEditing, dragHandle: true }, train.id)))) }) }) })) : (_jsx("div", { className: "space-y-2 mb-4", children: trains.length === 0 ? (_jsx("div", { className: "text-board-dim text-sm py-4", children: "Sin trenes" })) : (trains.map((train) => (_jsxs("div", { className: "bg-black/20 rounded p-3 flex gap-3 items-center flex-wrap", children: [_jsx("span", { className: "w-24 text-center", children: train.scheduled_time }), _jsx("span", { className: "w-16 text-center", children: train.number }), _jsx("span", { className: "flex-1 min-w-48", children: train.destination }), _jsx("span", { className: "w-12 text-center", children: train.platform }), _jsx("span", { className: "text-board-dim text-sm", children: train.status }), _jsx("button", { onClick: (e) => { e.preventDefault(); announce(train); }, className: "text-board-green", children: "\uD83D\uDD0A" }), _jsx("button", { onClick: (e) => { e.preventDefault(); setEditing(train); }, className: "text-board-amber", children: "Editar" }), _jsx("button", { onClick: (e) => { e.preventDefault(); if (confirm("¿Eliminar tren?"))
                                        api.deleteTrain(train.id).then(refresh); }, className: "text-board-red", children: "\u2715" })] }, train.id)))) }))] }), editing && (_jsx("div", { className: "fixed inset-0 z-50 flex items-center justify-center bg-black/60", onClick: () => setEditing(null), children: _jsxs("div", { className: "bg-board-row rounded-lg p-6 w-full max-w-xl mx-4 border border-white/10", onClick: (e) => e.stopPropagation(), children: [_jsxs("div", { className: "flex justify-between items-center mb-4", children: [_jsx("h3", { className: "font-display text-2xl", children: editing?.id ? "Editar tren" : "Nuevo tren" }), _jsx("button", { onClick: () => setEditing(null), className: "text-board-dim hover:text-white text-2xl leading-none", children: "\u2715" })] }), _jsx(TrainForm, { value: editing, operators: operators, trainTypes: trainTypes, places: places, onCancel: () => setEditing(null), onSave: async (v) => {
                                if (v.id)
                                    await api.updateTrain(v.id, v);
                                else
                                    await api.createTrain(v);
                                setEditing(null);
                                refresh();
                            } })] }) }))] }));
}
function TrainRow({ train, announce, refresh, STATUSES, onEdit }) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: String(train.id) });
    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
    };
    return (_jsxs("div", { ref: setNodeRef, style: style, className: `bg-black/20 rounded p-3 flex gap-3 items-center flex-wrap ${isDragging ? "opacity-50" : ""}`, children: [_jsx("span", { ...attributes, ...listeners, className: "cursor-grab text-board-dim text-lg select-none", children: "\u283F" }), _jsx("input", { type: "time", className: "bg-black/40 rounded px-2 py-1 w-24", value: train.scheduled_time, onChange: (e) => api.updateTrain(train.id, { scheduled_time: e.target.value }).then(refresh) }), _jsx("input", { type: "text", className: "bg-black/40 rounded px-2 py-1 w-16", value: train.number, onChange: (e) => api.updateTrain(train.id, { number: e.target.value }).then(refresh) }), _jsx("input", { type: "text", className: "bg-black/40 rounded px-2 py-1 flex-1 min-w-48", value: train.destination, onChange: (e) => api.updateTrain(train.id, { destination: e.target.value }).then(refresh), placeholder: "Destino" }), _jsx("input", { type: "text", className: "bg-black/40 rounded px-2 py-1 w-12", value: train.platform, onChange: (e) => api.updateTrain(train.id, { platform: e.target.value }).then(refresh) }), _jsx("select", { className: "bg-black/40 rounded px-2 py-1", value: train.status, onChange: (e) => api.setStatus(train.id, e.target.value).then(refresh), children: STATUSES.map((s) => _jsx("option", { value: s, children: s }, s)) }), _jsx("button", { onClick: () => announce(train), className: "text-board-green", children: "\uD83D\uDD0A" }), _jsx("button", { onClick: () => onEdit(train), className: "text-board-amber mr-2", children: "Editar" }), _jsx("button", { onClick: () => { if (confirm("¿Eliminar tren?"))
                    api.deleteTrain(train.id).then(refresh); }, className: "text-board-red", children: "\u2715" })] }));
}
function TrainForm({ value, operators, trainTypes, places, onSave, onCancel, }) {
    const [v, setV] = useState(value);
    useEffect(() => setV(value), [value]);
    const set = (k, val) => setV((s) => ({ ...s, [k]: val }));
    const placeNames = places.map((p) => p.name);
    const dataListId = "places-list";
    return (_jsxs("div", { className: "grid grid-cols-2 gap-3", children: [_jsx("datalist", { id: dataListId, children: placeNames.map((n) => _jsx("option", { value: n }, n)) }), _jsx(Field, { label: "N\u00FAmero", children: _jsx("input", { className: "bg-black/40 rounded px-3 py-2 w-full", value: v.number || "", onChange: (e) => set("number", e.target.value) }) }), _jsx(Field, { label: "Operador", children: _jsxs("select", { className: "bg-black/40 rounded px-3 py-2 w-full", value: v.operator_id ?? "", onChange: (e) => set("operator_id", e.target.value ? Number(e.target.value) : null), children: [_jsx("option", { value: "", children: "\u2014" }), operators.map((o) => _jsx("option", { value: o.id, children: o.name }, o.id))] }) }), _jsx(Field, { label: "Tipo", children: _jsxs("select", { className: "bg-black/40 rounded px-3 py-2 w-full", value: v.train_type_id ?? "", onChange: (e) => set("train_type_id", e.target.value ? Number(e.target.value) : null), children: [_jsx("option", { value: "", children: "\u2014" }), trainTypes.map((t) => _jsxs("option", { value: t.id, children: [t.code, " \u2014 ", t.name] }, t.id))] }) }), _jsx(Field, { label: "Estado", children: _jsx("select", { className: "bg-black/40 rounded px-3 py-2 w-full", value: v.status, onChange: (e) => set("status", e.target.value), children: STATUSES.map((s) => _jsx("option", { value: s, children: s }, s)) }) }), _jsx(Field, { label: "Origen", children: _jsx("input", { className: "bg-black/40 rounded px-3 py-2 w-full", value: v.origin || "", onChange: (e) => set("origin", e.target.value) }) }), _jsx(Field, { label: "Destino", children: _jsx("input", { className: "bg-black/40 rounded px-3 py-2 w-full", value: v.destination || "", onChange: (e) => set("destination", e.target.value) }) }), _jsx(Field, { label: "Hora programada", children: _jsx("input", { className: "bg-black/40 rounded px-3 py-2 w-full", type: "time", value: v.scheduled_time || "", onChange: (e) => set("scheduled_time", e.target.value) }) }), _jsx(Field, { label: "Hora estimada", children: _jsx("input", { className: "bg-black/40 rounded px-3 py-2 w-full", type: "time", value: v.expected_time || "", onChange: (e) => set("expected_time", e.target.value) }) }), _jsx(Field, { label: "V\u00EDa", children: _jsx("input", { className: "bg-black/40 rounded px-3 py-2 w-full", value: v.platform || "", onChange: (e) => set("platform", e.target.value) }) }), _jsx(Field, { label: "Sector", children: _jsx("input", { className: "bg-black/40 rounded px-3 py-2 w-full", value: v.sector || "", onChange: (e) => set("sector", e.target.value) }) }), _jsx(Field, { label: "Paradas intermedias (separadas por coma)", wide: true, children: _jsx("input", { className: "bg-black/40 rounded px-3 py-2 w-full", value: (v.stops || []).join(", "), onChange: (e) => set("stops", e.target.value.split(",").map((s) => s.trim()).filter(Boolean)) }) }), _jsxs("div", { className: "col-span-2 flex gap-2 justify-end mt-2", children: [_jsx("button", { onClick: onCancel, className: "px-4 py-2 rounded bg-white/10", children: "Cancelar" }), _jsx("button", { onClick: () => onSave(v), className: "px-4 py-2 rounded bg-board-amber text-board-bg font-bold", children: "Guardar" })] })] }));
}
function Field({ label, children, wide }) {
    return (_jsxs("label", { className: `block ${wide ? "col-span-2" : ""}`, children: [_jsx("div", { className: "text-xs text-board-dim uppercase mb-1", children: label }), children] }));
}
