// The only file that talks to the backend.
import { clearSession, loadSession } from "./session";
import type {
  AdminUser,
  AnalyzeRequest,
  AnalyzeResponse,
  Article,
  AttachedDocument,
  CaseSummary,
  Claim,
  ClaimRequest,
  KBInfo,
  ReanalyzeRequest,
  Role,
  SearchHit,
  TokenResponse,
  User,
} from "./types";

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
  ) {
    super(message);
  }
}

async function send(path: string, init: RequestInit = {}): Promise<Response> {
  const token = loadSession()?.token;
  const headers: Record<string, string> = { ...(init.headers as Record<string, string>) };
  if (!(init.body instanceof FormData) && init.body !== undefined) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, { ...init, headers });
  } catch {
    throw new ApiError("تعذّر الاتصال بالخادم. تأكد أن الخادم الخلفي (backend) يعمل.", 0);
  }
  if (res.ok) return res;

  let message = `خطأ من الخادم (${res.status})`;
  let code: string | undefined;
  try {
    const body = await res.json();
    if (typeof body.detail === "string") message = body.detail;
    else if (body.detail && typeof body.detail.message === "string") ({ message, code } = body.detail);
    else if (Array.isArray(body.detail)) message = "البيانات المدخلة غير مكتملة أو غير صحيحة.";
  } catch {}
  if (res.status === 401 && token) clearSession(message); // expired or revoked session
  throw new ApiError(message, res.status, code);
}

const json = async <T>(path: string, init?: RequestInit) => (await send(path, init)).json() as Promise<T>;
const post = <T>(path: string, body?: unknown) => json<T>(path, { method: "POST", body: body === undefined ? undefined : JSON.stringify(body) });
const patch = <T>(path: string, body: unknown) => json<T>(path, { method: "PATCH", body: JSON.stringify(body) });

/** Downloads a protected file (the Authorization header can't be added to a plain link). */
async function download(path: string, fallbackName: string): Promise<void> {
  const res = await send(path);
  const name = /filename="([^"]+)"/.exec(res.headers.get("Content-Disposition") ?? "")?.[1] ?? fallbackName;
  const url = URL.createObjectURL(await res.blob());
  const a = Object.assign(document.createElement("a"), { href: url, download: name });
  a.click();
  URL.revokeObjectURL(url);
}

export const api = {
  // accounts
  register: (username: string, email: string, password: string) =>
    post<TokenResponse>("/api/auth/register", { username, email, password }),
  login: (identifier: string, password: string) => post<TokenResponse>("/api/auth/login", { identifier, password }),
  refresh: () => post<TokenResponse>("/api/auth/refresh"),
  me: () => json<User>("/api/auth/me"),

  // cases
  analyzeCase: (body: AnalyzeRequest) => post<AnalyzeResponse>("/api/cases/analyze", body),
  myCases: () => json<CaseSummary[]>("/api/cases"),
  getCase: (id: number) => json<AnalyzeResponse>(`/api/cases/${id}`),
  renameCase: (id: number, title: string) => patch<AnalyzeResponse>(`/api/cases/${id}`, { title }),
  reanalyzeCase: (id: number, body: ReanalyzeRequest) => post<AnalyzeResponse>(`/api/cases/${id}/reanalyze`, body),
  deleteCase: (id: number) => send(`/api/cases/${id}`, { method: "DELETE" }).then(() => undefined),

  // claim draft + downloads
  createClaim: (id: number, body: ClaimRequest) => post<Claim>(`/api/cases/${id}/claim`, body),
  getClaim: (id: number) => json<Claim>(`/api/cases/${id}/claim`),
  downloadReport: (id: number) => download(`/api/cases/${id}/report.pdf`, `case-${id}-report.pdf`),
  downloadClaimPdf: (id: number) => download(`/api/cases/${id}/claim.pdf`, `case-${id}-claim.pdf`),
  downloadClaimDocx: (id: number) => download(`/api/cases/${id}/claim.docx`, `case-${id}-claim.docx`),

  // documents
  extractDocument: (file: File, cloudOcrConsent: boolean, forceOcr = false) => {
    const form = new FormData();
    form.append("file", file);
    form.append("cloud_ocr_consent", String(cloudOcrConsent));
    form.append("force_ocr", String(forceOcr));
    return json<AttachedDocument & { pages: number }>("/api/documents/extract", { method: "POST", body: form });
  },

  // admin
  adminUsers: () => json<AdminUser[]>("/api/admin/users"),
  adminUpdateUser: (id: number, body: { role?: Role; is_active?: boolean }) => patch<User>(`/api/admin/users/${id}`, body),

  // public law data
  search: (q: string, k = 10) => json<SearchHit[]>(`/api/search?${new URLSearchParams({ q, k: String(k) })}`),
  provision: (recordId: string) => json<Article>(`/api/provisions/${encodeURIComponent(recordId)}`),
  kbInfo: () => json<KBInfo>("/api/kb/info"),
};
