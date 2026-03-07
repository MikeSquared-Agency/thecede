import { create } from "zustand";
import type { CortexNode, NodeKind } from "@/lib/types/cortex";

interface GraphState {
  activeFilter: NodeKind | "all";
  searchQuery: string;
  searchResults: CortexNode[];
  selectedNode: CortexNode | null;
  zoomLevel: number;
}

interface GraphActions {
  setFilter: (filter: NodeKind | "all") => void;
  setSearchQuery: (query: string) => void;
  setSearchResults: (results: CortexNode[]) => void;
  selectNode: (node: CortexNode | null) => void;
  setZoomLevel: (level: number) => void;
  reset: () => void;
}

const initialState: GraphState = {
  activeFilter: "all",
  searchQuery: "",
  searchResults: [],
  selectedNode: null,
  zoomLevel: 1,
};

export const useGraphStore = create<GraphState & GraphActions>()((set) => ({
  ...initialState,
  setFilter: (filter) => set(() => ({ activeFilter: filter })),
  setSearchQuery: (query) => set(() => ({ searchQuery: query })),
  setSearchResults: (results) => set(() => ({ searchResults: results })),
  selectNode: (node) => set(() => ({ selectedNode: node })),
  setZoomLevel: (level) => set(() => ({ zoomLevel: level })),
  reset: () => set(() => initialState),
}));
