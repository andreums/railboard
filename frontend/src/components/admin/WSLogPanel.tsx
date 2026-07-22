import { useEffect, useState } from "react";
import { connectWS } from "../../lib/api";

export default function WSLogPanel({ max = 12 }: { max?: number }) {
  const [lines, setLines] = useState<string[]>([]);

  useEffect(() => {
    const ws = connectWS(() => {});
    const add = (t: any) => setLines((s) => [typeof t === "string" ? t : JSON.stringify(t), ...s].slice(0, max));
    const unsubUpdate = ws?.on?.("update", (m: any) => add(m));
    const unsubHello = ws?.on?.("hello", (m: any) => add(m));
    return () => {
      if (typeof unsubUpdate === "function") unsubUpdate();
      if (typeof unsubHello === "function") unsubHello();
      if (ws && typeof ws.close === "function") ws.close();
    };
  }, [max]);

  return (
    <div className="mt-4 p-3 rounded-lg bg-black/30 border border-white/5 text-xs font-mono text-white max-w-md">
      <div className="font-semibold mb-2">WS Log</div>
      <div className="space-y-1 max-h-40 overflow-y-auto">
        {lines.length === 0 ? (
          <div className="text-slate-400">No messages yet</div>
        ) : (
          lines.map((l, i) => (
            <div key={i} className="text-emerald-200">
              {l}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
