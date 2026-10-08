"use client";
import { useEffect, useState, type FormEvent } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field, TextInput } from "@/components/ui/Field";
import { Spinner } from "@/components/ui/Spinner";
import { api, ApiError } from "@/lib/api";
import { formatSAR } from "@/lib/format";
import { text } from "@/lib/text";
import type { Claim, ClaimRequest } from "@/lib/types";

const t = text.claim;
const FIELDS: [keyof ClaimRequest, string][] = [
  ["plaintiff_national_id", t.nationalId],
  ["plaintiff_nationality", t.nationality],
  ["plaintiff_phone", t.phone],
  ["plaintiff_address", t.address],
  ["defendant_cr_number", t.crNumber],
  ["defendant_address", t.defendantAddress],
  ["court_city", t.courtCity],
];

function PartyTable({ title, rows }: { title: string; rows: Claim["plaintiff"] }) {
  return (
    <div>
      <p className="mb-1 font-semibold">{title}</p>
      <table className="w-full text-sm">
        <tbody>
          {rows.map((r) => (
            <tr key={r.label} className="border-b border-line">
              <th className="w-1/3 py-1 text-start font-medium text-muted">{r.label}</th>
              <td className="py-1">{r.value ?? t.blank}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ClaimView({ claim }: { claim: Claim }) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <PartyTable title={t.plaintiff} rows={claim.plaintiff} />
        <PartyTable title={t.defendant} rows={claim.defendant} />
      </div>
      <p>
        <span className="font-semibold">{t.subject}: </span>
        {claim.subject}
      </p>
      <div>
        <p className="font-semibold">{t.facts}</p>
        <ol className="list-decimal space-y-1 ps-5">
          {claim.facts.map((f, i) => (
            <li key={i}>{f}</li>
          ))}
        </ol>
      </div>
      <div>
        <p className="font-semibold">{t.grounds}</p>
        <ol className="list-decimal space-y-1 ps-5">
          {claim.legal_grounds.map((g) => (
            <li key={g.record_id}>
              <span className="font-medium">{g.title}:</span> {g.argument}
            </li>
          ))}
        </ol>
      </div>
      <div>
        <p className="font-semibold">{t.requests}</p>
        <ol className="list-decimal space-y-1 ps-5">
          {claim.requests.map((r, i) => (
            <li key={i}>
              {r.text}
              {r.amount !== null && <span className="font-bold"> — {formatSAR(r.amount)}</span>}
              {r.formula && <div className="text-sm text-muted">{r.formula}</div>}
            </li>
          ))}
        </ol>
        {claim.total !== null && (
          <p className="mt-2 font-bold">
            {t.total}: {formatSAR(claim.total)}
          </p>
        )}
      </div>
      <Alert>
        <p className="mb-1 font-medium">{t.notes}</p>
        <ul className="list-disc space-y-1 ps-5">
          {claim.notes.map((n, i) => (
            <li key={i}>{n}</li>
          ))}
        </ul>
      </Alert>
    </div>
  );
}

export function ClaimPanel({ caseId, hasClaim }: { caseId: number; hasClaim: boolean }) {
  const [claim, setClaim] = useState<Claim | null>(null);
  const [form, setForm] = useState<ClaimRequest>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (hasClaim) api.getClaim(caseId).then(setClaim).catch(() => {});
  }, [caseId, hasClaim]);

  async function generate(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      setClaim(await api.createClaim(caseId, form));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function run(action: () => Promise<void>) {
    try {
      await action();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <Card title={t.title}>
      <form onSubmit={generate} className="space-y-3">
        <p className="text-sm text-muted">🔒 {t.intro}</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {FIELDS.map(([key, label]) => (
            <Field key={key} label={label} htmlFor={key}>
              <TextInput id={key} value={form[key] ?? ""} onChange={(e) => setForm({ ...form, [key]: e.target.value || null })} />
            </Field>
          ))}
        </div>
        <Button type="submit" disabled={busy}>
          {busy ? (
            <>
              <Spinner /> {t.generating}
            </>
          ) : claim ? (
            t.regenerate
          ) : (
            t.generate
          )}
        </Button>
      </form>
      {error && (
        <div className="mt-3">
          <Alert tone="danger">{error}</Alert>
        </div>
      )}
      {claim && (
        <div className="mt-6 space-y-4 border-t border-line pt-4">
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => run(() => api.downloadClaimPdf(caseId))}>
              {t.downloadPdf}
            </Button>
            <Button variant="secondary" onClick={() => run(() => api.downloadClaimDocx(caseId))}>
              {t.downloadWord}
            </Button>
          </div>
          <ClaimView claim={claim} />
        </div>
      )}
    </Card>
  );
}
