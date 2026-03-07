import type { CortexNode, CortexEdge, NodeKind } from "@/lib/types/cortex";

export function getNodeRadius(importance: number): number {
  return Math.max(4, Math.min(importance * 16, 22));
}

export function filterNodes(nodes: CortexNode[], kind: NodeKind | "all"): CortexNode[] {
  if (kind === "all") return nodes;
  return nodes.filter((n) => n.kind === kind);
}

export function filterEdges(edges: CortexEdge[], nodeIdSet: Set<string>): CortexEdge[] {
  return edges.filter((e) => nodeIdSet.has(e.source) && nodeIdSet.has(e.target));
}

export function searchNodes(nodes: CortexNode[], query: string): CortexNode[] {
  const trimmed = query.trim().toLowerCase();
  if (trimmed.length === 0) return [];

  const terms = trimmed.split(/\s+/);

  const results = nodes.filter((node) => {
    const haystack = `${node.title} ${node.tags.join(" ")} ${node.kind}`.toLowerCase();
    return terms.every((term) => haystack.includes(term));
  });

  results.sort((a, b) => b.importance - a.importance);
  return results.slice(0, 10);
}

export function truncateTitle(title: string, max: number = 26): string {
  if (title.length <= max) return title;
  return title.slice(0, max - 1) + "\u2026";
}
