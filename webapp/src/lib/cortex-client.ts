/**
 * Cortex HTTP API client
 *
 * Connects to a running Cortex server (default: http://localhost:9091)
 * and provides typed access to nodes, edges, search, briefings, trust, and SSE events.
 */

import type { CortexNode, CortexEdge, CortexData } from "@/lib/types/cortex";

const CORTEX_DIRECT =
  process.env.NEXT_PUBLIC_CORTEX_URL ?? "http://localhost:9091";

// REST calls go through Next.js API proxy (handles SSR + avoids mixed-content).
// Must be absolute so `new URL(...)` works for query-param builders.
const BASE_URL =
  typeof window !== "undefined"
    ? `${window.location.origin}/api/cortex`
    : (process.env.CORTEX_BACKEND_URL ?? CORTEX_DIRECT);

// SSE (EventSource) connects directly to Cortex — the proxy can't relay
// long-lived streaming responses. CORS on the Cortex server allows this.
const SSE_URL =
  typeof window !== "undefined"
    ? CORTEX_DIRECT
    : CORTEX_DIRECT;

// ---------- Health & Stats ----------

export interface CortexHealth {
  healthy: boolean;
  version: string;
  uptime_seconds: number;
  stats: { node_count: number; edge_count: number };
}

export async function getHealth(): Promise<CortexHealth> {
  const res = await fetch(`${BASE_URL}/health`);
  if (!res.ok) throw new Error(`Cortex /health failed: ${res.status}`);
  return res.json();
}

export async function getStats(): Promise<{ node_count: number; edge_count: number }> {
  const res = await fetch(`${BASE_URL}/stats`);
  if (!res.ok) throw new Error(`Cortex /stats failed: ${res.status}`);
  const json = await res.json();
  return json.data ?? json;
}

// ---------- Nodes ----------

export interface ListNodesParams {
  kind?: string;
  agent?: string;
  limit?: number;
  offset?: number;
}

export async function listNodes(params: ListNodesParams = {}): Promise<CortexNode[]> {
  const url = new URL(`${BASE_URL}/nodes`);
  if (params.kind) url.searchParams.set("kind", params.kind);
  if (params.agent) url.searchParams.set("agent", params.agent);
  if (params.limit) url.searchParams.set("limit", String(params.limit));
  if (params.offset) url.searchParams.set("offset", String(params.offset));
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`Cortex /nodes failed: ${res.status}`);
  const json = await res.json();
  return normalizeNodes(json.data ?? json.nodes ?? json);
}

export async function getNode(id: string): Promise<CortexNode> {
  const res = await fetch(`${BASE_URL}/nodes/${id}`);
  if (!res.ok) throw new Error(`Cortex /nodes/${id} failed: ${res.status}`);
  const json = await res.json();
  return normalizeNode(json.data ?? json);
}

export async function getNeighbors(
  id: string,
  opts: { depth?: number; direction?: "both" | "outgoing" | "incoming" } = {}
): Promise<CortexNode[]> {
  const url = new URL(`${BASE_URL}/nodes/${id}/neighbors`);
  if (opts.depth) url.searchParams.set("depth", String(opts.depth));
  if (opts.direction) url.searchParams.set("direction", opts.direction);
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`Cortex neighbors failed: ${res.status}`);
  const json = await res.json();
  return normalizeNodes(json.data ?? json);
}

// ---------- Search ----------

export async function searchCortex(
  q: string,
  opts: { limit?: number; kind?: string } = {}
): Promise<CortexNode[]> {
  const url = new URL(`${BASE_URL}/search`);
  url.searchParams.set("q", q);
  if (opts.limit) url.searchParams.set("limit", String(opts.limit));
  if (opts.kind) url.searchParams.set("kind", opts.kind);
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`Cortex /search failed: ${res.status}`);
  const json = await res.json();
  const raw = json.data ?? json.nodes ?? json;
  // Cortex search returns { node: {...}, score, raw_score } wrappers — unwrap them
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const unwrapped = Array.isArray(raw) ? raw.map((r: any) => r.node ?? r) : raw;
  return normalizeNodes(unwrapped);
}

