"use client";
import { AnalysisResult } from "@/components/case/AnalysisResult";
import { CaseForm } from "@/components/case/CaseForm";
import { Alert } from "@/components/ui/Alert";
import { useAnalyzeCase } from "@/hooks/useAnalyzeCase";

export default function AnalyzePage() {
  const { state, analyze, reset } = useAnalyzeCase();

  if (state.status === "success") {
    return <AnalysisResult data={state.data} onNewCase={reset} />;
  }
  return (
    <div className="space-y-4">
      <CaseForm onSubmit={analyze} loading={state.status === "loading"} />
      {state.status === "error" && <Alert tone="danger">{state.message}</Alert>}
    </div>
  );
}
