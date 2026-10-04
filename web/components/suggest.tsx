"use client";

// A row of suggestions under a field: press one and the field (or the whole form) is filled with
// something real to start from. Everything stays editable afterwards.

import * as React from "react";

import { cn } from "@/lib/utils";

export function Suggest<T>({
  label = "Suggestions",
  options,
  onPick,
  disabled,
  className,
}: {
  label?: string;
  options: { label: string; value: T }[];
  onPick: (value: T) => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
      {label ? <span className="mr-1 font-mono text-[11px] text-muted-foreground">{label}:</span> : null}
      {options.map((o) => (
        <button
          key={o.label}
          type="button"
          disabled={disabled}
          onClick={() => onPick(o.value)}
          className="group inline-flex cursor-pointer items-center gap-1 rounded-[3px] border border-white/15 bg-black/20 px-2 py-1 font-mono text-[11px] leading-4 text-foreground/80 transition-colors duration-150 hover:border-brand-secondary/60 hover:bg-brand-secondary/[0.06] hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50"
        >
          <span aria-hidden className="text-brand-secondary">
            +
          </span>
          {o.label}
        </button>
      ))}
    </div>
  );
}
