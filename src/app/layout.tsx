import type { Metadata, Viewport } from "next";
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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pl" className="h-full antialiased">
      <body className="flex min-h-full flex-col bg-white text-gray-800">
        <SiteHeader />
        <main id="tresc" className="flex-1">
          {children}
        </main>
        <SiteFooter />
      </body>
    </html>
  );
}
