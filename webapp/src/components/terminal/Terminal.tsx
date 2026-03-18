"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Terminal as TerminalIcon } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useGraphStore } from "@/lib/stores/graphStore";
import type { ActivityEvent } from "@/lib/stores/graphStore";

const ASCII_BANNER = [
  "  |    |                            |       ",
  "  __|  __ \\    _ \\   __|   _ \\   _` |   _ \\ ",
  "  |    | | |   __/  (      __/  (   |   __/ ",
  " \\__| _| |_| \\___| \\___| \\___| \\__,_| \\___| ",
].join("\n");

interface TerminalLine {
  id: number;
  type: "input" | "output" | "error" | "system" | "ascii" | "event";
  content: string;
  timestamp: Date;
}

interface TerminalProps {
  className?: string;
}

const EVENT_SYMBOLS: Record<string, string> = {
  "node.created": "+",
  "node.updated": "~",
  "node.deleted": "×",
  "edge.created": "⟷",
  "edge.updated": "⟷",
  "edge.deleted": "⊘",
};

export function Terminal({ className }: TerminalProps) {
  const [lines, setLines] = useState<TerminalLine[]>([
    { id: 0, type: "ascii", content: ASCII_BANNER, timestamp: new Date() },
    { id: 1, type: "system", content: "thecede v0.2.0 — type 'help' for commands", timestamp: new Date() },
  ]);
  const [input, setInput] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [liveEvents, setLiveEvents] = useState(true);
  const [paging, setPaging] = useState(false);
  const pagerBuffer = useRef<{ type: TerminalLine["type"]; content: string }[]>([]);
  const PAGE_SIZE = 15;
  const inputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const idCounter = useRef(2);
  const prevActivityLenRef = useRef(0);

  const { setFilter, selectNode, graphData, kinds, status, serverInfo, connect, search: storeSearch, activityLog } = useGraphStore();

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [lines, scrollToBottom]);

  const addLine = useCallback((type: TerminalLine["type"], content: string) => {
    setLines((prev) => [
      ...prev,
      { id: idCounter.current++, type, content, timestamp: new Date() },
    ]);
  }, []);

  // Queue a line into the pager buffer instead of adding directly
  const addPagedLine = useCallback((type: TerminalLine["type"], content: string) => {
    pagerBuffer.current.push({ type, content });
  }, []);

  // Flush one page from the buffer into visible lines
  const flushPage = useCallback(() => {
    const buf = pagerBuffer.current;
    if (buf.length === 0) {
      setPaging(false);
      return;
    }
    const page = buf.splice(0, PAGE_SIZE);
    const newLines = page.map((l) => ({
      id: idCounter.current++,
      type: l.type,
      content: l.content,
      timestamp: new Date(),
    }));
    setLines((prev) => [...prev, ...newLines]);
    if (buf.length > 0) {
      setPaging(true);
      setLines((prev) => [
        ...prev,
        { id: idCounter.current++, type: "system" as const, content: `── ${buf.length} more line${buf.length !== 1 ? "s" : ""} · Enter for more · q to stop ──`, timestamp: new Date() },
      ]);
    } else {
      setPaging(false);
    }
  }, []);

  // Start paging: flush the first page from the buffer
  const startPager = useCallback(() => {
    if (pagerBuffer.current.length <= PAGE_SIZE) {
      // Small output — just dump it all, no pager needed
      const all = pagerBuffer.current.splice(0);
      const newLines = all.map((l) => ({
        id: idCounter.current++,
        type: l.type,
        content: l.content,
        timestamp: new Date(),
      }));
      setLines((prev) => [...prev, ...newLines]);
    } else {
      flushPage();
    }
  }, [flushPage]);

  // Auto-print connection status when it changes
  const prevStatusRef = useRef(status);
  useEffect(() => {
    if (prevStatusRef.current === status) return;
    const prev = prevStatusRef.current;
    prevStatusRef.current = status;

    if (status === "connected" && prev !== "connected") {
      const s = useGraphStore.getState();
      setLines((p) => [
        ...p,
        { id: idCounter.current++, type: "system", content: `Connected to Cortex v${s.serverInfo?.version ?? "?"}`, timestamp: new Date() },
        { id: idCounter.current++, type: "output", content: `  ${s.graphData.nodes.length} nodes · ${s.graphData.edges.length} edges · ${s.kinds.length} types`, timestamp: new Date() },
      ]);
    } else if (status === "error") {
      setLines((p) => [
        ...p,
        { id: idCounter.current++, type: "error", content: `Connection lost: ${useGraphStore.getState().error ?? "unknown"}`, timestamp: new Date() },
      ]);
    } else if (status === "connecting") {
      setLines((p) => [
        ...p,
        { id: idCounter.current++, type: "system", content: "Connecting...", timestamp: new Date() },
      ]);
    }
  }, [status]);

  // Live-tail SSE events into terminal
  useEffect(() => {
    if (!liveEvents) return;
    const log = activityLog;
    if (log.length <= prevActivityLenRef.current) {
      prevActivityLenRef.current = log.length;
      return;
    }
    const newEvents = log.slice(prevActivityLenRef.current);
    prevActivityLenRef.current = log.length;

    const formatTime = (d: Date) =>
      d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });

    const newLines: TerminalLine[] = newEvents.map((evt: ActivityEvent) => {
      const sym = EVENT_SYMBOLS[evt.type] ?? "•";
      const shortType = evt.type.split(".").pop()?.toUpperCase() ?? "EVENT";
      return {
        id: idCounter.current++,
        type: "event" as const,
        content: `${formatTime(evt.timestamp)} ${sym} ${shortType.padEnd(8)} ${evt.label}`,
        timestamp: evt.timestamp,
      };
    });

    setLines((prev) => [...prev, ...newLines]);
  }, [activityLog, liveEvents]);

  const handleCommand = useCallback((cmd: string) => {
    const trimmed = cmd.trim();
    const lower = trimmed.toLowerCase();
    const args = lower.split(" ");
    const command = args[0];

    switch (command) {
      case "help":
        addLine("output", "Commands:");
        addLine("output", "  status      Connection info & graph stats");
        addLine("output", "  nodes       Node types with counts");
        addLine("output", "  top [n]     Most important nodes (default: 10)");
        addLine("output", "  recent [n]  Recently created nodes");
        addLine("output", "  search <q>  Search nodes (updates graph view)");
        addLine("output", "  inspect <t> Full details of a node by title");
        addLine("output", "  edges <t>   Show edges for a node");
        addLine("output", "  filter <k>  Filter graph by kind (or 'all')");
        addLine("output", "  select <t>  Select node by partial title");
        addLine("output", "  live        Toggle live event tail (currently: " + (liveEvents ? "ON" : "OFF") + ")");
        addLine("output", "  reconnect   Reconnect to Cortex");
        addLine("output", "  clear       Clear terminal");
        break;

      case "clear":
        setLines([]);
        break;

      case "status": {
        addLine("output", `Connection: ${status.toUpperCase()}`);
        if (serverInfo) {
          const upMin = Math.floor(serverInfo.uptime_seconds / 60);
          const upSec = Math.floor(serverInfo.uptime_seconds % 60);
          addLine("output", `  Server v${serverInfo.version} — up ${upMin}m ${upSec}s`);
        }
        const totalNodes = graphData.nodes.length;
        const totalEdges = graphData.edges.length;
        const avgEdges = totalNodes > 0 ? (totalEdges * 2 / totalNodes).toFixed(1) : "0";
        addLine("output", `  ${totalNodes} nodes · ${totalEdges} edges · avg ${avgEdges} edges/node`);
        if (kinds.length > 0) {
          const counts: Record<string, number> = {};
          graphData.nodes.forEach((n) => { counts[n.kind] = (counts[n.kind] || 0) + 1; });
          addLine("output", `  Kinds: ${kinds.map((k) => `${k}(${counts[k] ?? 0})`).join(" ")}`);
        }
        addLine("output", `  Live tail: ${liveEvents ? "ON" : "OFF"} · Events seen: ${activityLog.length}`);
        break;
      }

      case "nodes": {
        if (graphData.nodes.length === 0) {
          addLine("error", "No nodes loaded");
          break;
        }
        const counts: Record<string, number> = {};
        graphData.nodes.forEach((n) => { counts[n.kind] = (counts[n.kind] || 0) + 1; });
        addPagedLine("output", "Kind           Count   Avg Imp");
        kinds.forEach((kind) => {
          const nodesOfKind = graphData.nodes.filter((n) => n.kind === kind);
          const count = nodesOfKind.length;
          const avgImp = count > 0 ? (nodesOfKind.reduce((s, n) => s + n.importance, 0) / count).toFixed(2) : "—";
          addPagedLine("output", `  ${kind.padEnd(14)} ${String(count).padStart(4)}    ${avgImp}`);
        });
        startPager();
        break;
      }

      case "top": {
        const n = Math.min(parseInt(args[1]) || 10, 25);
        const sorted = [...graphData.nodes].sort((a, b) => b.importance - a.importance).slice(0, n);
        if (sorted.length === 0) { addLine("error", "No nodes"); break; }
        addPagedLine("output", `Top ${sorted.length} by importance:`);
        sorted.forEach((node, i) => {
          addPagedLine("output", `  ${String(i + 1).padStart(2)}. ${node.importance.toFixed(2)} [${node.kind}] ${node.title}`);
          if (node.body) {
            addPagedLine("output", `      ${node.body.slice(0, 80)}${node.body.length > 80 ? "…" : ""}`);
          }
          if (node.tags.length > 0) addPagedLine("output", `      #${node.tags.join(" #")}`);
        });
        startPager();
        break;
      }

      case "recent": {
        const n = Math.min(parseInt(args[1]) || 10, 25);
        const sorted = [...graphData.nodes]
          .sort((a, b) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime())
          .slice(0, n);
        if (sorted.length === 0) { addLine("error", "No nodes"); break; }
        addPagedLine("output", `Last ${sorted.length} nodes:`);
        sorted.forEach((node) => {
          const ago = Math.floor((Date.now() - new Date(node.created_at ?? 0).getTime()) / 1000);
          const agoStr = ago < 60 ? `${ago}s` : ago < 3600 ? `${Math.floor(ago / 60)}m` : `${Math.floor(ago / 3600)}h`;
          addPagedLine("output", `  ${agoStr.padStart(4)} ago  [${node.kind}] ${node.title}`);
          if (node.body) {
            addPagedLine("output", `           ${node.body.slice(0, 80)}${node.body.length > 80 ? "…" : ""}`);
          }
        });
        startPager();
        break;
      }

      case "inspect": {
        if (args.length < 2) { addLine("error", "Usage: inspect <partial title>"); break; }
        const partial = trimmed.slice(8).toLowerCase();
        const found = graphData.nodes.find((n) => n.title.toLowerCase().includes(partial));
        if (!found) { addLine("error", `No node matching "${partial}"`); break; }
        addPagedLine("output", `─── ${found.title} ───`);
        addPagedLine("output", `  Kind:       ${found.kind}`);
        addPagedLine("output", `  Importance: ${found.importance.toFixed(3)}`);
        addPagedLine("output", `  Edges:      ${found.edges}`);
        if (found.tags.length > 0) addPagedLine("output", `  Tags:       ${found.tags.join(", ")}`);
        addPagedLine("output", `  Created:    ${found.created_at ? new Date(found.created_at).toLocaleString() : "unknown"}`);
        if (found.body) {
          addPagedLine("output", `  Body:`);
          const bodyLines = found.body.match(/.{1,70}/g) ?? [found.body];
          bodyLines.forEach((l) => addPagedLine("output", `    ${l}`));
        }
        addPagedLine("output", `  ID: ${found.id}`);
        selectNode(found);
        startPager();
        break;
      }

      case "edges": {
        if (args.length < 2) { addLine("error", "Usage: edges <partial title>"); break; }
        const partial = trimmed.slice(6).toLowerCase();
        const found = graphData.nodes.find((n) => n.title.toLowerCase().includes(partial));
        if (!found) { addLine("error", `No node matching "${partial}"`); break; }
        const nodeEdges = graphData.edges.filter((e) => e.source === found.id || e.target === found.id);
        if (nodeEdges.length === 0) { addLine("output", `No edges for "${found.title}"`); break; }
        const outgoing = nodeEdges.filter((e) => e.source === found.id);
        const incoming = nodeEdges.filter((e) => e.target === found.id);
        addPagedLine("output", `─── Edges for "${found.title}" ───`);
        addPagedLine("output", `  ${outgoing.length} outgoing · ${incoming.length} incoming · ${nodeEdges.length} total`);
        if (outgoing.length > 0) {
          addPagedLine("output", ``);
          addPagedLine("output", `  Outgoing:`);
          outgoing.forEach((e) => {
            const target = graphData.nodes.find((n) => n.id === e.target);
            addPagedLine("output", `    ${found.title}`);
            addPagedLine("output", `      ──[ ${e.relation} (${e.weight.toFixed(2)}) ]──▸`);
            addPagedLine("output", `    ${target?.title ?? e.target.slice(0, 12)} [${target?.kind ?? "?"}]`);
            if (target?.body) {
              addPagedLine("output", `      ${target.body.slice(0, 70)}${target.body.length > 70 ? "…" : ""}`);
            }
          });
        }
        if (incoming.length > 0) {
          addPagedLine("output", ``);
          addPagedLine("output", `  Incoming:`);
          incoming.forEach((e) => {
            const source = graphData.nodes.find((n) => n.id === e.source);
            addPagedLine("output", `    ${source?.title ?? e.source.slice(0, 12)} [${source?.kind ?? "?"}]`);
            addPagedLine("output", `      ──[ ${e.relation} (${e.weight.toFixed(2)}) ]──▸`);
            addPagedLine("output", `    ${found.title}`);
            if (source?.body) {
              addPagedLine("output", `      ${source.body.slice(0, 70)}${source.body.length > 70 ? "…" : ""}`);
            }
          });
        }
        selectNode(found);
        startPager();
        break;
      }

      case "search":
        if (args.length < 2) {
          addLine("error", "Usage: search <query>");
        } else {
          const query = trimmed.slice(7);
          addLine("output", `Searching: "${query}"`);
          storeSearch(query).then(() => {
            const gd = useGraphStore.getState().graphData;
            const results = useGraphStore.getState().searchResults;
            addPagedLine("output", `${results.length} result${results.length !== 1 ? "s" : ""}:`);
            results.forEach((r, i) => {
              addPagedLine("output", ``);
              addPagedLine("output", `  ${String(i + 1).padStart(2)}. [${r.kind}] ${r.title} (${r.importance.toFixed(2)})`);
              if (r.body) {
                addPagedLine("output", `      ${r.body.slice(0, 80)}${r.body.length > 80 ? "…" : ""}`);
              }
              if (r.tags.length > 0) addPagedLine("output", `      #${r.tags.join(" #")}`);
              // Show connections for this result
              const nodeEdges = gd.edges.filter((e) => e.source === r.id || e.target === r.id);
              if (nodeEdges.length > 0) {
                const shown = nodeEdges.slice(0, 5);
                shown.forEach((e) => {
                  const isOutgoing = e.source === r.id;
                  const otherId = isOutgoing ? e.target : e.source;
                  const other = gd.nodes.find((n) => n.id === otherId);
                  const otherName = other?.title ?? otherId.slice(0, 12);
                  const otherKind = other?.kind ?? "?";
                  if (isOutgoing) {
                    addPagedLine("output", `        ──[ ${e.relation} ]──▸ ${otherName} [${otherKind}]`);
                  } else {
                    addPagedLine("output", `        ◂──[ ${e.relation} ]── ${otherName} [${otherKind}]`);
                  }
                });
                if (nodeEdges.length > 5) addPagedLine("output", `        ... +${nodeEdges.length - 5} more edges`);
              }
            });
            startPager();
          });
        }
        break;

      case "filter": {
        if (args.length < 2) {
          addLine("output", `Current: ${useGraphStore.getState().activeFilter}`);
          addLine("output", `Types: all ${kinds.join(" ")}`);
        } else {
          const filterArg = args[1];
          if (filterArg === "all") {
            setFilter("all");
            addLine("output", "Showing all nodes");
          } else {
            const match = kinds.find((k) => k.toLowerCase() === filterArg);
            if (match) {
              setFilter(match);
              const count = graphData.nodes.filter((n) => n.kind === match).length;
              addLine("output", `Filtered: ${match} (${count} nodes)`);
            } else {
              addLine("error", `Unknown kind: ${filterArg}. Valid: ${kinds.join(", ")}, all`);
            }
          }
        }
        break;
      }

      case "select": {
        if (args.length < 2) { addLine("error", "Usage: select <partial title>"); break; }
        const partial = trimmed.slice(7).toLowerCase();
        const found = graphData.nodes.find((n) => n.title.toLowerCase().includes(partial));
        if (found) {
          selectNode(found);
          addLine("output", `Selected: [${found.kind}] ${found.title}`);
        } else {
          addLine("error", `No node matching "${partial}"`);
        }
        break;
      }

      case "live":
        setLiveEvents((v) => !v);
        addLine("system", `Live event tail: ${!liveEvents ? "ON" : "OFF"}`);
        break;

      case "reconnect":
        addLine("system", "Reconnecting...");
        connect();
        break;

      case "history":
        if (history.length === 0) {
          addLine("output", "No history");
        } else {
          history.slice(-10).forEach((h, i) => addLine("output", `  ${i + 1}. ${h}`));
        }
        break;

      case "":
        break;

      default:
        addLine("error", `Unknown: ${command}. Type 'help'`);
    }
  }, [addLine, addPagedLine, startPager, history, setFilter, selectNode, graphData, kinds, status, serverInfo, connect, storeSearch, liveEvents, activityLog.length]);

  const handleSubmit = useCallback((e: { preventDefault: () => void }) => {
    e.preventDefault();

    // Pager mode: Enter shows next page, q quits
    if (paging) {
      const val = input.trim().toLowerCase();
      if (val === "q" || val === "quit") {
        pagerBuffer.current = [];
        setPaging(false);
        addLine("system", "(pager closed)");
      } else {
        // Remove the previous "more lines" prompt before flushing
        setLines((prev) => {
          const last = prev[prev.length - 1];
          if (last?.type === "system" && last.content.startsWith("──")) {
            return prev.slice(0, -1);
          }
          return prev;
        });
        flushPage();
      }
      setInput("");
      return;
    }

    if (!input.trim()) return;

    addLine("input", `$ ${input}`);
    setHistory((prev) => [...prev, input]);
    setHistoryIndex(-1);
    handleCommand(input);
    setInput("");
  }, [input, addLine, handleCommand, paging, flushPage]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "ArrowUp") {
      e.preventDefault();
      if (history.length > 0) {
        const newIndex = historyIndex < history.length - 1 ? historyIndex + 1 : historyIndex;
        setHistoryIndex(newIndex);
        setInput(history[history.length - 1 - newIndex] || "");
      }
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (historyIndex > 0) {
        const newIndex = historyIndex - 1;
        setHistoryIndex(newIndex);
        setInput(history[history.length - 1 - newIndex] || "");
      } else {
        setHistoryIndex(-1);
        setInput("");
      }
    }
  }, [history, historyIndex]);

  return (
    <div
      className={cn(
        "relative flex flex-col border-t border-border bg-card",
        className
      )}
      onClick={() => inputRef.current?.focus()}
    >
      {/* Scanline overlay */}
      <div className="terminal-scanline" />

      {/* Header */}
      <div className="flex items-center gap-1.5 px-3 h-7 border-b border-border bg-background/50 shrink-0">
        <TerminalIcon className="size-3 text-primary/60" />
        <span className="text-[9px] font-mono uppercase tracking-[0.1em] text-muted-foreground/60">
          Terminal
        </span>
        <span className="ml-auto text-[8px] font-mono text-muted-foreground/30">v0.2.0</span>
      </div>

      {/* Output */}
      <ScrollArea className="flex-1 min-h-0">
        <div className="px-3 py-2 font-mono text-[11px] flex flex-col gap-px">
          {lines.map((line) =>
            line.type === "ascii" ? (
              <pre
                key={line.id}
                className="text-[10px] leading-[13px] text-primary/50 font-mono overflow-hidden select-none whitespace-pre"
              >
                {line.content}
              </pre>
            ) : (
              <div
                key={line.id}
                className={cn(
                  "leading-[1.6]",
                  line.type === "input" && "text-primary/80",
                  line.type === "output" && "text-foreground/60",
                  line.type === "error" && "text-red-400/80",
                  line.type === "system" && "text-muted-foreground/50 italic",
                  line.type === "event" && "text-muted-foreground/35"
                )}
              >
                {line.content}
              </div>
            )
          )}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      {/* Input */}
      <form onSubmit={handleSubmit} className="flex items-center gap-1.5 px-3 h-7 border-t border-border bg-background/30 shrink-0">
        <span className={cn("font-mono text-[10px] select-none", paging ? "text-amber-500/70" : "text-primary/50")}>{paging ? ":" : "$"}</span>
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={paging ? "Enter for more, q to stop" : "type a command..."}
          className="flex-1 bg-transparent text-[11px] font-mono text-foreground/70 placeholder:text-muted-foreground/30 focus:outline-none caret-primary/60"
          autoComplete="off"
          spellCheck={false}
        />
      </form>
    </div>
  );
}
