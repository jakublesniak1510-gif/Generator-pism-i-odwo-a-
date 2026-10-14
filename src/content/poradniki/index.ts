/**
 * Baza wiedzy – poradniki (/poradniki). Treści statyczne, pisane po polsku.
 * Miejsca wymagające weryfikacji prawnej oznaczono w plikach komentarzem `// [DO WERYFIKACJI]`.
 */
import { dobrePismo } from "./dobre-pismo";
import { listPolecony } from "./list-polecony";
import { odrzuconaReklamacja } from "./odrzucona-reklamacja";
import { rzecznicy } from "./rzecznicy";
import { terminy } from "./terminy";
import { trwalyNosnik } from "./trwaly-nosnik";
import type { GuideArticle } from "./types";

export type { GuideArticle } from "./types";

export const GUIDES: GuideArticle[] = [
  odrzuconaReklamacja,
  listPolecony,
  terminy,
  trwalyNosnik,
  rzecznicy,
  dobrePismo,
];

export function getAllGuides(): GuideArticle[] {
  return GUIDES;
}

export function getGuide(slug: string): GuideArticle | undefined {
  return GUIDES.find((g) => g.slug === slug);
}

/** Poradniki, które w `relatedTemplates` mają dane pismo. */
export function getGuidesForTemplate(templateSlug: string): GuideArticle[] {
  return GUIDES.filter((g) => g.relatedTemplates.includes(templateSlug));
}

/** Szacowany czas czytania w minutach (ok. 200 słów/min). */
export function readingMinutes(article: GuideArticle): number {
  const words = article.body.split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}
