"use client";

import type { Question } from "@/lib/templates/types";
import { isRequired, maxLengthOf } from "./wizard-logic";

const AUTOCOMPLETE: Record<string, string> = {
  sender_name: "name",
  sender_street: "street-address",
  sender_postal: "postal-code",
  sender_city: "address-level2",
  sender_email: "email",
  sender_phone: "tel",
};

const inputBase =
  "block w-full rounded-lg border bg-white px-3.5 py-2.5 text-base text-gray-900 shadow-sm transition-colors placeholder:text-gray-400 focus:outline-none focus:ring-4 disabled:bg-gray-50";

function inputClass(hasError: boolean) {
  return `${inputBase} ${
    hasError
      ? "border-red-500 focus:border-red-600 focus:ring-red-100"
      : "border-gray-300 hover:border-navy-300 focus:border-navy-600 focus:ring-navy-100"
  }`;
}

export function fieldDomId(questionId: string): string {
  return `pole-${questionId}`;
}

interface Props {
  question: Question;
  value: string | boolean | undefined;
  error?: string;
  disabled?: boolean;
  /** pole wypełnione automatycznie z dokumentu – podświetlone do czasu edycji */
  prefilled?: boolean;
  onChange: (value: string | boolean) => void;
}

export function QuestionField({ question: q, value, error, disabled, prefilled = false, onChange }: Props) {
  const id = fieldDomId(q.id);
  const helpId = q.help ? `${id}-pomoc` : undefined;
  const errorId = error ? `${id}-blad` : undefined;
  const counterId = q.type === "textarea" ? `${id}-licznik` : undefined;
  const describedBy = [helpId, counterId, errorId].filter(Boolean).join(" ") || undefined;
  const required = isRequired(q);
  const strValue = typeof value === "string" ? value : "";

  const labelContent = (
    <>
      {q.label}
      {required ? (
        <span className="ml-0.5 text-red-600" aria-hidden="true">
          *
        </span>
      ) : q.type === "checkbox" ? null : (
        <span className="ml-1.5 text-sm font-normal text-gray-500">(opcjonalnie)</span>
      )}
      {prefilled ? (
        <span className="ml-2 inline-block rounded bg-accent-100 px-1.5 py-0.5 align-middle text-xs font-semibold text-accent-800">
          z dokumentu
        </span>
      ) : null}
    </>
  );

  const wrap = (node: React.ReactNode) =>
    prefilled ? (
      <div className="-mx-3 rounded-lg bg-accent-50/80 px-3 py-3 ring-1 ring-accent-200">{node}</div>
    ) : (
      node
    );

  const help = q.help ? (
    <p id={helpId} className="mt-1.5 text-sm leading-relaxed text-gray-500">
      {q.help}
    </p>
  ) : null;

  const errorMsg = error ? (
    <p id={errorId} className="mt-1.5 flex items-start gap-1.5 text-sm font-medium text-red-700">
      <svg aria-hidden="true" viewBox="0 0 20 20" fill="currentColor" className="mt-0.5 h-4 w-4 shrink-0">
        <path
          fillRule="evenodd"
          d="M10 18a8 8 0 100-16 8 8 0 000 16zm-.75-11.25a.75.75 0 011.5 0v4.5a.75.75 0 01-1.5 0v-4.5zM10 14.5a1 1 0 100-2 1 1 0 000 2z"
          clipRule="evenodd"
        />
      </svg>
      {error}
    </p>
  ) : null;

  const common = {
    id,
    name: q.id,
    disabled,
    "aria-invalid": error ? true : undefined,
    "aria-describedby": describedBy,
    "aria-required": required || undefined,
  } as const;

  /* ---------- radio: karty ---------- */
  if (q.type === "radio") {
    return wrap(
      <fieldset aria-describedby={describedBy} aria-invalid={error ? true : undefined}>
        <legend id={id} tabIndex={-1} className="text-sm font-semibold text-navy-900 focus:outline-none">
          {labelContent}
        </legend>
        {help}
        <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
          {(q.options ?? []).map((opt) => {
            const optId = `${id}-${opt.value}`;
            const checked = strValue === opt.value;
            return (
              <label
                key={opt.value}
                htmlFor={optId}
                className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3.5 text-sm transition-colors ${
                  checked
                    ? "border-navy-700 bg-navy-50 ring-1 ring-navy-700"
                    : error
                      ? "border-red-300 bg-white hover:border-red-400"
                      : "border-gray-300 bg-white hover:border-navy-300 hover:bg-navy-50/40"
                } ${disabled ? "cursor-not-allowed opacity-60" : ""}`}
              >
                <input
                  type="radio"
                  id={optId}
                  name={q.id}
                  value={opt.value}
                  checked={checked}
                  disabled={disabled}
                  onChange={() => onChange(opt.value)}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-navy-800"
                />
                <span className={checked ? "font-medium text-navy-950" : "text-gray-800"}>{opt.label}</span>
              </label>
            );
          })}
        </div>
        {errorMsg}
      </fieldset>
    );
  }

  /* ---------- checkbox ---------- */
  if (q.type === "checkbox") {
    return wrap(
      <div>
        <label
          htmlFor={id}
          className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3.5 text-sm transition-colors ${
            value === true ? "border-navy-700 bg-navy-50" : error ? "border-red-300" : "border-gray-300 hover:border-navy-300"
          }`}
        >
          <input
            type="checkbox"
            {...common}
            checked={value === true}
            onChange={(e) => onChange(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 accent-navy-800"
          />
          <span className="font-medium text-navy-900">{labelContent}</span>
        </label>
        {help}
        {errorMsg}
      </div>
    );
  }

  /* ---------- pozostałe ---------- */
  let control: React.ReactNode;
  switch (q.type) {
    case "textarea": {
      const max = maxLengthOf(q);
      const len = strValue.length;
      control = (
        <>
          <textarea
            {...common}
            rows={6}
            value={strValue}
            placeholder={q.placeholder}
            onChange={(e) => onChange(e.target.value)}
            className={`${inputClass(!!error)} min-h-36 resize-y leading-relaxed`}
          />
          <p
            id={counterId}
            className={`mt-1 text-right text-xs tabular-nums ${max && len > max ? "font-semibold text-red-700" : "text-gray-500"}`}
          >
            {max ? `${len} / ${max} znaków` : `${len} znaków`}
          </p>
        </>
      );
      break;
    }
    case "select":
      control = (
        <div className="relative">
          <select
            {...common}
            value={strValue}
            onChange={(e) => onChange(e.target.value)}
            className={`${inputClass(!!error)} appearance-none pr-10`}
          >
            <option value="">{q.placeholder || "Wybierz…"}</option>
            {(q.options ?? []).map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <svg
            aria-hidden="true"
            viewBox="0 0 20 20"
            fill="currentColor"
            className="pointer-events-none absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-navy-400"
          >
            <path d="M5.3 7.3a1 1 0 011.4 0L10 10.6l3.3-3.3a1 1 0 111.4 1.4l-4 4a1 1 0 01-1.4 0l-4-4a1 1 0 010-1.4z" />
          </svg>
        </div>
      );
      break;
    case "money":
      control = (
        <div className="relative max-w-xs">
          <input
            {...common}
            type="text"
            inputMode="decimal"
            autoComplete="off"
            value={strValue}
            placeholder={q.placeholder || "0,00"}
            onChange={(e) => onChange(e.target.value)}
            className={`${inputClass(!!error)} pr-12 tabular-nums`}
          />
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3.5 text-sm font-medium text-gray-500"
          >
            zł
          </span>
        </div>
      );
      break;
    case "number":
      control = (
        <input
          {...common}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          value={strValue}
          placeholder={q.placeholder}
          onChange={(e) => onChange(e.target.value)}
          className={`${inputClass(!!error)} max-w-xs tabular-nums`}
        />
      );
      break;
    case "date":
      control = (
        <input
          {...common}
          type="date"
          value={strValue}
          onChange={(e) => onChange(e.target.value)}
          className={`${inputClass(!!error)} max-w-xs`}
        />
      );
      break;
    case "email":
      control = (
        <input
          {...common}
          type="email"
          inputMode="email"
          autoComplete="email"
          value={strValue}
          placeholder={q.placeholder}
          onChange={(e) => onChange(e.target.value)}
          className={inputClass(!!error)}
        />
      );
      break;
    case "phone":
      control = (
        <input
          {...common}
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          value={strValue}
          placeholder={q.placeholder}
          onChange={(e) => onChange(e.target.value)}
          className={`${inputClass(!!error)} max-w-xs`}
        />
      );
      break;
    default:
      control = (
        <input
          {...common}
          type="text"
          autoComplete={AUTOCOMPLETE[q.id] ?? "off"}
          maxLength={maxLengthOf(q)}
          value={strValue}
          placeholder={q.placeholder}
          onChange={(e) => onChange(e.target.value)}
          className={inputClass(!!error)}
        />
      );
  }

  return wrap(
    <div>
      <label htmlFor={id} className="block text-sm font-semibold text-navy-900">
        {labelContent}
      </label>
      {help}
      <div className="mt-2">{control}</div>
      {errorMsg}
    </div>
  );
}
