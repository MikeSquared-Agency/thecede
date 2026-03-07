export type NodeKind = "Rule" | "Fact" | "Document" | "Task" | "Pattern" | "Domain" | "Tool";

export interface CortexNode {
  id: string;
  kind: NodeKind;
  title: string;
  tags: string[];
  importance: number;
  edges: number;
  body?: string;
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

export const KIND_COLORS: Record<NodeKind, string> = {
  Rule: "#f97316",
  Fact: "#eab308",
  Document: "#06b6d4",
  Task: "#f43f5e",
  Pattern: "#a78bfa",
  Domain: "#3b82f6",
  Tool: "#10b981",
};

export const KIND_LABELS: Record<NodeKind, string> = {
  Rule: "Behavioral rules & constraints",
  Fact: "Stored facts",
  Document: "Knowledge documents",
  Task: "Active tasks",
  Pattern: "Recognized patterns",
  Domain: "Domain categories",
  Tool: "Available tools & integrations",
};
