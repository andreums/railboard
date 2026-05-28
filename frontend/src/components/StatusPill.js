import { jsx as _jsx } from "react/jsx-runtime";
const STYLES = {
    Scheduled: "text-board-dim",
    Boarding: "text-board-green animate-blink font-bold",
    Delayed: "text-board-amber font-bold",
    Departed: "text-board-dim line-through",
    Arrived: "text-board-dim line-through",
    Cancelled: "text-board-red font-bold uppercase",
};
const LABEL_ES = {
    Scheduled: "A horario",
    Boarding: "Embarcando",
    Delayed: "Retrasado",
    Departed: "Salido",
    Arrived: "Llegado",
    Cancelled: "Suprimido",
};
export default function StatusPill({ status }) {
    return _jsx("span", { className: `uppercase text-sm tracking-widest ${STYLES[status]}`, children: LABEL_ES[status] });
}