// ---------- Graph Export ----------

export async function exportGraph(): Promise<CortexData> {
  const res = await fetch(`${BASE_URL}/graph/export`);
  if (!res.ok) throw new Error(`Cortex /graph/export failed: ${res.status}`);
  const json = await res.json();
  const raw = json.data ?? json;
  return {
    nodes: normalizeNodes(raw.nodes ?? []),
    edges: normalizeEdges(raw.edges ?? []),
  };
}

// ---------- Briefing ----------

export async function getBriefing(
  agentId: string,
  opts: { scope?: "agent" | "shared"; max_tokens?: number } = {}
): Promise<string> {
  const url = new URL(`${BASE_URL}/briefing/${agentId}`);
  if (opts.scope) url.searchParams.set("scope", opts.scope);
  if (opts.max_tokens) url.searchParams.set("max_tokens", String(opts.max_tokens));
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`Cortex /briefing failed: ${res.status}`);
  const json = await res.json();
  return json.data ?? json.briefing ?? JSON.stringify(json);
}

// ---------- Trust ----------

export interface TrustScore {
  node_id: string;
  trust_score: number;
  signals: {
    corroboration: number;
    contradiction: number;
    source_reliability: number;
    access_reinforcement: number;
    freshness: number;
  };
}

export async function getTrust(nodeId: string): Promise<TrustScore> {
  const res = await fetch(`${BASE_URL}/trust/${nodeId}`);
  if (!res.ok) throw new Error(`Cortex /trust failed: ${res.status}`);
  const json = await res.json();
  return json.data ?? json;
}

// ---------- SSE Events ----------

export interface CortexSSEEvent {
  event_type: string;
  timestamp: string;
  data: Record<string, unknown>;
}

export function subscribeEvents(
  onEvent: (event: CortexSSEEvent) => void,
  eventTypes?: string[]
): () => void {
  const url = new URL(`${SSE_URL}/events/stream`);
  if (eventTypes?.length) url.searchParams.set("events", eventTypes.join(","));

  const source = new EventSource(url.toString());

  const eventNames = eventTypes ?? [
    "node.created", "node.updated", "node.deleted",
    "edge.created", "edge.updated", "edge.deleted",
  ];

  for (const name of eventNames) {
    source.addEventListener(name, (e: MessageEvent) => {
      try {
        onEvent(JSON.parse(e.data));
      } catch {
        // ignore parse errors
      }
    });
  }

  source.addEventListener("message", (e: MessageEvent) => {
    try {
      onEvent(JSON.parse(e.data));
    } catch {
      // ignore
    }
  });

  return () => source.close();
}

// ---------- Normalizers ----------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeNode(raw: any): CortexNode {
  return {
    id: raw.id ?? "",
    kind: raw.kind ?? "fact",
    title: raw.title ?? raw.name ?? "(untitled)",
    tags: raw.tags ?? raw.metadata?.tags ?? [],
    importance: raw.importance ?? 0.5,
    edges: raw.edges ?? raw.edge_count ?? 0,
    body: raw.body ?? raw.content ?? raw.metadata?.body ?? undefined,
    agent: raw.agent ?? raw.metadata?.agent ?? undefined,
    created_at: raw.created_at ?? undefined,
    updated_at: raw.updated_at ?? undefined,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeNodes(raw: any[]): CortexNode[] {
  if (!Array.isArray(raw)) return [];
  return raw.map(normalizeNode);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeEdge(raw: any): CortexEdge {
  return {
    source: raw.source ?? raw.from ?? "",
    target: raw.target ?? raw.to ?? "",
    weight: raw.weight ?? raw.strength ?? 0.5,
    relation: raw.relation ?? raw.type ?? "related_to",
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeEdges(raw: any[]): CortexEdge[] {
  if (!Array.isArray(raw)) return [];
  return raw.map(normalizeEdge);
}
