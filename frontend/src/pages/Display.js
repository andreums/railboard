import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from "react";
import { api, connectWS } from "../lib/api";
import Clock from "../components/Clock";
import StatusPill from "../components/StatusPill";
import { t } from "../lib/i18n";
function minutesUntil(hhmm) {
    const [h, m] = hhmm.split(":").map(Number);
    const now = new Date();
    const t = new Date(now);
    t.setHours(h, m, 0, 0);
    let diff = Math.round((t.getTime() - now.getTime()) / 60000);
    if (diff < -60)
        diff += 24 * 60; // wrap past midnight
    return diff;
}
export default function Display() {
    const [config, setConfig] = useState(null);
    const [trains, setTrains] = useState([]);
    const [, setTick] = useState(0);
    const refresh = async () => {
        const [c, t] = await Promise.all([api.getConfig(), api.listTrains()]);
        setConfig(c);
        setTrains(t);
    };
    useEffect(() => {
        refresh();
        const unsub = connectWS(refresh);
        const tick = setInterval(() => setTick((x) => x + 1), 30_000);
        return () => { unsub(); clearInterval(tick); };
    }, []);
    const mode = config?.mode ?? "departures";
    const lang = config?.language ?? "es";
    const rows = useMemo(() => {
        return trains
            .filter((t) => !["Departed", "Arrived"].includes(t.status))
            .slice(0, 12);
    }, [trains]);
    const bgColor = config?.bgColor || "#050a14";
    const headerBgColor = config?.headerBgColor || "#BFEFD5";
    const headerTextColor = config?.headerTextColor || "#f5f3ec";
    const rowBgColor = config?.rowBgColor || "#1A3254";
    const altBgColor = config?.altBgColor || "#102341";
    const destinationFontSize = parseInt(config?.destinationFontSize || "48");
    return (_jsxs("div", { className: "min-h-screen text-board-ink font-body flex flex-col", style: { backgroundColor: bgColor }, children: [_jsx("header", { className: "border-b border-white/10 px-10 py-4", style: { backgroundColor: headerBgColor, color: headerTextColor }, children: _jsxs("div", { className: "flex items-end justify-between mb-2", children: [_jsxs("div", { className: "flex flex-col gap-1", children: [_jsxs("div", { className: "flex items-baseline gap-3", children: [config?.logo_url && _jsx("img", { src: config.logo_url, className: "h-12", alt: "Logo" }), _jsxs("div", { children: [_jsx("span", { className: "font-bold text-white text-sm tracking-widest block", children: "ADIF" }), _jsx("span", { className: "font-display text-5xl tracking-widest text-board-amber block", children: t(mode === "departures" ? "departures" : "arrivals", lang) })] })] }), _jsx("h1", { className: "text-board-dim text-lg tracking-wide", children: config?.station_name ?? "—" })] }), _jsxs("div", { className: "flex items-end gap-20", children: [_jsx(Clock, {}), _jsx("div", { className: "text-board-dim text-xs uppercase tracking-[0.3em]", children: t("platform", lang) })] })] }) }), _jsxs("div", { className: "flex-1 overflow-auto", children: [rows.length === 0 && (_jsx("div", { className: "text-center text-board-dim py-20 text-xl", children: t("no-trains", lang) })), rows.map((train, i) => {
                        const place = mode === "departures" ? train.destination : train.origin;
                        const minutes = minutesUntil(train.expected_time);
                        const delayed = train.expected_time !== train.scheduled_time;
                        return (_jsxs("div", { className: "grid grid-cols-[110px_1fr_200px_130px_70px] gap-4 px-10 py-4 items-center border-b border-white/5", style: { backgroundColor: i % 2 === 0 ? rowBgColor : altBgColor }, children: [_jsxs("div", { className: "font-mono text-center", children: [_jsx("div", { className: "text-3xl font-bold mb-1", children: train.expected_time }), minutes < 10 && train.status !== "Cancelled" && (_jsx("div", { className: `text-4xl font-bold ${minutes <= 0 ? "text-board-green animate-blink" : ""}`, children: minutes <= 0 ? t("now", lang) : `${minutes} min` }))] }), _jsxs("div", { className: "overflow-hidden flex flex-col gap-1", children: [_jsx("div", { className: "font-display tracking-wide leading-tight", style: { fontSize: `${destinationFontSize}px` }, children: place }), train.stops?.length > 0 && (_jsx("div", { className: "text-board-dim text-sm overflow-x-auto whitespace-nowrap", children: train.stops.join(" · ") }))] }), _jsxs("div", { className: "flex flex-col gap-1", children: [train.type_code && (_jsx("span", { className: "inline-block self-start text-xs font-bold px-2 py-1 rounded text-white tracking-widest", style: { backgroundColor: train.type_color || "#7c1d2e" }, children: train.type_code })), _jsx("span", { className: "font-mono text-board-dim text-sm", children: train.number })] }), _jsx("div", { children: _jsx(StatusPill, { status: train.status }) }), _jsx("div", { className: "text-center", children: _jsx("div", { className: "font-display text-5xl text-board-amber leading-none", children: train.platform }) })] }, train.id));
                    })] }), _jsx("footer", { className: "border-t border-white/10 bg-black/30 overflow-hidden py-3", children: _jsx("div", { className: "whitespace-nowrap animate-marquee flex gap-16 text-board-dim text-sm tracking-widest uppercase", children: Array.from({ length: 2 }).map((_, k) => (_jsxs("span", { children: [t("welcome", lang), " ", config?.station_name, " \u00B7 ", t("ticket", lang), " \u00B7 ", t("tracks", lang), " \u00B7 ", t("wifi", lang), " \u00B7 ", t("event", lang)] }, k))) }) })] }));
}
