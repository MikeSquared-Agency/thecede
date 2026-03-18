import { create } from "zustand";
import type { CortexNode, CortexData } from "@/lib/types/cortex";
import { exportGraph, getHealth, searchCortex, subscribeEvents } from "@/lib/cortex-client";
import type { CortexHealth, CortexSSEEvent } from "@/lib/cortex-client";

type ConnectionStatus = "disconnected" | "connecting" | "connected" | "error";

export interface ActivityEvent {
  id: number;
  type: string;
  label: string;
  kind?: string;
  color: string;
  timestamp: Date;
}

const EVENT_COLORS: Record<string, string> = {
  "node.created": "#10b981",
  "node.updated": "#3b82f6",
  "node.deleted": "#ef4444",
  "edge.created": "#a78bfa",
  "edge.updated": "#8b5cf6",
  "edge.deleted": "#f97316",
};

let activityIdCounter = 0;

interface GraphState {
  // Connection
  status: ConnectionStatus;
  serverInfo: CortexHealth | null;
  error: string | null;

  // Data
  graphData: CortexData;
  kinds: string[]; // discovered node kinds

  // UI
  activeFilter: string | "all";
  searchQuery: string;
  searchResults: CortexNode[];
  selectedNode: CortexNode | null;
  zoomLevel: number;
  lastEvent: CortexSSEEvent | null;
  activityLog: ActivityEvent[];
  recentEdgeKeys: string[];
}

interface GraphActions {
  // Connection
  connect: () => Promise<void>;
  disconnect: () => void;

  // Data
  loadGraph: () => Promise<void>;
  search: (query: string) => Promise<void>;
  clearSearch: () => void;

  // UI
  setFilter: (filter: string | "all") => void;
  setSearchQuery: (query: string) => void;
  setSearchResults: (results: CortexNode[]) => void;
  selectNode: (node: CortexNode | null) => void;
  setZoomLevel: (level: number) => void;
  reset: () => void;
}

const initialState: GraphState = {
  status: "disconnected",
  serverInfo: null,
  error: null,
  graphData: { nodes: [], edges: [] },
  kinds: [],
  activeFilter: "all",
  searchQuery: "",
  searchResults: [],
  selectedNode: null,
  zoomLevel: 1,
  lastEvent: null,
  activityLog: [],
  recentEdgeKeys: [],
};

let sseCleanup: (() => void) | null = null;

export const useGraphStore = create<GraphState & GraphActions>()((set, get) => ({
  ...initialState,

  connect: async () => {
    set({ status: "connecting", error: null });
    try {
      const health = await getHealth();
      set({ status: "connected", serverInfo: health });

      // Load graph data
      await get().loadGraph();

      // Subscribe to SSE for live updates
      sseCleanup?.();
      sseCleanup = subscribeEvents((event) => {
        set({ lastEvent: event });

        // Build activity log entry
        const evtType = event.event_type ?? "unknown";
        const data = event.data ?? {};
        let label = String(data.title ?? data.name ?? "");
        const kind = String(data.kind ?? "");

        if (evtType.startsWith("edge.")) {
          const srcId = String(data.source ?? data.from ?? "");
          const tgtId = String(data.target ?? data.to ?? "");
          const relation = String(data.relation ?? data.type ?? "");
          const gd = get().graphData;
          const srcNode = gd.nodes.find((n) => n.id === srcId);
          const tgtNode = gd.nodes.find((n) => n.id === tgtId);
          const srcName = srcNode?.title?.slice(0, 20) ?? srcId.slice(0, 8);
          const tgtName = tgtNode?.title?.slice(0, 20) ?? tgtId.slice(0, 8);
          label = relation
            ? `${srcName} \u2500[ ${relation} ]\u2500\u25B8 ${tgtName}`
            : `${srcName} \u2192 ${tgtName}`;
        }

        if (!label) label = String(data.id ?? evtType);

        set((s) => ({
          activityLog: [...s.activityLog.slice(-99), {
            id: ++activityIdCounter,
            type: evtType,
            label,
            kind: kind || undefined,
            color: EVENT_COLORS[evtType] ?? "#6b7280",
            timestamp: new Date(),
          }],
        }));

        // Track recent edges for auto-link animation
        if (evtType === "edge.created") {
          const edgeKey = `${data.source ?? data.from}:${data.target ?? data.to}`;
          set((s) => ({ recentEdgeKeys: [...s.recentEdgeKeys, edgeKey] }));
          setTimeout(() => {
            set((s) => ({ recentEdgeKeys: s.recentEdgeKeys.filter((k) => k !== edgeKey) }));
          }, 3000);
        }

        // Auto-reload on graph mutations
        if (evtType.startsWith("node.") || evtType.startsWith("edge.")) {
          get().loadGraph();
        }
      });
    } catch (err) {
      set({
        status: "error",
        error: err instanceof Error ? err.message : "Failed to connect",
      });
    }
  },

  disconnect: () => {
    sseCleanup?.();
    sseCleanup = null;
    set({ ...initialState });
  },

  loadGraph: async () => {
    try {
      const data = await exportGraph();
      // Discover unique kinds
      const kindSet = new Set<string>();
      data.nodes.forEach((n) => kindSet.add(n.kind));
      const kinds = Array.from(kindSet).sort();

      set({ graphData: data, kinds });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : "Failed to load graph",
      });
    }
  },

  search: async (query: string) => {
    set({ searchQuery: query });
    if (!query.trim()) {
      set({ searchResults: [] });
      return;
    }
    try {
      const results = await searchCortex(query, { limit: 20 });
      set({ searchResults: results });
    } catch {
      // Fall back to client-side search
      const { graphData } = get();
      const q = query.toLowerCase();
      const results = graphData.nodes
        .filter((n) => n.title.toLowerCase().includes(q) || n.tags.some((t) => t.includes(q)))
        .sort((a, b) => b.importance - a.importance)
        .slice(0, 20);
      set({ searchResults: results });
    }
  },

  clearSearch: () => set({ searchQuery: "", searchResults: [] }),
  setFilter: (filter) => set(() => ({ activeFilter: filter })),
  setSearchQuery: (query) => set(() => ({ searchQuery: query })),
  setSearchResults: (results) => set(() => ({ searchResults: results })),
  selectNode: (node) => set(() => ({ selectedNode: node })),
  setZoomLevel: (level) => set(() => ({ zoomLevel: level })),
  reset: () => {
    sseCleanup?.();
    sseCleanup = null;
    set(() => initialState);
  },
}));
