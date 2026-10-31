"use client";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { GenderChoice, MIN_DESCRIPTION } from "@/components/case/CaseForm";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card, cardClass } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Field, TextArea, TextInput } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { text } from "@/lib/text";
import type { AnalyzeResponse, Gender, ReanalyzeRequest } from "@/lib/types";

const t = text.caseDetail;

/** Case title (rename), version, documents, and the actions: download report, edit & re-analyze, delete. */
export function CaseHeader({ data, onChange, onEdit }: { data: AnalyzeResponse; onChange: (d: AnalyzeResponse) => void; onEdit: () => void }) {
  const router = useRouter();
  const [renaming, setRenaming] = useState(false);
  const [title, setTitle] = useState(data.title);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState<"rename" | "report" | "delete" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(kind: "rename" | "report" | "delete", action: () => Promise<void>) {
    setBusy(kind);
    setError(null);
    try {
      await action();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setConfirming(false);
    } finally {
      setBusy(null);
    }
  }

  const rename = (e: FormEvent) => {
    e.preventDefault();
    run("rename", async () => {
      onChange(await api.renameCase(data.case_id, title.trim()));
      setRenaming(false);
    });
  };

  return (
    <section className={`flex flex-wrap items-end justify-between gap-5 px-8 py-7 max-md:px-[18px] max-md:py-[22px] ${cardClass}`}>
      <div className="flex min-w-0 flex-[1_1_420px] flex-col gap-2">
        {renaming ? (
          <form onSubmit={rename} className="flex flex-wrap items-center gap-2.5">
            <label htmlFor="case-title" className="sr-only">
              {t.titleLabel}
            </label>
            <TextInput id="case-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} autoFocus className="min-w-60 flex-1 text-lg font-semibold" />
            <Button type="submit" loading={busy === "rename"} disabled={title.trim().length < 2}>
              {t.save}
            </Button>
            <Button
              variant="text"
              className="text-text"
              onClick={() => {
                setRenaming(false);
                setTitle(data.title);
              }}
            >
              {t.cancel}
            </Button>
          </form>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-[28px] leading-[1.4] font-semibold max-md:text-[23px]">{data.title}</h1>
            <button
              type="button"
              onClick={() => setRenaming(true)}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2.5 text-sm text-primary hover:bg-surface-muted"
            >
              <Icon name="pencil" className="size-4" />
              {t.rename}
            </button>
          </div>
        )}
        <p className="tabular text-[15px] text-muted">
          {t.caseNo(data.case_id)} · {text.cases.version} {data.version} · {formatDate(data.updated_at)}
        </p>
        {data.documents.length > 0 && (
          <p className="flex flex-wrap items-center gap-2 text-[15px] text-muted">
            <Icon name="file" className="size-[18px]" />
            {t.documents}
            {data.documents.map((d) => (
              <span key={d.filename} dir="ltr" className="text-text">
                {d.filename}
              </span>
            ))}
          </p>
        )}
      </div>
      <div className="flex flex-wrap gap-2.5">
        <Button loading={busy === "report"} onClick={() => run("report", () => api.downloadReport(data.case_id))}>
          {busy !== "report" && <Icon name="download" />}
          {t.downloadReport}
        </Button>
        <Button variant="secondary" onClick={onEdit}>
          {t.edit}
        </Button>
        <Button variant="danger" onClick={() => setConfirming(true)}>
          {t.delete}
        </Button>
      </div>
      {error && (
        <Alert tone="danger" className="w-full">
          {error}
        </Alert>
      )}
      <ConfirmDialog
        open={confirming}
        title={t.deleteTitle}
        body={t.deleteBody}
        confirmLabel={t.deleteConfirm}
        cancelLabel={t.cancel}
        busy={busy === "delete"}
        onClose={() => setConfirming(false)}
        onConfirm={() =>
          run("delete", async () => {
            await api.deleteCase(data.case_id);
            router.push("/cases");
          })
        }
      />
    </section>
  );
}

/** Edit the description (and gender) and run a new analysis version. */
export function EditCaseForm({ data, onSubmit, onCancel }: { data: AnalyzeResponse; onSubmit: (req: ReanalyzeRequest) => void; onCancel: () => void }) {
  const [description, setDescription] = useState(data.description);
  const [gender, setGender] = useState<Gender | "">(data.employee_gender ?? "");
  const tooShort = description.trim().length < MIN_DESCRIPTION;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!tooShort) onSubmit({ description: description.trim(), employee_gender: gender || null });
  };

  return (
    <Card id="edit" title={t.editTitle}>
      <form onSubmit={submit} className="-mt-2 flex flex-col gap-6">
        <p className="text-muted">{t.editIntro}</p>
        <Field label={text.form.descriptionLabel} htmlFor="edit-description" error={tooShort ? text.form.tooShort : null}>
          <TextArea
            id="edit-description"
            rows={8}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={8000}
            aria-invalid={tooShort}
            aria-describedby="edit-description-hint"
          />
        </Field>
        <div className="max-w-sm">
          <GenderChoice name="edit-gender" value={gender} onChange={setGender} />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" size="lg" disabled={tooShort}>
            {t.reanalyze}
          </Button>
          <Button variant="text" className="text-text" onClick={onCancel}>
            {t.cancel}
          </Button>
          <p className="text-sm text-muted">{text.form.waitNote}</p>
        </div>
      </form>
    </Card>
  );
}
