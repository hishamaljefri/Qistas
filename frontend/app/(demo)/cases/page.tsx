"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { EmptyState } from "@/components/brand/EmptyState";
import { LikelihoodBadge } from "@/components/case/Likelihood";
import { RequireAuth } from "@/components/demo/RequireAuth";
import { Page } from "@/components/layout/Page";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { buttonClass } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Spinner } from "@/components/ui/Spinner";
import { api } from "@/lib/api";
import { formatAmount, formatDate } from "@/lib/format";
import { text } from "@/lib/text";
import type { CaseSummary } from "@/lib/types";

const t = text.cases;

function CaseList() {
  const [cases, setCases] = useState<CaseSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.myCases().then(setCases).catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  return (
    <Page width="max-w-[1000px]" className="gap-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-3xl font-semibold max-md:text-2xl">{t.title}</h1>
        <Link href="/" className={buttonClass()}>
          <Icon name="plus" />
          {t.newCase}
        </Link>
      </div>
      {error && <Alert tone="danger">{error}</Alert>}
      {!cases && !error && <Spinner label={text.loading} className="size-7 text-primary" />}
      {cases?.length === 0 && (
        <EmptyState title={t.emptyTitle} body={t.emptyBody}>
          <Link href="/" className={buttonClass("primary", "md", "min-h-[50px] px-6")}>
            {t.emptyAction}
          </Link>
        </EmptyState>
      )}
      {cases && cases.length > 0 && (
        <ul className="flex flex-col gap-3">
          {cases.map((c) => (
            <li key={c.case_id}>
              <Link
                href={`/cases/${c.case_id}`}
                className="flex items-center justify-between gap-4 rounded-[18px] border border-line bg-surface px-6 py-[22px] text-text no-underline transition-colors hover:border-line-strong hover:text-text max-md:flex-col max-md:items-start max-md:px-[18px]"
              >
                <div className="flex min-w-0 flex-col gap-2.5">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <h2 className="text-lg leading-[1.5] font-semibold">{c.title}</h2>
                    {c.likelihood && <LikelihoodBadge value={c.likelihood} />}
                    {c.has_claim && <Badge tone="outline">{t.hasClaim}</Badge>}
                  </div>
                  <p className="tabular text-sm text-muted">
                    {t.updated}: {formatDate(c.updated_at)} · {t.version} {c.version}
                  </p>
                </div>
                {c.entitlements_total !== null && (
                  <div className="flex shrink-0 flex-col items-end gap-0.5 max-md:items-start">
                    <span className="text-[13px] text-muted">{t.total}</span>
                    <span className="tabular text-[22px] font-bold text-primary">
                      {formatAmount(c.entitlements_total)} <span className="text-sm font-medium text-text">{text.sar}</span>
                    </span>
                  </div>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Page>
  );
}

export default function CasesPage() {
  return (
    <RequireAuth>
      <CaseList />
    </RequireAuth>
  );
}
