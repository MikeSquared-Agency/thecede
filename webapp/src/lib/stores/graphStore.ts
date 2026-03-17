import { create } from "zustand";
import type { CortexNode, CortexData } from "@/lib/types/cortex";
import { exportGraph, getHealth, searchCortex, subscribeEvents } from "@/lib/cortex-client";
import type { CortexHealth, CortexSSEEvent } from "@/lib/cortex-client";

type ConnectionStatus = "disconnected" | "connecting" | "connected" | "error";

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
}

interface GraphActions {
  // Connection
  connect: () => Promise<void>;
  disconnect: () => void;

  // Data
  loadGraph: () => Promise<void>;
  search: (query: string) => Promise<void>;

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
        // Auto-reload on graph mutations
        if (
          event.event_type?.startsWith("node.") ||
          event.event_type?.startsWith("edge.")
        ) {
          get().loadGraph();
        }
      });
    } catch (err) {
      set({
        status: "error",
        error: err instanceof Error ? err.message : "Failed to connect to Cortex",
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
