"use client";
import type { ReactNode } from "react";
import { Alert } from "@/components/ui/Alert";
import { Spinner } from "@/components/ui/Spinner";
import { useRequireAuth } from "@/hooks/useAuth";
import { text } from "@/lib/text";

/** Shows children only to signed-in users (and only to admins when role="admin"). */
export function RequireAuth({ children, role }: { children: ReactNode; role?: "admin" }) {
  const { ready, forbidden } = useRequireAuth(role);
  if (!ready)
    return (
      <p className="text-muted">
        <Spinner /> {text.auth.loading}
      </p>
    );
  if (forbidden) return <Alert tone="danger">{text.auth.forbidden}</Alert>;
  return <>{children}</>;
}
