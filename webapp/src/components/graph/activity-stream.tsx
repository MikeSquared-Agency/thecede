"use client";

import { useEffect, useRef } from "react";
import { useGraphStore } from "@/lib/stores/graphStore";

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
      {/* Header */}
      <div className="px-3 pt-2.5 pb-1.5 pointer-events-auto">
        <div className="flex items-center gap-1.5">
          <span className="relative flex size-1.5">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-red-400 opacity-60" />
            <span className="relative inline-flex size-1.5 rounded-full bg-red-500" />
          </span>
          <span className="font-mono text-[8px] uppercase tracking-[0.14em] text-muted-foreground/50">
            Activity
          </span>
          {activityLog.length > 0 && (
            <span className="font-mono text-[8px] text-muted-foreground/25 ml-auto tabular-nums">
              {activityLog.length}
            </span>
          )}
        </div>
      </div>

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
                {status === "connected" ? "Listening for changes…" : "Waiting for connection…"}
              </span>
            </div>
          ) : (
            activityLog.map((event) => {
              const badge = EVENT_BADGES[event.type] ?? {
                label: event.type.split(".").pop()?.toUpperCase() ?? "EVENT",
                icon: "•",
              };
              return (
                <div
                  key={event.id}
                  className="flex items-center gap-1.5 px-2 py-[3px] rounded-sm"
                  style={{
                    animation: "activitySlideIn 0.25s cubic-bezier(0.25, 1, 0.5, 1) forwards",
                    background: `${event.color}06`,
                  }}
                >
                  <span className="font-mono text-[7px] text-muted-foreground/20 tabular-nums shrink-0">
                    {formatTime(event.timestamp)}
                  </span>
                  <span
                    className="font-mono text-[7px] uppercase tracking-wider shrink-0 min-w-[42px]"
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
    </div>
  );
}
