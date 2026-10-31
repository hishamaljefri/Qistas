"use client";
import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { StatusBadge } from "@/components/law/StatusBadge";
import { RequireAuth } from "@/components/demo/RequireAuth";
import { Page, PageTitle } from "@/components/layout/Page";
import { Alert } from "@/components/ui/Alert";
import { Button, buttonClass } from "@/components/ui/Button";
import { cardClass } from "@/components/ui/Card";
import { Select } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { Spinner } from "@/components/ui/Spinner";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { text } from "@/lib/text";
import type { LawRow, LawSource } from "@/lib/types";

const t = text.law;
const th = "bg-surface-muted px-3 py-3 text-start text-[13px] font-semibold whitespace-nowrap text-muted";
const td = "border-t border-line px-3 py-3 align-top";

function LawList() {
  const [sources, setSources] = useState<LawSource[]>([]);
  const [draft, setDraft] = useState("");
  const [filters, setFilters] = useState({ q: "", source: "", status: "" });
  const [rows, setRows] = useState<LawRow[] | null>(null);
  const [total, setTotal] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.lawSources().then(setSources).catch(() => {});
  }, []);

  useEffect(() => {
    let current = true;
    api
      .lawProvisions(filters)
      .then((page) => {
        if (!current) return;
        setRows(page.items);
        setTotal(page.total);
        setError(null);
      })
      .catch((e) => current && setError(e instanceof Error ? e.message : String(e)));
    return () => {
      current = false;
    };
  }, [filters]);

  async function more() {
    if (!rows) return;
    setLoadingMore(true);
    try {
      const page = await api.lawProvisions({ ...filters, offset: rows.length });
      setRows([...rows, ...page.items]);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoadingMore(false);
    }
  }

  const search = (e: FormEvent) => {
    e.preventDefault();
    setFilters({ ...filters, q: draft.trim() });
  };

  return (
    <Page width="max-w-[1100px]" className="gap-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <PageTitle sub={rows ? t.count(total) : undefined}>{t.title}</PageTitle>
        <Link href="/admin/law/new" className={buttonClass()}>
          <Icon name="plus" />
          {t.add}
        </Link>
      </div>
      <p className="-mt-2 flex items-start gap-2 text-[15px] leading-[1.7] text-muted">
        <Icon name="info" className="mt-0.5 size-[18px]" />
        {t.intro}
      </p>

      <form role="search" onSubmit={search} className={`flex flex-wrap items-end gap-3 p-5 max-md:p-4 ${cardClass}`}>
        <div className="relative flex min-w-[260px] flex-[2_1_320px] items-center">
          <label htmlFor="law-q" className="sr-only">
            {t.filterLabel}
          </label>
          <Icon name="search" className="pointer-events-none absolute start-3.5 size-5 text-muted" />
          <input
            id="law-q"
            type="search"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={t.filterText}
            className="min-h-12 w-full rounded-control border-[1.5px] border-line-strong bg-surface ps-11 pe-3.5 text-base text-text placeholder:text-muted"
          />
        </div>
        <div className="flex-[1_1_180px]">
          <label htmlFor="law-source" className="sr-only">
            {t.sourceLabel}
          </label>
          <Select id="law-source" value={filters.source} onChange={(e) => setFilters({ ...filters, source: e.target.value })}>
            <option value="">{t.allSources}</option>
            {sources.map((s) => (
              <option key={s.code} value={s.code}>
                {s.name_ar} ({s.provisions})
              </option>
            ))}
          </Select>
        </div>
        <div className="flex-[1_1_140px]">
          <label htmlFor="law-status" className="sr-only">
            {t.statusLabel}
          </label>
          <Select id="law-status" value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
            <option value="">{t.allStatuses}</option>
            {(["in_force", "repealed", "merged"] as const).map((s) => (
              <option key={s} value={s}>
                {text.status[s]}
              </option>
            ))}
          </Select>
        </div>
        <Button type="submit">{t.search}</Button>
      </form>

      {error && <Alert tone="danger">{error}</Alert>}
      {!rows && !error && <Spinner label={text.loading} className="size-7 text-primary" />}

      {rows && (
        <div className={`overflow-x-auto ${cardClass}`}>
          <table className="w-full border-collapse text-[15px]">
            <thead>
              <tr>
                {[t.article, t.sourceLabel, t.statusLabel, t.changes].map((h) => (
                  <th key={h} scope="col" className={th}>
                    {h}
                  </th>
                ))}
                <th scope="col" className={th}>
                  <span className="sr-only">{t.edit}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.record_id}>
                  <td className={td}>
                    <span className="block font-semibold">{r.title}</span>
                    <span dir="ltr" className="tabular block text-right text-[13px] text-muted">
                      {r.record_id}
                    </span>
                  </td>
                  <td className={`${td} text-sm text-muted`}>{r.source_name}</td>
                  <td className={td}>
                    <StatusBadge status={r.status} always />
                  </td>
                  <td className={`${td} tabular text-sm text-muted`}>
                    {r.last_changed_at ? t.edited(r.revisions, formatDate(r.last_changed_at)) : t.never}
                  </td>
                  <td className={`${td} text-end`}>
                    <Link href={`/admin/law/${encodeURIComponent(r.record_id)}`} className={buttonClass("secondary", "sm")}>
                      <Icon name="pencil" className="size-4" />
                      {t.edit}
                    </Link>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={5} className={`${td} py-8 text-center text-muted`}>
                    {t.none}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
      {rows && rows.length < total && (
        <Button variant="secondary" onClick={more} loading={loadingMore} className="self-center">
          {t.more}
        </Button>
      )}
    </Page>
  );
}

export default function LawAdminPage() {
  return (
    <RequireAuth role="admin">
      <LawList />
    </RequireAuth>
  );
}
