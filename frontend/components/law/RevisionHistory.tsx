import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { formatDateTime } from "@/lib/format";
import { text } from "@/lib/text";
import type { LawRevision } from "@/lib/types";

const t = text.law;

const show = (field: string, value: string | null) => (value === null ? t.empty : field === "status" ? text.status[value] : value);

/** Who changed what, when and why: newest first, long texts behind a disclosure. */
export function RevisionHistory({ history }: { history: LawRevision[] }) {
  return (
    <Card id="history" title={t.history}>
      {history.length === 0 ? (
        <p className="text-muted">{t.historyEmpty}</p>
      ) : (
        <ol className="flex flex-col">
          {history.map((h, i) => (
            <li key={i} className="flex flex-col gap-2 border-b border-line py-4 first:pt-0 last:border-0 last:pb-0">
              <p className="tabular flex flex-wrap items-center gap-x-2 text-sm text-muted">
                <Icon name="clock" className="size-4" />
                <span className="font-semibold text-text">{t.actions[h.action]}</span>
                <span>{formatDateTime(h.changed_at)}</span>
                <span>
                  · <bdi>{t.by(h.changed_by)}</bdi>
                </span>
              </p>
              <p className="leading-[1.8]">{h.reason}</p>
              <ul className="flex flex-col gap-1.5 text-sm">
                {Object.entries(h.changes).map(([field, [before, after]]) =>
                  field === "text" ? (
                    <li key={field}>
                      <details>
                        <summary className="inline-flex min-h-9 items-center gap-1.5 font-semibold text-primary">
                          {t.fields.text}: {t.showTexts}
                          <Icon name="chevronDown" className="q-chev size-4 transition-transform" />
                        </summary>
                        <div className="mt-2 grid gap-2 md:grid-cols-2">
                          {[
                            [t.before, before],
                            [t.after, after],
                          ].map(([label, value]) => (
                            <div key={label} className="rounded-control bg-surface-muted p-3">
                              <p className="mb-1 font-semibold text-muted">{label}</p>
                              <p className="leading-[1.9] whitespace-pre-line">{value ?? t.empty}</p>
                            </div>
                          ))}
                        </div>
                      </details>
                    </li>
                  ) : (
                    <li key={field} className="leading-[1.8]">
                      <span className="font-semibold">{t.fields[field] ?? field}: </span>
                      {before !== null && <span className="text-muted line-through">{show(field, before)}</span>}
                      {before !== null && " ← "}
                      <span>{show(field, after)}</span>
                    </li>
                  ),
                )}
              </ul>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}
