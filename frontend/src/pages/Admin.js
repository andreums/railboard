import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from "react";
import { api, connectWS, fileUrl, } from "../lib/api";
import { LANGUAGES } from "../lib/i18n";
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
export default function Admin() {
    const [config, setConfig] = useState(null);
    const [trains, setTrains] = useState([]);
    const [operators, setOperators] = useState([]);
    const [trainTypes, setTrainTypes] = useState([]);
    const [places, setPlaces] = useState([]);
    const [editing, setEditing] = useState(null);
    const [editingOperator, setEditingOperator] = useState(null);
    const [editingType, setEditingType] = useState(null);
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
        newTrains.forEach((t, i) => {
            // Could update order in DB if DB supports it
            // For now, just reorder in UI
        });
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
    return (_jsxs("div", { className: "min-h-screen bg-board-bg text-board-ink p-8 font-body", children: [_jsxs("header", { className: "flex justify-between items-center mb-8", children: [_jsx("h1", { className: "font-display text-4xl tracking-wide", children: "RailBoard \u00B7 Admin" }), _jsx("a", { href: "/", target: "_blank", className: "text-board-amber underline", children: "Abrir pantalla p\u00FAblica \u2192" })] }), _jsxs("div", { className: "grid lg:grid-cols-3 gap-6", children: [_jsxs("section", { className: "bg-board-row rounded-lg p-5", children: [_jsx("h2", { className: "font-display text-2xl mb-4", children: "Estaci\u00F3n" }), _jsx("label", { className: "block text-xs text-board-dim uppercase mb-1", children: "Logo (URL o subir)" }), _jsxs("div", { className: "flex gap-2 mb-3", children: [_jsx("input", { className: "flex-1 bg-black/40 rounded px-3 py-2", placeholder: "https://...", value: config.logo_url || "", onChange: (e) => setConfig({ ...config, logo_url: e.target.value }) }), _jsx("input", { type: "file", accept: "image/*", onChange: (e) => {
                                            const file = e.target.files?.[0];
                                            if (file) {
                                                const reader = new FileReader();
                                                reader.onload = (ev) => {
                                                    setConfig({ ...config, logo_url: ev.target?.result });
                                                };
                                                reader.readAsDataURL(file);
                                            }
                                        } })] }), config.logo_url && _jsx("img", { src: config.logo_url, className: "h-8 mb-3", alt: "Logo" }), _jsx("label", { className: "block text-xs text-board-dim uppercase mb-1", children: "Nombre" }), _jsx("input", { className: "w-full bg-black/40 rounded px-3 py-2 mb-3", value: config.station_name, onChange: (e) => setConfig({ ...config, station_name: e.target.value }) }), _jsx("label", { className: "block text-xs text-board-dim uppercase mb-1", children: "Modo" }), _jsxs("select", { className: "w-full bg-black/40 rounded px-3 py-2 mb-3", value: config.mode, onChange: (e) => setConfig({ ...config, mode: e.target.value }), children: [_jsx("option", { value: "departures", children: "Salidas" }), _jsx("option", { value: "arrivals", children: "Llegadas" })] }), _jsx("label", { className: "block text-xs text-board-dim uppercase mb-1", children: "Idioma" }), _jsx("select", { className: "w-full bg-black/40 rounded px-3 py-2 mb-4", value: config.language ?? "es", onChange: (e) => setConfig({ ...config, language: e.target.value }), children: Object.entries(LANGUAGES).map(([code, name]) => (_jsx("option", { value: code, children: name }, code))) }), _jsx("button", { onClick: () => api.setConfig(config), className: "bg-board-amber text-board-bg font-bold px-4 py-2 rounded w-full", children: "Guardar" })] }), _jsxs("section", { className: "bg-board-row rounded-lg p-5", children: [_jsx("h2", { className: "font-display text-2xl mb-4", children: "Estilos" }), _jsx("label", { className: "block text-xs text-board-dim uppercase mb-1", children: "Fondo" }), _jsx("input", { type: "color", className: "w-full bg-black/40 rounded px-3 py-2 mb-3", value: config.bgColor || "#050a14", onChange: (e) => setConfig({ ...config, bgColor: e.target.value }) }), _jsx("label", { className: "block text-xs text-board-dim uppercase mb-1", children: "Header fondo" }), _jsx("input", { type: "color", className: "w-full bg-black/40 rounded px-3 py-2 mb-3", value: config.headerBgColor || "#BFEFD5", onChange: (e) => setConfig({ ...config, headerBgColor: e.target.value }) }), _jsx("label", { className: "block text-xs text-board-dim uppercase mb-1", children: "Header texto" }), _jsx("input", { type: "color", className: "w-full bg-black/40 rounded px-3 py-2 mb-3", value: config.headerTextColor || "#f5f3ec", onChange: (e) => setConfig({ ...config, headerTextColor: e.target.value }) }), _jsx("label", { className: "block text-xs text-board-dim uppercase mb-1", children: "Fila par" }), _jsx("input", { type: "color", className: "w-full bg-black/40 rounded px-3 py-2 mb-3", value: config.rowBgColor || "#1A3254", onChange: (e) => setConfig({ ...config, rowBgColor: e.target.value }) }), _jsx("label", { className: "block text-xs text-board-dim uppercase mb-1", children: "Fila impar" }), _jsx("input", { type: "color", className: "w-full bg-black/40 rounded px-3 py-2 mb-3", value: config.altBgColor || "#102341", onChange: (e) => setConfig({ ...config, altBgColor: e.target.value }) }), _jsx("label", { className: "block text-xs text-board-dim uppercase mb-1", children: "Tama\u00F1o destino (px)" }), _jsx("input", { type: "number", className: "w-full bg-black/40 rounded px-3 py-2 mb-3", min: "20", max: "100", value: parseInt(config.destinationFontSize || "48"), onChange: (e) => setConfig({ ...config, destinationFontSize: e.target.value }) }), _jsx("button", { onClick: () => api.setConfig(config), className: "bg-board-amber text-board-bg font-bold px-4 py-2 rounded w-full", children: "Guardar estilos" })] }), _jsx(Catalog, { title: "Operadores", items: operators.map((o) => ({ id: o.id, label: o.name, extra: o.logo_url ? _jsx("img", { src: fileUrl(o.logo_url), className: "h-6" }) : null })), onRemove: (id) => api.deleteOperator(id).then(refresh), onEdit: (id) => setEditingOperator(operators.find(o => o.id === id) || null), renderCreate: () => _jsx(OperatorCreate, { onCreated: refresh }) }), _jsx(Catalog, { title: "Tipos de tren", items: trainTypes.map((t) => ({
                            id: t.id,
                            label: `${t.code} — ${t.name}`,
                            extra: _jsx("span", { className: "inline-block w-4 h-4 rounded", style: { background: t.color } }),
                        })), onRemove: (id) => api.deleteTrainType(id).then(refresh), onEdit: (id) => setEditingType(trainTypes.find(t => t.id === id) || null), renderCreate: () => _jsx(TrainTypeCreate, { onCreated: refresh }) }), _jsx(Catalog, { title: "Lugares / destinos", items: places.map((p) => ({ id: p.id, label: p.name })), onRemove: (id) => api.deletePlace(id).then(refresh), renderCreate: () => _jsx(PlaceCreate, { onCreated: refresh }) }), _jsxs("section", { className: "bg-board-row rounded-lg p-5 lg:col-span-2", children: [_jsxs("div", { className: "flex justify-between items-center mb-4", children: [_jsx("h2", { className: "font-display text-2xl", children: editing?.id ? "Editar tren" : "Nuevo tren" }), _jsx("button", { onClick: () => setEditing(EMPTY), className: "bg-board-amber text-board-bg px-3 py-1 rounded font-bold", children: "+ Nuevo" })] }), editing && (_jsx(TrainForm, { value: editing, operators: operators, trainTypes: trainTypes, places: places, onCancel: () => setEditing(null), onSave: async (v) => {
                                    if (v.id)
                                        await api.updateTrain(v.id, v);
                                    else
                                        await api.createTrain(v);
                                    setEditing(null);
                                    refresh();
                                } }))] }), editingOperator && (_jsxs("section", { className: "bg-board-row rounded-lg p-5", children: [_jsx("h2", { className: "font-display text-2xl mb-4", children: "Editar operador" }), _jsxs("div", { className: "flex flex-col gap-2", children: [_jsx("input", { className: "bg-black/40 rounded px-3 py-2", placeholder: "Nombre", value: editingOperator.name, onChange: (e) => setEditingOperator({ ...editingOperator, name: e.target.value }) }), _jsxs("div", { className: "flex gap-2", children: [_jsx("button", { onClick: () => { api.updateOperator(editingOperator.id, editingOperator.name).then(() => { setEditingOperator(null); refresh(); }); }, className: "flex-1 bg-board-amber text-board-bg font-bold px-4 py-2 rounded", children: "Guardar" }), _jsx("button", { onClick: () => { api.deleteOperator(editingOperator.id).then(() => { setEditingOperator(null); refresh(); }); }, className: "flex-1 bg-board-red text-white font-bold px-4 py-2 rounded", children: "Eliminar" }), _jsx("button", { onClick: () => { setEditingOperator(null); }, className: "flex-1 px-4 py-2 rounded bg-white/10", children: "Cancelar" })] })] })] })), editingType && (_jsxs("section", { className: "bg-board-row rounded-lg p-5", children: [_jsx("h2", { className: "font-display text-2xl mb-4", children: "Editar tipo de tren" }), _jsxs("div", { className: "flex flex-col gap-2", children: [_jsx("input", { className: "bg-black/40 rounded px-3 py-2", placeholder: "C\u00F3digo (AVE)", value: editingType.code, onChange: (e) => setEditingType({ ...editingType, code: e.target.value }) }), _jsx("input", { className: "bg-black/40 rounded px-3 py-2", placeholder: "Nombre", value: editingType.name, onChange: (e) => setEditingType({ ...editingType, name: e.target.value }) }), _jsx("input", { type: "color", value: editingType.color, onChange: (e) => setEditingType({ ...editingType, color: e.target.value }), className: "bg-black/40 rounded px-3 py-2" }), _jsxs("div", { className: "flex gap-2", children: [_jsx("button", { onClick: () => { api.updateTrainType(editingType.id, editingType.code, editingType.name, editingType.color).then(() => { setEditingType(null); refresh(); }); }, className: "flex-1 bg-board-amber text-board-bg font-bold px-4 py-2 rounded", children: "Guardar" }), _jsx("button", { onClick: () => { api.deleteTrainType(editingType.id).then(() => { setEditingType(null); refresh(); }); }, className: "flex-1 bg-board-red text-white font-bold px-4 py-2 rounded", children: "Eliminar" }), _jsx("button", { onClick: () => { setEditingType(null); }, className: "flex-1 px-4 py-2 rounded bg-white/10", children: "Cancelar" })] })] })] }))] }), _jsxs("section", { className: "mt-8 bg-board-row rounded-lg p-5", children: [_jsxs("h2", { className: "font-display text-2xl mb-4", children: ["Trenes (", trains.length, ") \u2014 arrastra para reordenar"] }), _jsx(DndContext, { sensors: sensors, collisionDetection: closestCenter, onDragEnd: handleDragEnd, children: _jsx(SortableContext, { items: trainIds, strategy: verticalListSortingStrategy, children: _jsx("div", { className: "space-y-2", children: trains.map((train) => (_jsx(TrainRow, { train: train, announce: announce, refresh: refresh, STATUSES: STATUSES, onEdit: setEditing }, train.id))) }) }) })] })] }));
}
// ------- sub-components --------
function TrainRow({ train, announce, refresh, STATUSES, onEdit }) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: String(train.id) });
    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
    };
    return (_jsxs("div", { ref: setNodeRef, style: style, className: `bg-black/20 rounded p-3 flex gap-3 items-center flex-wrap cursor-grab ${isDragging ? "cursor-grabbing" : ""}`, ...attributes, ...listeners, children: [_jsx("input", { type: "time", className: "bg-black/40 rounded px-2 py-1 w-24", value: train.scheduled_time, onChange: (e) => api.updateTrain(train.id, { scheduled_time: e.target.value }).then(refresh), onClick: (e) => e.stopPropagation() }), _jsx("input", { type: "text", className: "bg-black/40 rounded px-2 py-1 w-16", value: train.number, onChange: (e) => api.updateTrain(train.id, { number: e.target.value }).then(refresh), onClick: (e) => e.stopPropagation() }), _jsx("input", { type: "text", className: "bg-black/40 rounded px-2 py-1 flex-1 min-w-48", value: train.destination, onChange: (e) => api.updateTrain(train.id, { destination: e.target.value }).then(refresh), onClick: (e) => e.stopPropagation(), placeholder: "Destino" }), _jsx("input", { type: "text", className: "bg-black/40 rounded px-2 py-1 w-12", value: train.platform, onChange: (e) => api.updateTrain(train.id, { platform: e.target.value }).then(refresh), onClick: (e) => e.stopPropagation() }), _jsx("select", { className: "bg-black/40 rounded px-2 py-1", value: train.status, onChange: (e) => api.setStatus(train.id, e.target.value).then(refresh), onClick: (e) => e.stopPropagation(), children: STATUSES.map((s) => _jsx("option", { value: s, children: s }, s)) }), _jsx("button", { onClick: () => announce(train), className: "text-board-green", children: "\uD83D\uDD0A" }), _jsx("button", { onClick: () => onEdit(train), className: "text-board-amber mr-2", children: "Editar" }), _jsx("button", { onClick: () => { if (confirm("¿Eliminar tren?"))
                    api.deleteTrain(train.id).then(refresh); }, className: "text-board-red", children: "\u2715" })] }));
}
function Catalog({ title, items, onRemove, onEdit, renderCreate, }) {
    return (_jsxs("section", { className: "bg-board-row rounded-lg p-5", children: [_jsx("h2", { className: "font-display text-2xl mb-4", children: title }), _jsxs("ul", { className: "space-y-1 max-h-48 overflow-y-auto mb-3", children: [items.map((it) => (_jsxs("li", { className: "flex items-center justify-between py-1 border-b border-white/5", children: [_jsxs("span", { className: "flex items-center gap-2", children: [it.extra, it.label] }), _jsxs("div", { className: "flex gap-1", children: [onEdit && _jsx("button", { onClick: () => onEdit(it.id), className: "text-board-amber text-sm", children: "Editar" }), _jsx("button", { onClick: () => onRemove(it.id), className: "text-board-red text-sm", children: "\u2715" })] })] }, it.id))), items.length === 0 && _jsx("li", { className: "text-board-dim text-sm", children: "Vac\u00EDo" })] }), renderCreate()] }));
}
function OperatorCreate({ onCreated }) {
    const [name, setName] = useState("");
    const [logo, setLogo] = useState(null);
    return (_jsxs("div", { className: "flex flex-col gap-2", children: [_jsx("input", { className: "bg-black/40 rounded px-2 py-1", placeholder: "Nombre", value: name, onChange: (e) => setName(e.target.value) }), _jsx("input", { type: "file", accept: "image/*", onChange: (e) => setLogo(e.target.files?.[0] ?? null) }), _jsx("button", { className: "bg-board-amber text-board-bg font-bold rounded py-1", onClick: async () => { if (name) {
                    await api.createOperator(name, logo);
                    setName("");
                    setLogo(null);
                    onCreated();
                } }, children: "A\u00F1adir operador" })] }));
}
function TrainTypeCreate({ onCreated }) {
    const [code, setCode] = useState("");
    const [name, setName] = useState("");
    const [color, setColor] = useState("#7c1d2e");
    const [logo, setLogo] = useState(null);
    return (_jsxs("div", { className: "flex flex-col gap-2", children: [_jsx("input", { className: "bg-black/40 rounded px-2 py-1", placeholder: "C\u00F3digo (AVE)", value: code, onChange: (e) => setCode(e.target.value) }), _jsx("input", { className: "bg-black/40 rounded px-2 py-1", placeholder: "Nombre", value: name, onChange: (e) => setName(e.target.value) }), _jsx("input", { type: "color", value: color, onChange: (e) => setColor(e.target.value) }), _jsx("input", { type: "file", accept: "image/*", onChange: (e) => setLogo(e.target.files?.[0] ?? null) }), _jsx("button", { className: "bg-board-amber text-board-bg font-bold rounded py-1", onClick: async () => { if (code && name) {
                    await api.createTrainType(code, name, color, logo);
                    setCode("");
                    setName("");
                    setLogo(null);
                    onCreated();
                } }, children: "A\u00F1adir tipo" })] }));
}
function PlaceCreate({ onCreated }) {
    const [name, setName] = useState("");
    return (_jsxs("div", { className: "flex gap-2", children: [_jsx("input", { className: "bg-black/40 rounded px-2 py-1 flex-1", placeholder: "Lugar", value: name, onChange: (e) => setName(e.target.value) }), _jsx("button", { className: "bg-board-amber text-board-bg font-bold rounded px-3", onClick: async () => { if (name) {
                    await api.createPlace(name);
                    setName("");
                    onCreated();
                } }, children: "+" })] }));
}
function TrainForm({ value, operators, trainTypes, places, onSave, onCancel, }) {
    const [v, setV] = useState(value);
    useEffect(() => setV(value), [value]);
    const set = (k, val) => setV((s) => ({ ...s, [k]: val }));
    const placeNames = places.map((p) => p.name);
    const dataListId = "places-list";
    return (_jsxs("div", { className: "grid grid-cols-2 gap-3", children: [_jsx("datalist", { id: dataListId, children: placeNames.map((n) => _jsx("option", { value: n }, n)) }), _jsx(Field, { label: "N\u00FAmero", children: _jsx("input", { className: "inp", value: v.number || "", onChange: (e) => set("number", e.target.value) }) }), _jsx(Field, { label: "Operador", children: _jsxs("select", { className: "inp", value: v.operator_id ?? "", onChange: (e) => set("operator_id", e.target.value ? Number(e.target.value) : null), children: [_jsx("option", { value: "", children: "\u2014" }), operators.map((o) => _jsx("option", { value: o.id, children: o.name }, o.id))] }) }), _jsx(Field, { label: "Tipo", children: _jsxs("select", { className: "inp", value: v.train_type_id ?? "", onChange: (e) => set("train_type_id", e.target.value ? Number(e.target.value) : null), children: [_jsx("option", { value: "", children: "\u2014" }), trainTypes.map((t) => _jsxs("option", { value: t.id, children: [t.code, " \u2014 ", t.name] }, t.id))] }) }), _jsx(Field, { label: "Estado", children: _jsx("select", { className: "inp", value: v.status, onChange: (e) => set("status", e.target.value), children: STATUSES.map((s) => _jsx("option", { value: s, children: s }, s)) }) }), _jsx(Field, { label: "Origen", children: _jsx("input", { className: "inp", list: dataListId, value: v.origin || "", onChange: (e) => set("origin", e.target.value) }) }), _jsx(Field, { label: "Destino", children: _jsx("input", { className: "inp", list: dataListId, value: v.destination || "", onChange: (e) => set("destination", e.target.value) }) }), _jsx(Field, { label: "Hora programada", children: _jsx("input", { className: "inp", type: "time", value: v.scheduled_time || "", onChange: (e) => set("scheduled_time", e.target.value) }) }), _jsx(Field, { label: "Hora estimada", children: _jsx("input", { className: "inp", type: "time", value: v.expected_time || "", onChange: (e) => set("expected_time", e.target.value) }) }), _jsx(Field, { label: "V\u00EDa", children: _jsx("input", { className: "inp", value: v.platform || "", onChange: (e) => set("platform", e.target.value) }) }), _jsx(Field, { label: "Sector", children: _jsx("input", { className: "inp", value: v.sector || "", onChange: (e) => set("sector", e.target.value) }) }), _jsx(Field, { label: "Paradas intermedias (separadas por coma)", wide: true, children: _jsx("input", { className: "inp", value: (v.stops || []).join(", "), onChange: (e) => set("stops", e.target.value.split(",").map((s) => s.trim()).filter(Boolean)) }) }), _jsxs("div", { className: "col-span-2 flex gap-2 justify-end mt-2", children: [_jsx("button", { onClick: onCancel, className: "px-4 py-2 rounded bg-white/10", children: "Cancelar" }), _jsx("button", { onClick: () => onSave(v), className: "px-4 py-2 rounded bg-board-amber text-board-bg font-bold", children: "Guardar" })] }), _jsx("style", { children: `.inp{background:rgba(0,0,0,.4);border-radius:.375rem;padding:.5rem .75rem;width:100%;color:inherit}` })] }));
}
function Field({ label, children, wide }) {
    return (_jsxs("label", { className: `block ${wide ? "col-span-2" : ""}`, children: [_jsx("div", { className: "text-xs text-board-dim uppercase mb-1", children: label }), children] }));
}
