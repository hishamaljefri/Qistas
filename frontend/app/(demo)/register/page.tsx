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

export default function RegisterPage() {
  const { register } = useAuth();
  const router = useRouter();
  const [form, setForm] = useState({ username: "", email: "", password: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await register(form.username.trim(), form.email.trim(), form.password);
      router.replace("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  }

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [key]: e.target.value });

  return (
    <div className="mx-auto max-w-md">
      <Card title={t.registerTitle}>
        <form onSubmit={submit} className="space-y-4">
          <Field label={t.username} hint={t.usernameHint} htmlFor="username">
            <TextInput id="username" autoComplete="username" dir="ltr" value={form.username} onChange={set("username")} pattern="[A-Za-z0-9_.\-]{3,32}" required />
          </Field>
          <Field label={t.email} htmlFor="email">
            <TextInput id="email" type="email" autoComplete="email" dir="ltr" value={form.email} onChange={set("email")} required />
          </Field>
          <Field label={t.password} hint={t.passwordHint} htmlFor="password">
            <TextInput id="password" type="password" autoComplete="new-password" value={form.password} onChange={set("password")} minLength={8} maxLength={64} required />
          </Field>
          {error && <Alert tone="danger">{error}</Alert>}
          <Button type="submit" disabled={busy} className="w-full">
            {t.registerButton}
          </Button>
          <p className="text-sm text-muted">
            {t.haveAccount}{" "}
            <Link href="/login" className="text-primary hover:underline">
              {text.nav.login}
            </Link>
          </p>
        </form>
      </Card>
    </div>
  );
}
