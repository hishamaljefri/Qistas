"use client";
import { useEffect, useState } from "react";
import { RequireAuth } from "@/components/demo/RequireAuth";
import { Page, PageTitle } from "@/components/layout/Page";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { cardClass } from "@/components/ui/Card";
import { Select } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { Spinner } from "@/components/ui/Spinner";
import { useAuth } from "@/hooks/useAuth";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { text } from "@/lib/text";
import type { AdminUser, Role } from "@/lib/types";

const t = text.admin;
const th = "bg-surface-muted px-3 py-3 text-start text-[13px] font-semibold whitespace-nowrap text-muted";
const td = "border-t border-line px-3 py-3";

function UsersTable() {
  const { session } = useAuth();
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("");

  const load = () => api.adminUsers().then(setUsers).catch((e) => setError(e instanceof Error ? e.message : String(e)));
  useEffect(() => {
    load();
  }, []);

  async function update(id: number, body: { role?: Role; is_active?: boolean }) {
    setError(null);
    try {
      await api.adminUpdateUser(id, body);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  const q = filter.trim().toLowerCase();
  const shown = users?.filter((u) => !q || u.username.toLowerCase().includes(q) || u.email.toLowerCase().includes(q));

  return (
    <Page width="max-w-[1100px]" className="gap-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <PageTitle sub={users && t.summary(users.length, users.filter((u) => u.is_active).length)}>{t.title}</PageTitle>
        <div className="relative flex min-w-[260px] items-center max-md:w-full">
          <label htmlFor="user-filter" className="sr-only">
            {t.filter}
          </label>
          <Icon name="search" className="pointer-events-none absolute start-3.5 size-5 text-muted" />
          <input
            id="user-filter"
            type="search"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder={t.filter}
            className="min-h-[46px] w-full rounded-control border-[1.5px] border-line-strong bg-surface ps-11 pe-3.5 text-[15px] text-text placeholder:text-muted"
          />
        </div>
      </div>

      {error && <Alert tone="danger">{error}</Alert>}
      {!users && !error && <Spinner label={text.loading} className="size-7 text-primary" />}

      {shown && (
        <div className={`overflow-x-auto ${cardClass}`}>
          <table className="w-full border-collapse text-[15px]">
            <thead>
              <tr>
                {[t.username, t.email, t.role, t.status, t.cases, t.lastLogin].map((h) => (
                  <th key={h} scope="col" className={th}>
                    {h}
                  </th>
                ))}
                <th scope="col" className={th}>
                  <span className="sr-only">{t.actions}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {shown.map((u) => {
                const self = u.id === session?.user.id;
                return (
                  <tr key={u.id}>
                    <td className={td}>
                      <div className="flex items-center gap-3">
                        <span aria-hidden="true" className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-soft font-latin text-sm font-semibold text-primary-hover uppercase">
                          {u.username[0]}
                        </span>
                        <span dir="ltr" className="font-semibold">
                          {u.username}
                        </span>
                        {self && <span className="text-sm text-muted">{t.you}</span>}
                      </div>
                    </td>
                    <td className={`${td} text-sm text-muted`} dir="ltr">
                      <span className="block text-right">{u.email}</span>
                    </td>
                    <td className={td}>
                      <Select
                        value={u.role}
                        disabled={self}
                        onChange={(e) => update(u.id, { role: e.target.value as Role })}
                        aria-label={t.roleOf(u.username)}
                        className="min-h-11 min-w-28 px-3 text-[15px]"
                      >
                        <option value="user">{t.roles.user}</option>
                        <option value="admin">{t.roles.admin}</option>
                      </Select>
                    </td>
                    <td className={td}>
                      <Badge tone={u.is_active ? "success" : "danger"}>{u.is_active ? t.active : t.inactive}</Badge>
                    </td>
                    <td className={`${td} tabular`}>{u.case_count}</td>
                    <td className={`${td} tabular whitespace-nowrap`}>{u.last_login_at ? formatDate(u.last_login_at) : "—"}</td>
                    <td className={`${td} text-end`}>
                      {!self && (
                        <Button variant={u.is_active ? "danger" : "secondary"} size="sm" onClick={() => update(u.id, { is_active: !u.is_active })}>
                          {u.is_active ? t.deactivate : t.activate}
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {shown.length === 0 && (
                <tr>
                  <td colSpan={7} className={`${td} py-8 text-center text-muted`}>
                    {t.noMatch}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </Page>
  );
}

export default function AdminUsersPage() {
  return (
    <RequireAuth role="admin">
      <UsersTable />
    </RequireAuth>
  );
}
