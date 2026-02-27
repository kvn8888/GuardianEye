import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, Link } from "react-router-dom";

/**
 * Simple force-directed graph using Canvas.
 * No external graph library needed — fast, hackathon-friendly.
 */
export default function NetworkGraph() {
  const { entity } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const canvasRef = useRef(null);
  const nodesRef = useRef([]);
  const edgesRef = useRef([]);

  useEffect(() => {
    fetch(`/api/graph/network/${encodeURIComponent(entity)}`)
      .then((r) => r.json())
      .then((d) => {
        setData(d);
        initGraph(d);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [entity]);

  function initGraph(graphData) {
    const nodes = (graphData.nodes || []).map((n, i) => ({
      ...n,
      x: 400 + Math.cos((i / graphData.nodes.length) * Math.PI * 2) * 200 + Math.random() * 40,
      y: 300 + Math.sin((i / graphData.nodes.length) * Math.PI * 2) * 200 + Math.random() * 40,
      vx: 0,
      vy: 0,
    }));
    nodesRef.current = nodes;
    edgesRef.current = graphData.edges || [];
  }

  // Simple force simulation
  const simulate = useCallback(() => {
    const nodes = nodesRef.current;
    const edges = edgesRef.current;
    if (!nodes.length) return;

    // Repulsion
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const dx = nodes[j].x - nodes[i].x;
        const dy = nodes[j].y - nodes[i].y;
        const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
        const force = 1500 / (dist * dist);
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        nodes[i].vx -= fx;
        nodes[i].vy -= fy;
        nodes[j].vx += fx;
        nodes[j].vy += fy;
      }
    }

    // Attraction (edges)
    const nodeMap = {};
    nodes.forEach((n) => (nodeMap[n.id] = n));
    for (const edge of edges) {
      const a = nodeMap[edge.from];
      const b = nodeMap[edge.to];
      if (!a || !b) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
      const force = (dist - 120) * 0.01;
      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;
      a.vx += fx;
      a.vy += fy;
      b.vx -= fx;
      b.vy -= fy;
    }

    // Center gravity
    for (const n of nodes) {
      n.vx += (400 - n.x) * 0.001;
      n.vy += (300 - n.y) * 0.001;
      n.vx *= 0.85;
      n.vy *= 0.85;
      n.x += n.vx;
      n.y += n.vy;
    }
  }, []);

  // Draw loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let animId;

    function draw() {
      simulate();
      const nodes = nodesRef.current;
      const edges = edgesRef.current;
      const nodeMap = {};
      nodes.forEach((n) => (nodeMap[n.id] = n));

      ctx.fillStyle = "#0a0a0f";
      ctx.fillRect(0, 0, 800, 600);

      // Draw edges
      for (const edge of edges) {
        const a = nodeMap[edge.from];
        const b = nodeMap[edge.to];
        if (!a || !b) continue;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.strokeStyle = "#333";
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      // Draw nodes
      for (const n of nodes) {
        const r = n.reportCount > 10 ? 16 : n.reportCount > 3 ? 12 : 8;
        const colors = {
          report: n.verdict === "RED" ? "#ef4444" : n.verdict === "GREEN" ? "#22c55e" : "#eab308",
          phone_number: "#3b82f6",
          url: "#a855f7",
          company_name: "#f97316",
          entity: "#6b7280",
        };
        const color = colors[n.type] || "#6b7280";

        // Glow for high-report entities
        if ((n.reportCount || 0) > 5) {
          ctx.beginPath();
          ctx.arc(n.x, n.y, r + 6, 0, Math.PI * 2);
          ctx.fillStyle = color + "33";
          ctx.fill();
        }

        ctx.beginPath();
        ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
        ctx.strokeStyle = "#111";
        ctx.lineWidth = 2;
        ctx.stroke();

        // Label
        ctx.fillStyle = "#ddd";
        ctx.font = "10px sans-serif";
        ctx.textAlign = "center";
        const label = (n.label || n.id || "").slice(0, 24);
        ctx.fillText(label, n.x, n.y + r + 14);
      }

      animId = requestAnimationFrame(draw);
    }

    draw();
    return () => cancelAnimationFrame(animId);
  }, [data, simulate]);

  if (loading) {
    return <p className="text-gray-400 text-center mt-12 animate-pulse">Loading network graph...</p>;
  }

  return (
    <div className="space-y-4 mt-6">
      <div className="flex items-center justify-between">
        <div>
          <Link to="/" className="text-sm text-gray-400 hover:text-white">← Back</Link>
          <h2 className="text-xl font-bold mt-1">
            Scam Network: <span className="text-yellow-400">{decodeURIComponent(entity)}</span>
          </h2>
          {data && (
            <p className="text-sm text-gray-400">
              {data.total_reports || 0} connected scam reports &middot;{" "}
              {(data.nodes || []).length} entities
            </p>
          )}
        </div>

        {/* Legend */}
        <div className="flex gap-3 text-xs text-gray-400">
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-blue-500 inline-block" /> Phone</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-purple-500 inline-block" /> URL</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-orange-500 inline-block" /> Company</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-red-500 inline-block" /> Red</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-green-500 inline-block" /> Green</span>
        </div>
      </div>

      <div className="rounded-xl border border-gray-700 overflow-hidden">
        <canvas ref={canvasRef} width={800} height={600} className="w-full" />
      </div>
    </div>
  );
}
