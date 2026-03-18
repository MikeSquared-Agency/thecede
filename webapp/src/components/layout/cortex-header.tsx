"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useGraphStore } from "@/lib/stores/graphStore";

const NAV_ITEMS = [
  { href: "/", label: "Graph" },
  { href: "/about", label: "About" },
] as const;

const LOGO_TEXT = "> thecede";
const LOGO_KEEP = 2; // erase stops at "> "

/** Looping typewriter: types → pauses → erases back to LOGO_KEEP → repeats */
function useLoopingTypewriter(text: string, typeSpeed = 55, pause = 2000, eraseSpeed = 30) {
  const [displayed, setDisplayed] = useState(text.slice(0, LOGO_KEEP));
  const phase = useRef<"typing" | "pausing" | "erasing">("typing");
  const idx = useRef(LOGO_KEEP);

  useEffect(() => {
    idx.current = LOGO_KEEP;
    phase.current = "typing";
    setDisplayed(text.slice(0, LOGO_KEEP));

    const tick = () => {
      if (phase.current === "typing") {
        idx.current++;
        setDisplayed(text.slice(0, idx.current));
        if (idx.current >= text.length) {
          phase.current = "pausing";
          timer = window.setTimeout(tick, pause);
          return;
        }
        timer = window.setTimeout(tick, typeSpeed);
      } else if (phase.current === "pausing") {
        phase.current = "erasing";
        timer = window.setTimeout(tick, eraseSpeed);
      } else {
        idx.current--;
        setDisplayed(text.slice(0, idx.current));
        if (idx.current <= LOGO_KEEP) {
          phase.current = "typing";
          timer = window.setTimeout(tick, typeSpeed * 4);
          return;
        }
        timer = window.setTimeout(tick, eraseSpeed);
      }
    };

    let timer = window.setTimeout(tick, typeSpeed);
    return () => clearTimeout(timer);
  }, [text, typeSpeed, pause, eraseSpeed]);

  return displayed;
}

export function CortexHeader() {
  const pathname = usePathname();
  const status = useGraphStore((s) => s.status);
  const graphData = useGraphStore((s) => s.graphData);
  const activeFilter = useGraphStore((s) => s.activeFilter);
  const connect = useGraphStore((s) => s.connect);
  const displayed = useLoopingTypewriter(LOGO_TEXT, 80, 2500, 45);

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
    status === "connected" ? "bg-red-500" :
    status === "connecting" ? "bg-amber-500" :
    status === "error" ? "bg-zinc-600" : "bg-zinc-500";

  const statusLabel =
    status === "connected" ? "live" :
    status === "connecting" ? "connecting" :
    status === "error" ? "offline" : "disconnected";

  return (
    <header className="flex items-center justify-between h-10 px-4 border-b border-border bg-card shrink-0">
      {/* Left: logo + nav */}
      <div className="flex items-center gap-0">
        <Link href="/" className="flex items-center gap-1.5 pr-4 mr-1 border-r border-border group" style={{ width: `${LOGO_TEXT.length + 1}ch` }}>
          <span
            className="font-mono text-[13px] font-bold tracking-tight select-none whitespace-nowrap"
            style={{
              background: "linear-gradient(90deg, #e879f9, #f472b6, #fb923c)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              textShadow: "0 0 12px rgba(232,121,249,0.3)",
              letterSpacing: "-0.02em",
            }}
          >
            {displayed}<span className="inline-block w-[2px] h-[12px] bg-fuchsia-400/70 ml-[1px] align-middle" style={{ animation: "blink-caret 1s step-end infinite" }} />
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

      {/* Right: stats + status */}
      <div className="flex items-center gap-3">
        {graphData.nodes.length > 0 && (
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
        )}
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
            status === "connected" ? "text-red-500/80" :
            status === "error" ? "text-zinc-500/80" : "text-muted-foreground/60"
          )}>
            {statusLabel}
          </span>
        </button>
      </div>
    </header>
  );
}
