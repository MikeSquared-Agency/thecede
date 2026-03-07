"use client";

import { Maximize2, Plus, Minus } from "lucide-react";

interface GraphControlsProps {
  onFitView: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
}

export function GraphControls({ onFitView, onZoomIn, onZoomOut }: GraphControlsProps) {
  return (
    <div className="absolute bottom-3 left-3 z-10 flex items-center gap-px rounded-md border border-border bg-card/90 backdrop-blur-md overflow-hidden">
      <button
        onClick={onFitView}
        aria-label="Fit to view"
        className="p-1.5 text-muted-foreground/60 hover:text-foreground hover:bg-accent transition-colors duration-150"
      >
        <Maximize2 className="size-3" />
      </button>
      <div className="w-px h-4 bg-border" />
      <button
        onClick={onZoomIn}
        aria-label="Zoom in"
        className="p-1.5 text-muted-foreground/60 hover:text-foreground hover:bg-accent transition-colors duration-150"
      >
        <Plus className="size-3" />
      </button>
      <div className="w-px h-4 bg-border" />
      <button
        onClick={onZoomOut}
        aria-label="Zoom out"
        className="p-1.5 text-muted-foreground/60 hover:text-foreground hover:bg-accent transition-colors duration-150"
      >
        <Minus className="size-3" />
      </button>
    </div>
  );
}
