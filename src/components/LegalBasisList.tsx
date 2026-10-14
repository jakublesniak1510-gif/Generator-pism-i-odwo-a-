import type { LegalBasis } from "@/lib/templates/types";

export function LegalBasisList({ items }: { items: LegalBasis[] }) {
  if (!items.length) return null;
  return (
    <ul className="space-y-3">
      {items.map((lb, i) => (
        <li key={i} className="rounded-lg border border-navy-100 bg-white p-4">
          <p className="font-semibold text-navy-900">
            {lb.article} <span className="font-normal text-gray-600">– {lb.act}</span>
          </p>
          <p className="mt-1 text-sm leading-relaxed text-gray-700">{lb.summary}</p>
          {lb.url ? (
            <a
              href={lb.url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-navy-700 underline underline-offset-2 hover:text-navy-900"
            >
              Treść przepisu
              <span className="sr-only"> (otwiera się w nowej karcie)</span>
              <span aria-hidden="true">↗</span>
            </a>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
