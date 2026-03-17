"use client";

import { useGraphStore } from "@/lib/stores/graphStore";
import { getKindColor, KIND_LABELS } from "@/lib/types/cortex";

export default function AboutPage() {
  const kinds = useGraphStore((s) => s.kinds);
  const graphData = useGraphStore((s) => s.graphData);
  const status = useGraphStore((s) => s.status);
  const serverInfo = useGraphStore((s) => s.serverInfo);

  const counts: Record<string, number> = {};
  graphData.nodes.forEach((n) => {
    counts[n.kind] = (counts[n.kind] || 0) + 1;
  });

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-[700px] px-6 py-8 flex flex-col gap-12">
        {/* Hero */}
        <section className="relative -mx-6 -mt-8 px-6 py-12 pb-10 border-b border-border bg-gradient-to-b from-[#0d0d0d] to-background text-center">
          <div className="mx-auto max-w-[580px] flex flex-col items-center gap-5">
            <span className="font-mono text-[0.65rem] uppercase tracking-[0.14em] text-primary">
              What is this?
            </span>
            <h1
              className="font-semibold text-foreground leading-[1.15]"
              style={{
                fontSize: "clamp(1.8rem, 4vw, 2.6rem)",
                letterSpacing: "-0.03em",
              }}
            >
              Cortex Graph Explorer
            </h1>
            <p className="text-sm text-muted-foreground leading-[1.85] max-w-[580px]">
              A real-time interactive visualization of a live Cortex knowledge
              graph. Every dot is a node — a fact, a rule, a decision, an
              observation. Every line is a connection the agent discovered or
              created. This is not a demo. It&apos;s the actual graph, rendered
              live from{" "}
              <code className="font-mono text-[0.82rem] text-primary">
                cortex serve
              </code>
              .
            </p>
          </div>
        </section>

        {/* What is Cortex */}
        <section className="flex flex-col gap-3">
          <span className="font-mono text-[0.62rem] uppercase tracking-[0.12em] text-muted-foreground">
            01
          </span>
          <h2
            className="text-[1.2rem] font-bold text-foreground"
            style={{ letterSpacing: "-0.01em" }}
          >
            What Cortex is
          </h2>
          <div className="flex flex-col gap-3 text-[0.88rem] text-muted-foreground leading-[1.9]">
            <p>
              Cortex is an embedded graph memory engine for AI agents. It runs
              locally as a single binary — no cloud, no external database. Agents
              write nodes and edges during work. At the start of every session,
              they search Cortex to recover full context in seconds.
            </p>
            <p>
              The graph stores facts, rules, decisions, tasks, patterns,
              observations, and any other kind of knowledge. Cortex discovers
              connections automatically through its auto-linker, which runs
              similarity rules, decay, and deduplication in the background.
            </p>
            <p>
              Trust is computed from graph topology at query time —
              corroboration, contradiction, source reliability, freshness — never
              stored as a static field.
            </p>
          </div>
        </section>

        {/* Node types — dynamic from live data */}
        <section className="flex flex-col gap-3">
          <span className="font-mono text-[0.62rem] uppercase tracking-[0.12em] text-muted-foreground">
            02
          </span>
          <h2
            className="text-[1.2rem] font-bold text-foreground"
            style={{ letterSpacing: "-0.01em" }}
          >
            What&apos;s in this graph
          </h2>

          {kinds.length > 0 ? (
            <div className="flex flex-col gap-3">
              {kinds.map((kind) => (
                <div
                  key={kind}
                  className="rounded-lg border border-border bg-card/50 p-4 flex flex-col gap-1.5"
                  style={{ borderLeftColor: getKindColor(kind), borderLeftWidth: 3 }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span
                        className="size-[8px] rounded-full"
                        style={{ backgroundColor: getKindColor(kind) }}
                      />
                      <span
                        className="font-mono text-[11px] font-semibold uppercase tracking-wider"
                        style={{ color: getKindColor(kind) }}
                      >
                        {kind}
                      </span>
                    </div>
                    <span className="font-mono text-[10px] tabular-nums text-muted-foreground/60">
                      {counts[kind] ?? 0} nodes
                    </span>
                  </div>
                  {KIND_LABELS[kind.toLowerCase()] && (
                    <p className="text-[0.82rem] text-muted-foreground leading-[1.7]">
                      {KIND_LABELS[kind.toLowerCase()]}
                    </p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[0.88rem] text-muted-foreground leading-[1.9]">
              {status === "connected"
                ? "No nodes in the graph yet. Create some with the Cortex API or CLI."
                : "Connect to a Cortex server to see what's in the graph."}
            </p>
          )}
        </section>

        {/* Live stats */}
        <section className="flex flex-col gap-3">
          <span className="font-mono text-[0.62rem] uppercase tracking-[0.12em] text-muted-foreground">
            03
          </span>
          <h2
            className="text-[1.2rem] font-bold text-foreground"
            style={{ letterSpacing: "-0.01em" }}
          >
            Live statistics
          </h2>

          <div className="rounded-lg border border-border bg-card/80 p-5">
            <div className="grid grid-cols-2 gap-y-3 gap-x-8">
              <Stat label="Nodes" value={graphData.nodes.length} />
              <Stat label="Edges" value={graphData.edges.length} />
              <Stat label="Node types" value={kinds.length} />
              <Stat
                label="Avg edges/node"
                value={
                  graphData.nodes.length > 0
                    ? ((graphData.edges.length * 2) / graphData.nodes.length).toFixed(1)
                    : "—"
                }
              />
              <Stat label="Connection" value={status} />
              <Stat label="Server version" value={serverInfo?.version ?? "—"} />
            </div>
          </div>
        </section>

        {/* Terminal CTA */}
        <section className="flex flex-col items-center text-center gap-4 py-8">
          <span className="font-mono text-[0.62rem] uppercase tracking-[0.12em] text-muted-foreground">
            Explore
          </span>
          <h3
            className="text-[1.2rem] font-bold text-foreground"
            style={{ letterSpacing: "-0.01em" }}
          >
            Use the terminal below
          </h3>
          <p className="text-[0.88rem] text-muted-foreground leading-[1.9] max-w-[520px]">
            Type{" "}
            <code className="font-mono text-primary text-[0.82rem]">help</code>{" "}
            to see available commands. You can search nodes, filter by type,
            inspect individual memories, and check connection status — all from
            the terminal.
          </p>
        </section>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-muted-foreground/50">
        {label}
      </span>
      <span className="font-mono text-[14px] text-foreground/90 tabular-nums">
        {typeof value === "number" ? value.toLocaleString() : value}
      </span>
    </div>
  );
}
