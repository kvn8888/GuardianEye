/**
 * GuardianEye API client — connects the frontend to the FastAPI backend.
 * In dev, the Vite proxy rewrites /api/* to localhost:8000.
 * In production, API_BASE points to the deployed backend on Render.
 */

const API_BASE = import.meta.env.VITE_API_BASE ?? "";
const MAX_UPLOAD_IMAGE_BYTES = 1_500_000;
const MAX_UPLOAD_IMAGE_DIMENSION = 1600;
const UPLOAD_IMAGE_QUALITY = 0.82;

// ── Types from the backend ─────────────────────────────────

export interface BackendVerdict {
  level: "RED" | "YELLOW" | "GREEN" | "pending";
  confidence: number; // 0.0 - 1.0
  explanation: string;
  scam_type: string;
  red_flags: string[];
  recommended_action?: string;
  should_alert_family?: boolean;
}

export interface BackendEntity {
  text: string;
  label: string;
  score: number;
}

export interface BackendScanResult {
  scan_id: string;
  status: string;
  verdict?: BackendVerdict;
  visual?: Record<string, any>;
  voice?: Record<string, any>;
  entities?: BackendEntity[];
  type?: string;
}

export interface BackendGraphData {
  nodes: { id: string; label: string; type: string; verdict?: string; reportCount?: number }[];
  edges: { from: string; to: string; label: string }[];
  total_reports?: number;
}

export interface BackendThreat {
  entity: string;
  entityType: string;
  reports: number;
  firstSeen: string;
}

// ── Scan Submission ────────────────────────────────────────

async function optimizeImageForUpload(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) return file;
  if (file.type === "image/svg+xml") return file;

  try {
    const image = await loadImage(file);
    const scale = Math.min(
      1,
      MAX_UPLOAD_IMAGE_DIMENSION / image.width,
      MAX_UPLOAD_IMAGE_DIMENSION / image.height,
    );

    const needsResize = scale < 1;
    const shouldReencode = needsResize || file.size > MAX_UPLOAD_IMAGE_BYTES;
    if (!shouldReencode) return file;

    const width = Math.max(1, Math.round(image.width * scale));
    const height = Math.max(1, Math.round(image.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d");
    if (!ctx) return file;

    ctx.drawImage(image, 0, 0, width, height);

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, "image/jpeg", UPLOAD_IMAGE_QUALITY);
    });

    if (!blob) return file;
    if (blob.size >= file.size && !needsResize) return file;

    const name = file.name.replace(/\.[^.]+$/, "") || "upload";
    return new File([blob], `${name}.jpg`, {
      type: "image/jpeg",
      lastModified: file.lastModified,
    });
  } catch {
    return file;
  }
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Image load failed"));
    };
    image.src = url;
  });
}

export async function submitImageScan(file: File): Promise<{ scan_id: string }> {
  const uploadFile = await optimizeImageForUpload(file);
  const fd = new FormData();
  fd.append("image", uploadFile);
  const res = await fetch(`${API_BASE}/api/scan/image`, { method: "POST", body: fd });
  if (!res.ok) throw new Error(`Image scan failed: ${res.status}`);
  return res.json();
}

export async function submitVoiceScan(file: File): Promise<{ scan_id: string }> {
  const fd = new FormData();
  fd.append("audio", file);
  const res = await fetch(`${API_BASE}/api/scan/voice`, { method: "POST", body: fd });
  if (!res.ok) throw new Error(`Voice scan failed: ${res.status}`);
  return res.json();
}

export async function submitTextScan(text: string): Promise<{ scan_id: string }> {
  const res = await fetch(`${API_BASE}/api/scan/text`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) throw new Error(`Text scan failed: ${res.status}`);
  return res.json();
}

// ── SSE Status Stream ──────────────────────────────────────

export interface ScanEvent {
  event: string;
  data: Record<string, any>;
}

/**
 * Subscribe to real-time scan events via SSE.
 * Returns a cleanup function.
 */
export function subscribeScanStatus(
  scanId: string,
  onEvent: (ev: ScanEvent) => void,
  onComplete: () => void,
  onError?: (err: Event) => void,
): () => void {
  const sse = new EventSource(`${API_BASE}/api/scan/${scanId}/status`);

  const eventTypes = [
    "scan_started", "step", "reka_complete", "voice_complete",
    "gliner_complete", "tavily_complete", "yutori_complete",
    "verdict", "complete",
  ];

  for (const type of eventTypes) {
    sse.addEventListener(type, (ev) => {
      try {
        const data = JSON.parse((ev as MessageEvent).data);
        onEvent({ event: type, data });
        if (type === "complete") {
          sse.close();
          onComplete();
        }
      } catch {}
    });
  }

  sse.onmessage = (ev) => {
    try {
      const data = JSON.parse(ev.data);
      onEvent({ event: "message", data });
    } catch {}
  };

  sse.onerror = (err) => {
    sse.close();
    onError?.(err);
    onComplete();
  };

  return () => sse.close();
}

// ── Scan Results ───────────────────────────────────────────

export async function getScanVerdict(scanId: string): Promise<BackendScanResult | null> {
  try {
    const res = await fetch(`${API_BASE}/api/scan/${scanId}/verdict`);
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function listScans(): Promise<BackendScanResult[]> {
  try {
    const res = await fetch(`${API_BASE}/api/scans`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.scans || [];
  } catch {
    return [];
  }
}

// ── Graph ──────────────────────────────────────────────────

export async function getEntityNetwork(entity: string): Promise<BackendGraphData> {
  try {
    const res = await fetch(`${API_BASE}/api/graph/network/${encodeURIComponent(entity)}`);
    if (!res.ok) return { nodes: [], edges: [] };
    return res.json();
  } catch {
    return { nodes: [], edges: [] };
  }
}

export async function getScanGraph(scanId: string): Promise<BackendGraphData> {
  try {
    const res = await fetch(`${API_BASE}/api/graph/${scanId}`);
    if (!res.ok) return { nodes: [], edges: [] };
    return res.json();
  } catch {
    return { nodes: [], edges: [] };
  }
}

export async function getGraphOverview(): Promise<BackendGraphData> {
  try {
    const res = await fetch(`${API_BASE}/api/graph/overview`);
    if (!res.ok) return { nodes: [], edges: [] };
    return res.json();
  } catch {
    return { nodes: [], edges: [] };
  }
}

// ── Threats + Scouting ─────────────────────────────────────

export async function getRecentThreats(limit = 20): Promise<{ threats: BackendThreat[]; count: number }> {
  try {
    const res = await fetch(`${API_BASE}/api/threats/recent?limit=${limit}`);
    if (!res.ok) return { threats: [], count: 0 };
    return res.json();
  } catch {
    return { threats: [], count: 0 };
  }
}

export async function getScoutStatus(): Promise<{ active_scouts: any[]; count: number }> {
  try {
    const res = await fetch(`${API_BASE}/api/scout/status`);
    if (!res.ok) return { active_scouts: [], count: 0 };
    return res.json();
  } catch {
    return { active_scouts: [], count: 0 };
  }
}

export async function createScout(): Promise<any> {
  const res = await fetch(`${API_BASE}/api/scout/create`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  return res.json();
}

export async function alertFamily(scanId: string, message: string): Promise<any> {
  const res = await fetch(`${API_BASE}/api/alert/family`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ scan_id: scanId, message }),
  });
  return res.json();
}

export async function checkHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/health`, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return false;
    const data = await res.json();
    return data.status === "ok";
  } catch {
    return false;
  }
}
