"use client";

import Link from "next/link";

/**
 * Zgoda na natychmiastowe dostarczenie treści cyfrowej (art. 38 ust. 1 pkt 13 u.p.k.).
 * Ta sama treść przy płatności za pismo, odblokowaniu kodem i zakupie pakietu.
 */
export function ConsentCheckbox({
  checked,
  onChange,
  className = "",
  invalid = false,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  className?: string;
  invalid?: boolean;
}) {
  return (
    <label
      className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-xs leading-relaxed text-gray-700 ${
        invalid && !checked ? "border-red-300 bg-red-50/60" : "border-navy-100 bg-navy-50/60"
      } ${className}`}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        aria-invalid={invalid && !checked ? true : undefined}
        className="mt-0.5 h-4 w-4 shrink-0 accent-navy-800"
      />
      <span>
        Żądam natychmiastowego dostarczenia pisma (treści cyfrowej) i przyjmuję do wiadomości, że po jego
        udostępnieniu tracę prawo do odstąpienia od umowy w terminie 14 dni. Akceptuję{" "}
        <Link href="/regulamin" className="underline underline-offset-2">
          regulamin
        </Link>
        .
      </span>
    </label>
  );
}
