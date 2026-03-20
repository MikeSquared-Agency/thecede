import { HeroSection } from "@/components/how-it-works/hero-section";
import { ChapterSection } from "@/components/how-it-works/chapter-section";
import { NodeTypeCard } from "@/components/how-it-works/node-type-card";

const NODE_TYPES = [
  {
    kind: "Rules",
    color: "#FF6B35",
    description:
      'Values and constraints, written as code. "Never use em dashes in outreach." "Join communities to help, not to promote." Rules are written when the agent learns something that should always or never happen. When everything else is uncertain, rules are what it falls back on. They override everything.',
  },
  {
    kind: "Facts",
    color: "#FFB800",
    description:
      'The current state of the world as the agent understands it. "Waitlist has 4 real signups." "GitHub rate limit resets at 23:57 UTC." Facts go stale. When they do, the agent writes a new fact and links it to the old one. The graph carries the history.',
  },
  {
    kind: "Documents",
    color: "#4ECDC4",
    description:
      "Everything the agent has read, written, or researched at length. Strategy documents, skill guides, published content. Documents are what the agent reads before acting, not after.",
  },
  {
    kind: "Tasks",
    color: "#FF6B6B",
    description:
      "The backlog. Things that still need doing. Each heartbeat cycle the agent searches Cortex for the highest-priority incomplete task and executes it. The importance score and connections between nodes determine what matters most right now.",
  },
  {
    kind: "Patterns",
    color: "#A78BFA",
    description:
      'Signals noticed more than once. "VSCode GitHub issues return 403 on reactions." "Clients push back on scope in week three, not week one." "New ecosystems have bug-heavy issue lists, not feature discussions." Patterns are how the agent stops making the same mistake twice.',
  },
  {
    kind: "Domains / Tools",
    color: "#60A5FA",
    description:
      "The platforms and tools used to do work. GitHub, Surge, Cloudflare, Cortex itself. Each one is a node with attached facts about credentials, limits, what broke, and what works. Tool nodes are what the agent checks first when something stops behaving as expected.",
  },
];

export default function HowItWorksPage() {
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-[700px] px-6 py-8 flex flex-col gap-12">
        <HeroSection />

        {/* Chapter 1 */}
        <ChapterSection
          number={1}
          title="The problem: AI agents that forget everything"
          paragraphs={[
            "Every time a new session starts, a standard AI agent wakes up with no memory of what happened before. No context. No history. No idea what it was working on yesterday. For a human that would be terrifying. For most AI assistants, it's just the default.",
            "Complex work — building products, finding customers, hitting revenue targets — takes weeks of continuous effort. You can't do weeks of work in a series of amnesiac one-hour sessions.",
            "That's why Cortex exists. It gives agents a persistent brain — a graph memory that survives across sessions.",
          ]}
        />

        {/* Chapter 2 */}
        <ChapterSection
          number={2}
          title="What Cortex actually is"
          variant="card-dark"
          paragraphs={[
            "Cortex is an embedded graph database that runs on the same machine as the agent. Every time the agent learns something, makes a decision, hits a blocker, or finishes a task, it writes a node. Every connection between two things becomes an edge.",
            "When a new session starts, the agent searches Cortex first. It finds out what it was working on, what decisions were made, what rules it set for itself, and what facts are currently true. In about 30 seconds it has enough context to pick up exactly where it left off.",
            "The graph you see on the Graph tab is the agent's entire memory, rendered live. Right now. As you read this.",
          ]}
        />

        {/* Chapter 3 */}
        <ChapterSection
          number={3}
          title="The types of knowledge in the graph"
          paragraphs={[]}
        >
          <div className="flex flex-col gap-4">
            {NODE_TYPES.map((node) => (
              <NodeTypeCard
                key={node.kind}
                kind={node.kind}
                color={node.color}
                description={node.description}
              />
            ))}
          </div>
        </ChapterSection>

        {/* Chapter 4 */}
        <ChapterSection
          number={4}
          title="How size and connections work"
          variant="card-amber"
          paragraphs={[
            'Every node has an importance score between 0 and 1, assigned by the agent when the node is created. A critical rule might be 0.99. A routine log entry might be 0.5. The score shapes how the graph looks — bigger dots carry more weight in the agent\'s decisions.',
            "Connections are equally important. A task connected to a high-importance blocker fact with three edges gets prioritised over a task sitting in isolation. The graph is how the agent reasons, not just how it stores things.",
            "The Graph tab renders nodes by importance with their real connections using D3.js. Zoom in to see the clusters where most of the agent's thinking happens.",
          ]}
        />

        {/* CTA */}
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
            to see available commands. Search nodes, filter by type, inspect
            individual memories, and check connection status — all from the
            terminal.
          </p>
        </section>
      </div>
    </div>
  );
}
