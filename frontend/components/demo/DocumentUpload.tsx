"use client";
import { useRef, useState, type DragEvent } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Checkbox, TextArea } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { Spinner } from "@/components/ui/Spinner";
import { api, ApiError } from "@/lib/api";
import { text } from "@/lib/text";
import type { AttachedDocument } from "@/lib/types";

const t = text.upload;
const MAX_DOCS = 3;
const ACCEPT = ".pdf,.png,.jpg,.jpeg,.webp,application/pdf,image/png,image/jpeg,image/webp";

interface Item extends AttachedDocument {
  file: File;
}

/** Upload → server extracts text (locally for text PDFs, Gemini OCR for scans with consent) → user reviews. */
export function DocumentUpload({ onChange }: { onChange: (docs: AttachedDocument[]) => void }) {
  const [items, setItems] = useState<Item[]>([]);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState<string | null>(null); // name of the file being read
  const [error, setError] = useState<{ consent: boolean; message: string } | null>(null);
  const [dragging, setDragging] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const full = items.length >= MAX_DOCS;

  function update(next: Item[]) {
    setItems(next);
    onChange(next.map(({ filename, method, pages, text }) => ({ filename, method, pages, text })));
  }

  async function read(file: File, forceOcr = false, replaceIndex?: number) {
    setBusy(file.name);
    setError(null);
    try {
      const doc = await api.extractDocument(file, consent, forceOcr);
      const item = { ...doc, file };
      update(replaceIndex === undefined ? [...items, item] : items.map((x, i) => (i === replaceIndex ? item : x)));
    } catch (e) {
      const needsConsent = e instanceof ApiError && e.code === "consent_required";
      setError({ consent: needsConsent, message: needsConsent ? t.consentNeeded : e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(null);
      if (input.current) input.current.value = "";
    }
  }

  function drop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file && !busy && !full) read(file);
  }

  return (
    <div className="flex flex-col gap-3.5 rounded-2xl border border-line bg-surface-muted p-[22px] max-md:p-4">
      <div className="flex flex-col gap-1">
        <p className="text-base font-semibold">
          {t.title} <span className="font-normal text-muted">{text.optional}</span>
        </p>
        <p className="text-sm leading-[1.7] text-muted">{t.intro}</p>
      </div>

      <Checkbox checked={consent} onChange={(e) => setConsent(e.target.checked)} label={t.consent} />

      {!full && (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={drop}
          className={`flex flex-col items-center gap-2.5 rounded-[14px] border-2 border-dashed px-5 py-7 text-center ${
            dragging ? "border-primary bg-primary-soft" : "border-line-strong bg-surface"
          }`}
        >
          <Icon name="upload" className="size-7 text-primary" />
          <p className="font-medium">{t.drop}</p>
          <input ref={input} type="file" accept={ACCEPT} className="sr-only" tabIndex={-1} aria-hidden="true" onChange={(e) => e.target.files?.[0] && read(e.target.files[0])} />
          <Button variant="secondary" size="sm" disabled={!!busy} onClick={() => input.current?.click()} className="border-primary">
            {t.choose}
          </Button>
          <p className="text-[13px] leading-[1.6] text-muted">{t.hint}</p>
        </div>
      )}
      {full && <p className="text-sm text-muted">{t.max}</p>}

      {busy && (
        <div className="flex items-center gap-3 rounded-[14px] bg-surface px-4 py-3.5" role="status">
          <Spinner className="size-5 text-primary" />
          <span dir="ltr" className="font-semibold">
            {busy}
          </span>
          <span className="text-sm text-muted">{t.extracting}</span>
        </div>
      )}
      {error && (
        <Alert tone="danger" title={error.consent ? t.consentLead : undefined}>
          {error.message}
        </Alert>
      )}

      {items.map((d, i) => (
        <div key={i} className="flex flex-col gap-3 rounded-[14px] border border-line bg-surface p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex min-w-0 flex-wrap items-center gap-2.5">
              <Icon name="file" className="size-5 text-primary" />
              <span dir="ltr" className="font-semibold break-all">
                {d.filename}
              </span>
              <span className="text-[13px] text-muted">
                {d.method === "gemini_ocr" ? t.ocr : t.textLayer}
                {d.pages ? ` · ${t.pages(d.pages)}` : ""}
              </span>
            </div>
            <Button variant="danger" size="sm" onClick={() => update(items.filter((_, j) => j !== i))}>
              {t.remove}
            </Button>
          </div>
          <label htmlFor={`doc-${i}`} className="text-sm text-muted">
            {t.review}
          </label>
          <TextArea
            id={`doc-${i}`}
            rows={4}
            value={d.text}
            onChange={(e) => update(items.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))}
            className="text-[15px]"
          />
          {d.method === "text_layer" && (
            <Button variant="secondary" size="sm" disabled={!!busy || !consent} onClick={() => read(d.file, true, i)} className="self-start">
              {t.garbled}
            </Button>
          )}
        </div>
      ))}
    </div>
  );
}
