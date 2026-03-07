"use client";

import { useMemo } from "react";
import { CORTEX_DATA } from "@/lib/data/cortex-data";
import { useGraphStore } from "@/lib/stores/graphStore";
import { filterNodes, filterEdges } from "@/lib/graph-utils";
import { GraphCanvas } from "./graph-canvas";
import { GraphSidebar } from "./graph-sidebar";
import { LiveChat } from "./live-chat";

export function GraphView() {
  const activeFilter = useGraphStore((s) => s.activeFilter);

  const filteredNodes = useMemo(
    () => filterNodes(CORTEX_DATA.nodes, activeFilter),
    [activeFilter]
  );

  const filteredEdges = useMemo(() => {
    const nodeIds = new Set(filteredNodes.map((n) => n.id));
    return filterEdges(CORTEX_DATA.edges, nodeIds);
  }, [filteredNodes]);

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
