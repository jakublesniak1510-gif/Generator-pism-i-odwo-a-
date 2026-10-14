import { describe, expect, it } from "vitest";
import { generateSampleAnswers } from "./sample-answers";
import { makeTestTemplate } from "./test-template";
import { isValidIsoDate, parseNumber, validateAnswers } from "./validate";

const template = makeTestTemplate();

const valid = {
  name: "Jan Kowalski",
  postal: "00-001",
  purchase_date: "2026-03-15",
  price: "1 234,50",
  count: "3",
  kind: "goods",
  goods_name: "Pralka",
  has_receipt: "on",
  receipt_no: "R/1",
  statement: true,
};

describe("validateAnswers", () => {
  it("akceptuje poprawne odpowiedzi i normalizuje typy", () => {
    const res = validateAnswers(template, valid);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.answers.price).toBe(1234.5);
    expect(res.answers.count).toBe(3);
    expect(res.answers.has_receipt).toBe(true);
    expect(res.answers.statement).toBe(true);
    expect(res.answers.goods_name).toBe("Pralka");
  });

  it("odrzuca nieobiekt", () => {
    expect(validateAnswers(template, null).ok).toBe(false);
    expect(validateAnswers(template, [1, 2]).ok).toBe(false);
  });

  it("zgłasza brak wymaganych pól i nieznane klucze", () => {
    const res = validateAnswers(template, { hacker: "x" });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.fieldErrors.hacker).toMatch(/Nieznane/);
    expect(res.fieldErrors.name).toMatch(/wymagane/);
    expect(res.fieldErrors.statement).toMatch(/Zaznacz/);
    expect(res.fieldErrors.note).toBeUndefined(); // required: false
  });

  it("sprawdza datę, kwotę, zakres, opcję i wzorzec", () => {
    const res = validateAnswers(template, {
      ...valid,
      purchase_date: "2026-02-30",
      price: "-5",
      count: 11,
      kind: "inne",
      postal: "00001",
      note: "x".repeat(21),
      email: "nie-email",
      phone: "abc",
    });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(Object.keys(res.fieldErrors).sort()).toEqual(
      ["count", "email", "kind", "note", "phone", "postal", "price", "purchase_date"].sort(),
    );
  });

  it("pomija pytania ukryte przez showIf (także rekurencyjnie)", () => {
    const res = validateAnswers(template, { ...valid, kind: "service", goods_name: "", has_receipt: false, receipt_no: "" });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.answers).not.toHaveProperty("goods_name");
    expect(res.answers).not.toHaveProperty("receipt_no");
  });

  it("wymaga pola widocznego przez showIf", () => {
    const res = validateAnswers(template, { ...valid, goods_name: "" });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.fieldErrors.goods_name).toBeDefined();
  });

  it("akceptuje odpowiedzi z generatora przykładów", () => {
    expect(validateAnswers(template, generateSampleAnswers(template)).ok).toBe(true);
  });
});

describe("pomocnicze", () => {
  it("isValidIsoDate", () => {
    expect(isValidIsoDate("2024-02-29")).toBe(true);
    expect(isValidIsoDate("2025-02-29")).toBe(false);
    expect(isValidIsoDate("15.03.2026")).toBe(false);
    expect(isValidIsoDate("1800-01-01")).toBe(false);
  });

  it("parseNumber", () => {
    expect(parseNumber("1 234,56")).toBe(1234.56);
    expect(parseNumber(12)).toBe(12);
    expect(parseNumber("12zł")).toBeNull();
    expect(parseNumber(Number.NaN)).toBeNull();
  });
});
