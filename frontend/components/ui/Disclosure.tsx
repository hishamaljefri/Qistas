import type { ReactNode } from "react";
import { Icon } from "./Icon";

/** Accordion row built on native <details> (keyboard and screen-reader support for free). */
export function Disclosure({ title, defaultOpen = false, children }: { title: ReactNode; defaultOpen?: boolean; children: ReactNode }) {
  return (
    <details open={defaultOpen} className="overflow-hidden rounded-2xl border border-line bg-surface">
      <summary className="flex min-h-[60px] items-center justify-between gap-3 px-[22px] text-[17px] font-semibold">
        {title}
        <Icon name="chevronDown" className="q-chev size-5 text-muted transition-transform" />
      </summary>
      <div className="max-w-[70ch] px-[22px] pb-[22px] leading-[2]">{children}</div>
    </details>
  );
}
