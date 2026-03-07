"use client";

import { KIND_COLORS } from "@/lib/types/cortex";
import type { NodeKind } from "@/lib/types/cortex";

const KINDS: NodeKind[] = ["Rule", "Fact", "Document", "Task", "Pattern", "Domain", "Tool"];

export function GraphLegend() {
  return (
    <div className="absolute left-3 top-3 z-10 flex flex-col gap-1 rounded-md border border-border bg-card/90 px-2.5 py-2 backdrop-blur-md">
      <span className="font-mono text-[8px] uppercase tracking-[0.1em] text-muted-foreground/50 mb-0.5">
        Types
      </span>
      {KINDS.map((kind) => (
        <div key={kind} className="flex items-center gap-1.5">
          <span
            className="size-[6px] rounded-full shrink-0"
            style={{ backgroundColor: KIND_COLORS[kind] }}
          />
          <span className="font-mono text-[9px] text-muted-foreground/70">
            {kind}
          </span>
        </div>
      ))}
    </div>
  );
}
