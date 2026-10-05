// The only file that talks to the backend.
import type { AnalyzeRequest, AnalyzeResponse, Article, KBInfo, SearchHit } from "./types";

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", ...init?.headers },
    });
  } catch {
    throw new ApiError("تعذّر الاتصال بالخادم. تأكد أن الخادم الخلفي (backend) يعمل.", 0);
  }
  if (!res.ok) {
    let message = `خطأ من الخادم (${res.status})`;
    try {
      const body = await res.json();
      if (typeof body.detail === "string") message = body.detail;
      else if (Array.isArray(body.detail)) message = "البيانات المدخلة غير مكتملة أو غير صحيحة.";
    } catch {}
    throw new ApiError(message, res.status);
  }
  return res.json() as Promise<T>;
}

export const api = {
  analyzeCase: (body: AnalyzeRequest) =>
    request<AnalyzeResponse>("/api/cases/analyze", { method: "POST", body: JSON.stringify(body) }),
  search: (q: string, k = 10) => request<SearchHit[]>(`/api/search?${new URLSearchParams({ q, k: String(k) })}`),
  provision: (recordId: string) => request<Article>(`/api/provisions/${encodeURIComponent(recordId)}`),
  kbInfo: () => request<KBInfo>("/api/kb/info"),
};
