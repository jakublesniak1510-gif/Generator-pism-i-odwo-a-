import Link from "next/link";
import type { GuideArticle } from "@/content/poradniki";
import { readingMinutes } from "@/content/poradniki";

export function GuideCard({ guide, headingLevel = "h3" }: { guide: GuideArticle; headingLevel?: "h2" | "h3" }) {
  const Heading = headingLevel;
  return (
    <Link
      href={`/poradniki/${guide.slug}`}
      className="group flex h-full flex-col rounded-xl border border-navy-100 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-navy-300 hover:shadow-md"
    >
      <p className="text-xs font-semibold uppercase tracking-wider text-accent-700">Poradnik</p>
      <Heading className="mt-1.5 font-semibold leading-snug text-navy-900 group-hover:text-navy-950">{guide.title}</Heading>
      <p className="mt-2 text-sm leading-relaxed text-gray-600">{guide.excerpt}</p>
      <p className="mt-auto flex items-center justify-between pt-4 text-sm">
        <span className="text-gray-500">ok. {readingMinutes(guide)} min czytania</span>
        <span className="font-medium text-navy-700 group-hover:underline">Czytaj →</span>
      </p>
    </Link>
  );
}
