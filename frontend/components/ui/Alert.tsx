import type { ReactNode } from "react";

export function Alert({ tone = "neutral", children }: { tone?: "neutral" | "danger" | "warning"; children: ReactNode }) {
  const look = { neutral: "text-muted", danger: "text-danger", warning: "text-warning" }[tone];
  return <div className={`rounded-control border border-line bg-surface-muted p-3 text-sm ${look}`}>{children}</div>;
}
