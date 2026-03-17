"use client";

import { X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useGraphStore } from "@/lib/stores/graphStore";
import { getKindColor } from "@/lib/types/cortex";

export function NodeDetail() {
  const selectedNode = useGraphStore((s) => s.selectedNode);
  const selectNode = useGraphStore((s) => s.selectNode);

  if (!selectedNode) return null;

  return (
    <div
      className="absolute left-3 bottom-14 z-10 w-[260px] rounded-md border border-border bg-card/95 backdrop-blur-md pointer-events-auto"
      style={{ animation: "nodeDetailIn 0.2s ease-out forwards" }}
    >
      <div className="p-3 flex flex-col gap-2">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <span
              className="size-[7px] rounded-full shrink-0"
              style={{ backgroundColor: getKindColor(selectedNode.kind) }}
            />
            <span
              className="font-mono text-[10px] font-medium"
              style={{ color: getKindColor(selectedNode.kind) }}
            >
              {selectedNode.kind}
            </span>
          </div>
          <button
            onClick={() => selectNode(null)}
            className="text-muted-foreground/40 hover:text-foreground transition-colors"
          >
            <X className="size-3" />
          </button>
        </div>

        {/* Title */}
        <p className="text-[12px] font-medium leading-snug text-foreground/90">
          {selectedNode.title}
        </p>

        {/* Tags */}
        {selectedNode.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {selectedNode.tags.map((tag) => (
              <Badge
                key={tag}
                variant="secondary"
                className="font-mono text-[8px] px-1 py-0 rounded bg-secondary text-muted-foreground border-0"
              >
                {tag}
              </Badge>
            ))}
          </div>
        )}

        {/* Stats */}
        <div className="bg-background/60 rounded p-2 flex flex-col gap-0.5">
          <div className="font-mono text-[9px] text-muted-foreground/60 tabular-nums flex justify-between">
            <span>importance</span>
            <span className="text-foreground/60">
              {selectedNode.importance.toFixed(3)}
            </span>
          </div>
          <div className="font-mono text-[9px] text-muted-foreground/60 tabular-nums flex justify-between">
            <span>connections</span>
            <span className="text-foreground/60">{selectedNode.edges}</span>
          </div>
          <div className="font-mono text-[8px] text-muted-foreground/30 truncate mt-0.5">
            {selectedNode.id}
          </div>
        </div>

        {/* Body */}
        {selectedNode.body && (
          <p className="text-[11px] leading-relaxed text-muted-foreground/70 line-clamp-3">
            {selectedNode.body}
          </p>
        )}
      </div>
    </div>
  );
}
