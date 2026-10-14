"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { LetterDocument, Paragraph } from "@/lib/templates/types";
import { pluralPl } from "../format-pl";

/** Limity z kontraktu PATCH /api/documents/[id] (src/lib/api-types.ts). */
export const EDIT_LIMITS = {
  paragraphs: 60,
  paragraphChars: 3000,
  attachments: 20,
  attachmentChars: 300,
} as const;

type TextBlock = { key: string; type: "p" | "heading"; text: string };
type ListBlock = { key: string; type: "list"; items: { key: string; text: string }[] };
type Block = TextBlock | ListBlock;
type Attachment = { key: string; text: string };

let keySeq = 0;
const newKey = () => `e${++keySeq}`;

function toBlocks(paragraphs: Paragraph[]): Block[] {
  return paragraphs.map((p) =>
    p.type === "list"
      ? { key: newKey(), type: "list", items: p.items.map((text) => ({ key: newKey(), text })) }
      : { key: newKey(), type: p.type, text: p.text },
  );
}

function blockLength(b: Block): number {
  return b.type === "list" ? b.items.reduce((sum, i) => sum + i.text.length, 0) + Math.max(0, b.items.length - 1) : b.text.length;
}

/** Bloki → akapity dla API: puste akapity i punkty list są pomijane. */
function toParagraphs(blocks: Block[]): Paragraph[] {
  const out: Paragraph[] = [];
  for (const b of blocks) {
    if (b.type === "list") {
      const items = b.items.map((i) => i.text.trim()).filter(Boolean);
      if (items.length) out.push({ type: "list", items });
    } else {
      const text = b.text.trim();
      if (text) out.push({ type: b.type, text });
    }
  }
  return out;
}

