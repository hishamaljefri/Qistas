# Material for the report

## Future Work: automated knowledge-base update pipeline

Saudi labor legislation is amended periodically. For example, the Labor Law was amended
by Royal Decree (M/44) dated 8/2/1446H, effective 20/8/1446H, and the Violations and
Penalties Table was revised by Ministerial Decision (112377) in February 2026. The current
version of QISTAS uses a knowledge base that is up to date as of a stated collection date
(3 October 2026). That date is stored for each legal source and shown alongside every
answer. The database design already supports versioning: each provision stores a content
hash, its legal status (in force, repealed, merged) and the decree responsible, and the
loading script detects changed provisions and re-indexes only those. Future work will
extend this into an automated update pipeline. It will monitor official sources (the
Bureau of Experts at the Council of Ministers and the Ministry of Human Resources and
Social Development) for new amendments, present detected changes to a Legal Data Manager
for approval, keep superseded versions for historical cases, and re-index the affected
provisions without manual intervention.

## Knowledge-base verification (for the Methodology / Data section)

- Source file: 456 provisions extracted from the official HRSD consolidated publications.
- Coverage check against the official Bureau of Experts text: 38 Labor Law article numbers
  and 3 Implementing Regulations articles were absent. Each was traced to an official
  repeal or merger:
  - Chapter 14 (Labor Dispute Settlement Commissions), articles 210 to 228: repealed by
    Royal Decree (M/1) dated 22/1/1435H, when jurisdiction moved to the labor courts.
  - Articles 195, 197, 203 and 205 to 208 (labor inspection): repealed by Royal Decree
    (M/44) dated 8/2/1446H.
  - Articles 149 and 150: deleted by Royal Decree (M/5) dated 7/1/1442H.
  - Article 156: repealed by Royal Decree (M/134) dated 27/11/1440H.
  - Articles 14 and 152, and 236 to 242: merged into other articles by Royal Decree (M/46)
    dated 5/6/1436H.
  - Implementing Regulations articles 2, 36 and 37: marked "(ملغاة)" in the official text.
- Result: complete coverage of Labor Law articles 1 to 245 plus the 4 "bis" (مكرر) articles.
- The source file reflects the 2025 amendments. For example, article 151 grants 12 weeks of
  maternity leave.

## Retrieval evaluation (Day 2)

Embeddings: Gemini `gemini-embedding-001` (768 dimensions), stored in PostgreSQL + pgvector
with an HNSW cosine index. Test set: 37 Arabic questions written in everyday language
(`data/eval/retrieval_questions.jsonl`). For each question, the expected Labor Law article
was checked against the official text. A question counts as a hit if the expected article
appears in the top results.

| Method | Hit@1 | Hit@5 | MRR |
|---|---|---|---|
| Keyword (PostgreSQL Arabic full-text, normalized) | 5% | 27% | 0.14 |
| Semantic (vector embeddings) | 73% | 97% | 0.84 |
| **Semantic + explicit article-number lookup (adopted)** | **78%** | **100%** | **0.88** |

Findings: keyword matching performs poorly on colloquial questions (e.g. "فصلوني بدون سبب"),
because users rarely use the statute's wording. Fusing keyword results with semantic results
(Reciprocal Rank Fusion) lowered accuracy at every weight tested (keyword weights 0.1 to 0.5
gave Hit@5 of 95% down to 86%). Semantic search alone failed only on an explicit reference
("ما نص المادة 84"), which the article-number lookup resolves.
Limitation: the same question set was used to choose the configuration, so these figures are
optimistic. A held-out set written by other team members should be used for the final
evaluation.

## Case analysis pipeline (Day 3)

1. **Privacy layer:** personal data is masked *before* any text leaves the server: Saudi
   national ID / iqama numbers, phone numbers, IBANs, emails, labelled contract/case
   numbers, the employee/employer names entered in the form (and their first/last names), and
   company names introduced by "شركة/مؤسسة/مصنع…". Placeholders such as [EMPLOYEE_1] keep the
   sentence meaningful for the model. Only the masked text is stored; original values are kept
   in memory just long enough to restore them in the user's response. Verified: 0 stored rows
   contain the real names, ID or phone used in testing. Limitation: rule-based, not an Arabic
   NER model.
2. **Retrieval:** semantic search (top 8), then **expansion** with (a) expert companion rules,
   e.g. any termination article also brings in the end-of-service award (art. 84), the one-week
   settlement deadline (art. 88), unused-leave pay (art. 111) and the service certificate
   (art. 64), and (b) the Implementing Regulations article linked to each top Labor Law article.
   Motivation: in the first test, a dismissed worker's description retrieved the compensation
   articles but not art. 84, because users describe what happened, not what they are owed.
