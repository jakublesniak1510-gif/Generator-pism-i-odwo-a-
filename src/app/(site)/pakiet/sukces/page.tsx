import type { Metadata } from "next";
import { Suspense } from "react";
import { PackageSuccess, PackageSuccessSkeleton } from "@/components/payments/PackageSuccess";

export const metadata: Metadata = {
  title: "Twój kod pakietu",
  robots: { index: false, follow: false, nocache: true },
  // adres zawiera identyfikator sesji płatności – nie przekazujemy go dalej w nagłówku Referer
  referrer: "no-referrer",
};

export default function PackageSuccessPage() {
  return (
    <Suspense fallback={<PackageSuccessSkeleton />}>
      <PackageSuccess />
    </Suspense>
  );
}
