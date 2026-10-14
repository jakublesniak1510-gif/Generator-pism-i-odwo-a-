/** Wspólne stałe serwisu (frontend). */

export const SITE_NAME = "PismoGotowe";

/** Bazowy adres serwisu – z env, bez końcowego ukośnika. */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/+$/, "");

export function absoluteUrl(path = "/"): string {
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

/** Ceny w groszach (patrz docs/ARCHITEKTURA.md). */
export const PRICES = {
  single: 2499,
  pack5: 5900,
  lawyerReview: 12900,
} as const;

/** "24,99 zł" */
export function formatPrice(grosze: number): string {
  return (
    new Intl.NumberFormat("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(
      grosze / 100,
    ) + " zł"
  );
}

export const STATIC_PAGES = [
  { path: "/jak-to-dziala", label: "Jak to działa" },
  { path: "/cennik", label: "Cennik" },
  { path: "/kontakt", label: "Kontakt" },
  { path: "/regulamin", label: "Regulamin" },
  { path: "/polityka-prywatnosci", label: "Polityka prywatności" },
] as const;

export const CONTACT_EMAIL = "[ADRES E-MAIL KONTAKTOWY]";
