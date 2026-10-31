"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { Wordmark } from "@/components/brand/Logo";
import { Icon } from "@/components/ui/Icon";
import { useAuth } from "@/hooks/useAuth";
import { text } from "@/lib/text";

const t = text.nav;

/** Logo, main links (active one highlighted), login state. Below 768px the links move into a menu. */
export function SiteHeader() {
  const { hydrated, session, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const signedIn = hydrated && !!session;
  const links = [
    { href: "/", label: t.analyze, active: pathname === "/" },
    { href: "/search", label: t.search, active: pathname.startsWith("/search") || pathname.startsWith("/articles") },
    ...(signedIn ? [{ href: "/cases", label: t.myCases, active: pathname.startsWith("/cases") }] : []),
    ...(signedIn && session.user.role === "admin" ? [{ href: "/admin/users", label: t.admin, active: pathname.startsWith("/admin") }] : []),
  ];
  const signOut = () => {
    setOpen(false);
    logout();
    router.push("/login");
  };

  const linkClass = (active: boolean) =>
    `rounded-[10px] px-3.5 py-2.5 text-base text-text no-underline hover:bg-surface-muted hover:text-text ${active ? "bg-primary-soft font-semibold" : ""}`;

  const account = !hydrated ? null : session ? (
    <>
      <span className="px-1.5 text-[15px] text-muted">
        <bdi>{session.user.username}</bdi>
      </span>
      <button type="button" onClick={signOut} className="rounded-[10px] px-3.5 py-2.5 text-start text-[15px] text-muted hover:bg-surface-muted hover:text-text">
        {t.logout}
      </button>
    </>
  ) : (
    <>
      <Link href="/login" onClick={() => setOpen(false)} className={linkClass(pathname === "/login")}>
        {t.login}
      </Link>
      <Link href="/register" onClick={() => setOpen(false)} className={linkClass(pathname === "/register")}>
        {t.register}
      </Link>
    </>
  );

  return (
    <header className="relative border-b border-line bg-surface">
      <div className="mx-auto flex max-w-[1200px] items-center justify-between gap-4 px-6 py-3 max-md:px-4">
        <Wordmark />
        <nav aria-label={t.label} className="flex items-center gap-1 max-md:hidden">
          {links.map((l) => (
            <Link key={l.href} href={l.href} aria-current={l.active ? "page" : undefined} className={linkClass(l.active)}>
              {l.label}
            </Link>
          ))}
          {hydrated && <span aria-hidden="true" className="mx-2 h-6 w-px bg-line" />}
          {account}
        </nav>
        <button
          type="button"
          aria-expanded={open}
          aria-controls="mobile-menu"
          aria-label={open ? t.closeMenu : t.openMenu}
          onClick={() => setOpen(!open)}
          className="flex size-11 items-center justify-center rounded-control border border-line bg-surface text-text md:hidden"
        >
          <Icon name={open ? "close" : "menu"} className="size-[22px]" />
        </button>
      </div>
      {open && (
        <nav id="mobile-menu" aria-label={t.label} className="absolute inset-x-0 top-full z-20 flex flex-col gap-1 border-b border-line bg-surface px-4 pt-2 pb-4 shadow-card md:hidden">
          {links.map((l) => (
            <Link key={l.href} href={l.href} onClick={() => setOpen(false)} aria-current={l.active ? "page" : undefined} className={linkClass(l.active)}>
              {l.label}
            </Link>
          ))}
          <span aria-hidden="true" className="my-1 h-px bg-line" />
          {account}
        </nav>
      )}
    </header>
  );
}
