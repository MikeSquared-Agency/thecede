"use client";

import { useEffect, useCallback } from "react";
import {
  registerWebMCPTools,
  unregisterWebMCPTools,
  isWebMCPSupported,
} from "@/lib/webmcp";
import { useGraphStore } from "@/lib/stores/graphStore";

/**
 * WebMCPProvider
 *
 * Registers imperative WebMCP tools on mount and cleans up on unmount.
 * Also renders declarative search & filter forms (hidden from visual UI but
 * discoverable by WebMCP agents via toolname/tooldescription attributes).
 *
 * Handles the `submit` event on declarative forms to bridge them into
 * the Zustand store (search query, filter kind).
 */
export function WebMCPProvider({ children }: { children: React.ReactNode }) {
  const search = useGraphStore((s) => s.search);
  const setFilter = useGraphStore((s) => s.setFilter);

  // Declarative form: search
  const handleSearchSubmit = useCallback(
    (e: Event) => {
      e.preventDefault();
      const form = e.target as HTMLFormElement;
      const data = new FormData(form);
      const query = String(data.get("query") ?? "");
      if (query.trim()) {
        search(query);
      }
      // Return result to agent if invoked by WebMCP
      const submitEvent = e as SubmitEvent & { agentInvoked?: boolean; respondWith?: (v: unknown) => void };
      if (submitEvent.agentInvoked && submitEvent.respondWith) {
        submitEvent.respondWith(`Search initiated for: "${query}"`);
      }
    },
    [search]
  );

  // Declarative form: filter
  const handleFilterSubmit = useCallback(
    (e: Event) => {
      e.preventDefault();
      const form = e.target as HTMLFormElement;
      const data = new FormData(form);
      const kind = String(data.get("kind") ?? "all");
      setFilter(kind);
      const submitEvent = e as SubmitEvent & { agentInvoked?: boolean; respondWith?: (v: unknown) => void };
      if (submitEvent.agentInvoked && submitEvent.respondWith) {
        submitEvent.respondWith(`Filter set to: "${kind}"`);
      }
    },
    [setFilter]
  );

  useEffect(() => {
    // Register imperative tools
    registerWebMCPTools();

    // Bind declarative form handlers
    const searchForm = document.getElementById("webmcp-search-form");
    const filterForm = document.getElementById("webmcp-filter-form");

    searchForm?.addEventListener("submit", handleSearchSubmit);
    filterForm?.addEventListener("submit", handleFilterSubmit);

    if (process.env.NODE_ENV === "development" && isWebMCPSupported()) {
      console.log("[thecede] WebMCP provider initialized");
    }

    return () => {
      unregisterWebMCPTools();
      searchForm?.removeEventListener("submit", handleSearchSubmit);
      filterForm?.removeEventListener("submit", handleFilterSubmit);
    };
  }, [handleSearchSubmit, handleFilterSubmit]);

  return (
    <>
      {children}

      {/* ─── Declarative WebMCP tool: search form ─── */}
      <form
        id="webmcp-search-form"
        {...{
          toolname: "search_graph_form",
          tooldescription:
            "Search the Cortex knowledge graph by typing a query. Submitting the form triggers a search and updates the graph view with matching results.",
        }}
        method="dialog"
        aria-hidden="true"
        className="webmcp-declarative-form"
        style={{ position: "absolute", left: "-9999px", width: "1px", height: "1px", overflow: "hidden" }}
      >
        <label htmlFor="webmcp-search-query">Search query</label>
        <input
          type="text"
          id="webmcp-search-query"
          name="query"
          {...{
            toolparamdescription:
              "Natural language search query for the knowledge graph (e.g. 'deployment architecture', 'user authentication rules')",
          }}
          placeholder="Search the knowledge graph..."
          required
          minLength={1}
        />
        <button type="submit">Search</button>
      </form>

      {/* ─── Declarative WebMCP tool: filter form ─── */}
      <form
        id="webmcp-filter-form"
        {...{
          toolname: "filter_graph_form",
          tooldescription:
            "Filter the knowledge graph visualization by node kind. Select a kind to show only those nodes, or 'all' to remove the filter.",
          toolautosubmit: "true",
        }}
        method="dialog"
        aria-hidden="true"
        className="webmcp-declarative-form"
        style={{ position: "absolute", left: "-9999px", width: "1px", height: "1px", overflow: "hidden" }}
      >
        <label htmlFor="webmcp-filter-kind">Node kind</label>
        <select
          id="webmcp-filter-kind"
          name="kind"
          {...{
            toolparamdescription:
              "The node kind to filter by. Options: 'all' (show everything), 'fact', 'document', 'entity', 'task', 'rule', 'pattern', 'decision', 'observation', 'goal', 'memory', 'skill', 'tool', 'domain'.",
          }}
        >
          <option value="all">All</option>
          <option value="fact">Facts</option>
          <option value="document">Documents</option>
          <option value="entity">Entities</option>
          <option value="task">Tasks</option>
          <option value="rule">Rules</option>
          <option value="pattern">Patterns</option>
          <option value="decision">Decisions</option>
          <option value="observation">Observations</option>
          <option value="goal">Goals</option>
          <option value="memory">Memories</option>
          <option value="skill">Skills</option>
          <option value="tool">Tools</option>
          <option value="domain">Domains</option>
        </select>
        <button type="submit">Filter</button>
      </form>
    </>
  );
}
