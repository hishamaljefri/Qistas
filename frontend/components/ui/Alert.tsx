import type { ReactNode } from "react";
import { Icon, type IconName } from "./Icon";

type Tone = "info" | "warning" | "danger" | "success";

const tones: Record<Tone, { box: string; accent: string; icon: IconName }> = {
  info: { box: "bg-surface-muted", accent: "text-muted", icon: "info" },
  warning: { box: "bg-warning-bg", accent: "text-warning", icon: "warning" },
  danger: { box: "bg-danger-bg", accent: "text-danger", icon: "error" },
  success: { box: "bg-success-bg", accent: "text-success", icon: "checkCircle" },
};

/** Icon + bold lead-in + sentence. Danger alerts are announced immediately (role="alert"). */
export function Alert({ tone = "info", title, children, className = "" }: { tone?: Tone; title?: ReactNode; children?: ReactNode; className?: string }) {
  const t = tones[tone];
  return (
    <div role={tone === "danger" ? "alert" : "status"} className={`flex items-start gap-3 rounded-[14px] px-4 py-3.5 text-[15px] leading-[1.7] text-text ${t.box} ${className}`}>
      <span className={`mt-0.5 ${t.accent}`}>
        <Icon name={t.icon} />
      </span>
      <div className="min-w-0">
        {title && <strong className={`font-semibold ${tone === "info" ? "" : t.accent}`}>{title} </strong>}
        {children}
      </div>
    </div>
  );
}
