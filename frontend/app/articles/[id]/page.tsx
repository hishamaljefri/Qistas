"use client";
import { useRouter } from "next/navigation";
import { use, useEffect, useState } from "react";
import { ArticleText } from "@/components/law/ArticleText";
import { StatusBadge } from "@/components/law/StatusBadge";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Spinner } from "@/components/ui/Spinner";
import { api, ApiError } from "@/lib/api";
import { text } from "@/lib/text";
import type { Article } from "@/lib/types";

export default function ArticlePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [article, setArticle] = useState<Article | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .provision(decodeURIComponent(id))
      .then(setArticle)
      .catch((e) => setError(e instanceof ApiError ? e.message : "حدث خطأ غير متوقع."));
  }, [id]);

  return (
    <div className="space-y-4">
      <Button variant="secondary" onClick={() => router.back()}>
        → {text.article.back}
      </Button>
      {error && <Alert tone="danger">{error}</Alert>}
      {!article && !error && <Spinner />}
      {article && (
        <Card
          title={
            <span className="flex flex-wrap items-baseline gap-2">
              {article.title} <StatusBadge status={article.status} />
            </span>
          }
        >
          <p className="mb-3 text-sm text-muted">
            {text.article.source}: {article.source_name}
          </p>
          <ArticleText>{article.text}</ArticleText>
          {article.status_note && <p className="mt-3 text-sm text-muted">{article.status_note}</p>}
        </Card>
      )}
    </div>
  );
}
