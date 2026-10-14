import type { ReactNode } from "react";
import type { LetterDocument, Paragraph, Party } from "@/lib/templates/types";

function PartyBlock({ party, strongName = false }: { party: Party; strongName?: boolean }) {
  return (
    <address className="not-italic leading-snug">
      <span className={strongName ? "font-bold" : undefined}>{party.name}</span>
      {party.addressLines.map((l, i) => (
        <span key={i} className="block">
          {l}
        </span>
      ))}
      {party.extra?.filter(Boolean).map((l, i) => (
        <span key={`x${i}`} className="block text-[0.95em] text-gray-700">
          {l}
        </span>
      ))}
    </address>
  );
}

function ParagraphView({ paragraph }: { paragraph: Paragraph }) {
  switch (paragraph.type) {
    case "heading":
      return <h3 className="mt-6 mb-2 font-bold">{paragraph.text}</h3>;
    case "list":
      return (
        <ol className="my-3 list-decimal space-y-1 pl-6">
          {paragraph.items.map((item, i) => (
            <li key={i} className="pl-1">
              {item}
            </li>
          ))}
        </ol>
      );
    default:
      return <p className="my-3 whitespace-pre-line text-justify indent-8 hyphens-auto">{paragraph.text}</p>;
  }
}

const FAKE_LINES = [100, 96, 99, 88, 100, 93, 97, 64, 100, 91, 98, 72];

interface Props {
  document: LetterDocument;
  /** true = podgląd: po widocznych akapitach rozmyte linijki i nakładka `lockedOverlay` */
  locked?: boolean;
  lockedOverlay?: ReactNode;
}

/** Pismo na białej „kartce” A4 – ten sam układ co DOCX/PDF. */
export function LetterView({ document: doc, locked = false, lockedOverlay }: Props) {
  return (
    <article
      aria-label={`Treść pisma: ${doc.title}`}
      className="relative mx-auto w-full max-w-[210mm] rounded-sm bg-white px-6 py-8 font-serif text-[15px] leading-relaxed text-gray-900 shadow-[0_1px_3px_rgba(15,27,46,0.08),0_12px_32px_-8px_rgba(15,27,46,0.18)] ring-1 ring-gray-200 sm:px-12 sm:py-14 md:px-16"
      lang="pl"
    >
      <div className="flex flex-col-reverse gap-6 sm:flex-row sm:justify-between">
        <PartyBlock party={doc.sender} />
        <p className="shrink-0 sm:text-right">
          {doc.place}, {doc.date}
        </p>
      </div>

      <div className="mt-8 sm:ml-[50%]">
        <PartyBlock party={doc.recipient} strongName />
      </div>

      <h2 className="mt-10 text-center text-lg font-bold tracking-wide">{doc.title}</h2>
      {doc.subject ? <p className="mt-2 text-center">{doc.subject}</p> : null}

      {doc.salutation ? <p className="mt-6">{doc.salutation}</p> : null}

      <div className="mt-4">
        {doc.paragraphs.map((p, i) => (
          <ParagraphView key={i} paragraph={p} />
        ))}
      </div>

      {locked ? (
        <div className="relative mt-2 min-h-[27rem]">
          <div aria-hidden="true" className="select-none space-y-2.5 py-2 blur-[3px]">
            {FAKE_LINES.map((w, i) => (
              <div
                key={i}
                className={`h-3 rounded bg-gray-300/80 ${i === 7 ? "mb-6" : ""}`}
                style={{ width: `${w}%` }}
              />
            ))}
          </div>
          <div className="absolute inset-0 bg-gradient-to-b from-white/10 via-white/60 to-white" aria-hidden="true" />
          {lockedOverlay ? (
            <div className="absolute inset-0 flex items-center justify-center p-2">{lockedOverlay}</div>
          ) : null}
        </div>
      ) : (
        <>
          <p className="mt-8">{doc.closing}</p>
          <div className="mt-10 ml-auto w-56 max-w-full text-center">
            <div className="border-t border-dotted border-gray-500" />
            <p className="mt-1 text-sm">{doc.signatureName}</p>
          </div>
          {doc.attachments.length ? (
            <div className="mt-10 text-sm">
              <p className="font-bold">Załączniki:</p>
              <ol className="mt-1 list-decimal pl-6">
                {doc.attachments.map((a, i) => (
                  <li key={i}>{a}</li>
                ))}
              </ol>
            </div>
          ) : null}
        </>
      )}
    </article>
  );
}
