import Link from "next/link";

export interface Crumb {
  label: string;
  href?: string;
}

export function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="Ścieżka nawigacji" className="text-sm text-gray-500">
      <ol className="flex flex-wrap items-center gap-1.5">
        {items.map((c, i) => {
          const last = i === items.length - 1;
          return (
            <li key={i} className="flex items-center gap-1.5">
              {c.href && !last ? (
                <Link href={c.href} className="hover:text-navy-800 hover:underline">
                  {c.label}
                </Link>
              ) : (
                <span aria-current={last ? "page" : undefined} className={last ? "text-navy-900" : undefined}>
                  {c.label}
                </span>
              )}
              {!last ? <span aria-hidden="true" className="text-gray-300">/</span> : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
