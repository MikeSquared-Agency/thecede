/**
 * WebMCP integration for thecede
 *
 * Registers imperative tools via navigator.modelContext so that
 * AI agents (in WebMCP-capable browsers) can interact with the
 * knowledge graph programmatically.
 *
 * Tools:
 *   - search_knowledge_graph:  Vector + text search across nodes
 *   - list_nodes:              List nodes, optionally filtered by kind
 *   - get_node_details:        Get full details for a specific node
 *   - filter_graph_view:       Set the active kind filter in the UI
 *   - get_graph_stats:         Return graph statistics
 *   - connect_to_server:       Connect/reconnect to the Cortex server
 *
 * @see https://developer.chrome.com/blog/webmcp-epp
 */

import { useGraphStore } from "@/lib/stores/graphStore";
import {
  searchCortex,
  listNodes,
  getNode,
  getTrust,
  getBriefing,
  getStats,
} from "@/lib/cortex-client";

// ─── Tool tracking ──────────────────────────────────────────────

const registeredTools: Record<string, boolean> = {};

function isWebMCPAvailable(): boolean {
  return typeof navigator !== "undefined" && !!navigator.modelContext;
}

// ─── Tool: search_knowledge_graph ───────────────────────────────

const searchKnowledgeGraphTool: ModelContextTool = {
  name: "search_knowledge_graph",
  description:
    "Search the Cortex knowledge graph using vector similarity and text matching. " +
    "Returns nodes that best match the query, ranked by relevance.",
  inputSchema: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "The search query — natural language or keywords.",
      },
      limit: {
        type: "number",
        description: "Maximum number of results to return (default 10, max 50).",
      },
      kind: {
        type: "string",
        description:
          "Optional node kind filter (e.g. 'fact', 'document', 'entity', 'task').",
      },
    },
    required: ["query"],
  },
  outputSchema: {
    type: "object",
    properties: {
      results: {
        type: "array",
        description: "Matching nodes sorted by relevance.",
        items: {
          type: "object",
          properties: {
            id: { type: "string" },
            kind: { type: "string" },
            title: { type: "string" },
            importance: { type: "number" },
            tags: { type: "array", items: { type: "string" } },
            body: { type: "string" },
          },
          required: ["id", "kind", "title"],
        },
      },
      count: { type: "number", description: "Number of results returned." },
    },
    required: ["results", "count"],
  },
  annotations: { readOnlyHint: true },
  execute: async (input) => {
    const query = String(input.query ?? "");
    const limit = Math.min(Number(input.limit ?? 10), 50);
    const kind = input.kind ? String(input.kind) : undefined;

    if (!query.trim()) {
      return { results: [], count: 0, error: "Query must not be empty." };
    }

    try {
      const nodes = await searchCortex(query, { limit, kind });
      // Also update the UI search results
      useGraphStore.getState().setSearchQuery(query);
      useGraphStore.getState().setSearchResults(nodes);

      return {
        results: nodes.map((n) => ({
          id: n.id,
          kind: n.kind,
          title: n.title,
          importance: n.importance,
          tags: n.tags,
          body: n.body,
        })),
        count: nodes.length,
      };
    } catch (err) {
      // Fall back to client-side search
      const { graphData } = useGraphStore.getState();
      const q = query.toLowerCase();
      const results = graphData.nodes
        .filter(
          (n) =>
            n.title.toLowerCase().includes(q) ||
            n.tags.some((t) => t.includes(q))
        )
        .sort((a, b) => b.importance - a.importance)
        .slice(0, limit);

      useGraphStore.getState().setSearchResults(results);

      return {
        results: results.map((n) => ({
          id: n.id,
          kind: n.kind,
          title: n.title,
          importance: n.importance,
          tags: n.tags,
          body: n.body,
        })),
        count: results.length,
        fallback: true,
        error: err instanceof Error ? err.message : "Search failed",
      };
    }
  },
};

// ─── Tool: list_nodes ───────────────────────────────────────────

const listNodesTool: ModelContextTool = {
  name: "list_nodes",
  description:
    "List nodes from the knowledge graph, optionally filtered by kind. " +
    "Returns basic metadata for each node.",
  inputSchema: {
    type: "object",
    properties: {
      kind: {
        type: "string",
        description:
          "Filter by node kind (e.g. 'fact', 'document', 'entity', 'task', 'rule', 'pattern').",
      },
      limit: {
        type: "number",
        description: "Max nodes to return (default 20, max 100).",
      },
      offset: {
        type: "number",
        description: "Pagination offset (default 0).",
      },
    },
  },
  outputSchema: {
    type: "object",
    properties: {
      nodes: {
        type: "array",
        items: {
          type: "object",
          properties: {
            id: { type: "string" },
            kind: { type: "string" },
            title: { type: "string" },
            importance: { type: "number" },
            tags: { type: "array", items: { type: "string" } },
          },
          required: ["id", "kind", "title"],
        },
      },
      count: { type: "number" },
    },
    required: ["nodes", "count"],
  },
  annotations: { readOnlyHint: true },
  execute: async (input) => {
    const kind = input.kind ? String(input.kind) : undefined;
    const limit = Math.min(Number(input.limit ?? 20), 100);
    const offset = Number(input.offset ?? 0);

    try {
      const nodes = await listNodes({ kind, limit, offset });
      return {
        nodes: nodes.map((n) => ({
          id: n.id,
          kind: n.kind,
          title: n.title,
          importance: n.importance,
          tags: n.tags,
        })),
        count: nodes.length,
      };
    } catch {
      // Fall back to store data
      const { graphData } = useGraphStore.getState();
      let filtered = graphData.nodes;
      if (kind) filtered = filtered.filter((n) => n.kind === kind);
      const sliced = filtered.slice(offset, offset + limit);
      return {
        nodes: sliced.map((n) => ({
          id: n.id,
          kind: n.kind,
          title: n.title,
          importance: n.importance,
          tags: n.tags,
        })),
        count: sliced.length,
      };
    }
  },
};

