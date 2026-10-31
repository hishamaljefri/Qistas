"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AfterSubmit, CaseForm } from "@/components/case/CaseForm";
import { WaitingScreen } from "@/components/case/WaitingScreen";
import { RequireAuth } from "@/components/demo/RequireAuth";
import { Page } from "@/components/layout/Page";
import { useAnalyzeCase } from "@/hooks/useAnalyzeCase";
import type { AnalyzeRequest } from "@/lib/types";

function Analyze() {
  const { state, analyze, reset } = useAnalyzeCase();
  const router = useRouter();
  const [request, setRequest] = useState<AnalyzeRequest | null>(null);
  const [attempt, setAttempt] = useState(0);
  const waiting = state.status !== "idle";

  function send(req: AnalyzeRequest) {
    setRequest(req);
    setAttempt((n) => n + 1);
    window.scrollTo({ top: 0 });
    analyze(req);
  }

  return (
    <Page>
      {/* the form stays mounted while waiting, so "تعديل الوصف" after an error keeps everything typed */}
      <div hidden={waiting} className="flex flex-wrap items-start gap-7">
        <CaseForm onSubmit={send} />
        <AfterSubmit />
      </div>
      {state.status !== "idle" && (
        <WaitingScreen
          key={attempt}
          status={state.status}
          error={state.status === "error" ? state.message : undefined}
          onRetry={() => request && send(request)}
          onEdit={reset}
          // the case is saved by the backend; open it in "My Cases"
          onDone={() => state.status === "success" && router.push(`/cases/${state.data.case_id}`)}
        />
      )}
    </Page>
  );
}

export default function AnalyzePage() {
  return (
    <RequireAuth>
      <Analyze />
    </RequireAuth>
  );
}
