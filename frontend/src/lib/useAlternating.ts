import { useEffect, useState } from "react";

export function useAlternating(active: boolean): boolean {
  const [toggle, setToggle] = useState(false);
  useEffect(() => {
    if (!active) { setToggle(false); return; }
    const interval = setInterval(() => setToggle((p) => !p), 5000);
    return () => clearInterval(interval);
  }, [active]);
  return toggle;
}
