import type { ReactNode } from "react";

const tones = {
  neutral: "bg-surface-muted text-muted",
  success: "bg-surface-muted text-success",
  warning: "bg-surface-muted text-warning",
  danger: "bg-surface-muted text-danger",
};

export function Badge({ tone = "neutral", children }: { tone?: keyof typeof tones; children: ReactNode }) {
  return <span className={`inline-block rounded-control px-2 py-0.5 text-sm font-medium ${tones[tone]}`}>{children}</span>;
}
