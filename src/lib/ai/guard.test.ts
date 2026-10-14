import { describe, expect, it } from "vitest";
import { containsLegalCitation } from "./guard";

describe("containsLegalCitation", () => {
  it.each([
    "Zgodnie z art. 560 kupującemu przysługuje prawo",
    "na podstawie ust. 2",
    "§ 3 regulaminu",
    "sygn. akt I C 123/24",
    "zgodnie z ustawą o prawach konsumenta",
    "rozporządzenie nr 261/2004",
    "Kodeks cywilny stanowi",
    "przepisy k.c. przewidują",
    "zgodnie z KC",
    "wyrokiem sądu",
    "w orzecznictwie przyjmuje się",
    "uchwała zarządu",
    "Trybunał Sprawiedliwości",
    "Sąd Najwyższy orzekł",
    "dyrektywa unijna",
    "Rozporządzenie (WE) nr 261/2004",
  ])("wykrywa: %s", (text) => {
    expect(containsLegalCitation(text)).toBe(true);
  });

  it.each([
    "Dnia 3 marca 2026 r. kupiłem pralkę w sklepie internetowym.",
    "Proszę o zwrot kwoty 149,99 zł na rachunek bankowy.",
    "Towar przestał działać po dwóch tygodniach użytkowania.",
    "Zwracam się z prośbą o artykuły biurowe.",
  ])("przepuszcza fakty: %s", (text) => {
    expect(containsLegalCitation(text)).toBe(false);
  });

  it("puste wartości są bezpieczne", () => {
    expect(containsLegalCitation(undefined)).toBe(false);
    expect(containsLegalCitation(null)).toBe(false);
    expect(containsLegalCitation("")).toBe(false);
  });
});
