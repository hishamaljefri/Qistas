"use client";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field, Select, TextArea, TextInput } from "@/components/ui/Field";
import { Spinner } from "@/components/ui/Spinner";
import { text } from "@/lib/text";
import type { AnalyzeRequest, Gender } from "@/lib/types";

const t = text.form;

export function CaseForm({ onSubmit, loading }: { onSubmit: (req: AnalyzeRequest) => void; loading: boolean }) {
  const [description, setDescription] = useState("");
  const [gender, setGender] = useState<Gender | "">("");
  const [employeeName, setEmployeeName] = useState("");
  const [employerName, setEmployerName] = useState("");
  const tooShort = description.trim().length < 30;

  function submit(e: FormEvent) {
    e.preventDefault();
    if (tooShort || loading) return;
    onSubmit({
      description: description.trim(),
      employee_gender: gender || null,
      employee_name: employeeName.trim() || null,
      employer_name: employerName.trim() || null,
    });
  }

  return (
    <Card title={t.title}>
      <form onSubmit={submit} className="space-y-4">
        <Field label={t.descriptionLabel} hint={t.descriptionHint} htmlFor="description">
          <TextArea
            id="description"
            rows={7}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t.descriptionPlaceholder}
            maxLength={8000}
            required
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label={t.genderLabel} hint={t.genderHint} htmlFor="gender">
            <Select id="gender" value={gender} onChange={(e) => setGender(e.target.value as Gender | "")}>
              <option value="">{t.genderUnset}</option>
              <option value="male">{t.male}</option>
              <option value="female">{t.female}</option>
            </Select>
          </Field>
          <Field label={t.employeeNameLabel} htmlFor="employee">
            <TextInput id="employee" value={employeeName} onChange={(e) => setEmployeeName(e.target.value)} maxLength={120} />
          </Field>
          <Field label={t.employerNameLabel} htmlFor="employer">
            <TextInput id="employer" value={employerName} onChange={(e) => setEmployerName(e.target.value)} maxLength={200} />
          </Field>
        </div>

        <p className="text-sm text-muted">🔒 {t.privacyNote}</p>

        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={tooShort || loading}>
            {loading ? (
              <>
                <Spinner /> {t.submitting}
              </>
            ) : (
              t.submit
            )}
          </Button>
          {loading && <span className="text-sm text-muted">{t.waitNote}</span>}
          {!loading && description.length > 0 && tooShort && <span className="text-sm text-muted">{t.tooShort}</span>}
        </div>
      </form>
    </Card>
  );
}
