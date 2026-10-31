"use client";
import { use, useEffect, useState } from "react";
import { AnalysisResult } from "@/components/case/AnalysisResult";
import { WaitingScreen } from "@/components/case/WaitingScreen";
import { CaseHeader, EditCaseForm } from "@/components/demo/CaseTools";
import { ClaimCard } from "@/components/demo/ClaimPanel";
import { RequireAuth } from "@/components/demo/RequireAuth";
import { BackLink, Page } from "@/components/layout/Page";
import { Alert } from "@/components/ui/Alert";
import { Spinner } from "@/components/ui/Spinner";
import { useAnalyzeCase } from "@/hooks/useAnalyzeCase";
import { api } from "@/lib/api";
import { text } from "@/lib/text";
import type { AnalyzeResponse, ReanalyzeRequest } from "@/lib/types";

function CaseDetail({ id }: { id: number }) {
  const [data, setData] = useState<AnalyzeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const job = useAnalyzeCase();
  const [request, setRequest] = useState<ReanalyzeRequest | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    api.getCase(id).then(setData).catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, [id]);

  function edit() {
    setEditing(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function reanalyze(req: ReanalyzeRequest) {
    setRequest(req);
    setAttempt((n) => n + 1);
    window.scrollTo({ top: 0 });
    job.run(() => api.reanalyzeCase(id, req));
  }

  if (error)
    return (
      <Page width="max-w-[760px]">
        <Alert tone="danger">{error}</Alert>
      </Page>
    );
  if (!data)
    return (
      <Page>
        <Spinner label={text.loading} className="size-7 text-primary" />
      </Page>
    );

  const st = job.state;
  return (
    <Page className="pt-7">
      {st.status !== "idle" && (
        <WaitingScreen
          key={attempt}
          status={st.status}
          error={st.status === "error" ? st.message : undefined}
          onRetry={() => request && reanalyze(request)}
          onEdit={job.reset}
          onDone={() => {
            if (st.status !== "success") return;
            setData(st.data);
            setEditing(false);
            job.reset();
          }}
        />
      )}
      {/* kept mounted while waiting, so the edited description survives an error */}
      <div hidden={st.status !== "idle"} className="flex flex-col gap-6">
        <BackLink href="/cases">{text.result.back}</BackLink>
        <CaseHeader data={data} onChange={setData} onEdit={edit} />
        {editing && <EditCaseForm key={data.version} data={data} onSubmit={reanalyze} onCancel={() => setEditing(false)} />}
        <AnalysisResult data={data} onEdit={edit} claim={<ClaimCard caseId={data.case_id} hasClaim={data.latest_claim_id !== null} />} />
      </div>
    </Page>
  );
}

export default function CasePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <RequireAuth>
      <CaseDetail id={Number(id)} />
    </RequireAuth>
  );
}
