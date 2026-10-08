"use client";
import { useEffect, useState } from "react";
import { RequireAuth } from "@/components/demo/RequireAuth";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Select } from "@/components/ui/Field";
import { Spinner } from "@/components/ui/Spinner";
import { useAuth } from "@/hooks/useAuth";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { text } from "@/lib/text";
import type { AdminUser, Role } from "@/lib/types";

const t = text.admin;

function UsersTable() {
  const { session } = useAuth();
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  if (!users) return error ? <Alert tone="danger">{error}</Alert> : <Spinner />;
  return (
    <Card title={t.title}>
      {error && (
        <div className="mb-3">
          <Alert tone="danger">{error}</Alert>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-start text-muted">
              {[t.username, t.email, t.role, t.status, t.cases, t.lastLogin, ""].map((h, i) => (
                <th key={i} className="p-2 text-start font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const self = u.id === session?.user.id;
              return (
                <tr key={u.id} className="border-b border-line">
                  <td className="p-2" dir="ltr">
                    {u.username}
                  </td>
                  <td className="p-2" dir="ltr">
                    {u.email}
                  </td>
                  <td className="p-2">
                    <Select value={u.role} disabled={self} onChange={(e) => update(u.id, { role: e.target.value as Role })} aria-label={t.role}>
                      <option value="user">{t.roles.user}</option>
                      <option value="admin">{t.roles.admin}</option>
                    </Select>
                  </td>
                  <td className="p-2">
                    <Badge tone={u.is_active ? "success" : "danger"}>{u.is_active ? t.active : t.inactive}</Badge>
                  </td>
                  <td className="p-2">{u.case_count}</td>
                  <td className="p-2">{u.last_login_at ? formatDate(u.last_login_at) : "—"}</td>
                  <td className="p-2">
                    {!self && (
                      <Button variant="secondary" onClick={() => update(u.id, { is_active: !u.is_active })}>
                        {u.is_active ? t.deactivate : t.activate}
                      </Button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

export default function AdminUsersPage() {
  return (
    <RequireAuth role="admin">
      <UsersTable />
    </RequireAuth>
  );
}
