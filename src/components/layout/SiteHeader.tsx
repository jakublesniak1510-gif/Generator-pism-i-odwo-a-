import Link from "next/link";
import { Logo } from "./Logo";

/** `className` – ukrywanie pozycji na wąskich ekranach (4 pozycje nie mieszczą się obok logo przy 375 px). */
const NAV: { href: string; label: string; className?: string }[] = [
  { href: "/#pisma", label: "Pisma" },
  { href: "/poradniki", label: "Poradniki" },
  { href: "/jak-to-dziala", label: "Jak to działa", className: "hidden md:block" },
  { href: "/cennik", label: "Cennik", className: "hidden min-[400px]:block" },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-navy-100 bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/80">
      <a
        href="#tresc"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-2 focus:z-50 focus:rounded focus:bg-navy-800 focus:px-3 focus:py-2 focus:text-white"
      >
        Przejdź do treści
      </a>
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" className="shrink-0" aria-label="PismoGotowe – strona główna">
          <Logo />
        </Link>
        <nav aria-label="Główna nawigacja">
          <ul className="flex items-center gap-0.5 text-sm font-medium text-navy-800 sm:gap-2">
            {NAV.map((item) => (
              <li key={item.href} className={item.className}>
                <Link
                  href={item.href}
                  className="rounded-md px-1.5 py-2 transition-colors hover:bg-navy-50 hover:text-navy-950 sm:px-3"
                >
                  {item.label}
                </Link>
              </li>
            ))}
            <li>
              <Link
                href="/#pisma"
                className="ml-1 hidden rounded-lg bg-accent-400 px-4 py-2 font-semibold text-navy-950 shadow-sm transition-colors hover:bg-accent-300 md:inline-block"
              >
                Napisz pismo
              </Link>
            </li>
          </ul>
        </nav>
      </div>
    </header>
  );
}
