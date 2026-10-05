import type { Metadata } from "next";
import { IBM_Plex_Sans_Arabic } from "next/font/google";
import Link from "next/link";
import { text } from "@/lib/text";
import "./globals.css";

const arabic = IBM_Plex_Sans_Arabic({
  variable: "--font-arabic",
  subsets: ["arabic"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: `${text.appName} | ${text.tagline}`,
  description: text.tagline,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl" className={`${arabic.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">
        <header className="border-b border-line bg-surface">
          <nav className="mx-auto flex max-w-4xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
            <Link href="/" className="text-xl font-bold text-primary">
              {text.appName}
            </Link>
            <span className="hidden text-sm text-muted sm:inline">{text.tagline}</span>
            <div className="ms-auto flex gap-4">
              <Link href="/" className="hover:text-primary">
                {text.nav.analyze}
              </Link>
              <Link href="/search" className="hover:text-primary">
                {text.nav.search}
              </Link>
            </div>
          </nav>
        </header>
        <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
