/**
 * Adapters to convert between backend API shapes and frontend UI shapes.
 * The frontend uses "scam"/"caution"/"safe" + 0-100 confidence.
 * The backend uses "RED"/"YELLOW"/"GREEN" + 0.0-1.0 confidence.
 */

import type { BackendScanResult, BackendEntity, BackendGraphData, BackendThreat } from "./client";
import type { ScanResult, ThreatFeedItem, NetworkNode } from "@/data/mockData";

// ── Verdict Mapping ────────────────────────────────────────

const levelToVerdict: Record<string, "scam" | "caution" | "safe"> = {
  RED: "scam",
  YELLOW: "caution",
  GREEN: "safe",
  pending: "caution",
};

// ── ScanResult Adapter ─────────────────────────────────────

export function adaptScanResult(backend: BackendScanResult): ScanResult {
  const verdict = backend.verdict;
  const entities = backend.entities || [];

  return {
    id: backend.scan_id,
    type: mapScanType(backend.type),
    input: getInputSummary(backend),
    verdict: levelToVerdict[verdict?.level || "pending"] || "caution",
    confidence: Math.round((verdict?.confidence || 0) * 100),
    date: new Date().toISOString().split("T")[0],
    findings: [
      ...(verdict?.explanation ? [verdict.explanation] : []),
      ...(verdict?.red_flags || []),
    ],
    suspiciousItems: entities
      .filter((e) => ["phone_number", "url", "company_name", "email_address"].includes(e.label))
      .map((e) => ({
        label: e.text,
        type: entityLabelToItemType(e.label),
      })),
    connectedReports: 0, // filled from graph query if needed
  };
}

function mapScanType(type?: string): "screenshot" | "voice" | "text" {
  if (type === "image") return "screenshot";
  if (type === "voice") return "voice";
  return "text";
}

function entityLabelToItemType(label: string): "phone" | "url" | "company" {
  if (label === "phone_number") return "phone";
  if (label === "url" || label === "email_address") return "url";
  return "company";
}

function getInputSummary(backend: BackendScanResult): string {
  if (backend.visual?.text_content) {
    return backend.visual.text_content.slice(0, 80) + "...";
  }
  if (backend.voice?.transcript) {
    return backend.voice.transcript.slice(0, 80) + "...";
  }
  return `Scan ${backend.scan_id}`;
}

// ── Network Graph Adapter ──────────────────────────────────

export function adaptGraphToNodes(graph: BackendGraphData): NetworkNode[] {
  const nodes: NetworkNode[] = [];
  const edgeMap: Record<string, string[]> = {};

  // Build connection map from edges
  for (const edge of graph.edges || []) {
    if (!edgeMap[edge.from]) edgeMap[edge.from] = [];
    if (!edgeMap[edge.to]) edgeMap[edge.to] = [];
    edgeMap[edge.from].push(edge.to);
    edgeMap[edge.to].push(edge.from);
  }

  // Convert nodes
  const total = (graph.nodes || []).length || 1;
  for (let i = 0; i < (graph.nodes || []).length; i++) {
    const n = graph.nodes[i];
    const angle = (i / total) * Math.PI * 2;
    nodes.push({
      id: n.id,
      label: n.label || n.id,
      type: mapNodeType(n.type),
      x: 400 + Math.cos(angle) * 200 + Math.random() * 40,
      y: 300 + Math.sin(angle) * 200 + Math.random() * 40,
      vx: 0,
      vy: 0,
      connections: [...new Set(edgeMap[n.id] || [])],
    });
  }

  return nodes;
}

function mapNodeType(type: string): "phone" | "url" | "company" | "report" {
  if (type === "phone_number" || type === "PhoneNumber") return "phone";
  if (type === "url" || type === "URL" || type === "email_address" || type === "EmailAddress") return "url";
  if (type === "company_name" || type === "CompanyImpersonated") return "company";
  return "report";
}

// ── Neo4j DateTime Helper ──────────────────────────────────

function formatNeo4jDateTime(value: unknown): string {
  if (!value) return "";
  if (typeof value === "string") return value;
  // Neo4j driver returns DateTime objects with _DateTime__date and _DateTime__time
  const dt = value as Record<string, unknown>;
  if (dt._DateTime__date && dt._DateTime__time) {
    const d = dt._DateTime__date as Record<string, { low?: number }>;
    const t = dt._DateTime__time as Record<string, { low?: number }>;
    const year = d.year?.low ?? d.year;
    const month = String(d.month?.low ?? d.month).padStart(2, "0");
    const day = String(d.day?.low ?? d.day).padStart(2, "0");
    const hour = String(t.hour?.low ?? t.hour ?? 0).padStart(2, "0");
    const minute = String(t.minute?.low ?? t.minute ?? 0).padStart(2, "0");
    return `${year}-${month}-${day} ${hour}:${minute}`;
  }
  return String(value);
}

// ── Threat Feed Adapter ────────────────────────────────────

export function adaptThreatsToFeed(threats: BackendThreat[]): ThreatFeedItem[] {
  return threats.map((t, i) => ({
    id: `t-${i}`,
    type: mapEntityTypeToThreatType(t.entityType),
    source: "GuardianEye Network",
    time: formatNeo4jDateTime(t.firstSeen) || "Recently",
    severity: (t.reports > 10 ? "high" : t.reports > 3 ? "medium" : "low") as "high" | "medium" | "low",
    description: `${t.entity} — reported ${t.reports} times across the scam network`,
  }));
}

function mapEntityTypeToThreatType(type: string): string {
  const map: Record<string, string> = {
    PhoneNumber: "Phone Scam",
    URL: "Phishing Site",
    CompanyImpersonated: "Brand Impersonation",
    EmailAddress: "Email Scam",
    DollarAmount: "Financial Fraud",
  };
  return map[type] || "Threat";
}
