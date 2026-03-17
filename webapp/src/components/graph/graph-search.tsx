"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useGraphStore } from "@/lib/stores/graphStore";
import { getKindColor } from "@/lib/types/cortex";

export function GraphSearch() {
  const {
    activeFilter, setFilter,
    searchResults, search, clearSearch,
    kinds,
  } = useGraphStore();

  const [localQuery, setLocalQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSearch = useCallback(
    (value: string) => {
      setLocalQuery(value);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        search(value);
      }, 250);
    },
    [search]
  );

  const handleClear = useCallback(() => {
    setLocalQuery("");
    clearSearch();
    inputRef.current?.focus();
  }, [clearSearch]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  // Keyboard shortcut: Ctrl/Cmd+K to focus, Escape to clear
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      }
      if (e.key === "Escape" && localQuery) {
        handleClear();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [localQuery, handleClear]);

  return (
    <div className="absolute left-3 top-3 z-10 flex flex-col gap-1.5 pointer-events-auto">
      {/* Search bar */}
      <div
        className={cn(
          "flex items-center gap-1.5 rounded-md border bg-card/90 backdrop-blur-md px-2.5 transition-all duration-200",
          focused
            ? "border-primary/40 w-[280px] shadow-[0_0_12px_rgba(228,161,27,0.06)]"
            : "border-border w-[220px]"
        )}
      >
        <Search className="size-3 text-muted-foreground/50 shrink-0" />
        <input
          ref={inputRef}
          value={localQuery}
          onChange={(e) => handleSearch(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder="Search graph… ⌘K"
          className="flex-1 h-7 bg-transparent font-mono text-[10px] text-foreground/80 placeholder:text-muted-foreground/30 focus:outline-none"
        />
        {localQuery && (
          <button
            onClick={handleClear}
            className="text-muted-foreground/40 hover:text-foreground transition-colors"
          >
            <X className="size-3" />
          </button>
        )}
        {searchResults.length > 0 && (
          <span className="font-mono text-[9px] text-primary/60 tabular-nums shrink-0">
            {searchResults.length}
          </span>
        )}
      </div>

      {/* Filter pills */}
      {kinds.length > 0 && (
        <div className="flex flex-wrap gap-[3px] max-w-[320px]">
          {["all", ...kinds].map((kind) => {
            const isActive = activeFilter === kind;
            return (
              <button
                key={kind}
                onClick={() => setFilter(kind)}
                className={cn(
                  "flex items-center gap-1 px-1.5 py-0.5 rounded font-mono text-[8px] transition-all duration-150 border backdrop-blur-sm",
                  isActive
                    ? "border-primary/40 bg-primary/10 text-primary"
                    : "border-border/50 bg-card/60 text-muted-foreground/50 hover:text-foreground/70 hover:bg-card/80"
                )}
              >
                {kind !== "all" && (
                  <span
                    className="size-[4px] rounded-full shrink-0"
                    style={{ backgroundColor: getKindColor(kind) }}
                  />
                )}
                {kind}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
