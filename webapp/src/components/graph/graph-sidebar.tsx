"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useGraphStore } from "@/lib/stores/graphStore";
import { CORTEX_DATA } from "@/lib/data/cortex-data";
import { searchNodes } from "@/lib/graph-utils";
import { KIND_COLORS } from "@/lib/types/cortex";
import type { NodeKind } from "@/lib/types/cortex";

const FILTER_OPTIONS: Array<NodeKind | "all"> = [
  "all", "Rule", "Fact", "Document", "Task", "Pattern", "Domain", "Tool",
];

export function GraphSidebar() {
  const {
    activeFilter, setFilter,
    setSearchQuery, searchResults, setSearchResults,
    selectedNode, selectNode,
  } = useGraphStore();

  const [localQuery, setLocalQuery] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSearch = useCallback(
    (value: string) => {
      setLocalQuery(value);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        setSearchQuery(value);
        if (value.trim()) {
          setSearchResults(searchNodes(CORTEX_DATA.nodes, value));
        } else {
          setSearchResults([]);
        }
      }, 250);
    },
    [setSearchQuery, setSearchResults]
  );

  useEffect(() => {
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, []);

  return (
    <aside className="hidden w-[240px] shrink-0 flex-col border-r border-border bg-card md:flex overflow-hidden">
      {/* Filter */}
      <div className="px-3 pt-3 pb-2 flex flex-col gap-2">
        <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-muted-foreground/70">
          Filter
        </span>
        <div className="flex flex-wrap gap-[3px]">
          {FILTER_OPTIONS.map((kind) => {
            const isActive = activeFilter === kind;
            return (
              <button
                key={kind}
                onClick={() => setFilter(kind)}
                aria-label={`Filter by ${kind}`}
                className={cn(
                  "flex items-center gap-1 px-1.5 py-0.5 rounded font-mono text-[9px] transition-colors duration-150 border",
                  isActive
                    ? "border-primary/40 bg-primary/8 text-primary"
                    : "border-transparent bg-secondary text-muted-foreground hover:text-foreground/80 hover:bg-accent"
                )}
              >
                {kind !== "all" && (
                  <span
                    className="size-[5px] rounded-full shrink-0"
                    style={{ backgroundColor: KIND_COLORS[kind] }}
                  />
                )}
                {kind}
              </button>
            );
          })}
        </div>
      </div>

      {/* Divider */}
      <div className="h-px bg-border mx-3" />

      {/* Search */}
      <div className="px-3 pt-2 pb-2 flex flex-col gap-1.5">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 size-3 -translate-y-1/2 text-muted-foreground/50" />
          <Input
            value={localQuery}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Search memory..."
            className="h-7 pl-7 font-mono text-[10px] bg-background border-border"
          />
        </div>
      </div>

      {/* Results or Detail */}
      <div className="flex-1 overflow-y-auto">
        {searchResults.length > 0 ? (
          <div className="px-3 pb-3 flex flex-col gap-[3px]">
            {searchResults.map((node) => (
              <button
                key={node.id}
                onClick={() => selectNode(node)}
                className={cn(
                  "w-full text-left px-2 py-1.5 rounded transition-colors duration-150 border",
                  selectedNode?.id === node.id
                    ? "border-primary/30 bg-primary/5"
                    : "border-transparent hover:bg-accent"
                )}
              >
                <div className="flex items-center gap-1 mb-0.5">
                  <span
                    className="size-[5px] rounded-full shrink-0"
                    style={{ backgroundColor: KIND_COLORS[node.kind] }}
                  />
                  <span className="font-mono text-[9px] text-muted-foreground">
                    {node.kind}
                  </span>
                  <span className="font-mono text-[9px] tabular-nums text-muted-foreground/50 ml-auto">
                    {node.importance.toFixed(2)}
                  </span>
                </div>
                <span className="text-[11px] leading-tight text-foreground/80 line-clamp-2">
                  {node.title}
                </span>
              </button>
            ))}
          </div>
        ) : selectedNode ? (
          <div className="px-3 pb-3 flex flex-col gap-2">
            <div className="flex items-start justify-between gap-1">
              <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-muted-foreground/70">
                Selected
              </span>
              <button
                onClick={() => selectNode(null)}
                className="text-muted-foreground/50 hover:text-foreground transition-colors"
                aria-label="Deselect"
              >
                <X className="size-3" />
              </button>
            </div>

            <div className="flex items-center gap-1.5 mb-0.5">
              <span
                className="size-[7px] rounded-full shrink-0"
                style={{ backgroundColor: KIND_COLORS[selectedNode.kind] }}
              />
              <span
                className="font-mono text-[10px] font-medium"
                style={{ color: KIND_COLORS[selectedNode.kind] }}
              >
                {selectedNode.kind}
              </span>
            </div>

            <p className="text-[12px] font-medium leading-snug text-foreground/90">
              {selectedNode.title}
            </p>

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

            <div className="bg-background rounded p-2 flex flex-col gap-0.5">
              <div className="font-mono text-[9px] text-muted-foreground/60 tabular-nums flex justify-between">
                <span>importance</span>
                <span className="text-foreground/60">{selectedNode.importance.toFixed(3)}</span>
              </div>
              <div className="font-mono text-[9px] text-muted-foreground/60 tabular-nums flex justify-between">
                <span>connections</span>
                <span className="text-foreground/60">{selectedNode.edges}</span>
              </div>
              <div className="font-mono text-[8px] text-muted-foreground/40 truncate mt-0.5">
                {selectedNode.id}
              </div>
            </div>

            {selectedNode.body && (
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                {selectedNode.body}
              </p>
            )}
          </div>
        ) : (
          <div className="px-3 pt-1">
            <p className="font-mono text-[9px] text-muted-foreground/40 leading-relaxed">
              Click a node to inspect it.
            </p>
          </div>
        )}
      </div>
    </aside>
  );
}
