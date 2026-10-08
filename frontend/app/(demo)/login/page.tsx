"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field, TextInput } from "@/components/ui/Field";
import { useAuth } from "@/hooks/useAuth";
import { text } from "@/lib/text";

const t = text.auth;

/** Where to go after login: the ?next= page if it is a local path, otherwise home. */
function nextPath(): string {
  const next = new URLSearchParams(window.location.search).get("next");
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
}

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(identifier.trim(), password);
      router.replace(nextPath());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-md">
      <Card title={t.loginTitle}>
        <form onSubmit={submit} className="space-y-4">
          <Field label={t.identifier} htmlFor="identifier">
            <TextInput id="identifier" autoComplete="username" value={identifier} onChange={(e) => setIdentifier(e.target.value)} required />
          </Field>
          <Field label={t.password} htmlFor="password">
            <TextInput id="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </Field>
          {error && <Alert tone="danger">{error}</Alert>}
          <Button type="submit" disabled={busy} className="w-full">
            {t.loginButton}
          </Button>
          <p className="text-sm text-muted">
            {t.noAccount}{" "}
            <Link href="/register" className="text-primary hover:underline">
              {text.nav.register}
            </Link>
          </p>
          <p className="text-sm text-muted">{t.sessionNote}</p>
        </form>
      </Card>
    </div>
  );
}
