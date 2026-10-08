// Login session kept in the browser (localStorage). No UI here.
//
// The backend issues 30-minute tokens. While the user is active (typing, clicking), the token is
// refreshed every few minutes, so the session only ends after 30 minutes of inactivity (CS498 SR2).
import type { TokenResponse, User } from "./types";

const KEY = "qistas.session";
export const LOGOUT_EVENT = "qistas:logout";
const CHANGE_EVENT = "qistas:session";

export interface Session {
  token: string;
  expiresAt: number; // epoch ms
  user: User;
}

export function loadSession(): Session | null {
  if (typeof window === "undefined") return null;
  try {
    const s = JSON.parse(localStorage.getItem(KEY) ?? "null") as Session | null;
    return s && s.expiresAt > Date.now() ? s : null;
  } catch {
    return null;
  }
}

export function saveSession(res: TokenResponse): Session {
  const session = { token: res.access_token, expiresAt: Date.now() + res.expires_in * 1000, user: res.user };
  try {
    localStorage.setItem(KEY, JSON.stringify(session));
  } catch {}
  window.dispatchEvent(new Event(CHANGE_EVENT));
  return session;
}

export function clearSession(reason?: string) {
  try {
    localStorage.removeItem(KEY);
  } catch {}
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(CHANGE_EVENT));
    window.dispatchEvent(new CustomEvent(LOGOUT_EVENT, { detail: reason }));
  }
}

// For React's useSyncExternalStore: the raw stored string is a stable snapshot.
export function rawSession(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function subscribeSession(onChange: () => void): () => void {
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener("storage", onChange); // other tabs
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}
