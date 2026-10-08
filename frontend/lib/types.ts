// Mirrors backend/app/schemas.py and backend/app/entitlements.py.
// If the API changes, update these types first; the compiler then shows every screen affected.

export type Gender = "male" | "female";
export type Likelihood = "مرتفع" | "متوسط" | "منخفض";
export type ProvisionStatus = "in_force" | "repealed" | "merged";

export type DocumentMethod = "text_layer" | "gemini_ocr";

/** Text extracted from an uploaded file (POST /api/documents/extract), reviewed by the user. */
export interface AttachedDocument {
  filename: string;
  method: DocumentMethod;
  pages: number | null;
  text: string;
}

export interface AnalyzeRequest {
  description: string;
  employee_name?: string | null;
  employer_name?: string | null;
  employee_gender?: Gender | null;
  documents?: AttachedDocument[];
}

export interface Article {
  record_id: string;
  source_code: string;
  source_name: string;
  article_number: string | null;
  title: string;
  text: string;
  status: ProvisionStatus;
  status_note?: string | null;
}

export interface Citation extends Article {
  why: string;
}

export interface SearchHit extends Article {
  score: number;
}

export interface ExpectedOutcome {
  summary: string;
  likelihood: Likelihood;
  reasoning: string;
}

export interface Entitlement {
  kind: string;
  title_ar: string;
  article: string;
  amount: number | null;
  formula_ar: string;
  missing_inputs: string[];
}

export interface Analysis {
  facts_summary: string;
  legal_issues: string[];
  analysis: string;
  missing_information: string[];
  expected_outcome: ExpectedOutcome;
  recommended_steps: string[];
}

/** A saved case with its latest analysis (real names restored for the owner). */
export interface AnalyzeResponse {
  case_id: number;
  title: string;
  created_at: string;
  updated_at: string;
  version: number;
  employee_gender: Gender | null;
  description: string;
  documents: { filename: string; method: DocumentMethod; pages: number | null }[];
  latest_claim_id: number | null;
  analysis: Analysis;
  citations: Citation[];
  entitlements: Entitlement[];
  entitlements_total: number | null;
  retrieved: Article[];
  masked_description: string;
  pii_masked: Record<string, number>;
  grounding_warnings: string[];
  knowledge_base_as_of: string;
  model_version: string | null;
  latency_ms: number;
  disclaimer: string;
}

export interface KBInfo {
  sources: { code: string; name_ar: string; legal_level: string; source_url: string | null; collected_on: string; priority: string }[];
  provisions: number;
  knowledge_base_as_of: string;
}

// ---------- accounts ----------

export type Role = "user" | "admin";

export interface User {
  id: number;
  username: string;
  email: string;
  role: Role;
  is_active: boolean;
  created_at: string;
  last_login_at: string | null;
}

export interface TokenResponse {
  access_token: string;
  token_type: "bearer";
  expires_in: number;
  user: User;
}

export interface AdminUser extends User {
  case_count: number;
}

// ---------- my cases ----------

export interface CaseSummary {
  case_id: number;
  title: string;
  created_at: string;
  updated_at: string;
  likelihood: Likelihood | null;
  entitlements_total: number | null;
  version: number;
  has_claim: boolean;
}

export interface ReanalyzeRequest {
  description: string;
  employee_name?: string | null;
  employer_name?: string | null;
  employee_gender?: Gender | null;
}

// ---------- claim draft ----------

export interface ClaimRequest {
  plaintiff_national_id?: string | null;
  plaintiff_nationality?: string | null;
  plaintiff_phone?: string | null;
  plaintiff_address?: string | null;
  defendant_cr_number?: string | null;
  defendant_address?: string | null;
  court_city?: string | null;
}

export interface Claim {
  claim_id: number;
  case_id: number;
  created_at: string;
  model_version: string | null;
  court_city: string | null;
  plaintiff: { label: string; value: string | null }[];
  defendant: { label: string; value: string | null }[];
  subject: string;
  facts: string[];
  legal_grounds: { record_id: string; title: string; argument: string }[];
  requests: { text: string; amount: number | null; formula: string | null }[];
  total: number | null;
  notes: string[];
  grounding_warnings: string[];
  disclaimer: string;
}