function AutoTextarea({
  value,
  onChange,
  className = "",
  focusOnMount = false,
  ...rest
}: {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  focusOnMount?: boolean;
  "aria-label": string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
  maxLength?: number;
  disabled?: boolean;
  placeholder?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight + 2}px`;
  }, [value]);

  useEffect(() => {
    if (focusOnMount) ref.current?.focus();
  }, [focusOnMount]);

  return (
    <textarea
      ref={ref}
      rows={1}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`block w-full resize-none overflow-hidden rounded-md border border-transparent bg-navy-50/40 px-2.5 py-1.5 leading-relaxed text-gray-900 transition-colors hover:border-navy-200 focus:border-navy-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-navy-100 disabled:opacity-60 ${className}`}
      {...rest}
    />
  );
}

function Counter({ id, length, max }: { id: string; length: number; max: number }) {
  const over = length > max;
  if (length < max * 0.8 && !over) return null;
  return (
    <p id={id} className={`mt-0.5 text-right font-sans text-xs tabular-nums ${over ? "font-semibold text-red-700" : "text-gray-500"}`}>
      {length} / {max} znaków{over ? " – skróć tekst" : ""}
    </p>
  );
}

const smallBtn =
  "rounded px-2 py-1 font-sans text-xs font-medium text-gray-600 transition-colors hover:bg-gray-100 hover:text-navy-900 disabled:opacity-40";

interface Props {
  document: LetterDocument;
  saving: boolean;
  error: string | null;
  onSave: (paragraphs: Paragraph[], attachments: string[]) => void;
  onCancel: () => void;
}

/**
 * Edycja treści opłaconego pisma: akapity, nagłówki, listy i załączniki.
 * Nagłówek pisma (nadawca, adresat, data, tytuł, podpis) nie jest edytowalny.
 */
export function LetterEditor({ document: doc, saving, error, onSave, onCancel }: Props) {
  const [blocks, setBlocks] = useState<Block[]>(() => toBlocks(doc.paragraphs));
  const [attachments, setAttachments] = useState<Attachment[]>(() =>
    doc.attachments.map((text) => ({ key: newKey(), text })),
  );
  const [focusKey, setFocusKey] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  // Ostrzeżenie przed zamknięciem karty z niezapisanymi zmianami.
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  function updateBlocks(fn: (prev: Block[]) => Block[]) {
    setBlocks(fn);
    setDirty(true);
    setLocalError(null);
  }

  function updateAttachments(fn: (prev: Attachment[]) => Attachment[]) {
    setAttachments(fn);
    setDirty(true);
    setLocalError(null);
  }

  function setText(key: string, text: string) {
    updateBlocks((prev) => prev.map((b) => (b.key === key && b.type !== "list" ? { ...b, text } : b)));
  }

  function setItem(blockKey: string, itemKey: string, text: string) {
    updateBlocks((prev) =>
      prev.map((b) =>
        b.key === blockKey && b.type === "list"
          ? { ...b, items: b.items.map((i) => (i.key === itemKey ? { ...i, text } : i)) }
          : b,
      ),
    );
  }

  function addItem(blockKey: string) {
    const key = newKey();
    updateBlocks((prev) =>
      prev.map((b) => (b.key === blockKey && b.type === "list" ? { ...b, items: [...b.items, { key, text: "" }] } : b)),
    );
    setFocusKey(key);
  }

  function removeItem(blockKey: string, itemKey: string) {
    updateBlocks((prev) =>
      prev.map((b) =>
        b.key === blockKey && b.type === "list" ? { ...b, items: b.items.filter((i) => i.key !== itemKey) } : b,
      ),
    );
  }

  function removeBlock(key: string) {
    updateBlocks((prev) => prev.filter((b) => b.key !== key));
  }

  function addParagraphAfter(index: number) {
    const key = newKey();
    updateBlocks((prev) => [...prev.slice(0, index + 1), { key, type: "p", text: "" }, ...prev.slice(index + 1)]);
    setFocusKey(key);
  }

  function moveBlock(index: number, delta: -1 | 1) {
    updateBlocks((prev) => {
      const target = index + delta;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function addAttachment() {
    const key = newKey();
    updateAttachments((prev) => [...prev, { key, text: "" }]);
    setFocusKey(key);
  }

  const tooManyParagraphs = blocks.length > EDIT_LIMITS.paragraphs;
  const tooLongBlocks = blocks.filter((b) => blockLength(b) > EDIT_LIMITS.paragraphChars).length;
  const tooLongAttachments = attachments.filter((a) => a.text.length > EDIT_LIMITS.attachmentChars).length;
  const limitProblem = tooManyParagraphs || tooLongBlocks > 0 || tooLongAttachments > 0;

  function handleSave() {
    if (saving) return;
    if (limitProblem) {
      setLocalError("Część treści przekracza limity – popraw pola oznaczone na czerwono.");
      return;
    }
    const paragraphs = toParagraphs(blocks);
    if (!paragraphs.length) {
      setLocalError("Pismo musi mieć co najmniej jeden akapit.");
      return;
    }
    if (paragraphs.length > EDIT_LIMITS.paragraphs) {
      setLocalError(`Pismo może mieć najwyżej ${EDIT_LIMITS.paragraphs} akapitów.`);
      return;
    }
    const att = attachments.map((a) => a.text.trim()).filter(Boolean);
    onSave(paragraphs, att);
  }

  function handleCancel() {
    if (dirty && !window.confirm("Odrzucić wprowadzone zmiany?")) return;
    onCancel();
  }

  const shownError = localError ?? error;

  return (
    <div className="mx-auto w-full max-w-[210mm]">
      <div className="mb-3 rounded-lg border border-navy-200 bg-white p-3 font-sans text-sm text-navy-900">
        <p className="font-semibold">Tryb edycji treści</p>
        <p className="mt-0.5 text-gray-600">
          Możesz poprawić akapity, listy i załączniki. Dane nadawcy i adresata, data, tytuł oraz podpis pochodzą z
          formularza i nie podlegają edycji. Pamiętaj: zmieniając treść, odpowiadasz za jej poprawność.
        </p>
      </div>

      <article
        aria-label={`Edycja pisma: ${doc.title}`}
        className="relative w-full rounded-sm bg-white px-4 py-8 font-serif text-[15px] leading-relaxed text-gray-900 shadow-[0_1px_3px_rgba(15,27,46,0.08),0_12px_32px_-8px_rgba(15,27,46,0.18)] ring-1 ring-gray-200 sm:px-10 sm:py-12"
        lang="pl"
      >
        <div aria-hidden="true" className="select-none rounded-md bg-gray-50 px-3 py-2 text-sm text-gray-500">
          <p>
            {doc.sender.name} · {doc.place}, {doc.date}
          </p>
          <p>Do: {doc.recipient.name}</p>
          <p className="mt-1 font-bold text-gray-600">{doc.title}</p>
        </div>

        {doc.salutation ? <p className="mt-5 px-2.5 text-gray-500">{doc.salutation}</p> : null}

        <div className="mt-4 space-y-1">
          {blocks.map((b, index) => {
            const len = blockLength(b);
            const counterId = `licznik-${b.key}`;
            const over = len > EDIT_LIMITS.paragraphChars;
            const typeLabel = b.type === "heading" ? "Nagłówek" : b.type === "list" ? "Lista" : "Akapit";
            return (
              <div key={b.key} className="group rounded-lg py-1">
                <div className="flex items-center justify-between gap-2 px-1">
                  <span className="font-sans text-[11px] font-semibold uppercase tracking-wider text-navy-400">
                    {typeLabel} {index + 1}
                  </span>
                  <span className="flex items-center gap-0.5">
                    <button
                      type="button"
                      className={smallBtn}
                      onClick={() => moveBlock(index, -1)}
                      disabled={saving || index === 0}
                      aria-label={`Przesuń ${typeLabel.toLowerCase()} ${index + 1} wyżej`}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      className={smallBtn}
                      onClick={() => moveBlock(index, 1)}
                      disabled={saving || index === blocks.length - 1}
                      aria-label={`Przesuń ${typeLabel.toLowerCase()} ${index + 1} niżej`}
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      className={`${smallBtn} hover:text-red-700`}
                      onClick={() => removeBlock(b.key)}
                      disabled={saving}
                      aria-label={`Usuń ${typeLabel.toLowerCase()} ${index + 1}`}
                    >
                      Usuń
                    </button>
                  </span>
                </div>

                {b.type === "list" ? (
                  <ol className="mt-1 list-decimal space-y-1 pl-8">
                    {b.items.map((item, i) => (
                      <li key={item.key} className="pl-1">
                        <div className="flex items-start gap-1">
                          <AutoTextarea
                            value={item.text}
                            onChange={(v) => setItem(b.key, item.key, v)}
                            focusOnMount={focusKey === item.key}
                            disabled={saving}
                            aria-label={`Lista ${index + 1}, punkt ${i + 1}`}
                            aria-describedby={over ? counterId : undefined}
                            aria-invalid={over || undefined}
                          />
                          <button
                            type="button"
                            className={`${smallBtn} mt-1 hover:text-red-700`}
                            onClick={() => removeItem(b.key, item.key)}
                            disabled={saving}
                            aria-label={`Usuń punkt ${i + 1}`}
                          >
                            ✕
                          </button>
                        </div>
                      </li>
                    ))}
                    <li className="list-none">
                      <button
                        type="button"
                        className={`${smallBtn} text-navy-700`}
                        onClick={() => addItem(b.key)}
                        disabled={saving}
                      >
                        + Dodaj punkt
                      </button>
                    </li>
                  </ol>
                ) : (
                  <AutoTextarea
                    value={b.text}
                    onChange={(v) => setText(b.key, v)}
                    focusOnMount={focusKey === b.key}
                    disabled={saving}
                    placeholder={b.type === "p" ? "Treść akapitu…" : "Nagłówek…"}
                    className={b.type === "heading" ? "font-bold" : "text-justify"}
                    aria-label={`${typeLabel} ${index + 1}`}
                    aria-describedby={over ? counterId : undefined}
                    aria-invalid={over || undefined}
                  />
                )}
                <Counter id={counterId} length={len} max={EDIT_LIMITS.paragraphChars} />

                <div className="flex justify-center opacity-70 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
                  <button
                    type="button"
                    className={`${smallBtn} text-navy-700`}
                    onClick={() => addParagraphAfter(index)}
                    disabled={saving || blocks.length >= EDIT_LIMITS.paragraphs}
                  >
                    + Dodaj akapit
                  </button>
                </div>
              </div>
            );
          })}
          {blocks.length === 0 ? (
            <div className="py-4 text-center">
              <button type="button" className={`${smallBtn} text-navy-700`} onClick={() => addParagraphAfter(-1)}>
                + Dodaj akapit
              </button>
            </div>
          ) : null}
        </div>

        <p className={`mt-2 text-right font-sans text-xs ${tooManyParagraphs ? "font-semibold text-red-700" : "text-gray-500"}`}>
          {blocks.length} / {EDIT_LIMITS.paragraphs} {pluralPl(EDIT_LIMITS.paragraphs, "akapit", "akapity", "akapitów")}
        </p>

        <p className="mt-6 px-2.5 text-gray-500">{doc.closing}</p>
        <p className="mt-2 px-2.5 text-right text-sm text-gray-500">{doc.signatureName}</p>

        <div className="mt-8 border-t border-gray-200 pt-5 text-sm">
          <p className="font-bold">Załączniki</p>
          {attachments.length ? (
            <ol className="mt-2 list-decimal space-y-1 pl-6">
              {attachments.map((a, i) => {
                const over = a.text.length > EDIT_LIMITS.attachmentChars;
                return (
                  <li key={a.key} className="pl-1">
                    <div className="flex items-start gap-1">
                      <AutoTextarea
                        value={a.text}
                        onChange={(v) =>
                          updateAttachments((prev) => prev.map((x) => (x.key === a.key ? { ...x, text: v } : x)))
                        }
                        focusOnMount={focusKey === a.key}
                        disabled={saving}
                        placeholder="Np. kopia paragonu"
                        aria-label={`Załącznik ${i + 1}`}
                        aria-invalid={over || undefined}
                        aria-describedby={over ? `licznik-${a.key}` : undefined}
                      />
                      <button
                        type="button"
                        className={`${smallBtn} mt-1 hover:text-red-700`}
                        onClick={() => updateAttachments((prev) => prev.filter((x) => x.key !== a.key))}
                        disabled={saving}
                        aria-label={`Usuń załącznik ${i + 1}`}
                      >
                        ✕
                      </button>
                    </div>
                    <Counter id={`licznik-${a.key}`} length={a.text.length} max={EDIT_LIMITS.attachmentChars} />
                  </li>
                );
              })}
            </ol>
          ) : (
            <p className="mt-1 font-sans text-xs text-gray-500">Brak załączników.</p>
          )}
          <button
            type="button"
            className={`${smallBtn} mt-1 text-navy-700`}
            onClick={addAttachment}
            disabled={saving || attachments.length >= EDIT_LIMITS.attachments}
          >
            + Dodaj załącznik
          </button>
          <span className="ml-2 font-sans text-xs text-gray-500">
            {attachments.length} / {EDIT_LIMITS.attachments}
          </span>
        </div>
      </article>

      <div className="sticky bottom-0 z-10 mt-4 rounded-xl border border-navy-100 bg-white/95 p-3 font-sans shadow-lg backdrop-blur sm:p-4">
        {shownError ? (
          <p role="alert" className="mb-3 text-sm font-medium text-red-700">
            {shownError}
          </p>
        ) : null}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
          <button
            type="button"
            onClick={handleCancel}
            disabled={saving}
            className="rounded-lg border border-gray-300 bg-white px-5 py-2.5 font-medium text-navy-900 hover:bg-gray-50 disabled:opacity-50"
          >
            Anuluj
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !dirty}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-accent-400 px-5 py-2.5 font-semibold text-navy-950 shadow-sm hover:bg-accent-300 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? (
              <>
                <span aria-hidden="true" className="h-4 w-4 animate-spin rounded-full border-2 border-navy-900/30 border-t-navy-900" />
                Zapisujemy…
              </>
            ) : (
              "Zapisz zmiany"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
