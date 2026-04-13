import { streamText, tool } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { z } from "zod";
import {
  resolveJudgeCortex,
  extractSection,
  listSections,
  searchByKind,
  listNodes,
  cleanBody,
  nodeMeta,
} from "@/lib/cortex-server";

export const maxDuration = 120;

const SYSTEM_PROMPT = `You are a judge intelligence analyst specializing in Chancellor Kathaleen McCormick of the Delaware Court of Chancery. You have access to tools that query a knowledge graph containing her complete body of published opinions (307 opinions, 2019-2025), structured analyses of each opinion, her synthesised intelligence profile, and case documents from Desktop Metal v. Nano Dimension.

When answering questions:
- Ground every claim in specific opinions with case citations
- Note confidence tiers where available (high/medium/low)
- Use the tools to retrieve evidence before making claims
- When generating a ghost brief, retrieve the full profile and case evidence first

You are precise, analytical, and write like a litigation intelligence briefing — not a chatbot.`;

export async function POST(req: Request) {
  const { messages } = await req.json();

  const result = streamText({
    model: anthropic("claude-sonnet-4-20250514"),
    system: SYSTEM_PROMPT,
    messages,
    tools: {
      judge_profile: tool({
        description:
          "Return the intelligence profile for a judge. Available sections: summary_card, biographical_profile, doctrinal_commitments, busted_deal_pattern, rhetorical_patterns, procedural_tendencies, psychological_profile, citation_network, temporal_evolution, counsel_patterns.",
        inputSchema: z.object({
          judge_name: z.string().describe("Name of the judge (e.g. 'McCormick')"),
          section: z
            .string()
            .optional()
            .describe("Specific profile section to return"),
        }),
        execute: async ({ judge_name, section }) => {
          const [judge, cortexBody] = await resolveJudgeCortex(judge_name);
          if (!judge) return `Judge '${judge_name}' not found in the knowledge graph.`;
          if (!cortexBody)
            return `Found judge node for ${judge.title}, but no cortex profile has been generated yet.`;

          if (section) {
            const content = extractSection(cortexBody, section);
            if (content) return `## ${judge.title} — ${section}\n\n${content}`;
            const available = listSections(cortexBody);
            return `Section '${section}' not found. Available: ${available.join(", ")}`;
          }

          const summary = extractSection(cortexBody, "summary_card");
          const available = listSections(cortexBody);
          let result = `## ${judge.title} — Intelligence Profile\n\n`;
          if (summary) result += `### Summary\n${summary}\n\n`;
          result += `### Available sections\n${available.map((s) => `- ${s}`).join("\n")}`;
          return result;
        },
      }),

      query_judge: tool({
        description:
          "Search a judge's opinion analyses for evidence relevant to a legal question. Returns the most relevant opinion excerpts with case citations, dates, and relevance scores.",
        inputSchema: z.object({
          judge_name: z.string().describe("Name of the judge"),
          question: z.string().describe("Legal question to research"),
          limit: z.number().optional().default(5),
        }),
        execute: async ({ judge_name, question, limit }) => {
          const searchQuery = `${judge_name} ${question}`;
          const results = await searchByKind(searchQuery, "opinion-analysis", limit * 3);
          const opinionResults = await searchByKind(searchQuery, "opinion", limit);

          const parts = [`## Evidence for: ${question} (${judge_name})\n`];

          if (results.length > 0) {
            parts.push("### Opinion Analyses\n");
            for (const [i, r] of results.slice(0, limit).entries()) {
              const preview = cleanBody(r.node).slice(0, 500);
              parts.push(
                `**${i + 1}. ${r.node.title}** (relevance: ${r.score.toFixed(2)})\n${preview}\n`
              );
            }
          } else {
            parts.push("No opinion analyses found. ");
          }

          if (opinionResults.length > 0) {
            parts.push("\n### Relevant Opinions\n");
            for (const [i, r] of opinionResults.slice(0, 3).entries()) {
              const body = cleanBody(r.node);
              parts.push(
                `**${i + 1}. ${r.node.title}** (relevance: ${r.score.toFixed(2)})\n${body.slice(0, 800)}...\n`
              );
            }
          }

          return parts.join("\n");
        },
      }),

      predict_argument: tool({
        description:
          "Predict how a judge would respond to a specific legal argument. Returns the judge's relevant doctrinal positions and precedent opinions.",
        inputSchema: z.object({
          judge_name: z.string().describe("Name of the judge"),
          argument: z.string().describe("The legal argument to evaluate"),
          case_context: z.string().optional().default(""),
        }),
        execute: async ({ judge_name, argument, case_context }) => {
          const [judge, cortexBody] = await resolveJudgeCortex(judge_name);
          if (!judge) return `Judge '${judge_name}' not found.`;

          const parts = [`## Prediction context: ${argument.slice(0, 100)}...\n`];

          if (cortexBody) {
            for (const section of ["doctrinal_commitments", "busted_deal_pattern"]) {
              const content = extractSection(cortexBody, section);
              if (content) parts.push(`### ${section}\n${content}\n`);
            }
          }

          const searchQuery = case_context ? `${argument} ${case_context}` : argument;
          const results = await searchByKind(searchQuery, "opinion-analysis", 8);
          if (results.length > 0) {
            parts.push("### Relevant Precedent Analyses\n");
            for (const [i, r] of results.slice(0, 5).entries()) {
              const preview = cleanBody(r.node).slice(0, 600);
              parts.push(`**${i + 1}. ${r.node.title}**\n${preview}\n`);
            }
          }

          if (!cortexBody && results.length === 0) {
            return `Insufficient data to predict ${judge.title}'s response.`;
          }

          return parts.join("\n");
        },
      }),

      ghost_brief: tool({
        description:
          "Assemble the complete dossier for generating a judicial opinion in a judge's voice. Returns the judge's full intelligence profile plus curated case evidence.",
        inputSchema: z.object({
          case_name: z.string().describe("Name of the case (e.g. 'Desktop Metal')"),
          focus_issues: z
            .array(z.string())
            .optional()
            .default([])
            .describe("Key legal issues to focus on"),
          length: z
            .enum(["summary", "full"])
            .optional()
            .default("summary"),
        }),
        execute: async ({ case_name, focus_issues, length }) => {
          const [, cortexBody] = await resolveJudgeCortex("McCormick");
          const parts: string[] = [];

          // 1. Judge profile
          if (cortexBody) {
            parts.push("# JUDGE INTELLIGENCE PROFILE\n");
            if (length === "summary") {
              for (const [label, key] of [
                ["Summary", "summary_card"],
                ["Doctrinal Commitments", "doctrinal_commitments"],
                ["Busted Deal Pattern", "busted_deal_pattern"],
                ["Rhetorical Patterns", "rhetorical_patterns"],
              ] as const) {
                const content = extractSection(cortexBody, key);
                if (content) parts.push(`## ${label}\n${content}\n`);
              }
            } else {
              const cleanProfile = cortexBody.replace(/^<!--META:[\s\S]*?:META-->\n?/, "");
              parts.push(cleanProfile + "\n");
            }
          }

          // 2. Case record
          const caseResults = await searchByKind(case_name, "legal-case", 10);
          const caseTag = case_name.toLowerCase().replace(/\s+/g, "-").split(",")[0].slice(0, 20);
          let caseNode = caseResults.find((r) =>
            r.node.title.toLowerCase().includes(case_name.toLowerCase())
          )?.node;
          if (!caseNode && caseResults.length > 0) caseNode = caseResults[0].node;

          if (caseNode) {
            parts.push("# CASE RECORD\n");
            parts.push(`## Case: ${caseNode.title}\n`);
            parts.push(cleanBody(caseNode) + "\n");
          }

          // 3. Curated case documents
          const docLimit = length === "full" ? 30 : 15;
          const combinedQuery = focus_issues.length > 0
            ? focus_issues.join(" ")
            : `${case_name} CFIUS breach specific performance MAE`;

          const docs = await searchByKind(combinedQuery, "case-document", docLimit * 3);
          const filtered = docs.filter((d) => {
            const tags = d.node.tags ?? [];
            return tags.some((t: string) => t.includes(caseTag) || t === "desktop-metal");
          });

          const seen = new Set<string>();
          const deduped = filtered.filter((d) => {
            const key = d.node.title.toLowerCase().slice(0, 60);
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          }).slice(0, docLimit);

          if (deduped.length > 0) {
            parts.push(`\n## Curated Case Evidence (${deduped.length} documents)\n`);
            for (const [i, d] of deduped.entries()) {
              const meta = nodeMeta(d.node);
              const category = meta.category ?? "";
              const tier = meta.relevance_tier ?? "";
              const deponent = meta.deponent ?? "";
              const body = cleanBody(d.node);
              const maxChars = length === "full" ? 2000 : 800;
              const excerpt = body.slice(0, maxChars) + (body.length > maxChars ? "..." : "");
              const label = `[${category}]${deponent ? ` (${deponent})` : ""}`;
              parts.push(`### ${i + 1}. ${label} ${d.node.title} (tier: ${tier})\n${excerpt}\n`);
            }
          }

          // 4. Case issues
          const issues = await listNodes("case-issue", "desktop-metal", 10);
          if (issues.length > 0) {
            parts.push("\n## Key Legal Issues\n");
            for (const issue of issues) parts.push(`- ${issue.title}\n`);
          }

          return parts.join("\n");
        },
      }),

      find_opinions: tool({
        description:
          "Search for judicial opinions by topic, optionally filtered by judge and date range.",
        inputSchema: z.object({
          query: z.string().describe("Topic or legal issue to search for"),
          judge_name: z.string().optional().default(""),
          date_from: z.string().optional().default(""),
          date_to: z.string().optional().default(""),
          limit: z.number().optional().default(10),
        }),
        execute: async ({ query, judge_name, date_from, date_to, limit }) => {
          const searchQuery = judge_name ? `${judge_name} ${query}` : query;
          const results = await searchByKind(searchQuery, "opinion-analysis", 50);

          const opinions: Array<{
            case_name: string;
            date: string;
            summary: string;
            issues: string[];
            score: number;
          }> = [];
          const seenOpIds = new Set<string>();

          for (const r of results) {
            let data;
            try {
              data = JSON.parse(cleanBody(r.node));
            } catch {
              continue;
            }

            const opId = String(data.opinion_id ?? "");
            if (seenOpIds.has(opId)) continue;
            seenOpIds.add(opId);

            const date = data.date ?? "";
            if (date_from && date && date < date_from) continue;
            if (date_to && date && date > date_to) continue;

            opinions.push({
              case_name: data.case_name ?? "Unknown",
              date,
              summary: (data.case_summary ?? "").slice(0, 300),
              issues: data.legal_issues ?? [],
              score: r.score,
            });

            if (opinions.length >= limit) break;
          }

          if (opinions.length === 0) return `No opinions found for query: ${query}`;

          const parts = [`## Opinions matching: ${query}\n`];
          for (const [i, o] of opinions.entries()) {
            parts.push(
              `**${i + 1}. ${o.case_name}**\n` +
              `   Date: ${o.date} | Relevance: ${o.score.toFixed(2)}\n` +
              `   Issues: ${o.issues.slice(0, 4).join(", ")}\n` +
              `   ${o.summary}...\n`
            );
          }
          return parts.join("\n");
        },
      }),

      trace_citations: tool({
        description:
          "Analyze a judge's citation patterns across their opinions.",
        inputSchema: z.object({
          judge_name: z.string().optional().default("McCormick"),
          topic: z.string().optional().default(""),
          limit: z.number().optional().default(20),
        }),
        execute: async ({ judge_name, topic, limit }) => {
          const searchQuery = topic || `${judge_name} citation`;
          const results = await searchByKind(searchQuery, "opinion-analysis", limit);

          if (results.length === 0) return `No opinion analyses found for ${judge_name}.`;

          const citationCounts: Record<string, number> = {};
          const citationTypes: Record<string, number> = {};
          const allCitations: Array<{ from: string; to: string; type: string; context: string }> = [];

          for (const r of results) {
            let analysis;
            try {
              analysis = JSON.parse(cleanBody(r.node));
            } catch {
              continue;
            }

            for (const cite of analysis.citations_used ?? []) {
              const citedCase = cite.cited_case ?? "Unknown";
              const citeType = cite.citation_type ?? "approve";
              const context = (cite.context ?? "").slice(0, 200);

              citationCounts[citedCase] = (citationCounts[citedCase] ?? 0) + 1;
              citationTypes[citeType] = (citationTypes[citeType] ?? 0) + 1;
              allCitations.push({ from: r.node.title, to: citedCase, type: citeType, context });
            }
          }

          const parts = [`## Citation patterns for ${judge_name}\n`];
          parts.push(`Analyzed ${results.length} opinion analyses.\n`);

          if (Object.keys(citationTypes).length > 0) {
            parts.push("### Citation types\n");
            for (const [t, c] of Object.entries(citationTypes).sort(([, a], [, b]) => b - a)) {
              parts.push(`- ${t}: ${c}\n`);
            }
          }

          if (Object.keys(citationCounts).length > 0) {
            parts.push("\n### Most-cited cases\n");
            const sorted = Object.entries(citationCounts).sort(([, a], [, b]) => b - a).slice(0, 15);
            for (const [name, count] of sorted) {
              parts.push(`- ${name}: cited ${count} times\n`);
            }
          }

          if (allCitations.length > 0) {
            parts.push(`\n### Individual citations (${allCitations.length} total)\n`);
            for (const cite of allCitations.slice(0, 20)) {
              parts.push(`- **${cite.from}** → ${cite.to} [${cite.type}]\n  ${cite.context}\n`);
            }
          }

          return parts.join("\n");
        },
      }),
    },
  });

  return result.toUIMessageStreamResponse();
}
