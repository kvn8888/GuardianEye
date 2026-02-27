import { useState, useEffect } from "react";
import { Link } from "react-router-dom";

export default function ThreatDashboard() {
  const [threats, setThreats] = useState([]);
  const [scouts, setScouts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch("/api/threats/recent").then((r) => r.json()).catch(() => ({ threats: [] })),
      fetch("/api/scout/status").then((r) => r.json()).catch(() => ({ active_scouts: [], count: 0 })),
    ])
      .then(([t, s]) => {
        setThreats(t.threats || []);
        setScouts(s.active_scouts || []);
      })
      .finally(() => setLoading(false));
  }, []);

  async function handleCreateScout() {
    setCreating(true);
    try {
      const res = await fetch("/api/scout/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (data.scout) {
        setScouts((prev) => [...prev, data.scout]);
      }
    } catch (err) {
      console.error(err);
    }
    setCreating(false);
  }

  return (
    <div className="space-y-6 mt-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">📡 Threat Intelligence</h1>
          <p className="text-gray-400 text-sm">
            Autonomous monitoring of scam databases via Yutori Scouting
          </p>
        </div>
        <button
          onClick={handleCreateScout}
          disabled={creating}
          className="px-4 py-2 bg-green-600 hover:bg-green-500 rounded-lg text-sm font-medium disabled:opacity-50"
        >
          {creating ? "Creating..." : "+ New Scout"}
        </button>
      </div>

      {/* Active scouts */}
      <div className="rounded-xl border border-gray-700 bg-gray-900 p-5">
        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
          Active Scouts ({scouts.length || 0})
        </h3>
        {scouts.length === 0 ? (
          <p className="text-gray-500 text-sm">
            No active scouts. Click "New Scout" to start autonomous monitoring.
          </p>
        ) : (
          <div className="space-y-2">
            {(Array.isArray(scouts) ? scouts : []).map((s, i) => (
              <div key={s?.id || i} className="flex items-center justify-between bg-gray-800 rounded-lg p-3">
                <div>
                  <p className="text-sm text-gray-200 font-medium">
                    Scout {s?.id?.slice?.(0, 12) || `#${i + 1}`}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Monitoring FTC, r/Scams, ScamAdviser, FBI IC3, AARP
                  </p>
                </div>
                <span className="px-2 py-0.5 bg-green-900/30 border border-green-700 text-green-400 rounded text-xs font-semibold">
                  ACTIVE
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent threats */}
      <div className="rounded-xl border border-gray-700 bg-gray-900 p-5">
        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
          Recently Detected Threats
        </h3>
        {loading ? (
          <p className="text-gray-400 text-sm animate-pulse">Loading threats...</p>
        ) : threats.length === 0 ? (
          <p className="text-gray-500 text-sm">
            No threats detected yet. Submit scans or activate a scout to populate.
          </p>
        ) : (
          <div className="space-y-2">
            {threats.map((t, i) => (
              <Link
                key={i}
                to={`/network/${encodeURIComponent(t.entity)}`}
                className="flex items-center justify-between bg-gray-800 rounded-lg p-3 hover:bg-gray-750 transition group"
              >
                <div className="flex items-center gap-3">
                  <EntityIcon type={t.entityType} />
                  <div>
                    <p className="text-sm text-gray-200 font-medium group-hover:text-green-400 transition">
                      {t.entity}
                    </p>
                    <p className="text-xs text-gray-500">
                      {t.entityType?.replace(/_/g, " ")} · First seen: {t.firstSeen || "Unknown"}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                    t.reports > 10 ? "bg-red-900/30 border border-red-700 text-red-400" :
                    t.reports > 3 ? "bg-yellow-900/30 border border-yellow-700 text-yellow-400" :
                    "bg-gray-700 text-gray-400"
                  }`}>
                    {t.reports || 0} reports
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Stats summary */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard icon="🛡️" label="Total Scans" value={threats.length || 0} />
        <StatCard icon="📡" label="Active Scouts" value={scouts.length || 0} />
        <StatCard
          icon="⚠️"
          label="High Risk Entities"
          value={threats.filter((t) => (t.reports || 0) > 5).length}
        />
      </div>
    </div>
  );
}

function EntityIcon({ type }) {
  const icons = {
    PhoneNumber: "📞",
    URL: "🔗",
    CompanyImpersonated: "🏢",
    EmailAddress: "📧",
    DollarAmount: "💰",
  };
  return <span className="text-lg">{icons[type] || "•"}</span>;
}

function StatCard({ icon, label, value }) {
  return (
    <div className="rounded-xl border border-gray-700 bg-gray-900 p-4 text-center">
      <p className="text-2xl mb-1">{icon}</p>
      <p className="text-2xl font-bold text-white">{value}</p>
      <p className="text-xs text-gray-500 mt-0.5">{label}</p>
    </div>
  );
}
