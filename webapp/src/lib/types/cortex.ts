/**
 * Cortex graph types — generic, not agent-specific.
 *
 * NodeKind is a string (Cortex uses validated string newtypes, not enums).
 * The "well-known" kinds get colors; unknown kinds get a grey default.
 */

export type NodeKind = string;

export interface CortexNode {
  id: string;
  kind: NodeKind;
  title: string;
  tags: string[];
  importance: number;
  edges: number;
  body?: string;
  agent?: string;
  created_at?: string;
  updated_at?: string;
}

export interface CortexEdge {
  source: string;
  target: string;
  weight: number;
  relation: string;
}

export interface CortexData {
  nodes: CortexNode[];
  edges: CortexEdge[];
}

/** Well-known kind colors. Unknown kinds fall back to grey. */
const WELL_KNOWN_COLORS: Record<string, string> = {
  rule: "#f97316",
  fact: "#eab308",
  document: "#06b6d4",
  task: "#f43f5e",
  pattern: "#a78bfa",
  domain: "#3b82f6",
  tool: "#10b981",
  entity: "#ec4899",
  decision: "#8b5cf6",
  observation: "#14b8a6",
  goal: "#f59e0b",
  memory: "#6366f1",
  skill: "#22d3ee",
};

const DEFAULT_COLOR = "#6b7280";

/** Get color for any node kind. Case-insensitive. */
export function getKindColor(kind: string): string {
  return WELL_KNOWN_COLORS[kind.toLowerCase()] ?? DEFAULT_COLOR;
}

/** Description labels for well-known kinds. */
export const KIND_LABELS: Record<string, string> = {
  rule: "Behavioral rules & constraints",
  fact: "Stored facts & observations",
  document: "Knowledge documents & notes",
  task: "Active tasks & work items",
  pattern: "Recognized patterns",
  domain: "Domain categories",
  tool: "Available tools & integrations",
  entity: "Resolved entities",
  decision: "Decisions & rationale",
  observation: "Agent observations",
  goal: "Goals & objectives",
  memory: "Episodic memories",
  skill: "Learned skills",
};

// Backwards compat — use getKindColor() for new code
export const KIND_COLORS: Record<string, string> = new Proxy(
  {} as Record<string, string>,
  {
    get(_target, prop: string) {
      return getKindColor(prop);
    },
  }
);
