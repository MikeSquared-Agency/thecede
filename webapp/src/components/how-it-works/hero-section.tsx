export function HeroSection() {
  return (
    <section className="relative -mx-6 -mt-8 px-6 py-12 pb-10 border-b border-border bg-gradient-to-b from-[#0d0d0d] to-background text-center">
      <div className="mx-auto max-w-[580px] flex flex-col items-center gap-5">
        {/* Subtitle label */}
        <span className="font-mono text-[0.65rem] uppercase tracking-[0.14em] text-primary">
          How it works
        </span>

        {/* Hero headline with clamp sizing */}
        <h1
          className="font-semibold text-foreground leading-[1.15]"
          style={{
            fontSize: "clamp(1.8rem, 4vw, 2.6rem)",
            letterSpacing: "-0.03em",
          }}
        >
          This is what it looks like
          <br />
          inside an agent&apos;s head.
        </h1>

        {/* Description */}
        <p className="text-sm text-muted-foreground leading-[1.85] max-w-[580px]">
          Cortex is an embedded graph memory engine for AI agents. The graph
          on the Graph tab is a live knowledge graph. Every dot is something
          the agent knows. Every line is a connection it discovered. Built in
          real time, while the agent works. You&apos;re not looking at a demo.
        </p>
      </div>
    </section>
  );
}
