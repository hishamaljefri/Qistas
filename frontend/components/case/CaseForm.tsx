"use client";
import { useState, type FormEvent } from "react";
import { DocumentUpload } from "@/components/demo/DocumentUpload";
import { Button } from "@/components/ui/Button";
import { cardClass } from "@/components/ui/Card";
import { Field, TextArea, TextInput } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { text } from "@/lib/text";
import type { AnalyzeRequest, AttachedDocument, Gender } from "@/lib/types";

const t = text.form;
export const MIN_DESCRIPTION = 30;

/** Two radio cards (أنثى / ذكر). Nothing selected = not stated. */
export function GenderChoice({ name, value, onChange }: { name: string; value: Gender | ""; onChange: (g: Gender) => void }) {
  return (
    <fieldset className="min-w-0">
      <legend className="mb-2.5 text-base font-semibold">{t.genderLabel}</legend>
      <div className="flex gap-2">
        {(["female", "male"] as const).map((g) => (
          <label
            key={g}
            className={`flex min-h-12 flex-1 cursor-pointer items-center justify-center gap-2 rounded-control border-[1.5px] text-base has-focus-visible:outline-3 has-focus-visible:outline-offset-2 has-focus-visible:outline-focus ${
              value === g ? "border-primary bg-primary-soft font-semibold" : "border-line-strong bg-surface"
            }`}
          >
            <input type="radio" name={name} value={g} checked={value === g} onChange={() => onChange(g)} className="size-[18px] accent-primary focus-visible:outline-none" />
            {t[g]}
          </label>
        ))}
      </div>
      <p className="mt-2.5 text-sm leading-[1.7] text-muted">{t.genderHint}</p>
    </fieldset>
  );
}

/** The analyze form. Stays mounted (hidden) while waiting, so nothing typed is lost on an error. */
export function CaseForm({ onSubmit }: { onSubmit: (req: AnalyzeRequest) => void }) {
  const [description, setDescription] = useState("");
  const [gender, setGender] = useState<Gender | "">("");
  const [employeeName, setEmployeeName] = useState("");
  const [employerName, setEmployerName] = useState("");
  const [documents, setDocuments] = useState<AttachedDocument[]>([]);
  const [tried, setTried] = useState(false);
  const tooShort = description.trim().length < MIN_DESCRIPTION;

  function submit(e: FormEvent) {
    e.preventDefault();
    setTried(true);
    if (tooShort) return;
    onSubmit({
      description: description.trim(),
      employee_gender: gender || null,
      employee_name: employeeName.trim() || null,
      employer_name: employerName.trim() || null,
      documents: documents.filter((d) => d.text.trim()),
    });
  }

  return (
    <form onSubmit={submit} noValidate className={`flex min-w-0 flex-[999_1_560px] flex-col gap-7 p-9 max-md:px-[18px] max-md:py-[22px] ${cardClass}`}>
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl leading-[1.4] font-semibold max-md:text-2xl">{t.title}</h1>
        <p className="text-[17px] leading-[1.8] text-muted">{t.intro}</p>
      </div>

      <Field label={t.descriptionLabel} htmlFor="description" hint={t.descriptionHint} error={tried && tooShort ? t.tooShort : null}>
        <TextArea
          id="description"
          rows={7}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={t.descriptionPlaceholder}
          maxLength={8000}
          aria-invalid={tried && tooShort}
          aria-describedby="description-hint"
        />
      </Field>

      <div className="max-w-md">
        <GenderChoice name="gender" value={gender} onChange={setGender} />
      </div>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-5">
        <Field label={t.employeeNameLabel} htmlFor="employee" optional>
          <TextInput id="employee" value={employeeName} onChange={(e) => setEmployeeName(e.target.value)} placeholder={t.employeeNamePlaceholder} maxLength={120} />
        </Field>
        <Field label={t.employerNameLabel} htmlFor="employer" optional>
          <TextInput id="employer" value={employerName} onChange={(e) => setEmployerName(e.target.value)} placeholder={t.employerNamePlaceholder} maxLength={200} />
        </Field>
      </div>

      <DocumentUpload onChange={setDocuments} />

      <div className="flex items-start gap-3 rounded-[14px] bg-primary-soft px-[18px] py-4">
        <Icon name="shield" className="mt-0.5 size-[22px] text-primary" />
        <p className="text-[15px] leading-[1.7]">{t.privacyNote}</p>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <Button type="submit" size="lg">
          {t.submit}
        </Button>
        <p className="text-sm text-muted">{t.waitNote}</p>
      </div>
    </form>
  );
}

/** Side panel next to the form: what happens after sending. */
export function AfterSubmit() {
  return (
    <aside className="flex min-w-0 flex-[1_1_300px] flex-col gap-5">
      <div className="flex flex-col gap-[18px] rounded-card border border-line bg-surface p-7 max-md:px-[18px] max-md:py-[22px]">
        <h2 className="text-xl font-semibold">{t.afterTitle}</h2>
        <ol className="flex flex-col gap-4">
          {t.afterSteps.map(([title, sub], i) => (
            <li key={title} className="flex items-start gap-3">
              <span className="tabular flex size-[30px] shrink-0 items-center justify-center rounded-full bg-primary-soft text-sm font-semibold text-primary-hover">
                {i + 1}
              </span>
              <span className="text-[15px] leading-[1.7]">
                <strong className="font-semibold">{title}</strong>
                <br />
                <span className="text-muted">{sub}</span>
              </span>
            </li>
          ))}
        </ol>
      </div>
      <p className="px-2 text-[13px] leading-[1.8] text-muted">{text.awareness}</p>
    </aside>
  );
}
