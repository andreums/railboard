import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Display from "./pages/Display";
import Admin from "./pages/Admin";
import Trains from "./pages/Trains";
import TrainSettings from "./pages/TrainSettings";
import "./styles/index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route path="/" element={<Display />} />
        <Route path="/display/:stationId" element={<Display />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/trains" element={<Trains />} />
        <Route path="/train-settings" element={<TrainSettings />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);