3. **Generation:** Gemini (Flash family; concrete version saved per analysis) with a system
   prompt restricting it to the supplied articles, temperature 0.2, and a JSON response schema
   (facts, issues, cited articles with reasons, analysis, missing information, expected outcome
   with likelihood, recommended steps).
4. **Grounding check:** any cited article id not among the retrieved articles is removed and
   reported. Article texts shown to the user come from the database, never from the model.
5. **Availability:** automatic fallback to another Gemini model when the primary is overloaded
   (HTTP 503 was observed during testing).

### Sample case results

| Case | Expected articles | Cited | Amount computed | Manual check |
|---|---|---|---|---|
| Dismissal without reason/notice, 6 yrs, wage 10,000 | 75, 76, 77, 84 | all + 80, 88, 64, 111 | 85,000 SAR (30k art. 77 + 20k art. 76 + 35k art. 84) | correct |
| Wages unpaid 3 months, 2 yrs | 81, 90, 94 | all + 84, 88, 111, 64 | 18,000 arrears + 6,000 EOS | correct |
| Resignation after 4.5 yrs, wage 7,000 | 84, 85 | all + 88 | 5,250 SAR (⅓ of 15,750) | correct |

Grounding warnings: 0. Latency: ~16 s on the primary model, 44–88 s when the fallback model
answered.

## Blind test (12 unseen cases, Day 3)

Written after the system was finished and not used for any tuning
(`data/eval/blind_cases.json`, runner `scripts/run_blind_cases.py`). Only the case text is sent
to the system; the answer key stays local.

| Case | Required articles cited | Conclusion vs answer key |
|---|---|---|
| B01 Dismissal during probation | ✅ 53, 54 | ✅ correctly says worker gets **nothing** (does not side with the user) |
| B02 Fixed-term contract ended early | ✅ 77 | ✅ 144,000 + 3,000 SAR, exact |
| B03 Unpaid overtime (dialect) | ⚠️ 107 only (98 missing) | ✅ 2 h/day + 50% |
| B04 Cash instead of annual leave | ✅ 109 | ✅ not allowed during service |
| B05 Dismissed for sickness | ✅ 82, 117 | ✅ unlawful termination |
| B06 Pregnant employee warned | ✅ 155, 151 | ✅ warning unlawful; 12 weeks maternity |
| B07 Work injury | ✅ 137 | ✅ remaining 8,750 SAR (7,000 + 5,250 − 3,500 paid), exact |
| B08 5-year non-compete | ✅ 83 | ✅ exceeds 2-year maximum |
| B09 Forced transfer to another city | ✅ 58 | ⚠️ hedged on whether a contract clause counts as consent |
| B10 Resignation after marriage | ✅ 87 | ⚠️ right amount (7,500) but unsure of gender: **masking hid the name "نورة"** |
| B11 Deduction for broken laptop | ✅ 91 | ⚠️ right rule, wrong arithmetic (666.67 instead of ≈833) |
| B12 Vague complaint | n/a | ⚠️ asked for details but rated likelihood "medium" instead of "low" |

Result: required articles cited in 11/12 cases; conclusion fully correct in 8/12, partially
correct in 4/12; 0 invented citations. Lessons: (1) masking can remove legally relevant facts
(gender), so the form should collect them explicitly; (2) the LLM can still make arithmetic
slips, so amounts should be computed in code; (3) these cases were written by the same
author as the companion rules, so cases from other team members would be a stronger test.

## Fixes after the blind test (prompt v2)

| Problem found | Cause | Fix |
|---|---|---|
| B10: unsure whether the worker was a woman | Masking replaced the name "نورة" with [EMPLOYEE_1], hiding a fact the law depends on (art. 87) | Form now asks for the worker's gender explicitly (`employee_gender`); it is passed to the model as a known fact. Masking is unchanged. |
| B11: right rule, wrong arithmetic | LLMs are unreliable at arithmetic | New calculator (`app/entitlements.py`, 13 hand-checked unit tests). The model only extracts the inputs (wage, years, contract type…); code computes end-of-service (84/85/87), art. 77 compensation incl. the 2-month floor, notice compensation (75/76), unpaid wages, overtime (107), work-injury allowance (137), sick-leave pay (117) and the art. 91 deduction cap, and shows each formula. The model is told not to write amounts. |
| B12: vague case rated "medium" | No rule for insufficient facts | Prompt rule: if the facts don't identify a specific legal issue → likelihood "low" and ask questions instead of assuming facts. |
| B03: art. 98 (hours limit) not cited | Overtime is defined relative to art. 98, but the two weren't linked | Companion rule: articles 98/99/106/107 bring in 98 and 107. |

