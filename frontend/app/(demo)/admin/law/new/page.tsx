"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ProvisionForm, type ProvisionValues } from "@/components/law/ProvisionForm";
import { RequireAuth } from "@/components/demo/RequireAuth";
import { BackLink, Page, PageTitle } from "@/components/layout/Page";
import { Alert } from "@/components/ui/Alert";
import { Spinner } from "@/components/ui/Spinner";
import { api } from "@/lib/api";
import { text } from "@/lib/text";
import type { LawSource } from "@/lib/types";

const t = text.law;

function NewProvision() {
  const router = useRouter();
  const [sources, setSources] = useState<LawSource[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.lawSources().then(setSources).catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  async function create(v: ProvisionValues) {
    setBusy(true);
    setError(null);
    try {
      const p = await api.createLawProvision({
        source_code: v.source_code,
        article_number: v.article_number.trim() || null,
        title: v.title.trim(),
        hierarchy: v.hierarchy.trim() || null,
        text: v.text.trim(),
        status: v.status,
        status_note: v.status_note.trim() || null,
        reason: v.reason.trim(),
      });
      router.replace(`/admin/law/${encodeURIComponent(p.record_id)}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  }

  return (
    <Page width="max-w-[900px]" className="pt-7">
      <BackLink href="/admin/law">{t.back}</BackLink>
      <PageTitle sub={t.newIntro}>{t.newTitle}</PageTitle>
      {!sources && !error && <Spinner label={text.loading} className="size-7 text-primary" />}
      {!sources && error && <Alert tone="danger">{error}</Alert>}
      {sources && (
        <ProvisionForm
          sources={sources}
          initial={{ source_code: sources[0]?.code ?? "", article_number: "", title: "", hierarchy: "", status: "in_force", status_note: "", text: "", reason: "" }}
          busy={busy}
          error={error}
          onSubmit={create}
        />
      )}
    </Page>
  );
}

export default function NewProvisionPage() {
  return (
    <RequireAuth role="admin">
      <NewProvision />
    </RequireAuth>
  );
}
