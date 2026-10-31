import { Card } from "@/components/ui/Card";
import { formatAmount } from "@/lib/format";
import { text } from "@/lib/text";
import type { Entitlement } from "@/lib/types";

const t = text.result;

function Amount({ value, big = false }: { value: number; big?: boolean }) {
  return (
    <span className={`tabular font-bold ${big ? "text-[52px] leading-[1.1] text-primary max-md:text-[40px]" : "text-[22px]"}`}>
      {formatAmount(value)}{" "}
      <span className={`font-medium text-text ${big ? "text-[22px]" : "text-[15px]"}`}>{text.sar}</span>
    </span>
  );
}

/** "Your rights in numbers": the total, then one row per amount with its article and formula. */
export function RightsInNumbers({ items, total }: { items: Entitlement[]; total: number | null }) {
  return (
    <Card id="money" title={t.entitlements}>
      <div className="-mt-3 flex flex-wrap items-end justify-between gap-4 border-b border-line pb-[22px]">
        <p className="text-sm leading-[1.7] text-muted">{t.entitlementsNote}</p>
        {total !== null && (
          <div className="flex flex-col items-end gap-0.5 max-md:items-start">
            <span className="text-sm text-muted">{t.total}</span>
            <Amount value={total} big />
          </div>
        )}
      </div>
      <ul className="flex flex-col gap-3.5">
        {items.map((e, i) => (
          <li key={i} className="flex flex-col gap-2 rounded-2xl bg-surface-muted px-5 py-[18px]">
            <div className="flex items-center justify-between gap-3 max-md:flex-col max-md:items-start">
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="text-[17px] font-semibold">{e.title_ar}</span>
                <span className="rounded-full border border-line bg-surface px-2.5 py-px text-[13px] font-medium text-muted">{t.articleChip(e.article)}</span>
              </div>
              {e.amount === null ? <span className="font-semibold text-warning">{t.cannotCompute}</span> : <Amount value={e.amount} />}
            </div>
            <p className="tabular text-sm leading-[1.8] text-muted">{e.formula_ar}</p>
            {e.amount === null && e.missing_inputs.length > 0 && (
              <p className="text-sm leading-[1.8] text-warning">
                {t.missingInputs}
                {e.missing_inputs.join("، ")}
              </p>
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
}