Re-check after the fixes: B10 full award 7,500 with no hedging; B11 cap 833.33; B12 likelihood
"low"; first dismissal case 35,000 + 30,000 + 20,000 = 85,000, all computed in code, with no
amounts written by the model. Note: B03, B10, B11 and B12 were used to verify these fixes, so they
are no longer blind; new cases are needed for a final, unbiased evaluation.

## Challenges faced and how we addressed them

| # | Challenge | Impact | How we addressed it |
|---|---|---|---|
| 1 | **No labeled Saudi labor-case data for fine-tuning** | Fine-tuning a model was not possible | Chose Retrieval-Augmented Generation (RAG): the model answers from the official law text retrieved for each case, so no training data is needed |
| 2 | **Limited hardware** (student laptop, ~3.8 GB RAM available to the Linux environment) | Running a local LLM or a large embedding model was impractical | Used the Gemini API for embeddings and generation; heavy computation runs on Google's servers |
| 3 | **Zero budget** | Paid APIs and hosting were not an option | Gemini free tier; PostgreSQL + pgvector (open source) on the laptop |
| 4 | **Gaps in the knowledge-base file**: 38 Labor Law and 3 Regulations article numbers were missing | Risk of wrong or empty answers about those articles | Checked every gap against the official Bureau of Experts text and HRSD PDF: all were repealed or merged. Added a short record per article stating its status and the responsible royal decree |
| 5 | **Version uncertainty**: the Regulations were re-issued in 2025 (decision 115921) | Risk of using an outdated version | Matched the file's page numbers and text against the official 2025 PDF; confirmed it includes the 2025 amendments (e.g. 12-week maternity leave, art. 151) |
| 6 | **Inconsistent numbering of "bis" (مكرر) articles** (stored as "11.1") | Wrong ordering and labels | Normalized to "11 مكرر" with correct ordering |
| 7 | **Violations & Penalties Table (2026) is a scanned PDF** | Its text cannot be extracted directly | Downloaded and recorded; OCR extraction planned (not yet in the knowledge base) |
| 8 | **Very long provisions** (one article ≈ 11,600 characters) | Too long for one embedding; dilutes search | Structure-based chunking (one article = one chunk), with long articles split at paragraph/sentence boundaries and a context header on every chunk |
| 9 | **Arabic spelling variation** (أ/ا، ة/ه، ى/ي، diacritics) | Keyword matching misses equivalent words | Arabic normalization before keyword search |
| 10 | **Keyword search performed poorly on colloquial questions** (Hit@5 27%) and **lowered accuracy when combined** with semantic search | Hybrid search was worse than semantic search alone | Measured before deciding: default search = semantic search + explicit article-number lookup (Hit@5 100% on 37 questions); keyword search kept only as a separate mode |
| 11 | **Free-tier rate limits** (HTTP 429), ~100 embeddings/minute | Embedding the knowledge base and running tests could fail mid-way | Automatic wait-and-retry with increasing delays; resumable embedding script; cached question embeddings |
| 12 | **Model availability**: `gemini-2.5-flash` withdrawn for new users (HTTP 404); frequent **overload** errors (HTTP 503) on the main model | Requests failed; response time varied (≈15–90 s) | Configurable model with automatic fallback to other Gemini models; the concrete model version is saved with every analysis; the user sees a clear Arabic message if all models are busy |
| 13 | **Retrieval missed entitlements the user didn't mention**: a dismissed worker's description retrieved the compensation articles but not the end-of-service award (art. 84) | Incomplete legal analysis | "Companion article" rules written from the law's structure (e.g. any termination article brings in arts. 84, 88, 111, 64) plus automatic inclusion of the implementing regulation of each retrieved article |
| 14 | **Masking women's names hid the claimant's gender.** Replacing a name like "نورة" with [EMPLOYEE_1] removed the only clue that the worker is a woman, and some rules depend on gender (e.g. art. 87: full end-of-service award for a woman resigning within 6 months of marriage). The model hesitated and gave two conditional answers | Privacy protection removed a legally relevant fact | The form asks for the worker's gender explicitly and passes it to the model as a stated fact, while the name stays masked. General lesson: anonymization must preserve legally relevant attributes (gender, age for minors, nationality where relevant) |
| 15 | **Rule-based masking cannot catch every name** written freely in the text | Some personal names may reach the API | Names entered in the form, ID/iqama/phone/IBAN/email patterns, and names after "شركة/مؤسسة/اسمي" are masked; an Arabic NER model is listed as future work |
| 16 | **LLM arithmetic errors**: right rule, wrong amount (e.g. deduction cap 666 instead of ≈833 SAR) | Wrong money figures would mislead users | The LLM only extracts inputs; amounts are computed in code from the article formulas (13 hand-checked unit tests), and each formula is shown |
| 17 | **Over-confidence on vague cases** (likelihood "medium" with no facts) | Misleading certainty | Prompt rule: insufficient facts → likelihood "low" and follow-up questions |
| 18 | **LLM could cite articles it was not given** (hallucination risk) | Invented legal references | Grounding check removes any citation not in the retrieved set; article texts shown to users come from the database, never from the model (0 removals needed in testing so far) |
| 19 | **Evaluation bias**: test questions and rules were written by the same author, and some blind cases were reused to verify fixes | Accuracy figures are optimistic | Reported transparently; final evaluation will use new cases written by other team members and reviewed by a legal expert |
| 20 | **Fast-changing legislation** | Knowledge base can become outdated | "Up to date as of" date stored per source and shown with answers; automated update pipeline listed as future work |
| 21 | **Tight deadline** (prototype within one week) | Less time for UI polish and broader testing | Prioritized a working, tested backend and a functional interface; UI/UX refinement planned as a separate phase |

