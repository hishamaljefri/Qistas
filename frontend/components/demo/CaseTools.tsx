"use client";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field, Select, TextArea, TextInput } from "@/components/ui/Field";
import { Spinner } from "@/components/ui/Spinner";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { text } from "@/lib/text";
import type { AnalyzeResponse, Gender } from "@/lib/types";

const t = text.caseDetail;

/** Title + rename, version, documents, download report, edit & re-analyze, delete. */
export function CaseTools({ data, onChange }: { data: AnalyzeResponse; onChange: (d: AnalyzeResponse) => void }) {
  const router = useRouter();
  const [renaming, setRenaming] = useState(false);
  const [title, setTitle] = useState(data.title);
  const [editing, setEditing] = useState(false);
  const [description, setDescription] = useState(data.description);
  const [gender, setGender] = useState<Gender | "">(data.employee_gender ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  const rename = (e: FormEvent) => {
    e.preventDefault();
    run(async () => {
      onChange(await api.renameCase(data.case_id, title));
      setRenaming(false);
    });
  };

  const reanalyze = (e: FormEvent) => {
    e.preventDefault();
    run(async () => {
      onChange(await api.reanalyzeCase(data.case_id, { description, employee_gender: gender || null }));
      setEditing(false);
    });
  };

  const remove = () => {
    if (!window.confirm(t.confirmDelete)) return;
    run(async () => {
      await api.deleteCase(data.case_id);
      router.push("/cases");
    });
  };

  return (
    <Card>
      {renaming ? (
        <form onSubmit={rename} className="flex flex-wrap gap-2">
          <TextInput value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} aria-label={t.rename} />
          <Button type="submit" disabled={busy || title.trim().length < 2}>
            {t.save}
          </Button>
          <Button type="button" variant="secondary" onClick={() => setRenaming(false)}>
            {t.cancel}
          </Button>
        </form>
      ) : (
        <div className="flex flex-wrap items-baseline gap-3">
          <h1 className="text-xl font-bold">{data.title}</h1>
          <button className="text-sm text-primary hover:underline" onClick={() => setRenaming(true)}>
            {t.rename}
          </button>
        </div>
      )}
      <p className="mt-1 text-sm text-muted">
        #{data.case_id} · {text.cases.version} {data.version} · {formatDate(data.updated_at)}
      </p>
      {data.documents.length > 0 && (
        <p className="mt-1 text-sm text-muted">
          {t.documents}: {data.documents.map((d) => d.filename).join("، ")}
        </p>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <Button variant="secondary" disabled={busy} onClick={() => run(() => api.downloadReport(data.case_id))}>
          {t.downloadReport}
        </Button>
        <Button variant="secondary" disabled={busy} onClick={() => setEditing(!editing)}>
          {t.edit}
        </Button>
        <Button variant="secondary" disabled={busy} onClick={remove} className="text-danger">
          {t.delete}
        </Button>
      </div>

      {editing && (
        <form onSubmit={reanalyze} className="mt-4 space-y-3">
          <Field label={text.form.descriptionLabel} htmlFor="edit-description">
            <TextArea id="edit-description" rows={6} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={8000} />
          </Field>
          <Field label={text.form.genderLabel} htmlFor="edit-gender">
            <Select id="edit-gender" value={gender} onChange={(e) => setGender(e.target.value as Gender | "")}>
              <option value="">{text.form.genderUnset}</option>
              <option value="male">{text.form.male}</option>
              <option value="female">{text.form.female}</option>
            </Select>
          </Field>
          <Button type="submit" disabled={busy || description.trim().length < 30}>
            {busy ? (
              <>
                <Spinner /> {t.reanalyzing}
              </>
            ) : (
              t.reanalyze
            )}
          </Button>
        </form>
      )}
      {error && (
        <div className="mt-3">
          <Alert tone="danger">{error}</Alert>
        </div>
      )}
    </Card>
  );
}
