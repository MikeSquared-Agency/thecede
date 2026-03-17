"use client";

import { useMemo } from "react";
import { useGraphStore } from "@/lib/stores/graphStore";
import { filterNodes, filterEdges } from "@/lib/graph-utils";
import { GraphCanvas } from "./graph-canvas";
import { GraphSidebar } from "./graph-sidebar";
import { LiveChat } from "./live-chat";

export function GraphView() {
  const activeFilter = useGraphStore((s) => s.activeFilter);
  const graphData = useGraphStore((s) => s.graphData);
  const status = useGraphStore((s) => s.status);

  const filteredNodes = useMemo(
    () => filterNodes(graphData.nodes, activeFilter),
    [graphData.nodes, activeFilter]
  );

  const filteredEdges = useMemo(() => {
    const nodeIds = new Set(filteredNodes.map((n) => n.id));
    return filterEdges(graphData.edges, nodeIds);
  }, [filteredNodes, graphData.edges]);

  if (status === "connecting") {
    return (
      <div className="flex size-full items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <span className="text-sm">🧠</span>
          <span className="font-mono text-[11px] text-muted-foreground animate-pulse">
            Connecting to Cortex...
          </span>
        </div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="flex size-full items-center justify-center">
        <div className="flex flex-col items-center gap-3 max-w-md text-center">
          <span className="text-2xl">⚠️</span>
          <span className="font-mono text-[12px] text-foreground/80">
            Could not connect to Cortex
          </span>
          <span className="font-mono text-[10px] text-muted-foreground">
            Make sure <code className="text-primary">cortex serve</code> is running on port 9091
          </span>
          <button
            onClick={() => useGraphStore.getState().connect()}
            className="mt-2 px-3 py-1.5 rounded border border-primary/30 font-mono text-[10px] text-primary hover:bg-primary/10 transition-colors"
          >
            Retry connection
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex size-full">
      <GraphSidebar />
      <div className="relative flex-1">
        <GraphCanvas nodes={filteredNodes} edges={filteredEdges} />
        <LiveChat />
      </div>
    </div>
  );
}