// ─── Tool: get_node_details ─────────────────────────────────────

const getNodeDetailsTool: ModelContextTool = {
  name: "get_node_details",
  description:
    "Get full details for a specific node by ID, including body content, " +
    "trust score, tags, and metadata.",
  inputSchema: {
    type: "object",
    properties: {
      node_id: {
        type: "string",
        description: "The unique node ID to look up.",
      },
    },
    required: ["node_id"],
  },
  outputSchema: {
    type: "object",
    properties: {
      id: { type: "string" },
      kind: { type: "string" },
      title: { type: "string" },
      body: { type: "string" },
      importance: { type: "number" },
      tags: { type: "array", items: { type: "string" } },
      edges: { type: "number" },
      agent: { type: "string" },
      created_at: { type: "string" },
      updated_at: { type: "string" },
      trust: {
        type: "object",
        properties: {
          trust_score: { type: "number" },
          signals: { type: "object" },
        },
      },
    },
    required: ["id", "kind", "title"],
  },
  annotations: { readOnlyHint: true },
  execute: async (input) => {
    const nodeId = String(input.node_id ?? "");
    if (!nodeId) return { error: "node_id is required." };

    try {
      const node = await getNode(nodeId);
      // Also select it in the UI
      useGraphStore.getState().selectNode(node);

      let trust = null;
      try {
        trust = await getTrust(nodeId);
      } catch {
        // Trust endpoint may not be available
      }

      return {
        id: node.id,
        kind: node.kind,
        title: node.title,
        body: node.body,
        importance: node.importance,
        tags: node.tags,
        edges: node.edges,
        agent: node.agent,
        created_at: node.created_at,
        updated_at: node.updated_at,
        trust: trust
          ? {
              trust_score: trust.trust_score,
              signals: trust.signals,
            }
          : undefined,
      };
    } catch (err) {
      // Fall back to store data
      const { graphData } = useGraphStore.getState();
      const node = graphData.nodes.find((n) => n.id === nodeId);
      if (!node) return { error: `Node "${nodeId}" not found.` };

      useGraphStore.getState().selectNode(node);
      return {
        id: node.id,
        kind: node.kind,
        title: node.title,
        body: node.body,
        importance: node.importance,
        tags: node.tags,
        edges: node.edges,
        agent: node.agent,
      };
    }
  },
};

// ─── Tool: filter_graph_view ────────────────────────────────────

const filterGraphViewTool: ModelContextTool = {
  name: "filter_graph_view",
  description:
    "Filter the graph visualization to show only nodes of a specific kind. " +
    "Use 'all' to remove the filter and show everything.",
  inputSchema: {
    type: "object",
    properties: {
      kind: {
        type: "string",
        description:
          "Node kind to filter by (e.g. 'fact', 'document', 'entity'), or 'all' to show all.",
      },
    },
    required: ["kind"],
  },
  outputSchema: {
    type: "object",
    properties: {
      active_filter: { type: "string" },
      visible_nodes: { type: "number" },
      total_nodes: { type: "number" },
    },
    required: ["active_filter", "visible_nodes", "total_nodes"],
  },
  annotations: { readOnlyHint: false },
  execute: async (input) => {
    const kind = String(input.kind ?? "all");
    const store = useGraphStore.getState();

    store.setFilter(kind);

    const total = store.graphData.nodes.length;
    const visible =
      kind === "all"
        ? total
        : store.graphData.nodes.filter((n) => n.kind === kind).length;

    return {
      active_filter: kind,
      visible_nodes: visible,
      total_nodes: total,
    };
  },
};

// ─── Tool: get_graph_stats ──────────────────────────────────────

