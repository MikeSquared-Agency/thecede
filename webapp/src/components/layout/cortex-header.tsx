"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { CORTEX_DATA } from "@/lib/data/cortex-data";
import { useGraphStore } from "@/lib/stores/graphStore";

const NAV_ITEMS = [
  { href: "/", label: "Graph" },
  { href: "/how-it-works", label: "How It Works" },
] as const;

export function CortexHeader() {
  const pathname = usePathname();
  const activeFilter = useGraphStore((s) => s.activeFilter);

  const visibleNodes =
    activeFilter === "all"
      ? CORTEX_DATA.nodes.length
      : CORTEX_DATA.nodes.filter((n) => n.kind === activeFilter).length;

  return (
    <header className="flex items-center justify-between h-10 px-4 border-b border-border bg-card shrink-0">
      {/* Left: logo + nav */}
      <div className="flex items-center gap-0">
        <Link href="/" className="flex items-center gap-1.5 pr-4 mr-1 border-r border-border">
          <span className="text-sm">🧠</span>
          <span className="font-mono text-[11px] font-semibold text-primary tracking-tight">
            lily
          </span>
          <span className="font-mono text-[11px] text-muted-foreground tracking-tight">
            cortex
          </span>
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

      {/* Right: stats + live */}
      <div className="flex items-center gap-3">
        <div className="font-mono text-[10px] text-muted-foreground tabular-nums flex items-center gap-2">
          <span>
            <span className="text-foreground/70">{visibleNodes}</span>
            <span className="text-muted-foreground/50"> / {CORTEX_DATA.nodes.length} nodes</span>
          </span>
          <span className="text-border">·</span>
          <span>
            <span className="text-foreground/70">{CORTEX_DATA.edges.length}</span>
            <span className="text-muted-foreground/50"> edges</span>
          </span>
        </div>
        <div className="flex items-center gap-1">
          <span
            className="size-[5px] rounded-full bg-emerald-500"
            style={{ animation: "pulse-live 2s ease-in-out infinite" }}
          />
          <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-emerald-500/80">
            live
          </span>
        </div>
      </div>
    </header>
  );
}
