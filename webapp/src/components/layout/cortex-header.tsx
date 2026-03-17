"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useGraphStore } from "@/lib/stores/graphStore";

const NAV_ITEMS = [
  { href: "/", label: "Graph" },
  { href: "/about", label: "About" },
] as const;

export function CortexHeader() {
  const pathname = usePathname();
  const status = useGraphStore((s) => s.status);
  const graphData = useGraphStore((s) => s.graphData);
  const activeFilter = useGraphStore((s) => s.activeFilter);
  const serverInfo = useGraphStore((s) => s.serverInfo);
  const connect = useGraphStore((s) => s.connect);

  // Auto-connect on mount
  useEffect(() => {
    if (status === "disconnected") {
      connect();
    }
  }, [status, connect]);

  const visibleNodes =
    activeFilter === "all"
      ? graphData.nodes.length
      : graphData.nodes.filter((n) => n.kind === activeFilter).length;

  const statusColor =
    status === "connected" ? "bg-emerald-500" :
    status === "connecting" ? "bg-amber-500" :
    status === "error" ? "bg-red-500" : "bg-zinc-500";

  const statusLabel =
    status === "connected" ? "live" :
    status === "connecting" ? "connecting" :
    status === "error" ? "offline" : "disconnected";

  return (
    <header className="flex items-center justify-between h-10 px-4 border-b border-border bg-card shrink-0">
      {/* Left: logo + nav */}
      <div className="flex items-center gap-0">
        <Link href="/" className="flex items-center gap-1.5 pr-4 mr-1 border-r border-border">
          <span className="text-sm">🧠</span>
          <span className="font-mono text-[11px] font-semibold text-primary tracking-tight">
            cortex
          </span>
          {serverInfo && (
            <span className="font-mono text-[9px] text-muted-foreground/50 tracking-tight">
              v{serverInfo.version}
            </span>
          )}
        </Link>

        <nav className="flex items-center">
          {NAV_ITEMS.map((item) => {
            const isActive =
              item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "relative px-3 h-10 flex items-center font-mono text-[10px] uppercase tracking-[0.08em] transition-colors duration-150",
                  isActive
                    ? "text-foreground after:absolute after:bottom-0 after:inset-x-3 after:h-[1.5px] after:bg-primary after:rounded-full"
                    : "text-muted-foreground hover:text-foreground/80"
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Right: stats + status */}
      <div className="flex items-center gap-3">
        <div className="font-mono text-[10px] text-muted-foreground tabular-nums flex items-center gap-2">
          <span>
            <span className="text-foreground/70">{visibleNodes}</span>
            <span className="text-muted-foreground/50"> / {graphData.nodes.length} nodes</span>
          </span>
          <span className="text-border">·</span>
          <span>
            <span className="text-foreground/70">{graphData.edges.length}</span>
            <span className="text-muted-foreground/50"> edges</span>
          </span>
        </div>
        <button
          onClick={() => { if (status !== "connecting") connect(); }}
          className="flex items-center gap-1 hover:opacity-80 transition-opacity"
          title={status === "error" ? "Click to reconnect" : `Status: ${statusLabel}`}
        >
          <span
            className={cn("size-[5px] rounded-full", statusColor)}
            style={status === "connected" ? { animation: "pulse-live 2s ease-in-out infinite" } : undefined}
          />
          <span className={cn(
            "font-mono text-[9px] uppercase tracking-[0.1em]",
            status === "connected" ? "text-emerald-500/80" :
            status === "error" ? "text-red-500/80" : "text-muted-foreground/60"
          )}>
            {statusLabel}
          </span>
        </button>
      </div>
    </header>
  );
}
