import type { Metadata } from "next";
import { Suspense } from "react";
import { DocumentClient, DocumentSkeleton } from "@/components/document/DocumentClient";

export const metadata: Metadata = {
  title: "Twoje pismo",
  robots: { index: false, follow: false, nocache: true },
  // link zawiera token dostępu – nie przekazujemy go w nagłówku Referer do innych serwisów
  referrer: "no-referrer",
};

export default async function DocumentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <Suspense fallback={<DocumentSkeleton />}>
      <DocumentClient id={id} />
    </Suspense>
  );
}
