"use client";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { ArticleText } from "@/components/law/ArticleText";
import { StatusBadge } from "@/components/law/StatusBadge";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { TextInput } from "@/components/ui/Field";
import { Spinner } from "@/components/ui/Spinner";
import { api, ApiError } from "@/lib/api";
import { text } from "@/lib/text";
import type { SearchHit } from "@/lib/types";

const t = text.search;

export default function SearchPage() {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<SearchHit[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (q.trim().length < 2) return;
    setLoading(true);
    setError(null);
    try {
      setHits(await api.search(q.trim()));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "حدث خطأ غير متوقع.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card title={t.title}>
        <form onSubmit={submit} className="flex gap-2">
          <TextInput value={q} onChange={(e) => setQ(e.target.value)} placeholder={t.placeholder} aria-label={t.title} />
          <Button type="submit" disabled={loading || q.trim().length < 2}>
            {loading ? <Spinner /> : t.submit}
          </Button>
        </form>
      </Card>

      {error && <Alert tone="danger">{error}</Alert>}
      {hits && hits.length === 0 && <Alert>{t.empty}</Alert>}

      {hits?.map((h) => (
        <Card key={h.record_id}>
          <div className="mb-2 flex flex-wrap items-baseline gap-2">
            <Link href={`/articles/${h.record_id}`} className="font-semibold text-primary hover:underline">
              {h.title}
            </Link>
            <span className="text-sm text-muted">{h.source_name}</span>
            <StatusBadge status={h.status} />
          </div>
          <div className="line-clamp-4 text-sm">
            <ArticleText>{h.text}</ArticleText>
          </div>
        </Card>
      ))}
    </div>
  );
}
