import { Card } from "@/components/ui/Card";
import { text } from "@/lib/text";
import type { Citation } from "@/lib/types";

const t = text.result;

/** Rows of the Ministry's violations table cited by the analysis. Information only: fines go to the state. */
export function EmployerFines({ items }: { items: Citation[] }) {
  return (
    <Card id="fines" size="sm" title={t.fines}>
      <p className="rounded-[10px] bg-surface-muted px-3.5 py-2.5 text-sm leading-[1.7]">
        <strong className="font-semibold">{t.finesNoteLead}</strong> {t.finesNote}
      </p>
      <ul className="flex flex-col">
        {items.map((v) => {
          // a violation row: its description, then the classification and one fine per firm size
          const [first, ...rest] = v.text.split("\n");
          return (
            <li key={v.record_id} className="flex flex-col gap-1 border-b border-line py-3 text-[15px] leading-[1.7] last:border-0">
              <span className="font-medium">{first}</span>
              {rest.length > 0 && (
                <ul className="tabular text-[13px] leading-[1.8] text-muted">
                  {rest.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
      <p className="text-[13px] text-muted">{t.finesSource}</p>
    </Card>
  );
}
