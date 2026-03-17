"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Terminal as TerminalIcon } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useGraphStore } from "@/lib/stores/graphStore";

const ASCII_BANNER = ` _   _                        _
| |_| |__   ___  ___ ___  __| | ___
| __| '_ \\ / _ \\/ __/ _ \\/ _\` |/ _ \\
| |_| | | |  __/ (_|  __/ (_| |  __/
 \\__|_| |_|\\___|\\___|\\___|\\_\\_,_|\\___|`;

interface TerminalLine {
  id: number;
  type: "input" | "output" | "error" | "system" | "ascii";
  content: string;
  timestamp: Date;
}

interface TerminalProps {
  className?: string;
}

export function Terminal({ className }: TerminalProps) {
  const [lines, setLines] = useState<TerminalLine[]>([
    { id: 0, type: "ascii", content: ASCII_BANNER, timestamp: new Date() },
    { id: 1, type: "system", content: "thecede v0.2.0", timestamp: new Date() },
    { id: 2, type: "output", content: "Type 'help' for commands.", timestamp: new Date() },
  ]);
  const [input, setInput] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const idCounter = useRef(3);

  const { setFilter, selectNode, graphData, kinds, status, serverInfo, connect, search: storeSearch } = useGraphStore();

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

  const handleCommand = useCallback((cmd: string) => {
    const trimmed = cmd.trim().toLowerCase();
    const args = trimmed.split(" ");
    const command = args[0];

    switch (command) {
      case "help":
        addLine("output", "Available commands:");
        addLine("output", "  help      - Show this message");
        addLine("output", "  clear     - Clear terminal");
        addLine("output", "  status    - Connection & server info");
        addLine("output", "  nodes     - List node types with counts");
        addLine("output", "  search    - Search nodes (updates graph)");
        addLine("output", "  filter    - Filter by node type");
        addLine("output", "  select    - Select node by partial title");
        addLine("output", "  stats     - Graph statistics");
        addLine("output", "  reconnect - Reconnect to server");
        addLine("output", "  history   - Show command history");
        break;

      case "clear":
        setLines([]);
        break;

      case "status":
        addLine("output", "Status:");
        addLine("output", `  Connection: ${status.toUpperCase()}`);
        if (serverInfo) {
          addLine("output", `  Version: ${serverInfo.version}`);
          addLine("output", `  Uptime: ${Math.floor(serverInfo.uptime_seconds)}s`);
        }
        addLine("output", `  Nodes: ${graphData.nodes.length}`);
        addLine("output", `  Edges: ${graphData.edges.length}`);
        addLine("output", `  Kinds: ${kinds.length > 0 ? kinds.join(", ") : "(none)"}`);
        break;

      case "nodes": {
        if (graphData.nodes.length === 0) {
          addLine("error", "No nodes loaded. Is the server running?");
          break;
        }
        addLine("output", "Node types:");
        const counts: Record<string, number> = {};
        graphData.nodes.forEach((n) => {
          counts[n.kind] = (counts[n.kind] || 0) + 1;
        });
        kinds.forEach((kind) => {
          const count = counts[kind] || 0;
          addLine("output", `  ${kind.padEnd(14)} ${String(count).padStart(4)}`);
        });
        break;
      }

      case "stats": {
        const totalNodes = graphData.nodes.length;
        const totalEdges = graphData.edges.length;
        const avgEdges = totalNodes > 0 ? (totalEdges * 2 / totalNodes).toFixed(2) : "0";
        addLine("output", "Graph Statistics:");
        addLine("output", `  Total nodes: ${totalNodes}`);
        addLine("output", `  Total edges: ${totalEdges}`);
        addLine("output", `  Avg edges/node: ${avgEdges}`);
        addLine("output", `  Node types: ${kinds.length}`);
        if (serverInfo) {
          addLine("output", `  Server: v${serverInfo.version} (${Math.floor(serverInfo.uptime_seconds)}s uptime)`);
        }
        break;
      }

      case "search":
        if (args.length < 2) {
          addLine("error", "Usage: search <query>");
        } else {
          const query = args.slice(1).join(" ");
          addLine("output", `Searching for "${query}"...`);
          storeSearch(query).then(() => {
            const results = useGraphStore.getState().searchResults;
            addLine("output", `Found ${results.length} result${results.length !== 1 ? "s" : ""}:`);
            results.slice(0, 10).forEach((r) => {
              addLine("output", `  [${r.kind}] ${r.title} (${r.importance.toFixed(2)})`);
            });
            if (results.length > 10) {
              addLine("output", `  ... and ${results.length - 10} more`);
            }
          });
        }
        break;

      case "filter": {
        if (args.length < 2) {
          addLine("error", "Usage: filter <type|all>");
          addLine("output", `  Types: ${kinds.join(", ").toLowerCase()}, all`);
        } else {
          const filterArg = args[1];
          if (filterArg === "all") {
            setFilter("all");
            addLine("output", "Filter cleared — showing all nodes");
          } else {
            const match = kinds.find((k) => k.toLowerCase() === filterArg);
            if (match) {
              setFilter(match);
              const count = graphData.nodes.filter((n) => n.kind === match).length;
              addLine("output", `Filtering to: ${match} (${count} nodes)`);
            } else {
              addLine("error", `Unknown type: ${filterArg}`);
              addLine("output", `  Valid types: ${kinds.join(", ").toLowerCase()}, all`);
            }
          }
        }
        break;
      }

      case "select": {
        if (args.length < 2) {
          addLine("error", "Usage: select <partial title>");
        } else {
          const partial = args.slice(1).join(" ");
          const found = graphData.nodes.find((n) =>
            n.title.toLowerCase().includes(partial)
          );
          if (found) {
            selectNode(found);
            addLine("output", `Selected: [${found.kind}] ${found.title}`);
          } else {
            addLine("error", `No node found matching "${partial}"`);
          }
        }
        break;
      }

      case "reconnect":
        addLine("output", "Reconnecting...");
        connect().then(() => {
          const s = useGraphStore.getState();
          if (s.status === "connected") {
            addLine("output", `Connected! v${s.serverInfo?.version ?? "?"} — ${s.graphData.nodes.length} nodes loaded`);
          } else {
            addLine("error", `Connection failed: ${s.error ?? "unknown error"}`);
          }
        });
        break;

      case "history":
        if (history.length === 0) {
          addLine("output", "No command history");
        } else {
          addLine("output", "Recent commands:");
          history.slice(-5).forEach((h, i) => {
            addLine("output", `  ${i + 1}. ${h}`);
          });
        }
        break;

      case "":
        break;

      default:
        addLine("error", `Unknown command: ${command}`);
        addLine("output", "Type 'help' for available commands");
    }
  }, [addLine, history, setFilter, selectNode, graphData, kinds, status, serverInfo, connect, storeSearch]);

  const handleSubmit = useCallback((e: { preventDefault: () => void }) => {
    e.preventDefault();
    if (!input.trim()) return;

    addLine("input", `$ ${input}`);
    setHistory((prev) => [...prev, input]);
    setHistoryIndex(-1);
    handleCommand(input);
    setInput("");
  }, [input, addLine, handleCommand]);

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
                className="text-[7px] leading-[8px] text-primary/40 font-mono overflow-hidden select-none whitespace-pre"
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
                  line.type === "system" && "text-muted-foreground/50 italic"
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
        <span className="text-primary/50 font-mono text-[10px] select-none">$</span>
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="type a command..."
          className="flex-1 bg-transparent text-[11px] font-mono text-foreground/70 placeholder:text-muted-foreground/30 focus:outline-none caret-primary/60"
          autoComplete="off"
          spellCheck={false}
        />
      </form>
    </div>
  );
}
