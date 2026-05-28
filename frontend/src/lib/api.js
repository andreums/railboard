export const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";
const json = (path, init) => fetch(`${API_URL}/api${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
}).then(async (r) => {
    if (!r.ok)
        throw new Error(await r.text());
    return r.status === 204 ? null : r.json();
});
export const api = {
    getConfig: () => json("/config"),
    setConfig: (c) => json("/config", { method: "PUT", body: JSON.stringify(c) }),
    listTrains: () => json("/trains"),
    createTrain: (t) => json("/trains", { method: "POST", body: JSON.stringify(t) }),
    updateTrain: (id, t) => json(`/trains/${id}`, { method: "PUT", body: JSON.stringify(t) }),
    setStatus: (id, status) => json(`/trains/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) }),
    addDelay: (id, minutes) => json(`/trains/${id}/delay`, { method: "PATCH", body: JSON.stringify({ minutes }) }),
    setPlatform: (id, platform, sector) => json(`/trains/${id}/platform`, { method: "PATCH", body: JSON.stringify({ platform, sector }) }),
    deleteTrain: (id) => json(`/trains/${id}`, { method: "DELETE" }),
    listOperators: () => json("/operators"),
    createOperator: (name, logo) => {
        const fd = new FormData();
        fd.append("name", name);
        if (logo)
            fd.append("logo", logo);
        return fetch(`${API_URL}/api/operators`, { method: "POST", body: fd }).then((r) => r.json());
    },
    updateOperator: (id, name, logo) => {
        const fd = new FormData();
        fd.append("name", name);
        if (logo)
            fd.append("logo", logo);
        return fetch(`${API_URL}/api/operators/${id}`, { method: "PUT", body: fd }).then((r) => r.json());
    },
    deleteOperator: (id) => json(`/operators/${id}`, { method: "DELETE" }),
    listTrainTypes: () => json("/train-types"),
    createTrainType: (code, name, color, logo) => {
        const fd = new FormData();
        fd.append("code", code);
        fd.append("name", name);
        fd.append("color", color);
        if (logo)
            fd.append("logo", logo);
        return fetch(`${API_URL}/api/train-types`, { method: "POST", body: fd }).then((r) => r.json());
    },
    updateTrainType: (id, code, name, color, logo) => {
        const fd = new FormData();
        fd.append("code", code);
        fd.append("name", name);
        fd.append("color", color);
        if (logo)
            fd.append("logo", logo);
        return fetch(`${API_URL}/api/train-types/${id}`, { method: "PUT", body: fd }).then((r) => r.json());
    },
    deleteTrainType: (id) => json(`/train-types/${id}`, { method: "DELETE" }),
    listPlaces: () => json("/places"),
    createPlace: (name) => json("/places", { method: "POST", body: JSON.stringify({ name }) }),
    deletePlace: (id) => json(`/places/${id}`, { method: "DELETE" }),
};
export function connectWS(onUpdate) {
    const url = API_URL.replace(/^http/, "ws") + "/ws";
    let ws = null;
    let stop = false;
    const open = () => {
        ws = new WebSocket(url);
        ws.onmessage = (ev) => {
            try {
                const m = JSON.parse(ev.data);
                if (m.type === "update")
                    onUpdate();
            }
            catch { /* noop */ }
        };
        ws.onclose = () => { if (!stop)
            setTimeout(open, 1500); };
        ws.onerror = () => ws?.close();
    };
    open();
    return () => { stop = true; ws?.close(); };
}
export function fileUrl(p) {
    if (!p)
        return null;
    return p.startsWith("http") ? p : `${API_URL}${p}`;
}
