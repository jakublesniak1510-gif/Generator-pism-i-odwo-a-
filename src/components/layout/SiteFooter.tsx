import Link from "next/link";
import { getAllTemplates } from "@/lib/templates";
import { Logo } from "./Logo";

const SERVICE_LINKS = [
  { href: "/jak-to-dziala", label: "Jak to działa" },
  { href: "/cennik", label: "Cennik" },
  { href: "/kontakt", label: "Kontakt" },
];

const LEGAL_LINKS = [
  { href: "/regulamin", label: "Regulamin" },
  { href: "/polityka-prywatnosci", label: "Polityka prywatności" },
];

export function SiteFooter() {
  const templates = getAllTemplates();
  return (
    <footer className="mt-auto bg-navy-950 text-navy-100">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-4">
        <div className="md:col-span-1">
          <Logo light />
          <p className="mt-4 text-sm leading-relaxed text-navy-200">
            Gotowe pisma, reklamacje i odwołania na podstawie sprawdzonych szablonów – z instrukcją, gdzie i jak
            je wysłać.
          </p>
        </div>
        <nav aria-label="Pisma" className="md:col-span-2">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-white">Pisma</h2>
          <ul className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
            {templates.map((t) => (
              <li key={t.slug}>
                <Link href={`/pisma/${t.slug}`} className="text-navy-200 hover:text-white hover:underline">
                  {t.name}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="grid grid-cols-2 gap-6 md:grid-cols-1">
          <nav aria-label="Serwis">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-white">Serwis</h2>
            <ul className="mt-4 space-y-2 text-sm">
              {SERVICE_LINKS.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="text-navy-200 hover:text-white hover:underline">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <nav aria-label="Informacje prawne">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-white">Informacje</h2>
            <ul className="mt-4 space-y-2 text-sm">
              {LEGAL_LINKS.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="text-navy-200 hover:text-white hover:underline">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-6 text-xs text-navy-300 sm:px-6 md:flex-row md:items-center md:justify-between">
          <p>
            Serwis jest narzędziem do tworzenia dokumentów i nie stanowi porady prawnej.
          </p>
          <p>© {new Date().getFullYear()} PismoGotowe</p>
        </div>
      </div>
    </footer>
  );
}
