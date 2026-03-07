import { Card, CardContent } from "@/components/ui/card";

interface ChapterSectionProps {
  number: number;
  title: string;
  paragraphs: React.ReactNode[];
  children?: React.ReactNode;
  variant?: "default" | "card-dark" | "card-amber";
}

export function ChapterSection({
  number,
  title,
  paragraphs,
  children,
  variant = "default",
}: ChapterSectionProps) {
  const inner = (
    <>
      <div className="flex flex-col gap-3">
        <span className="font-mono text-[0.62rem] uppercase tracking-[0.12em] text-muted-foreground">
          Chapter {number}
        </span>
        <h2
          className="text-[1.2rem] font-bold text-foreground"
          style={{ letterSpacing: "-0.01em" }}
        >
          {title}
        </h2>
      </div>
      <div className="flex flex-col gap-3.5 mt-3.5">
        {paragraphs.map((p, i) => (
          <p
            key={i}
            className="text-[0.88rem] text-muted-foreground leading-[1.9]"
          >
            {p}
          </p>
        ))}
      </div>
      {children && <div className="mt-5">{children}</div>}
    </>
  );

  if (variant === "card-dark") {
    return (
      <Card className="bg-[#0d0d0d] border-border rounded-xl py-0">
        <CardContent className="px-7 py-7">{inner}</CardContent>
      </Card>
    );
  }

  if (variant === "card-amber") {
    return (
      <div
        className="rounded-xl border border-primary/12 p-7"
        style={{
          background:
            "linear-gradient(135deg, rgba(255,184,0,0.04) 0%, rgba(255,184,0,0.01) 100%)",
          boxShadow: "0 0 20px rgba(255,184,0,0.04)",
        }}
      >
        {inner}
      </div>
    );
  }

  return <article className="flex flex-col">{inner}</article>;
}
