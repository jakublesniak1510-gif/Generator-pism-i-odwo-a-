import Link from "next/link";
import { getAllTemplates } from "@/lib/templates";

export default function NotFound() {
  const templates = getAllTemplates().slice(0, 4);
  return (
    <div className="mx-auto max-w-2xl px-4 py-20 text-center sm:py-28">
      <p className="text-sm font-semibold uppercase tracking-wider text-accent-600">Błąd 404</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight text-navy-900 sm:text-4xl">Nie znaleźliśmy tej strony</h1>
      <p className="mt-4 text-gray-600">
        Strona mogła zostać przeniesiona albo adres zawiera literówkę. Wybierz pismo z listy lub wróć na stronę główną.
      </p>
      <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
        <Link href="/" className="rounded-lg bg-navy-800 px-5 py-3 font-semibold text-white hover:bg-navy-900">
          Strona główna
        </Link>
        <Link href="/#pisma" className="rounded-lg border border-gray-300 px-5 py-3 font-semibold text-navy-900 hover:bg-gray-50">
          Wszystkie pisma
        </Link>
      </div>
      {templates.length ? (
        <ul className="mt-10 flex flex-wrap justify-center gap-2 text-sm">
          {templates.map((t) => (
            <li key={t.slug}>
              <Link href={`/pisma/${t.slug}`} className="inline-block rounded-full bg-navy-50 px-3 py-1.5 text-navy-800 hover:bg-navy-100">
                {t.name}
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
