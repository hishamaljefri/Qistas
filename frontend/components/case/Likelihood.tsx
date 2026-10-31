import { ScaleIcon } from "@/components/brand/Logo";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { text } from "@/lib/text";
import type { Likelihood } from "@/lib/types";

const t = text.result;

// level 0..2 on the meter; the scale tilts toward the worker when the outcome is likely
const looks: Record<Likelihood, { tone: BadgeTone; level: number; tilt: number; bar: string }> = {
  منخفض: { tone: "danger", level: 0, tilt: 12, bar: "bg-danger" },
  متوسط: { tone: "warning", level: 1, tilt: 0, bar: "bg-warning" },
  مرتفع: { tone: "success", level: 2, tilt: -12, bar: "bg-success" },
};

/** Pill with a small tilted scale. Used on the result page and in My Cases. */
export function LikelihoodBadge({ value, className = "" }: { value: Likelihood; className?: string }) {
  const look = looks[value];
  return (
    <Badge tone={look.tone} className={className}>
      <ScaleIcon tilt={look.tilt} className="size-[18px]" />
      {value}
    </Badge>
  );
}

/** Three-step meter labelled منخفض / متوسط / مرتفع (never color only). */
export function LikelihoodMeter({ value }: { value: Likelihood }) {
  const look = looks[value];
  return (
    <div role="img" aria-label={t.likelihoodMeter(value)} className="grid grid-cols-3 gap-1.5">
      {t.levels.map((label, i) => (
        <div key={label} className="flex flex-col gap-1.5">
          <span className={`block h-2 rounded-full ${i <= look.level ? look.bar : "bg-line"}`} />
          <span className={`text-[13px] ${i === look.level ? "font-semibold text-text" : "text-muted"}`}>{label}</span>
        </div>
      ))}
    </div>
  );
}
