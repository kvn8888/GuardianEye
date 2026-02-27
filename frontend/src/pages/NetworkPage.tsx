import Layout from "@/components/Layout";
import { Card, CardContent } from "@/components/ui/card";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { useEffect, useRef, useState, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { mockNetworkNodes, type NetworkNode } from "@/data/mockData";
import { getEntityNetwork } from "@/api/client";
import { adaptGraphToNodes } from "@/api/adapters";

const nodeColors: Record<string, string> = {
  phone: "#3F9AAE",
  url: "#F96E5B",
  company: "#FFE2AF",
  report: "#A0D2DB",
};

const nodeLabels: Record<string, string> = {
  phone: "Phone Number",
  url: "URL",
  company: "Company",
  report: "Scam Report",
};

const NetworkPage = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [searchParams] = useSearchParams();
  const entityParam = searchParams.get("entity");
  const [nodes, setNodes] = useState<NetworkNode[]>(() =>
    mockNetworkNodes.map((n) => ({ ...n }))
  );
  const [selectedNode, setSelectedNode] = useState<NetworkNode | null>(null);
  const [totalReports, setTotalReports] = useState(0);
  const nodesRef = useRef(nodes);
  nodesRef.current = nodes;

  // Fetch real network data if entity param is provided
  useEffect(() => {
    if (!entityParam) return;
    getEntityNetwork(entityParam).then((graph) => {
      if (graph.nodes && graph.nodes.length > 0) {
        const adapted = adaptGraphToNodes(graph);
        setNodes(adapted);
        setTotalReports(graph.total_reports || 0);
      }
    });
  }, [entityParam]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * window.devicePixelRatio;
    canvas.height = rect.height * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

    ctx.clearRect(0, 0, rect.width, rect.height);

    const currentNodes = nodesRef.current;

    // Draw edges
    currentNodes.forEach((node) => {
      node.connections.forEach((connId) => {
        const target = currentNodes.find((n) => n.id === connId);
        if (target) {
          ctx.beginPath();
          ctx.moveTo(node.x, node.y);
          ctx.lineTo(target.x, target.y);
          ctx.strokeStyle = "rgba(63, 154, 174, 0.15)";
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
      });
    });

    // Draw nodes
    currentNodes.forEach((node) => {
      const color = nodeColors[node.type];
      const radius = node.type === "report" ? 8 : 12;

      // Glow
      ctx.beginPath();
      ctx.arc(node.x, node.y, radius + 4, 0, Math.PI * 2);
      ctx.fillStyle = color + "20";
      ctx.fill();

      // Circle
      ctx.beginPath();
      ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 2;
      ctx.stroke();

      // Label
      ctx.fillStyle = "#2D3748";
      ctx.font = "12px Nunito, sans-serif";
      ctx.textAlign = "center";
      const label = node.label.length > 20 ? node.label.substring(0, 18) + "..." : node.label;
      ctx.fillText(label, node.x, node.y + radius + 18);
    });
  }, []);

  // Simple force simulation
  useEffect(() => {
    let animId: number;
    const simulate = () => {
      setNodes((prev) => {
        const next = prev.map((n) => ({ ...n }));
        // Repulsion
        for (let i = 0; i < next.length; i++) {
          for (let j = i + 1; j < next.length; j++) {
            const dx = next[j].x - next[i].x;
            const dy = next[j].y - next[i].y;
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;
            const force = 800 / (dist * dist);
            next[i].vx -= (dx / dist) * force;
            next[i].vy -= (dy / dist) * force;
            next[j].vx += (dx / dist) * force;
            next[j].vy += (dy / dist) * force;
          }
        }
        // Attraction along edges
        next.forEach((node) => {
          node.connections.forEach((connId) => {
            const target = next.find((n) => n.id === connId);
            if (target) {
              const dx = target.x - node.x;
              const dy = target.y - node.y;
              const dist = Math.sqrt(dx * dx + dy * dy) || 1;
              const force = (dist - 120) * 0.005;
              node.vx += (dx / dist) * force;
              node.vy += (dy / dist) * force;
            }
          });
        });
        // Center gravity
        next.forEach((node) => {
          node.vx += (400 - node.x) * 0.001;
          node.vy += (300 - node.y) * 0.001;
          node.vx *= 0.9;
          node.vy *= 0.9;
          node.x += node.vx;
          node.y += node.vy;
          node.x = Math.max(40, Math.min(760, node.x));
          node.y = Math.max(40, Math.min(560, node.y));
        });
        return next;
      });
      draw();
      animId = requestAnimationFrame(simulate);
    };
    simulate();
    return () => cancelAnimationFrame(animId);
  }, [draw]);

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const clicked = nodesRef.current.find((node) => {
      const dx = node.x - x;
      const dy = node.y - y;
      return Math.sqrt(dx * dx + dy * dy) < 16;
    });

    setSelectedNode(clicked || null);
  };

  return (
    <Layout>
      <div className="max-w-6xl mx-auto px-4 py-12">
        <div className="text-center mb-8">
          <h1 className="text-foreground mb-3">Scam Network Map</h1>
          <p className="text-lg text-muted-foreground">
            {entityParam
              ? `${totalReports} reports connected to "${entityParam}". Each dot is a piece of a scam.`
              : `${nodes.length} connected entities. Each dot is a piece of a scam. See how they connect.`}
          </p>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap justify-center gap-4 mb-6">
          {Object.entries(nodeColors).map(([type, color]) => (
            <div key={type} className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full" style={{ backgroundColor: color }} />
              <span className="text-sm text-muted-foreground font-semibold capitalize">
                {nodeLabels[type]}
              </span>
            </div>
          ))}
        </div>

        <Card className="rounded-2xl shadow-[0_4px_20px_rgba(63,154,174,0.1)] border-0 overflow-hidden">
          <CardContent className="p-0">
            <canvas
              ref={canvasRef}
              className="w-full cursor-pointer"
              style={{ height: "600px" }}
              onClick={handleCanvasClick}
            />
          </CardContent>
        </Card>

        <Sheet open={!!selectedNode} onOpenChange={() => setSelectedNode(null)}>
          <SheetContent className="rounded-l-2xl">
            <SheetHeader>
              <SheetTitle className="text-foreground">
                {selectedNode && nodeLabels[selectedNode.type]}
              </SheetTitle>
              <SheetDescription>Entity Details</SheetDescription>
            </SheetHeader>
            {selectedNode && (
              <div className="mt-6 space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground font-semibold">Identifier</p>
                  <p className="text-lg text-foreground font-bold">{selectedNode.label}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground font-semibold">Type</p>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: nodeColors[selectedNode.type] }} />
                    <span className="text-foreground capitalize">{nodeLabels[selectedNode.type]}</span>
                  </div>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground font-semibold">Connections</p>
                  <p className="text-foreground">{selectedNode.connections.length} linked entities</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground font-semibold">Connected To</p>
                  <div className="space-y-2 mt-2">
                    {selectedNode.connections.map((connId) => {
                      const conn = nodesRef.current.find((n) => n.id === connId);
                      return conn ? (
                        <div key={connId} className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
                          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: nodeColors[conn.type] }} />
                          <span className="text-sm text-foreground">{conn.label}</span>
                        </div>
                      ) : null;
                    })}
                  </div>
                </div>
              </div>
            )}
          </SheetContent>
        </Sheet>
      </div>
    </Layout>
  );
};

export default NetworkPage;
