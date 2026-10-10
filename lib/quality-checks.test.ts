import { describe, expect, it } from "vitest";
import { meetsStandard, QC_SECTIONS, qualityPercentages, scoreBand, standardText, type CheckEntries } from "./quality-checks";

const ctx = { orderWidthInches: 60, lengthMeters: 100 };
const def = (key: string) => QC_SECTIONS.flatMap((s) => s.checks).find((c) => c.key === key)!;
const all = (pass: boolean): CheckEntries =>
  Object.fromEntries(QC_SECTIONS.flatMap((s) => s.checks).map((c) => [c.key, { value: 1, pass }]));

describe("quality checks", () => {
  it("has the three inspections", () => {
    expect(QC_SECTIONS.map((s) => s.title)).toEqual(["Raw material inspection", "Yarn quality checks", "Fabric quality checks"]);
  });

  it("compares a value with its standard", () => {
    expect(meetsStandard(def("raw_moisture"), 7.9, ctx)).toBe(true);
    expect(meetsStandard(def("raw_moisture"), 9, ctx)).toBe(false);
    expect(meetsStandard(def("raw_micronaire"), 4.2, ctx)).toBe(true);
    expect(meetsStandard(def("raw_micronaire"), 5.2, ctx)).toBe(false);
    expect(meetsStandard(def("yarn_csp"), 2100, ctx)).toBe(false);
    expect(meetsStandard(def("raw_staple"), null, ctx)).toBe(false);
    // no numeric standard: the inspector decides
    expect(meetsStandard(def("fab_gsm"), 140, ctx)).toBeNull();
  });

  it("uses the order width and bundle length for fabric limits", () => {
    expect(meetsStandard(def("fab_width"), 60.5, ctx)).toBe(true);
    expect(meetsStandard(def("fab_width"), 58, ctx)).toBe(false);
    // 2 defects allowed per 100 m
    expect(meetsStandard(def("fab_defects"), 2, ctx)).toBe(true);
    expect(meetsStandard(def("fab_defects"), 3, ctx)).toBe(false);
    expect(meetsStandard(def("fab_defects"), 5, { ...ctx, lengthMeters: 300 })).toBe(true);
    expect(standardText(def("fab_width"), ctx)).toBe("59 – 61 in");
    expect(standardText(def("raw_moisture"), ctx)).toBe("8.5 % or less");
    expect(standardText(def("fab_gsm"), ctx)).toBe("Judged by inspector");
  });

  it("calculates the percentage of checks passed", () => {
    expect(qualityPercentages(all(true))).toEqual({ raw: 100, yarn: 100, fabric: 100, overall: 100 });
    expect(qualityPercentages({})).toEqual({ raw: 0, yarn: 0, fabric: 0, overall: 0 });
    const entries = all(true);
    entries.raw_trash = { value: 6, pass: false };
    entries.fab_shrinkage = { value: 5, pass: false };
    entries.fab_defects = { value: 9, pass: false };
    // raw 4 of 5, yarn 5 of 5, fabric 5 of 7, overall 14 of 17
    expect(qualityPercentages(entries)).toEqual({ raw: 80, yarn: 100, fabric: 71, overall: 82 });
  });

  it("names the band", () => {
    expect([95, 80, 65, 40].map(scoreBand)).toEqual(["Excellent", "Good", "Fair", "Poor"]);
  });
});
