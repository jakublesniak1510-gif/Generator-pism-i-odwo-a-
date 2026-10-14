import { describe, expect, it } from "vitest";
import { addPeriod, computeDeadlines } from "./deadlines";
import { makeTestTemplate } from "./test-template";

const iso = (d: Date) => d.toISOString().slice(0, 10);
const utc = (s: string) => new Date(`${s}T00:00:00Z`);

describe("addPeriod", () => {
  it("dodaje dni", () => {
    expect(iso(addPeriod(utc("2026-01-25"), { days: 14 }))).toBe("2026-02-08");
  });
  it("koniec miesiąca: 31.01 + 1 miesiąc = ostatni dzień lutego", () => {
    expect(iso(addPeriod(utc("2026-01-31"), { months: 1 }))).toBe("2026-02-28");
    expect(iso(addPeriod(utc("2024-01-31"), { months: 1 }))).toBe("2024-02-29");
  });
  it("lata: 29.02 + 1 rok = 28.02", () => {
    expect(iso(addPeriod(utc("2024-02-29"), { years: 1 }))).toBe("2025-02-28");
  });
  it("przechodzi przez koniec roku", () => {
    expect(iso(addPeriod(utc("2026-11-15"), { months: 3 }))).toBe("2027-02-15");
  });
});

describe("computeDeadlines", () => {
  const template = makeTestTemplate();
  const today = new Date(2026, 9, 14); // 14.10.2026 (czas lokalny)

  it("liczy datę i dni do terminu", () => {
    const [twoYears, fourteenDays] = computeDeadlines(template, { purchase_date: "2026-10-01" }, today);
    expect(twoYears.date).toBe("2028-10-01");
    expect(fourteenDays.date).toBe("2026-10-15");
    expect(fourteenDays.daysLeft).toBe(1);
  });

  it("termin miniony ma ujemne daysLeft", () => {
    const [, fourteenDays] = computeDeadlines(template, { purchase_date: "2026-09-01" }, today);
    expect(fourteenDays.daysLeft).toBeLessThan(0);
  });

  it("bez daty bazowej zwraca null", () => {
    const res = computeDeadlines(template, { purchase_date: "nie-data" }, today);
    expect(res.every((d) => d.date === null && d.daysLeft === null)).toBe(true);
    expect(res[0].label).toBe("Termin");
  });
});
