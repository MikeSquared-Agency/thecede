"use client";

import { getKindColor } from "@/lib/types/cortex";
import { useGraphStore } from "@/lib/stores/graphStore";

export function GraphLegend() {
  const kinds = useGraphStore((s) => s.kinds);

  if (kinds.length === 0) return null;

  return (
    <div className="absolute left-3 top-3 z-10 flex flex-col gap-1 rounded-md border border-border bg-card/90 px-2.5 py-2 backdrop-blur-md">
      <span className="font-mono text-[8px] uppercase tracking-[0.1em] text-muted-foreground/50 mb-0.5">
        Types
      </span>
      {kinds.map((kind) => (
        <div key={kind} className="flex items-center gap-1.5">
          <span
            className="size-[6px] rounded-full shrink-0"
            style={{ backgroundColor: getKindColor(kind) }}
          />
          <span className="font-mono text-[9px] text-muted-foreground/70">
            {kind}
          </span>
        </div>
      ))}
    </div>
  );
}
