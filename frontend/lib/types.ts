// Mirrors backend/app/schemas.py and backend/app/entitlements.py.
// If the API changes, update these types first; the compiler then shows every screen affected.

export type Gender = "male" | "female";
export type Likelihood = "مرتفع" | "متوسط" | "منخفض";
export type ProvisionStatus = "in_force" | "repealed" | "merged";

export interface AnalyzeRequest {
  description: string;
  employee_name?: string | null;
  employer_name?: string | null;
  employee_gender?: Gender | null;
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

export interface AnalyzeResponse {
  case_id: number;
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
