"use client";
import { useRef, useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { TextArea } from "@/components/ui/Field";
import { Spinner } from "@/components/ui/Spinner";
import { api, ApiError } from "@/lib/api";
import { text } from "@/lib/text";
import type { AttachedDocument } from "@/lib/types";

const t = text.upload;
const MAX_DOCS = 3;

interface Item extends AttachedDocument {
  file: File;
}

/** Upload → server extracts text (locally for text PDFs, Gemini OCR for scans with consent) → user reviews. */
export function DocumentUpload({ onChange }: { onChange: (docs: AttachedDocument[]) => void }) {
  const [items, setItems] = useState<Item[]>([]);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  function update(next: Item[]) {
    setItems(next);
    onChange(next.map(({ filename, method, pages, text }) => ({ filename, method, pages, text })));
  }

  async function read(file: File, forceOcr = false, replaceIndex?: number) {
    setBusy(true);
    setError(null);
    try {
      const doc = await api.extractDocument(file, consent, forceOcr);
      const item = { ...doc, file };
      update(replaceIndex === undefined ? [...items, item] : items.map((x, i) => (i === replaceIndex ? item : x)));
    } catch (e) {
      setError(e instanceof ApiError && e.code === "consent_required" ? t.consentNeeded : e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <div className="space-y-3 rounded-control border border-line p-3">
      <div>
        <p className="font-medium">{t.title}</p>
        <p className="text-sm text-muted">{t.hint}</p>
      </div>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-1" />
        <span>{t.consent}</span>
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={input}
          type="file"
          accept=".pdf,.png,.jpg,.jpeg,.webp,application/pdf,image/png,image/jpeg,image/webp"
          disabled={busy || items.length >= MAX_DOCS}
          onChange={(e) => e.target.files?.[0] && read(e.target.files[0])}
          aria-label={t.choose}
          className="text-sm"
        />
        {busy && (
          <span className="text-sm text-muted">
            <Spinner /> {t.extracting}
          </span>
        )}
        {items.length >= MAX_DOCS && <span className="text-sm text-muted">{t.max}</span>}
      </div>
      {error && <Alert tone="danger">{error}</Alert>}

      {items.map((d, i) => (
        <div key={i} className="space-y-2 rounded-control bg-surface-muted p-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{d.filename}</span>
            <Badge>{d.method === "gemini_ocr" ? t.ocr : t.textLayer}</Badge>
            {d.pages && <span className="text-sm text-muted">{d.pages} ص</span>}
            <button type="button" className="ms-auto text-sm text-danger" onClick={() => update(items.filter((_, j) => j !== i))}>
              {t.remove}
            </button>
          </div>
          <p className="text-sm text-muted">{t.review}</p>
          <TextArea
            rows={5}
            value={d.text}
            onChange={(e) => update(items.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))}
          />
          {d.method === "text_layer" && (
            <Button type="button" variant="secondary" disabled={busy || !consent} onClick={() => read(d.file, true, i)} className="text-sm">
              {t.garbled}
            </Button>
          )}
        </div>
      ))}
    </div>
  );
}
