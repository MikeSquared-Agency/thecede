"use client";

import { useRef, useEffect, useCallback, useState } from "react";
import type { CortexNode, CortexEdge } from "@/lib/types/cortex";
import { getKindColor } from "@/lib/types/cortex";
import { getNodeRadius, truncateTitle } from "@/lib/graph-utils";
import { useGraphStore } from "@/lib/stores/graphStore";
import { GraphControls } from "./graph-controls";

interface SimNode extends CortexNode {
  x?: number;
  y?: number;
  fx?: number | null;
  fy?: number | null;
  vx?: number;
  vy?: number;
  wobblePhase?: number;
  wobbleSpeed?: number;
  wobbleAmp?: number;
}

interface SimEdge {
  source: SimNode | string;
  target: SimNode | string;
  weight: number;
  relation: string;
}

interface GraphCanvasProps {
  nodes: CortexNode[];
  edges: CortexEdge[];
  recentEdgeKeys?: string[];
  highlightedNodeIds?: Set<string> | null;
}

export function GraphCanvas({ nodes, edges, recentEdgeKeys = [], highlightedNodeIds = null }: GraphCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const wobbleRef = useRef<number | null>(null);
  const zoomRef = useRef<ReturnType<typeof import("d3").zoom> | null>(null);
  const gRef = useRef<SVGGElement | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const recentEdgeKeysRef = useRef(recentEdgeKeys);
  recentEdgeKeysRef.current = recentEdgeKeys;
  // D3 selection refs for search transition animations
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const nodeSelRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const linkSelRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const labelSelRef = useRef<any>(null);
  const simNodesRef = useRef<SimNode[]>([]);
  const prevHighlightRef = useRef<Set<string> | null>(null);
  const selectNode = useGraphStore((s) => s.selectNode);
  const selectedNode = useGraphStore((s) => s.selectedNode);
  const [d3Loaded, setD3Loaded] = useState(false);

  const handleFitView = useCallback(() => {
    if (!svgRef.current || !zoomRef.current) return;
    import("d3").then((d3) => {
      const svg = d3.select(svgRef.current!);
      const width = svgRef.current!.clientWidth;
      const height = svgRef.current!.clientHeight;
      svg
        .transition()
        .duration(500)
        .ease(d3.easeCubicOut)
        .call(
          zoomRef.current!.transform as never,
          d3.zoomIdentity.translate(width / 2, height / 2).scale(0.8)
        );
    });
  }, []);

  const handleZoomIn = useCallback(() => {
    if (!svgRef.current || !zoomRef.current) return;
    import("d3").then((d3) => {
      const svg = d3.select(svgRef.current!);
      svg.transition().duration(250).ease(d3.easeCubicOut).call(zoomRef.current!.scaleBy as never, 1.4);
    });
  }, []);

  const handleZoomOut = useCallback(() => {
    if (!svgRef.current || !zoomRef.current) return;
    import("d3").then((d3) => {
      const svg = d3.select(svgRef.current!);
      svg.transition().duration(250).ease(d3.easeCubicOut).call(zoomRef.current!.scaleBy as never, 0.7);
    });
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    const svg = svgRef.current;
    const tooltip = tooltipRef.current;
    if (!container || !svg || !tooltip) return;

    let cleanup: (() => void) | undefined;

    (async () => {
      const d3 = await import("d3");
      setD3Loaded(true);

      const width = container.clientWidth;
      const height = container.clientHeight;

      d3.select(svg).selectAll("*").remove();

      const simNodes: SimNode[] = nodes.map((n) => ({
        ...n,
        wobblePhase: Math.random() * Math.PI * 2,
        wobbleSpeed: 0.3 + Math.random() * 0.7,
        wobbleAmp: 0.3 + Math.random() * 0.5,
      }));

      const simEdges: SimEdge[] = edges.map((e) => ({
        source: e.source,
        target: e.target,
        weight: e.weight,
        relation: e.relation,
      }));

      const svgSel = d3
        .select(svg)
        .attr("width", width)
        .attr("height", height)
        .attr("viewBox", [0, 0, width, height]);

      // Subtle glow filter for high-importance nodes
      const defs = svgSel.append("defs");
      const glowFilter = defs.append("filter").attr("id", "node-glow");
      glowFilter
        .append("feGaussianBlur")
        .attr("stdDeviation", 1.5)
        .attr("result", "coloredBlur");
      const feMerge = glowFilter.append("feMerge");
      feMerge.append("feMergeNode").attr("in", "coloredBlur");
      feMerge.append("feMergeNode").attr("in", "SourceGraphic");

      const zoom = d3
        .zoom<SVGSVGElement, unknown>()
        .scaleExtent([0.1, 6])
        .on("zoom", (event) => {
          g.attr("transform", event.transform);
        });

      svgSel.call(zoom);
      zoomRef.current = zoom as never;

      const g = svgSel.append("g");
      gRef.current = g.node();

      svgSel.call(
        zoom.transform,
        d3.zoomIdentity.translate(width / 2, height / 2).scale(0.8)
      );

      // Edges — gradient opacity based on weight
      const linkGroup = g
        .append("g")
        .selectAll("line")
        .data(simEdges)
        .join("line")
        .attr("stroke", (d) => {
          const sourceNode = simNodes.find((n) => n.id === (typeof d.source === "string" ? d.source : (d.source as SimNode).id));
          return sourceNode ? getKindColor(sourceNode.kind) : "#333";
        })
        .attr("stroke-width", (d) => Math.max(0.2, d.weight * 1.2))
        .attr("stroke-opacity", (d) => Math.max(0.04, d.weight * 0.15));

      // Auto-link animation: pulse recently created edges
      const recent = recentEdgeKeysRef.current;
      if (recent.length > 0) {
        linkGroup
          .filter((d) => {
            const s = typeof d.source === "string" ? d.source : (d.source as SimNode).id;
            const t = typeof d.target === "string" ? d.target : (d.target as SimNode).id;
            return recent.includes(`${s}:${t}`) || recent.includes(`${t}:${s}`);
          })
          .attr("stroke", "#a78bfa")
          .attr("stroke-width", 2.5)
          .attr("stroke-opacity", 0)
          .transition()
          .duration(400)
          .attr("stroke-opacity", 0.9)
          .transition()
          .delay(1200)
          .duration(1500)
          .attr("stroke-width", (d) => Math.max(0.2, (d as SimEdge).weight * 1.2))
          .attr("stroke-opacity", (d) => Math.max(0.04, (d as SimEdge).weight * 0.15));
      }

      // Node circles
      const nodeGroup = g
        .append("g")
        .selectAll("circle")
        .data(simNodes)
        .join("circle")
        .attr("r", (d) => getNodeRadius(d.importance))
        .attr("fill", (d) => getKindColor(d.kind))
        .attr("fill-opacity", (d) => 0.6 + d.importance * 0.4)
        .attr("stroke", (d) => getKindColor(d.kind))
        .attr("stroke-width", (d) => (d.importance > 0.8 ? 1.5 : 0.5))
        .attr("stroke-opacity", (d) => (d.importance > 0.8 ? 0.6 : 0.2))
        .attr("filter", (d) => (d.importance > 0.85 ? "url(#node-glow)" : null))
        .attr("cursor", "pointer")
        .on("mouseover", function (_event, d) {
          d3.select(this)
            .transition()
            .duration(150)
            .attr("stroke-opacity", 1)
            .attr("stroke-width", 2)
            .attr("fill-opacity", 1);

          tooltip.style.opacity = "1";
          tooltip.innerHTML = `
            <div class="tt-kind" style="color:${getKindColor(d.kind)}">${d.kind}</div>
            <div class="tt-title">${d.title}</div>
            <div class="tt-meta">${d.importance.toFixed(2)} imp · ${d.edges} edges</div>
          `;
        })
        .on("mousemove", (event) => {
          const rect = container.getBoundingClientRect();
          tooltip.style.left = `${event.clientX - rect.left + 14}px`;
          tooltip.style.top = `${event.clientY - rect.top - 10}px`;
        })
        .on("mouseout", function (_event, d) {
          d3.select(this)
            .transition()
            .duration(200)
            .attr("stroke-opacity", d.importance > 0.8 ? 0.6 : 0.2)
            .attr("stroke-width", d.importance > 0.8 ? 1.5 : 0.5)
            .attr("fill-opacity", 0.6 + d.importance * 0.4);

          tooltip.style.opacity = "0";
        })
        .on("click", (_event, d) => {
          selectNode(d);
        });

      // Labels — only show for higher importance nodes
      const labelGroup = g
        .append("g")
        .selectAll("text")
        .data(simNodes.filter((n) => n.importance > 0.65))
        .join("text")
        .text((d) => truncateTitle(d.title, 20))
        .attr("font-family", "var(--font-ibm-plex-mono), monospace")
        .attr("font-size", 7)
        .attr("fill", "#555")
        .attr("fill-opacity", 0.7)
        .attr("text-anchor", "middle")
        .attr("dy", (d) => getNodeRadius(d.importance) + 9)
        .attr("pointer-events", "none");

      // Drag
      const drag = d3
        .drag<SVGCircleElement, SimNode>()
        .on("start", (event, d) => {
          if (!event.active) simulation.alphaTarget(0.3).restart();
          d.fx = d.x;
          d.fy = d.y;
        })
        .on("drag", (event, d) => {
          d.fx = event.x;
          d.fy = event.y;
        })
        .on("end", (event, d) => {
          if (!event.active) simulation.alphaTarget(0);
          d.fx = null;
          d.fy = null;
        });

      nodeGroup.call(drag as never);

      // Store refs for search transition animations
      nodeSelRef.current = nodeGroup;
      linkSelRef.current = linkGroup;
      labelSelRef.current = labelGroup;
      simNodesRef.current = simNodes;

      const simulation = d3
        .forceSimulation(simNodes)
        .force(
          "link",
          d3
            .forceLink(simEdges)
            .id((d: unknown) => (d as SimNode).id)
            .distance((d) => 50 / ((d as SimEdge).weight || 0.5))
            .strength((d) => Math.min((d as SimEdge).weight, 0.8))
        )
        .force("charge", d3.forceManyBody().strength(-80))
        .force("center", d3.forceCenter(0, 0))
        .force(
          "collision",
          d3.forceCollide<SimNode>().radius((d) => getNodeRadius(d.importance) + 3)
        )
        .on("tick", () => {
          linkGroup
            .attr("x1", (d) => (d.source as SimNode).x ?? 0)
            .attr("y1", (d) => (d.source as SimNode).y ?? 0)
            .attr("x2", (d) => (d.target as SimNode).x ?? 0)
            .attr("y2", (d) => (d.target as SimNode).y ?? 0);

          nodeGroup.attr("cx", (d) => d.x ?? 0).attr("cy", (d) => d.y ?? 0);
          labelGroup.attr("x", (d) => d.x ?? 0).attr("y", (d) => d.y ?? 0);
        });

      // Wobble
      const startWobble = () => {
        let time = 0;
        const animate = () => {
          time += 0.016;
          simNodes.forEach((node) => {
            if (node.fx !== null && node.fx !== undefined) return;
            const phase = node.wobblePhase ?? 0;
            const speed = node.wobbleSpeed ?? 0.5;
            const amp = node.wobbleAmp ?? 0.4;
            if (node.x !== undefined) node.x += Math.sin(time * speed + phase) * amp * 0.08;
            if (node.y !== undefined) node.y += Math.cos(time * speed * 0.7 + phase) * amp * 0.08;
          });

          nodeGroup.attr("cx", (d) => d.x ?? 0).attr("cy", (d) => d.y ?? 0);
          labelGroup.attr("x", (d) => d.x ?? 0).attr("y", (d) => d.y ?? 0);
          linkGroup
            .attr("x1", (d) => (d.source as SimNode).x ?? 0)
            .attr("y1", (d) => (d.source as SimNode).y ?? 0)
            .attr("x2", (d) => (d.target as SimNode).x ?? 0)
            .attr("y2", (d) => (d.target as SimNode).y ?? 0);

          wobbleRef.current = requestAnimationFrame(animate);
        };
        wobbleRef.current = requestAnimationFrame(animate);
      };

      simulation.on("end", startWobble);

      cleanup = () => {
        simulation.stop();
        if (wobbleRef.current) cancelAnimationFrame(wobbleRef.current);
      };
    })();

    return () => { cleanup?.(); };
  }, [nodes, edges, selectNode, selectedNode]);

  // ── Search highlight transition ──
  // 3-phase animation: zoom out → dim non-matches → zoom to results
  useEffect(() => {
    if (!svgRef.current || !zoomRef.current) return;
    if (!nodeSelRef.current || !linkSelRef.current) return;

    let cancelled = false;

    (async () => {
      const d3 = await import("d3");
      if (cancelled) return;

      const svg = d3.select(svgRef.current!);
      const zoom = zoomRef.current!;
      const width = svgRef.current!.clientWidth;
      const height = svgRef.current!.clientHeight;

      if (highlightedNodeIds && highlightedNodeIds.size > 0) {
        prevHighlightRef.current = highlightedNodeIds;

        // Phase 1: Zoom out to reveal full graph
        svg
          .transition("search-phase1")
          .duration(500)
          .ease(d3.easeCubicOut)
          .call(
            zoom.transform as never,
            d3.zoomIdentity.translate(width / 2, height / 2).scale(0.5)
          );

        await new Promise((r) => setTimeout(r, 540));
        if (cancelled) return;

        // Phase 2: Dim non-matching nodes, brighten matched ones
        nodeSelRef.current
          .transition("search-phase2")
          .duration(400)
          .ease(d3.easeCubicOut)
          .attr("fill-opacity", (d: SimNode) =>
            highlightedNodeIds.has(d.id) ? 1 : 0.06
          )
          .attr("stroke-opacity", (d: SimNode) =>
            highlightedNodeIds.has(d.id) ? 1 : 0.03
          )
          .attr("r", (d: SimNode) =>
            highlightedNodeIds.has(d.id)
              ? getNodeRadius(d.importance) * 1.3
              : getNodeRadius(d.importance) * 0.6
          );

        linkSelRef.current
          .transition("search-phase2")
          .duration(400)
          .attr("stroke-opacity", (d: SimEdge) => {
            const sId =
              typeof d.source === "string"
                ? d.source
                : (d.source as SimNode).id;
            const tId =
              typeof d.target === "string"
                ? d.target
                : (d.target as SimNode).id;
            return highlightedNodeIds.has(sId) && highlightedNodeIds.has(tId)
              ? 0.35
              : 0.01;
          });

        if (labelSelRef.current) {
          labelSelRef.current
            .transition("search-phase2")
            .duration(400)
            .attr("fill-opacity", (d: SimNode) =>
              highlightedNodeIds.has(d.id) ? 0.9 : 0.03
            );
        }

        await new Promise((r) => setTimeout(r, 450));
        if (cancelled) return;

        // Phase 3: Zoom to fit the highlighted nodes
        const matchingNodes = simNodesRef.current.filter((n) =>
          highlightedNodeIds.has(n.id)
        );
        if (matchingNodes.length === 0) return;

        const xs = matchingNodes.map((n) => n.x ?? 0);
        const ys = matchingNodes.map((n) => n.y ?? 0);
        const pad = 60;
        const minX = Math.min(...xs) - pad;
        const maxX = Math.max(...xs) + pad;
        const minY = Math.min(...ys) - pad;
        const maxY = Math.max(...ys) + pad;
        const bboxW = maxX - minX || 1;
        const bboxH = maxY - minY || 1;
        const scale = Math.min(width / bboxW, height / bboxH, 4) * 0.85;
        const cx = (minX + maxX) / 2;
        const cy = (minY + maxY) / 2;

        svg
          .transition("search-phase3")
          .duration(600)
          .ease(d3.easeCubicInOut)
          .call(
            zoom.transform as never,
            d3.zoomIdentity
              .translate(width / 2, height / 2)
              .scale(scale)
              .translate(-cx, -cy)
          );
      } else if (prevHighlightRef.current !== null) {
        // Search cleared — restore all nodes smoothly
        prevHighlightRef.current = null;

        nodeSelRef.current
          .transition("search-restore")
          .duration(400)
          .ease(d3.easeCubicOut)
          .attr("fill-opacity", (d: SimNode) => 0.6 + d.importance * 0.4)
          .attr("stroke-opacity", (d: SimNode) =>
            d.importance > 0.8 ? 0.6 : 0.2
          )
          .attr("r", (d: SimNode) => getNodeRadius(d.importance));

        linkSelRef.current
          .transition("search-restore")
          .duration(400)
          .attr("stroke-opacity", (d: SimEdge) =>
            Math.max(0.04, d.weight * 0.15)
          );

        if (labelSelRef.current) {
          labelSelRef.current
            .transition("search-restore")
            .duration(400)
            .attr("fill-opacity", 0.7);
        }

        svg
          .transition("search-restore-zoom")
          .delay(200)
          .duration(500)
          .ease(d3.easeCubicOut)
          .call(
            zoom.transform as never,
            d3.zoomIdentity.translate(width / 2, height / 2).scale(0.8)
          );
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [highlightedNodeIds]);

  return (
    <div ref={containerRef} className="relative size-full graph-bg">
      <svg ref={svgRef} className="size-full" />

      {/* Tooltip */}
      <div
        ref={tooltipRef}
        className="pointer-events-none absolute z-20 rounded-md border border-border bg-card/95 px-3 py-2 opacity-0 backdrop-blur-md transition-opacity duration-100"
        style={{ maxWidth: 300 }}
      >
        <style>{`
          .tt-kind { font-family: var(--font-ibm-plex-mono), monospace; font-size: 9px; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 2px; }
          .tt-title { font-size: 11px; font-weight: 500; color: var(--foreground); line-height: 1.3; margin-bottom: 3px; }
          .tt-meta { font-family: var(--font-ibm-plex-mono), monospace; font-size: 9px; color: var(--muted-foreground); font-variant-numeric: tabular-nums; }
        `}</style>
      </div>

      {d3Loaded && (
        <GraphControls
          onFitView={handleFitView}
          onZoomIn={handleZoomIn}
          onZoomOut={handleZoomOut}
        />
      )}
    </div>
  );
}
