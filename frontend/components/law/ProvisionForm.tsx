"use client";
import { useState, type FormEvent } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { cardClass } from "@/components/ui/Card";
import { Field, Select, TextArea, TextInput } from "@/components/ui/Field";
import { text } from "@/lib/text";
import type { LawSource, ProvisionStatus } from "@/lib/types";

const t = text.law;
const f = t.fields;

export interface ProvisionValues {
  source_code: string;
  article_number: string;
  title: string;
  hierarchy: string;
  status: ProvisionStatus;
  status_note: string;
  text: string;
  reason: string;
}

/** Edit an article, or (with `sources`) add a new one. Every save needs a reason, kept in the history. */
export function ProvisionForm({
  initial,
  sources,
  busy,
  error,
  onSubmit,
}: {
  initial: ProvisionValues;
  sources?: LawSource[]; // given only when adding
  busy: boolean;
  error: string | null;
  onSubmit: (values: ProvisionValues) => void;
}) {
  const creating = !!sources;
  const [v, setV] = useState(initial);
  const [tried, setTried] = useState(false);
  const set = (key: keyof ProvisionValues) => (e: { target: { value: string } }) => setV({ ...v, [key]: e.target.value });

  const unchanged = !creating && (["article_number", "title", "status", "status_note", "text"] as const).every((k) => v[k].trim() === initial[k].trim());
  const errors = {
    title: v.title.trim().length < 2 ? f.titleError : null,
    text: v.text.trim().length < 5 ? f.textError : null,
    reason: v.reason.trim().length < 5 ? f.reasonError : null,
  };

  function submit(e: FormEvent) {
    e.preventDefault();
    setTried(true);
    if (!Object.values(errors).some(Boolean) && !unchanged) onSubmit(v);
  }

  return (
    <form onSubmit={submit} noValidate className={`flex flex-col gap-6 p-8 max-md:px-[18px] max-md:py-[22px] ${cardClass}`}>
      {creating && (
        <Field label={t.sourceLabel} htmlFor="source">
          <Select id="source" value={v.source_code} onChange={set("source_code")}>
            {sources.map((s) => (
              <option key={s.code} value={s.code}>
                {s.name_ar}
              </option>
            ))}
          </Select>
        </Field>
      )}
      <div className="grid gap-5 sm:grid-cols-[1fr_200px]">
        <Field label={f.title} htmlFor="title" hint={f.titleHint} error={tried ? errors.title : null}>
          <TextInput id="title" value={v.title} onChange={set("title")} maxLength={300} aria-invalid={tried && !!errors.title} aria-describedby="title-hint" />
        </Field>
        <Field label={f.article_number} htmlFor="article_number" optional>
          <TextInput id="article_number" value={v.article_number} onChange={set("article_number")} maxLength={20} className="tabular" />
        </Field>
      </div>
      {creating && (
        <Field label={f.hierarchy} htmlFor="hierarchy" optional>
          <TextInput id="hierarchy" value={v.hierarchy} onChange={set("hierarchy")} maxLength={300} />
        </Field>
      )}
      <div className="grid gap-5 sm:grid-cols-[200px_1fr]">
        <Field label={f.status} htmlFor="status">
          <Select id="status" value={v.status} onChange={set("status")}>
            {(["in_force", "repealed", "merged"] as const).map((s) => (
              <option key={s} value={s}>
                {text.status[s]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={f.status_note} htmlFor="status_note" hint={f.statusNoteHint} optional>
          <TextInput id="status_note" value={v.status_note} onChange={set("status_note")} maxLength={1000} aria-describedby="status_note-hint" />
        </Field>
      </div>
      <Field label={f.text} htmlFor="text" error={tried ? errors.text : null}>
        <TextArea id="text" rows={14} value={v.text} onChange={set("text")} maxLength={50000} aria-invalid={tried && !!errors.text} />
      </Field>
      <Field
        label={creating ? f.createReason : f.reason}
        htmlFor="reason"
        hint={creating ? f.createReasonHint : f.reasonHint}
        error={tried ? errors.reason : null}
      >
        <TextInput id="reason" value={v.reason} onChange={set("reason")} maxLength={500} aria-invalid={tried && !!errors.reason} aria-describedby="reason-hint" />
      </Field>
      {error && <Alert tone="danger">{error}</Alert>}
      <div className="flex flex-wrap items-center gap-4">
        <Button type="submit" size="lg" loading={busy} disabled={unchanged}>
          {creating ? t.create : t.save}
        </Button>
        {unchanged && <p className="text-sm text-muted">{t.noChange}</p>}
      </div>
    </form>
  );
}
