"use client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { CaseForm } from "@/components/case/CaseForm";
import { RequireAuth } from "@/components/demo/RequireAuth";
import { Alert } from "@/components/ui/Alert";
import { useAnalyzeCase } from "@/hooks/useAnalyzeCase";

function Analyze() {
  const { state, analyze } = useAnalyzeCase();
  const router = useRouter();

  // the case is saved by the backend; open it in "My Cases"
  useEffect(() => {
    if (state.status === "success") router.push(`/cases/${state.data.case_id}`);
  }, [state, router]);

  return (
    <div className="space-y-4">
      <CaseForm onSubmit={analyze} loading={state.status === "loading" || state.status === "success"} />
      {state.status === "error" && <Alert tone="danger">{state.message}</Alert>}
    </div>
  );
}

export default function AnalyzePage() {
  return (
    <RequireAuth>
      <Analyze />
    </RequireAuth>
  );
}
