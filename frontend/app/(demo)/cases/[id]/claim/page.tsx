"use client";
import { use, useEffect, useState } from "react";
import { ClaimEditor } from "@/components/demo/ClaimPanel";
import { RequireAuth } from "@/components/demo/RequireAuth";
import { BackLink, Page } from "@/components/layout/Page";
import { Alert } from "@/components/ui/Alert";
import { Spinner } from "@/components/ui/Spinner";
import { api } from "@/lib/api";
import { text } from "@/lib/text";
import type { AnalyzeResponse, Claim } from "@/lib/types";

function ClaimPage({ id }: { id: number }) {
  const [loaded, setLoaded] = useState<{ data: AnalyzeResponse; claim: Claim | null } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const data = await api.getCase(id);
      const claim = data.latest_claim_id !== null ? await api.getClaim(id) : null;
      setLoaded({ data, claim });
    })().catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, [id]);

  if (error)
    return (
      <Page width="max-w-[760px]">
        <Alert tone="danger">{error}</Alert>
      </Page>
    );
  if (!loaded)
    return (
      <Page width="max-w-[960px]">
        <Spinner label={text.loading} className="size-7 text-primary" />
      </Page>
    );
  return (
    <Page width="max-w-[960px]" className="pt-7">
      <BackLink href={`/cases/${id}`}>{loaded.data.title}</BackLink>
      <ClaimEditor caseId={id} initial={loaded.claim} />
    </Page>
  );
}

export default function CaseClaimPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <RequireAuth>
      <ClaimPage id={Number(id)} />
    </RequireAuth>
  );
}
