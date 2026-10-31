"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useEffect, useState } from "react";
import { ArticleText } from "@/components/law/ArticleText";
import { StatusBadge } from "@/components/law/StatusBadge";
import { BackLink, Page } from "@/components/layout/Page";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { buttonClass, Button } from "@/components/ui/Button";
import { cardClass } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { Spinner } from "@/components/ui/Spinner";
import { api, ApiError } from "@/lib/api";
import { text } from "@/lib/text";
import type { Article } from "@/lib/types";

const t = text.article;

// "related articles" searches the opening words of the article (its topic), not its number
const relatedQuery = (a: Article) => a.text.split(/[.\n،:؛]/)[0].split(/\s+/).slice(0, 10).join(" ");

export default function ArticlePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [article, setArticle] = useState<Article | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    api
      .provision(decodeURIComponent(id))
      .then(setArticle)
      .catch((e) => setError(e instanceof ApiError ? e.message : text.unexpected));
  }, [id]);

  async function copy() {
    if (!article) return;
    try {
      await navigator.clipboard.writeText(`${article.title}\n${article.text}`);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {}
  }

  const repealed = article?.status === "repealed";
  const note = article && (article.status_note || (repealed ? t.repealedNote : null));

  return (
    <Page width="max-w-[820px]" className="gap-5 pt-8">
      <BackLink onClick={() => router.back()}>{t.back}</BackLink>
      {error && <Alert tone="danger">{error}</Alert>}
      {!article && !error && <Spinner label={text.loading} className="size-7 text-primary" />}
      {article && (
        <article className={`flex flex-col gap-[22px] px-12 py-10 max-md:px-[18px] max-md:py-[22px] ${cardClass}`}>
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <Badge className="text-sm font-normal">{article.source_name}</Badge>
              <StatusBadge status={article.status} always />
            </div>
            <h1 className="text-[32px] leading-[1.4] font-semibold max-md:text-2xl">{article.title}</h1>
          </div>
          {note && (
            <Alert tone={repealed ? "danger" : article.status === "merged" ? "warning" : "info"} className="text-base leading-[1.9]">
              {note}
            </Alert>
          )}
          <blockquote className={`rounded-2xl bg-surface-muted px-[26px] py-6 text-[19px] leading-[2.1] max-md:px-4 max-md:text-[17px] ${repealed ? "text-muted" : ""}`}>
            <ArticleText>{article.text}</ArticleText>
          </blockquote>
          <div className="flex flex-wrap gap-2.5 border-t border-line pt-2">
            <Button variant="secondary" size="sm" onClick={copy}>
              <Icon name={copied ? "check" : "copy"} />
              {copied ? t.copied : t.copy}
            </Button>
            <Link href={`/search?${new URLSearchParams({ q: relatedQuery(article) })}`} className={buttonClass("text", "sm")}>
              {t.related}
            </Link>
          </div>
        </article>
      )}
    </Page>
  );
}
