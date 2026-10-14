import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SITE_NAME, SITE_URL } from "@/components/site";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "PismoGotowe – gotowe pismo lub odwołanie w 2 minuty",
    template: `%s | ${SITE_NAME}`,
  },
  description:
    "Reklamacje, odwołania od opłat, wypowiedzenia umów i wezwania do zapłaty. Odpowiadasz na kilka pytań, pobierasz gotowe pismo DOCX/PDF z instrukcją wysyłki.",
  applicationName: SITE_NAME,
  openGraph: {
    type: "website",
    locale: "pl_PL",
    siteName: SITE_NAME,
  },
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#1e3a5f",
};

/** Opcjonalna analityka Plausible (bez cookies) – tylko gdy ustawiono domenę w env. */
const PLAUSIBLE_DOMAIN = process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN?.trim();

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pl" className="h-full antialiased">
      <body className="flex min-h-full flex-col bg-white text-gray-800">
        <SiteHeader />
        <main id="tresc" className="flex-1">
          {children}
        </main>
        <SiteFooter />
        {PLAUSIBLE_DOMAIN ? (
          <Script
            defer
            data-domain={PLAUSIBLE_DOMAIN}
            src="https://plausible.io/js/script.js"
            strategy="afterInteractive"
          />
        ) : null}
      </body>
    </html>
  );
}
