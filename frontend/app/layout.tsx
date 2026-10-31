import type { Metadata, Viewport } from "next";
import { Noto_Kufi_Arabic, Poppins, Readex_Pro } from "next/font/google";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { AuthProvider } from "@/hooks/useAuth";
import { text } from "@/lib/text";
import "./globals.css";

// UI text; the Arabic wordmark «قسطاس»; the Latin wordmark "QISTAS" (design handoff, section 1)
const readex = Readex_Pro({ variable: "--font-readex", subsets: ["arabic", "latin"], weight: ["300", "400", "500", "600", "700"] });
const kufi = Noto_Kufi_Arabic({ variable: "--font-kufi", subsets: ["arabic"], weight: ["700"] });
const poppins = Poppins({ variable: "--font-poppins", subsets: ["latin"], weight: ["600"] });

export const metadata: Metadata = {
  title: `${text.appName} | ${text.tagline}`,
  description: text.tagline,
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fff9f1" },
    { media: "(prefers-color-scheme: dark)", color: "#221f1a" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl" className={`${readex.variable} ${kufi.variable} ${poppins.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">
        <AuthProvider>
          <SiteHeader />
          <main className="flex-1">{children}</main>
        </AuthProvider>
      </body>
    </html>
  );
}
