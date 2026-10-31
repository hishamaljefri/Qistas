"use client";
import Link from "next/link";
import { use, useEffect, useState } from "react";
import { ProvisionForm, type ProvisionValues } from "@/components/law/ProvisionForm";
import { RevisionHistory } from "@/components/law/RevisionHistory";
import { StatusBadge } from "@/components/law/StatusBadge";
import { RequireAuth } from "@/components/demo/RequireAuth";
import { BackLink, Page } from "@/components/layout/Page";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { cardClass } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { Spinner } from "@/components/ui/Spinner";
import { api } from "@/lib/api";
import { text } from "@/lib/text";
import type { LawProvision, LawUpdate } from "@/lib/types";

const t = text.law;

const valuesOf = (p: LawProvision): ProvisionValues => ({
  source_code: p.source_code,
  article_number: p.article_number ?? "",
  title: p.title,
  hierarchy: p.hierarchy ?? "",
  status: p.status,
  status_note: p.status_note ?? "",
  text: p.text,
  reason: "",
});

function EditProvision({ recordId }: { recordId: string }) {
  const [p, setP] = useState<LawProvision | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [version, setVersion] = useState(0); // remounts the form with fresh values after a save

  useEffect(() => {
    api.lawProvision(recordId).then(setP).catch((e) => setLoadError(e instanceof Error ? e.message : String(e)));
  }, [recordId]);

  async function run(job: () => Promise<LawProvision>) {
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      setP(await job());
      setSaved(true);
      setVersion((n) => n + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  function save(v: ProvisionValues) {
    if (!p) return;
    const before = valuesOf(p);
    // send only what changed (the server records exactly these fields in the history)
    const body: LawUpdate = { reason: v.reason.trim() };
    for (const k of ["title", "article_number", "text", "status", "status_note"] as const) {
      if (v[k].trim() !== before[k].trim()) Object.assign(body, { [k]: v[k].trim() });
    }
    run(() => api.updateLawProvision(recordId, body));
  }

  if (loadError)
    return (
      <Page width="max-w-[900px]">
        <Alert tone="danger">{loadError}</Alert>
      </Page>
    );
  if (!p)
    return (
      <Page width="max-w-[900px]">
        <Spinner label={text.loading} className="size-7 text-primary" />
      </Page>
    );

  return (
    <Page width="max-w-[900px]" className="pt-7">
      <BackLink href="/admin/law">{t.back}</BackLink>
      <section className={`flex flex-col gap-3 px-8 py-6 max-md:px-[18px] ${cardClass}`}>
        <div className="flex flex-wrap items-center gap-2.5">
          <Badge className="text-sm font-normal">{p.source_name}</Badge>
          <StatusBadge status={p.status} always />
          <span dir="ltr" className="tabular text-sm text-muted">
            {p.record_id}
          </span>
        </div>
        <h1 className="text-[26px] leading-[1.4] font-semibold max-md:text-2xl">
          {t.editTitle}: {p.title}
        </h1>
        <Link href={`/articles/${encodeURIComponent(p.record_id)}`} className="inline-flex min-h-10 items-center gap-1.5 self-start text-[15px] font-semibold">
          <Icon name="eye" className="size-[18px]" />
          {t.viewPublic}
        </Link>
      </section>

      {saved && p.searchable && (
        <Alert tone="success" title={t.saved}>
          {t.savedBody}
        </Alert>
      )}
      {!p.searchable && (
        <Alert tone="warning" title={t.notSearchableTitle}>
          {t.notSearchable}{" "}
          <Button variant="secondary" size="sm" loading={busy} onClick={() => run(() => api.reindexLawProvision(recordId))} className="mt-2">
            {t.reindex}
          </Button>
        </Alert>
      )}

      <ProvisionForm key={version} initial={valuesOf(p)} busy={busy} error={error} onSubmit={save} />
      <RevisionHistory history={p.history} />
    </Page>
  );
}

export default function EditProvisionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <RequireAuth role="admin">
      <EditProvision recordId={decodeURIComponent(id)} />
    </RequireAuth>
  );
}
