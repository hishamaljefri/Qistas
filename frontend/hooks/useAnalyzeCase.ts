"use client";
import { useState } from "react";
import { api, ApiError } from "@/lib/api";
import type { AnalyzeRequest, AnalyzeResponse } from "@/lib/types";

type State =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; data: AnalyzeResponse }
  | { status: "error"; message: string };

export function useAnalyzeCase() {
  const [state, setState] = useState<State>({ status: "idle" });

  async function analyze(req: AnalyzeRequest) {
    setState({ status: "loading" });
    try {
      setState({ status: "success", data: await api.analyzeCase(req) });
    } catch (e) {
      setState({ status: "error", message: e instanceof ApiError ? e.message : "حدث خطأ غير متوقع." });
    }
  }

  return { state, analyze, reset: () => setState({ status: "idle" }) };
}
