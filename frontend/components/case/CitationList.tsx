"use client";
import Link from "next/link";
import { useState } from "react";
import { ArticleText } from "@/components/law/ArticleText";
import { StatusBadge } from "@/components/law/StatusBadge";
import { text } from "@/lib/text";
import type { Citation } from "@/lib/types";

function CitationItem({ c }: { c: Citation }) {
  const [open, setOpen] = useState(false);
  return (
    <li className="border-b border-line py-3 last:border-0">
      <div className="flex flex-wrap items-baseline gap-2">
        <Link href={`/articles/${c.record_id}`} className="font-semibold text-primary hover:underline">
          {c.title}
        </Link>
        <span className="text-sm text-muted">{c.source_name}</span>
        <StatusBadge status={c.status} />
      </div>
      <p className="mt-1">{c.why}</p>
      <button onClick={() => setOpen(!open)} className="mt-1 text-sm text-primary hover:underline">
        {open ? text.result.hideText : text.result.showText}
      </button>
      {open && (
        <div className="mt-2 rounded-control bg-surface-muted p-3 text-sm">
          <ArticleText>{c.text}</ArticleText>
        </div>
      )}
    </li>
  );
}

export function CitationList({ citations }: { citations: Citation[] }) {
  return (
    <ul>
      {citations.map((c) => (
        <CitationItem key={c.record_id} c={c} />
      ))}
    </ul>
  );
}