const getGraphStatsTool: ModelContextTool = {
  name: "get_graph_stats",
  description:
    "Get statistics about the knowledge graph including node count, edge count, " +
    "available kinds, and server health.",
  inputSchema: {},
  outputSchema: {
    type: "object",
    properties: {
      connected: { type: "boolean" },
      server_version: { type: "string" },
      node_count: { type: "number" },
      edge_count: { type: "number" },
      kinds: {
        type: "array",
        items: { type: "string" },
        description: "All node kinds present in the graph.",
      },
      kind_counts: {
        type: "object",
        description: "Count of nodes per kind.",
      },
    },
    required: ["connected", "node_count", "edge_count"],
  },
  annotations: { readOnlyHint: true },
  execute: async () => {
    const store = useGraphStore.getState();

    // Try server-side stats first
    let serverStats = null;
    try {
      serverStats = await getStats();
    } catch {
      // Use store data
    }

    const kindCounts: Record<string, number> = {};
    store.graphData.nodes.forEach((n) => {
      kindCounts[n.kind] = (kindCounts[n.kind] ?? 0) + 1;
    });

    return {
      connected: store.status === "connected",
      server_version: store.serverInfo?.version ?? "unknown",
      node_count: serverStats?.node_count ?? store.graphData.nodes.length,
      edge_count: serverStats?.edge_count ?? store.graphData.edges.length,
      kinds: store.kinds,
      kind_counts: kindCounts,
    };
  },
};

// ─── Tool: connect_to_server ────────────────────────────────────

const connectToServerTool: ModelContextTool = {
  name: "connect_to_server",
  description:
    "Connect or reconnect to the Cortex server. " +
    "Call this if the graph explorer is disconnected or in an error state.",
  inputSchema: {},
  outputSchema: {
    type: "object",
    properties: {
      status: {
        type: "string",
        enum: ["connected", "error"],
      },
      server_version: { type: "string" },
      node_count: { type: "number" },
      error: { type: "string" },
    },
    required: ["status"],
  },
  annotations: { readOnlyHint: false },
  execute: async () => {
    const store = useGraphStore.getState();

    try {
      await store.connect();

      // Re-read state after connection
      const updated = useGraphStore.getState();
      return {
        status: updated.status,
        server_version: updated.serverInfo?.version,
        node_count: updated.graphData.nodes.length,
      };
    } catch (err) {
      return {
        status: "error",
        error: err instanceof Error ? err.message : "Connection failed",
      };
    }
  },
};

// ─── Tool: get_briefing ─────────────────────────────────────────

const getBriefingTool: ModelContextTool = {
  name: "get_agent_briefing",
  description:
    "Get a context briefing for an AI agent. Returns a structured summary of " +
    "relevant knowledge organized by roles (identity, persistent, temporal, etc.).",
  inputSchema: {
    type: "object",
    properties: {
      agent_id: {
        type: "string",
        description: "The agent ID to generate a briefing for.",
      },
      scope: {
        type: "string",
        enum: ["agent", "shared"],
        description:
          "Briefing scope — 'agent' for agent-specific, 'shared' for cross-agent knowledge.",
      },
    },
    required: ["agent_id"],
  },
  outputSchema: {
    type: "object",
    properties: {
      briefing: { type: "string", description: "The formatted briefing text." },
    },
    required: ["briefing"],
  },
  annotations: { readOnlyHint: true },
  execute: async (input) => {
    const agentId = String(input.agent_id ?? "");
    if (!agentId) return { error: "agent_id is required." };

    const scope = (input.scope as "agent" | "shared") ?? undefined;

    try {
      const briefing = await getBriefing(agentId, { scope });
      return { briefing };
    } catch (err) {
      return {
        error: err instanceof Error ? err.message : "Failed to get briefing",
      };
    }
  },
};

// ─── All tools ──────────────────────────────────────────────────

const ALL_TOOLS: ModelContextTool[] = [
  searchKnowledgeGraphTool,
  listNodesTool,
  getNodeDetailsTool,
  filterGraphViewTool,
  getGraphStatsTool,
  connectToServerTool,
  getBriefingTool,
];

// ─── Registration ───────────────────────────────────────────────

export function registerWebMCPTools(): void {
  if (!isWebMCPAvailable()) return;

  const mc = navigator.modelContext!;
  for (const tool of ALL_TOOLS) {
    if (!registeredTools[tool.name]) {
      mc.registerTool(tool);
      registeredTools[tool.name] = true;
    }
  }

  if (process.env.NODE_ENV === "development") {
    console.log(
      `[thecede] WebMCP: registered ${ALL_TOOLS.length} tools`,
      ALL_TOOLS.map((t) => t.name)
    );
  }
}

export function unregisterWebMCPTools(): void {
  if (!isWebMCPAvailable()) return;

  const mc = navigator.modelContext!;
  for (const tool of ALL_TOOLS) {
    if (registeredTools[tool.name]) {
      mc.unregisterTool(tool.name);
      registeredTools[tool.name] = false;
    }
  }
}

/** Check if WebMCP is supported in the current browser. */
export function isWebMCPSupported(): boolean {
  return isWebMCPAvailable();
}

/** Get the list of registered tool names. */
export function getRegisteredToolNames(): string[] {
  return Object.entries(registeredTools)
    .filter(([, v]) => v)
    .map(([k]) => k);
}
