"use client";

import { useEffect, useRef, useState } from "react";
import { useGraphStore } from "@/lib/stores/graphStore";

/** Typewriter that types out text, pauses, erases, and loops. */
function Typewriter({ text, speed = 45, pause = 1500, eraseSpeed = 25 }: { text: string; speed?: number; pause?: number; eraseSpeed?: number }) {
  const [displayed, setDisplayed] = useState("");
  const phase = useRef<"typing" | "pausing" | "erasing">("typing");
  const idx = useRef(0);

  useEffect(() => {
    idx.current = 0;
    phase.current = "typing";
    setDisplayed("");

    const tick = () => {
      if (phase.current === "typing") {
        idx.current++;
        setDisplayed(text.slice(0, idx.current));
        if (idx.current >= text.length) {
          phase.current = "pausing";
          timer = window.setTimeout(tick, pause);
          return;
        }
        timer = window.setTimeout(tick, speed);
      } else if (phase.current === "pausing") {
        phase.current = "erasing";
        timer = window.setTimeout(tick, eraseSpeed);
      } else {
        idx.current--;
        setDisplayed(text.slice(0, idx.current));
        if (idx.current <= 0) {
          phase.current = "typing";
          timer = window.setTimeout(tick, speed * 4);
          return;
        }
        timer = window.setTimeout(tick, eraseSpeed);
      }
    };

    let timer = window.setTimeout(tick, speed);
    return () => clearTimeout(timer);
  }, [text, speed, pause, eraseSpeed]);

  return (
    <span>
      {displayed}
      <span
        className="inline-block w-[1px] h-[8px] bg-muted-foreground/30 ml-[1px] align-middle"
        style={{ animation: "blink-caret 1s step-end infinite" }}
      />
    </span>
  );
}

const EVENT_BADGES: Record<string, { label: string; icon: string }> = {
  "node.created": { label: "CREATED", icon: "+" },
  "node.updated": { label: "UPDATED", icon: "~" },
  "node.deleted": { label: "REMOVED", icon: "×" },
  "edge.created": { label: "LINKED", icon: "⟷" },
  "edge.updated": { label: "RELINKED", icon: "⟷" },
  "edge.deleted": { label: "UNLINKED", icon: "⊘" },
};

export function ActivityStream() {
  const activityLog = useGraphStore((s) => s.activityLog);
  const status = useGraphStore((s) => s.status);
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isAutoScrolling = useRef(true);

  useEffect(() => {
    if (isAutoScrolling.current) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [activityLog]);

  const handleScroll = () => {
    const el = containerRef.current;
    if (!el) return;
    const isAtBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
    isAutoScrolling.current = isAtBottom;
  };

  const formatTime = (d: Date) =>
    d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });

  return (
    <div className="absolute right-0 top-0 bottom-0 hidden w-[260px] flex-col pointer-events-none lg:flex">
      {/* Messages */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto overflow-x-hidden pointer-events-auto"
        style={{ scrollbarWidth: "none", maskImage: "linear-gradient(to bottom, transparent, black 24px, black calc(100% - 24px), transparent)" }}
      >
        <div className="flex flex-col justify-end min-h-full gap-px px-2 pb-2">
          {activityLog.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 gap-2">
              <span className="font-mono text-[9px] text-muted-foreground/25">
                <Typewriter text={status === "connected" ? "Listening for changes…" : "Waiting for connection…"} />
              </span>
            </div>
          ) : (
            activityLog.map((event) => {
              const badge = EVENT_BADGES[event.type] ?? {
                label: event.type.split(".").pop()?.toUpperCase() ?? "EVENT",
                icon: "•",
              };
              const isEdgeEvent = event.type.startsWith("edge.");
              return (
                <div
                  key={event.id}
                  className={`flex items-center gap-1.5 px-2 py-[3px] rounded-sm ${
                    isEdgeEvent ? "autolink-notify" : ""
                  }`}
                  style={{
                    animation: isEdgeEvent
                      ? "autolinkPulse 0.6s cubic-bezier(0.25, 1, 0.5, 1) forwards"
                      : "activitySlideIn 0.25s cubic-bezier(0.25, 1, 0.5, 1) forwards",
                    background: `${event.color}06`,
                  }}
                >
                  <span className="font-mono text-[7px] text-muted-foreground/20 tabular-nums shrink-0">
                    {formatTime(event.timestamp)}
                  </span>
                  <span
                    className={`font-mono text-[7px] uppercase tracking-wider shrink-0 min-w-[42px] ${
                      isEdgeEvent ? "autolink-badge" : ""
                    }`}
                    style={{ color: event.color }}
                  >
                    {badge.label}
                  </span>
                  <span className="font-mono text-[8px] text-foreground/40 truncate">
                    {event.label}
                  </span>
                </div>
              );
            })
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Autolink notification animations */}
      <style>{`
        @keyframes autolinkPulse {
          0% { opacity: 0; transform: translateX(20px) scale(0.95); }
          30% { opacity: 1; transform: translateX(-2px) scale(1.02); }
          50% { transform: translateX(1px) scale(1); }
          70% { background: rgba(167, 139, 250, 0.08); }
          100% { opacity: 1; transform: translateX(0) scale(1); background: transparent; }
        }
        .autolink-badge {
          animation: autolinkShimmer 1.2s ease-out forwards;
        }
        @keyframes autolinkShimmer {
          0%, 20% { text-shadow: 0 0 6px currentColor, 0 0 12px currentColor; }
          100% { text-shadow: none; }
        }
      `}</style>
    </div>
  );
}
