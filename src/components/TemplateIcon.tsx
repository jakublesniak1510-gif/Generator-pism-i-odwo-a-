import type { TemplateCategory } from "@/lib/templates/types";

/**
 * Ikona kafelka: `template.icon` to emoji albo nazwa ikony. Znane nazwy renderujemy jako SVG,
 * emoji – wprost; w pozostałych przypadkach ikona kategorii.
 */
const PATHS: Record<string, string> = {
  document: "M7 3h7l5 5v13H7zM14 3v5h5M10 13h6M10 17h6",
  box: "M3 7l9-4 9 4-9 4-9-4zM3 7v10l9 4 9-4V7M12 11v10",
  package: "M3 7l9-4 9 4-9 4-9-4zM3 7v10l9 4 9-4V7M12 11v10",
  return: "M9 14L4 9l5-5M4 9h11a5 5 0 010 10h-3",
  undo: "M9 14L4 9l5-5M4 9h11a5 5 0 010 10h-3",
  car: "M5 16l1.5-5h11L19 16M4 16h16v3H4zM7 19v2M17 19v2M7.5 13.5h.01M16.5 13.5h.01",
  parking: "M5 3h14v18H5zM10 17V8h3a2.5 2.5 0 010 5h-3",
  ticket: "M3 8a2 2 0 002-2h14a2 2 0 002 2v2a2 2 0 000 4v2a2 2 0 00-2 2H5a2 2 0 00-2-2v-2a2 2 0 000-4zM13 6v12",
  bus: "M5 4h14v12H5zM5 11h14M7 16v3M17 16v3M8 13.5h.01M16 13.5h.01",
  train: "M6 3h12v13H6zM6 10h12M8 16l-2 4M16 16l2 4M9 13h.01M15 13h.01",
  plane: "M2 13l8-2 4-8 2 1-2 7 6 2 1 2-7-1-3 5-2-1 1-5-7-1z",
  scissors: "M6 6m-3 0a3 3 0 106 0 3 3 0 10-6 0M6 18m-3 0a3 3 0 106 0 3 3 0 10-6 0M8.1 8.1L20 20M8.1 15.9L20 4",
  contract: "M7 3h10v18H7zM10 8h4M10 12h4M10 16h2",
  money: "M3 7h18v10H3zM12 12m-2.5 0a2.5 2.5 0 105 0 2.5 2.5 0 10-5 0M6 10v4M18 10v4",
  wallet: "M3 7h18v12H3zM3 7l3-3h12v3M16 13h2",
  home: "M3 11l9-7 9 7M5 10v10h14V10M10 20v-6h4v6",
  building: "M5 21V4h14v17M9 8h2M13 8h2M9 12h2M13 12h2M9 16h2M13 16h2M3 21h18",
  cart: "M3 4h2l2.4 11h10.2L20 8H6.2M9 20h.01M17 20h.01",
  shield: "M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z",
  briefcase: "M3 8h18v12H3zM9 8V5h6v3M3 13h18",
  bank: "M3 10l9-6 9 6M5 10v8M9 10v8M15 10v8M19 10v8M3 18h18M3 21h18",
  gavel: "M14 4l6 6-2 2-6-6zM8 10l6 6-5 5-6-6zM3 21h8",
};

const CATEGORY_ICON: Record<TemplateCategory, string> = {
  konsument: "cart",
  transport: "car",
  umowy: "contract",
  finanse: "money",
  mieszkanie: "home",
  praca: "briefcase",
  "dane-osobowe": "shield",
};

export function TemplateIcon({
  icon,
  category,
  className = "h-6 w-6",
}: {
  icon: string;
  category: TemplateCategory;
  className?: string;
}) {
  const key = icon?.trim().toLowerCase();
  const isNamed = key && PATHS[key];
  const isEmoji = key && !isNamed && !/^[a-z0-9_-]+$/i.test(key) && key !== "📄";
  if (isEmoji) {
    return (
      <span aria-hidden="true" className="text-2xl leading-none">
        {icon}
      </span>
    );
  }
  const d = PATHS[isNamed ? key : CATEGORY_ICON[category]] ?? PATHS.document;
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d={d} />
    </svg>
  );
}
