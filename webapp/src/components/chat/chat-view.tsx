"use client";

import { useChat } from "@ai-sdk/react";
import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";

const SUGGESTIONS = [
  "Tell me about Chancellor McCormick's approach to busted deal cases",
  "How does McCormick handle buyers trying to walk away from signed merger agreements?",
  "Predict how McCormick would respond to a hell-or-high-water breach argument",
  "Generate the opinion McCormick would write in Desktop Metal v. Nano Dimension",
  "Show me McCormick's citation patterns in deal enforcement cases",
];

export function ChatView() {
  const { messages, sendMessage, status } = useChat();
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const isLoading = status === "streaming" || status === "submitted";

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const send = (text: string) => {
    if (!text.trim() || isLoading) return;
    sendMessage({ text });
    setInput("");
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  };

  return (
    <div className="flex h-full flex-col">
      <ScrollArea className="flex-1 min-h-0">
        <div className="mx-auto max-w-3xl px-4 py-6">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center gap-8 pt-16">
              <div className="flex flex-col items-center gap-3">
                <span className="font-mono text-[11px] uppercase tracking-[0.15em] text-muted-foreground/40">
                  Judge Intelligence
                </span>
                <h1 className="font-mono text-lg font-medium text-foreground/80">
                  Chancellor McCormick
                </h1>
                <p className="font-mono text-[11px] text-muted-foreground/50 text-center max-w-md leading-relaxed">
                  307 opinions analysed. Ask about her doctrinal positions,
                  predict her response to arguments, or generate a ghost brief.
                </p>
              </div>
              <div className="flex flex-col gap-2 w-full max-w-lg">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="text-left px-3 py-2 rounded-md border border-border/50 bg-card/30 font-mono text-[11px] text-muted-foreground/70 hover:bg-card/60 hover:border-border hover:text-foreground/70 transition-all duration-150"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={cn(
                    "flex gap-3",
                    m.role === "user" ? "justify-end" : "justify-start"
                  )}
                >
                  {m.role === "assistant" && (
                    <div className="mt-1 flex size-6 shrink-0 items-center justify-center rounded border border-border bg-card">
                      <span className="font-mono text-[9px] text-primary/60">JI</span>
                    </div>
                  )}
                  <div
                    className={cn(
                      "max-w-[85%] rounded-md px-3 py-2 font-mono text-[12px] leading-relaxed",
                      m.role === "user"
                        ? "bg-primary/10 text-foreground/80 border border-primary/20"
                        : "bg-card/50 text-foreground/70 border border-border/50"
                    )}
                  >
                    <div className="whitespace-pre-wrap break-words">
                      {m.parts?.map((part, i) => {
                        if (part.type === "text") return <span key={i}>{part.text}</span>;
                        if (part.type.startsWith("tool-")) {
                          const toolName = "toolCallId" in part ? part.type.replace(/^tool-/, "") : "unknown";
                          const state = "state" in part ? (part as { state: string }).state : "";
                          return (
                            <div
                              key={i}
                              className="my-2 rounded border border-border/30 bg-background/30 px-2 py-1"
                            >
                              <span className="text-[9px] uppercase tracking-wider text-muted-foreground/40">
                                {state === "result"
                                  ? `tool: ${toolName}`
                                  : `calling ${toolName}...`}
                              </span>
                            </div>
                          );
                        }
                        return null;
                      })}
                    </div>
                  </div>
                  {m.role === "user" && (
                    <div className="mt-1 flex size-6 shrink-0 items-center justify-center rounded border border-border bg-card">
                      <span className="font-mono text-[9px] text-muted-foreground/60">
                        You
                      </span>
                    </div>
                  )}
                </div>
              ))}
              {isLoading && messages[messages.length - 1]?.role === "user" && (
                <div className="flex gap-3">
                  <div className="mt-1 flex size-6 shrink-0 items-center justify-center rounded border border-border bg-card">
                    <span className="font-mono text-[9px] text-primary/60">JI</span>
                  </div>
                  <div className="rounded-md border border-border/50 bg-card/50 px-3 py-2">
                    <div className="flex items-center gap-1">
                      <span className="size-1.5 rounded-full bg-primary/40 animate-pulse" />
                      <span
                        className="size-1.5 rounded-full bg-primary/40 animate-pulse"
                        style={{ animationDelay: "0.2s" }}
                      />
                      <span
                        className="size-1.5 rounded-full bg-primary/40 animate-pulse"
                        style={{ animationDelay: "0.4s" }}
                      />
                    </div>
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="border-t border-border bg-card/30 px-4 py-3">
        <div className="mx-auto flex max-w-3xl items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Ask about McCormick..."
            rows={1}
            className="flex-1 resize-none rounded-md border border-border bg-background/50 px-3 py-2 font-mono text-[12px] text-foreground/80 placeholder:text-muted-foreground/30 focus:outline-none focus:border-primary/30 focus:ring-1 focus:ring-primary/20"
          />
          <button
            onClick={() => send(input)}
            disabled={isLoading || !input.trim()}
            className="rounded-md border border-primary/20 bg-primary/5 px-4 py-2 font-mono text-[10px] uppercase tracking-wider text-primary hover:bg-primary/10 disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-150"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
