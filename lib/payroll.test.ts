import { describe, expect, it } from "vitest";
import { calcPay, DEFAULT_PAY_RULES, monthEnd, monthsBetween, serviceLabel } from "./payroll";

const worker = (joinedOn: string, monthlyPaise = 2_080_000) => ({ joinedOn, monthlyPaise, increments: [] });
const hours = (hoursWorked: number, bonusPaise = 0, deductionPaise = 0) => ({ hoursWorked, bonusPaise, deductionPaise });

describe("service", () => {
  it("counts completed months only", () => {
    expect(monthsBetween("2024-03-15", "2026-03-14")).toBe(23);
    expect(monthsBetween("2024-03-15", "2026-03-15")).toBe(24);
    expect(monthsBetween("2026-10-01", "2026-09-30")).toBe(0);
  });

  it("labels years and months", () => {
    expect(serviceLabel(4)).toBe("4 mo");
    expect(serviceLabel(24)).toBe("2 yr");
    expect(serviceLabel(38)).toBe("3 yr 2 mo");
  });

  it("finds the last day of a month", () => {
    expect(monthEnd("2026-02")).toBe("2026-02-28");
    expect(monthEnd("2026-10")).toBe("2026-10-31");
  });
});

describe("monthly pay", () => {
  it("pays the full salary for standard hours", () => {
    const slip = calcPay(worker("2026-01-01"), hours(208), 0, DEFAULT_PAY_RULES, "2026-10-31");
    expect(slip.basePaise).toBe(2_080_000);
    expect(slip.netPaise).toBe(2_080_000);
  });

  it("pays by the hour when fewer hours are worked", () => {
    expect(calcPay(worker("2026-01-01"), hours(104), 0, DEFAULT_PAY_RULES, "2026-10-31").netPaise).toBe(1_040_000);
  });

  it("pays overtime at one and a half times", () => {
    const slip = calcPay(worker("2026-01-01"), hours(218), 0, DEFAULT_PAY_RULES, "2026-10-31");
    expect(slip.overtimeHours).toBe(10);
    expect(slip.overtimePaise).toBe(150_000);
  });

  it("adds 2% per completed year of service, capped at 20%", () => {
    expect(calcPay(worker("2023-10-01"), hours(208), 0, DEFAULT_PAY_RULES, "2026-10-31").servicePaise).toBe(124_800);
    expect(calcPay(worker("2005-01-01"), hours(208), 0, DEFAULT_PAY_RULES, "2026-10-31").servicePercent).toBe(20);
  });

  it("marks new joiners and applies the training pay", () => {
    const rules = { ...DEFAULT_PAY_RULES, newJoinerPayPercent: 90 };
    const slip = calcPay(worker("2026-08-01"), hours(208), 0, rules, "2026-10-31");
    expect(slip.isNewJoiner).toBe(true);
    expect(slip.basePaise).toBe(1_872_000);
    expect(calcPay(worker("2026-04-30"), hours(208), 0, rules, "2026-10-31").isNewJoiner).toBe(false);
  });

  it("adds trip pay and bonus and takes off deductions", () => {
    const slip = calcPay(worker("2026-01-01"), hours(208, 500_000, 200_000), 350_000, DEFAULT_PAY_RULES, "2026-10-31");
    expect(slip.netPaise).toBe(2_080_000 + 350_000 + 500_000 - 200_000);
  });

  it("flags an increment a year after the last one", () => {
    const due = calcPay(worker("2025-10-01"), undefined, 0, DEFAULT_PAY_RULES, "2026-10-31");
    const recent = calcPay(
      { ...worker("2023-10-01"), increments: [{ on: "2026-04-01", fromPaise: 1, toPaise: 2, note: "", by: "" }] },
      undefined, 0, DEFAULT_PAY_RULES, "2026-10-31",
    );
    expect(due.incrementDue).toBe(true);
    expect(recent.incrementDue).toBe(false);
    expect(due.netPaise).toBe(0);
  });
});
