"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState, type FormEvent, type ReactNode } from "react";
import { EmptyState } from "@/components/brand/EmptyState";
import { StatusBadge } from "@/components/law/StatusBadge";
import { Page } from "@/components/layout/Page";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button, buttonClass } from "@/components/ui/Button";
import { cardClass } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { Spinner } from "@/components/ui/Spinner";
import { api, ApiError } from "@/lib/api";
import { text } from "@/lib/text";
import type { SearchHit } from "@/lib/types";

const t = text.search;

/** Wraps each query word found in the text in <mark>. */
function highlight(body: string, query: string): ReactNode[] {
  const words = query.split(/\s+/).filter((w) => w.length >= 2).map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  if (words.length === 0) return [body];
  return body.split(new RegExp(`(${words.join("|")})`, "g")).map((part, i) => (i % 2 ? <mark key={i}>{part}</mark> : part));
}

function Search() {
  const router = useRouter();
  const query = (useSearchParams().get("q") ?? "").trim();
  const [draft, setDraft] = useState(query);
  // results are kept with the query they belong to, so "loading" = the URL query has no results yet
  const [result, setResult] = useState<{ q: string; hits: SearchHit[] | null; error: string | null }>({ q: "", hits: null, error: null });

  useEffect(() => {
    if (query.length < 2) return;
    let current = true;
    api
      .search(query)
      .then((hits) => current && setResult({ q: query, hits, error: null }))
      .catch((e) => current && setResult({ q: query, hits: null, error: e instanceof ApiError ? e.message : text.unexpected }));
    return () => {
      current = false;
    };
  }, [query]);

  const go = (q: string) => {
    setDraft(q);
    if (q.trim().length >= 2) router.push(`/search?${new URLSearchParams({ q: q.trim() })}`);
  };
  const submit = (e: FormEvent) => {
    e.preventDefault();
    go(draft);
  };
  const loading = query.length >= 2 && result.q !== query;
  const hits = result.q === query ? result.hits : null;

  return (
    <Page width="max-w-[900px]">
      <section className={`flex flex-col gap-[18px] p-8 max-md:px-[18px] max-md:py-[22px] ${cardClass}`}>
        <div className="flex flex-col gap-1.5">
          <h1 className="text-[28px] font-semibold max-md:text-2xl">{t.title}</h1>
          <p className="leading-[1.7] text-muted">{t.intro}</p>
        </div>
        <form role="search" onSubmit={submit} className="flex gap-2.5 max-sm:flex-col">
          <label htmlFor="q" className="sr-only">
            {t.label}
          </label>
          <div className="relative flex flex-1 items-center">
            <Icon name="search" className="pointer-events-none absolute start-4 size-[22px] text-muted" />
            <input
              id="q"
              type="search"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={t.placeholder}
              className="min-h-[54px] w-full rounded-[14px] border-[1.5px] border-line-strong bg-surface ps-12 pe-4 text-[17px] text-text placeholder:text-muted"
            />
          </div>
          <Button type="submit" size="lg" className="min-h-[54px] px-7" loading={loading} disabled={draft.trim().length < 2}>
            {t.submit}
          </Button>
        </form>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted">{t.popular}</span>
          {t.chips.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => go(c)}
              className="min-h-9 rounded-full border border-line bg-surface-muted px-3.5 text-sm text-text hover:border-line-strong"
            >
              {c}
            </button>
          ))}
        </div>
      </section>

      {result.q === query && result.error && <Alert tone="danger">{result.error}</Alert>}

      {hits && hits.length > 0 && (
        <>
          <p aria-live="polite" className="mx-1 text-[15px] text-muted">
            {t.count(hits.length, query)}
          </p>
          {hits.map((h) => (
            <article key={h.record_id} className="flex flex-col gap-3 rounded-[18px] border border-line bg-surface px-[26px] py-6 max-md:px-[18px]">
              <div className="flex flex-wrap items-center gap-2.5">
                <h2 className="text-lg font-semibold">
                  <Link href={`/articles/${encodeURIComponent(h.record_id)}`} className="no-underline hover:underline">
                    {h.title}
                  </Link>
                </h2>
                <Badge>{h.source_name}</Badge>
                <StatusBadge status={h.status} />
              </div>
              <p className={`line-clamp-4 max-w-[75ch] leading-[2] whitespace-pre-line ${h.status === "repealed" ? "text-muted" : ""}`}>{highlight(h.text, query)}</p>
              <Link href={`/articles/${encodeURIComponent(h.record_id)}`} className="inline-flex min-h-10 items-center self-start text-[15px] font-semibold">
                {t.readMore}
              </Link>
            </article>
          ))}
        </>
      )}

      {hits && hits.length === 0 && (
        <EmptyState title={t.emptyTitle(query)} body={t.emptyBody}>
          <Link href="/" className={buttonClass("secondary")}>
            {t.emptyAction}
          </Link>
        </EmptyState>
      )}
    </Page>
  );
}

export default function SearchPage() {
  return (
    <Suspense
      fallback={
        <Page width="max-w-[900px]">
          <Spinner label={text.loading} className="size-7 text-primary" />
        </Page>
      }
    >
      <Search />
    </Suspense>
  );
}
