import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

/**
 * Markdown z treści szablonów (poradniki, instrukcje). Surowy HTML jest ignorowany
 * (domyślne zachowanie react-markdown). Nagłówki z treści są „obniżane” do h3/h4,
 * bo h2 nadaje strona (np. tytuł sekcji poradnika).
 */
const components: Components = {
  h1: ({ children }) => <h3 className="mt-6 mb-2 text-lg font-semibold text-navy-900">{children}</h3>,
  h2: ({ children }) => <h3 className="mt-6 mb-2 text-lg font-semibold text-navy-900">{children}</h3>,
  h3: ({ children }) => <h3 className="mt-5 mb-2 text-base font-semibold text-navy-900">{children}</h3>,
  h4: ({ children }) => <h4 className="mt-4 mb-1 font-semibold text-navy-900">{children}</h4>,
  p: ({ children }) => <p className="my-3 leading-relaxed">{children}</p>,
  ul: ({ children }) => <ul className="my-3 list-disc space-y-1.5 pl-6 marker:text-navy-400">{children}</ul>,
  ol: ({ children }) => <ol className="my-3 list-decimal space-y-1.5 pl-6 marker:text-navy-500">{children}</ol>,
  li: ({ children }) => <li className="leading-relaxed pl-1">{children}</li>,
  strong: ({ children }) => <strong className="font-semibold text-navy-950">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
  blockquote: ({ children }) => (
    <blockquote className="my-4 border-l-4 border-accent-300 bg-accent-50 px-4 py-2 text-navy-900">
      {children}
    </blockquote>
  ),
  a: ({ href, children }) => {
    const external = typeof href === "string" && /^https?:\/\//.test(href);
    return (
      <a
        href={href}
        className="font-medium text-navy-700 underline decoration-navy-300 underline-offset-2 hover:text-navy-900 hover:decoration-navy-700"
        {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      >
        {children}
      </a>
    );
  },
  code: ({ children }) => <code className="rounded bg-navy-50 px-1 py-0.5 text-[0.9em]">{children}</code>,
  hr: () => <hr className="my-6 border-navy-100" />,
  table: ({ children }) => (
    <div className="my-4 overflow-x-auto">
      <table className="w-full border-collapse text-sm">{children}</table>
    </div>
  ),
  th: ({ children }) => (
    <th className="border border-navy-100 bg-navy-50 px-3 py-2 text-left font-semibold">{children}</th>
  ),
  td: ({ children }) => <td className="border border-navy-100 px-3 py-2 align-top">{children}</td>,
};

const documentComponents: Components = {
  ...components,
  h2: ({ children }) => (
    <h2 className="mt-10 mb-3 border-b border-navy-100 pb-2 text-xl font-bold text-navy-900">{children}</h2>
  ),
};

/**
 * `className` zastępuje domyślny rozmiar i kolor tekstu.
 * `document` – samodzielny dokument (regulamin, polityka): `##` renderowane jako h2.
 */
export function Markdown({
  children,
  className,
  document = false,
}: {
  children: string;
  className?: string;
  document?: boolean;
}) {
  if (!children?.trim()) return null;
  return (
    <div className={`${className ?? "text-[0.975rem] text-gray-700"} [&>*:first-child]:mt-0 [&>*:last-child]:mb-0`}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={document ? documentComponents : components}>{children}</ReactMarkdown>
    </div>
  );
}
