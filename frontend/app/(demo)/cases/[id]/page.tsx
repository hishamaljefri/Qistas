"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useEffect, useState } from "react";
import { AnalysisResult } from "@/components/case/AnalysisResult";
import { CaseTools } from "@/components/demo/CaseTools";
import { ClaimPanel } from "@/components/demo/ClaimPanel";
import { RequireAuth } from "@/components/demo/RequireAuth";
import { Alert } from "@/components/ui/Alert";
import { Spinner } from "@/components/ui/Spinner";
import { api } from "@/lib/api";
import { text } from "@/lib/text";
import type { AnalyzeResponse } from "@/lib/types";

function CaseDetail({ id }: { id: number }) {
  const router = useRouter();
  const [data, setData] = useState<AnalyzeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.getCase(id).then(setData).catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, [id]);

  if (error) return <Alert tone="danger">{error}</Alert>;
  if (!data) return <Spinner />;
  return (
    <div className="space-y-4">
      <Link href="/cases" className="text-sm text-primary hover:underline">
        {text.caseDetail.back}
      </Link>
      <CaseTools data={data} onChange={setData} />
      <AnalysisResult data={data} onNewCase={() => router.push("/")} />
      <ClaimPanel key={data.version} caseId={data.case_id} hasClaim={data.latest_claim_id !== null} />
    </div>
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
