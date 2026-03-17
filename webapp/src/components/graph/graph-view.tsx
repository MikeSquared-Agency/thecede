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
      <div className="flex size-full items-center justify-center graph-bg">
        <div className="flex flex-col items-center gap-4">
          <div className="size-10 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
          <span className="font-mono text-[11px] text-muted-foreground/60">
            Connecting…
          </span>
        </div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="flex size-full items-center justify-center graph-bg">
        <div className="flex flex-col items-center gap-5 max-w-sm text-center">
          <div className="size-14 rounded-full border border-border bg-card/60 flex items-center justify-center backdrop-blur-sm">
            <span className="font-mono text-[24px] text-muted-foreground/40">&#x2298;</span>
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="font-mono text-[13px] font-medium text-foreground/80">
              No connection
            </span>
            <span className="font-mono text-[10px] text-muted-foreground/60 leading-relaxed">
              Start the server with{" "}
              <code className="px-1.5 py-0.5 rounded bg-card border border-border text-primary/80">cortex serve</code>{" "}
              then retry
            </span>
          </div>
          <button
            onClick={() => useGraphStore.getState().connect()}
            className="px-4 py-2 rounded-md border border-primary/20 bg-primary/5 font-mono text-[10px] text-primary hover:bg-primary/10 hover:border-primary/40 transition-all duration-200"
          >
            Retry connection
          </button>
        </div>
      </div>
    );
  }

  if (graphData.nodes.length === 0 && status === "connected") {
    return (
      <div className="flex size-full items-center justify-center graph-bg">
        <div className="flex flex-col items-center gap-4 max-w-sm text-center">
          <span className="text-3xl opacity-30">🧠</span>
          <div className="flex flex-col gap-1.5">
            <span className="font-mono text-[13px] font-medium text-foreground/70">
              Graph is empty
            </span>
            <span className="font-mono text-[10px] text-muted-foreground/50 leading-relaxed">
              Connected, but no nodes yet. Create nodes via the API, CLI, or an agent.
            </span>
          </div>
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
