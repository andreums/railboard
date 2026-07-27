import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Display from "./pages/Display";
import DisplayPage from "./pages/DisplayPage";
import Operator from "./pages/Operator";
import Admin from "./pages/Admin";
import DisplayConfigPage from "./pages/DisplayConfig";
import Trains from "./pages/Trains";
import TrainSettings from "./pages/TrainSettings";
import "./styles/index.css";

const SW_VERSION = import.meta.env.VITE_APP_VERSION || String(Date.now());

if ("serviceWorker" in navigator) {
  window.addEventListener("load", async () => {
    try {
      const reg = await navigator.serviceWorker.register(`/sw.js?v=${SW_VERSION}`);

      reg.addEventListener("updatefound", () => {
        const newWorker = reg.installing;
        if (newWorker) {
          newWorker.addEventListener("statechange", () => {
            if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
              newWorker.postMessage({ type: "SKIP_WAITING" });
            }
          });
        }
      });
    } catch {
      /* SW registration failed, continuing without it */
    }
  });
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route path="/" element={<Display />} />
        <Route path="/display/:stationId" element={<Display />} />
        <Route path="/display/station/:stationId" element={<Display />} />
        <Route path="/s/:displayId" element={<DisplayPage />} />
        <Route path="/admin/displays" element={<DisplayConfigPage />} />
        <Route path="/admin/displays/:stationId" element={<DisplayConfigPage />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/admin/:tab" element={<Admin />} />
        <Route path="/operator" element={<Operator />} />
        <Route path="/trains" element={<Trains />} />
        <Route path="/train-settings" element={<TrainSettings />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>,
);