## Source priority adjustment (Day 4)

While testing the website's law search, the query "إجازة الحج" ranked Annex 1 article 44 (the
model internal work regulations, which restate the Law) above Labor Law article 114. Annex 1 was
re-classified from `core` to `secondary` (ranking weight 0.6), consistent with the legal
hierarchy (Law > Implementing Regulations > model templates). Retrieval on the 37-question set:
Hit@1 78% → 95%, Hit@5 100% (unchanged), MRR 0.88 → 0.97. Caveat: measured on the same set used
earlier, so the improvement is optimistic.

## Prototype website (Day 4)

Next.js (React) web interface in Arabic (right-to-left) with three screens: case analysis,
law search, and article view. The interface is deliberately minimal and separated into design
tokens, UI primitives, screens, copy and logic so the visual design can be refined later
without changing application code (`frontend/DESIGN.md`). Verified with an automated
headless-browser test: search → article page → case analysis (resignation after 8 years →
two-thirds end-of-service award = 22,000 SAR, computed in code), with no browser errors.

## Implementation status against the CS498 requirements (for Report Part I, Q3/Q4)

### Functional requirements: 13 complete + 1 partial of 15 (≈ 87–90%)

| ID | Requirement | Status | Evidence / how |
|---|---|---|---|
| FR1 | Register (username, email, password) | ✅ | `POST /api/auth/register`; `/register` page |
| FR2 | Secure login | ✅ | bcrypt + 30-min JWT; `/login` page; tests for wrong/expired/forged tokens |
| FR3 | Authenticated users input an Arabic case | ✅ | `POST /api/cases/analyze` requires login |
| FR4 | Upload documents (PDF/image) | ✅ | `POST /api/documents/extract`; PDF/JPG/PNG/WEBP ≤ 10 MB, ≤ 10 pages |
| FR5 | Extract text with OCR | ✅ | Text PDFs read locally (PyMuPDF); scans/photos read by Gemini after explicit consent (replaces DeepSeek-OCR) |
| FR6 | Extract key legal entities (parties, dates, contracts, claims) | ✅ | Parties/IDs detected by the masking layer; wage, dates, contract type, claims extracted by the LLM into a fixed schema |
| FR7 | Retrieve similar judicial decisions | ❌ | No accessible dataset of Saudi labor rulings yet; planned (see Q3) |
| FR8 | Retrieve relevant labor-law articles | ✅ | Semantic search + article lookup + companion rules; Hit@5 100% (37 questions) |
| FR9 | Identify missing legal elements | ✅ | `missing_information` in every analysis |
| FR10 | Generate a draft Statement of Claim | ✅ | `POST /api/cases/{id}/claim`; facts, legal grounds, requests; amounts from code |
| FR11 | Search the knowledge base | ✅ | `/search` page, `GET /api/search` |
| FR12 | View, edit, delete own cases | ✅ | My Cases list; view; rename; edit description + re-analyze (versioned); delete |
| FR13 | Download reports and draft claims | ✅ | Analysis report PDF; claim PDF + editable Word (.docx), Arabic RTL |
| FR14 | Admin manages accounts and roles | ✅ | `/admin/users`: change role, activate/deactivate (roles: user, admin) |
| FR15 | Data manager adds/updates/deletes articles | 🟡 | Knowledge base maintained by an idempotent loader script with change detection; no UI or data-manager role yet |

