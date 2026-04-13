/**
 * Server-side Cortex HTTP client for tool implementations.
 * Mirrors the Python cortex_client.py used by the MCP server.
 */

const CORTEX_URL =
  process.env.CORTEX_BACKEND_URL ??
  process.env.NEXT_PUBLIC_CORTEX_URL ??
  "http://localhost:9091";

// ── Metadata handling ──────────────────────────────────────────────────────

const META_RE = /^<!--META:([\s\S]*?):META-->\n?/;

export function extractMetadata(body: string): [Record<string, string>, string] {
  const m = body.match(META_RE);
  if (m) {
    try {
      const meta = JSON.parse(m[1]);
      return [meta, body.slice(m[0].length)];
    } catch { /* ignore */ }
  }
  return [{}, body];
}

function normalizeKind(kind: string): string {
  return kind.replace(/(?<!^)([A-Z])/g, "-$1").toLowerCase();
}

export function cleanBody(node: { body?: string }): string {
  const [, clean] = extractMetadata(node.body ?? "");
  return clean;
}

export function nodeMeta(node: { body?: string }): Record<string, string> {
  const [meta] = extractMetadata(node.body ?? "");
  return meta;
}

// ── Section extraction (XML-ish cortex profile) ────────────────────────────

export function extractSection(xml: string, name: string): string | null {
  const re = new RegExp(`<${name}>([\\s\\S]*?)</${name}>`);
  const m = xml.match(re);
  return m ? m[1].trim() : null;
}

export function listSections(xml: string): string[] {
  const skip = new Set(["judge_cortex", "xml", "br", "p", "div"]);
  const seen = new Set<string>();
  const sections: string[] = [];
  for (const m of xml.matchAll(/<(\w+)>/g)) {
    const name = m[1];
    if (!skip.has(name) && !seen.has(name)) {
      seen.add(name);
      sections.push(name);
    }
  }
  return sections;
}

// ── HTTP helpers ───────────────────────────────────────────────────────────

interface CortexNode {
  id: string;
  kind: string;
  title: string;
  body: string;
  tags: string[];
  [key: string]: unknown;
}

interface SearchResult {
  node: CortexNode;
  score: number;
}

async function unwrap(resp: Response): Promise<unknown> {
  if (!resp.ok) throw new Error(`Cortex ${resp.status}: ${resp.statusText}`);
  const json = await resp.json();
  if (json.success === false) throw new Error(`Cortex error: ${json.error ?? "unknown"}`);
  return json.data;
}

export async function listNodes(
  kind?: string,
  tag?: string,
  limit = 100
): Promise<CortexNode[]> {
  const params = new URLSearchParams({ limit: String(limit) });
  if (kind) params.set("kind", kind);
  if (tag) params.set("tag", tag);
  const resp = await fetch(`${CORTEX_URL}/nodes?${params}`);
  const data = (await unwrap(resp)) as CortexNode[] | null;
  return (data ?? []).map((n) => ({ ...n, kind: normalizeKind(n.kind) }));
}

export async function searchNodes(query: string, limit = 10): Promise<SearchResult[]> {
  const params = new URLSearchParams({ q: query, limit: String(limit) });
  const resp = await fetch(`${CORTEX_URL}/search?${params}`);
  const data = (await unwrap(resp)) as SearchResult[] | null;
  return (data ?? []).map((r) => ({
    ...r,
    node: { ...r.node, kind: normalizeKind(r.node.kind) },
  }));
}

export async function searchByKind(
  query: string,
  kind: string,
  limit = 10
): Promise<SearchResult[]> {
  const overFetch = Math.min(Math.max(limit * 20, 200), 500);
  const results = await searchNodes(query, overFetch);
  const filtered = results.filter((r) => r.node.kind === kind);
  if (filtered.length >= limit) return filtered.slice(0, limit);

  // Supplement with keyword matching
  const all = await listNodes(kind, undefined, 500);
  const seenIds = new Set(filtered.map((r) => r.node.id));
  const words = new Set(query.toLowerCase().split(/\s+/));
  const scored: SearchResult[] = [];
  for (const node of all) {
    if (seenIds.has(node.id)) continue;
    const text = `${node.title} ${(node.body ?? "").slice(0, 1000)}`.toLowerCase();
    const hits = [...words].filter((w) => text.includes(w)).length;
    if (hits > 0) scored.push({ node, score: hits / Math.max(words.size, 1) });
  }
  scored.sort((a, b) => b.score - a.score);
  return [...filtered, ...scored].slice(0, limit);
}

export async function getNeighbors(
  nodeId: string,
  depth = 1
): Promise<CortexNode[]> {
  const params = new URLSearchParams({ depth: String(depth) });
  const resp = await fetch(`${CORTEX_URL}/nodes/${nodeId}/neighbors?${params}`);
  const data = (await unwrap(resp)) as CortexNode[] | null;
  return (data ?? []).map((n) => ({ ...n, kind: normalizeKind(n.kind) }));
}

// ── Judge resolution ───────────────────────────────────────────────────────

export async function resolveJudge(name: string): Promise<CortexNode | null> {
  const judges = await listNodes("judge", undefined, 50);
  const lower = name.toLowerCase();
  const found = judges.find((j) => j.title.toLowerCase().includes(lower));
  if (found) return found;

  const results = await searchNodes(name, 5);
  for (const r of results) {
    if (r.node.kind === "judge" && r.node.title.toLowerCase().includes(lower)) {
      return r.node;
    }
  }
  return null;
}

export async function resolveJudgeCortex(
  name: string
): Promise<[CortexNode | null, string | null]> {
  const judge = await resolveJudge(name);
  if (!judge) return [null, null];

  const cortexNodes = await listNodes("judge-cortex", undefined, 5);
  const lastName = name.toLowerCase().split(/\s+/).pop() ?? "";
  for (const node of cortexNodes) {
    if (node.title.toLowerCase().includes(lastName)) {
      return [judge, node.body ?? ""];
    }
  }

  const results = await searchByKind(`${name} cortex profile`, "judge-cortex", 1);
  if (results.length > 0) return [judge, results[0].node.body ?? ""];
  return [judge, null];
}
