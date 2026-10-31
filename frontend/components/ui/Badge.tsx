import type { ReactNode } from "react";

const tones = {
  neutral: "bg-surface-muted text-muted font-medium",
  outline: "border border-line bg-surface-muted text-text",
  success: "bg-success-bg text-success",
  warning: "bg-warning-bg text-warning",
  danger: "bg-danger-bg text-danger",
};

export type BadgeTone = keyof typeof tones;

/** Pill label. Never the only signal: always has text. */
export function Badge({ tone = "neutral", children, className = "" }: { tone?: BadgeTone; children: ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-0.5 text-[13px] leading-6 font-semibold whitespace-nowrap ${tones[tone]} ${className}`}>
      {children}
    </span>
  );
}
