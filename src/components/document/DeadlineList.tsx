import type { ComputedDeadline } from "@/lib/api-types";
import { daysLeftLabel, formatIsoDatePl } from "../format-pl";

export function DeadlineList({ deadlines }: { deadlines: ComputedDeadline[] }) {
  if (!deadlines.length) return null;
  return (
    <ul className="space-y-3">
      {deadlines.map((d) => {
        const passed = d.daysLeft !== null && d.daysLeft < 0;
        const soon = d.daysLeft !== null && d.daysLeft >= 0 && d.daysLeft <= 7;
        return (
          <li
            key={d.id}
            className={`rounded-lg border p-4 ${passed ? "border-red-200 bg-red-50" : soon ? "border-accent-200 bg-accent-50" : "border-navy-100 bg-white"}`}
          >
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <p className="font-semibold text-navy-900">{d.label}</p>
              {d.date ? (
                <p className="text-sm">
                  <span className="font-medium text-navy-900">{formatIsoDatePl(d.date)}</span>
                  {d.daysLeft !== null ? (
                    <span
                      className={`ml-2 rounded-full px-2 py-0.5 text-xs font-semibold ${
                        passed ? "bg-red-600 text-white" : soon ? "bg-accent-400 text-navy-950" : "bg-navy-100 text-navy-800"
                      }`}
                    >
                      {daysLeftLabel(d.daysLeft)}
                    </span>
                  ) : null}
                </p>
              ) : (
                <p className="text-sm text-gray-500">brak daty – nie podano daty początkowej</p>
              )}
            </div>
            <p className={`mt-1.5 text-sm leading-relaxed ${passed ? "text-red-800" : "text-gray-600"}`}>{d.description}</p>
          </li>
        );
      })}
    </ul>
  );
}
