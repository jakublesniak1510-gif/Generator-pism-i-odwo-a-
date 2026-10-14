import type { FaqItem } from "@/lib/templates/types";
import { Markdown } from "./Markdown";

export function Faq({ items }: { items: FaqItem[] }) {
  if (!items.length) return null;
  return (
    <div className="divide-y divide-navy-100 overflow-hidden rounded-xl border border-navy-100 bg-white">
      {items.map((item, i) => (
        <details key={i} className="group">
          <summary className="flex cursor-pointer items-center justify-between gap-4 px-5 py-4 text-left font-medium text-navy-900 transition-colors hover:bg-navy-50/60">
            <span>{item.question}</span>
            <svg
              aria-hidden="true"
              viewBox="0 0 20 20"
              className="faq-chevron h-5 w-5 shrink-0 text-navy-400 transition-transform"
              fill="currentColor"
            >
              <path d="M5.3 7.3a1 1 0 011.4 0L10 10.6l3.3-3.3a1 1 0 111.4 1.4l-4 4a1 1 0 01-1.4 0l-4-4a1 1 0 010-1.4z" />
            </svg>
          </summary>
          <div className="px-5 pb-5 pt-1">
            <Markdown>{item.answer}</Markdown>
          </div>
        </details>
      ))}
    </div>
  );
}
