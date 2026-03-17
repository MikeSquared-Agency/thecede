"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { getKindColor } from "@/lib/types/cortex";
import { useGraphStore } from "@/lib/stores/graphStore";
import { truncateTitle } from "@/lib/graph-utils";

interface ChatMessage {
  id: number;
  title: string;
  kind: string;
  color: string;
  exiting: boolean;
}

export function LiveChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const idRef = useRef(0);
  const intervalRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const graphNodes = useGraphStore((s) => s.graphData.nodes);
  const lastEvent = useGraphStore((s) => s.lastEvent);

  // Show live SSE events as chat messages
  useEffect(() => {
    if (!lastEvent) return;
    const id = idRef.current++;
    const eventData = lastEvent.data;
    const msg: ChatMessage = {
      id,
      title: truncateTitle(String(eventData.title ?? eventData.id ?? lastEvent.event_type), 36),
      kind: String(eventData.kind ?? lastEvent.event_type),
      color: getKindColor(String(eventData.kind ?? "")),
      exiting: false,
    };
    setMessages((prev) => [...prev.slice(-11), msg]);
    setTimeout(() => setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, exiting: true } : m))), 7000);
    setTimeout(() => setMessages((prev) => prev.filter((m) => m.id !== id)), 7600);
  }, [lastEvent]);

  const postChat = useCallback(() => {
    if (graphNodes.length === 0) return;
    const node = graphNodes[Math.floor(Math.random() * graphNodes.length)];
    const id = idRef.current++;
    const msg: ChatMessage = {
      id,
      title: truncateTitle(node.title, 36),
      kind: node.kind,
      color: getKindColor(node.kind),
      exiting: false,
    };

    setMessages((prev) => [...prev.slice(-11), msg]);

    setTimeout(() => {
      setMessages((prev) =>
        prev.map((m) => (m.id === id ? { ...m, exiting: true } : m))
      );
    }, 7000);

    setTimeout(() => {
      setMessages((prev) => prev.filter((m) => m.id !== id));
    }, 7600);
  }, []);

  useEffect(() => {
    const scheduleNext = () => {
      const delay = 2500 + Math.random() * 2500;
      intervalRef.current = setTimeout(() => {
        postChat();
        scheduleNext();
      }, delay);
    };
    scheduleNext();
    return () => { if (intervalRef.current) clearTimeout(intervalRef.current); };
  }, [postChat]);

  return (
    <div className="absolute right-0 top-0 bottom-0 hidden w-[280px] flex-col justify-end gap-1 p-3 pointer-events-none lg:flex">
      {messages.map((msg) => (
        <div
          key={msg.id}
          className="pointer-events-auto flex items-center gap-1.5 rounded-sm px-2 py-1 bg-background/60 backdrop-blur-sm"
          style={{
            animation: msg.exiting
              ? "chatFadeOut 0.6s ease forwards"
              : "chatFadeIn 0.4s cubic-bezier(0.25, 1, 0.5, 1) forwards",
            borderLeft: `2px solid ${msg.color}`,
          }}
        >
          <span className="font-mono text-[8px] uppercase tracking-wider text-muted-foreground/50 shrink-0 w-[42px]">
            {msg.kind}
          </span>
          <span className="font-mono text-[9px] text-foreground/50 truncate">
            {msg.title}
          </span>
        </div>
      ))}
    </div>
  );
}
