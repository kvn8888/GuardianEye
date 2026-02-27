import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";

const TABS = [
  { id: "image", icon: "📸", label: "Screenshot", desc: "Upload a suspicious screenshot" },
  { id: "voice", icon: "🎤", label: "Voice Recording", desc: "Upload a suspicious call recording" },
  { id: "text", icon: "✉️", label: "Paste Text", desc: "Paste a suspicious message" },
];

export default function ScanScreen() {
  const [tab, setTab] = useState("image");
  const [loading, setLoading] = useState(false);
  const [text, setText] = useState("");
  const [events, setEvents] = useState([]);
  const fileRef = useRef(null);
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e?.preventDefault();
    setLoading(true);
    setEvents([]);

    try {
      let res;
      if (tab === "image") {
        const file = fileRef.current?.files?.[0];
        if (!file) return setLoading(false);
        const fd = new FormData();
        fd.append("image", file);
        res = await fetch("/api/scan/image", { method: "POST", body: fd });
      } else if (tab === "voice") {
        const file = fileRef.current?.files?.[0];
        if (!file) return setLoading(false);
        const fd = new FormData();
        fd.append("audio", file);
        res = await fetch("/api/scan/voice", { method: "POST", body: fd });
      } else {
        if (!text.trim()) return setLoading(false);
        res = await fetch("/api/scan/text", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
        });
      }

      const data = await res.json();
      const scanId = data.scan_id;

      // Connect to SSE stream
      const sse = new EventSource(`/api/scan/${scanId}/status`);
      sse.onmessage = (ev) => {
        try {
          const parsed = JSON.parse(ev.data);
          setEvents((prev) => [...prev, { type: ev.type || "message", data: parsed }]);
        } catch {}
      };
      sse.addEventListener("complete", () => {
        sse.close();
        setLoading(false);
        navigate(`/verdict/${scanId}`);
      });
      sse.addEventListener("verdict", (ev) => {
        try {
          const verdict = JSON.parse(ev.data);
          setEvents((prev) => [...prev, { type: "verdict", data: verdict }]);
        } catch {}
      });
      sse.onerror = () => {
        sse.close();
        setLoading(false);
        // Still navigate — verdict might be available
        navigate(`/verdict/${scanId}`);
      };
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6 mt-6">
      {/* Hero */}
      <div className="text-center space-y-2">
        <h1 className="text-4xl font-bold">
          <span className="text-green-400">🛡️ Guardian</span>Eye
        </h1>
        <p className="text-gray-400 text-lg max-w-xl mx-auto">
          AI-powered scam detection. Screenshot it, record it, or paste it — we'll tell you if it's safe.
        </p>
      </div>

      {/* Tab bar */}
      <div className="flex justify-center gap-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-5 py-3 rounded-xl text-sm font-medium transition-all ${
              tab === t.id
                ? "bg-green-600/20 border border-green-500 text-green-400"
                : "bg-gray-800 border border-gray-700 text-gray-400 hover:border-gray-600"
            }`}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Input area */}
      <form onSubmit={handleSubmit} className="max-w-2xl mx-auto space-y-4">
        <div className="rounded-xl border border-gray-700 bg-gray-900 p-6 space-y-4">
          <p className="text-gray-400 text-sm">{TABS.find((t) => t.id === tab)?.desc}</p>

          {tab === "text" ? (
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder='Paste the suspicious message here... e.g. "Your Amazon account has been suspended. Call 1-800-555-0199 immediately."'
              className="w-full h-40 bg-gray-800 rounded-lg p-4 text-gray-100 placeholder-gray-500 border border-gray-700 focus:border-green-500 focus:outline-none resize-none"
            />
          ) : (
            <div className="border-2 border-dashed border-gray-600 rounded-lg p-8 text-center hover:border-green-500 transition cursor-pointer"
              onClick={() => fileRef.current?.click()}
            >
              <input
                ref={fileRef}
                type="file"
                className="hidden"
                accept={tab === "image" ? "image/*" : "audio/*"}
              />
              <p className="text-3xl mb-2">{tab === "image" ? "📸" : "🎤"}</p>
              <p className="text-gray-400">
                Click to upload or drag & drop
              </p>
              <p className="text-gray-500 text-xs mt-1">
                {tab === "image" ? "PNG, JPG, WEBP" : "MP3, WAV, M4A, OGG, WEBM"}
              </p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl font-semibold text-lg transition-all bg-green-600 hover:bg-green-500 text-white disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "🔍 Analyzing..." : "🛡️ Check for Scam"}
          </button>
        </div>
      </form>

      {/* Real-time event feed */}
      {events.length > 0 && (
        <div className="max-w-2xl mx-auto space-y-2">
          <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Analysis Progress</h3>
          <div className="space-y-1">
            {events.map((ev, i) => (
              <EventRow key={i} event={ev} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function EventRow({ event }) {
  const icons = {
    scan_started: "🔄",
    step: "⏳",
    reka_complete: "👁️",
    voice_complete: "🎤",
    gliner_complete: "🏷️",
    tavily_complete: "🔍",
    yutori_complete: "🔬",
    verdict: "⚖️",
    complete: "✅",
  };

  const labels = {
    scan_started: "Scan started",
    reka_complete: "Reka Vision analysis complete",
    voice_complete: "Voice analysis complete",
    gliner_complete: "Entity extraction complete",
    tavily_complete: "Quick search complete",
    yutori_complete: "Deep research complete",
    verdict: "Verdict ready",
    complete: "Analysis complete",
  };

  const stepLabels = {
    reka_vision: "Analyzing screenshot with Reka Vision...",
    voice_analysis: "Analyzing voice recording...",
    gliner_extract: "Extracting entities with GLiNER...",
    tavily_search: "Quick reputation search with Tavily...",
    yutori_research: "Deep research with Yutori agents...",
    verdict: "Synthesizing verdict...",
  };

  const type = event.type;
  const data = event.data || {};
  const icon = icons[type] || "•";

  let label = labels[type] || type;
  if (type === "step" || type === "message") {
    const step = data?.step || data?.data?.step;
    if (step && stepLabels[step]) label = stepLabels[step];
  }

  // Color verdict events
  let cls = "text-gray-400";
  if (type === "verdict") {
    const level = data?.level;
    if (level === "RED") cls = "text-red-400 font-semibold";
    else if (level === "GREEN") cls = "text-green-400 font-semibold";
    else if (level === "YELLOW") cls = "text-yellow-400 font-semibold";
  }
  if (type === "complete") cls = "text-green-400 font-semibold";

  return (
    <div className={`flex items-center gap-2 text-sm px-3 py-1.5 rounded bg-gray-900/50 ${cls}`}>
      <span>{icon}</span>
      <span>{label}</span>
      {type === "verdict" && data?.level && (
        <span className={`ml-auto px-2 py-0.5 rounded text-xs font-bold verdict-${data.level.toLowerCase()}`}>
          {data.level}
        </span>
      )}
      {type === "gliner_complete" && data?.entities?.length > 0 && (
        <span className="ml-auto text-xs text-gray-500">{data.entities.length} entities found</span>
      )}
      {type === "tavily_complete" && data?.results?.length > 0 && (
        <span className="ml-auto text-xs text-gray-500">{data.results.length} sources checked</span>
      )}
    </div>
  );
}
