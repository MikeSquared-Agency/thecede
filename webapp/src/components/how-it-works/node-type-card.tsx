interface NodeTypeCardProps {
  kind: string;
  color: string;
  description: string;
}

export function NodeTypeCard({ kind, color, description }: NodeTypeCardProps) {
  return (
    <div className="flex gap-4 items-stretch">
      <div
        className="w-[3px] shrink-0 rounded-sm min-h-[60px]"
        style={{ backgroundColor: color }}
      />
      <div className="flex-1 flex flex-col gap-1.5">
        <div className="flex items-center gap-2">
          <div
            className="size-[9px] rounded-full shrink-0"
            style={{ backgroundColor: color }}
          />
          <strong
            className="font-mono text-[0.72rem] uppercase"
            style={{ color }}
          >
            {kind}
          </strong>
        </div>
        <p className="text-[0.84rem] text-muted-foreground leading-[1.75]">
          {description}
        </p>
      </div>
    </div>
  );
}
