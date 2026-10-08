"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { text } from "@/lib/text";

export function AuthNav() {
  const { hydrated, session, logout } = useAuth();
  const router = useRouter();
  if (!hydrated) return null;
  if (!session)
    return (
      <>
        <Link href="/login" className="hover:text-primary">
          {text.nav.login}
        </Link>
        <Link href="/register" className="hover:text-primary">
          {text.nav.register}
        </Link>
      </>
    );
  return (
    <>
      <Link href="/cases" className="hover:text-primary">
        {text.nav.myCases}
      </Link>
      {session.user.role === "admin" && (
        <Link href="/admin/users" className="hover:text-primary">
          {text.nav.admin}
        </Link>
      )}
      <span className="text-sm text-muted">{session.user.username}</span>
      <button
        className="text-sm hover:text-primary"
        onClick={() => {
          logout();
          router.push("/login");
        }}
      >
        {text.nav.logout}
      </button>
    </>
  );
}
