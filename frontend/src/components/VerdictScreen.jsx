import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";

export default function VerdictScreen() {
  const { scanId } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/scan/${scanId}/verdict`)
      .then((r) => r.json())
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [scanId]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <p className="text-gray-400 animate-pulse text-lg">Loading verdict...</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center mt-12 space-y-4">
        <p className="text-gray-400">Scan not found or still processing.</p>
        <Link to="/" className="text-green-400 hover:underline">← Back to scan</Link>
      </div>
    );
  }

  const verdict = data.verdict || {};
  const level = verdict.level || "pending";
  const entities = data.entities || [];
  const visual = data.visual || null;
  const voice = data.voice || null;

  return (
    <div className="space-y-6 mt-6 max-w-4xl mx-auto">
      {/* Back link */}
      <Link to="/" className="text-sm text-gray-400 hover:text-white">← New scan</Link>

      {/* Verdict banner */}
      <VerdictBanner level={level} confidence={verdict.confidence} explanation={verdict.explanation} />

      {/* Verdict details grid */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* Scam type & action */}
        <Panel title="Assessment">
          <Row label="Scam Type" value={verdict.scam_type || "Unknown"} />
          <Row label="Confidence" value={`${Math.round((verdict.confidence || 0) * 100)}%`} />
          {verdict.recommended_action && (
            <div className="mt-3 p-3 rounded-lg bg-blue-900/20 border border-blue-700 text-sm text-blue-300">
              <strong>Recommended:</strong> {verdict.recommended_action}
            </div>
          )}
        </Panel>

        {/* Red flags */}
        <Panel title="Red Flags">
          {(verdict.red_flags || []).length === 0 ? (
            <p className="text-gray-500 text-sm">No red flags detected</p>
          ) : (
            <ul className="space-y-1">
              {verdict.red_flags.map((f, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <span className="text-red-400 mt-0.5">⚠️</span>
                  <span className="text-gray-300">{f}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      {/* Entities extracted */}
      {entities.length > 0 && (
        <Panel title={`Entities Extracted (${entities.length})`}>
          <div className="flex flex-wrap gap-2">
            {entities.map((ent, i) => (
              <EntityBadge key={i} entity={ent} />
            ))}
          </div>
        </Panel>
      )}

      {/* Visual analysis */}
      {visual && !visual.error && (
        <Panel title="Visual Analysis (Reka Vision)">
          <Row label="Scam Confidence" value={`${visual.scam_confidence || 0}%`} />
          {visual.impersonated_brand && (
            <Row label="Impersonated Brand" value={visual.impersonated_brand} />
          )}
          {visual.urgency_cues?.length > 0 && (
            <Row label="Urgency Cues" value={visual.urgency_cues.join(", ")} />
          )}
          {visual.urls_visible?.length > 0 && (
            <div className="mt-2">
              <p className="text-xs text-gray-500 mb-1">URLs Found:</p>
              {visual.urls_visible.map((u, i) => (
                <span key={i} className="inline-block bg-gray-800 px-2 py-0.5 rounded text-xs text-yellow-400 mr-1 mb-1">
                  {u}
                </span>
              ))}
            </div>
          )}
        </Panel>
      )}

      {/* Voice analysis */}
      {voice && !voice.error && (
        <Panel title={`Voice Analysis (${voice.analyzed_by === "openai-fallback" ? "OpenAI" : "Modulate Velma"})`}>
          <Row label="Fraud Score" value={`${voice.fraud_score || 0}%`} />
          {voice.deepfake_detected && (
            <div className="mt-2 p-2 rounded bg-red-900/30 border border-red-700 text-red-400 text-sm font-semibold">
              ⚠️ DEEPFAKE VOICE DETECTED
            </div>
          )}
          {voice.pressure_tactics?.length > 0 && (
            <div className="mt-2">
              <p className="text-xs text-gray-500 mb-1">Pressure Tactics:</p>
              {voice.pressure_tactics.map((t, i) => (
                <span key={i} className="inline-block bg-red-900/20 border border-red-800 px-2 py-0.5 rounded text-xs text-red-400 mr-1 mb-1">
                  {t}
                </span>
              ))}
            </div>
          )}
          {voice.emotion_profile && Object.keys(voice.emotion_profile).length > 0 && (
            <div className="mt-3">
              <p className="text-xs text-gray-500 mb-2">Emotion Profile:</p>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(voice.emotion_profile).map(([k, v]) => (
                  <EmotionBar key={k} label={k} value={v} />
                ))}
              </div>
            </div>
          )}
          {voice.transcript && (
            <details className="mt-3">
              <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-300">
                View transcript
              </summary>
              <p className="mt-2 text-sm text-gray-400 bg-gray-800 p-3 rounded-lg whitespace-pre-wrap">
                {voice.transcript}
              </p>
            </details>
          )}
        </Panel>
      )}

      {/* Graph link */}
      <div className="text-center">
        <Link
          to={`/network/${encodeURIComponent(entities[0]?.text || scanId)}`}
          className="text-green-400 hover:underline text-sm"
        >
          View scam network graph →
        </Link>
      </div>
    </div>
  );
}

function VerdictBanner({ level, confidence, explanation }) {
  const config = {
    RED: { bg: "bg-red-950", border: "border-red-500", icon: "🚨", title: "SCAM DETECTED", pulse: "pulse-red" },
    YELLOW: { bg: "bg-yellow-950", border: "border-yellow-500", icon: "⚠️", title: "SUSPICIOUS", pulse: "" },
    GREEN: { bg: "bg-green-950", border: "border-green-500", icon: "✅", title: "APPEARS SAFE", pulse: "pulse-green" },
    pending: { bg: "bg-gray-900", border: "border-gray-600", icon: "⏳", title: "PROCESSING", pulse: "" },
  };
  const c = config[level] || config.pending;

  return (
    <div className={`${c.bg} border-2 ${c.border} rounded-2xl p-6 text-center ${c.pulse}`}>
      <p className="text-5xl mb-3">{c.icon}</p>
      <h2 className="text-3xl font-black tracking-wider">{c.title}</h2>
      {confidence != null && (
        <p className="text-gray-400 text-sm mt-1">
          Confidence: {Math.round(confidence * 100)}%
        </p>
      )}
      {explanation && (
        <p className="text-gray-300 mt-3 text-lg max-w-xl mx-auto">{explanation}</p>
      )}
    </div>
  );
}

function Panel({ title, children }) {
  return (
    <div className="rounded-xl border border-gray-700 bg-gray-900 p-5">
      <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">{title}</h3>
      {children}
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex justify-between items-center py-1.5 border-b border-gray-800 last:border-0">
      <span className="text-gray-500 text-sm">{label}</span>
      <span className="text-gray-200 text-sm font-medium">{value}</span>
    </div>
  );
}

function EntityBadge({ entity }) {
  const colors = {
    phone_number: "bg-blue-900/30 border-blue-700 text-blue-400",
    url: "bg-purple-900/30 border-purple-700 text-purple-400",
    company_name: "bg-orange-900/30 border-orange-700 text-orange-400",
    dollar_amount: "bg-green-900/30 border-green-700 text-green-400",
    threat_language: "bg-red-900/30 border-red-700 text-red-400",
    email_address: "bg-cyan-900/30 border-cyan-700 text-cyan-400",
  };
  const cls = colors[entity.label] || "bg-gray-800 border-gray-600 text-gray-300";

  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border text-xs ${cls}`}>
      <span className="opacity-60">{entity.label?.replace(/_/g, " ")}</span>
      <span className="font-medium">{entity.text}</span>
    </span>
  );
}

function EmotionBar({ label, value }) {
  const pct = Math.min(Math.max(value, 0), 100);
  const color = pct > 70 ? "bg-red-500" : pct > 40 ? "bg-yellow-500" : "bg-green-500";
  return (
    <div>
      <div className="flex justify-between text-xs mb-0.5">
        <span className="text-gray-400 capitalize">{label}</span>
        <span className="text-gray-500">{pct}%</span>
      </div>
      <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
