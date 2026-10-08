"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { RequireAuth } from "@/components/demo/RequireAuth";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Spinner } from "@/components/ui/Spinner";
import { api } from "@/lib/api";
import { formatDate, formatSAR } from "@/lib/format";
import { text } from "@/lib/text";
import type { CaseSummary } from "@/lib/types";

const t = text.cases;

function CaseList() {
  const [cases, setCases] = useState<CaseSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.myCases().then(setCases).catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  if (error) return <Alert tone="danger">{error}</Alert>;
  if (!cases) return <Spinner />;
  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between">
        <h1 className="text-xl font-bold">{t.title}</h1>
        <Link href="/" className="text-primary hover:underline">
          {t.newCase}
        </Link>
      </div>
      {cases.length === 0 && <Alert>{t.empty}</Alert>}
      {cases.map((c) => (
        <Card key={c.case_id}>
          <div className="flex flex-wrap items-baseline gap-2">
            <Link href={`/cases/${c.case_id}`} className="font-semibold text-primary hover:underline">
              {c.title}
            </Link>
            {c.likelihood && <Badge>{c.likelihood}</Badge>}
            {c.has_claim && <Badge tone="success">{t.hasClaim}</Badge>}
          </div>
          <p className="mt-1 text-sm text-muted">
            {t.updated}: {formatDate(c.updated_at)} · {t.version} {c.version}
            {c.entitlements_total !== null && ` · ${t.total}: ${formatSAR(c.entitlements_total)}`}
          </p>
        </Card>
      ))}
    </div>
  );
}

export default function CasesPage() {
  return (
    <RequireAuth>
      <CaseList />
    </RequireAuth>
  );
}
