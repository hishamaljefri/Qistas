"use client";
import type { ReactNode } from "react";
import { Page } from "@/components/layout/Page";
import { Alert } from "@/components/ui/Alert";
import { Spinner } from "@/components/ui/Spinner";
import { useRequireAuth } from "@/hooks/useAuth";
import { text } from "@/lib/text";

/** Shows children only to signed-in users (and only to admins when role="admin"). */
export function RequireAuth({ children, role }: { children: ReactNode; role?: "admin" }) {
  const { ready, forbidden } = useRequireAuth(role);
  if (!ready)
    return (
      <Page width="max-w-[760px]">
        <p className="flex items-center gap-3 text-muted">
          <Spinner /> {text.auth.loading}
        </p>
      </Page>
    );
  if (forbidden)
    return (
      <Page width="max-w-[760px]">
        <Alert tone="danger">{text.auth.forbidden}</Alert>
      </Page>
    );
  return <>{children}</>;
}
