"use client";
import { useMemo, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { Segmented } from "@/components/ui/Segmented";
import { alignMasked, maskedSegments } from "@/lib/masking";
import { text } from "@/lib/text";

const t = text.result;

/** "What was sent to the AI": the masked text (labels as chips) or the user's own text (real values highlighted). */
export function PrivacyReveal({ masked, original, counts }: { masked: string; original: string; counts: Record<string, number> }) {
  const [view, setView] = useState<"sent" | "original">("sent");
  const aligned = useMemo(() => alignMasked(masked, original), [masked, original]);
  const sent = useMemo(() => aligned ?? maskedSegments(masked), [aligned, masked]);
  const total = Object.values(counts).reduce((s, n) => s + n, 0);

  return (
    <Card id="privacy" size="sm" title={t.privacy} icon={<Icon name="shield" className="size-[22px] text-primary" />}>
      <p className="text-sm text-muted">{t.maskedCount(total)}</p>
      <Segmented
        label={t.viewLabel}
        value={view}
        onChange={setView}
        options={[
          { value: "sent", label: t.viewSent },
          { value: "original", label: t.viewOriginal },
        ]}
      />
      <p className="max-h-[22rem] overflow-y-auto rounded-control bg-surface-muted p-4 text-[15px] leading-[2] whitespace-pre-line">
        {view === "sent"
          ? sent.map((s, i) =>
              s.placeholder ? (
                <mark key={i} dir="ltr" className="rounded-md bg-primary px-1.5 py-px font-latin text-xs font-semibold text-primary-fg">
                  {s.placeholder}
                </mark>
              ) : (
                s.text
              ),
            )
          : aligned
            ? aligned.map((s, i) => (s.placeholder ? <mark key={i} className="px-1.5 font-semibold">{s.original}</mark> : s.text))
            : original}
      </p>
      {view === "original" && (
        <p className="flex items-center gap-2 text-[13px] text-muted">
          <Icon name="lock" className="size-4" />
          {t.originalNote}
        </p>
      )}
    </Card>
  );
}
