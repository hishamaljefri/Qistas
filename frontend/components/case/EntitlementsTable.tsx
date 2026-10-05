import { formatSAR } from "@/lib/format";
import { text } from "@/lib/text";
import type { Entitlement } from "@/lib/types";

const t = text.result;

export function EntitlementsTable({ items, total }: { items: Entitlement[]; total: number | null }) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted">{t.entitlementsNote}</p>
      <ul className="space-y-3">
        {items.map((e, i) => (
          <li key={i} className="rounded-control border border-line p-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="font-semibold">
                {e.title_ar} <span className="text-sm font-normal text-muted">(المادة {e.article})</span>
              </span>
              <span className="text-lg font-bold">{e.amount === null ? t.cannotCompute : formatSAR(e.amount)}</span>
            </div>
            <p className="mt-1 text-sm text-muted">{e.formula_ar}</p>
          </li>
        ))}
      </ul>
      {total !== null && items.filter((e) => e.amount !== null).length > 1 && (
        <div className="flex justify-between border-t border-line pt-3 text-lg font-bold">
          <span>{t.total}</span>
          <span>{formatSAR(total)}</span>
        </div>
      )}
    </div>
  );
}