### Non-functional requirements

| ID | Requirement | Status |
|---|---|---|
| NFR1 | Response ≤ 10 s | ⚠️ Search < 2 s; full AI analysis 15–90 s on the free LLM tier (overload/fallbacks). Mitigated with a progress state |
| NFR2 | Arabic RTL throughout | ✅ Website, PDFs and Word output |
| NFR3 | 95% availability | ⚠️ Not measured (local deployment); automatic model fallback improves AI availability |
| NFR4 | Sensitive data processed locally | 🔄 Changed by design: only masked text is sent to the LLM; text PDFs read locally; scans sent only with consent |
| NFR5 | 50 concurrent users | ⚠️ Not load-tested yet |
| NFR6 | Deployable on 16 GB RAM + 8 GB GPU | ✅ Exceeded: runs on a laptop with ~3.8 GB RAM and no GPU |
| NFR7 | Modular, swappable LLM | ✅ Model and fallbacks configurable in `.env`; layered backend; replaceable UI |

### Security requirements

| ID | Status |
|---|---|
| SR1 bcrypt password hashing | ✅ (tested: stored value is a `$2b$` hash) |
| SR2 sessions expire after 30 min of inactivity | ✅ 30-min tokens, refreshed only while the user is active |
| SR3 no sensitive data to external APIs | 🔄 masked text only; scans only with consent (documented deviation) |
| SR4 role-based access control | ✅ (tested: non-admin gets 403; users can't reach others' cases) |
| SR5 daily knowledge-base backup | ❌ planned (scheduled `pg_dump`) |
| SR6 scan uploads for malicious content | 🟡 file-signature check, size/page/dimension limits, encrypted PDFs and PDFs with embedded files rejected, files never stored; no antivirus engine |
| SR7 anonymize before AI processing | ✅ for typed text and text PDFs; scans need consent |
| SR8 placeholders such as [EMPLOYEE_1] | ✅ |
| SR9 originals stored encrypted, owner/admin only | ✅ Fernet-encrypted vault per case (tested: no plain names in the database) |

## End-to-end browser test (Day 5)

Automated headless-browser run against the real Gemini API:
1. signed-out visitor redirected to login
2. register
3. upload a contract PDF (read locally)
4. analyze
5. case page with real names restored
6. My Cases
7. rename
8. download report PDF
9. generate claim draft with party details, then download PDF + Word
10. logout redirect
11. admin promotes, deactivates and re-activates a user
12. delete case

Result: all steps passed, 0 browser errors. Backend: 41 automated tests (accounts, roles,
ownership, encryption, masking, documents, claim, downloads, calculator) on a separate test
database with the AI faked.

## Additional challenges (Day 5)

| # | Challenge | How we addressed it |
|---|---|---|
| 22 | Some PDF generators store Arabic ligatures out of order, so text extracted from them is garbled ("بين" → "بني") | Extracted text is always shown to the user for review; a "re-read with Gemini" option performs OCR instead |
| 23 | Gemini refuses to transcribe **published** text verbatim (finish reason RECITATION), e.g. a scanned page of the regulations | Detected and reported with a clear message; users upload case-specific documents (contracts, letters), which transcribe correctly |
| 24 | Users give **dates** ("since March 2019") rather than durations, and the model is not allowed to calculate, so amounts were left uncomputed | The model extracts start/end dates; code computes years of service as of the analysis date (verified: 7.52 years → 37,650 + 28,200 + 15,000 SAR) |
| 25 | Short forms of a name ("خالد الغامدي" for "خالد سعد الغامدي", "الريادة" for "الريادة للمقاولات") escaped masking | Name variants are masked with the same placeholder; trade-off: short forms are shown back as the full name |
| 26 | Requiring login changed every page's behavior | Central session handling: redirect to login and return to the original page; automatic logout on expiry |
| 27 | Testing features that write to the database and call a paid/limited API | Separate `qistas_test` database and a fake Gemini in tests; real API used only for a small number of live checks |
