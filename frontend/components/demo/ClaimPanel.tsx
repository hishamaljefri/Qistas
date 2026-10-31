"use client";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button, buttonClass } from "@/components/ui/Button";
import { Card, cardClass } from "@/components/ui/Card";
import { Field, TextInput } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { api, ApiError } from "@/lib/api";
import { formatAmount, formatDateTime } from "@/lib/format";
import { text } from "@/lib/text";
import type { Claim, ClaimRequest } from "@/lib/types";

const t = text.claim;

type Key = keyof ClaimRequest;
const PLAINTIFF: [Key, string, string?][] = [
  ["plaintiff_national_id", t.nationalId, "numeric"],
  ["plaintiff_nationality", t.nationality],
  ["plaintiff_phone", t.phone, "tel"],
  ["plaintiff_address", t.address],
];
const DEFENDANT: [Key, string, string?][] = [
  ["defendant_cr_number", t.crNumber, "numeric"],
  ["defendant_address", t.defendantAddress],
  ["court_city", t.courtCity],
];

/** Form values from an existing draft (the party rows use the labels set in backend/app/claim.py). */
function formFromClaim(claim: Claim | null): ClaimRequest {
  if (!claim) return {};
  const value = (rows: Claim["plaintiff"], label: string) => rows.find((r) => r.label === label)?.value ?? null;
  return {
    plaintiff_national_id: value(claim.plaintiff, "رقم الهوية / الإقامة"),
    plaintiff_nationality: value(claim.plaintiff, "الجنسية"),
    plaintiff_phone: value(claim.plaintiff, "رقم الجوال"),
    plaintiff_address: value(claim.plaintiff, "العنوان"),
    defendant_cr_number: value(claim.defendant, "السجل التجاري / الرقم الموحد"),
    defendant_address: value(claim.defendant, "العنوان"),
    court_city: claim.court_city,
  };
}

