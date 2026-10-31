import type { ReactNode } from "react";
import { ScaleIcon } from "./Logo";

/** Dashed box with the muted, tilted scale (the only illustration in the app). */
export function EmptyState({ title, body, children }: { title: string; body: string; children?: ReactNode }) {
  return (
    <section className="flex flex-col items-center gap-3.5 rounded-card border border-dashed border-line-strong bg-surface px-6 py-14 text-center">
      <ScaleIcon tilt={12} className="size-16 text-line-strong" />
      <h2 className="text-[21px] font-semibold">{title}</h2>
      <p className="max-w-[460px] leading-[1.8] text-muted">{body}</p>
      {children}
    </section>
  );
}
