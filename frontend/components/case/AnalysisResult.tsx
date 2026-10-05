import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { formatDate } from "@/lib/format";
import { text } from "@/lib/text";
import type { AnalyzeResponse, Likelihood } from "@/lib/types";
import { CitationList } from "./CitationList";
import { EntitlementsTable } from "./EntitlementsTable";

const t = text.result;
const likelihoodTone: Record<Likelihood, "success" | "warning" | "neutral"> = {
  مرتفع: "success",
  متوسط: "warning",
  منخفض: "neutral",
};

function List({ items, ordered = false }: { items: string[]; ordered?: boolean }) {
  const Tag = ordered ? "ol" : "ul";
  return (
    <Tag className={`space-y-1 ps-5 ${ordered ? "list-decimal" : "list-disc"}`}>
      {items.map((x, i) => (
        <li key={i}>{x}</li>
      ))}
    </Tag>
  );
}

export function AnalysisResult({ data, onNewCase }: { data: AnalyzeResponse; onNewCase: () => void }) {
  const a = data.analysis;
  const maskedTotal = Object.values(data.pii_masked).reduce((s, n) => s + n, 0);

  return (
    <div className="space-y-4">
      <Card title={t.outcome}>
        <div className="mb-2 flex items-center gap-2">
          <span className="text-sm text-muted">{t.likelihood}:</span>
          <Badge tone={likelihoodTone[a.expected_outcome.likelihood]}>{a.expected_outcome.likelihood}</Badge>
        </div>
        <p className="text-lg leading-8">{a.expected_outcome.summary}</p>
        <p className="mt-2 text-muted">
          <span className="font-medium">{t.reasoning}: </span>
          {a.expected_outcome.reasoning}
        </p>
      </Card>

      {data.entitlements.length > 0 && (
        <Card title={t.entitlements}>
          <EntitlementsTable items={data.entitlements} total={data.entitlements_total} />
        </Card>
      )}

      {a.missing_information.length > 0 && (
        <Card title={t.missing}>
          <List items={a.missing_information} />
        </Card>
      )}

      <Card title={t.analysis}>
        <p className="whitespace-pre-line leading-8">{a.analysis}</p>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card title={t.facts}>
          <p className="leading-8">{a.facts_summary}</p>
        </Card>
        <Card title={t.issues}>
          <List items={a.legal_issues} />
        </Card>
      </div>

      <Card title={t.steps}>
        <List items={a.recommended_steps} ordered />
      </Card>

      <Card title={t.citations}>
        <CitationList citations={data.citations} />
      </Card>

      <Card title={t.privacy}>
        <p className="mb-2 text-sm text-muted">
          {t.maskedCount}: {maskedTotal}
        </p>
        <p className="rounded-control bg-surface-muted p-3 text-sm leading-7">{data.masked_description}</p>
      </Card>

      {data.grounding_warnings.length > 0 && (
        <Alert tone="warning">
          {t.warnings}: {data.grounding_warnings.join(" — ")}
        </Alert>
      )}

      <Alert>
        {data.disclaimer}
        <br />
        {t.kbAsOf} {formatDate(data.knowledge_base_as_of)} · {data.model_version} · {(data.latency_ms / 1000).toFixed(0)} ث · #
        {data.case_id}
      </Alert>

      <Button variant="secondary" onClick={onNewCase}>
        {t.newCase}
      </Button>
    </div>
  );
}
