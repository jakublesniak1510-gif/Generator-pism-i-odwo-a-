/** Artykuł bazy wiedzy (/poradniki/[slug]). */
export interface GuideArticle {
  slug: string;
  /** tytuł = H1 i <title> */
  title: string;
  /** meta description, max ~155 znaków */
  metaDescription: string;
  /** 1–2 zdania na liście poradników */
  excerpt: string;
  /** ISO YYYY-MM-DD */
  updatedAt: string;
  /** slugi pism (src/lib/templates) powiązanych z artykułem */
  relatedTemplates: string[];
  /** markdown; `##` = śródtytuły (renderowane jako h2) */
  body: string;
}
