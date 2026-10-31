import type { ReactNode } from "react";
import { Alert } from "@/components/ui/Alert";
import { Card } from "@/components/ui/Card";
import { Disclosure } from "@/components/ui/Disclosure";
import { Icon } from "@/components/ui/Icon";
import { formatDate } from "@/lib/format";
import { text } from "@/lib/text";
import type { AnalyzeResponse, Citation } from "@/lib/types";
import { ArticleTiles } from "./ArticleTiles";
import { EmployerFines } from "./EmployerFines";
import { LikelihoodBadge, LikelihoodMeter } from "./Likelihood";
import { PrivacyReveal } from "./PrivacyReveal";
import { RightsInNumbers } from "./RightsInNumbers";

const t = text.result;
const isViolation = (c: Citation) => c.record_id.startsWith("VIO-");

/**
 * The result page body: main column (outcome, money, next steps, details, articles) and a side column
 * (missing information, claim draft, privacy reveal, employer fines). `claim` is the claim-draft card.
 */
export function AnalysisResult({ data, claim, onEdit }: { data: AnalyzeResponse; claim: ReactNode; onEdit: () => void }) {
  const a = data.analysis;
  const articles = data.citations.filter((c) => !isViolation(c));
  const fines = data.citations.filter(isViolation);

  return (
    <>
      <div className="flex flex-wrap items-start gap-6">
        <div className="flex min-w-0 flex-[999_1_600px] flex-col gap-6">
          <Card
            id="outcome"
            title={t.outcome}
            action={
              <div className="flex items-center gap-3">
                <span className="text-sm text-muted">{t.likelihood}</span>
                <LikelihoodBadge value={a.expected_outcome.likelihood} className="px-3.5 py-1.5 text-[15px]" />
              </div>
            }
          >
            <LikelihoodMeter value={a.expected_outcome.likelihood} />
            <p className="text-[19px] leading-[1.9] font-medium max-md:text-[17px]">{a.expected_outcome.summary}</p>
            <p className="rounded-[14px] bg-surface-muted px-[18px] py-4 leading-[1.9]">
              <strong className="font-semibold">{t.reasoning}</strong>
              {a.expected_outcome.reasoning}
            </p>
          </Card>

          {data.grounding_warnings.length > 0 && (
            <Alert tone="warning" title={t.warnings}>
              {data.grounding_warnings.join(" — ")}
            </Alert>
          )}

          {data.entitlements.length > 0 && <RightsInNumbers items={data.entitlements} total={data.entitlements_total} />}

          {a.recommended_steps.length > 0 && (
            <Card id="steps" title={t.steps}>
              <ol className="flex flex-col gap-3.5">
                {a.recommended_steps.map((s, i) => (
                  <li key={i} className="flex items-start gap-3.5">
                    <span className="tabular flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-[15px] font-semibold text-primary-fg">
                      {i + 1}
                    </span>
                    <p className="pt-0.5">{s}</p>
                  </li>
                ))}
              </ol>
            </Card>
          )}

          <section aria-labelledby="details-title" className="flex flex-col gap-3">
            <h2 id="details-title" className="mx-1 text-[22px] font-semibold">
              {t.details}
            </h2>
            <Disclosure title={t.analysis} defaultOpen>
              <p className="whitespace-pre-line">{a.analysis}</p>
            </Disclosure>
            <Disclosure title={t.facts}>
              <p>{a.facts_summary}</p>
            </Disclosure>
            {a.legal_issues.length > 0 && (
              <Disclosure title={t.issues}>
                <ul className="list-disc ps-5">
                  {a.legal_issues.map((x, i) => (
                    <li key={i}>{x}</li>
                  ))}
                </ul>
              </Disclosure>
            )}
          </section>

          {articles.length > 0 && <ArticleTiles citations={articles} />}
        </div>

        <aside className="flex min-w-0 flex-[1_1_320px] flex-col gap-6">
          {a.missing_information.length > 0 && (
            <section aria-labelledby="missing-title" className="flex flex-col gap-3.5 rounded-card bg-warning-bg p-[26px] max-md:px-[18px] max-md:py-[22px]">
              <h2 id="missing-title" className="flex items-center gap-2.5 text-lg font-semibold">
                <Icon name="help" className="size-[22px] text-warning" />
                {t.missing}
              </h2>
              <ul className="flex list-disc flex-col gap-1.5 ps-5 text-[15px] leading-[1.9]">
                {a.missing_information.map((q, i) => (
                  <li key={i}>{q}</li>
                ))}
              </ul>
              <button type="button" onClick={onEdit} className="inline-flex min-h-11 items-center self-start text-[15px] font-semibold underline">
                {t.missingAction}
              </button>
            </section>
          )}
          {claim}
          <PrivacyReveal masked={data.masked_description} original={data.description} counts={data.pii_masked} />
          {fines.length > 0 && <EmployerFines items={fines} />}
        </aside>
      </div>

      <footer className="flex items-start gap-3 rounded-2xl border border-line px-[22px] py-[18px] text-sm leading-[1.8] text-muted">
        <Icon name="info" className="mt-0.5 size-5" />
        <div>
          <p>{data.disclaimer}</p>
          <p className="tabular">
            {t.kbAsOf} {formatDate(data.knowledge_base_as_of)} · {data.model_version} · {(data.latency_ms / 1000).toFixed(0)} {t.seconds}
          </p>
        </div>
      </footer>
    </>
  );
}
