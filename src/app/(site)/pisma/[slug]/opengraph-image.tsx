import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { SITE_URL } from "@/components/site";
import { getAllTemplates, getTemplate } from "@/lib/templates";

export const alt = "Gotowe pismo w 2 minuty – PismoGotowe";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export function generateStaticParams() {
  return getAllTemplates().map((t) => ({ slug: t.slug }));
}

/*
 * Fonty: domyślny font ImageResponse nie ma polskich znaków (ą, ę, ł…) i dociągałby je z sieci.
 * Używamy lokalnego DejaVu Sans z repozytorium (ten sam co w eksporcie PDF) – bez pobierania z internetu.
 */
const fontsPromise = Promise.all([
  readFile(join(process.cwd(), "src/assets/fonts/DejaVuSans.ttf")),
  readFile(join(process.cwd(), "src/assets/fonts/DejaVuSans-Bold.ttf")),
]);

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const template = getTemplate(slug);
  const title = template?.seo.h1 || template?.name || "Gotowe pisma i odwołania";
  const [regular, bold] = await fontsPromise;
  const titleSize = title.length > 70 ? 56 : title.length > 45 ? 64 : 76;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "64px 72px",
          background: "linear-gradient(135deg, #0e1b2e 0%, #172b46 55%, #1e3a5f 100%)",
          color: "#ffffff",
          fontFamily: "DejaVu Sans",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <svg width="60" height="60" viewBox="0 0 32 32">
            <rect width="32" height="32" rx="7" fill="#ffffff" />
            <path d="M10 7h9l5 5v13H10z" fill="#1e3a5f" />
            <path d="M19 7v5h5" fill="#fcbf4d" />
            <path
              d="M13 19.5l2.4 2.4 4.6-5.4"
              fill="none"
              stroke="#f08c0c"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <div style={{ display: "flex", fontSize: 34, fontWeight: 700, letterSpacing: -0.5 }}>
            <span>Pismo</span>
            <span style={{ color: "#fcbf4d" }}>Gotowe</span>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", width: 96, height: 6, borderRadius: 3, background: "#f9a825", marginBottom: 28 }} />
          <div style={{ display: "flex", fontSize: titleSize, fontWeight: 700, lineHeight: 1.12, letterSpacing: -1 }}>
            {title}
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 30 }}>
          <div style={{ display: "flex", color: "#c4d3e4" }}>Gotowe pismo w 2 minuty · DOCX + PDF</div>
          <div style={{ display: "flex", fontSize: 24, color: "#98b2cf" }}>{new URL(SITE_URL).host}</div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "DejaVu Sans", data: regular, style: "normal", weight: 400 },
        { name: "DejaVu Sans", data: bold, style: "normal", weight: 700 },
      ],
    },
  );
}
