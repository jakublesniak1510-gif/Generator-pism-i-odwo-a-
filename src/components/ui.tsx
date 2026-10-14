import type { ReactNode } from "react";

export function Container({
  children,
  className = "",
  narrow = false,
}: {
  children: ReactNode;
  className?: string;
  narrow?: boolean;
}) {
  return (
    <div className={`mx-auto w-full ${narrow ? "max-w-3xl" : "max-w-6xl"} px-4 sm:px-6 ${className}`}>{children}</div>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  lead,
  id,
  center = false,
}: {
  eyebrow?: string;
  title: string;
  lead?: ReactNode;
  id?: string;
  center?: boolean;
}) {
  return (
    <div className={center ? "mx-auto max-w-2xl text-center" : "max-w-2xl"}>
      {eyebrow ? (
        <p className="text-sm font-semibold uppercase tracking-wider text-accent-600">{eyebrow}</p>
      ) : null}
      <h2 id={id} className="mt-1 text-2xl font-bold tracking-tight text-navy-900 sm:text-3xl">
        {title}
      </h2>
      {lead ? <p className="mt-3 text-gray-600 leading-relaxed">{lead}</p> : null}
    </div>
  );
}

/** Prosta strona treściowa (regulamin, polityka, kontakt…). */
export function ContentPage({
  title,
  lead,
  children,
}: {
  title: string;
  lead?: ReactNode;
  children: ReactNode;
}) {
  return (
    <>
      <div className="border-b border-navy-100 bg-navy-50/60">
        <Container className="py-10 sm:py-14">
          <h1 className="text-3xl font-bold tracking-tight text-navy-900 sm:text-4xl">{title}</h1>
          {lead ? <p className="mt-3 max-w-2xl text-lg leading-relaxed text-gray-600">{lead}</p> : null}
        </Container>
      </div>
      <Container className="py-10 sm:py-14">{children}</Container>
    </>
  );
}

export function CheckIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" fill="currentColor" className={className}>
      <path
        fillRule="evenodd"
        d="M16.7 5.3a1 1 0 010 1.4l-7.5 7.5a1 1 0 01-1.4 0L3.3 9.7a1 1 0 111.4-1.4l3.8 3.8 6.8-6.8a1 1 0 011.4 0z"
        clipRule="evenodd"
      />
    </svg>
  );
}
