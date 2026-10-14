export function Logo({ light = false }: { light?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2">
      <svg aria-hidden="true" viewBox="0 0 32 32" className="h-8 w-8 shrink-0">
        <rect width="32" height="32" rx="7" className={light ? "fill-white" : "fill-navy-800"} />
        <path d="M10 7h9l5 5v13H10z" className={light ? "fill-navy-800" : "fill-white"} />
        <path d="M19 7v5h5" className="fill-accent-300" />
        <path
          d="M13 19.5l2.4 2.4 4.6-5.4"
          fill="none"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="stroke-accent-500"
        />
      </svg>
      <span className={`text-lg font-bold tracking-tight ${light ? "text-white" : "text-navy-900"}`}>
        Pismo<span className={light ? "text-accent-300" : "text-accent-600"}>Gotowe</span>
      </span>
    </span>
  );
}