function Downloads({ caseId, compact = false, onError }: { caseId: number; compact?: boolean; onError: (m: string) => void }) {
  const [busy, setBusy] = useState<"pdf" | "word" | null>(null);
  const get = async (kind: "pdf" | "word") => {
    setBusy(kind);
    try {
      await (kind === "pdf" ? api.downloadClaimPdf(caseId) : api.downloadClaimDocx(caseId));
    } catch (e) {
      onError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };
  return (
    <div className={compact ? "grid grid-cols-2 gap-2.5" : "flex flex-wrap gap-2.5"}>
      <Button variant={compact ? "secondary" : "primary"} size="sm" loading={busy === "pdf"} onClick={() => get("pdf")}>
        {compact ? t.pdf : t.downloadPdf}
      </Button>
      <Button variant="secondary" size="sm" loading={busy === "word"} onClick={() => get("word")}>
        {compact ? t.word : t.downloadWord}
      </Button>
    </div>
  );
}

/** Side card on the result page: open / create the claim draft, quick downloads. */
export function ClaimCard({ caseId, hasClaim }: { caseId: number; hasClaim: boolean }) {
  const [error, setError] = useState<string | null>(null);
  return (
    <Card id="claim" size="sm" title={t.title} action={hasClaim && <Badge tone="success">{t.ready}</Badge>}>
      <p className="text-[15px] leading-[1.8] text-muted">{hasClaim ? t.cardIntro : t.cardEmpty}</p>
      <Link href={`/cases/${caseId}/claim`} className={buttonClass("primary", "md", "w-full")}>
        {hasClaim ? t.open : t.create}
      </Link>
      {hasClaim && <Downloads caseId={caseId} compact onError={setError} />}
      {error && <Alert tone="danger">{error}</Alert>}
    </Card>
  );
}

function PartyTable({ title, rows }: { title: string; rows: Claim["plaintiff"] }) {
  return (
    <div>
      <h3 className="mb-1 font-semibold">{title}</h3>
      <table className="w-full text-[15px]">
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-line align-top last:border-0">
              <th scope="row" className="w-2/5 py-1.5 pe-3 text-start font-medium text-muted">
                {r.label}
              </th>
              <td className={`tabular py-1.5 ${r.value ? "" : "text-danger"}`}>{r.value ?? t.blank}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** The draft as a document, close to the PDF/Word export. */
function ClaimDocument({ claim }: { claim: Claim }) {
  return (
    <article className="flex flex-col gap-6 rounded-lg border border-line bg-surface px-14 py-12 leading-[2] shadow-card max-md:px-5 max-md:py-7">
      <header className="flex flex-col items-center gap-1 border-b border-line pb-5 text-center">
        <h3 className="text-[22px] font-bold">{t.docTitle}</h3>
        <p className="text-muted">{t.court(claim.court_city)}</p>
      </header>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-7">
        <PartyTable title={t.plaintiff} rows={claim.plaintiff} />
        <PartyTable title={t.defendant} rows={claim.defendant} />
      </div>
      <p>
        <strong>{t.subject}</strong>
        {claim.subject}
      </p>
      <div>
        <h3 className="font-semibold">{t.facts}</h3>
        <ol className="list-decimal ps-6">
          {claim.facts.map((f, i) => (
            <li key={i}>{f}</li>
          ))}
        </ol>
      </div>
      <div>
        <h3 className="font-semibold">{t.grounds}</h3>
        <ol className="list-decimal ps-6">
          {claim.legal_grounds.map((g) => (
            <li key={g.record_id}>
              <strong>{g.title}:</strong> {g.argument}
            </li>
          ))}
        </ol>
      </div>
      <div>
        <h3 className="font-semibold">{t.requests}</h3>
        <ol className="tabular list-decimal ps-6">
          {claim.requests.map((r, i) => (
            <li key={i}>
              {r.text}
              {r.amount !== null && (
                <strong>
                  : {formatAmount(r.amount)} {text.sar}
                </strong>
              )}
              {r.formula && <span className="block text-sm text-muted">{r.formula}</span>}
            </li>
          ))}
        </ol>
      </div>
      {claim.total !== null && (
        <p className="tabular rounded-control bg-surface-muted px-5 py-4 text-[19px] font-bold">
          {t.total} {formatAmount(claim.total)} {text.sar}
        </p>
      )}
    </article>
  );
}

/** Claim page body: party details form → draft preview → downloads and notes. */
export function ClaimEditor({ caseId, initial }: { caseId: number; initial: Claim | null }) {
  const [claim, setClaim] = useState<Claim | null>(initial);
  const [form, setForm] = useState<ClaimRequest>(() => formFromClaim(initial));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const fields = (list: [Key, string, string?][]) => (
    <div className="grid gap-4 sm:grid-cols-2">
      {list.map(([key, label, mode]) => (
        <Field key={key} label={label} htmlFor={key}>
          <TextInput
            id={key}
            value={form[key] ?? ""}
            inputMode={mode === "numeric" ? "numeric" : undefined}
            type={mode === "tel" ? "tel" : "text"}
            onChange={(e) => setForm({ ...form, [key]: e.target.value || null })}
          />
        </Field>
      ))}
    </div>
  );

  return (
    <>
      <form onSubmit={generate} className={`flex flex-col gap-[22px] p-8 max-md:px-[18px] max-md:py-[22px] ${cardClass}`}>
        <div className="flex flex-col gap-2">
          <h1 className="text-[26px] font-semibold max-md:text-2xl">{t.title}</h1>
          <p className="flex items-start gap-2 text-[15px] leading-[1.7] text-muted">
            <Icon name="lock" className="mt-0.5 size-[18px]" />
            {t.intro}
          </p>
        </div>
        <fieldset className="min-w-0">
          <legend className="mb-3.5 text-[17px] font-semibold">{t.plaintiffSection}</legend>
          {fields(PLAINTIFF)}
        </fieldset>
        <fieldset className="min-w-0">
          <legend className="mb-3.5 text-[17px] font-semibold">{t.defendantSection}</legend>
          {fields(DEFENDANT)}
        </fieldset>
        <div className="flex flex-wrap items-center gap-3.5">
          <Button type="submit" size="lg" loading={busy}>
            {claim ? t.regenerate : t.generate}
          </Button>
          {claim && (
            <span className="tabular text-sm text-muted">
              {t.lastUpdate} {formatDateTime(claim.created_at)}
            </span>
          )}
        </div>
        {error && <Alert tone="danger">{error}</Alert>}
      </form>

      <section aria-labelledby="preview-title" className="flex flex-col gap-3.5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="preview-title" className="mx-1 text-xl font-semibold">
            {t.preview}
          </h2>
          {claim && <Downloads caseId={caseId} onError={setError} />}
        </div>
        {claim ? (
          <>
            {claim.grounding_warnings.length > 0 && (
              <Alert tone="warning" title={text.result.warnings}>
                {claim.grounding_warnings.join(" — ")}
              </Alert>
            )}
            <ClaimDocument claim={claim} />
            {claim.notes.length > 0 && (
              <div className="flex flex-col gap-2 rounded-2xl bg-warning-bg px-[22px] py-5">
                <p className="text-[15px] font-semibold text-warning">{t.notes}</p>
                <ul className="list-disc ps-5 text-[15px] leading-[1.9]">
                  {claim.notes.map((n, i) => (
                    <li key={i}>{n}</li>
                  ))}
                </ul>
              </div>
            )}
            <p className="text-sm leading-[1.8] text-muted">{claim.disclaimer}</p>
          </>
        ) : (
          <p className="rounded-card border border-dashed border-line-strong px-6 py-10 text-center text-muted">{t.previewEmpty}</p>
        )}
      </section>
    </>
  );
}
