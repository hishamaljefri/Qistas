import Link from "next/link";
import { ArticleText } from "@/components/law/ArticleText";
import { StatusBadge } from "@/components/law/StatusBadge";
import { Icon } from "@/components/ui/Icon";
import { text } from "@/lib/text";
import type { Citation } from "@/lib/types";

const t = text.result;

/** The articles the analysis relied on: number tile, name, source, why it applies, full text on demand. */
export function ArticleTiles({ citations }: { citations: Citation[] }) {
  const sources = [...new Set(citations.map((c) => c.source_name))].join("، ");
  return (
    <section aria-labelledby="articles-title" className="flex flex-col gap-3">
      <div className="mx-1 flex flex-wrap items-baseline justify-between gap-x-3">
        <h2 id="articles-title" className="text-[22px] font-semibold">
          {t.citations}
        </h2>
        <span className="text-sm text-muted">
          {t.citationsCount(citations.length)} · {sources}
        </span>
      </div>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-3">
        {citations.map((c) => (
          <article key={c.record_id} className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-5">
            <div className="flex items-center gap-3">
              <span className="tabular flex h-12 min-w-12 shrink-0 items-center justify-center rounded-[14px] bg-primary-soft px-1.5 text-xl font-bold text-primary-hover">
                {c.article_number ?? <Icon name="file" className="size-6" />}
              </span>
              <div className="flex min-w-0 flex-col gap-0.5">
                <h3 className="text-base leading-[1.5] font-semibold">
                  <Link href={`/articles/${encodeURIComponent(c.record_id)}`} className="text-text no-underline hover:text-primary hover:underline">
                    {c.title}
                  </Link>
                </h3>
                <span className="flex flex-wrap items-center gap-2 text-[13px] text-muted">
                  {c.source_name} <StatusBadge status={c.status} />
                </span>
              </div>
            </div>
            <p className="text-[15px] leading-[1.9]">{c.why}</p>
            <details className="mt-auto">
              <summary className="inline-flex min-h-10 items-center gap-1.5 text-sm font-semibold text-primary">
                {t.showText}
                <Icon name="chevronDown" className="q-chev size-4 transition-transform" />
              </summary>
              <blockquote className="mt-2 rounded-control bg-surface-muted px-4 py-3.5 text-[15px] leading-[2]">
                <ArticleText>{c.text}</ArticleText>
              </blockquote>
            </details>
          </article>
        ))}
      </div>
    </section>
  );
}
