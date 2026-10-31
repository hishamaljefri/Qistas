"use client";
import { useRouter } from "next/navigation";
import { useState, useSyncExternalStore, type FormEvent } from "react";
import { ScaleMark } from "@/components/brand/Logo";
import { Page } from "@/components/layout/Page";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Field, TextInput } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { Segmented } from "@/components/ui/Segmented";
import { useAuth } from "@/hooks/useAuth";
import { ApiError } from "@/lib/api";
import { logoutReason } from "@/lib/session";
import { text } from "@/lib/text";

const t = text.auth;
type Mode = "login" | "register";
const USERNAME = /^[A-Za-z0-9_.-]{3,32}$/;
const noSubscribe = () => () => {};

/** Where to go after login: the ?next= page if it is a local path, otherwise home. */
function nextPath(): string {
  const next = new URLSearchParams(window.location.search).get("next");
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
}

/** Login and register on one card with tabs; /login and /register open the matching tab. */
export function AuthScreen({ initial }: { initial: Mode }) {
  const { login, register } = useAuth();
  const router = useRouter();
  const [mode, setMode] = useState<Mode>(initial);
  const [form, setForm] = useState({ identifier: "", username: "", email: "", password: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ message: string; wrongPassword: boolean } | null>(null);
  const [tried, setTried] = useState(false);
  const expired = useSyncExternalStore(noSubscribe, logoutReason, () => null);

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [key]: e.target.value });
  const switchTo = (m: Mode) => {
    setMode(m);
    setError(null);
    setTried(false);
    window.history.replaceState(null, "", `/${m}${window.location.search}`);
  };

  const usernameError = mode === "register" && tried && !USERNAME.test(form.username) ? t.usernameHint : null;
  const passwordError = mode === "register" && tried && form.password.length < 8 ? t.passwordHint : null;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setTried(true);
    if (mode === "register" && (!USERNAME.test(form.username) || form.password.length < 8)) return;
    setBusy(true);
    setError(null);
    try {
      if (mode === "login") await login(form.identifier.trim(), form.password);
      else await register(form.username.trim(), form.email.trim(), form.password);
      router.replace(nextPath());
    } catch (err) {
      setError({
        message: err instanceof Error ? err.message : String(err),
        wrongPassword: mode === "login" && err instanceof ApiError && err.status === 401,
      });
      setBusy(false);
    }
  }

  return (
    <Page width="max-w-[1000px]" className="pt-12">
      <div className="flex flex-wrap overflow-hidden rounded-card border border-line shadow-card">
        <div className="q-brand flex flex-[1_1_340px] flex-col justify-between gap-8 px-10 py-12 max-md:px-6 max-md:py-8">
          <ScaleMark className="size-24 max-md:size-16" />
          <div className="flex flex-col gap-3">
            <p className="font-logo text-[40px] leading-[1.3] font-bold text-(--logo-word) max-md:text-[32px]">{text.appName}</p>
            <p className="text-lg leading-[1.9]">{t.brandLine}</p>
            <p className="text-sm leading-[1.8] opacity-85">{t.verse}</p>
          </div>
        </div>

        <div className="flex flex-[1_1_380px] flex-col gap-[22px] bg-surface p-11 max-md:px-[18px] max-md:py-7">
          <Segmented
            kind="tabs"
            size="lg"
            label={t.tabsLabel}
            value={mode}
            onChange={switchTo}
            options={[
              { value: "login", label: t.loginTab },
              { value: "register", label: t.registerTab },
            ]}
          />

          {expired && !error && (
            <Alert tone="warning" title={t.expiredTitle}>
              {t.expiredBody}
            </Alert>
          )}
          {error && (
            <Alert tone="danger" title={mode === "login" ? t.loginFailed : t.registerFailed}>
              {error.message}
            </Alert>
          )}

          <form onSubmit={submit} noValidate className="flex flex-col gap-[18px]">
            {mode === "login" ? (
              <Field label={t.identifier} htmlFor="identifier">
                <TextInput id="identifier" autoComplete="username" value={form.identifier} onChange={set("identifier")} required />
              </Field>
            ) : (
              <>
                <Field label={t.username} htmlFor="username" hint={t.usernameHint} error={usernameError}>
                  <TextInput
                    id="username"
                    autoComplete="username"
                    dir="ltr"
                    className="text-right"
                    value={form.username}
                    onChange={set("username")}
                    aria-invalid={!!usernameError}
                    aria-describedby="username-hint"
                    required
                  />
                </Field>
                <Field label={t.email} htmlFor="email">
                  <TextInput id="email" type="email" autoComplete="email" dir="ltr" className="text-right" value={form.email} onChange={set("email")} required />
                </Field>
              </>
            )}
            <Field label={t.password} htmlFor="password" hint={mode === "register" ? t.passwordHint : undefined} error={passwordError}>
              <TextInput
                id="password"
                type="password"
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                value={form.password}
                onChange={set("password")}
                maxLength={64}
                aria-invalid={!!passwordError || !!error?.wrongPassword}
                aria-describedby={mode === "register" ? "password-hint" : undefined}
                required
              />
            </Field>
            <Button type="submit" size="lg" loading={busy} className="w-full">
              {mode === "login" ? t.loginButton : t.registerButton}
            </Button>
            <p className="text-[15px] text-muted">
              {mode === "login" ? t.noAccount : t.haveAccount}{" "}
              <button type="button" onClick={() => switchTo(mode === "login" ? "register" : "login")} className="font-semibold text-primary underline">
                {mode === "login" ? t.registerTab : t.loginTab}
              </button>
            </p>
          </form>

          <p className="flex items-center gap-2 text-sm text-muted">
            <Icon name="clock" className="size-[18px]" />
            {t.sessionNote}
          </p>
        </div>
      </div>
    </Page>
  );
}
