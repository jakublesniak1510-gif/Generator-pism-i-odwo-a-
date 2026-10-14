import { getDocument, verifyToken } from "@/lib/db";
import { renderDocx } from "@/lib/export/docx";
import { renderPdf } from "@/lib/export/pdf";
import { apiError, isUuid } from "../../../_lib/http";

export const runtime = "nodejs";

const CONTENT_TYPES = {
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  pdf: "application/pdf",
} as const;

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await params;
  const search = new URL(req.url).searchParams;
  const token = search.get("token");
  const format = search.get("format") ?? "docx";

  if (format !== "docx" && format !== "pdf") {
    return apiError(400, "Nieobsługiwany format. Dostępne: docx, pdf.");
  }
  if (!isUuid(id) || !verifyToken(id, token)) {
    return apiError(403, "Brak dostępu do tego pisma.");
  }
  const doc = getDocument(id);
  if (!doc) return apiError(404, "Nie znaleziono pisma.");
  if (doc.status !== "paid") {
    return apiError(403, "Pobranie pełnego pisma jest dostępne po opłaceniu.");
  }

  let bytes: Uint8Array;
  try {
    bytes = format === "pdf" ? await renderPdf(doc.document) : await renderDocx(doc.document);
  } catch (err) {
    console.error(`[api/download] błąd generowania ${format}`, id, err);
    return apiError(500, "Nie udało się wygenerować pliku. Spróbuj ponownie.");
  }

  const date = doc.createdAt.slice(0, 10);
  const filename = `${doc.slug}-${date}.${format}`;
  return new Response(new Uint8Array(bytes), {
    status: 200,
    headers: {
      "Content-Type": CONTENT_TYPES[format],
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": String(bytes.byteLength),
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
