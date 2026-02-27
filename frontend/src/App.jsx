import { useState } from "react";
import { BrowserRouter, Routes, Route, Link, useLocation } from "react-router-dom";
import ScanScreen from "./components/ScanScreen";
import VerdictScreen from "./components/VerdictScreen";
import NetworkGraph from "./components/NetworkGraph";
import ThreatDashboard from "./components/ThreatDashboard";

function NavBar() {
  const loc = useLocation();
  const links = [
    { to: "/", label: "🛡️ Scan" },
    { to: "/threats", label: "📡 Threats" },
  ];
  return (
    <nav className="border-b border-gray-800 bg-gray-900/80 backdrop-blur sticky top-0 z-50">
      <div className="max-w-6xl mx-auto flex items-center justify-between px-4 h-14">
        <Link to="/" className="text-xl font-bold tracking-tight">
          <span className="text-green-400">Guardian</span>
          <span className="text-white">Eye</span>
        </Link>
        <div className="flex gap-4">
          {links.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              className={`text-sm px-3 py-1.5 rounded-lg transition ${
                loc.pathname === l.to
                  ? "bg-gray-700 text-white"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              {l.label}
            </Link>
          ))}
        </div>
      </div>
    </nav>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <NavBar />
      <main className="max-w-6xl mx-auto p-4">
        <Routes>
          <Route path="/" element={<ScanScreen />} />
          <Route path="/verdict/:scanId" element={<VerdictScreen />} />
          <Route path="/network/:entity" element={<NetworkGraph />} />
          <Route path="/threats" element={<ThreatDashboard />} />
        </Routes>
      </main>
    </BrowserRouter>
  );
}
