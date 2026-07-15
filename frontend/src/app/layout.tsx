import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { Providers } from "./providers";
import { TermsGate } from "@/components/terms-gate";
import { Analytics } from "@vercel/analytics/next";
import { GoogleAnalytics } from "@/components/google-analytics";
import { CookieConsent } from "@/components/cookie-consent";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
const jetbrainsMono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono", display: "swap" });

export const metadata: Metadata = {
  title: {
    default: "LDAT - Perpetual, Automated DAT on Linea",
    template: "%s - LDAT",
  },
  description:
    "LDAT is an on-chain digital asset treasury on Linea L2: an autonomous smart-contract treasury with no company, no shares, no dilution. Every cycle buys and burns LDAT.",
  metadataBase: new URL("https://www.on-chaindat.com"),
  // "./" resolves against metadataBase + the live pathname, so every route emits its own
  // self-referencing canonical. Keeps any deploy alias pointing at www.
  alternates: { canonical: "./" },
  openGraph: {
    url: "https://www.on-chaindat.com",
    siteName: "on-chainDAT",
    type: "website",
  },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
    { media: "(prefers-color-scheme: light)", color: "#fbf8f3" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable}`} suppressHydrationWarning>
      <body className="min-h-screen bg-background text-foreground antialiased">
        <Providers>{children}</Providers>
        <TermsGate />
        <CookieConsent />
        <Analytics />
        <GoogleAnalytics />
      </body>
    </html>
  );
}
