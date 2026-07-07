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
  title: "LDAT - Perpetual, Automated DAT on Linea",
  description:
    "LDAT is a deflationary, perpetual digital asset treasury on Linea L2. Buy and sell bags through a P2P mechanism with built-in slow-rug protection. The protocol burns LDAT on every cycle.",
  metadataBase: new URL("https://www.on-chaindat.com"),
  openGraph: {
    title: "LDAT",
    description: "Perpetual, automated digital asset treasury on Linea L2",
    type: "website",
  },
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
