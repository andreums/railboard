import { jsxs as _jsxs, jsx as _jsx } from "react/jsx-runtime";
import { useEffect, useState } from "react";
export default function Clock() {
    const [now, setNow] = useState(new Date());
    useEffect(() => {
        const t = setInterval(() => setNow(new Date()), 1000);
        return () => clearInterval(t);
    }, []);
    const hh = String(now.getHours()).padStart(2, "0");
    const mm = String(now.getMinutes()).padStart(2, "0");
    const ss = String(now.getSeconds()).padStart(2, "0");
    return (_jsx("div", { className: "text-right", children: _jsxs("div", { className: "font-mono text-5xl tracking-wider", children: [hh, ":", mm, _jsxs("span", { className: "text-board-dim", children: [":", ss] })] }) }));
}
