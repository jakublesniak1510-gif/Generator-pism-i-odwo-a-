import Link from "next/link";
import type { LetterTemplate } from "@/lib/templates/types";
import { formatPrice } from "./site";
import { TemplateIcon } from "./TemplateIcon";

type CardTemplate = Pick<
  LetterTemplate,
  "slug" | "name" | "shortDescription" | "icon" | "category" | "priceGrosze" | "estimatedMinutes"
>;

export function TemplateCard({ template, headingLevel = "h3" }: { template: CardTemplate; headingLevel?: "h2" | "h3" }) {
  const Heading = headingLevel;
  return (
    <Link
      href={`/pisma/${template.slug}`}
      className="group relative flex h-full flex-col rounded-xl border border-navy-100 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-navy-300 hover:shadow-md"
    >
      <div className="flex items-start gap-4">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-navy-50 text-navy-700 transition-colors group-hover:bg-navy-800 group-hover:text-white">
          <TemplateIcon icon={template.icon} category={template.category} />
        </span>
        <div className="min-w-0">
          <Heading className="font-semibold leading-snug text-navy-900 group-hover:text-navy-950">{template.name}</Heading>
          <p className="mt-1 text-sm leading-relaxed text-gray-600">{template.shortDescription}</p>
        </div>
      </div>
      <div className="mt-auto flex items-center justify-between gap-3 pt-5 text-sm">
        <span className="font-semibold text-navy-900">{formatPrice(template.priceGrosze)}</span>
        <span className="inline-flex items-center gap-1 text-gray-500">
          <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v5l3 2" strokeLinecap="round" />
          </svg>
          ok. {template.estimatedMinutes} min
        </span>
      </div>
      <span
        aria-hidden="true"
        className="absolute right-4 top-4 text-navy-300 opacity-0 transition group-hover:translate-x-0.5 group-hover:opacity-100"
      >
        →
      </span>
    </Link>
  );
}
