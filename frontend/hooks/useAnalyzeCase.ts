"use client";
import { useState } from "react";
import { api, ApiError } from "@/lib/api";
import type { AnalyzeRequest, AnalyzeResponse } from "@/lib/types";

type State =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; data: AnalyzeResponse }
  | { status: "error"; message: string };

/** One analysis call (new case or re-analysis) with its loading / success / error state. */
export function useAnalyzeCase() {
  const [state, setState] = useState<State>({ status: "idle" });

  async function run(job: () => Promise<AnalyzeResponse>) {
    setState({ status: "loading" });
    try {
      setState({ status: "success", data: await job() });
    } catch (e) {
      setState({ status: "error", message: e instanceof ApiError ? e.message : "حدث خطأ غير متوقع." });
    }
  }

  return {
    state,
    run,
    analyze: (req: AnalyzeRequest) => run(() => api.analyzeCase(req)),
    reset: () => setState({ status: "idle" }),
  };
}
