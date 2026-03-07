"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Terminal as TerminalIcon } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useGraphStore } from "@/lib/stores/graphStore";
import { CORTEX_DATA } from "@/lib/data/cortex-data";
import { searchNodes } from "@/lib/graph-utils";
import type { NodeKind } from "@/lib/types/cortex";

const ASCII_BANNER = `██╗     ██╗██╗     ██╗   ██╗
██║     ██║██║     ╚██╗ ██╔╝
██║     ██║██║      ╚████╔╝
██║     ██║██║       ╚██╔╝
███████╗██║███████╗   ██║
╚══════╝╚═╝╚══════╝   ╚═╝   `;

const VALID_KINDS: NodeKind[] = ["Rule", "Fact", "Document", "Task", "Pattern", "Domain", "Tool"];

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
    { id: 1, type: "system", content: "Lily Cortex Graph Explorer v0.1.0", timestamp: new Date() },
    { id: 2, type: "output", content: "Type 'help' for commands.", timestamp: new Date() },
  ]);
  const [input, setInput] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const idCounter = useRef(3);

  const { setFilter, setSearchQuery, setSearchResults, selectNode } = useGraphStore();

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
        addLine("output", "  status    - Show graph status");
        addLine("output", "  nodes     - List node types with counts");
        addLine("output", "  search    - Search nodes (updates graph)");
        addLine("output", "  filter    - Filter by node type");
        addLine("output", "  select    - Select node by partial title");
        addLine("output", "  stats     - Graph statistics");
        addLine("output", "  suggest   - Send a suggestion to Lily");
        addLine("output", "  history   - Show command history");
        break;

      case "clear":
        setLines([]);
        break;

      case "status":
        addLine("output", "Cortex Status:");
        addLine("output", "  Graph: LOADED");
        addLine("output", `  Nodes: ${CORTEX_DATA.nodes.length}`);
        addLine("output", `  Edges: ${CORTEX_DATA.edges.length}`);
        addLine("output", "  Source: cortex export");
        break;

      case "nodes": {
        addLine("output", "Node types:");
        const counts: Record<string, number> = {};
        CORTEX_DATA.nodes.forEach((n) => {
          counts[n.kind] = (counts[n.kind] || 0) + 1;
        });
        VALID_KINDS.forEach((kind) => {
          const count = counts[kind] || 0;
          addLine("output", `  ${kind.padEnd(10)} ${String(count).padStart(3)}`);
        });
        break;
      }

      case "stats": {
        const totalNodes = CORTEX_DATA.nodes.length;
        const totalEdges = CORTEX_DATA.edges.length;
        const avgEdges = (totalEdges * 2 / totalNodes).toFixed(2);
        addLine("output", "Graph Statistics:");
        addLine("output", `  Total nodes: ${totalNodes}`);
        addLine("output", `  Total edges: ${totalEdges}`);
        addLine("output", `  Avg edges/node: ${avgEdges}`);
        addLine("output", `  Node types: ${VALID_KINDS.length}`);
        break;
      }

      case "search":
        if (args.length < 2) {
          addLine("error", "Usage: search <query>");
        } else {
          const query = args.slice(1).join(" ");
          const results = searchNodes(CORTEX_DATA.nodes, query);
          setSearchQuery(query);
          setSearchResults(results);
          addLine("output", `Found ${results.length} result${results.length !== 1 ? "s" : ""} for "${query}":`);
          results.forEach((r) => {
            addLine("output", `  [${r.kind}] ${r.title} (${r.importance.toFixed(2)})`);
          });
        }
        break;

      case "filter": {
        if (args.length < 2) {
          addLine("error", "Usage: filter <type|all>");
          addLine("output", `  Types: ${VALID_KINDS.join(", ").toLowerCase()}, all`);
        } else {
          const filterArg = args[1];
          if (filterArg === "all") {
            setFilter("all");
            addLine("output", "Filter cleared — showing all nodes");
          } else {
            const match = VALID_KINDS.find((k) => k.toLowerCase() === filterArg);
            if (match) {
              setFilter(match);
              addLine("output", `Filtering graph to: ${match}`);
            } else {
              addLine("error", `Unknown type: ${filterArg}`);
              addLine("output", `  Valid types: ${VALID_KINDS.join(", ").toLowerCase()}, all`);
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
          const found = CORTEX_DATA.nodes.find((n) =>
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

      case "suggest": {
        if (args.length < 2) {
          addLine("error", "Usage: suggest <message>");
        } else {
          const message = cmd.trim().slice(command.length).trim();
          const suggestion = {
            id: crypto.randomUUID(),
            name: "",
            message,
            timestamp: new Date().toISOString(),
          };
          const existing = JSON.parse(localStorage.getItem("lily-suggestions") || "[]");
          localStorage.setItem("lily-suggestions", JSON.stringify([suggestion, ...existing]));
          addLine("output", "Got it. I'll read this in my next heartbeat cycle.");
        }
        break;
      }

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
  }, [addLine, history, setFilter, setSearchQuery, setSearchResults, selectNode]);

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
        <span className="ml-auto text-[8px] font-mono text-muted-foreground/30">v0.1.0</span>
      </div>

      {/* Output */}
      <ScrollArea className="flex-1 min-h-0">
        <div className="px-3 py-2 font-mono text-[11px] flex flex-col gap-px">
          {lines.map((line) =>
            line.type === "ascii" ? (
              <pre
                key={line.id}
                className="text-[4px] leading-[4.5px] text-primary/50 font-mono overflow-hidden select-none"
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
