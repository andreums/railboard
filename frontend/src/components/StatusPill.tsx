import type { Train } from "../lib/api";

const STYLES: Record<Train["status"], string> = {
  Scheduled: "text-board-dim",
  Boarding:  "text-board-green animate-blink font-bold",
  Delayed:   "text-board-amber font-bold",
  Departed:  "text-board-dim line-through",
  Arrived:   "text-board-dim line-through",
  Cancelled: "text-board-red font-bold uppercase",
};

const LABEL_ES: Record<Train["status"], string> = {
  Scheduled: "En Hora",
  Boarding:  "Embarcando",
  Delayed:   "Demorado",
  Departed:  "Salido",
  Arrived:   "Llegadas",
  Cancelled: "Suprimido",
};

export default function StatusPill({ status, large }: { status: Train["status"]; large?: boolean }) {
  return <span className={`uppercase ${large ? "text-xs" : "text-sm"} tracking-widest ${STYLES[status]}`}>{LABEL_ES[status]}</span>;
}
