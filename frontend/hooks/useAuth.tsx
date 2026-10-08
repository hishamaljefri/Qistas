"use client";
// Login state for the whole app. Logic only; no styling.
import { usePathname, useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useMemo, useSyncExternalStore, type ReactNode } from "react";
import { api } from "@/lib/api";
import { clearSession, loadSession, rawSession, saveSession, subscribeSession, type Session } from "@/lib/session";

const REFRESH_EVERY_MS = 4 * 60_000; // refresh the 30-minute token while the user is active
const ACTIVE_WINDOW_MS = 5 * 60_000; // "active" = typed/clicked within the last 5 minutes

interface AuthValue {
  /** false during the very first render (before the browser storage can be read) */
  hydrated: boolean;
  session: Session | null;
  login: (identifier: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthValue | null>(null);
const noopSubscribe = () => () => {};

export function AuthProvider({ children }: { children: ReactNode }) {
  const hydrated = useSyncExternalStore(noopSubscribe, () => true, () => false);
  const raw = useSyncExternalStore(subscribeSession, rawSession, () => null);
  // re-parsed whenever the stored session string changes
  const session = useMemo(() => (raw ? loadSession() : null), [raw]);

  // Sliding expiry (CS498 SR2): refresh while active; an idle user is logged out by the 30-min expiry.
  useEffect(() => {
    if (!session) return;
    let lastActivity = Date.now();
    const mark = () => (lastActivity = Date.now());
    const events = ["keydown", "pointerdown", "scroll"] as const;
    events.forEach((e) => window.addEventListener(e, mark, { passive: true }));
    const timer = window.setInterval(async () => {
      if (Date.now() >= session.expiresAt) return clearSession("انتهت الجلسة");
      if (Date.now() - lastActivity < ACTIVE_WINDOW_MS) {
        try {
          saveSession(await api.refresh());
        } catch {}
      }
    }, REFRESH_EVERY_MS);
    return () => {
      window.clearInterval(timer);
      events.forEach((e) => window.removeEventListener(e, mark));
    };
  }, [session]);

  const value = useMemo<AuthValue>(
    () => ({
      hydrated,
      session,
      login: async (identifier, password) => void saveSession(await api.login(identifier, password)),
      register: async (username, email, password) => void saveSession(await api.register(username, email, password)),
      logout: () => clearSession(),
    }),
    [hydrated, session],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}

/** Sends signed-out visitors to /login (and back here after login). Returns the session when ready. */
export function useRequireAuth(role?: "admin"): { ready: boolean; session: Session | null; forbidden: boolean } {
  const { hydrated, session } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  useEffect(() => {
    if (hydrated && !session) router.replace(`/login?next=${encodeURIComponent(pathname)}`);
  }, [hydrated, session, router, pathname]);
  const ready = hydrated && !!session;
  return { ready, session, forbidden: ready && role === "admin" && session!.user.role !== "admin" };
}
