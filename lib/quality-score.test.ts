import { describe, expect, it } from "vitest";
import { qualityScore, scoreBand } from "./quality-score";

describe("quality score", () => {
  it("is 100 for a clean grade A bundle", () => {
    expect(qualityScore(100, 0, "A")).toBe(100);
  });

  it("loses 5 points per defect per 100 m", () => {
    expect(qualityScore(100, 2, "A")).toBe(90);
    // 1 defect in 102.5 m = 0.98 per 100 m = 4.9 points
    expect(qualityScore(102.5, 1, "A")).toBe(95);
    // the same defects matter less on a longer bundle
    expect(qualityScore(200, 2, "A")).toBe(95);
  });

  it("takes off 10 for grade B and 25 for grade C", () => {
    expect(qualityScore(100, 0, "B")).toBe(90);
    expect(qualityScore(100, 3, "B")).toBe(75);
    expect(qualityScore(100, 0, "C")).toBe(75);
  });

  it("never goes below 0 and is 0 without a length", () => {
    expect(qualityScore(10, 50, "C")).toBe(0);
    expect(qualityScore(0, 0, "A")).toBe(0);
  });

  it("names the band", () => {
    expect([95, 80, 65, 40].map(scoreBand)).toEqual(["Excellent", "Good", "Fair", "Poor"]);
  });
});
