import { useEffect, useState } from "react";

function dateFromHHMMSS(value?: string) {
  const now = new Date();
  const [h = 0, m = 0, s = 0] = (value || "00:00:00").split(":").map(Number);
  now.setHours(h, m, s, 0);
  return now;
}

export default function Clock({
  mode = "real",
  fakeTime = "12:00:00",
  fakeStepSeconds = 1,
}: {
  mode?: "real" | "fake";
  fakeTime?: string;
  fakeStepSeconds?: number;
}) {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    setNow(mode === "fake" ? dateFromHHMMSS(fakeTime) : new Date());
  }, [mode, fakeTime]);

  useEffect(() => {
    const step = Number.isFinite(fakeStepSeconds) ? fakeStepSeconds : 1;
    const t = setInterval(() => {
      setNow((current) => mode === "fake"
        ? new Date(current.getTime() + step * 1000)
        : new Date());
    }, 1000);
    return () => clearInterval(t);
  }, [mode, fakeStepSeconds]);

  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  const ss = String(now.getSeconds()).padStart(2, "0");
  return (
    <div className="text-right text-current">
      <div className="font-mono text-5xl tracking-wider">
        {hh}:{mm}<span className="text-current">:{ss}</span>
      </div>
    </div>
  );
}
