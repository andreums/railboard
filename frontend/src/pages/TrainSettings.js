import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from "react";
import { api, connectWS, fileUrl, } from "../lib/api";
export default function TrainSettings() {
    const [operators, setOperators] = useState([]);
    const [trainTypes, setTrainTypes] = useState([]);
    const [editingOperator, setEditingOperator] = useState(null);
    const [editingType, setEditingType] = useState(null);
    const [operatorLogo, setOperatorLogo] = useState(null);
    const [typeLogo, setTypeLogo] = useState(null);
    const refresh = async () => {
        const [op, tt] = await Promise.all([
            api.listOperators(), api.listTrainTypes(),
        ]);
        setOperators(op);
        setTrainTypes(tt);
    };
    useEffect(() => { refresh(); return connectWS(refresh); }, []);
    return (_jsxs("div", { className: "min-h-screen bg-board-bg text-board-ink p-8 font-body", children: [_jsxs("header", { className: "flex justify-between items-center mb-8", children: [_jsx("h1", { className: "font-display text-4xl tracking-wide", children: "RailBoard \u00B7 Tipos y operadores" }), _jsxs("div", { className: "flex gap-4 items-center", children: [_jsx("a", { href: "/trains", className: "text-board-amber underline", children: "Trenes" }), _jsx("a", { href: "/admin", className: "text-board-amber underline", children: "Configuraci\u00F3n" }), _jsx("a", { href: "/", target: "_blank", className: "text-board-amber underline", children: "Pantalla p\u00FAblica \u2192" })] })] }), _jsxs("div", { className: "grid grid-cols-1 lg:grid-cols-2 gap-6", children: [_jsxs("section", { className: "bg-board-row rounded-lg p-5", children: [_jsx("h2", { className: "font-display text-2xl mb-4", children: "Operadores" }), _jsx(Catalog, { items: operators.map((o) => ({ id: o.id, label: o.name, extra: o.logo_url ? _jsx("img", { src: fileUrl(o.logo_url), className: "h-6" }) : null })), onRemove: (id) => api.deleteOperator(id).then(refresh), onEdit: (id) => setEditingOperator(operators.find(o => o.id === id) || null), renderCreate: () => _jsx(OperatorCreate, { onCreated: refresh }) }), editingOperator && (_jsx("div", { className: "fixed inset-0 z-50 flex items-center justify-center bg-black/60", onClick: () => setEditingOperator(null), children: _jsxs("div", { className: "bg-board-row rounded-lg p-6 w-full max-w-md mx-4 border border-board-amber", onClick: (e) => e.stopPropagation(), children: [_jsx("h3", { className: "font-display text-xl mb-4", children: "Editar operador" }), _jsxs("div", { className: "flex flex-col gap-3", children: [_jsx("input", { className: "bg-black/40 rounded px-3 py-2", placeholder: "Nombre", value: editingOperator.name, onChange: (e) => setEditingOperator({ ...editingOperator, name: e.target.value }) }), _jsxs("div", { children: [_jsx("label", { className: "block text-xs text-board-dim uppercase tracking-wider mb-1.5", children: "Logo" }), editingOperator.logo_url && _jsx("img", { src: fileUrl(editingOperator.logo_url), className: "h-8 mb-2", alt: "Logo" }), _jsx("input", { type: "file", accept: "image/*", onChange: (e) => setOperatorLogo(e.target.files?.[0] ?? null) })] }), _jsxs("div", { className: "flex gap-2", children: [_jsx("button", { onClick: () => { api.updateOperator(editingOperator.id, editingOperator.name, operatorLogo).then(() => { setEditingOperator(null); setOperatorLogo(null); refresh(); }); }, className: "flex-1 bg-board-amber text-board-bg font-bold px-4 py-2 rounded", children: "Guardar" }), _jsx("button", { onClick: () => { api.deleteOperator(editingOperator.id).then(() => { setEditingOperator(null); setOperatorLogo(null); refresh(); }); }, className: "flex-1 bg-board-red text-white font-bold px-4 py-2 rounded", children: "Eliminar" }), _jsx("button", { onClick: () => { setEditingOperator(null); setOperatorLogo(null); }, className: "flex-1 px-4 py-2 rounded bg-white/10", children: "Cancelar" })] })] })] }) }))] }), _jsxs("section", { className: "bg-board-row rounded-lg p-5", children: [_jsx("h2", { className: "font-display text-2xl mb-4", children: "Tipos de tren" }), _jsx(Catalog, { items: trainTypes.map((t) => ({
                                    id: t.id,
                                    label: `${t.code} — ${t.name}`,
                                    extra: t.logo_url ? _jsx("img", { src: fileUrl(t.logo_url), className: "h-6", alt: t.code }) : _jsx("span", { className: "inline-block w-4 h-4 rounded", style: { background: t.color } }),
                                })), onRemove: (id) => api.deleteTrainType(id).then(refresh), onEdit: (id) => setEditingType(trainTypes.find(t => t.id === id) || null), renderCreate: () => _jsx(TrainTypeCreate, { onCreated: refresh }) }), editingType && (_jsx("div", { className: "fixed inset-0 z-50 flex items-center justify-center bg-black/60", onClick: () => setEditingType(null), children: _jsxs("div", { className: "bg-board-row rounded-lg p-6 w-full max-w-md mx-4 border border-board-amber", onClick: (e) => e.stopPropagation(), children: [_jsx("h3", { className: "font-display text-xl mb-4", children: "Editar tipo de tren" }), _jsxs("div", { className: "flex flex-col gap-3", children: [_jsx("input", { className: "bg-black/40 rounded px-3 py-2", placeholder: "C\u00F3digo (AVE)", value: editingType.code, onChange: (e) => setEditingType({ ...editingType, code: e.target.value }) }), _jsx("input", { className: "bg-black/40 rounded px-3 py-2", placeholder: "Nombre", value: editingType.name, onChange: (e) => setEditingType({ ...editingType, name: e.target.value }) }), _jsx("input", { type: "color", value: editingType.color, onChange: (e) => setEditingType({ ...editingType, color: e.target.value }), className: "bg-black/40 rounded px-3 py-2 h-10" }), _jsxs("div", { children: [_jsx("label", { className: "block text-xs text-board-dim uppercase tracking-wider mb-1.5", children: "Logo" }), editingType.logo_url && _jsx("img", { src: fileUrl(editingType.logo_url), className: "h-8 mb-2", alt: "Logo" }), _jsx("input", { type: "file", accept: "image/*", onChange: (e) => setTypeLogo(e.target.files?.[0] ?? null) })] }), _jsxs("div", { className: "flex gap-2", children: [_jsx("button", { onClick: () => { api.updateTrainType(editingType.id, editingType.code, editingType.name, editingType.color, typeLogo).then(() => { setEditingType(null); setTypeLogo(null); refresh(); }); }, className: "flex-1 bg-board-amber text-board-bg font-bold px-4 py-2 rounded", children: "Guardar" }), _jsx("button", { onClick: () => { api.deleteTrainType(editingType.id).then(() => { setEditingType(null); setTypeLogo(null); refresh(); }); }, className: "flex-1 bg-board-red text-white font-bold px-4 py-2 rounded", children: "Eliminar" }), _jsx("button", { onClick: () => { setEditingType(null); setTypeLogo(null); }, className: "flex-1 px-4 py-2 rounded bg-white/10", children: "Cancelar" })] })] })] }) }))] })] })] }));
}
function Catalog({ items, onRemove, onEdit, renderCreate }) {
    return (_jsxs("div", { children: [_jsxs("ul", { className: "space-y-1 max-h-64 overflow-y-auto mb-3", children: [items.map((it) => (_jsxs("li", { className: "flex items-center justify-between py-1 border-b border-white/5", children: [_jsxs("span", { className: "flex items-center gap-2", children: [it.extra, it.label] }), _jsxs("div", { className: "flex gap-1", children: [onEdit && _jsx("button", { onClick: () => onEdit(it.id), className: "text-board-amber text-sm", children: "Editar" }), _jsx("button", { onClick: () => onRemove(it.id), className: "text-board-red text-sm", children: "\u2715" })] })] }, it.id))), items.length === 0 && _jsx("li", { className: "text-board-dim text-sm", children: "Vac\u00EDo" })] }), renderCreate()] }));
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
